import * as A from 'astronomy-engine';

import { localized, strings } from '@/i18n';

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

export const PHASE_LABEL: Record<PhaseKey, string> = localized((s) => s.moon.phase);

export const PHASE_HINT: Record<PhaseKey, string> = localized((s) => s.moon.phaseHint);

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

export function fullMoonName(date: Date, month: number, isBlueMoon: boolean): string {
  const names = strings().moon.fullMoonNames;
  if (isBlueMoon) return names.blue;
  // The full moon closest to the September equinox is the Harvest Moon.
  const y = date.getUTCFullYear();
  const equinox = A.Seasons(y).sep_equinox.date.getTime();
  if (Math.abs(date.getTime() - equinox) < 15 * 86_400_000) return names.harvest;
  return names.months[month];
}

export const SUPERMOON_KM = 361_000;
export const MICROMOON_KM = 403_000;

/** Bright-limb side as seen from the observer's hemisphere (simplified). */
export function litOnRight(waxing: boolean, latitude: number): boolean {
  return latitude >= 0 ? waxing : !waxing;
}
