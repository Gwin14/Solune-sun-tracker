import { useIsFocused } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useLaunch } from '@/store/launch';
import { EASE_OUT } from '@/theme/motion';

type Props = {
  children?: ReactNode;
  delay?: number;
  duration?: number;
  /** Starting offsets; the element settles to zero. */
  x?: number;
  y?: number;
  scale?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * One-time entrance driven by a shared value. It waits until the launch screen is gone and
 * its screen is in front — native tabs mount every tab up front, so mounting alone would
 * play the animation off-screen. Reduce Motion collapses it to a fade.
 */
export function Appear({ children, delay = 0, duration = 620, x = 0, y = 18, scale = 1, style }: Props) {
  const reduce = useReducedMotion();
  const focused = useIsFocused();
  const revealed = useLaunch((s) => s.revealed);
  const played = useRef(false);
  const p = useSharedValue(0);
  useEffect(() => {
    if (played.current || !focused || !revealed) return;
    played.current = true;
    p.set(withDelay(delay, withTiming(1, { duration: reduce ? 240 : duration, easing: EASE_OUT })));
  }, [focused, revealed, delay, duration, reduce, p]);
  const animated = useAnimatedStyle(() => {
    const v = p.get();
    const opacity = Math.min(1, v * 1.4);
    if (reduce) return { opacity };
    return {
      opacity,
      transform: [{ translateX: (1 - v) * x }, { translateY: (1 - v) * y }, { scale: scale + (1 - scale) * v }],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
