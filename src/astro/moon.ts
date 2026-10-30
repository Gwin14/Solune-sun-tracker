import * as A from 'astronomy-engine';

import { observer, type Place } from './sun';
import { addDays } from './time';

export const SYNODIC_DAYS = 29.530588853;

export type PhaseKey =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

export const PHASE_LABEL: Record<PhaseKey, string> = {
  new: 'Lua nova',
  waxingCrescent: 'Lua crescente',
  firstQuarter: 'Quarto crescente',
  waxingGibbous: 'Gibosa crescente',
  full: 'Lua cheia',
  waningGibbous: 'Gibosa minguante',
  lastQuarter: 'Quarto minguante',
  waningCrescent: 'Lua minguante',
};

export const PHASE_HINT: Record<PhaseKey, string> = {
  new: 'Céu escuro, ideal para ver estrelas e a Via Láctea.',
  waxingCrescent: 'Um fino arco aparece no oeste logo após o pôr do sol.',
  firstQuarter: 'Metade iluminada. Crateras ficam nítidas no terminador.',
  waxingGibbous: 'Quase cheia. Brilha a maior parte da noite.',
  full: 'Disco inteiro iluminado, nasce junto com o pôr do sol.',
  waningGibbous: 'Começa a minguar e nasce cada vez mais tarde.',
  lastQuarter: 'Metade iluminada, visível de madrugada e pela manhã.',
  waningCrescent: 'Arco fino no leste, pouco antes do nascer do sol.',
};

const QUARTER_KEYS: PhaseKey[] = ['new', 'firstQuarter', 'full', 'lastQuarter'];

/** Phase angle: 0 new, 90 first quarter, 180 full, 270 last quarter. */
export function phaseKey(angle: number): PhaseKey {
  const a = ((angle % 360) + 360) % 360;
  if (a < 7 || a >= 353) return 'new';
  if (a < 83) return 'waxingCrescent';
  if (a < 97) return 'firstQuarter';
  if (a < 173) return 'waxingGibbous';
  if (a < 187) return 'full';
  if (a < 263) return 'waningGibbous';
  if (a < 277) return 'lastQuarter';
  return 'waningCrescent';
}

export type MoonState = {
  angle: number;
  illumination: number; // 0..1
  ageDays: number;
  waxing: boolean;
  key: PhaseKey;
  distanceKm: number;
};

export function moonState(date: Date): MoonState {
  const angle = A.MoonPhase(date);
  const illum = A.Illumination(A.Body.Moon, date).phase_fraction;
  const v = A.GeoMoon(date);
  const distanceKm = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * A.KM_PER_AU;
  return {
    angle,
    illumination: illum,
    ageDays: (angle / 360) * SYNODIC_DAYS,
    waxing: angle < 180,
    key: phaseKey(angle),
    distanceKm,
  };
}

export type MoonDay = { moonrise: Date | null; moonset: Date | null };

export function computeMoonDay(place: Place, dayStart: Date): MoonDay {
  const obs = observer(place);
  const end = addDays(dayStart, 1, place.tz).getTime();
  const pick = (t: A.AstroTime | null) => (t && t.date.getTime() < end ? t.date : null);
  return {
    moonrise: pick(A.SearchRiseSet(A.Body.Moon, obs, +1, dayStart, 1)),
    moonset: pick(A.SearchRiseSet(A.Body.Moon, obs, -1, dayStart, 1)),
  };
}

export type QuarterEvent = { key: PhaseKey; date: Date; distanceKm: number };

export function nextQuarters(from: Date, count = 8): QuarterEvent[] {
  const out: QuarterEvent[] = [];
  let mq = A.SearchMoonQuarter(from);
  for (let i = 0; i < count; i++) {
    out.push({ key: QUARTER_KEYS[mq.quarter], date: mq.time.date, distanceKm: moonState(mq.time.date).distanceKm });
    mq = A.NextMoonQuarter(mq);
  }
  return out;
}

const FULL_MOON_NAMES = [
  'Lua do Lobo', 'Lua da Neve', 'Lua da Minhoca', 'Lua Rosa', 'Lua das Flores', 'Lua do Morango',
  'Lua do Cervo', 'Lua do Esturjão', 'Lua do Milho', 'Lua do Caçador', 'Lua do Castor', 'Lua Fria',
];

export function fullMoonName(date: Date, month: number, isBlueMoon: boolean): string {
  if (isBlueMoon) return 'Lua Azul';
  // The full moon closest to the September equinox is the Harvest Moon.
  const y = date.getUTCFullYear();
  const equinox = A.Seasons(y).sep_equinox.date.getTime();
  if (Math.abs(date.getTime() - equinox) < 15 * 86_400_000) return 'Lua da Colheita';
  return FULL_MOON_NAMES[month];
}

export const SUPERMOON_KM = 361_000;
export const MICROMOON_KM = 403_000;

/** Bright-limb side as seen from the observer's hemisphere (simplified). */
export function litOnRight(waxing: boolean, latitude: number): boolean {
  return latitude >= 0 ? waxing : !waxing;
}
