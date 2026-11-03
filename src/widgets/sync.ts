import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { strings } from '@/i18n';
import { isPro, requirePro } from '@/lib/purchases';
import { selectPlace, useApp } from '@/store/app';
import { supportsWidgets } from '@/platform/native';

import { eventProps, goldenProps, lockProps, moonProps, skyMomentProps, streakProps, sunProps, timelineMoments } from './data';
import { favoritesProps, tonightPlanets, tonightProps, trackTargets } from './skyData';
import type { SkyMomentProps } from './types';

type Registry = typeof import('./registry');

let registry: Registry | null | undefined;
/** The native handles, or null where widgets don't exist (Expo Go, web, Android). */
function native(): Registry | null {
  if (registry === undefined) {
    registry = null;
    if (supportsWidgets()) {
      try {
        // Lazy on purpose: importing expo-widgets throws where its native module is missing.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        registry = require('./registry') as Registry;
      } catch {
        registry = null;
      }
    }
  }
  return registry;
}

export const widgetsAvailable = () => native() != null;

function context() {
  const s = useApp.getState();
  return { place: selectPlace(s), use24h: s.use24h };
}

const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let generation = 0;
let lastSync = 0;

/**
 * Pushes fresh content to every widget: a day of timeline entries for the ones that change
 * with the sun, a snapshot for the rest. WidgetKit then advances them with the app closed.
 * Each widget is its own slice of work so the JS thread can answer touches between them;
 * a newer sync cancels one still in progress.
 */
export async function syncWidgets() {
  const r = native();
  if (!r) return;
  const run = ++generation;
  const ctx = context();
  const now = new Date();
  try {
    if (!isPro()) {
      // Widgets are Solune Pro: everyone else gets a single prompt that opens the paywall.
      const locked = { locked: strings().pro.widgetLocked } as never;
      for (const w of Object.values(r.widgets)) w.updateSnapshot(locked);
      lastSync = Date.now();
      return;
    }
    const moments = timelineMoments(ctx.place, now);
    // The moon and the event list only move once a day; hourly is plenty.
    const hourly = moments.filter((d, i) => i === 0 || d.getMinutes() === 0);
    const steps = [
      () => r.widgets.sun.updateTimeline(moments.map((date) => ({ date, props: sunProps(ctx, date) }))),
      () => r.widgets.golden.updateTimeline(moments.map((date) => ({ date, props: goldenProps(ctx, date) }))),
      () => r.widgets.lock.updateTimeline(moments.map((date) => ({ date, props: lockProps(ctx, date) }))),
      () => r.widgets.moon.updateTimeline(hourly.map((date) => ({ date, props: moonProps(ctx, date) }))),
      () => r.widgets.event.updateTimeline(hourly.map((date) => ({ date, props: eventProps(ctx, date) }))),
      () => {
        const planets = tonightPlanets(ctx, now);
        r.widgets.tonight.updateTimeline(hourly.map((date) => ({ date, props: tonightProps(ctx, date, planets) })));
      },
      () => {
        const favorites = trackTargets(ctx, useApp.getState().favorites, now);
        r.widgets.favorites.updateTimeline(hourly.map((date) => ({ date, props: favoritesProps(ctx, date, favorites) })));
      },
      () => {
        const s = useApp.getState();
        r.widgets.streak.updateSnapshot(streakProps(s.checkIns.map((c) => c.key), s.xp, ctx.place.tz, now));
      },
    ];
    for (const step of steps) {
      await yieldToUI();
      if (run !== generation) return;
      step();
    }
    lastSync = Date.now();
  } catch (e) {
    if (__DEV__) console.warn('[widgets] sync failed', e);
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function scheduleWidgetSync(delay = 600) {
  if (!native()) return;
  clearTimeout(timer);
  timer = setTimeout(syncWidgets, delay);
}

/** Coming back to the app: the timelines already cover the next day, so refresh at most every 15 min. */
export function refreshWidgetsIfStale() {
  if (Date.now() - lastSync > 15 * 60_000) scheduleWidgetSync(1500);
}

export type SkyMomentKind = SkyMomentProps['kind'];

/** The sky moment being followed, kept across launches so the app can show and end it. */
type TrackedMoment = { kind: SkyMomentKind | null; endAt: number };
export const useSkyMoment = create<TrackedMoment>()(
  persist((): TrackedMoment => ({ kind: null, endAt: 0 }), { name: 'solune-sky-moment', storage: createJSONStorage(() => AsyncStorage) }),
);

/** Whether a sky moment can be followed on the Lock Screen and Dynamic Island. */
export const liveActivitiesAvailable = widgetsAvailable;

/**
 * Starts a Live Activity for the next golden hour, sunset or sunrise, replacing any other.
 * It goes stale when the moment ends and is cleared on the next launch after that.
 * Live Activities are Solune Pro: every entry point (button, quick action, Siri) lands here,
 * and everyone else sees the paywall instead.
 */
export async function startSkyMoment(kind: SkyMomentKind): Promise<boolean> {
  const r = native();
  if (!r) return false;
  if (!requirePro()) return false;
  const props = skyMomentProps(context(), kind, new Date());
  if (!props) return false;
  await endSkyMoments();
  try {
    r.skyMoment.start(props, 'solune://', new Date(props.endAt));
    useSkyMoment.setState({ kind, endAt: props.endAt });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[live activity] start failed', e);
    return false;
  }
}

export async function endSkyMoments() {
  const r = native();
  useSkyMoment.setState({ kind: null, endAt: 0 });
  if (!r) return;
  await Promise.all(r.skyMoment.getInstances().map((a) => a.end('immediate').catch(() => {})));
}

/** Drops a finished moment and forgets one the user dismissed from the Lock Screen. */
export function reconcileSkyMoments() {
  const r = native();
  if (!r) return;
  const live = r.skyMoment.getInstances();
  const { kind, endAt } = useSkyMoment.getState();
  if (!live.length) {
    if (kind) useSkyMoment.setState({ kind: null, endAt: 0 });
  } else if (!kind || Date.now() > endAt + 5 * 60_000) {
    endSkyMoments();
  }
}
