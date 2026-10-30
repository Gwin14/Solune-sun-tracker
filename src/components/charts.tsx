import { memo, useEffect, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withDelay } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { MONTHS_SHORT } from '@/astro/format';
import { SNAP } from '@/theme/motion';
import { colors, font, radius } from '@/theme/tokens';

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))] as const;
}

function phaseColor(alt: number) {
  if (alt >= 6) return colors.day;
  if (alt >= -4) return colors.golden;
  if (alt >= -6) return colors.blue;
  if (alt >= -12) return colors.civil;
  if (alt >= -18) return colors.nautical;
  return colors.night;
}

/** 24-hour strip of light phases with a now marker. */
export const LightTimeline = memo(function LightTimeline({ sunAlt, nowMinute }: { sunAlt: number[]; nowMinute: number }) {
  const [width, onLayout] = useWidth();
  const segments = useMemo(() => {
    const out: { from: number; to: number; color: string }[] = [];
    for (let i = 0; i < sunAlt.length - 1; i++) {
      const color = phaseColor((sunAlt[i] + sunAlt[i + 1]) / 2);
      const last = out[out.length - 1];
      if (last && last.color === color) last.to = i + 1;
      else out.push({ from: i, to: i + 1, color });
    }
    return out;
  }, [sunAlt]);
  const n = sunAlt.length - 1;
  const h = 18;
  return (
    <View onLayout={onLayout} style={{ height: h + 14 }}>
      {width ? (
        <Svg width={width} height={h + 14}>
          <Defs>
            <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <G>
            {segments.map((s, i) => (
              <Rect key={i} x={(s.from / n) * width} y={4} width={((s.to - s.from) / n) * width + 0.5} height={h} fill={s.color} />
            ))}
          </G>
          <Rect x={0} y={4} width={width} height={h / 2} fill="url(#sheen)" />
          <Rect x={(nowMinute / 1440) * width - 1.5} y={0} width={3} height={h + 8} rx={1.5} fill="#FFFFFF" />
        </Svg>
      ) : null}
    </View>
  );
});

export function LegendDot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export const PHASE_LEGEND = [
  { color: colors.day, label: 'Dia' },
  { color: colors.golden, label: 'Dourada' },
  { color: colors.blue, label: 'Azul' },
  { color: colors.civil, label: 'Náutico' },
  { color: colors.nautical, label: 'Astronômico' },
  { color: colors.night, label: 'Noite' },
];

/** Day length across the year with a marker for today. */
export const DaylightChart = memo(function DaylightChart({
  data,
  todayT,
}: {
  data: { t: number; minutes: number }[];
  todayT: number;
}) {
  const [width, onLayout] = useWidth();
  const height = 120;
  const geo = useMemo(() => {
    if (!width || data.length < 2) return null;
    const minM = Math.min(...data.map((d) => d.minutes));
    const maxM = Math.max(...data.map((d) => d.minutes));
    const lo = Math.max(0, minM - 40);
    const hi = Math.min(1440, maxM + 40);
    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const x = (t: number) => ((t - t0) / (t1 - t0)) * width;
    const y = (m: number) => 10 + (1 - (m - lo) / Math.max(1, hi - lo)) * (height - 34);
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d.minutes).toFixed(1)}`).join(' ');
    // interpolate today's value
    let tm = data[0].minutes;
    for (let i = 0; i < data.length - 1; i++) {
      if (todayT >= data[i].t && todayT <= data[i + 1].t) {
        const f = (todayT - data[i].t) / (data[i + 1].t - data[i].t);
        tm = data[i].minutes * (1 - f) + data[i + 1].minutes * f;
      }
    }
    return { line, area: `${line} L${width},${height - 22} L0,${height - 22} Z`, tx: x(todayT), ty: y(tm), x, t0 };
  }, [width, data, todayT]);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {geo ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="dl" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geo.area} fill="url(#dl)" />
          <Path d={geo.line} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
          <Line x1={geo.tx} x2={geo.tx} y1={6} y2={height - 22} stroke="#FFFFFF" strokeOpacity={0.35} strokeDasharray="3 4" />
          <Circle cx={geo.tx} cy={geo.ty} r={5} fill="#FFFFFF" stroke={colors.accent} strokeWidth={2} />
          {MONTHS_SHORT.map((m, i) => {
            const d = new Date(geo.t0);
            const t = Date.UTC(d.getUTCFullYear(), i, 15);
            if (i % 2) return null;
            return (
              <SvgText key={m} x={geo.x(t)} y={height - 6} fontSize={10} fontFamily={font.semibold} fill="rgba(255,255,255,0.5)" textAnchor="middle">
                {m}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
});

/** Compass rose with the sun and moon bearings and today's rise/set bearings. */
export const CompassDial = memo(function CompassDial({
  size,
  sunAz,
  sunAlt,
  moonAz,
  moonAlt,
  riseAz,
  setAz,
}: {
  size: number;
  sunAz: number;
  sunAlt: number;
  moonAz: number;
  moonAlt: number;
  riseAz: number | null;
  setAz: number | null;
}) {
  const r = size / 2;
  const ring = r - 14;
  const pt = (az: number, rr: number) => {
    const a = ((az - 90) * Math.PI) / 180;
    return { x: r + Math.cos(a) * rr, y: r + Math.sin(a) * rr };
  };
  const sun = pt(sunAz, ring);
  const moon = pt(moonAz, ring - 16);
  const labels: [string, number][] = [
    ['N', 0],
    ['L', 90],
    ['S', 180],
    ['O', 270],
  ];
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={ring} stroke="rgba(255,255,255,0.18)" strokeWidth={1} fill="rgba(255,255,255,0.03)" />
      {Array.from({ length: 72 }, (_, i) => {
        const a = i * 5;
        const p1 = pt(a, ring);
        const p2 = pt(a, ring - (i % 18 === 0 ? 9 : i % 2 === 0 ? 5 : 3));
        return <Line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#FFFFFF" strokeOpacity={i % 18 === 0 ? 0.8 : 0.25} strokeWidth={1} />;
      })}
      {labels.map(([l, a]) => {
        const p = pt(a, ring + 9);
        return (
          <SvgText key={l} x={p.x} y={p.y + 4} fontSize={11} fontFamily={font.bold} fill={l === 'N' ? colors.accent : 'rgba(255,255,255,0.7)'} textAnchor="middle">
            {l}
          </SvgText>
        );
      })}
      {riseAz != null && setAz != null ? (
        <G>
          <Line x1={r} y1={r} x2={pt(riseAz, ring - 2).x} y2={pt(riseAz, ring - 2).y} stroke={colors.golden} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="2 4" />
          <Line x1={r} y1={r} x2={pt(setAz, ring - 2).x} y2={pt(setAz, ring - 2).y} stroke={colors.golden} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="2 4" />
        </G>
      ) : null}
      <Line x1={r} y1={r} x2={sun.x} y2={sun.y} stroke={colors.accent} strokeWidth={2} strokeOpacity={sunAlt > 0 ? 0.9 : 0.35} />
      <Circle cx={r} cy={r} r={3} fill="#FFFFFF" />
      <Circle cx={moon.x} cy={moon.y} r={5} fill={colors.moon} opacity={moonAlt > 0 ? 1 : 0.35} />
      <Circle cx={sun.x} cy={sun.y} r={8} fill={colors.accent} opacity={sunAlt > 0 ? 1 : 0.4} stroke="#FFF3D6" strokeWidth={2} />
    </Svg>
  );
});

/** Chunky Duolingo-style progress bar with a highlight stripe; animates on change. */
export function ProgressBar({ value, color = colors.accent, height = 14, delay = 0 }: { value: number; color?: string; height?: number; delay?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(delay, withSpring(Math.max(0, Math.min(1, value)), SNAP)));
  }, [value, delay, v]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(v.get() * 100, v.get() > 0 ? 6 : 0)}%` }));
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: color }, fill]}>
        <View style={{ position: 'absolute', left: height / 2, right: height / 2, top: height * 0.22, height: Math.max(2, height * 0.22), borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />
      </Animated.View>
    </View>
  );
}
