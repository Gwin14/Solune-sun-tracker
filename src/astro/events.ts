import * as A from 'astronomy-engine';

import { formatNumber } from './format';
import { fullMoonName, moonState, SUPERMOON_KM } from './moon';
import { moonPosition, observer, sunPosition, type Place } from './sun';
import { language, strings, type Strings } from '@/i18n';
import { dayMemo } from '@/lib/dayMemo';

import { DAY_MS, wallClock } from './time';

type MeteorShower = keyof Strings['events']['showers'];

export type SkyEventKind = 'season' | 'lunarEclipse' | 'solarEclipse' | 'fullMoon' | 'meteor' | 'supermoon';

export type SkyEvent = {
  id: string;
  kind: SkyEventKind;
  title: string;
  subtitle: string;
  date: Date;
  visibleHere?: boolean;
  detail?: string;
};

/** Peak dates of the major annual showers; names and radiants come from the dictionary. */
const METEOR_SHOWERS: { id: MeteorShower; month: number; day: number; zhr: number }[] = [
  { id: 'quadrantids', month: 0, day: 3, zhr: 110 },
  { id: 'lyrids', month: 3, day: 22, zhr: 18 },
  { id: 'etaAquariids', month: 4, day: 6, zhr: 50 },
  { id: 'deltaAquariids', month: 6, day: 30, zhr: 25 },
  { id: 'perseids', month: 7, day: 12, zhr: 100 },
  { id: 'orionids', month: 9, day: 21, zhr: 20 },
  { id: 'leonids', month: 10, day: 17, zhr: 15 },
  { id: 'geminids', month: 11, day: 14, zhr: 150 },
];

export function upcomingEvents(place: Place, from: Date, horizonDays = 400): SkyEvent[] {
  const obs = observer(place);
  const until = from.getTime() + horizonDays * DAY_MS;
  const south = place.latitude < 0;
  const events: SkyEvent[] = [];
  const tx = strings().events;
  const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() <= until;

  // Seasons
  const year = from.getUTCFullYear();
  for (const y of [year, year + 1]) {
    const s = A.Seasons(y);
    const list: [Date, string, string][] = [
      [s.mar_equinox.date, south ? tx.autumnEquinox : tx.springEquinox, tx.equinoxNote],
      [s.jun_solstice.date, south ? tx.winterSolstice : tx.summerSolstice, south ? tx.shortestDay : tx.longestDay],
      [s.sep_equinox.date, south ? tx.springEquinox : tx.autumnEquinox, tx.equinoxNote],
      [s.dec_solstice.date, south ? tx.summerSolstice : tx.winterSolstice, south ? tx.longestDay : tx.shortestDay],
    ];
    for (const [d, title, subtitle] of list) {
      if (inRange(d)) events.push({ id: `season-${d.getTime()}`, kind: 'season', title, subtitle, date: d });
    }
  }

  // Lunar eclipses
  let le = A.SearchLunarEclipse(from);
  for (let i = 0; i < 6 && le.peak.date.getTime() <= until; i++) {
    const visible = moonPosition(le.peak.date, obs).alt > 0;
    events.push({
      id: `lunar-${le.peak.date.getTime()}`,
      kind: 'lunarEclipse',
      title: tx.lunarEclipse(le.kind),
      subtitle: visible ? tx.visibleFromHere : tx.belowHorizonHere,
      visibleHere: visible,
      detail: le.sd_total > 0 ? tx.totality(Math.round(le.sd_total * 2)) : tx.eclipseDuration(Math.round(le.sd_penum * 2)),
      date: le.peak.date,
    });
    le = A.NextLunarEclipse(le.peak);
  }

  // Solar eclipses (global, flagged when visible locally)
  let ge = A.SearchGlobalSolarEclipse(from);
  for (let i = 0; i < 4 && ge.peak.date.getTime() <= until; i++) {
    const sun = sunPosition(ge.peak.date, obs);
    let visible = false;
    try {
      const local = A.SearchLocalSolarEclipse(new Date(ge.peak.date.getTime() - DAY_MS), obs);
      visible = Math.abs(local.peak.time.date.getTime() - ge.peak.date.getTime()) < DAY_MS && local.peak.altitude > 0;
    } catch {
      visible = false;
    }
    events.push({
      id: `solar-${ge.peak.date.getTime()}`,
      kind: 'solarEclipse',
      title: tx.solarEclipse(ge.kind),
      subtitle: visible ? tx.partlyVisibleHere : tx.visibleElsewhere,
      visibleHere: visible && sun.alt > 0,
      date: ge.peak.date,
    });
    ge = A.NextGlobalSolarEclipse(ge.peak);
  }

  // Full moons
  let mq = A.SearchMoonQuarter(from);
  const fullsByMonth = new Map<string, number>();
  for (let i = 0; i < 60; i++) {
    if (mq.time.date.getTime() > until) break;
    if (mq.quarter === 2) {
      const d = mq.time.date;
      const w = wallClock(d, place.tz);
      const key = `${w.year}-${w.month}`;
      const count = (fullsByMonth.get(key) ?? 0) + 1;
      fullsByMonth.set(key, count);
      const dist = moonState(d).distanceKm;
      const isSuper = dist < SUPERMOON_KM;
      events.push({
        id: `full-${d.getTime()}`,
        kind: isSuper ? 'supermoon' : 'fullMoon',
        title: isSuper ? tx.supermoon(fullMoonName(d, w.month, count > 1)) : fullMoonName(d, w.month, count > 1),
        subtitle: isSuper ? tx.supermoonNote : tx.fullMoon,
        detail: tx.kmFromEarth(formatNumber(dist)),
        date: d,
      });
    }
    mq = A.NextMoonQuarter(mq);
  }

  // Meteor showers
  for (const y of [year, year + 1]) {
    for (const m of METEOR_SHOWERS) {
      const d = new Date(Date.UTC(y, m.month, m.day, 4));
      if (!inRange(d)) continue;
      const illum = moonState(d).illumination;
      const shower = tx.showers[m.id];
      events.push({
        id: `meteor-${m.id}-${y}`,
        kind: 'meteor',
        title: tx.meteorShower(shower.name),
        subtitle: tx.meteorRate(m.zhr, shower.radiant),
        detail: illum > 0.6 ? tx.brightMoon : tx.darkMoon,
        date: d,
      });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const eventsMemo = dayMemo(2, (place: Place & { lang: string }, start: Date) => upcomingEvents(place, start));

/** The default 400-day scan from a local day's start, shared by the Events tab and the widgets. */
export const upcomingEventsForDay = (place: Place, start: Date) => eventsMemo({ ...place, lang: language() }, start);
