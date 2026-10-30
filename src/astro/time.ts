/**
 * Time-zone aware helpers. Astronomy runs in UTC; everything the user reads is
 * in the selected place's wall clock, which may differ from the device's.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

export const DAY_MS = 86_400_000;
export const MIN_MS = 60_000;

export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Minutes east of UTC for `tz` at `date`. Falls back to the device offset. */
export function tzOffsetMinutes(tz: string | undefined, date: Date): number {
  if (!tz) return -date.getTimezoneOffset();
  try {
    let f = formatters.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      formatters.set(tz, f);
    }
    const parts = f.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    const out = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MIN_MS);
    return Number.isFinite(out) ? out : -date.getTimezoneOffset();
  } catch {
    return -date.getTimezoneOffset();
  }
}

export type WallClock = {
  year: number;
  month: number; // 0-based
  day: number;
  weekday: number; // 0 = Sunday
  hour: number;
  minute: number;
  /** minutes since local midnight */
  minuteOfDay: number;
};

export function wallClock(date: Date, tz?: string): WallClock {
  const shifted = new Date(date.getTime() + tzOffsetMinutes(tz, date) * MIN_MS);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour,
    minute,
    minuteOfDay: hour * 60 + minute + shifted.getUTCSeconds() / 60,
  };
}

/** UTC instant of local midnight for the wall-clock date `y-m-d` in `tz`. */
export function localMidnight(year: number, month: number, day: number, tz?: string): Date {
  const guess = Date.UTC(year, month, day);
  let t = guess - tzOffsetMinutes(tz, new Date(guess)) * MIN_MS;
  // Second pass settles DST transitions.
  t = guess - tzOffsetMinutes(tz, new Date(t)) * MIN_MS;
  return new Date(t);
}

export function startOfDay(date: Date, tz?: string): Date {
  const w = wallClock(date, tz);
  return localMidnight(w.year, w.month, w.day, tz);
}

export function addDays(dayStart: Date, days: number, tz?: string): Date {
  return startOfDay(new Date(dayStart.getTime() + days * DAY_MS + 12 * 3_600_000), tz);
}

export function dayKey(date: Date, tz?: string): string {
  const w = wallClock(date, tz);
  return `${w.year}-${String(w.month + 1).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

export function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
