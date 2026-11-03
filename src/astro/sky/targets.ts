import * as A from 'astronomy-engine';

import { formatDecimal, formatNumber } from '@/astro/format';
import type { Place } from '@/astro/sun';
import { localeTag, strings } from '@/i18n';

import { catalog, designation, eqVector, starColor } from './catalog';
import { constellationAt, observerOf, PLANETS, type HorizonFrame, type PlanetId } from './engine';
import { ASTERISMS, CONSTELLATION_NOTES, DSO_KIND_LABEL, DSOS, GALACTIC_CENTER, GALACTIC_CENTER_NOTE, PLANET_NOTES } from './names';

/**
 * Everything the planetarium can select, search for and guide the user to.
 * Ids are stable strings so a selection survives frame recomputes.
 */
export type TargetId =
  | `star:${number}`
  | `planet:${PlanetId}`
  | `dso:${string}`
  | `const:${string}`
  | `ast:${string}`
  | 'galactic'
  | 'pole'
  | 'moon'
  | 'sun';

export type TargetKind = 'star' | 'planet' | 'dso' | 'constellation' | 'asterism' | 'galactic' | 'pole' | 'moon' | 'sun';

export function kindOf(id: TargetId): TargetKind {
  if (id.startsWith('star:')) return 'star';
  if (id.startsWith('planet:')) return 'planet';
  if (id.startsWith('dso:')) return 'dso';
  if (id.startsWith('const:')) return 'constellation';
  if (id.startsWith('ast:')) return 'asterism';
  return id as TargetKind;
}

const mean = (vs: ArrayLike<number>[]) => {
  const out = new Float64Array(3);
  for (const v of vs) {
    out[0] += v[0];
    out[1] += v[1];
    out[2] += v[2];
  }
  const l = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
};

/** Constellation "centre" for pointing: the mean of its stick-figure vertices. */
function constellationCentre(frame: HorizonFrame, id: string) {
  const cat = catalog();
  const i = cat.constellations.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const verts: Float64Array[] = [];
  for (const pl of frame.lines[i]) for (let k = 0; k < pl.length; k += 3) verts.push(pl.subarray(k, k + 3));
  return verts.length ? mean(verts) : frame.labels.subarray(i * 3, i * 3 + 3);
}

/**
 * ENU direction of a target in this frame. Sun and Moon are passed in since the screen
 * already computes them (with refraction) for the rest of the AR view.
 */
export function targetEnu(frame: HorizonFrame, id: TargetId, bodies: { sun: ArrayLike<number>; moon: ArrayLike<number> }): ArrayLike<number> | null {
  const cat = catalog();
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      return frame.stars.subarray(i * 3, i * 3 + 3);
    }
    case 'planet':
      return frame.planets.find((p) => `planet:${p.id}` === id)?.enu ?? null;
    case 'dso':
      return frame.dsos.find((d) => `dso:${d.dso.id}` === id)?.enu ?? null;
    case 'constellation':
      return constellationCentre(frame, id.slice(6));
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
      if (!a) return null;
      const vs = a.members.map((h) => cat.byHip.get(h)).filter((i): i is number => i != null).map((i) => frame.stars.subarray(i * 3, i * 3 + 3));
      return vs.length ? mean(vs) : null;
    }
    case 'galactic':
      return frame.galacticCenter;
    case 'pole':
      return frame.latitude < 0 ? frame.south : frame.north;
    case 'moon':
      return bodies.moon;
    case 'sun':
      return bodies.sun;
  }
}

/** J2000 direction of a target at any time, for rise/set and best-time planning. */
export function targetEqjAt(id: TargetId, place: Place): ((t: Date) => ArrayLike<number>) | null {
  const cat = catalog();
  const obs = observerOf(place);
  const body = (b: A.Body) => (t: Date) => {
    const v = A.Equator(b, t, obs, false, true).vec;
    const l = v.Length();
    return [v.x / l, v.y / l, v.z / l];
  };
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      const v = cat.vectors.subarray(i * 3, i * 3 + 3);
      return () => v;
    }
    case 'planet': {
      const p = PLANETS.find((x) => `planet:${x.id}` === id);
      return p ? body(p.body) : null;
    }
    case 'dso':
    case 'galactic': {
      const d = id === 'galactic' ? GALACTIC_CENTER : DSOS.find((x) => `dso:${x.id}` === id);
      if (!d) return null;
      const v = new Float64Array(3);
      eqVector(d.ra, d.dec, v, 0);
      return () => v;
    }
    case 'constellation': {
      const c = cat.constellationById.get(id.slice(6));
      if (!c) return null;
      const verts: number[][] = [];
      for (const pl of c.lines) for (let k = 0; k < pl.length; k += 3) verts.push([pl[k], pl[k + 1], pl[k + 2]]);
      const v = verts.length ? mean(verts) : c.label;
      return () => v;
    }
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
      if (!a) return null;
      const v = mean(a.members.map((h) => cat.byHip.get(h)).filter((i): i is number => i != null).map((i) => cat.vectors.subarray(i * 3, i * 3 + 3)));
      return () => v;
    }
    case 'moon':
      return body(A.Body.Moon);
    case 'sun':
      return body(A.Body.Sun);
    case 'pole':
      return null;
  }
}

export type TargetInfo = {
  title: string;
  subtitle: string;
  color: string;
  mag?: number;
  note?: string;
  /** A sentence about distance or light travel time. */
  distance?: string;
  flag?: string;
};

function lightTravel(ly: number, now: Date): string {
  const tx = strings().target;
  if (ly < 100) return tx.lightNear(ly.toString().replace('.', strings().number.decimal));
  if (ly < 3000) return tx.lightHistoric(formatNumber(ly), now.getFullYear() - Math.round(ly));
  return tx.lightFar(formatNumber(ly));
}

const constellationName = (sym: string) => catalog().constellationById.get(sym)?.name ?? sym;

export function describeTarget(frame: HorizonFrame, id: TargetId, extra: { moonIllum?: number; moonDistKm?: number } = {}): TargetInfo {
  const cat = catalog();
  const tx = strings().target;
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      const named = cat.namedByIndex.get(i);
      const hip = cat.hip[i];
      const v = frame.stars.subarray(i * 3, i * 3 + 3);
      const con = constellationName(constellationAt(frame, v[0], v[1], v[2]));
      const desig = designation(hip);
      return {
        title: named?.name ?? desig ?? `HIP ${hip}`,
        subtitle: [tx.star, con, named && desig ? desig : null].filter(Boolean).join(' · '),
        color: starColor(cat.bv[i]),
        mag: cat.mag[i],
        note: named?.note,
        distance: named?.ly ? lightTravel(named.ly, frame.time) : undefined,
        flag: named?.flag,
      };
    }
    case 'planet': {
      const p = frame.planets.find((x) => `planet:${x.id}` === id)!;
      const km = p.dist * 149_597_870.7;
      const minutes = (p.dist * 499) / 60;
      return {
        title: p.name,
        subtitle: tx.planetIn(constellationName(p.constellation)),
        color: p.color,
        mag: p.mag,
        note: PLANET_NOTES[p.id],
        distance: tx.planetDistance(formatNumber(km / 1e6), minutes < 60 ? `${Math.round(minutes)} min` : `${formatDecimal(minutes / 60)} h`),
      };
    }
    case 'dso': {
      const d = DSOS.find((x) => `dso:${x.id}` === id)!;
      const e = frame.dsos.find((x) => x.dso.id === d.id)!.enu;
      return {
        title: d.name,
        subtitle: `${DSO_KIND_LABEL[d.kind]} · ${constellationName(constellationAt(frame, e[0], e[1], e[2]))}`,
        color: d.kind === 'dark' ? '#9AA3C7' : '#CDBBFF',
        mag: d.mag < 50 ? d.mag : undefined,
        note: d.note,
        distance: lightTravel(d.ly, frame.time),
      };
    }
    case 'constellation': {
      const c = cat.constellationById.get(id.slice(6))!;
      return { title: c.name, subtitle: `${tx.constellation} · ${c.latin}`, color: '#B9C6FF', note: CONSTELLATION_NOTES[c.id] };
    }
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id)!;
      return { title: a.name, subtitle: tx.asterism, color: '#B9C6FF', note: a.note };
    }
    case 'galactic':
      return { title: tx.galacticTitle, subtitle: `${tx.galacticHint} · ${constellationName('Sgr')}`, color: '#F2BE6E', note: GALACTIC_CENTER_NOTE.text };
    case 'pole': {
      const south = frame.latitude < 0;
      const alt = Math.abs(frame.latitude);
      return {
        title: south ? strings().sky.southPole : strings().sky.northPole,
        subtitle: tx.poleSubtitle,
        color: '#F2BE6E',
        note: tx.poleNote(alt.toFixed(0), south),
      };
    }
    case 'moon':
      return {
        title: strings().sky.moon,
        subtitle: extra.moonIllum != null ? tx.moonLit(Math.round(extra.moonIllum * 100)) : tx.naturalSatellite,
        color: '#CBD2F2',
        distance: extra.moonDistKm ? tx.moonDistance(formatNumber(extra.moonDistKm), formatDecimal(extra.moonDistKm / 299_792)) : undefined,
      };
    case 'sun':
      return { title: strings().sky.sun, subtitle: tx.ourStar, color: '#F2BE6E', note: tx.sunWarning, distance: tx.sunDistance };
  }
}

export type SearchEntry = { id: TargetId; name: string; hint: string; group: 'highlights' | 'planets' | 'stars' | 'deepSky' | 'constellations' };

/** The searchable index, built once. Planets come first; the screen adds live visibility. */
export function searchIndex(southern: boolean): SearchEntry[] {
  const cat = catalog();
  const tx = strings().target;
  const sky = strings().sky;
  const out: SearchEntry[] = [
    { id: 'galactic', name: tx.galacticTitle, hint: tx.galacticHint, group: 'highlights' },
    { id: 'pole', name: southern ? sky.southPole : sky.northPole, hint: tx.poleHint, group: 'highlights' },
    { id: 'const:Cru', name: constellationName('Cru'), hint: tx.constellation, group: 'highlights' },
    ...ASTERISMS.map((a) => ({ id: `ast:${a.id}` as TargetId, name: a.name, hint: tx.asterism, group: 'highlights' as const })),
    { id: 'moon', name: sky.moon, hint: tx.satellite, group: 'highlights' },
    { id: 'sun', name: sky.sun, hint: tx.ourStar, group: 'highlights' },
    ...PLANETS.map((p) => ({ id: `planet:${p.id}` as TargetId, name: p.name, hint: tx.planet, group: 'planets' as const })),
    ...DSOS.map((d) => ({ id: `dso:${d.id}` as TargetId, name: d.name, hint: DSO_KIND_LABEL[d.kind], group: 'deepSky' as const })),
    ...cat.named.filter((s) => s.ly != null || cat.mag[s.index] < 2).map((s) => ({ id: `star:${s.index}` as TargetId, name: s.name, hint: tx.star, group: 'stars' as const })),
    ...[...cat.constellations].sort((a, b) => a.name.localeCompare(b.name, localeTag())).map((c) => ({ id: `const:${c.id}` as TargetId, name: c.name, hint: c.latin, group: 'constellations' as const })),
  ];
  return out;
}

