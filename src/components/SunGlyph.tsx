import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop } from 'react-native-svg';

type Props = { size: number; rays?: boolean; glow?: boolean };

export const SunGlyph = memo(function SunGlyph({ size, rays = false, glow = true }: Props) {
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!rays || reduce) return;
    spin.set(withRepeat(withTiming(360, { duration: 60_000, easing: Easing.linear }), -1, false));
  }, [rays, reduce, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  const r = size / 2;
  const core = rays ? r * 0.56 : r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {rays ? (
        <Animated.View style={[{ position: 'absolute', width: size, height: size }, spinStyle]}>
          <Svg width={size} height={size}>
            <G>
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i * Math.PI) / 6;
                const r1 = core * 1.25;
                const r2 = core * (i % 2 ? 1.55 : 1.75);
                return (
                  <Line
                    key={i}
                    x1={r + Math.cos(a) * r1}
                    y1={r + Math.sin(a) * r1}
                    x2={r + Math.cos(a) * r2}
                    y2={r + Math.sin(a) * r2}
                    stroke="#FFD27A"
                    strokeOpacity={0.75}
                    strokeWidth={Math.max(1.5, size * 0.035)}
                    strokeLinecap="round"
                  />
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      ) : null}
      <View
        style={{
          width: core * 2,
          height: core * 2,
          borderRadius: core,
          boxShadow: glow ? `0 0 ${Math.round(core * 1.2)}px rgba(255,190,90,0.75)` : undefined,
        }}>
        <Svg width={core * 2} height={core * 2}>
          <Defs>
            <RadialGradient id={`sun${Math.round(size)}`} cx="40%" cy="38%" r="70%">
              <Stop offset="0" stopColor="#FFF6D8" />
              <Stop offset="0.45" stopColor="#FFD173" />
              <Stop offset="1" stopColor="#FF9A3D" />
            </RadialGradient>
          </Defs>
          <Circle cx={core} cy={core} r={core} fill={`url(#sun${Math.round(size)})`} />
        </Svg>
      </View>
    </View>
  );
});
