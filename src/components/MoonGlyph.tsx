import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

/** Near-side maria, unit-disc coordinates (northern-hemisphere view): centre, radius, irregularity seed. */
const MARIA = [
  { x: -0.33, y: -0.36, r: 0.26, s: 1 }, // Imbrium
  { x: 0.12, y: -0.4, r: 0.15, s: 2 }, // Serenitatis
  { x: 0.3, y: -0.1, r: 0.18, s: 3 }, // Tranquillitatis
  { x: 0.63, y: -0.3, r: 0.1, s: 4 }, // Crisium
  { x: 0.52, y: 0.14, r: 0.13, s: 5 }, // Fecunditatis
  { x: 0.3, y: 0.28, r: 0.09, s: 6 }, // Nectaris
  { x: -0.58, y: 0.0, r: 0.3, s: 7 }, // Procellarum
  { x: -0.2, y: 0.38, r: 0.14, s: 8 }, // Nubium
  { x: -0.48, y: 0.42, r: 0.08, s: 9 }, // Humorum
  { x: -0.05, y: -0.12, r: 0.07, s: 10 }, // Vaporum
];

/** Bright young craters (Tycho, Copernicus, Kepler, Aristarchus) with faint rays. */
const BRIGHT = [
  { x: -0.12, y: 0.72, r: 0.035 },
  { x: -0.33, y: -0.12, r: 0.03 },
  { x: -0.6, y: -0.15, r: 0.02 },
  { x: -0.72, y: -0.38, r: 0.02 },
];

function rand(seed: number) {
  let t = seed * 9301 + 49297;
  return () => {
    t = (t * 9301 + 49297) % 233280;
    return t / 233280;
  };
}

/** A soft irregular blob around a centre — reads as terrain, not as a circle. */
function blob(cx: number, cy: number, r: number, seed: number): string {
  const rnd = rand(seed);
  const n = 11;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = r * (0.72 + rnd() * 0.5);
    return { x: cx + Math.cos(a) * k * 1.12, y: cy + Math.sin(a) * k * 0.9 };
  });
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    if (!i) d += `M${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d + 'Z';
}

export function moonLitPath(cx: number, cy: number, r: number, angle: number): string {
  const p = ((angle % 360) + 360) % 360;
  const cos = Math.cos((p * Math.PI) / 180);
  const rx = Math.max(0.001, Math.abs(cos) * r);
  const waxing = p < 180;
  const crescent = cos > 0;
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  // Outer limb on the lit side, then the terminator back to the top.
  const outerSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  return `M ${top} A ${r} ${r} 0 0 ${outerSweep} ${bottom} A ${rx} ${r} 0 0 ${termSweep} ${top} Z`;
}

/** Phase angle nudged toward a thinner moon, keeping the same side lit. */
function thinner(angle: number, by: number) {
  const p = ((angle % 360) + 360) % 360;
  return p < 180 ? Math.max(0.5, p - by) : Math.min(359.5, p + by);
}

type Props = {
  size: number;
  /** Phase angle: 0 new, 180 full. */
  angle: number;
  /** Southern-hemisphere observers see the Moon rotated 180°. */
  southern?: boolean;
  glow?: boolean;
  earthshine?: boolean;
};

export const MoonGlyph = memo(function MoonGlyph({ size, angle, southern, glow = true, earthshine = true }: Props) {
  const r = size / 2;
  const id = `m${Math.round(size)}`;
  const illum = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
  const detailed = size >= 40;

  // The terminator is drawn in three steps so the light falls off instead of cutting.
  const steps = [0, 1.2, 2.6, 4.4, 7].map((by) => moonLitPath(r, r, r * 0.999, thinner(angle, by)));
  const stepOpacity = [0.22, 0.42, 0.62, 0.82, 1];

  const terrain = useMemo(() => {
    const maria = MARIA.map((m) => blob(r + m.x * r, r + m.y * r, m.r * r, m.s));
    const rnd = rand(42);
    const pits = detailed
      ? Array.from({ length: 22 }, () => {
          const a = rnd() * Math.PI * 2;
          const d = Math.sqrt(rnd()) * 0.92;
          return { x: r + Math.cos(a) * d * r, y: r + Math.sin(a) * d * r, r: (0.008 + rnd() * 0.022) * r };
        })
      : [];
    return { maria, pits };
  }, [r, detailed]);

  const surface = (
    <>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id}lit)`} />
      {terrain.maria.map((d, i) => (
        <G key={i}>
          <Path d={d} fill={`url(#${id}mare)`} />
          <Path d={d} fill="#80828F" opacity={0.12} transform={`translate(${r * 0.03} ${r * 0.02})`} />
        </G>
      ))}
      {terrain.pits.map((p, i) => (
        <Circle key={`p${i}`} cx={p.x} cy={p.y} r={p.r} fill={i % 3 ? '#8A8B93' : '#FFFFFF'} opacity={i % 3 ? 0.16 : 0.22} />
      ))}
      {detailed
        ? BRIGHT.map((c, i) => (
            <G key={`b${i}`}>
              <Circle cx={r + c.x * r} cy={r + c.y * r} r={c.r * r * 3.2} fill="#FFFFFF" opacity={0.06} />
              <Circle cx={r + c.x * r} cy={r + c.y * r} r={c.r * r} fill="#FFFFFF" opacity={0.55} />
            </G>
          ))
        : null}
      <Circle cx={r} cy={r} r={r} fill={`url(#${id}limb)`} />
    </>
  );

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        transform: [{ rotate: southern ? '180deg' : '0deg' }],
        boxShadow: glow ? `0 0 ${Math.round(size * 0.32 * illum + 4)}px rgba(214,222,255,${0.1 + illum * 0.3})` : undefined,
      }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}lit`} cx="46%" cy="44%" r="62%">
            <Stop offset="0" stopColor="#F7F5EE" />
            <Stop offset="0.75" stopColor="#E2E0D8" />
            <Stop offset="1" stopColor="#C9C7C2" />
          </RadialGradient>
          <RadialGradient id={`${id}limb`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.7" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#1A1C2E" stopOpacity={0.35} />
          </RadialGradient>
          <RadialGradient id={`${id}dark`} cx="50%" cy="50%" r="55%">
            <Stop offset="0" stopColor="#20243F" />
            <Stop offset="1" stopColor="#12152D" />
          </RadialGradient>
          <RadialGradient id={`${id}mare`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#74768A" stopOpacity={0.42} />
            <Stop offset="0.65" stopColor="#7E8092" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#8A8C9A" stopOpacity={0.04} />
          </RadialGradient>
          {steps.map((d, i) => (
            <ClipPath key={i} id={`${id}lit${i}`}>
              <Path d={d} />
            </ClipPath>
          ))}
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id}dark)`} />
        {earthshine ? (
          <G opacity={0.07}>
            {terrain.maria.map((d, i) => (
              <Path key={i} d={d} fill="#05061A" />
            ))}
          </G>
        ) : null}
        {(detailed ? steps : steps.slice(-1)).map((_, j) => {
          const i = detailed ? j : steps.length - 1;
          return (
            <G key={i} clipPath={`url(#${id}lit${i})`} opacity={detailed ? stepOpacity[i] : 1}>
              {surface}
            </G>
          );
        })}
      </Svg>
    </View>
  );
});
