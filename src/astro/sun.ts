import * as A from 'astronomy-engine';

import { localized } from '@/i18n';

import { addDays, DAY_MS, MIN_MS } from './time';

export type Place = { latitude: number; longitude: number; tz?: string };

export type HorizonPoint = { alt: number; az: number };

export type Window = { start: Date | null; end: Date | null };

export type SunDay = {
  dayStart: Date;
  sunrise: Date | null;
  sunset: Date | null;
  noon: Date;
  noonAltitude: number;
  dayLengthMin: number;
  polar: 'day' | 'night' | null;
  civil: Window;
  nautical: Window;
  astronomical: Window;
  goldenMorning: Window;
  goldenEvening: Window;
  blueMorning: Window;
  blueEvening: Window;
  sunriseAzimuth: number | null;
  sunsetAzimuth: number | null;
};

/** Samples per day for path curves (every 6 minutes). */
export const PATH_STEP_MIN = 6;
export const PATH_SAMPLES = 1440 / PATH_STEP_MIN + 1;

export function observer(place: Place): A.Observer {
  return new A.Observer(place.latitude, place.longitude, 0);
}

export function bodyPosition(body: A.Body, date: Date, obs: A.Observer): HorizonPoint {
  const eq = A.Equator(body, date, obs, true, true);
  const hor = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
  return { alt: hor.altitude, az: hor.azimuth };
}

export const sunPosition = (date: Date, obs: A.Observer) => bodyPosition(A.Body.Sun, date, obs);
export const moonPosition = (date: Date, obs: A.Observer) => bodyPosition(A.Body.Moon, date, obs);

function within(t: A.AstroTime | null, start: Date, end: Date): Date | null {
  if (!t) return null;
  const d = t.date;
  return d.getTime() >= start.getTime() && d.getTime() < end.getTime() ? d : null;
}

function altCross(obs: A.Observer, dir: 1 | -1, start: Date, end: Date, alt: number): Date | null {
  try {
    return within(A.SearchAltitude(A.Body.Sun, obs, dir, start, 1, alt), start, end);
  } catch {
    return null;
  }
}

export function computeSunDay(place: Place, dayStart: Date): SunDay {
  const obs = observer(place);
  const dayEnd = addDays(dayStart, 1, place.tz);

  const sunrise = within(A.SearchRiseSet(A.Body.Sun, obs, +1, dayStart, 1), dayStart, dayEnd);
  const sunset = within(A.SearchRiseSet(A.Body.Sun, obs, -1, dayStart, 1), dayStart, dayEnd);
  const culm = A.SearchHourAngle(A.Body.Sun, obs, 0, dayStart, +1);
  const noon = culm.time.date;
  const noonAltitude = culm.hor.altitude;

  let polar: SunDay['polar'] = null;
  if (!sunrise && !sunset) polar = noonAltitude > 0 ? 'day' : 'night';

  let dayLengthMin = 0;
  if (sunrise && sunset && sunset > sunrise) dayLengthMin = (sunset.getTime() - sunrise.getTime()) / MIN_MS;
  else if (sunrise && sunset) dayLengthMin = (dayEnd.getTime() - sunrise.getTime() + sunset.getTime() - dayStart.getTime()) / MIN_MS;
  else if (sunrise) dayLengthMin = (dayEnd.getTime() - sunrise.getTime()) / MIN_MS;
  else if (sunset) dayLengthMin = (sunset.getTime() - dayStart.getTime()) / MIN_MS;
  else if (polar === 'day') dayLengthMin = 1440;

  const win = (dirA: 1 | -1, altA: number, dirB: 1 | -1, altB: number): Window => ({
    start: altCross(obs, dirA, dayStart, dayEnd, altA),
    end: altCross(obs, dirB, dayStart, dayEnd, altB),
  });

  return {
    dayStart,
    sunrise,
    sunset,
    noon,
    noonAltitude,
    dayLengthMin,
    polar,
    civil: win(+1, -6, -1, -6),
    nautical: win(+1, -12, -1, -12),
    astronomical: win(+1, -18, -1, -18),
    goldenMorning: win(+1, -4, +1, 6),
    goldenEvening: win(-1, 6, -1, -4),
    blueMorning: win(+1, -6, +1, -4),
    blueEvening: win(-1, -4, -1, -6),
    sunriseAzimuth: sunrise ? sunPosition(sunrise, obs).az : null,
    sunsetAzimuth: sunset ? sunPosition(sunset, obs).az : null,
  };
}

/** Altitude/azimuth curve over the local day, sampled every PATH_STEP_MIN. */
export function computePath(body: A.Body, place: Place, dayStart: Date): { alt: number[]; az: number[] } {
  const obs = observer(place);
  const alt: number[] = new Array(PATH_SAMPLES);
  const az: number[] = new Array(PATH_SAMPLES);
  for (let i = 0; i < PATH_SAMPLES; i++) {
    const p = bodyPosition(body, new Date(dayStart.getTime() + i * PATH_STEP_MIN * MIN_MS), obs);
    alt[i] = p.alt;
    az[i] = p.az;
  }
  return { alt, az };
}

/** Day length (minutes) sampled weekly across a year, for the daylight chart. */
export function computeYearDaylight(place: Place, year: number): { t: number; minutes: number }[] {
  const obs = observer(place);
  const out: { t: number; minutes: number }[] = [];
  const start = Date.UTC(year, 0, 1, 12) - (place.longitude / 15) * 3_600_000;
  for (let week = 0; week <= 52; week++) {
    const noonish = new Date(start + week * 7 * DAY_MS);
    const from = new Date(noonish.getTime() - DAY_MS / 2);
    const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, from, 1);
    const set = rise ? A.SearchRiseSet(A.Body.Sun, obs, -1, rise.date, 1) : null;
    let minutes: number;
    if (rise && set) minutes = (set.date.getTime() - rise.date.getTime()) / MIN_MS;
    else minutes = sunPosition(noonish, obs).alt > 0 ? 1440 : 0;
    out.push({ t: noonish.getTime(), minutes: Math.min(1440, minutes) });
  }
  return out;
}

/** Shadow length as a multiple of an object's height. */
export function shadowRatio(altitude: number): number | null {
  if (altitude <= 0.5) return null;
  return 1 / Math.tan((altitude * Math.PI) / 180);
}

export type LightPhase = 'day' | 'golden' | 'blue' | 'civil' | 'nautical' | 'astronomical' | 'night';

export function lightPhase(alt: number): LightPhase {
  'worklet';
  if (alt >= 6) return 'day';
  if (alt >= -4) return 'golden';
  if (alt >= -6) return 'blue';
  if (alt >= -12) return 'nautical';
  if (alt >= -18) return 'astronomical';
  return 'night';
}

export const LIGHT_PHASE_LABEL: Record<LightPhase, string> = localized((s) => s.sun.phase);
