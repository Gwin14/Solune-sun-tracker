import type { IconName } from '@/components/Icon';

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

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  progress: (c: BadgeContext) => number; // 0..1
};

const count = (c: BadgeContext, kind?: CheckInKind) => c.checkIns.filter((x) => !kind || x.kind === kind).length;
const ratio = (n: number, goal: number) => Math.min(1, n / goal);

export const BADGES: Badge[] = [
  { id: 'dawn', title: 'Primeira luz', description: 'Começou a seguir o céu.', icon: 'sunrise', progress: (c) => (c.onboarded ? 1 : 0) },
  { id: 'first-check', title: 'Testemunha', description: 'Registrou seu primeiro momento no céu.', icon: 'eye', progress: (c) => ratio(count(c), 1) },
  { id: 'early-bird', title: 'Madrugador', description: 'Viu 3 nasceres do sol.', icon: 'sunrise', progress: (c) => ratio(count(c, 'sunrise'), 3) },
  { id: 'golden-hunter', title: 'Caçador dourado', description: 'Viu 5 pores do sol.', icon: 'sunset', progress: (c) => ratio(count(c, 'sunset'), 5) },
  { id: 'night-owl', title: 'Coruja', description: 'Observou a lua 5 vezes.', icon: 'moon', progress: (c) => ratio(count(c, 'moon'), 5) },
  {
    id: 'full-moon',
    title: 'Lua plena',
    description: 'Observou uma lua cheia.',
    icon: 'moonFull',
    progress: (c) => (c.checkIns.some((x) => x.kind === 'moon' && (x.moonIllum ?? 0) > 0.94) ? 1 : 0),
  },
  { id: 'streak-3', title: 'Ritmo solar', description: 'Sequência de 3 dias.', icon: 'flame', progress: (c) => ratio(c.bestStreak, 3) },
  { id: 'streak-7', title: 'Semana de luz', description: 'Sequência de 7 dias.', icon: 'flame', progress: (c) => ratio(c.bestStreak, 7) },
  { id: 'streak-30', title: 'Órbita completa', description: 'Sequência de 30 dias.', icon: 'orbit', progress: (c) => ratio(c.bestStreak, 30) },
  { id: 'ar-explorer', title: 'Olhar para cima', description: 'Usou o céu em realidade aumentada.', icon: 'viewfinder', progress: (c) => ratio(c.arSessions, 1) },
  { id: 'traveler', title: 'Viajante', description: 'Salvou 3 lugares.', icon: 'globe', progress: (c) => ratio(c.placesCount, 3) },
];

export const XP = { checkIn: 20, badge: 50, ar: 10 } as const;

const LEVELS = ['Observador', 'Caçador de luz', 'Guardião do crepúsculo', 'Navegante celeste', 'Astrônomo', 'Mestre do céu'];
export const XP_PER_LEVEL = 120;

export function levelFor(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL);
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
