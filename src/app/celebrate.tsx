import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { BADGES, XP } from '@/lib/achievements';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app';
import { POP } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

const RAY_SIZE = 260;

function Rays() {
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!reduce) spin.set(withRepeat(withTiming(360, { duration: 24_000, easing: Easing.linear }), -1, false));
  }, [reduce, spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const r = RAY_SIZE / 2;
  const wedges = Array.from({ length: 12 }, (_, i) => {
    const a0 = (i * 30 * Math.PI) / 180;
    const a1 = ((i * 30 + 12) * Math.PI) / 180;
    return `M${r},${r} L${r + Math.cos(a0) * r},${r + Math.sin(a0) * r} L${r + Math.cos(a1) * r},${r + Math.sin(a1) * r} Z`;
  });
  return (
    <Animated.View style={[{ position: 'absolute', width: RAY_SIZE, height: RAY_SIZE }, style]} pointerEvents="none">
      <Svg width={RAY_SIZE} height={RAY_SIZE}>
        <Defs>
          <RadialGradient id="rayFade" cx="50%" cy="50%" r="50%">
            <Stop offset="0.25" stopColor={colors.accent} stopOpacity={0.32} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {wedges.map((d, i) => (
          <Path key={i} d={d} fill="url(#rayFade)" />
        ))}
      </Svg>
    </Animated.View>
  );
}

export default function CelebrateScreen() {
  const id = useApp((s) => s.celebrationQueue[0]);
  const badge = BADGES.find((b) => b.id === id);
  const scale = useSharedValue(0.6);
  const icon = useSharedValue(0);

  useEffect(() => {
    haptic.success();
    scale.set(withSpring(1, POP));
    icon.set(withDelay(160, withSpring(1, POP)));
  }, [scale, icon]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, (scale.get() - 0.6) / 0.25), transform: [{ scale: scale.get() }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: icon.get() }, { rotate: `${(1 - icon.get()) * -40}deg` }] }));

  const close = () => {
    useApp.getState().shiftCelebration();
    router.back();
  };

  if (!badge) {
    return <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />;
  }

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fechar" />
      </Animated.View>
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.burst}>
          <Rays />
          <Animated.View style={[styles.badge, iconStyle]}>
            <Icon name={badge.icon} size={46} color={colors.textOnAccent} weight="bold" />
          </Animated.View>
        </View>
        <Text variant="title1" align="center">
          {badge.title}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {badge.description}
        </Text>
        <View style={styles.xp}>
          <Icon name="sparkle" size={14} color={colors.accent} />
          <Text variant="headline" color={colors.accent}>
            +{XP.badge} XP
          </Text>
        </View>
        <Button label="Continuar" onPress={close} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: space.xs,
    padding: space.xl,
    paddingTop: space.md,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.inkSheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  burst: { width: RAY_SIZE, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: -space.md, overflow: 'visible' },
  badge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,240,210,0.6)',
    boxShadow: `0 6px 0 ${colors.accentDeep}, 0 0 40px rgba(255,182,72,0.55)`,
  },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.xs },
});
