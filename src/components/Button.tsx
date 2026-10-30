import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { PRESS_IN, SNAP } from '@/theme/motion';
import { colors, radius, space, weight } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'quiet';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'large' | 'medium';
};

const PALETTE: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.fillStrong, fg: colors.text },
  quiet: { bg: 'transparent', fg: colors.text },
};

const APressable = Animated.createAnimatedComponent(Pressable);

/** Pill button. Press feedback lands on press-in: a slight scale and dim, then springs home. */
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style, size = 'large' }: Props) {
  const pressed = useSharedValue(0);
  const p = PALETTE[variant];
  const animated = useAnimatedStyle(() => ({
    opacity: (disabled ? 0.4 : 1) * (1 - pressed.get() * (variant === 'quiet' ? 0.5 : 0.12)),
    transform: [{ scale: 1 - pressed.get() * (variant === 'quiet' ? 0 : 0.03) }],
  }));

  return (
    <APressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPressIn={() => pressed.set(withTiming(1, PRESS_IN))}
      onPressOut={() => pressed.set(withSpring(0, SNAP))}
      onPress={() => {
        haptic.light();
        onPress?.();
      }}
      style={[styles.base, { height: size === 'large' ? 54 : 44, backgroundColor: p.bg }, animated, style]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={16} color={p.fg} /> : null}
          <Text variant="headline" color={p.fg} style={{ fontWeight: weight.semibold }}>
            {label}
          </Text>
        </>
      )}
    </APressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.xl,
  },
});
