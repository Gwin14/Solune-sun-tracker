import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion, FadeIn } from 'react-native-reanimated';

import { EASE_OUT } from '@/theme/motion';
import { colors, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** Staggered entrance for stacked cards (first mount only, capped at 8). */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const entering = reduce
    ? FadeIn.duration(160)
    : FadeInDown.delay(Math.min(index, 8) * 55)
        .duration(420)
        .easing(EASE_OUT)
        .withInitialValues({ transform: [{ translateY: 18 }] });
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

export function Metric({ label, value, sub, icon, color = colors.text }: { label: string; value: string; sub?: string; icon?: IconName; color?: string }) {
  return (
    <View style={{ gap: 2, flex: 1 }}>
      <View style={styles.metricLabel}>
        {icon ? <Icon name={icon} size={13} color={colors.textTertiary} /> : null}
        <Text variant="footnote" color={colors.textSecondary}>
          {label}
        </Text>
      </View>
      <Text variant="metricSmall" color={color} selectable>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" color={colors.textTertiary}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function IconButton({ icon, onPress, label, size = 40 }: { icon: IconName; onPress: () => void; label: string; size?: number }) {
  return (
    <PressableScale accessibilityLabel={label} accessibilityRole="button" onPress={onPress} hapticOnPress="soft" style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={icon} size={size * 0.45} color={colors.text} />
    </PressableScale>
  );
}

export function ScreenTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title1">{title}</Text>
        {subtitle ? (
          <Text variant="callout" color={colors.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginBottom: space.xs },
});
