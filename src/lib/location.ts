import * as Location from 'expo-location';

import { deviceTimeZone } from '@/astro/time';
import { useApp, type SavedPlace } from '@/store/app';

import { nearestTimeZone } from './cities';

export type LocateResult = 'ok' | 'denied' | 'error';

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/** Resolves the device position into the store's "current" place. */
export async function refreshCurrentLocation(ask = false): Promise<LocateResult> {
  try {
    const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return 'denied';
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const { latitude, longitude } = pos.coords;
    let name = 'Sua localização';
    let region: string | undefined;
    let tz: string | undefined;
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addr) {
        name = addr.city ?? addr.subregion ?? addr.district ?? addr.name ?? name;
        region = [addr.region, addr.country].filter(Boolean).join(', ') || undefined;
        tz = addr.timezone ?? undefined;
      }
    } catch {
      // Reverse geocoding is best-effort; coordinates are what matter.
    }
    const place: SavedPlace = {
      id: 'current',
      name,
      region,
      latitude,
      longitude,
      tz: tz ?? deviceTimeZone() ?? nearestTimeZone(latitude, longitude),
    };
    useApp.getState().setCurrent(place);
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function geocodePlaces(query: string): Promise<SavedPlace[]> {
  if (process.env.EXPO_OS === 'web' || query.trim().length < 3) return [];
  try {
    const hits = await Location.geocodeAsync(query);
    const out: SavedPlace[] = [];
    for (const h of hits.slice(0, 3)) {
      let name = query.trim();
      let region: string | undefined;
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: h.latitude, longitude: h.longitude });
        if (addr) {
          name = addr.city ?? addr.name ?? name;
          region = [addr.region, addr.country].filter(Boolean).join(', ') || undefined;
        }
      } catch {
        // keep the query as a name
      }
      out.push({
        id: `geo-${h.latitude.toFixed(3)},${h.longitude.toFixed(3)}`,
        name,
        region,
        latitude: h.latitude,
        longitude: h.longitude,
        tz: nearestTimeZone(h.latitude, h.longitude),
      });
    }
    // The platform geocoder answers nonsense queries with a nearby city; keep only plausible matches.
    const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const head = norm(query.trim()).slice(0, 3);
    return out.filter((p) => norm(`${p.name} ${p.region ?? ''}`).includes(head));
  } catch {
    return [];
  }
}
