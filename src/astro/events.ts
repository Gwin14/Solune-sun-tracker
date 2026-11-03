import * as A from 'astronomy-engine';

import { fullMoonName, moonState, SUPERMOON_KM } from './moon';
import { moonPosition, observer, sunPosition, type Place } from './sun';
import { dayMemo } from '@/lib/dayMemo';

import { DAY_MS, wallClock } from './time';

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

const ECLIPSE_KIND: Record<string, string> = {
  penumbral: 'penumbral',
  partial: 'parcial',
  annular: 'anular',
  total: 'total',
};

const METEOR_SHOWERS: { name: string; month: number; day: number; zhr: number; radiant: string }[] = [
  { name: 'Quadrântidas', month: 0, day: 3, zhr: 110, radiant: 'Boieiro' },
  { name: 'Líridas', month: 3, day: 22, zhr: 18, radiant: 'Lira' },
  { name: 'Eta Aquáridas', month: 4, day: 6, zhr: 50, radiant: 'Aquário' },
  { name: 'Delta Aquáridas', month: 6, day: 30, zhr: 25, radiant: 'Aquário' },
  { name: 'Perseidas', month: 7, day: 12, zhr: 100, radiant: 'Perseu' },
  { name: 'Oriônidas', month: 9, day: 21, zhr: 20, radiant: 'Órion' },
  { name: 'Leônidas', month: 10, day: 17, zhr: 15, radiant: 'Leão' },
  { name: 'Geminídeas', month: 11, day: 14, zhr: 150, radiant: 'Gêmeos' },
];

export function upcomingEvents(place: Place, from: Date, horizonDays = 400): SkyEvent[] {
  const obs = observer(place);
  const until = from.getTime() + horizonDays * DAY_MS;
  const south = place.latitude < 0;
  const events: SkyEvent[] = [];
  const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() <= until;

  // Seasons
  const year = from.getUTCFullYear();
  for (const y of [year, year + 1]) {
    const s = A.Seasons(y);
    const list: [Date, string, string][] = [
      [s.mar_equinox.date, south ? 'Equinócio de outono' : 'Equinócio de primavera', 'Dia e noite quase iguais em todo o planeta.'],
      [s.jun_solstice.date, south ? 'Solstício de inverno' : 'Solstício de verão', south ? 'O dia mais curto do ano por aqui.' : 'O dia mais longo do ano por aqui.'],
      [s.sep_equinox.date, south ? 'Equinócio de primavera' : 'Equinócio de outono', 'Dia e noite quase iguais em todo o planeta.'],
      [s.dec_solstice.date, south ? 'Solstício de verão' : 'Solstício de inverno', south ? 'O dia mais longo do ano por aqui.' : 'O dia mais curto do ano por aqui.'],
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
      title: `Eclipse lunar ${ECLIPSE_KIND[le.kind]}`,
      subtitle: visible ? 'Visível da sua localização' : 'Abaixo do horizonte aqui',
      visibleHere: visible,
      detail: le.sd_total > 0 ? `Totalidade de ${Math.round(le.sd_total * 2)} min` : `Duração de ${Math.round(le.sd_penum * 2)} min`,
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
      title: `Eclipse solar ${ECLIPSE_KIND[ge.kind]}`,
      subtitle: visible ? 'Parcialmente visível daqui' : 'Visível em outras regiões',
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
        title: isSuper ? `Superlua · ${fullMoonName(d, w.month, count > 1)}` : fullMoonName(d, w.month, count > 1),
        subtitle: isSuper ? 'A lua cheia mais próxima, até 14% maior' : 'Lua cheia',
        detail: `${Math.round(dist).toLocaleString('pt-BR')} km da Terra`,
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
      events.push({
        id: `meteor-${m.name}-${y}`,
        kind: 'meteor',
        title: `Chuva de meteoros ${m.name}`,
        subtitle: `Até ${m.zhr} meteoros/h · radiante em ${m.radiant}`,
        detail: illum > 0.6 ? 'Lua brilhante vai atrapalhar' : 'Lua favorável, céu escuro',
        date: d,
      });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** The default 400-day scan from a local day's start, shared by the Events tab and the widgets. */
export const upcomingEventsForDay = dayMemo(2, (place: Place, start: Date) => upcomingEvents(place, start));
