import { BlurView } from 'expo-blur';
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

/** Translucent sky card. Blur on iOS/web; a denser tint on Android where blur is costly. */
export function Card({ title, icon, iconColor = colors.textSecondary, accessory, children, style, contentStyle, onPress, padded = true }: Props) {
  const body = (
    <View style={[styles.card, style]}>
      {process.env.EXPO_OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,18,48,0.42)' }]} />
      ) : (
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {title ? (
        <View style={styles.header}>
          {icon ? <Icon name={icon} size={15} color={iconColor} /> : null}
          <Text variant="subhead" color={colors.textSecondary} style={{ flex: 1 }}>
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
  },
  tint: { backgroundColor: 'rgba(14,20,56,0.26)' },
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
