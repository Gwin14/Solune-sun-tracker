import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import { computeStreak } from '@/lib/achievements';
import { haptic } from '@/lib/haptics';
import { dayKey, shiftKey } from '@/astro/time';
import type { CheckInWindow } from '@/hooks/useCheckIn';
import { useApp } from '@/store/app';
import { POP } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { Text } from './Text';

const KIND_ICON = { sunrise: 'sunrise', sunset: 'sunset', moon: 'moon' } as const;

export function CheckInCard({ window, tz, moonIllum, showStreak = true }: { window: CheckInWindow; tz?: string; moonIllum: number; showStreak?: boolean }) {
  const checkIns = useApp((s) => s.checkIns);
  const checkIn = useApp((s) => s.checkIn);
  const { streak, alive } = computeStreak(checkIns.map((c) => c.key), dayKey(new Date(), tz), shiftKey);
  const [burst, setBurst] = useState(0);
  const flame = useSharedValue(1);
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flame.get() }] }));
  const [showXp, setShowXp] = useState(false);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setShowXp(false), 1600);
    return () => clearTimeout(t);
  }, [burst]);

  const onCheckIn = () => {
    if (!window.kind) return;
    const ok = checkIn(window.kind, tz, window.kind === 'moon' ? moonIllum : undefined);
    if (ok) {
      haptic.success();
      setBurst((b) => b + 1);
      setShowXp(true);
      flame.set(withSequence(withTiming(1.35, { duration: 140 }), withSpring(1, POP)));
    }
  };

  return (
    <Card
      title={showStreak ? 'Diário de luz' : 'Registrar momento'}
      icon={showStreak ? 'journal' : 'eye'}
      onPress={showStreak ? () => router.navigate('/journal') : undefined}
      contentStyle={!showStreak && { marginTop: -space.md }}>
      <View style={[styles.row, !showStreak && { display: 'none' }]}>
        <Animated.View style={[styles.flame, { backgroundColor: alive ? colors.accentSoft : 'rgba(255,255,255,0.08)' }, flameStyle]}>
          <Icon name="flame" size={26} color={alive ? colors.accent : colors.textTertiary} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text variant="title3">
            {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </Text>
          <Text variant="footnote" color={colors.textSecondary}>
            {alive ? 'Sequência garantida hoje.' : streak > 0 ? 'Registre um momento hoje para manter.' : 'Registre o céu para começar uma sequência.'}
          </Text>
        </View>
        {showXp ? (
          <Animated.View key={burst} entering={ZoomIn.springify().damping(12)} exiting={FadeOutUp} style={styles.xp}>
            <Text variant="caption" color={colors.textOnAccent}>
              +20 XP
            </Text>
          </Animated.View>
        ) : null}
      </View>
      {window.kind ? (
        window.done ? (
          <View style={styles.doneRow}>
            <Icon name="check" size={16} color={colors.accent} />
            <Text variant="subhead" color={colors.textSecondary}>
              Momento registrado. Lindo céu.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <View style={styles.promptRow}>
              <Icon name={KIND_ICON[window.kind]} size={16} color={colors.accent} />
              <Text variant="headline">{window.prompt}</Text>
            </View>
            <Button label="Registrar agora" icon="check" onPress={onCheckIn} size="medium" />
          </View>
        )
      ) : (
        <View style={styles.doneRow}>
          <Icon name="clock" size={14} color={colors.textTertiary} />
          <Text variant="footnote" color={colors.textSecondary}>
            {window.nextHint}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flame: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  xp: { backgroundColor: colors.accent, paddingHorizontal: space.xs, paddingVertical: 4, borderRadius: radius.pill },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md },
});
