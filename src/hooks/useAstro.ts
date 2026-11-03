import * as A from 'astronomy-engine';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { upcomingEventsForDay } from '@/astro/events';
import { computeMoonDay, moonState, nextQuarters } from '@/astro/moon';
import { computePath, computeSunDay, computeYearDaylight, moonPosition, observer, sunPosition } from '@/astro/sun';
import { addDays, dayKey, startOfDay, wallClock } from '@/astro/time';
import { selectPlace, useApp, type SavedPlace } from '@/store/app';

/** Wall-clock "now" that refreshes every 30 s and on foreground. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}

export function usePlace(): SavedPlace {
  const selectedId = useApp((s) => s.selectedId);
  const places = useApp((s) => s.places);
  const current = useApp((s) => s.current);
  return useMemo(() => selectPlace({ selectedId, places, current } as never), [selectedId, places, current]);
}

/** Everything the Today screen needs for one local day, memoized per day + place. */
export function useSunToday(place: SavedPlace, now: Date) {
  const key = dayKey(now, place.tz);
  const placeKey = `${place.latitude},${place.longitude},${place.tz}`;
  return useMemo(() => {
    const dayStart = startOfDay(now, place.tz);
    const today = computeSunDay(place, dayStart);
    const yesterday = computeSunDay(place, addDays(dayStart, -1, place.tz));
    const tomorrow = computeSunDay(place, addDays(dayStart, 1, place.tz));
    const sunPath = computePath(A.Body.Sun, place, dayStart);
    const moonPath = computePath(A.Body.Moon, place, dayStart);
    const moonDay = computeMoonDay(place, dayStart);
    return { dayStart, today, yesterday, tomorrow, sunPath, moonPath, moonDay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, placeKey]);
}

export function useLivePositions(place: SavedPlace, now: Date) {
  return useMemo(() => {
    const obs = observer(place);
    return { sun: sunPosition(now, obs), moon: moonPosition(now, obs), moonState: moonState(now) };
  }, [place, now]);
}

export function useYearDaylight(place: SavedPlace, year: number) {
  return useMemo(() => computeYearDaylight(place, year), [place, year]);
}

export function useQuarters(now: Date) {
  const key = Math.floor(now.getTime() / 3_600_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => nextQuarters(new Date(now.getTime() - 16 * 86_400_000), 12), [key]);
}

export function useEvents(place: SavedPlace, now: Date) {
  const key = dayKey(now, place.tz);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => upcomingEventsForDay(place, startOfDay(now, place.tz)), [key, place]);
}

export function minuteOfDay(date: Date, tz?: string) {
  return wallClock(date, tz).minuteOfDay;
}
