import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { SKY } from '@/theme/sky';

type Props = {
  /** Solar altitude in degrees driving the palette. */
  altitude: SharedValue<number>;
  /** 0..1 horizontal position for the sun glow; omit to hide it. */
  glowX?: SharedValue<number>;
};

function Layer({ index, altitude }: { index: number; altitude: SharedValue<number> }) {
  const prev = SKY[index - 1]?.alt ?? -90;
  const own = SKY[index].alt;
  const style = useAnimatedStyle(() => ({
    opacity: index === 0 ? 1 : interpolate(altitude.get(), [prev, own], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient colors={SKY[index].colors} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export const SkyBackground = memo(function SkyBackground({ altitude, glowX }: Props) {
  const { width, height } = useWindowDimensions();
  const starsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(altitude.get(), [-14, -5], [1, 0], Extrapolation.CLAMP),
  }));
  const glowStyle = useAnimatedStyle(() => {
    const a = altitude.get();
    return {
      opacity: interpolate(a, [-10, -2, 4, 20], [0, 0.85, 0.7, 0.25], Extrapolation.CLAMP),
      transform: [{ translateX: ((glowX?.get() ?? 0.5) - 0.5) * width }],
    };
  });

  return (
    <Animated.View entering={FadeIn.duration(900)} style={StyleSheet.absoluteFill} pointerEvents="none">
      {SKY.map((_, i) => (
        <Layer key={i} index={i} altitude={altitude} />
      ))}
      {glowX ? (
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <Svg width={width} height={height}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="100%" rx="70%" ry="45%">
                <Stop offset="0" stopColor="#FFC98A" stopOpacity={0.55} />
                <Stop offset="0.5" stopColor="#FF8F6B" stopOpacity={0.16} />
                <Stop offset="1" stopColor="#FF8F6B" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={width / 2} cy={height} r={height} fill="url(#glow)" />
          </Svg>
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, starsStyle]}>
        <Starfield width={width} height={height} />
      </Animated.View>
    </Animated.View>
  );
});

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Starfield = memo(function Starfield({ width, height }: { width: number; height: number }) {
  const stars = useMemo(() => {
    const rand = mulberry(7);
    return Array.from({ length: 90 }, () => {
      const y = rand() ** 1.6 * height * 0.8;
      return { x: rand() * width, y, r: 0.4 + rand() * 1.1, o: 0.35 + rand() * 0.6 };
    });
  }, [width, height]);
  const twinklers = stars.slice(0, 10);
  return (
    <>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {stars.slice(10).map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
        ))}
      </Svg>
      {twinklers.map((s, i) => (
        <Twinkle key={i} x={s.x} y={s.y} r={s.r + 0.5} delay={i * 420} />
      ))}
    </>
  );
});

function Twinkle({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.8);
  useEffect(() => {
    if (reduce) return;
    o.set(withDelay(delay, withRepeat(withSequence(withTiming(0.2, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1, true)));
  }, [delay, o, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#FFFFFF', boxShadow: `0 0 ${r * 4}px rgba(255,255,255,0.9)` }, style]}
    />
  );
}
