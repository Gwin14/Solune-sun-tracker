import { LinearGradient as ViewGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { formatMinuteOfDay } from '@/astro/format';
import { PATH_STEP_MIN } from '@/astro/sun';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useLaunch } from '@/store/launch';
import { EASE_OUT } from '@/theme/motion';
import { colors, radius, space, weight } from '@/theme/tokens';

import { AnimatedText } from './AnimatedText';
import { MoonGlyph } from './MoonGlyph';
import { PressableScale } from './Pressable';
import { SunGlyph } from './SunGlyph';
import { Text } from './Text';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export const ARC_HEIGHT = 196;
const PAD_TOP = 22;
const HORIZON = 0.62;
const LABEL_BAND = 30;

export type ArcEvent = { minute: number; label: string; kind: 'rise' | 'set' | 'noon' | 'tick' };

type Props = {
  sunAlt: number[];
  moonAlt: number[];
  nowMinute: number;
  scrub: SharedValue<number>;
  events: ArcEvent[];
  use24h: boolean;
  moonAngle: number;
  southern: boolean;
};

export function altitudeAt(arr: number[], minute: number): number {
  'worklet';
  const f = Math.max(0, Math.min(arr.length - 1.0001, minute / PATH_STEP_MIN));
  const i = Math.floor(f);
  const t = f - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}

const PHASE_FLOORS = [6, -4, -6, -12, -18];

/** `labels` holds one name per floor plus night, already in the active language. */
function phaseLabel(alt: number, labels: string[]): string {
  'worklet';
  for (let i = 0; i < PHASE_FLOORS.length; i++) if (alt >= PHASE_FLOORS[i]) return labels[i];
  return labels[PHASE_FLOORS.length];
}

/** Background wash for a solar altitude: deep night → twilight violet → dawn amber → daylight. */
function washFor(alt: number): { color: string; opacity: number } {
  if (alt >= 6) return { color: '#CFE3F7', opacity: 0.06 };
  if (alt >= -4) return { color: colors.golden, opacity: 0.1 };
  if (alt >= -6) return { color: colors.blue, opacity: 0.08 };
  if (alt >= -12) return { color: '#0A0E2E', opacity: 0.1 };
  if (alt >= -18) return { color: '#050820', opacity: 0.14 };
  return { color: '#02040F', opacity: 0.18 };
}

export const SunArc = memo(function SunArc({ sunAlt, moonAlt, nowMinute, scrub, events, use24h, moonAngle, southern }: Props) {
  const [width, setWidth] = useState(0);
  const reduce = useReducedMotion();
  const height = ARC_HEIGHT;
  const plotBottom = height - LABEL_BAND;
  const horizonY = plotBottom * HORIZON + 6;
  const maxAlt = Math.max(30, ...sunAlt, ...moonAlt);
  const k = (horizonY - PAD_TOP) / maxAlt;
  const belowRoom = plotBottom - horizonY - 4;

  const geo = useMemo(() => {
    if (!width) return null;
    const y = (alt: number) => horizonY - (alt >= 0 ? alt * k : Math.max(alt * k * 0.55, -belowRoom));
    const x = (i: number) => ((i * PATH_STEP_MIN) / 1440) * width;
    const line = (arr: number[]) => arr.map((a, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ');
    const sun = line(sunAlt);
    // Golden-hour stretches of the curve (−4° to 6°) get a warm overlay.
    const golden: string[] = [];
    let seg = '';
    sunAlt.forEach((a, i) => {
      const inside = a >= -4 && a <= 6;
      if (inside) seg += `${seg ? 'L' : 'M'}${x(i).toFixed(1)},${y(a).toFixed(1)}`;
      else if (seg) {
        golden.push(seg);
        seg = '';
      }
    });
    if (seg) golden.push(seg);
    // Horizontal light wash sampled every 30 minutes.
    const wash = Array.from({ length: 49 }, (_, j) => {
      const a = altitudeAt(sunAlt, j * 30);
      return { offset: j / 48, ...washFor(a) };
    });
    // Warm white at the highest point, amber at the horizon crossings.
    const peakIdx = sunAlt.indexOf(Math.max(...sunAlt));
    return {
      sun,
      fill: `${sun} L${width},${horizonY} L0,${horizonY} Z`,
      moon: line(moonAlt),
      golden,
      wash,
      peak: { x: x(peakIdx), y: y(sunAlt[peakIdx]) },
      y,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, sunAlt, moonAlt]);

  const eventMinutes = useMemo(() => events.map((e) => e.minute), [events]);
  const lastMinute = useSharedValue(nowMinute);
  const scrubbing = useSharedValue(0);
  const reveal = useSharedValue(reduce ? 1 : 0);

  // Draw the day once its card has arrived on screen.
  const focused = useIsFocused();
  const revealed = useLaunch((st) => st.revealed);
  useEffect(() => {
    if (!width || reduce || !focused || !revealed || reveal.get() > 0) return;
    reveal.set(withDelay(620, withTiming(1, { duration: 1200, easing: EASE_OUT })));
  }, [width, reduce, focused, revealed, reveal]);

  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      scrubbing.set(withTiming(1, { duration: 160 }));
      lastMinute.set(scrub.get());
      scrub.set(Math.max(0, Math.min(1439, (e.x / Math.max(1, width)) * 1440)));
    },
    onUpdate: (e) => {
      'worklet';
      const m = Math.max(0, Math.min(1439, (e.x / Math.max(1, width)) * 1440));
      const prev = lastMinute.get();
      for (let i = 0; i < eventMinutes.length; i++) {
        const em = eventMinutes[i];
        if ((prev < em && m >= em) || (prev > em && m <= em)) {
          scheduleOnRN(haptic.tick);
          break;
        }
      }
      lastMinute.set(m);
      scrub.set(m);
    },
    onDeactivate: () => {
      'worklet';
      scrubbing.set(withTiming(0, { duration: 260 }));
    },
  });

  const resetToNow = () => {
    scrub.set(withTiming(nowMinute, { duration: 620, easing: EASE_OUT }));
  };

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      scheduleOnRN(resetToNow);
    },
  });

  const gesture = useCompetingGestures(pan, doubleTap);

  // Clip rectangles: the draw-on reveal, and the past/future split at the cursor.
  const revealProps = useAnimatedProps(() => ({ width: reveal.get() * width }));
  const pastProps = useAnimatedProps(() => ({ width: Math.min(reveal.get() * width, (scrub.get() / 1440) * width) }));
  const futureProps = useAnimatedProps(() => {
    const cx = (scrub.get() / 1440) * width;
    return { x: cx, width: Math.max(0, reveal.get() * width - cx) };
  });

  const markerY = (a: number) => {
    'worklet';
    return horizonY - (a >= 0 ? a * k : Math.max(a * k * 0.55, -belowRoom));
  };

  const sunMarker = useAnimatedStyle(() => {
    const m = scrub.get();
    const a = altitudeAt(sunAlt, m);
    const x = (m / 1440) * width;
    const shown = Math.max(0, Math.min(1, (reveal.get() - 0.7) / 0.3));
    return {
      opacity: shown * (a < -1 ? 0.45 : 1),
      transform: [{ translateX: x - 16 }, { translateY: markerY(a) - 16 }, { scale: (0.6 + shown * 0.4) * (1 + scrubbing.get() * 0.12) }],
    };
  });
  const haloStyle = useAnimatedStyle(() => {
    const a = altitudeAt(sunAlt, scrub.get());
    return { opacity: (a > -1 ? 0.55 : 0.15) * (0.6 + scrubbing.get() * 0.4), transform: [{ scale: 1 + scrubbing.get() * 0.35 }] };
  });
  const moonMarker = useAnimatedStyle(() => {
    const m = scrub.get();
    const a = altitudeAt(moonAlt, m);
    const x = (m / 1440) * width;
    const shown = Math.max(0, Math.min(1, (reveal.get() - 0.7) / 0.3));
    return { opacity: a < 0 ? 0 : shown, transform: [{ translateX: x - 9 }, { translateY: markerY(a) - 9 }] };
  });
  const cursor = useAnimatedStyle(() => ({
    opacity: (0.35 + scrubbing.get() * 0.65) * Math.min(1, reveal.get() * 1.5),
    transform: [{ translateX: (scrub.get() / 1440) * width - 12 }],
  }));

  const readout = useDerivedValue(() => formatMinuteOfDay(scrub.get(), use24h));
  const tx = useT();
  // Worklets can only read plain values, so the phrases are resolved here.
  const phaseLabels = [tx.sun.phase.day, tx.sun.phase.golden, tx.sun.phase.blue, tx.sun.phase.nautical, tx.sun.phase.astronomical, tx.sun.phase.night];
  const sunAbove = tx.sunArc.sunAbove;
  const sunBelow = tx.sunArc.sunBelow;
  const readoutSub = useDerivedValue(() => {
    const a = altitudeAt(sunAlt, scrub.get());
    const deg = String(Math.round(Math.abs(a)));
    return `${phaseLabel(a, phaseLabels)} · ${(a >= 0 ? sunAbove : sunBelow).replace('{deg}', deg)}`;
  });

  const [offNow, setOffNow] = useState(false);
  useAnimatedReaction(
    () => Math.abs(scrub.get() - nowMinute) > 4,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setOffNow, v);
    },
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const xFor = (minute: number) => (minute / 1440) * width;
  const rise = events.find((e) => e.kind === 'rise');
  const set = events.find((e) => e.kind === 'set');
  const noon = events.find((e) => e.kind === 'noon');
  const ticks = events.filter((e) => e.kind === 'tick');

  return (
    <View>
      <View style={styles.readoutRow}>
        <View style={{ flex: 1 }}>
          <AnimatedText text={readout} variant="metric" />
          <AnimatedText text={readoutSub} variant="footnote" color={colors.textSecondary} />
        </View>
        {offNow ? (
          <PressableScale onPress={resetToNow} style={styles.nowPill} hapticOnPress="soft">
            <Text variant="label" color={colors.onPrimary}>
              {tx.common.now}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout} style={{ height }} accessibilityLabel={tx.sunArc.a11y}>
          {width > 0 && geo ? (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
                  {geo.wash.map((w, i) => (
                    <Stop key={i} offset={w.offset} stopColor={w.color} stopOpacity={w.opacity} />
                  ))}
                </LinearGradient>
                <LinearGradient id="washFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0.22} />
                </LinearGradient>
                <LinearGradient id="sunStroke" gradientUnits="userSpaceOnUse" x1={0} y1={geo.peak.y} x2={0} y2={horizonY}>
                  <Stop offset="0" stopColor="#FFF4DE" />
                  <Stop offset="0.55" stopColor="#FFD08A" />
                  <Stop offset="1" stopColor={colors.golden} />
                </LinearGradient>
                <LinearGradient id="sunFill" gradientUnits="userSpaceOnUse" x1={0} y1={geo.peak.y} x2={0} y2={horizonY}>
                  <Stop offset="0" stopColor="#FFE2B0" stopOpacity={0.32} />
                  <Stop offset="1" stopColor={colors.golden} stopOpacity={0.02} />
                </LinearGradient>
                <LinearGradient id="horizon" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.15" stopColor="#FFFFFF" stopOpacity={0.4} />
                  <Stop offset="0.85" stopColor="#FFFFFF" stopOpacity={0.4} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
                <ClipPath id="reveal">
                  <AnimatedRect x={0} y={0} height={height} animatedProps={revealProps} />
                </ClipPath>
                <ClipPath id="past">
                  <AnimatedRect x={0} y={0} height={horizonY} animatedProps={pastProps} />
                </ClipPath>
                <ClipPath id="future">
                  <AnimatedRect y={0} height={horizonY} animatedProps={futureProps} />
                </ClipPath>
                <ClipPath id="below">
                  <Rect x={0} y={horizonY} width={width} height={plotBottom - horizonY} />
                </ClipPath>
                <ClipPath id="above">
                  <Rect x={0} y={0} width={width} height={horizonY} />
                </ClipPath>
              </Defs>

              {/* Continuous light of the day behind everything */}
              <Rect x={0} y={0} width={width} height={plotBottom} rx={radius.tile} fill="url(#wash)" />
              <Rect x={0} y={horizonY} width={width} height={plotBottom - horizonY} fill="url(#washFade)" />

              {/* Three-hour grid */}
              {[3, 6, 9, 12, 15, 18, 21].map((h) => (
                <Line
                  key={h}
                  x1={xFor(h * 60)}
                  x2={xFor(h * 60)}
                  y1={PAD_TOP - 8}
                  y2={plotBottom}
                  stroke="#FFFFFF"
                  strokeOpacity={h % 6 === 0 ? 0.07 : 0.035}
                  strokeWidth={StyleSheet.hairlineWidth * 2}
                />
              ))}

              <G clipPath="url(#reveal)">
                {/* Moon, quiet, only where it is up */}
                <G clipPath="url(#above)">
                  <Path d={geo.moon} stroke={colors.moon} strokeOpacity={0.32} strokeWidth={1} strokeDasharray="1 4" fill="none" strokeLinecap="round" />
                </G>

                {/* Sun: the past is lit, the future is a promise */}
                <G clipPath="url(#past)">
                  <Path d={geo.fill} fill="url(#sunFill)" />
                  <Path d={geo.sun} stroke="url(#sunStroke)" strokeWidth={2.25} fill="none" strokeLinecap="round" />
                </G>
                <G clipPath="url(#future)">
                  <Path d={geo.fill} fill="url(#sunFill)" opacity={0.35} />
                  <Path d={geo.sun} stroke="url(#sunStroke)" strokeOpacity={0.5} strokeWidth={1.5} fill="none" strokeLinecap="round" />
                </G>
                {geo.golden.map((d, i) => (
                  <Path key={i} d={d} stroke={colors.golden} strokeOpacity={0.35} strokeWidth={6} fill="none" strokeLinecap="round" />
                ))}
                <G clipPath="url(#below)">
                  <Path d={geo.sun} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.25} fill="none" />
                </G>

                {/* Solar noon: drop line from the peak */}
                {noon ? (
                  <G>
                    <Line x1={geo.peak.x} x2={geo.peak.x} y1={geo.peak.y + 6} y2={horizonY} stroke="#FFFFFF" strokeOpacity={0.18} strokeDasharray="1.5 4" />
                    <SvgText x={geo.peak.x} y={geo.peak.y - 10} fontSize={10} fontWeight={weight.semibold} fill="rgba(255,255,255,0.6)" textAnchor="middle">
                      {noon.label}
                    </SvgText>
                  </G>
                ) : null}
              </G>

              <Rect x={0} y={horizonY - 0.5} width={width} height={1} fill="url(#horizon)" />

              {/* Rise / set annotations under the horizon */}
              {[rise, set].map((e) =>
                e ? (
                  <G key={e.kind}>
                    <Circle cx={xFor(e.minute)} cy={horizonY} r={2.5} fill={colors.golden} />
                    <SvgText
                      x={Math.min(width - 18, Math.max(18, xFor(e.minute)))}
                      y={horizonY + 16}
                      fontSize={10}
                      fontWeight={weight.semibold}
                      fill="rgba(255,255,255,0.7)"
                      textAnchor="middle">
                      {e.label}
                    </SvgText>
                  </G>
                ) : null,
              )}
              {ticks.map((e) => (
                <Rect key={e.minute} x={xFor(e.minute) - 0.5} y={horizonY - 3} width={1} height={6} fill="#FFFFFF" opacity={0.45} />
              ))}

              {/* Hour scale */}
              {[0, 6, 12, 18, 24].map((h) => (
                <SvgText
                  key={h}
                  x={Math.min(width - 1, Math.max(1, xFor(h * 60)))}
                  y={height - 8}
                  fontSize={10}
                  fontWeight={weight.medium}
                  fill="rgba(255,255,255,0.38)"
                  textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}>
                  {String(h).padStart(2, '0')}
                </SvgText>
              ))}
            </Svg>
          ) : null}

          <Animated.View pointerEvents="none" style={[styles.cursor, { top: PAD_TOP - 10, height: plotBottom - PAD_TOP + 10 }, cursor]}>
            <ViewGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']} style={styles.cursorLine} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.marker18, moonMarker]}>
            <MoonGlyph size={18} angle={moonAngle} southern={southern} glow={false} earthshine={false} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.marker32, sunMarker]}>
            <Animated.View style={[styles.halo, haloStyle]} />
            <SunGlyph size={20} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  readoutRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.sm, minHeight: 58 },
  nowPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    marginTop: space.xxs,
  },
  cursor: { position: 'absolute', left: 0, width: 24, alignItems: 'center' },
  cursorLine: { width: 1, flex: 1 },
  marker32: { position: 'absolute', left: 0, top: 0, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  marker18: { position: 'absolute', left: 0, top: 0, width: 18, height: 18 },
  halo: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,214,150,0.35)' },
});
