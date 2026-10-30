import type { ReactNode } from 'react';
import { Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { PRESS_IN, SNAP } from '@/theme/motion';

const APressable = Animated.createAnimatedComponent(RNPressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale on press-in. Cards and buttons use 0.97, rows use none. */
  scaleTo?: number;
  hapticOnPress?: 'tick' | 'light' | 'soft' | 'medium' | null;
};

/** Press feedback lands on press-in and springs home on release. */
export function PressableScale({ children, style, scaleTo = 0.97, hapticOnPress = 'light', onPressIn, onPressOut, onPress, ...rest }: Props) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        s.set(withTiming(scaleTo, PRESS_IN));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, SNAP));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic[hapticOnPress]();
        onPress?.(e);
      }}
      style={[style, animated]}>
      {children}
    </APressable>
  );
}
