import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { ProgressRing } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { BADGES, XP } from '@/lib/achievements';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app';
import { EASE_OUT, SNAP } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

const MEDAL = 116;

export default function CelebrateScreen() {
  const id = useApp((s) => s.celebrationQueue[0]);
  const badge = BADGES.find((b) => b.id === id);
  const reduce = useReducedMotion();
  const tx = useT();
  const card = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    haptic.success();
    card.set(withTiming(1, { duration: 320, easing: EASE_OUT }));
    ring.set(withDelay(180, withSpring(1, { ...SNAP, duration: 900 })));
  }, [card, ring]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.get(),
    transform: [{ scale: reduce ? 1 : 0.95 + card.get() * 0.05 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: ring.get(), transform: [{ scale: reduce ? 1 : 0.8 + ring.get() * 0.2 }] }));

  const close = () => {
    useApp.getState().shiftCelebration();
    router.back();
  };

  if (!badge) return <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />;

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={tx.common.close} />
      </Animated.View>
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.medal}>
          <AnimatedRing progress={ring} />
          <Animated.View style={iconStyle}>
            <Icon name={badge.icon} size={40} color={colors.accent} weight="light" />
          </Animated.View>
        </View>
        <Text variant="footnote" color={colors.textSecondary} align="center">
          {tx.celebrate.unlocked}
        </Text>
        <Text variant="title1" align="center">
          {badge.title}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {badge.description}
        </Text>
        <Text variant="label" color={colors.accent} align="center" style={{ marginTop: space.xs }}>
          +{XP.badge} XP
        </Text>
        <Button label={tx.common.continue} onPress={close} style={{ alignSelf: 'stretch', marginTop: space.lg }} />
      </Animated.View>
    </View>
  );
}

/** The ring draws itself closed as the medal settles. */
function AnimatedRing({ progress }: { progress: { get: () => number } }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + progress.get() * 0.6, transform: [{ rotate: `${(1 - progress.get()) * -90}deg` }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}>
      <ProgressRing size={MEDAL} progress={1} color={colors.accent} track="transparent" stroke={1.5} />
      <ProgressRing size={MEDAL - 14} progress={1} color={colors.hairline} track="transparent" stroke={1} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: space.xxs,
    padding: space.xl,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.inkSheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  },
  medal: {
    width: MEDAL,
    height: MEDAL,
    borderRadius: MEDAL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
    backgroundColor: colors.accentSoft,
  },
});
