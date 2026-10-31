import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { endSkyMoments, liveActivitiesAvailable, startSkyMoment, useSkyMoment, type SkyMomentKind } from '@/widgets/sync';

import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/**
 * A quiet pill that puts a sky moment on the Lock Screen and in the Dynamic Island. Renders
 * nothing where Live Activities don't exist (Expo Go, Android, web).
 */
export function TrackMoment({ kind, label = 'Acompanhar' }: { kind: SkyMomentKind; label?: string }) {
  const active = useSkyMoment((s) => s.kind === kind);
  if (!liveActivitiesAvailable()) return null;

  const toggle = async () => {
    if (active) {
      await endSkyMoments();
      return;
    }
    if (await startSkyMoment(kind)) haptic.success();
  };

  return (
    <PressableScale
      onPress={toggle}
      hapticOnPress={active ? 'light' : null}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? 'Parar de acompanhar na Tela Bloqueada' : `${label} na Tela Bloqueada`}
      hitSlop={8}
      style={[styles.pill, active && styles.pillActive]}>
      <Animated.View key={active ? 'on' : 'off'} entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)} style={styles.row}>
        <Icon name={active ? 'check' : 'lock'} size={11} color={active ? colors.onPrimary : colors.textSecondary} />
        <Text variant="caption" color={active ? colors.onPrimary : colors.textSecondary} style={{ fontWeight: '600' }}>
          {active ? 'Na Tela Bloqueada' : label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 26,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.fill,
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
