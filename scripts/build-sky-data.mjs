#!/usr/bin/env node
/**
 * Builds the compact sky catalog used by the planetarium (src/astro/sky/data.ts).
 *
 * Source: d3-celestial by Olaf Frohn (BSD-3-Clause), https://github.com/ofrohn/d3-celestial
 *   stars.6.json, starnames.json, constellations.json, constellations.lines.json, mw.json
 *
 * Usage:
 *   node scripts/build-sky-data.mjs <dir-with-json-files>
 *   node scripts/build-sky-data.mjs            # downloads from GitHub
 *
 * Output (all J2000, degrees):
 *   STARS      flat [ra×100, dec×100, mag×100, bv×100, hip] rows, mag ≤ MAG_LIMIT, brightest first
 *   CONST      label point + importance rank per constellation
 *   LINES      stick figures as flat [ra, dec, ra, dec, …] polylines per constellation
 *   MILKY_WAY  an even point lattice over the Milky Way with a smoothed brightness per sample
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAG_LIMIT = 5.0;
const STAR_ROW = 5;
const EXTRA_HIP = [104382]; // σ Octantis, the southern pole star on the Brazilian flag (mag 5.4)
const LATTICE_SPACING = 2.2; // degrees between Milky Way samples
const SMOOTH_SIGMA = 2.0; // degrees, Gaussian smoothing of the brightness levels
const BASE = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/';

const dir = process.argv[2];
async function load(name) {
  if (dir) return JSON.parse(await readFile(path.join(dir, name), 'utf8'));
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const ra360 = (ra) => (ra < 0 ? ra + 360 : ra);
const D2R = Math.PI / 180;
const vec = (ra, dec) => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---------- stars ----------
const stars = await load('stars.6.json');
const rows = stars.features
  .filter((f) => f.properties.mag <= MAG_LIMIT || EXTRA_HIP.includes(f.id))
  .map((f) => ({
    ra: ra360(f.geometry.coordinates[0]),
    dec: f.geometry.coordinates[1],
    mag: f.properties.mag,
    bv: Number.parseFloat(f.properties.bv) || 0.6,
    hip: f.id,
  }))
  .sort((a, b) => a.mag - b.mag);
// Bayer/Flamsteed designations ("α Cen") and IAU proper names for the stars we keep.
const starnames = await load('starnames.json');
const DESIG = {};
const PROPER = {};
for (const s of rows) {
  const n = starnames[String(s.hip)];
  if (!n) continue;
  const d = n.bayer || n.flam;
  if (d && n.c) DESIG[s.hip] = `${d} ${n.c}`;
  if (n.name && s.mag <= 4) PROPER[s.hip] = n.name;
}
const STARS = rows.flatMap((s) => [Math.round(s.ra * 100), Math.round(s.dec * 100), Math.round(s.mag * 100), Math.round(s.bv * 100), s.hip]);

// ---------- constellations ----------
const consts = await load('constellations.json');
const seen = new Set();
const CONST = [];
for (const f of consts.features) {
  if (seen.has(f.id)) continue;
  seen.add(f.id);
  CONST.push([f.id, f.properties.name, +ra360(f.geometry.coordinates[0]).toFixed(2), +f.geometry.coordinates[1].toFixed(2), Number(f.properties.rank)]);
}

const lines = await load('constellations.lines.json');
const LINES = {};
for (const f of lines.features) {
  const polys = f.geometry.coordinates.map((pl) => pl.flatMap(([ra, dec]) => [+ra360(ra).toFixed(2), +dec.toFixed(2)]));
  (LINES[f.id] ??= []).push(...polys);
}

// ---------- Milky Way ----------
// Rasterise the five nested outlines onto a Fibonacci lattice with a spherical even-odd test:
// a sample is inside a level when the great-circle arc to the nearer galactic pole crosses
// that level's rings an odd number of times. Seams and poles need no special casing this way.
const mw = await load('mw.json');

function simplify(ring, tol) {
  // Douglas-Peucker on the sphere: distance to the great circle through the chord's ends
  // (or to the start point when the chord is degenerate, as on a closed ring).
  if (ring.length < 4) return ring;
  const v = ring.map(([ra, dec]) => vec(ra360(ra), dec));
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  const sinTol = Math.sin(tol * D2R);
  while (stack.length) {
    const [a, b] = stack.pop();
    const n = cross(v[a], v[b]);
    const len = Math.hypot(n[0], n[1], n[2]);
    let best = -1;
    let bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = len > 1e-9 ? Math.abs(dot(v[i], n)) / len : Math.hypot(...cross(v[i], v[a]));
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    if (best > sinTol) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    let dx = ring[i + 1][0] - ring[i][0];
    if (dx > 180) dx -= 360;
    if (dx < -180) dx += 360;
    s += dx * Math.cos(ring[i][1] * D2R) * (ring[i + 1][1] + ring[i][1]) * 0.5;
  }
  return Math.abs(s);
}

const levels = mw.features.map((f) => {
  const edges = [];
  for (const poly of f.geometry.coordinates) {
    for (const ring of poly) {
      if (ring.length > 6 && ringArea(ring) < 1.5) continue; // drop specks smaller than the lattice
      const pts = simplify(ring, 0.25).map(([ra, dec]) => vec(ra360(ra), dec));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        edges.push({ a, b, n: cross(a, b) });
      }
    }
  }
  return edges;
});

// Galactic poles (J2000).
const NGP = vec(192.85948, 27.12825);
const SGP = NGP.map((v) => -v);

function arcsCross(p, q, npq, e) {
  // Do the minor arcs p→q and a→b intersect?
  const l = cross(npq, e.n);
  const len = Math.hypot(l[0], l[1], l[2]);
  if (len < 1e-12) return false;
  for (const s of [1, -1]) {
    const x = [(l[0] / len) * s, (l[1] / len) * s, (l[2] / len) * s];
    if (dot(cross(p, x), npq) >= 0 && dot(cross(x, q), npq) >= 0 && dot(cross(e.a, x), e.n) >= 0 && dot(cross(x, e.b), e.n) >= 0) return true;
  }
  return false;
}

const N = Math.round(41253 / (LATTICE_SPACING * LATTICE_SPACING));
const golden = Math.PI * (3 - Math.sqrt(5));
const samples = [];
for (let i = 0; i < N; i++) {
  const z = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - z * z);
  const th = golden * i;
  const p = [r * Math.cos(th), r * Math.sin(th), z];
  const gb = dot(p, NGP);
  if (Math.abs(gb) > 0.8) continue; // |b| > ~53°: never part of the band
  const q = gb >= 0 ? NGP : SGP;
  const npq = cross(p, q);
  let level = 0;
  if (Math.abs(gb) < 0.75) {
    for (let k = 0; k < levels.length; k++) {
      let inside = false;
      for (const e of levels[k]) if (arcsCross(p, q, npq, e)) inside = !inside;
      if (!inside) break; // levels are nested
      level = k + 1;
    }
  }
  samples.push({ p, level });
}

// Gaussian smoothing of the level field: removes specks and gives soft, nested contours.
const SIGMA = SMOOTH_SIGMA * D2R;
const cutoff = Math.cos(3 * SIGMA);
const MILKY_WAY = [];
for (const s of samples) {
  let wsum = 0;
  let vsum = 0;
  for (const o of samples) {
    const c = dot(s.p, o.p);
    if (c < cutoff) continue;
    const ang = Math.acos(Math.min(1, c));
    const w = Math.exp(-(ang * ang) / (2 * SIGMA * SIGMA));
    wsum += w;
    vsum += w * o.level;
  }
  const v = vsum / wsum;
  if (v < 0.15) continue;
  const ra = (Math.atan2(s.p[1], s.p[0]) / D2R + 360) % 360;
  const dec = Math.asin(s.p[2]) / D2R;
  MILKY_WAY.push(Math.round(ra * 10), Math.round(dec * 10), Math.round(v * 20));
}

// ---------- write ----------
const wrap = (arr, per = 20) => {
  const out = [];
  for (let i = 0; i < arr.length; i += per) out.push('  ' + arr.slice(i, i + per).join(', ') + ',');
  return out.join('\n');
};

const ts = `// Generated by scripts/build-sky-data.mjs — do not edit by hand.
// Data: d3-celestial © Olaf Frohn, BSD-3-Clause (https://github.com/ofrohn/d3-celestial).
// All coordinates J2000, degrees.

/** Rows of [ra×100, dec×100, mag×100, (B−V)×100, HIP], brightest first. ${rows.length} stars, mag ≤ ${MAG_LIMIT}. */
export const STAR_ROW = 5;
export const STARS: readonly number[] = [
${wrap(STARS, STAR_ROW * 4)}
];

/** Designations by HIP ("α Cen"). */
export const DESIGNATIONS: Readonly<Record<number, string>> = ${JSON.stringify(DESIG)};

/** IAU proper names by HIP, mag ≤ 4. */
export const PROPER_NAMES: Readonly<Record<number, string>> = ${JSON.stringify(PROPER)};

/** [abbreviation, Latin name, label ra, label dec, rank 1 (major) … 3 (minor)] */
export const CONSTELLATIONS: readonly (readonly [string, string, number, number, number])[] = ${JSON.stringify(CONST)};

/** Stick figures: flat [ra, dec, ra, dec, …] polylines per constellation. */
export const LINES: Readonly<Record<string, readonly (readonly number[])[]>> = ${JSON.stringify(LINES)};

/**
 * Milky Way lattice (≈${LATTICE_SPACING}° spacing) as flat [ra×10, dec×10, brightness×20] rows.
 * Brightness is the five d3-celestial outline levels smoothed with a ${SMOOTH_SIGMA}° Gaussian (0 … 5).
 */
export const MILKY_WAY: readonly number[] = [
${wrap(MILKY_WAY, 24)}
];
`;

const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'astro', 'sky', 'data.ts');
await writeFile(out, ts);
console.log(`stars ${rows.length}, constellations ${CONST.length}, line sets ${Object.keys(LINES).length}, milky way ${MILKY_WAY.length / 3} samples`);
console.log(`wrote ${out} (${(ts.length / 1024).toFixed(0)} KB)`);
