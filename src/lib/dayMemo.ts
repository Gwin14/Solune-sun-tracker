import type { Place } from '@/astro/sun';

/**
 * Memoizes a computation per place and local day. Rise/set searches and event scans only
 * change once a day, but are asked for by several screens and every widget sync.
 */
export function dayMemo<T, P extends Place = Place>(size: number, compute: (place: P, start: Date) => T) {
  const cache = new Map<string, T>();
  return (place: P, start: Date): T => {
    // Text-bearing results also vary by language, which such callers pass as `lang`.
    const key = `${place.latitude},${place.longitude},${start.getTime()},${(place as { lang?: string }).lang ?? ''}`;
    let v = cache.get(key);
    if (v === undefined) {
      v = compute(place, start);
      cache.set(key, v);
      if (cache.size > size) cache.delete(cache.keys().next().value as string);
    }
    return v;
  };
}
