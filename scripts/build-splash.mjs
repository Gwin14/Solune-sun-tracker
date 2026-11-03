// Renders the full-screen iOS launch sky to assets/images/splash-sky.png (no dependencies).
// Run: node scripts/build-splash.mjs
//
// The planetarium's own catalogue, seen from a dark site after dusk: the Milky Way core
// rising over Scorpius and Sagittarius, the last blue of twilight on the horizon and a
// thin crescent going down after the sun. Stars use the real positions, magnitudes and
// B−V colours from src/astro/sky/data.ts. The top fades to colors.ink, the app's first
// paint, so the splash dissolves without a jump. Android 12+ only shows an icon, see
// scripts/build-splash-icon.mjs.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { MILKY_WAY, STARS, STAR_ROW } from '../src/astro/sky/data.ts';

// iPhone Pro Max portrait at 3×; "cover" crops the sides on narrower screens.
const W = 1290;
const H = 2796;
const D2R = Math.PI / 180;

// View: centred just above the galactic core, rolled so the band climbs diagonally.
const RA0 = 266 * D2R;
const DEC0 = -24 * D2R;
const ROLL = -32 * D2R;
const SCALE = H / 2 / Math.tan((96 / 4) * D2R); // stereographic, ~96° tall
const CX = W * 0.52;
const CY = H * 0.5;
const HORIZON = H * 0.9;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function project(raDeg, decDeg) {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const cosc = Math.sin(DEC0) * Math.sin(dec) + Math.cos(DEC0) * Math.cos(dec) * Math.cos(ra - RA0);
  if (cosc < -0.2) return null;
  const k = (2 * SCALE) / (1 + cosc) / 2;
  // East is left on a sky seen from below.
  const x = -k * Math.cos(dec) * Math.sin(ra - RA0);
  const y = -k * (Math.cos(DEC0) * Math.sin(dec) - Math.sin(DEC0) * Math.cos(dec) * Math.cos(ra - RA0));
  return [CX + x * Math.cos(ROLL) - y * Math.sin(ROLL), CY + x * Math.sin(ROLL) + y * Math.cos(ROLL)];
}

// Linear-light float buffer.
const img = new Float32Array(W * H * 3);
const add = (x, y, rgb, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] += rgb[0] * a;
  img[o + 1] += rgb[1] * a;
  img[o + 2] += rgb[2] * a;
};
const lin = (rgb) => rgb.map((c) => c ** 2.2);

// Seeded noise for the dust lanes and the faint background stars.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const G = 64;
const grid = Float32Array.from({ length: G * G }, rand);
const vnoise = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const g = (i, j) => grid[(((j % G) + G) % G) * G + (((i % G) + G) % G)];
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return (g(xi, yi) * (1 - sx) + g(xi + 1, yi) * sx) * (1 - sy) + (g(xi, yi + 1) * (1 - sx) + g(xi + 1, yi + 1) * sx) * sy;
};
const fbm = (x, y) => {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += vnoise(x, y) * a;
    x *= 2.03;
    y *= 2.03;
    a *= 0.5;
  }
  return v;
};

// 1 · Sky gradient: colors.ink at the top, SKY's -15° and -9° keyframes toward the horizon.
const TOP = hex('#05081A');
const MID = hex('#0B1043');
const LOW = hex('#272A78');
const DUSK = hex('#6A4F9E');
const EMBER = hex('#C77D8E');
const GROUND = hex('#03050F');
for (let y = 0; y < H; y++) {
  const t = y / HORIZON;
  let c = mix(TOP, MID, smooth(0.25, 0.85, t));
  c = mix(c, LOW, smooth(0.72, 1, t) * 0.8);
  c = mix(c, DUSK, smooth(0.9, 1, t) * 0.55);
  for (let x = 0; x < W; x++) {
    // The sun set to the lower right: a warm ember low on that side.
    const ember = Math.exp(-(((x - W * 0.85) / (W * 0.55)) ** 2)) * smooth(0.93, 1, t) * 0.5;
    const rgb = lin(mix(c, EMBER, ember));
    const o = (y * W + x) * 3;
    img[o] = rgb[0];
    img[o + 1] = rgb[1];
    img[o + 2] = rgb[2];
  }
}

// 2 · Milky Way: the catalogue lattice splatted into a density map, then textured.
const MW_STEP = 6;
const mw = new Float32Array(Math.ceil(W / MW_STEP) * Math.ceil(H / MW_STEP));
const MW_W = Math.ceil(W / MW_STEP);
const MW_H = Math.ceil(H / MW_STEP);
const sigma = (2.0 * D2R * SCALE) / MW_STEP;
for (let i = 0; i < MILKY_WAY.length; i += 3) {
  const v = MILKY_WAY[i + 2] / 20;
  if (v <= 0) continue;
  const p = project(MILKY_WAY[i] / 10, MILKY_WAY[i + 1] / 10);
  if (!p) continue;
  const gx = p[0] / MW_STEP;
  const gy = p[1] / MW_STEP;
  const r = Math.ceil(sigma * 3);
  for (let y = Math.max(0, Math.floor(gy - r)); y < Math.min(MW_H, gy + r); y++) {
    for (let x = Math.max(0, Math.floor(gx - r)); x < Math.min(MW_W, gx + r); x++) {
      mw[y * MW_W + x] += v * Math.exp(-((x - gx) ** 2 + (y - gy) ** 2) / (2 * sigma * sigma));
    }
  }
}
let mwMax = 0;
for (const v of mw) mwMax = Math.max(mwMax, v);
const mwAt = (x, y) => {
  const gx = clamp(x / MW_STEP, 0, MW_W - 1.001);
  const gy = clamp(y / MW_STEP, 0, MW_H - 1.001);
  const xi = Math.floor(gx);
  const yi = Math.floor(gy);
  const fx = gx - xi;
  const fy = gy - yi;
  const g = (i, j) => mw[Math.min(MW_H - 1, j) * MW_W + Math.min(MW_W - 1, i)];
  return ((g(xi, yi) * (1 - fx) + g(xi + 1, yi) * fx) * (1 - fy) + (g(xi, yi + 1) * (1 - fx) + g(xi + 1, yi + 1) * fx) * fy) / mwMax;
};
const MW_COOL = lin(hex('#8C9BD8'));
const MW_WARM = lin(hex('#E8CFA8'));
for (let y = 0; y < HORIZON; y++) {
  const fade = 1 - smooth(HORIZON - 260, HORIZON, y) * 0.75;
  for (let x = 0; x < W; x++) {
    const d = mwAt(x, y);
    if (d < 0.005) continue;
    const n = fbm(x / 180, y / 180);
    const dust = smooth(0.45, 0.7, fbm(x / 55 + 9, y / 55 + 3)) * smooth(0.5, 0.65, fbm(x / 300 + 4, y / 300));
    const core = d ** 2;
    const light = (0.035 * Math.sqrt(d) + 0.05 * d + 0.12 * core) * (0.55 + 0.9 * n) * (1 - 0.7 * dust * smooth(0.3, 0.8, d)) * smooth(0.005, 0.12, d) * fade;
    const o = (y * W + x) * 3;
    const tint = mix(MW_COOL, MW_WARM, smooth(0.4, 1, d));
    img[o] += tint[0] * light;
    img[o + 1] += tint[1] * light;
    img[o + 2] += tint[2] * light;
  }
}

// 3 · Stars.
// B−V to a gentle display colour (blue-white … pale amber), like the planetarium.
function starColor(bv) {
  const t = clamp((bv + 0.3) / 2.0);
  const stops = [hex('#A9C1FF'), hex('#F4F3FF'), hex('#FFF1D6'), hex('#FFC98A')];
  const s = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(s));
  return lin(mix(stops[i], stops[i + 1], s - i));
}
function drawStar(px, py, mag, rgb, extinction) {
  // Flux falls 2.512× per magnitude; size follows its square root so bright stars read.
  const flux = 10 ** (-0.4 * (mag - 1.5)) * extinction;
  const r = 0.9 + 3.6 * Math.sqrt(clamp(flux, 0, 6));
  const peak = clamp(0.12 + 1.6 * Math.sqrt(flux), 0, 1.8);
  const halo = clamp(flux - 0.25, 0, 3);
  const R = Math.ceil(r * 3 + halo * 14);
  for (let y = Math.floor(py - R); y <= py + R; y++) {
    for (let x = Math.floor(px - R); x <= px + R; x++) {
      const d2 = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
      const a = peak * Math.exp(-d2 / (2 * (r / 2) ** 2)) + halo * 0.05 * Math.exp(-Math.sqrt(d2) / (6 + halo * 3));
      if (a > 0.002) add(x, y, rgb, a);
    }
  }
}
const ext = (y) => 1 - smooth(HORIZON - 420, HORIZON, y) * 0.85;

// Faint field stars below the catalogue's mag-5 limit, denser inside the band.
for (let i = 0; i < 7000; i++) {
  const x = rand() * W;
  const y = rand() * HORIZON;
  const d = mwAt(x, y);
  if (rand() > 0.25 + 0.75 * d) continue;
  drawStar(x, y, 6.5 + rand() * 1.8, starColor(rand() * 1.4 - 0.1), ext(y) * 0.8);
}
for (let i = 0; i < STARS.length; i += STAR_ROW) {
  const p = project(STARS[i] / 100, STARS[i + 1] / 100);
  if (!p || p[1] >= HORIZON || p[0] < -20 || p[0] > W + 20) continue;
  drawStar(p[0], p[1], STARS[i + 2] / 100, starColor(STARS[i + 3] / 100), ext(p[1]));
}

// 4 · Crescent going down after the sun, earthshine just visible.
const MOON = { x: W * 0.8, y: HORIZON - 250, r: 34 };
const MOON_LIT = lin(hex('#EEF0FF'));
for (let y = MOON.y - 260; y < MOON.y + 260; y++) {
  for (let x = MOON.x - 260; x < MOON.x + 260; x++) {
    const d = Math.hypot(x + 0.5 - MOON.x, y + 0.5 - MOON.y);
    const disc = clamp(MOON.r - d + 0.5);
    // Lit limb faces the sun, below right.
    const cut = Math.hypot(x + 0.5 - (MOON.x - 13), y + 0.5 - (MOON.y - 9)) - MOON.r * 0.94;
    const lit = disc * clamp(cut + 0.5);
    add(Math.floor(x), Math.floor(y), MOON_LIT, lit * 1.05 + disc * 0.03 + 0.05 * Math.exp(-d / 70) * (1 - disc));
  }
}

// 5 · Ground: a low, soft ridge.
for (let x = 0; x < W; x++) {
  const ridge = HORIZON - 26 - 70 * fbm(x / 520 + 2, 1.5) + 40 * Math.sin(x / W * 2.4 + 0.6);
  for (let y = Math.floor(ridge - 2); y < H; y++) {
    const a = clamp(y - ridge + 0.5);
    const o = (y * W + x) * 3;
    const g = lin(GROUND);
    for (let k = 0; k < 3; k++) img[o + k] = img[o + k] * (1 - a) + g[k] * a;
  }
}

// Encode: tone-map softly, back to sRGB, ordered dither against gradient banding.
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  const row = y * (W * 3 + 1);
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    const dither = (((x * 7 + y * 13) % 16) / 16 - 0.5) / 255;
    for (let k = 0; k < 3; k++) {
      const v = img[o + k];
      const m = v / (1 + v * 0.35);
      raw[row + 1 + x * 3 + k] = Math.round(clamp(m ** (1 / 2.2) + dither) * 255);
    }
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB

const out = new URL('../assets/images/splash-sky.png', import.meta.url);
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(`wrote ${fileURLToPath(out)}`);
