import { MIN_MS, wallClock } from './time';

export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WEEKDAYS_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

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
  const minutes = Math.round(Math.abs(ms) / MIN_MS);
  if (minutes < 1) return ms >= 0 ? 'agora' : 'agora mesmo';
  if (minutes >= 1440) {
    const d = Math.round(minutes / 1440);
    const label = d === 1 ? '1 dia' : `${d} dias`;
    return ms >= 0 ? `em ${label}` : `há ${label}`;
  }
  const text = formatDuration(minutes);
  return ms >= 0 ? `em ${text}` : `há ${text}`;
}

export function formatDaysUntil(days: number): string {
  if (days <= 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days < 45) return `em ${days} dias`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.round(days / 365);
  return `em ${years} ${years === 1 ? 'ano' : 'anos'}`;
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
  const w = wallClock(date, tz);
  if (style === 'short') return `${w.day} ${MONTHS_SHORT[w.month]}`;
  if (style === 'compact') return `${WEEKDAYS_SHORT[w.weekday]}, ${w.day} ${MONTHS_SHORT[w.month]}`;
  if (style === 'weekday') return `${capitalize(WEEKDAYS[w.weekday])}, ${w.day} de ${MONTHS[w.month]}`;
  return `${w.day} de ${MONTHS[w.month]} de ${w.year}`;
}

export function formatDegrees(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace('.', ',')}°`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export function compassPoint(azimuth: number): string {
  return COMPASS[Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16];
}
