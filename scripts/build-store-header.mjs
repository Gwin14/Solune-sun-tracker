// Renders the App Store product page header art (no dependencies).
// Run: node scripts/build-store-header.mjs
//
// The launch mark opened up into a landscape: a twilight sky in the app's own
// keyframe colours, a half sun on a faded horizon, a crescent and a few stars,
// with a soft reflection below. No text and no alpha channel (App Store Connect
// rejects transparency). The subject sits in the middle of the frame so the
// crops the store makes on each device keep it.
//
// Writes:
//   assets/store/header-16x9.png  5244 × 2950  (header)
//   assets/store/header-21x9.png  3840 × 1646  (wide header)
//   assets/store/search-3x2.png   3840 × 2560  (search results, shown as a
//                                              short wide strip of the middle)

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const cover = (d) => clamp(0.5 - d);
const ramp = (stops, t) => {
  for (let i = 1; i < stops.length; i++) {
    const [o, c] = stops[i];
    const [po, pc] = stops[i - 1];
    if (t <= o) return mix(pc, c, (t - po) / (o - po));
  }
  return stops[stops.length - 1][1];
};

// Sky from zenith (0) to horizon (1): the -9° and -3° keyframes of theme/sky.ts.
const SKY = [
  [0, hex('#05081A')],
  [0.3, hex('#0B1043')],
  [0.58, hex('#272A78')],
  [0.8, hex('#55479E')],
  [1, hex('#D9809B')],
];
// Below the horizon, from the waterline (0) down (1).
const SEA = [
  [0, hex('#3A2F6E')],
  [0.25, hex('#151A48')],
  [1, hex('#05081A')],
];
const SUN = [
  [0, hex('#FFF3D1')],
  [0.48, hex('#FFD47B')],
  [0.8, hex('#FFB95C')],
  [1, hex('#FFA84A')],
];
const GLOW = hex('#FFAA7D');
const LINE = hex('#F6F5F2');
const MOONC = hex('#EEF0FF');
const STAR = hex('#F4F2FF');

// Deterministic stars, placed in unit space (x across, y as a fraction of the sky).
function stars(count, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return Array.from({ length: count }, () => ({
    x: rnd(),
    y: rnd() ** 1.6 * 0.82,
    r: 0.6 + rnd() ** 3 * 1.6,
    a: 0.25 + rnd() * 0.6,
  }));
}
const STARS = stars(140, 7);

function render(W, H, file, { scale = 1, horizon = 0.6 } = {}) {
  // Everything scales with height so both crops share one composition; `scale`
  // shrinks the scene round the centre for placements that crop tighter.
  const u = (H / 1000) * scale;
  const C = W / 2;
  const HORIZON = H * horizon;
  const SUN_R = 165 * u;
  const REFL = 400 * u;
  const MOON = { x: C + 360 * u, y: HORIZON - 350 * u, r: 46 * u, cut: { dx: 19 * u, dy: -13 * u, r: 40 * u } };
  const starPx = STARS.map((st) => ({
    x: st.x * W,
    y: st.y * HORIZON,
    r: st.r * (H / 1000) * 1.4,
    a: st.a,
  })).filter((st) => Math.hypot(st.x - MOON.x, st.y - MOON.y) > MOON.r * 3 && Math.hypot(st.x - C, st.y - HORIZON) > SUN_R * 2.4);

  // Bucket stars by row band so each pixel only tests nearby ones.
  const BAND = Math.ceil(8 * u);
  const bands = new Map();
  for (const st of starPx) {
    const b0 = Math.floor((st.y - st.r * 3) / BAND);
    const b1 = Math.floor((st.y + st.r * 3) / BAND);
    for (let b = b0; b <= b1; b++) (bands.get(b) ?? bands.set(b, []).get(b)).push(st);
  }

  const stride = W * 3 + 1;
  const raw = Buffer.alloc(H * stride);
  const px = [0, 0, 0];
  const over = (rgb, a) => {
    if (a <= 0) return;
    for (let i = 0; i < 3; i++) px[i] = rgb[i] * a + px[i] * (1 - a);
  };

  for (let y = 0; y < H; y++) {
    const row = y * stride;
    raw[row] = 0;
    const cy = y + 0.5;
    const dy = cy - HORIZON;
    const above = cover(dy);
    const sky = ramp(SKY, clamp(cy / HORIZON) ** 1.35);
    const sea = ramp(SEA, clamp(dy / (H - HORIZON)));
    const band = bands.get(Math.floor(cy / BAND)) ?? [];

    for (let x = 0; x < W; x++) {
      const cx = x + 0.5;
      const dx = cx - C;
      const base = mix(sea, sky, above);
      px[0] = base[0];
      px[1] = base[1];
      px[2] = base[2];

      for (const st of band) {
        const d = Math.hypot(cx - st.x, cy - st.y);
        if (d < st.r * 3) over(STAR, st.a * (cover(d - st.r) * 0.85 + (1 - smooth(0, st.r * 3, d)) * 0.15));
      }

      // Atmosphere: a wide warm band along the horizon and a halo round the sun.
      const r = Math.hypot(dx, dy);
      const flat = Math.hypot(dx / 2.6, dy);
      over(GLOW, (1 - smooth(0, 520 * u, flat)) ** 2 * 0.32 * above);
      over(GLOW, (1 - smooth(SUN_R * 0.85, SUN_R * 2.3, r)) ** 2.2 * 0.42 * above);

      // Sun: the upper half of the disc, cut flat by the horizon.
      const disc = cover(r - SUN_R) * above;
      const g = Math.hypot(cx - (C - 35 * u), cy - (HORIZON - 66 * u)) / (SUN_R * 1.2);
      over(ramp(SUN, clamp(g)), disc);

      // Reflection: a soft column of light under the sun, broken into ripples.
      if (dy > 0) {
        const depth = dy / REFL;
        const line = (dy / u) * (0.5 - depth * 0.25);
        const width = SUN_R * (1 - depth * 0.3) * (0.75 + 0.25 * Math.sin(Math.floor(line / Math.PI) * 2.7));
        const ripple = smooth(0.2, 1, Math.cos(line + Math.sin(dx / (45 * u) + line * 0.13) * 1.1)) ** 1.5;
        const col = (1 - smooth(width * 0.1, width, Math.abs(dx))) * (1 - smooth(0, 0.8, depth));
        over(ramp(SUN, 0.55 + depth * 0.4), col * ripple * 0.42);
        over(GLOW, (1 - smooth(0, 90 * u, dy)) * (1 - smooth(0, 700 * u, Math.abs(dx))) * 0.22);
      }

      // Horizon hairline, fading out toward the edges.
      over(LINE, cover(Math.abs(dy) - 1.2 * u) * (1 - smooth(SUN_R * 0.8, W * 0.42, Math.abs(dx))) * 0.45);

      // Crescent: a disc minus an offset disc.
      const m1 = Math.hypot(cx - MOON.x, cy - MOON.y) - MOON.r;
      const m2 = Math.hypot(cx - (MOON.x + MOON.cut.dx), cy - (MOON.y + MOON.cut.dy)) - MOON.cut.r;
      over(MOONC, cover(Math.max(m1, -m2)) * 0.92);

      // A touch of dither so the long gradients don't band.
      const n = (((x * 73856093) ^ (y * 19349663)) & 1023) / 1023 - 0.5;
      const o = row + 1 + x * 3;
      raw[o] = clamp(Math.round(px[0] * 255 + n), 0, 255);
      raw[o + 1] = clamp(Math.round(px[1] * 255 + n), 0, 255);
      raw[o + 2] = clamp(Math.round(px[2] * 255 + n), 0, 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB, no alpha
  const out = new URL(`../assets/store/${file}`, import.meta.url);
  writeFileSync(
    out,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
  console.log(`wrote ${fileURLToPath(out)} (${W}×${H})`);
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
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}

mkdirSync(new URL('../assets/store/', import.meta.url), { recursive: true });
const only = process.argv[2];
const jobs = [
  [5244, 2950, 'header-16x9.png'],
  [3840, 1646, 'header-21x9.png'],
  [3840, 2560, 'search-3x2.png', { scale: 0.45, horizon: 0.47 }],
];
for (const [w, h, file, opts] of jobs) if (!only || file.startsWith(only)) render(w, h, file, opts);
