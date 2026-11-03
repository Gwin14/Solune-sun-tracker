// Renders the launch mark to assets/images/splash-icon.png (no dependencies).
// Run: node scripts/build-splash.mjs
//
// A half sun resting on a faded horizon under a small crescent, drawn on a
// transparent 1024² canvas. The splash background colour comes from app.json and
// equals colors.ink, the first colour the root view paints, so nothing jumps when
// the splash fades into the sky. Everything stays inside the centre circle of
// 2/3 the canvas, the area Android 12+ keeps when it masks the splash icon.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const N = 1024;
const C = N / 2;
const HORIZON = 572;
const SUN_R = 150;
const MOON = { x: 694, y: 318, r: 40, cut: { dx: 17, dy: -11, r: 35 } };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Edge coverage from a signed distance in pixels (negative = inside).
const cover = (d) => clamp(0.5 - d);

// Same ramp as the icon's sun layer (05-sol.svg).
const SUN = [
  [0, hex('#FFF3D1')],
  [0.48, hex('#FFD47B')],
  [0.8, hex('#FFB95C')],
  [1, hex('#FFA84A')],
];
function sunColor(t) {
  for (let i = 1; i < SUN.length; i++) {
    const [o, c] = SUN[i];
    const [po, pc] = SUN[i - 1];
    if (t <= o) return mix(pc, c, (t - po) / (o - po));
  }
  return SUN[SUN.length - 1][1];
}

const GLOW = hex('#FFAA7D');
const LINE = hex('#F6F5F2');
const MOONC = hex('#EEF0FF');

// Premultiplied "over".
function over(dst, rgb, a) {
  if (a <= 0) return;
  for (let i = 0; i < 3; i++) dst[i] = rgb[i] * a + dst[i] * (1 - a);
  dst[3] = a + dst[3] * (1 - a);
}

const raw = Buffer.alloc(N * (N * 4 + 1));
const px = [0, 0, 0, 0];
for (let y = 0; y < N; y++) {
  const row = y * (N * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < N; x++) {
    px[0] = px[1] = px[2] = px[3] = 0;
    const cx = x + 0.5;
    const cy = y + 0.5;
    const dx = cx - C;
    const dy = cy - HORIZON;
    const r = Math.hypot(dx, dy);
    const above = cover(cy - HORIZON);

    // Atmosphere: a warm halo above the horizon and a thin glint just under it.
    const halo = (1 - smooth(SUN_R * 0.85, 330, r)) ** 2.2;
    const glint = 1 - smooth(0, 70, dy);
    over(px, GLOW, halo * (0.42 * above + 0.16 * glint * (1 - above)));

    // Sun: the upper half of the disc, cut flat by the horizon.
    const disc = cover(r - SUN_R) * above;
    // Gradient centre offset up-left like the icon, so the limb warms toward the edge.
    const g = Math.hypot(cx - (C - 32), cy - (HORIZON - 60)) / (SUN_R * 1.2);
    over(px, sunColor(clamp(g)), disc);

    // Horizon hairline, fading out at both ends.
    const line = cover(Math.abs(cy - HORIZON) - 1.5) * (1 - smooth(110, 300, Math.abs(dx)));
    over(px, LINE, line * 0.5);

    // Crescent: a disc minus an offset disc.
    const m1 = Math.hypot(cx - MOON.x, cy - MOON.y) - MOON.r;
    const m2 = Math.hypot(cx - (MOON.x + MOON.cut.dx), cy - (MOON.y + MOON.cut.dy)) - MOON.cut.r;
    over(px, MOONC, cover(Math.max(m1, -m2)) * 0.92);

    const o = row + 1 + x * 4;
    const a = px[3];
    raw[o] = a ? Math.round((px[0] / a) * 255) : 0;
    raw[o + 1] = a ? Math.round((px[1] / a) * 255) : 0;
    raw[o + 2] = a ? Math.round((px[2] / a) * 255) : 0;
    raw[o + 3] = Math.round(a * 255);
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
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const out = new URL('../assets/images/splash-icon.png', import.meta.url);
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
