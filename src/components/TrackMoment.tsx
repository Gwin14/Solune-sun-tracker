import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useT } from '@/i18n';
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
export function TrackMoment({ kind, label }: { kind: SkyMomentKind; label?: string }) {
  const active = useSkyMoment((s) => s.kind === kind);
  const tx = useT();
  const text = label ?? tx.track.follow;
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
      accessibilityLabel={active ? tx.track.stopA11y : tx.track.onLockA11y(text)}
      hitSlop={8}
      style={[styles.pill, active && styles.pillActive]}>
      <Animated.View key={active ? 'on' : 'off'} entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)} style={styles.row}>
        <Icon name={active ? 'check' : 'lock'} size={11} color={active ? colors.onPrimary : colors.textSecondary} />
        <Text variant="caption" color={active ? colors.onPrimary : colors.textSecondary} style={{ fontWeight: '600' }}>
          {active ? tx.track.onLock : text}
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
