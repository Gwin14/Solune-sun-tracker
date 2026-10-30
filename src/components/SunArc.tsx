import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { formatMinuteOfDay } from '@/astro/format';
import { PATH_STEP_MIN } from '@/astro/sun';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/theme/motion';
import { colors, weight, radius, space } from '@/theme/tokens';

import { AnimatedText } from './AnimatedText';
import { MoonGlyph } from './MoonGlyph';
import { PressableScale } from './Pressable';
import { SunGlyph } from './SunGlyph';
import { Text } from './Text';

export const ARC_HEIGHT = 178;
const PAD_TOP = 18;
const HORIZON = 0.64;

export type ArcEvent = { minute: number; label: string };

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

const PHASES: [number, string][] = [
  [6, 'Luz do dia'],
  [-4, 'Hora dourada'],
  [-6, 'Hora azul'],
  [-12, 'Crepúsculo náutico'],
  [-18, 'Crepúsculo astronômico'],
];

function phaseLabel(alt: number): string {
  'worklet';
  for (let i = 0; i < PHASES.length; i++) if (alt >= PHASES[i][0]) return PHASES[i][1];
  return 'Noite';
}

export const SunArc = memo(function SunArc({ sunAlt, moonAlt, nowMinute, scrub, events, use24h, moonAngle, southern }: Props) {
  const [width, setWidth] = useState(0);
  const height = ARC_HEIGHT;
  const horizonY = height * HORIZON;
  const maxAlt = Math.max(30, ...sunAlt, ...moonAlt);
  const k = (horizonY - PAD_TOP) / maxAlt;
  // Below the horizon is compressed so deep night stays legible above the hour labels.
  const yFor = (alt: number) => horizonY - (alt >= 0 ? alt * k : Math.max(alt * k * 0.5, -(height - horizonY - 18)));

  const paths = useMemo(() => {
    if (!width) return { sun: '', moon: '', fill: '' };
    const toPath = (arr: number[]) =>
      arr.map((a, i) => `${i ? 'L' : 'M'}${((i * PATH_STEP_MIN) / 1440) * width},${yFor(a).toFixed(1)}`).join(' ');
    const sun = toPath(sunAlt);
    return { sun, moon: toPath(moonAlt), fill: `${sun} L${width},${horizonY} L0,${horizonY} Z` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, sunAlt, moonAlt]);

  const eventMinutes = useMemo(() => events.map((e) => e.minute), [events]);
  const lastMinute = useSharedValue(nowMinute);
  const scrubbing = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      scrubbing.set(withTiming(1, { duration: 140 }));
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
      scrubbing.set(withTiming(0, { duration: 220 }));
    },
  });

  const resetToNow = () => {
    scrub.set(withTiming(nowMinute, { duration: 520, easing: EASE_OUT }));
  };

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      scheduleOnRN(resetToNow);
    },
  });

  const gesture = useCompetingGestures(pan, doubleTap);

  const sunMarker = useAnimatedStyle(() => {
    const m = scrub.get();
    const a = altitudeAt(sunAlt, m);
    const x = (m / 1440) * width;
    const y = horizonY - (a >= 0 ? a * k : Math.max(a * k * 0.5, -(height - horizonY - 18)));
    return {
      opacity: a < -2 ? 0.55 : 1,
      transform: [{ translateX: x - 14 }, { translateY: y - 14 }, { scale: 1 + scrubbing.get() * 0.18 }],
    };
  });
  const moonMarker = useAnimatedStyle(() => {
    const m = scrub.get();
    const a = altitudeAt(moonAlt, m);
    const x = (m / 1440) * width;
    const y = horizonY - (a >= 0 ? a * k : Math.max(a * k * 0.5, -(height - horizonY - 18)));
    return { opacity: a < 0 ? 0 : 0.95, transform: [{ translateX: x - 8 }, { translateY: y - 8 }] };
  });
  const cursor = useAnimatedStyle(() => ({
    opacity: 0.25 + scrubbing.get() * 0.5,
    transform: [{ translateX: (scrub.get() / 1440) * width }],
  }));

  const readout = useDerivedValue(() => formatMinuteOfDay(scrub.get(), use24h));
  const readoutSub = useDerivedValue(() => {
    const a = altitudeAt(sunAlt, scrub.get());
    return `${phaseLabel(a)} · Sol a ${Math.round(a)}°`;
  });

  const [offNow, setOffNow] = useState(false);
  useAnimatedReaction(
    () => Math.abs(scrub.get() - nowMinute) > 4,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setOffNow, v);
    },
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

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
              Agora
            </Text>
          </PressableScale>
        ) : null}
      </View>
      <GestureDetector gesture={gesture}>
            <View onLayout={onLayout} style={{ height }} accessibilityLabel="Trajeto do sol hoje. Arraste para ver outros horários.">
              {width > 0 ? (
                <Svg width={width} height={height}>
                  <Defs>
                    <LinearGradient id="arcFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={colors.accent} stopOpacity={0.42} />
                      <Stop offset="1" stopColor={colors.accent} stopOpacity={0.02} />
                    </LinearGradient>
                    <ClipPath id="above">
                      <Rect x={0} y={0} width={width} height={horizonY} />
                    </ClipPath>
                    <ClipPath id="below">
                      <Rect x={0} y={horizonY} width={width} height={height - horizonY} />
                    </ClipPath>
                  </Defs>
                  <Rect x={0} y={horizonY} width={width} height={height - horizonY} fill="rgba(3,6,22,0.28)" rx={10} />
                  {[0.25, 0.5, 0.75].map((f) => (
                    <Line key={f} x1={f * width} x2={f * width} y1={PAD_TOP - 6} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                  ))}
                  <Path d={paths.moon} stroke={colors.moon} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" fill="none" />
                  <G clipPath="url(#above)">
                    <Path d={paths.fill} fill="url(#arcFill)" />
                    <Path d={paths.sun} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                  </G>
                  <G clipPath="url(#below)">
                    <Path d={paths.sun} stroke="rgba(255,255,255,0.28)" strokeWidth={2} fill="none" />
                  </G>
                  <Line x1={0} x2={width} y1={horizonY} y2={horizonY} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
                  {events.map((e) => (
                    <G key={e.label + e.minute}>
                      <Rect x={(e.minute / 1440) * width - 1} y={horizonY - 4} width={2} height={8} rx={1} fill={colors.text} opacity={0.8} />
                    </G>
                  ))}
                  {['0h', '6h', '12h', '18h', '24h'].map((l, i) => (
                    <SvgText
                      key={l}
                      x={Math.min(width - 2, Math.max(2, (i / 4) * width))}
                      y={height - 4}
                      fontSize={10}
                      fontWeight={weight.semibold}
                      fill="rgba(255,255,255,0.45)"
                      textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>
                      {l}
                    </SvgText>
                  ))}
                </Svg>
              ) : null}
              <Animated.View pointerEvents="none" style={[styles.cursor, { height: height - PAD_TOP + 6, top: PAD_TOP - 6 }, cursor]} />
              <Animated.View pointerEvents="none" style={[styles.marker16, moonMarker]}>
                <MoonGlyph size={16} angle={moonAngle} southern={southern} glow={false} earthshine={false} />
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.marker28, sunMarker]}>
                <SunGlyph size={28} />
              </Animated.View>
            </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  readoutRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.xs, minHeight: 56 },
  nowPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    marginTop: space.xxs,
  },
  cursor: { position: 'absolute', left: 0, width: 1, backgroundColor: '#FFFFFF' },
  marker28: { position: 'absolute', left: 0, top: 0, width: 28, height: 28 },
  marker16: { position: 'absolute', left: 0, top: 0, width: 16, height: 16 },
});
