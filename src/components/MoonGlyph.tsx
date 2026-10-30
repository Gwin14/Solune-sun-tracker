import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

/** Approximate near-side maria, in unit-disc coordinates (northern-hemisphere view). */
const MARIA = [
  { x: -0.34, y: -0.34, r: 0.27 },
  { x: 0.13, y: -0.4, r: 0.17 },
  { x: 0.3, y: -0.1, r: 0.2 },
  { x: 0.62, y: -0.3, r: 0.11 },
  { x: 0.5, y: 0.14, r: 0.14 },
  { x: 0.3, y: 0.27, r: 0.1 },
  { x: -0.56, y: 0.02, r: 0.32 },
  { x: -0.2, y: 0.38, r: 0.15 },
  { x: -0.47, y: 0.42, r: 0.09 },
];

const CRATERS = [
  { x: -0.1, y: 0.7, r: 0.045 },
  { x: -0.42, y: -0.08, r: 0.03 },
  { x: 0.05, y: 0.55, r: 0.03 },
  { x: 0.7, y: 0.45, r: 0.035 },
  { x: -0.7, y: -0.45, r: 0.03 },
];

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
  const lit = moonLitPath(r, r, r * 0.999, angle);
  const illum = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
  const id = `m${Math.round(size)}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        transform: [{ rotate: southern ? '180deg' : '0deg' }],
        boxShadow: glow ? `0 0 ${Math.round(size * 0.35 * illum + 4)}px rgba(214,222,255,${0.12 + illum * 0.35})` : undefined,
      }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}lit`} cx="42%" cy="40%" r="65%">
            <Stop offset="0" stopColor="#FBFAF4" />
            <Stop offset="0.7" stopColor="#E3E2DA" />
            <Stop offset="1" stopColor="#BFBFC0" />
          </RadialGradient>
          <RadialGradient id={`${id}dark`} cx="50%" cy="50%" r="55%">
            <Stop offset="0" stopColor="#262B4C" />
            <Stop offset="1" stopColor="#151935" />
          </RadialGradient>
          <RadialGradient id={`${id}mare`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#7E808E" stopOpacity={0.5} />
            <Stop offset="0.7" stopColor="#8A8C98" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#8A8C98" stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={`${id}clip`}>
            <Path d={lit} />
          </ClipPath>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id}dark)`} />
        {earthshine ? (
          <G opacity={0.1}>
            {MARIA.map((m, i) => (
              <Circle key={i} cx={r + m.x * r} cy={r + m.y * r} r={m.r * r} fill="#0B0E22" />
            ))}
          </G>
        ) : null}
        <G clipPath={`url(#${id}clip)`}>
          <Circle cx={r} cy={r} r={r} fill={`url(#${id}lit)`} />
          {MARIA.map((m, i) => (
            <Circle key={i} cx={r + m.x * r} cy={r + m.y * r} r={m.r * r * 1.15} fill={`url(#${id}mare)`} />
          ))}
          {CRATERS.map((c, i) => (
            <Circle key={`c${i}`} cx={r + c.x * r} cy={r + c.y * r} r={c.r * r} fill="#FFFFFF" opacity={0.35} />
          ))}
        </G>
      </Svg>
    </View>
  );
});
