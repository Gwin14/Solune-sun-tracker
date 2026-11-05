import { memo, useEffect, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { localized, strings } from '@/i18n';
import { SNAP } from '@/theme/motion';
import { colors, weight, radius } from '@/theme/tokens';

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))] as const;
}

/** Continuous sky colour for a solar altitude, used by the light strip. */
function skyColor(alt: number) {
  if (alt >= 12) return '#8DBBEA';
  if (alt >= 6) return '#A9C9E8';
  if (alt >= 0) return '#F2B477';
  if (alt >= -4) return '#D9837A';
  if (alt >= -6) return '#6D79D8';
  if (alt >= -12) return '#3A3A8E';
  if (alt >= -18) return '#1D1F55';
  return '#0B0D2A';
}

/** Catmull-Rom through the points, emitted as cubic Béziers. */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export type TimelineMark = { minute: number; label: string };

/** The day's light as one continuous strip, with event times underneath and a now marker. */
export const LightTimeline = memo(function LightTimeline({ sunAlt, nowMinute, marks = [] }: { sunAlt: number[]; nowMinute: number; marks?: TimelineMark[] }) {
  const [width, onLayout] = useWidth();
  const stops = useMemo(
    () =>
      Array.from({ length: 97 }, (_, j) => {
        const f = j / 96;
        const i = Math.min(sunAlt.length - 1, Math.round(f * (sunAlt.length - 1)));
        return { offset: f, color: skyColor(sunAlt[i]) };
      }),
    [sunAlt],
  );
  const h = 12;
  const top = 6;
  const total = marks.length ? 44 : 28;
  const nx = (nowMinute / 1440) * width;
  return (
    <View onLayout={onLayout} style={{ height: total }}>
      {width ? (
        <Svg width={width} height={total}>
          <Defs>
            <LinearGradient id="lightStrip" x1="0" y1="0" x2="1" y2="0">
              {stops.map((s, i) => (
                <Stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </LinearGradient>
            <LinearGradient id="stripSheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.12} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={top} width={width} height={h} rx={h / 2} fill="url(#lightStrip)" />
          <Rect x={0} y={top} width={width} height={h} rx={h / 2} fill="url(#stripSheen)" />
          <Rect x={0.5} y={top + 0.5} width={width - 1} height={h - 1} rx={(h - 1) / 2} fill="none" stroke="#FFFFFF" strokeOpacity={0.12} />
          {marks.map((m) => {
            const x = (m.minute / 1440) * width;
            return (
              <G key={m.minute}>
                <Line x1={x} x2={x} y1={top + h + 3} y2={top + h + (m.label ? 7 : 5)} stroke="#FFFFFF" strokeOpacity={m.label ? 0.45 : 0.25} />
                {m.label ? <SvgText
                  x={Math.min(width - 16, Math.max(16, x))}
                  y={top + h + 21}
                  fontSize={10}
                  fontWeight={weight.medium}
                  fill="rgba(255,255,255,0.55)"
                  textAnchor="middle">
                  {m.label}
                </SvgText> : null}
              </G>
            );
          })}
          <Circle cx={nx} cy={top + h / 2} r={9} fill="#FFFFFF" opacity={0.18} />
          <Circle cx={nx} cy={top + h / 2} r={5.5} fill="#FFFFFF" stroke={colors.ink} strokeWidth={2} />
        </Svg>
      ) : null}
    </View>
  );
});

export function LegendDot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

const LEGEND_LABELS = localized((s) => s.charts.legend);

export const PHASE_LEGEND = [
  { color: skyColor(20), get label() { return LEGEND_LABELS[0]; } },
  { color: skyColor(2), get label() { return LEGEND_LABELS[1]; } },
  { color: skyColor(-5), get label() { return LEGEND_LABELS[2]; } },
  { color: skyColor(-12.5), get label() { return LEGEND_LABELS[3]; } },
  { color: skyColor(-30), get label() { return LEGEND_LABELS[4]; } },
];

const MONTH_INITIALS = localized((s) => s.calendar.monthsLetter);

/** Day length across the year: smooth curve, 12-hour reference, solstices and today annotated. */
export const DaylightChart = memo(function DaylightChart({
  data,
  todayT,
  format,
}: {
  data: { t: number; minutes: number }[];
  todayT: number;
  format: (minutes: number) => string;
}) {
  const [width, onLayout] = useWidth();
  const height = 150;
  const top = 24;
  const bottom = height - 22;
  const geo = useMemo(() => {
    if (!width || data.length < 2) return null;
    const minM = Math.min(...data.map((d) => d.minutes));
    const maxM = Math.max(...data.map((d) => d.minutes));
    const lo = Math.max(0, Math.min(minM, 720) - 50);
    const hi = Math.min(1440, Math.max(maxM, 720) + 50);
    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const x = (t: number) => ((t - t0) / (t1 - t0)) * width;
    const y = (m: number) => top + (1 - (m - lo) / Math.max(1, hi - lo)) * (bottom - top);
    const pts = data.map((d) => ({ x: x(d.t), y: y(d.minutes) }));
    const line = smoothPath(pts);
    let tm = data[0].minutes;
    for (let i = 0; i < data.length - 1; i++) {
      if (todayT >= data[i].t && todayT <= data[i + 1].t) {
        const f = (todayT - data[i].t) / (data[i + 1].t - data[i].t);
        tm = data[i].minutes * (1 - f) + data[i + 1].minutes * f;
      }
    }
    const maxI = data.findIndex((d) => d.minutes === maxM);
    const minI = data.findIndex((d) => d.minutes === minM);
    return {
      line,
      area: `${line} L${width},${bottom} L0,${bottom} Z`,
      tx: x(todayT),
      ty: y(tm),
      tm,
      mid: y(720),
      max: { x: pts[maxI].x, y: pts[maxI].y, m: maxM },
      min: { x: pts[minI].x, y: pts[minI].y, m: minM },
      monthX: (i: number) => x(Date.UTC(new Date(t0).getUTCFullYear(), i, 15)),
      top: y(hi),
    };
  }, [width, data, todayT, bottom]);

  const pill = geo ? format(geo.tm) : '';
  const pillW = pill.length * 6.4 + 16;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {geo ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="dlStroke" gradientUnits="userSpaceOnUse" x1={0} y1={top} x2={0} y2={bottom}>
              <Stop offset="0" stopColor="#FFD9A0" />
              <Stop offset="1" stopColor="#8FA6F0" />
            </LinearGradient>
            <LinearGradient id="dlFill" gradientUnits="userSpaceOnUse" x1={0} y1={top} x2={0} y2={bottom}>
              <Stop offset="0" stopColor="#FFD9A0" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#8FA6F0" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {/* Equinox reference */}
          <Line x1={0} x2={width} y1={geo.mid} y2={geo.mid} stroke="#FFFFFF" strokeOpacity={0.14} strokeDasharray="2 5" />
          <SvgText x={width - 2} y={geo.mid - 5} fontSize={9} fontWeight={weight.medium} fill="rgba(255,255,255,0.4)" textAnchor="end">
            12 h
          </SvgText>
          <Path d={geo.area} fill="url(#dlFill)" />
          <Path d={geo.line} stroke="url(#dlStroke)" strokeWidth={2} fill="none" strokeLinecap="round" />

          {/* Solstices */}
          {[geo.max, geo.min].map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={2.5} fill="#FFFFFF" opacity={0.7} />
              <SvgText
                x={Math.min(width - 22, Math.max(22, p.x))}
                y={i === 0 ? p.y - 8 : p.y + 16}
                fontSize={10}
                fontWeight={weight.semibold}
                fill="rgba(255,255,255,0.6)"
                textAnchor="middle">
                {format(p.m)}
              </SvgText>
            </G>
          ))}

          {/* Today */}
          <Line x1={geo.tx} x2={geo.tx} y1={geo.ty + 8} y2={bottom} stroke="#FFFFFF" strokeOpacity={0.3} />
          <Circle cx={geo.tx} cy={geo.ty} r={9} fill="#FFFFFF" opacity={0.16} />
          <Circle cx={geo.tx} cy={geo.ty} r={4.5} fill="#FFFFFF" stroke={colors.ink} strokeWidth={1.5} />
          <Rect
            x={Math.min(width - pillW, Math.max(0, geo.tx - pillW / 2))}
            y={2}
            width={pillW}
            height={18}
            rx={9}
            fill="#FFFFFF"
          />
          <SvgText
            x={Math.min(width - pillW, Math.max(0, geo.tx - pillW / 2)) + pillW / 2}
            y={15}
            fontSize={10.5}
            fontWeight={weight.semibold}
            fill={colors.onPrimary}
            textAnchor="middle">
            {pill}
          </SvgText>

          {MONTH_INITIALS.map((m, i) => (
            <SvgText key={i} x={geo.monthX(i)} y={height - 6} fontSize={10} fontWeight={weight.medium} fill="rgba(255,255,255,0.4)" textAnchor="middle">
              {m}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
});

type Track = { az: number[]; alt: number[] };

/**
 * The sky as a map, north up and east right: horizon at the rim, zenith in the centre.
 * Today's sun and moon tracks are projected onto it with their current positions.
 */
export const SkyDome = memo(function SkyDome({
  size,
  sunPath,
  moonPath,
  sun,
  moon,
  riseAz,
  setAz,
}: {
  size: number;
  sunPath: Track;
  moonPath: Track;
  sun: { az: number; alt: number };
  moon: { az: number; alt: number };
  riseAz: number | null;
  setAz: number | null;
}) {
  const c = size / 2;
  const R = c - 16;
  const D2R = Math.PI / 180;
  const pt = (az: number, alt: number) => {
    const r = (R * (90 - Math.max(0, alt))) / 90;
    return { x: c + r * Math.sin(az * D2R), y: c - r * Math.cos(az * D2R) };
  };
  const track = (p: Track) => {
    const segs: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    p.alt.forEach((a, i) => {
      if (a >= 0) cur.push(pt(p.az[i], a));
      else if (cur.length) {
        segs.push(cur);
        cur = [];
      }
    });
    if (cur.length) segs.push(cur);
    return segs.filter((s) => s.length > 1).map(smoothPath);
  };
  const sunSegs = track(sunPath);
  const moonSegs = track(moonPath);
  const hours = Array.from({ length: 24 }, (_, h) => h)
    .map((h) => ({ h, i: Math.round((h * 60) / ((24 * 60) / (sunPath.alt.length - 1))) }))
    .filter(({ i }) => sunPath.alt[i] > 0)
    .map(({ h, i }) => ({ h, ...pt(sunPath.az[i], sunPath.alt[i]) }));
  const sunP = pt(sun.az, sun.alt);
  const moonP = pt(moon.az, moon.alt);
  const points = strings().compass.points;
  const cardinals: [string, number][] = [
    [points[0], 0],
    [points[4], 90],
    [points[8], 180],
    [points[12], 270],
  ];
  const rim = (az: number, rr: number) => ({ x: c + rr * Math.sin(az * D2R), y: c - rr * Math.cos(az * D2R) });

  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="domeFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.05} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.015} />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={R} fill="url(#domeFill)" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1} />
      {[30, 60].map((alt) => (
        <Circle key={alt} cx={c} cy={c} r={(R * (90 - alt)) / 90} fill="none" stroke="#FFFFFF" strokeOpacity={0.09} strokeDasharray="1.5 4" />
      ))}
      <Line x1={c - R} x2={c + R} y1={c} y2={c} stroke="#FFFFFF" strokeOpacity={0.05} />
      <Line x1={c} x2={c} y1={c - R} y2={c + R} stroke="#FFFFFF" strokeOpacity={0.05} />
      {Array.from({ length: 36 }, (_, i) => {
        const az = i * 10;
        const long = az % 90 === 0;
        const a = rim(az, R);
        const b = rim(az, R + (long ? 6 : 3));
        return <Line key={az} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#FFFFFF" strokeOpacity={long ? 0.6 : 0.22} strokeWidth={1} />;
      })}
      {cardinals.map(([l, az]) => {
        const p = rim(az, R + 12);
        return (
          <SvgText key={l} x={p.x} y={p.y + 3.5} fontSize={10} fontWeight={weight.semibold} fill={l === 'N' ? colors.accent : 'rgba(255,255,255,0.6)'} textAnchor="middle">
            {l}
          </SvgText>
        );
      })}
      {[riseAz, setAz].map((az, i) =>
        az == null ? null : <Circle key={i} cx={rim(az, R).x} cy={rim(az, R).y} r={2.5} fill={colors.golden} />,
      )}
      {moonSegs.map((d, i) => (
        <Path key={`m${i}`} d={d} stroke={colors.moon} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="1 3.5" fill="none" strokeLinecap="round" />
      ))}
      {sunSegs.map((d, i) => (
        <G key={`s${i}`}>
          <Path d={d} stroke={colors.golden} strokeOpacity={0.25} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d={d} stroke="#FFD9A0" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </G>
      ))}
      {hours.map((h) => (
        <Circle key={h.h} cx={h.x} cy={h.y} r={1.4} fill="#FFFFFF" opacity={0.65} />
      ))}
      <Circle cx={c} cy={c} r={1.5} fill="#FFFFFF" opacity={0.5} />
      {moon.alt > 0 ? <Circle cx={moonP.x} cy={moonP.y} r={4} fill={colors.moon} /> : null}
      {sun.alt > 0 ? (
        <G>
          <Circle cx={sunP.x} cy={sunP.y} r={11} fill="#FFD9A0" opacity={0.2} />
          <Circle cx={sunP.x} cy={sunP.y} r={5.5} fill="#FFE7BF" stroke={colors.golden} strokeWidth={1.5} />
        </G>
      ) : (
        <Circle cx={rim(sun.az, R).x} cy={rim(sun.az, R).y} r={4.5} fill={colors.ink} stroke={colors.golden} strokeWidth={1.5} />
      )}
    </Svg>
  );
});

/** Slim progress track that eases to its value on mount and on change. */
export function ProgressBar({ value, color = colors.accent, height = 4, delay = 0 }: { value: number; color?: string; height?: number; delay?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(delay, withSpring(Math.max(0, Math.min(1, value)), SNAP)));
  }, [value, delay, v]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: v.get() }] }));
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: colors.fillStrong, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: color, transformOrigin: 'left' }, fill]} />
    </View>
  );
}

/** Thin medallion ring that fills with progress; the badge icon sits in the middle. */
export function ProgressRing({ size, progress, color, track = colors.hairline, stroke = 1.5 }: { size: number; progress: number; color: string; track?: string; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {p > 0 ? (
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Illumination across ±15 days as a soft wave. New and full moons are marked,
 * today is a tick, and the selected day glides along the curve.
 */
export const LunarWave = memo(function LunarWave({ illum, offset, range }: { illum: number[]; offset: number; range: number }) {
  const [width, onLayout] = useWidth();
  const height = 72;
  const top = 12;
  const bottom = height - 18;
  const geo = useMemo(() => {
    if (!width) return null;
    const x = (i: number) => (i / (illum.length - 1)) * width;
    const y = (v: number) => bottom - v * (bottom - top);
    const pts = illum.map((v, i) => ({ x: x(i), y: y(v) }));
    const extremes: { i: number; full: boolean }[] = [];
    for (let i = 1; i < illum.length - 1; i++) {
      if (illum[i] >= illum[i - 1] && illum[i] > illum[i + 1] && illum[i] > 0.9) extremes.push({ i, full: true });
      if (illum[i] <= illum[i - 1] && illum[i] < illum[i + 1] && illum[i] < 0.1) extremes.push({ i, full: false });
    }
    return { line: smoothPath(pts), area: `${smoothPath(pts)} L${width},${bottom} L0,${bottom} Z`, pts, extremes, x };
  }, [width, illum, bottom]);

  const pos = useSharedValue(range + offset);
  useEffect(() => {
    pos.set(withSpring(range + offset, SNAP));
  }, [offset, range, pos]);
  const ys = useMemo(() => geo?.pts.map((p) => p.y) ?? [], [geo]);
  const dotProps = useAnimatedProps(() => {
    const f = Math.max(0, Math.min(ys.length - 1.001, pos.get()));
    const i = Math.floor(f);
    const t = f - i;
    const yv = ys.length ? ys[i] * (1 - t) + ys[i + 1] * t : 0;
    return { cx: (f / Math.max(1, ys.length - 1)) * width, cy: yv };
  });
  const haloProps = useAnimatedProps(() => {
    const f = Math.max(0, Math.min(ys.length - 1.001, pos.get()));
    const i = Math.floor(f);
    const t = f - i;
    const yv = ys.length ? ys[i] * (1 - t) + ys[i + 1] * t : 0;
    return { cx: (f / Math.max(1, ys.length - 1)) * width, cy: yv };
  });

  return (
    <View onLayout={onLayout} style={{ height, alignSelf: 'stretch' }}>
      {geo ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.moon} stopOpacity={0.2} />
              <Stop offset="1" stopColor={colors.moon} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={0} x2={width} y1={bottom} y2={bottom} stroke="#FFFFFF" strokeOpacity={0.1} />
          <Path d={geo.area} fill="url(#waveFill)" />
          <Path d={geo.line} stroke={colors.moon} strokeOpacity={0.7} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          {geo.extremes.map((e) => (
            <G key={e.i}>
              <Circle cx={geo.pts[e.i].x} cy={geo.pts[e.i].y} r={3.5} fill={e.full ? colors.moon : colors.ink} stroke={colors.moon} strokeWidth={1.2} />
              <SvgText x={geo.pts[e.i].x} y={height - 4} fontSize={9.5} fontWeight={weight.medium} fill="rgba(255,255,255,0.45)" textAnchor="middle">
                {e.full ? strings().widgets.moonFull : strings().widgets.moonNew}
              </SvgText>
            </G>
          ))}
          <Line x1={geo.x(range)} x2={geo.x(range)} y1={top - 6} y2={bottom} stroke="#FFFFFF" strokeOpacity={0.28} strokeDasharray="1.5 3" />
          <AnimatedCircle r={10} fill="#FFFFFF" opacity={0.15} animatedProps={haloProps} />
          <AnimatedCircle r={5} fill="#FFFFFF" stroke={colors.ink} strokeWidth={1.5} animatedProps={dotProps} />
        </Svg>
      ) : null}
    </View>
  );
});
