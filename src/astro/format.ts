import { localized, strings } from '@/i18n';

import { MIN_MS, wallClock } from './time';

export const MONTHS = localized((s) => s.calendar.months);
export const MONTHS_SHORT = localized((s) => s.calendar.monthsShort);
export const WEEKDAYS = localized((s) => s.calendar.weekdays);
export const WEEKDAYS_SHORT = localized((s) => s.calendar.weekdaysShort);
export const WEEKDAYS_LETTER = localized((s) => s.calendar.weekdaysLetter);

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(hour: number, minute: number, use24h: boolean): string {
  'worklet';
  const h = Math.floor(hour) % 24;
  const m = Math.floor(minute) % 60;
  if (use24h) return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m < 10 ? '0' : ''}${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Minute-of-day (can be fractional) to clock text. Worklet-safe. */
export function formatMinuteOfDay(mod: number, use24h: boolean): string {
  'worklet';
  const total = Math.floor(mod) % 1440;
  return formatClock(Math.floor(total / 60), total % 60, use24h);
}

export function formatTime(date: Date | null | undefined, tz: string | undefined, use24h: boolean): string {
  if (!date) return '—';
  const w = wallClock(date, tz);
  return formatClock(w.hour, w.minute, use24h);
}

export function formatDuration(minutes: number, opts: { compact?: boolean } = {}): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (opts.compact) return h > 0 ? `${h}h${pad(r)}` : `${r} min`;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

export function formatCountdown(ms: number): string {
  const rel = strings().relative;
  const minutes = Math.round(Math.abs(ms) / MIN_MS);
  if (minutes < 1) return ms >= 0 ? rel.now : rel.justNow;
  const text = minutes >= 1440 ? rel.days(Math.round(minutes / 1440)) : formatDuration(minutes);
  return ms >= 0 ? rel.in(text) : rel.ago(text);
}

export function formatDaysUntil(days: number): string {
  const rel = strings().relative;
  if (days <= 0) return rel.today;
  if (days === 1) return rel.tomorrow;
  if (days < 45) return rel.inDays(days);
  const months = Math.round(days / 30.4);
  if (months < 12) return rel.inMonths(months);
  return rel.inYears(Math.round(days / 365));
}

export function formatSignedMinutes(deltaMinutes: number): string {
  const sign = deltaMinutes >= 0 ? '+' : '−';
  const totalSeconds = Math.round(Math.abs(deltaMinutes) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${sign}${s} s`;
  return s === 0 ? `${sign}${m} min` : `${sign}${m} min ${s} s`;
}

export function formatDate(date: Date, tz: string | undefined, style: 'long' | 'short' | 'weekday' | 'compact' = 'long'): string {
  return strings().calendar.date[style](wallClock(date, tz));
}

/** Fixed decimals with the language's decimal separator. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', strings().number.decimal);
}

export function formatDegrees(value: number, digits = 0): string {
  return `${formatDecimal(value, digits)}°`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, strings().number.group);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function compassPoint(azimuth: number): string {
  return strings().compass.points[Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16];
}

/** The direction spelled out for a sentence: "a nordeste". */
export function directionName(azimuth: number): string {
  return strings().compass.directions[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}
