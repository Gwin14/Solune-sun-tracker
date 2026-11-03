import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

type Props = {
  title?: string;
  icon?: IconName;
  iconColor?: string;
  accessory?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
};

/**
 * Translucent sky card. A flat tint rather than a live blur: the sky behind is a smooth
 * gradient, so a blur looked the same while re-rendering under every card on each scroll
 * frame and each twinkle.
 */
export function Card({ title, icon, iconColor = colors.textSecondary, accessory, children, style, contentStyle, onPress, padded = true }: Props) {
  const body = (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          {icon ? <Icon name={icon} size={13} color={iconColor} /> : null}
          <Text variant="label" color={colors.textSecondary} style={{ flex: 1 }}>
            {title}
          </Text>
          {accessory}
        </View>
      ) : null}
      <View style={[padded && styles.content, !title && padded && { paddingTop: space.md }, contentStyle]}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} hapticOnPress="soft">
      {body}
    </PressableScale>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(8,12,34,0.46)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  content: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
});
