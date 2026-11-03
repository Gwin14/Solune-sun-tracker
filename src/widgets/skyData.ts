import * as A from 'astronomy-engine';

import { compassPoint, formatDegrees, formatTime } from '@/astro/format';
import { moonState } from '@/astro/moon';
import { altAz, horizonFrame, planViewing, PLANETS, rotateInto, type ViewingPlan } from '@/astro/sky/engine';
import { describeTarget, kindOf, targetEqjAt, type TargetId } from '@/astro/sky/targets';
import { observer } from '@/astro/sun';
import { addDays, startOfDay } from '@/astro/time';
import { strings } from '@/i18n';
import type { SavedPlace } from '@/store/app';

import { moonSymbol, NIGHT_BG, sunDayFor } from './data';
import type { FavoritesWidgetProps, SkyObjectRow, TonightWidgetProps } from './types';

/**
 * Planetarium widgets. Rise, set and best times come from one 24-hour scan per object at sync
 * time; each timeline entry then only rotates the object into that instant's horizon.
 */

type Ctx = { place: SavedPlace; use24h: boolean };

type Tracked = {
  id: TargetId;
  name: string;
  color: string;
  symbol: string;
  eqjAt: ((t: Date) => ArrayLike<number>) | null;
  plan: ViewingPlan | null;
};

const SYMBOL: Record<string, string> = {
  star: 'star.fill',
  planet: 'circle.fill',
  dso: 'sparkles',
  constellation: 'point.3.connected.trianglepath.dotted',
  asterism: 'point.3.connected.trianglepath.dotted',
  galactic: 'hurricane',
  pole: 'location.north.fill',
  sun: 'sun.max.fill',
};

/** What a sync knows about a set of objects, built once and reused by every entry. */
export function trackTargets(ctx: Ctx, ids: string[], now: Date): Tracked[] {
  const { place } = ctx;
  const frame = horizonFrame(place, now);
  const phase = moonState(now);
  const out: Tracked[] = [];
  for (const raw of ids) {
    const id = raw as TargetId;
    try {
      const info = describeTarget(frame, id, { moonIllum: phase.illumination, moonDistKm: phase.distanceKm });
      const eqjAt = targetEqjAt(id, place);
      const kind = kindOf(id);
      out.push({
        id,
        name: info.title,
        color: info.color,
        symbol: kind === 'moon' ? moonSymbol(phase.key, place.latitude) : SYMBOL[kind],
        eqjAt,
        plan: eqjAt ? planViewing(place, now, eqjAt) : null,
      });
    } catch {
      // A favourite from an older catalogue: skip it rather than fail the whole sync.
    }
  }
  return out;
}

function rowAt(tr: Tracked, ctx: Ctx, at: Date, rot: number[][]): SkyObjectRow & { alt: number } {
  const t = (d: Date) => formatTime(d, ctx.place.tz, ctx.use24h);
  const tx = strings().widgets;
  const url = `solune://object/${encodeURIComponent(tr.id)}`;
  // The darkest moment means nothing for the Sun and Moon themselves.
  const timed = tr.id !== 'moon' && tr.id !== 'sun';
  const best = timed && tr.plan?.best && tr.plan.best.time.getTime() > at.getTime() ? tx.best(t(tr.plan.best.time)) : '';
  if (!tr.eqjAt) {
    // The celestial pole never moves: it sits at the latitude's height all night.
    const alt = Math.abs(ctx.place.latitude);
    return { id: tr.id, name: tr.name, color: tr.color, symbol: tr.symbol, status: tx.fixedAt(formatDegrees(alt)), best: '', up: true, url, alt };
  }
  const v = rotateInto(rot, tr.eqjAt(at), new Float64Array(3));
  const { alt, az } = altAz(v[0], v[1], v[2]);
  let status: string;
  if (alt > 0) status = `${formatDegrees(alt)} ${compassPoint(az)}`;
  else if (tr.plan?.neverUp) status = tx.noRiseToday;
  else if (tr.plan?.rise && tr.plan.rise.getTime() > at.getTime()) status = tx.risesAtShort(t(tr.plan.rise));
  else status = strings().target.belowHorizon;
  return { id: tr.id, name: tr.name, color: tr.color, symbol: tr.symbol, status, best, up: alt > 0, url, alt };
}

function rowsAt(tracked: Tracked[], ctx: Ctx, at: Date) {
  const rot = A.Rotation_EQJ_HOR(at, observer(ctx.place)).rot;
  return tracked.map((tr) => rowAt(tr, ctx, at, rot));
}

const strip = ({ alt: _alt, ...row }: SkyObjectRow & { alt: number }): SkyObjectRow => row;

/** Planets bright enough for the naked eye, if they reach a dark (or twilight) sky in the next day. */
export function tonightPlanets(ctx: Ctx, now: Date): Tracked[] {
  const naked = PLANETS.filter((p) => p.id !== 'Uranus' && p.id !== 'Neptune').map((p) => `planet:${p.id}`);
  return trackTargets(ctx, naked, now)
    .filter((tr) => tr.plan?.best)
    .sort((a, b) => a.plan!.best!.time.getTime() - b.plan!.best!.time.getTime());
}

export function tonightProps(ctx: Ctx, at: Date, planets: Tracked[]): TonightWidgetProps {
  const { place } = ctx;
  const tz = place.tz;
  const t = (d: Date | null) => formatTime(d, tz, ctx.use24h);
  const start = startOfDay(at, tz);
  const today = sunDayFor(place, start);
  // Before today's dawn, "tonight" is the night already under way.
  const before = today.astronomical.start && at.getTime() < today.astronomical.start.getTime();
  const evening = before ? sunDayFor(place, addDays(start, -1, tz)) : today;
  const morning = before ? today : sunDayFor(place, addDays(start, 1, tz));
  const dusk = evening.astronomical.end;
  const dawn = morning.astronomical.start;
  const st = moonState(at);
  const illum = Math.round(st.illumination * 100);
  const tx = strings().widgets;
  return {
    place: place.name,
    dark: dusk && dawn ? `${t(dusk)}–${t(dawn)}` : tx.noDarkNight,
    darkLabel: dusk && dawn ? (at.getTime() >= dusk.getTime() && at.getTime() < dawn.getTime() ? tx.darkNow : tx.dark) : tx.noAstroDark,
    moon: `${strings().sky.moon} ${illum}% · ${illum > 60 ? tx.moonBright : illum > 25 ? tx.moonSome : tx.moonFavorable}`,
    moonSymbol: moonSymbol(st.key, place.latitude),
    rows: rowsAt(planets, ctx, at).map(strip),
    bg: NIGHT_BG,
    labels: tx.tonight,
  };
}

export function favoritesProps(ctx: Ctx, at: Date, favorites: Tracked[]): FavoritesWidgetProps {
  // What is up comes first, highest first; then what rises soonest.
  const rows = rowsAt(favorites, ctx, at).sort((a, b) => (a.up === b.up ? (a.up ? b.alt - a.alt : 0) : a.up ? -1 : 1));
  return { rows: rows.map(strip), bg: NIGHT_BG, labels: strings().widgets.favorites };
}
