import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { BADGES, bestStreak, computeStreak, XP, type BadgeContext, type CheckIn, type CheckInKind } from '@/lib/achievements';
import { dayKey, shiftKey } from '@/astro/time';
import { strings } from '@/i18n';

export type SavedPlace = {
  id: string;
  name: string;
  region?: string;
  latitude: number;
  longitude: number;
  tz?: string;
};

export type Interest = 'photo' | 'wellbeing' | 'astro' | 'nature' | 'ritual';

export type NotificationPrefs = {
  sunrise: boolean;
  sunset: boolean;
  golden: boolean;
  fullMoon: boolean;
  newMoon: boolean;
  leadMinutes: 0 | 15 | 30;
};

/** Planetarium layers and display options, remembered between visits. */
export type PlanetariumPrefs = {
  lines: boolean;
  labels: boolean;
  milkyWay: boolean;
  planets: boolean;
  deepSky: boolean;
  ecliptic: boolean;
  trails: boolean;
  /** Opaque ground: hides what is below the horizon. */
  ground: boolean;
  /** Daylight washes out the stars, like the real sky. */
  atmosphere: boolean;
  /** Keep the live camera image behind the stars while pointing the phone. */
  cameraFeed: boolean;
  /** Red-only display that keeps your eyes adapted to the dark. */
  nightVision: boolean;
};

export const DEFAULT_PLANETARIUM: PlanetariumPrefs = {
  lines: true,
  labels: true,
  milkyWay: true,
  planets: true,
  deepSky: true,
  ecliptic: false,
  trails: false,
  ground: true,
  atmosphere: false,
  cameraFeed: false,
  nightVision: false,
};

type State = {
  hydrated: boolean;
  hasOnboarded: boolean;
  interests: Interest[];
  use24h: boolean;
  haptics: boolean;
  notificationsEnabled: boolean;
  notifications: NotificationPrefs;
  current: SavedPlace | null;
  places: SavedPlace[];
  selectedId: string;
  checkIns: CheckIn[];
  badges: Record<string, number>;
  xp: number;
  arSessions: number;
  lastArDay: string | null;
  celebrationQueue: string[];
  planetarium: PlanetariumPrefs;
  /** Planetarium targets the user starred, newest first. */
  favorites: string[];
};

type Actions = {
  setHydrated: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setInterests: (i: Interest[]) => void;
  setUse24h: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setNotification: <K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) => void;
  setCurrent: (p: SavedPlace) => void;
  addPlace: (p: SavedPlace) => void;
  removePlace: (id: string) => void;
  selectPlace: (id: string) => void;
  checkIn: (kind: CheckInKind, tz: string | undefined, moonIllum?: number) => boolean;
  logArSession: () => void;
  shiftCelebration: () => void;
  setPlanetarium: (p: Partial<PlanetariumPrefs>) => void;
  toggleFavorite: (id: string) => void;
  evaluateBadges: () => void;
};

/** Shown until the user shares a location or picks a city. The region follows the language. */
export const DEFAULT_PLACE: SavedPlace = {
  id: 'default',
  name: 'São Paulo',
  get region() {
    return `SP, ${strings().places.Brasil ?? 'Brasil'}`;
  },
  latitude: -23.5505,
  longitude: -46.6333,
  tz: 'America/Sao_Paulo',
};

export function badgeContext(s: Pick<State, 'checkIns' | 'arSessions' | 'places' | 'hasOnboarded'>): BadgeContext {
  const keys = s.checkIns.map((c) => c.key);
  const today = dayKey(new Date());
  return {
    checkIns: s.checkIns,
    streak: computeStreak(keys, today, shiftKey).streak,
    bestStreak: bestStreak(keys, shiftKey),
    arSessions: s.arSessions,
    placesCount: s.places.length,
    onboarded: s.hasOnboarded,
  };
}

export const useApp = create<State & Actions>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hasOnboarded: false,
      interests: [],
      use24h: true,
      haptics: true,
      notificationsEnabled: false,
      notifications: { sunrise: false, sunset: true, golden: false, fullMoon: true, newMoon: false, leadMinutes: 15 },
      current: null,
      places: [],
      selectedId: 'current',
      checkIns: [],
      badges: {},
      xp: 0,
      arSessions: 0,
      lastArDay: null,
      celebrationQueue: [],
      planetarium: DEFAULT_PLANETARIUM,
      favorites: [],

      setHydrated: () => set({ hydrated: true }),
      completeOnboarding: () => {
        set({ hasOnboarded: true });
        get().evaluateBadges();
      },
      resetOnboarding: () => set({ hasOnboarded: false }),
      setInterests: (interests) => set({ interests }),
      setUse24h: (use24h) => set({ use24h }),
      setHaptics: (haptics) => set({ haptics }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotification: (k, v) => set((s) => ({ notifications: { ...s.notifications, [k]: v } })),
      setCurrent: (current) => set({ current }),
      addPlace: (p) => {
        set((s) => ({
          places: s.places.some((x) => x.id === p.id) ? s.places : [...s.places, p],
          selectedId: p.id,
        }));
        get().evaluateBadges();
      },
      removePlace: (id) =>
        set((s) => ({
          places: s.places.filter((p) => p.id !== id),
          selectedId: s.selectedId === id ? 'current' : s.selectedId,
        })),
      selectPlace: (selectedId) => set({ selectedId }),
      checkIn: (kind, tz, moonIllum) => {
        const key = dayKey(new Date(), tz);
        if (get().checkIns.some((c) => c.key === key && c.kind === kind)) return false;
        set((s) => ({ checkIns: [...s.checkIns, { key, kind, at: Date.now(), moonIllum }], xp: s.xp + XP.checkIn }));
        get().evaluateBadges();
        return true;
      },
      logArSession: () => {
        // The sky tab is visited often; it counts (and earns XP) once a day.
        const today = dayKey(new Date());
        if (get().lastArDay === today) return;
        set((s) => ({ arSessions: s.arSessions + 1, xp: s.xp + XP.ar, lastArDay: today }));
        get().evaluateBadges();
      },
      shiftCelebration: () => set((s) => ({ celebrationQueue: s.celebrationQueue.slice(1) })),
      setPlanetarium: (p) => set((s) => ({ planetarium: { ...DEFAULT_PLANETARIUM, ...s.planetarium, ...p } })),
      toggleFavorite: (id) => set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [id, ...s.favorites] })),
      evaluateBadges: () => {
        const s = get();
        const ctx = badgeContext(s);
        const fresh = BADGES.filter((b) => !s.badges[b.id] && b.progress(ctx) >= 1).map((b) => b.id);
        if (!fresh.length) return;
        const now = Date.now();
        set({
          badges: { ...s.badges, ...Object.fromEntries(fresh.map((id) => [id, now])) },
          xp: s.xp + fresh.length * XP.badge,
          celebrationQueue: [...s.celebrationQueue, ...fresh],
        });
      },
    }),
    {
      name: 'solune-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export function selectPlace(s: State): SavedPlace {
  if (s.selectedId !== 'current') {
    const p = s.places.find((x) => x.id === s.selectedId);
    if (p) return p;
  }
  return s.current ?? DEFAULT_PLACE;
}
