import * as A from 'astronomy-engine';

import type { SkyEvent } from '@/astro/events';
import { upcomingEventsForDay } from '@/astro/events';
import { formatDaysUntil, formatDuration, formatSignedMinutes, formatTime, MONTHS_SHORT, WEEKDAYS_LETTER } from '@/astro/format';
import { computeMoonDay, moonState, nextQuarters, PHASE_LABEL, type PhaseKey } from '@/astro/moon';
import { computePath, computeSunDay, observer, sunPosition, type SunDay } from '@/astro/sun';
import { addDays, dayKey, daysBetweenKeys, MIN_MS, shiftKey, startOfDay, wallClock } from '@/astro/time';
import { computeStreak, bestStreak, levelFor } from '@/lib/achievements';
import { dayMemo } from '@/lib/dayMemo';
import type { SavedPlace } from '@/store/app';
import { SKY } from '@/theme/sky';

import type { EventWidgetProps, GoldenWidgetProps, LockWidgetProps, MoonWidgetProps, SkyMomentProps, StreakWidgetProps, SunWidgetProps } from './types';

/** Northern-hemisphere SF Symbols; the southern sky sees the lit side mirrored. */
const MOON_SYMBOL: Record<PhaseKey, string> = {
  new: 'moonphase.new.moon',
  waxingCrescent: 'moonphase.waxing.crescent',
  firstQuarter: 'moonphase.first.quarter',
  waxingGibbous: 'moonphase.waxing.gibbous',
  full: 'moonphase.full.moon',
  waningGibbous: 'moonphase.waning.gibbous',
  lastQuarter: 'moonphase.last.quarter',
  waningCrescent: 'moonphase.waning.crescent',
};
const MIRROR: Partial<Record<PhaseKey, PhaseKey>> = {
  waxingCrescent: 'waningCrescent',
  waningCrescent: 'waxingCrescent',
  firstQuarter: 'lastQuarter',
  lastQuarter: 'firstQuarter',
  waxingGibbous: 'waningGibbous',
  waningGibbous: 'waxingGibbous',
};

export function moonSymbol(key: PhaseKey, latitude: number): string {
  return MOON_SYMBOL[latitude < 0 ? (MIRROR[key] ?? key) : key];
}

/** Two-stop sky gradient for the moment, darkened so white type always holds. */
export function skyGradient(alt: number): string[] {
  let frame = SKY[0];
  for (const k of SKY) if (alt >= k.alt) frame = k;
  return [frame.colors[0], frame.colors[1]];
}

export const NIGHT_BG = ['#05081A', '#10153A'];

type Ctx = { place: SavedPlace; use24h: boolean };

// A widget sync renders ~60 timeline entries; most of what they show only changes once a
// day, so everything expensive is computed once per place and local day.
export const sunDayFor = dayMemo(8, computeSunDay);
const sunPathFor = dayMemo(3, (place, start) => computePath(A.Body.Sun, place, start).alt);
const moonDayFor = dayMemo(3, computeMoonDay);
// Enough quarters past the day's start that the next full and new moon are always in it.
const quartersFor = dayMemo(3, (_place, start) => nextQuarters(start, 9));
const eventsFor = upcomingEventsForDay;

function window(start: Date | null, end: Date | null, ctx: Ctx) {
  return start && end ? `${formatTime(start, ctx.place.tz, ctx.use24h)}–${formatTime(end, ctx.place.tz, ctx.use24h)}` : '—';
}

export function sunProps(ctx: Ctx, at: Date): SunWidgetProps {
  const { place, use24h } = ctx;
  const tz = place.tz;
  const start = startOfDay(at, tz);
  const today = sunDayFor(place, start);
  const tomorrow = sunDayFor(place, addDays(start, 1, tz));
  const yesterday = sunDayFor(place, addDays(start, -1, tz));
  const t = (d: Date | null) => formatTime(d, tz, use24h);

  const candidates = [
    { kind: 'rise', d: today.sunrise },
    { kind: 'set', d: today.sunset },
    { kind: 'rise', d: tomorrow.sunrise },
    { kind: 'set', d: tomorrow.sunset },
  ].filter((c): c is { kind: string; d: Date } => !!c.d && c.d.getTime() > at.getTime());
  const next = candidates[0];
  const alt = sunPosition(at, observer(place)).alt;

  const path = sunPathFor(place, start);
  const curve = Array.from({ length: 25 }, (_, h) => Math.max(-12, Math.round(path[Math.min(path.length - 1, h * 10)] * 10) / 10));

  let dayProgress = 0;
  if (today.sunrise && today.sunset) {
    dayProgress = Math.min(1, Math.max(0, (at.getTime() - today.sunrise.getTime()) / (today.sunset.getTime() - today.sunrise.getTime())));
  } else if (today.polar === 'day') dayProgress = wallClock(at, tz).minuteOfDay / 1440;

  const phase = alt >= 6 ? 'Luz do dia' : alt >= -4 ? 'Hora dourada' : alt >= -6 ? 'Hora azul' : alt >= -18 ? 'Crepúsculo' : 'Noite';

  return {
    place: place.name,
    nextKind: next ? next.kind : today.polar === 'day' ? 'polarDay' : 'polarNight',
    nextLabel: next ? (next.kind === 'rise' ? 'Nascer do sol' : 'Pôr do sol') : today.polar === 'day' ? 'Sol da meia-noite' : 'Noite polar',
    nextTime: next ? t(next.d) : '—',
    nextAt: next ? next.d.getTime() : 0,
    rise: t(today.sunrise),
    set: t(today.sunset),
    noon: t(today.noon),
    dayLength: formatDuration(today.dayLengthMin, { compact: true }),
    dayDelta: formatSignedMinutes(today.dayLengthMin - yesterday.dayLengthMin),
    goldenEvening: window(today.goldenEvening.start, today.goldenEvening.end, ctx),
    blueEvening: window(today.blueEvening.start, today.blueEvening.end, ctx),
    altitude: Math.round(alt),
    phase,
    dayProgress,
    curve,
    bg: skyGradient(alt),
  };
}

export function moonProps(ctx: Ctx, at: Date): MoonWidgetProps {
  const { place, use24h } = ctx;
  const tz = place.tz;
  const st = moonState(at);
  const start = startOfDay(at, tz);
  const day = moonDayFor(place, start);
  const quarters = quartersFor(place, start).filter((q) => q.date.getTime() > at.getTime());
  const full = quarters.find((q) => q.key === 'full');
  const fresh = quarters.find((q) => q.key === 'new');
  const short = (d?: Date) => {
    if (!d) return '—';
    const w = wallClock(d, tz);
    return `${w.day} ${MONTHS_SHORT[w.month]}`;
  };
  const inDays = (d?: Date) => (d ? formatDaysUntil(daysBetweenKeys(dayKey(at, tz), dayKey(d, tz))) : '');
  return {
    place: place.name,
    phase: PHASE_LABEL[st.key],
    symbol: moonSymbol(st.key, place.latitude),
    illumination: Math.round(st.illumination * 100),
    age: `${st.ageDays.toFixed(1).replace('.', ',')} dias`,
    rise: formatTime(day.moonrise, tz, use24h),
    set: formatTime(day.moonset, tz, use24h),
    nextFull: short(full?.date),
    nextFullIn: inDays(full?.date),
    nextNew: short(fresh?.date),
    nextNewIn: inDays(fresh?.date),
    bg: NIGHT_BG,
  };
}

export function goldenProps(ctx: Ctx, at: Date): GoldenWidgetProps {
  const { place } = ctx;
  const tz = place.tz;
  const start = startOfDay(at, tz);
  const today = sunDayFor(place, start);
  const tomorrow = sunDayFor(place, addDays(start, 1, tz));
  const now = at.getTime();
  // The next (or current) evening golden hour; after it ends, tomorrow morning's.
  const windows = [
    { title: 'Hora dourada', g: today.goldenMorning, b: today.blueMorning, morning: true },
    { title: 'Hora dourada', g: today.goldenEvening, b: today.blueEvening, morning: false },
    { title: 'Hora dourada', g: tomorrow.goldenMorning, b: tomorrow.blueMorning, morning: true },
  ].filter((w) => w.g.start && w.g.end && (w.b.end ?? w.g.end)!.getTime() > now);
  const w = windows[0];
  const gStart = w?.g.start?.getTime() ?? 0;
  const gEnd = w?.g.end?.getTime() ?? 0;
  const bStart = w?.b.start?.getTime() ?? 0;
  const bEnd = w?.b.end?.getTime() ?? 0;
  // Morning: blue comes first, then golden. Evening: golden, then blue.
  const firstStart = w?.morning ? bStart : gStart;
  let state = 'before';
  if (now >= gStart && now < gEnd) state = 'golden';
  else if (now >= Math.min(bStart, bEnd) && now < Math.max(bStart, bEnd)) state = 'blue';
  else if (now > Math.max(gEnd, bEnd)) state = 'after';
  return {
    place: place.name,
    state,
    title: w?.morning ? 'Hora dourada da manhã' : 'Hora dourada',
    window: window(w?.g.start ?? null, w?.g.end ?? null, ctx),
    startAt: gStart,
    endAt: gEnd,
    blueWindow: window(w?.b.start ?? null, w?.b.end ?? null, ctx),
    blueStartAt: bStart,
    blueEndAt: bEnd,
    morningWindow: window(tomorrow.goldenMorning.start, tomorrow.goldenMorning.end, ctx),
    bg: firstStart && now < firstStart ? skyGradient(sunPosition(at, observer(place)).alt) : ['#3A2A4E', '#C9768C'],
  };
}

export function lockProps(ctx: Ctx, at: Date): LockWidgetProps {
  const s = sunProps(ctx, at);
  const m = moonProps(ctx, at);
  const g = goldenProps(ctx, at);
  return {
    sun: {
      label: s.nextKind === 'rise' ? 'Nascer' : 'Pôr do sol',
      time: s.nextTime,
      at: s.nextAt,
      progress: s.dayProgress,
      symbol: s.nextKind === 'rise' ? 'sunrise.fill' : 'sunset.fill',
      place: s.place,
    },
    moon: { phase: m.phase, symbol: m.symbol, illumination: m.illumination, next: `Cheia ${m.nextFullIn}` },
    golden: { label: g.state === 'golden' ? 'Hora dourada agora' : 'Hora dourada', window: g.window, at: g.state === 'golden' ? g.endAt : g.startAt },
  };
}

export function streakProps(
  checkInKeys: string[],
  xp: number,
  tz: string | undefined,
  now: Date,
): StreakWidgetProps {
  const today = dayKey(now, tz);
  const { streak, alive } = computeStreak(checkInKeys, today, shiftKey);
  const set = new Set(checkInKeys);
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(today, i - 6));
  const lvl = levelFor(xp);
  return {
    streak,
    best: bestStreak(checkInKeys, shiftKey),
    done: alive,
    week: days.map((k) => (set.has(k) ? 1 : 0)),
    letters: days.map((k) => {
      const [y, m, d] = k.split('-').map(Number);
      return WEEKDAYS_LETTER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    }),
    hint: alive ? 'Sequência garantida hoje' : streak > 0 ? 'Registre o céu hoje' : 'Comece uma sequência',
    level: `Nível ${lvl.level} · ${lvl.title}`,
    progress: lvl.progress,
    bg: NIGHT_BG,
  };
}

const EVENT_SYMBOL: Record<SkyEvent['kind'], string> = {
  season: 'leaf.fill',
  lunarEclipse: 'moon.circle.fill',
  solarEclipse: 'sun.max.circle.fill',
  fullMoon: 'moonphase.full.moon',
  supermoon: 'sparkles',
  meteor: 'sparkle',
};

export function eventProps(ctx: Ctx, at: Date): EventWidgetProps {
  const tz = ctx.place.tz;
  const list = eventsFor(ctx.place, startOfDay(at, tz));
  const fmt = (d: Date) => {
    const w = wallClock(d, tz);
    return `${w.day} ${MONTHS_SHORT[w.month]}`;
  };
  const first = list[0];
  if (!first) {
    return { title: 'Céu tranquilo', subtitle: 'Nenhum evento no próximo ano', date: '', daysLabel: '', symbol: 'sparkle', visible: false, following: [], bg: NIGHT_BG };
  }
  return {
    title: first.title,
    subtitle: first.subtitle,
    date: fmt(first.date),
    daysLabel: formatDaysUntil(daysBetweenKeys(dayKey(at, tz), dayKey(first.date, tz))),
    symbol: EVENT_SYMBOL[first.kind],
    visible: !!first.visibleHere,
    following: list.slice(1, 4).map((e) => ({ title: e.title, date: fmt(e.date) })),
    bg: NIGHT_BG,
  };
}

/** Moments when a widget's content changes: every half hour, plus every sun event. */
export function timelineMoments(place: SavedPlace, from: Date, hours = 24): Date[] {
  const tz = place.tz;
  const start = startOfDay(from, tz);
  const days = [sunDayFor(place, start), sunDayFor(place, addDays(start, 1, tz))];
  const edges: number[] = [];
  for (const d of days) {
    for (const w of [d.sunrise, d.sunset, d.goldenMorning.start, d.goldenMorning.end, d.goldenEvening.start, d.goldenEvening.end, d.blueMorning.start, d.blueEvening.end]) {
      if (w) edges.push(w.getTime() + 30_000);
    }
  }
  const end = from.getTime() + hours * 3_600_000;
  const step = 30 * MIN_MS;
  const grid: number[] = [];
  for (let t = Math.ceil(from.getTime() / step) * step; t < end; t += step) grid.push(t);
  return [from.getTime(), ...grid, ...edges.filter((t) => t > from.getTime() && t < end)]
    .sort((a, b) => a - b)
    .filter((t, i, a) => i === 0 || t - a[i - 1] > 60_000)
    .map((t) => new Date(t));
}

/** The live-activity payload for the next golden hour, sunset or sunrise. */
export function skyMomentProps(ctx: Ctx, kind: 'golden' | 'sunset' | 'sunrise', at: Date): SkyMomentProps | null {
  const { place, use24h } = ctx;
  const tz = place.tz;
  const start = startOfDay(at, tz);
  const now = at.getTime();
  const days = [sunDayFor(place, start), sunDayFor(place, addDays(start, 1, tz))];
  const t = (d: Date) => formatTime(d, tz, use24h);
  for (const d of days) {
    if (kind === 'golden') {
      for (const w of [d.goldenMorning, d.goldenEvening]) {
        if (w.start && w.end && w.end.getTime() > now) {
          return {
            kind,
            title: 'Hora dourada',
            place: place.name,
            symbol: 'sun.horizon.fill',
            startAt: w.start.getTime(),
            endAt: w.end.getTime(),
            startTime: t(w.start),
            endTime: t(w.end),
            caption: `Luz quente até ${t(w.end)}`,
          };
        }
      }
    } else {
      const ev = kind === 'sunset' ? d.sunset : d.sunrise;
      if (ev && ev.getTime() > now) {
        // Track the last hour before the event.
        const from = Math.max(now, ev.getTime() - 60 * MIN_MS);
        return {
          kind,
          title: kind === 'sunset' ? 'Pôr do sol' : 'Nascer do sol',
          place: place.name,
          symbol: kind === 'sunset' ? 'sunset.fill' : 'sunrise.fill',
          startAt: from,
          endAt: ev.getTime(),
          startTime: t(new Date(from)),
          endTime: t(ev),
          caption: `${kind === 'sunset' ? 'O sol se põe' : 'O sol nasce'} às ${t(ev)}`,
        };
      }
    }
  }
  return null;
}


/**
 * The "sky" entity Siri reads from without opening the app: the next few days of sun events
 * as Unix-millisecond lists, and the moon for each of the next seven days.
 */
export function skyCatalogEntity(place: SavedPlace, from: Date, days = 4) {
  const tz = place.tz;
  const start = startOfDay(from, tz);
  const list = (pick: (d: SunDay) => (Date | null)[]) => {
    const out: number[] = [];
    for (let i = 0; i < days; i++) for (const d of pick(sunDayFor(place, addDays(start, i, tz)))) if (d) out.push(d.getTime());
    return out.join(',');
  };
  const pairs = (pick: (d: SunDay) => { start: Date | null; end: Date | null }[]) => {
    const s: number[] = [];
    const e: number[] = [];
    for (let i = 0; i < days; i++) {
      for (const w of pick(sunDayFor(place, addDays(start, i, tz)))) {
        if (w.start && w.end) {
          s.push(w.start.getTime());
          e.push(w.end.getTime());
        }
      }
    }
    return [s.join(','), e.join(',')];
  };
  const [goldenStart, goldenEnd] = pairs((d) => [d.goldenMorning, d.goldenEvening]);
  const metadata: Record<string, string> = {
    sunrise: list((d) => [d.sunrise]),
    sunset: list((d) => [d.sunset]),
    goldenStart,
    goldenEnd,
    nextFull: nextQuarters(from, 8)
      .filter((q) => q.key === 'full')
      .map((q) => q.date.getTime())
      .join(','),
    day0: String(start.getTime()),
  };
  for (let i = 0; i < 7; i++) {
    // Midday, so the label matches what the moon looks like that evening.
    const st = moonState(new Date(addDays(start, i, tz).getTime() + 12 * 3_600_000));
    metadata[`moonPhase${i}`] = PHASE_LABEL[st.key];
    metadata[`moonIllumination${i}`] = String(Math.round(st.illumination * 100));
  }
  return { id: 'sky', title: place.name, subtitle: place.region, metadata };
}
