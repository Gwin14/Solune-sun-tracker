import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { PRESS_IN, SNAP } from '@/theme/motion';
import { colors, font, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'quiet';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'large' | 'medium';
};

const LIP = 5;

const PALETTE: Record<Variant, { face: string; lip: string; text: string; border?: string }> = {
  primary: { face: colors.accent, lip: colors.accentDeep, text: colors.textOnAccent },
  secondary: { face: 'rgba(255,255,255,0.16)', lip: 'rgba(255,255,255,0.07)', text: colors.text, border: 'rgba(255,255,255,0.18)' },
  quiet: { face: 'transparent', lip: 'transparent', text: colors.text },
};

/**
 * Tactile pill button: the face sits on a darker lip and physically presses
 * down into it on press-in, then springs back.
 */
export function Button({ label, onPress, variant = 'primary', icon, disabled, style, size = 'large' }: Props) {
  const depth = useSharedValue(0);
  const p = PALETTE[variant];
  const lip = variant === 'quiet' ? 0 : LIP;
  const faceStyle = useAnimatedStyle(() => ({
    opacity: variant === 'quiet' ? 1 - depth.get() * 0.5 : 1,
    transform: [{ translateY: depth.get() * lip }],
  }));
  const height = size === 'large' ? 56 : 46;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => depth.set(withTiming(1, PRESS_IN))}
      onPressOut={() => depth.set(withSpring(0, SNAP))}
      onPress={() => {
        haptic.light();
        onPress?.();
      }}
      style={[{ height: height + lip, opacity: disabled ? 0.45 : 1 }, style]}>
      <View style={[styles.lip, { top: lip, height, backgroundColor: p.lip }]} />
      <Animated.View
        style={[
          styles.face,
          { height, backgroundColor: p.face, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1 : 0 },
          faceStyle,
        ]}>
        {icon ? <Icon name={icon} size={18} color={p.text} /> : null}
        <Text style={[styles.label, { fontSize: size === 'large' ? 17 : 15 }]} color={p.text}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  face: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.xl,
  },
  label: {
    fontFamily: font.heavy,
    letterSpacing: 0.2,
  },
});
