import * as A from 'astronomy-engine';

import type { Place } from '@/astro/sun';

import { catalog, eqVector } from './catalog';
import { DSOS, GALACTIC_CENTER, type Dso } from './names';

/**
 * Turns the J2000 catalogue into the observer's horizon for one instant.
 *
 * Output vectors are flat [east, north, up] triples, the same frame the AR projector uses.
 * One astronomy-engine rotation (precession, nutation, Earth rotation and latitude) is
 * applied to every catalogue vector, so a whole sky costs a few thousand multiply-adds.
 */

const R2D = 180 / Math.PI;
const D2R = Math.PI / 180;

type Rot = number[][];

/** J2000 equatorial → ENU, writing into `out` at the same offsets. */
export function rotateInto(rot: Rot, src: ArrayLike<number>, out: Float64Array) {
  const [r0, r1, r2] = rot;
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i];
    const y = src[i + 1];
    const z = src[i + 2];
    // astronomy-engine HOR frame: x = north, y = west, z = zenith.
    const hn = r0[0] * x + r1[0] * y + r2[0] * z;
    const hw = r0[1] * x + r1[1] * y + r2[1] * z;
    const hz = r0[2] * x + r1[2] * y + r2[2] * z;
    out[i] = -hw;
    out[i + 1] = hn;
    out[i + 2] = hz;
  }
  return out;
}

export function altAz(e: number, n: number, u: number) {
  return { alt: Math.asin(Math.max(-1, Math.min(1, u))) * R2D, az: ((Math.atan2(e, n) * R2D) % 360 + 360) % 360 };
}

export function enuFromAltAz(alt: number, az: number): [number, number, number] {
  const a = az * D2R;
  const e = alt * D2R;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

export type PlanetId = 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune';

export const PLANETS: { id: PlanetId; body: A.Body; name: string; color: string }[] = [
  { id: 'Mercury', body: A.Body.Mercury, name: 'Mercúrio', color: '#D6CBBE' },
  { id: 'Venus', body: A.Body.Venus, name: 'Vênus', color: '#FFF2CF' },
  { id: 'Mars', body: A.Body.Mars, name: 'Marte', color: '#FF8B5E' },
  { id: 'Jupiter', body: A.Body.Jupiter, name: 'Júpiter', color: '#F5DDB8' },
  { id: 'Saturn', body: A.Body.Saturn, name: 'Saturno', color: '#F2D488' },
  { id: 'Uranus', body: A.Body.Uranus, name: 'Urano', color: '#A9E7E6' },
  { id: 'Neptune', body: A.Body.Neptune, name: 'Netuno', color: '#93AEFF' },
];

export type PlanetState = {
  id: PlanetId;
  name: string;
  color: string;
  enu: Float64Array;
  eqj: Float64Array;
  alt: number;
  az: number;
  mag: number;
  /** Distance from the observer in AU. */
  dist: number;
  constellation: string;
};

export type HorizonFrame = {
  time: Date;
  rot: Rot;
  latitude: number;
  stars: Float64Array;
  milkyWay: Float64Array;
  lines: Float64Array[][];
  labels: Float64Array;
  asterisms: Float64Array[][];
  dsos: { dso: Dso; enu: Float64Array }[];
  galacticCenter: Float64Array;
  ecliptic: Float64Array;
  planets: PlanetState[];
  /** Celestial poles in ENU (the true poles of date). */
  north: Float64Array;
  south: Float64Array;
};

const OBLIQUITY = 23.4393 * D2R;
const ECLIPTIC_EQJ = (() => {
  const v = new Float64Array(73 * 3);
  for (let i = 0; i <= 72; i++) {
    const l = i * 5 * D2R;
    v[i * 3] = Math.cos(l);
    v[i * 3 + 1] = Math.sin(l) * Math.cos(OBLIQUITY);
    v[i * 3 + 2] = Math.sin(l) * Math.sin(OBLIQUITY);
  }
  return v;
})();

const GC_EQJ = (() => {
  const v = new Float64Array(3);
  eqVector(GALACTIC_CENTER.ra, GALACTIC_CENTER.dec, v, 0);
  return v;
})();

const DSO_EQJ = DSOS.map((d) => {
  const v = new Float64Array(3);
  eqVector(d.ra, d.dec, v, 0);
  return v;
});

export function observerOf(place: Place) {
  return new A.Observer(place.latitude, place.longitude, 0);
}

function planetState(p: (typeof PLANETS)[number], time: Date, obs: A.Observer, rot: Rot): PlanetState {
  const eq = A.Equator(p.body, time, obs, false, true);
  const len = eq.vec.Length();
  const eqj = new Float64Array([eq.vec.x / len, eq.vec.y / len, eq.vec.z / len]);
  const enu = rotateInto(rot, eqj, new Float64Array(3));
  const { alt, az } = altAz(enu[0], enu[1], enu[2]);
  let mag = 6;
  try {
    mag = A.Illumination(p.body, time).mag;
  } catch {}
  return { id: p.id, name: p.name, color: p.color, enu, eqj, alt, az, mag, dist: eq.dist, constellation: A.Constellation(eq.ra, eq.dec).symbol };
}

export function horizonFrame(place: Place, time: Date): HorizonFrame {
  const cat = catalog();
  const obs = observerOf(place);
  const rot = A.Rotation_EQJ_HOR(time, obs).rot;
  const lat = place.latitude * D2R;
  const labels = new Float64Array(cat.constellations.length * 3);
  cat.constellations.forEach((c, i) => {
    const tmp = rotateInto(rot, c.label, new Float64Array(3));
    labels.set(tmp, i * 3);
  });
  return {
    time,
    rot,
    latitude: place.latitude,
    stars: rotateInto(rot, cat.vectors, new Float64Array(cat.vectors.length)),
    milkyWay: rotateInto(rot, cat.milkyWay, new Float64Array(cat.milkyWay.length)),
    lines: cat.constellations.map((c) => c.lines.map((l) => rotateInto(rot, l, new Float64Array(l.length)))),
    labels,
    asterisms: cat.asterismLines.map((a) => a.segments.map((s) => rotateInto(rot, s, new Float64Array(6)))),
    dsos: DSOS.map((dso, i) => ({ dso, enu: rotateInto(rot, DSO_EQJ[i], new Float64Array(3)) })),
    galacticCenter: rotateInto(rot, GC_EQJ, new Float64Array(3)),
    ecliptic: rotateInto(rot, ECLIPTIC_EQJ, new Float64Array(ECLIPTIC_EQJ.length)),
    planets: PLANETS.map((p) => planetState(p, time, obs, rot)),
    north: new Float64Array([0, Math.cos(lat), Math.sin(lat)]),
    south: new Float64Array([0, -Math.cos(lat), -Math.sin(lat)]),
  };
}

/** Star indices used for trails: the bright ones, so the arcs read as a long exposure. */
export function trailStars(limit = 4.2): number[] {
  const cat = catalog();
  const out: number[] = [];
  for (let i = 0; i < cat.count && cat.mag[i] <= limit; i++) out.push(i);
  return out;
}

/**
 * Positions of the trail stars over the `hours` before `time`, oldest first:
 * steps[k] holds a flat ENU triple per star in `indices`.
 */
export function starTrails(place: Place, time: Date, indices: number[], hours = 2, steps = 16): Float64Array[] {
  const cat = catalog();
  const obs = observerOf(place);
  const src = new Float64Array(indices.length * 3);
  indices.forEach((s, i) => src.set(cat.vectors.subarray(s * 3, s * 3 + 3), i * 3));
  const out: Float64Array[] = [];
  for (let k = steps; k >= 0; k--) {
    const t = new Date(time.getTime() - (hours * 3_600_000 * k) / steps);
    out.push(rotateInto(A.Rotation_EQJ_HOR(t, obs).rot, src, new Float64Array(src.length)));
  }
  return out;
}

/** The J2000 RA (hours) and Dec of an ENU direction under this frame's rotation. */
export function enuToEquator(frame: HorizonFrame, e: number, n: number, u: number) {
  const [r0, r1, r2] = frame.rot;
  // Inverse of rotateInto: HOR = (north, west, zenith).
  const hn = n;
  const hw = -e;
  const hz = u;
  const x = r0[0] * hn + r0[1] * hw + r0[2] * hz;
  const y = r1[0] * hn + r1[1] * hw + r1[2] * hz;
  const z = r2[0] * hn + r2[1] * hw + r2[2] * hz;
  return { ra: ((Math.atan2(y, x) * R2D + 360) % 360) / 15, dec: Math.asin(Math.max(-1, Math.min(1, z))) * R2D };
}

/** The IAU constellation containing an ENU direction. */
export function constellationAt(frame: HorizonFrame, e: number, n: number, u: number): string {
  const { ra, dec } = enuToEquator(frame, e, n, u);
  return A.Constellation(ra, dec).symbol;
}

export type ViewingPlan = {
  rise: Date | null;
  set: Date | null;
  /** Highest point during astronomical (or, failing that, nautical) darkness. */
  best: { time: Date; alt: number; dark: boolean } | null;
  maxAlt: number;
  alwaysUp: boolean;
  neverUp: boolean;
};

/**
 * Samples the next 24 h every 10 minutes for an object given by its J2000 direction.
 * `eqjAt` may ignore its argument for fixed objects.
 */
export function planViewing(place: Place, from: Date, eqjAt: (t: Date) => ArrayLike<number>): ViewingPlan {
  const obs = observerOf(place);
  const STEP = 10 * 60_000;
  const N = 145;
  const alts: number[] = [];
  const sun: number[] = [];
  const times: Date[] = [];
  const tmp = new Float64Array(3);
  for (let i = 0; i < N; i++) {
    const t = new Date(from.getTime() + i * STEP);
    const rot = A.Rotation_EQJ_HOR(t, obs).rot;
    rotateInto(rot, eqjAt(t), tmp);
    alts.push(Math.asin(Math.max(-1, Math.min(1, tmp[2]))) * R2D);
    const s = A.Equator(A.Body.Sun, t, obs, false, true).vec;
    const l = s.Length();
    rotateInto(rot, [s.x / l, s.y / l, s.z / l], tmp);
    sun.push(Math.asin(Math.max(-1, Math.min(1, tmp[2]))) * R2D);
    times.push(t);
  }
  let rise: Date | null = null;
  let set: Date | null = null;
  for (let i = 1; i < N; i++) {
    const a = alts[i - 1];
    const b = alts[i];
    if ((a < 0) === (b < 0)) continue;
    const f = a / (a - b);
    const t = new Date(times[i - 1].getTime() + f * STEP);
    if (b >= 0 && !rise) rise = t;
    if (b < 0 && !set) set = t;
  }
  const pick = (limit: number) => {
    let bi = -1;
    for (let i = 0; i < N; i++) if (sun[i] < limit && alts[i] > 5 && (bi < 0 || alts[i] > alts[bi])) bi = i;
    return bi;
  };
  let bi = pick(-15);
  const dark = bi >= 0;
  if (bi < 0) bi = pick(-6);
  return {
    rise,
    set,
    best: bi >= 0 ? { time: times[bi], alt: alts[bi], dark } : null,
    maxAlt: Math.max(...alts),
    alwaysUp: alts.every((a) => a > 0),
    neverUp: alts.every((a) => a <= 0),
  };
}
