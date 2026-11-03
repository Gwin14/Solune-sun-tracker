import type { IconName } from '@/components/Icon';
import { strings, type Strings } from '@/i18n';

export type CheckInKind = 'sunrise' | 'sunset' | 'moon';
export type CheckIn = { key: string; kind: CheckInKind; at: number; moonIllum?: number };

export type BadgeContext = {
  checkIns: CheckIn[];
  streak: number;
  bestStreak: number;
  arSessions: number;
  placesCount: number;
  onboarded: boolean;
};

export type BadgeId = keyof Strings['badges'];

export type Badge = {
  id: BadgeId;
  /** Read from the active language. */
  readonly title: string;
  readonly description: string;
  icon: IconName;
  progress: (c: BadgeContext) => number; // 0..1
};

function badge(id: BadgeId, icon: IconName, progress: Badge['progress']): Badge {
  return {
    id,
    icon,
    progress,
    get title() {
      return strings().badges[id].title;
    },
    get description() {
      return strings().badges[id].description;
    },
  };
}

const count = (c: BadgeContext, kind?: CheckInKind) => c.checkIns.filter((x) => !kind || x.kind === kind).length;
const ratio = (n: number, goal: number) => Math.min(1, n / goal);

export const BADGES: Badge[] = [
  badge('dawn', 'sunrise', (c) => (c.onboarded ? 1 : 0)),
  badge('first-check', 'eye', (c) => ratio(count(c), 1)),
  badge('early-bird', 'sunrise', (c) => ratio(count(c, 'sunrise'), 3)),
  badge('golden-hunter', 'sunset', (c) => ratio(count(c, 'sunset'), 5)),
  badge('night-owl', 'moon', (c) => ratio(count(c, 'moon'), 5)),
  badge('full-moon', 'moonFull', (c) => (c.checkIns.some((x) => x.kind === 'moon' && (x.moonIllum ?? 0) > 0.94) ? 1 : 0)),
  badge('streak-3', 'flame', (c) => ratio(c.bestStreak, 3)),
  badge('streak-7', 'flame', (c) => ratio(c.bestStreak, 7)),
  badge('streak-30', 'orbit', (c) => ratio(c.bestStreak, 30)),
  badge('ar-explorer', 'viewfinder', (c) => ratio(c.arSessions, 1)),
  badge('traveler', 'globe', (c) => ratio(c.placesCount, 3)),
];

export const XP = { checkIn: 20, badge: 50, ar: 10 } as const;

export const XP_PER_LEVEL = 120;

export function levelFor(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL);
  const LEVELS = strings().levels;
  return {
    level: level + 1,
    title: LEVELS[Math.min(level, LEVELS.length - 1)],
    progress: (xp % XP_PER_LEVEL) / XP_PER_LEVEL,
    toNext: XP_PER_LEVEL - (xp % XP_PER_LEVEL),
  };
}

/** Consecutive days with any check-in, ending today (or yesterday, still alive). */
export function computeStreak(keys: string[], todayKey: string, shift: (k: string, d: number) => string) {
  const set = new Set(keys);
  let start = todayKey;
  if (!set.has(todayKey)) start = shift(todayKey, -1);
  let n = 0;
  let k = start;
  while (set.has(k)) {
    n++;
    k = shift(k, -1);
  }
  return { streak: n, alive: set.has(todayKey) };
}

export function bestStreak(keys: string[], shift: (k: string, d: number) => string): number {
  const sorted = [...new Set(keys)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev && shift(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}
