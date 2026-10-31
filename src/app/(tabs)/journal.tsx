import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { capitalize, formatDate, formatTime, WEEKDAYS_LETTER } from '@/astro/format';
import { dayKey, shiftKey } from '@/astro/time';
import { Card, Divider } from '@/components/Card';
import { ProgressBar, ProgressRing } from '@/components/charts';
import { CheckInCard } from '@/components/CheckInCard';
import { Icon } from '@/components/Icon';
import { Reveal, ScreenTitle } from '@/components/Screen';
import { SkyBackground } from '@/components/SkyBackground';
import { useTabBarSpace } from '@/components/TabSpace';
import { Text } from '@/components/Text';
import { TopFade } from '@/components/TopFade';
import { useLivePositions, useNow, usePlace, useSunToday } from '@/hooks/useAstro';
import { useCheckInWindow } from '@/hooks/useCheckIn';
import { BADGES, levelFor } from '@/lib/achievements';
import { badgeContext, useApp } from '@/store/app';
import { colors, space } from '@/theme/tokens';

const KIND_LABEL = { sunrise: 'Nascer do sol', sunset: 'Pôr do sol', moon: 'Lua' } as const;
const KIND_ICON = { sunrise: 'sunrise', sunset: 'sunset', moon: 'moon' } as const;

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { width } = useWindowDimensions();
  const place = usePlace();
  const now = useNow();
  const tz = place.tz;
  const use24h = useApp((s) => s.use24h);
  const state = useApp();
  const ctx = useMemo(() => badgeContext(state), [state]);
  const level = levelFor(state.xp);
  const { today, tomorrow } = useSunToday(place, now);
  const live = useLivePositions(place, now);
  const window = useCheckInWindow({ now, tz, today, tomorrow, sunAlt: live.sun.alt, moonAlt: live.moon.alt, use24h });
  const sky = useSharedValue(-8);

  const todayKey = dayKey(now, tz);
  const keys = new Set(state.checkIns.map((c) => c.key));
  const week = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey, i - 6));
  const history = [...state.checkIns].sort((a, b) => b.at - a.at).slice(0, 12);
  const badgeSize = Math.floor((width - space.md * 2 - space.md * 2 - space.sm * 2) / 3);

  return (
    <View style={styles.root}>
      <SkyBackground altitude={sky} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: bottom, paddingHorizontal: space.md, gap: space.sm }}>
          <ScreenTitle title="Diário" subtitle="Seus momentos com o céu" />

          <Reveal index={0}>
            <Card title="Sequência" icon="flame" iconColor={keys.has(todayKey) ? colors.accent : colors.textSecondary}>
              <View style={styles.streakRow}>
                <View style={styles.streakNumber}>
                  <Text variant="hero">{ctx.streak}</Text>
                  <Text variant="title3" color={colors.textSecondary} style={{ marginBottom: 10 }}>
                    {ctx.streak === 1 ? 'dia' : 'dias'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text variant="footnote" color={colors.textSecondary}>
                    Recorde
                  </Text>
                  <Text variant="metricSmall">{ctx.bestStreak}</Text>
                </View>
              </View>
              <View style={styles.week}>
                {week.map((k) => {
                  const done = keys.has(k);
                  const isToday = k === todayKey;
                  const [y, m, d] = k.split('-').map(Number);
                  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
                  return (
                    <View key={k} style={styles.weekDay}>
                      <View style={[styles.weekDot, done && styles.weekDotDone, isToday && !done && styles.weekDotToday]} />
                      <Text variant="caption" color={isToday ? colors.text : colors.textTertiary}>
                        {WEEKDAYS_LETTER[wd]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </Reveal>

          <Reveal index={1}>
            <Card title={`Nível ${level.level}`} icon="trophy" accessory={<Text variant="footnote" color={colors.textSecondary}>{state.xp} XP</Text>}>
              <View style={{ gap: space.sm }}>
                <Text variant="title3">{level.title}</Text>
                <ProgressBar value={level.progress} delay={200} />
                <Text variant="footnote" color={colors.textTertiary}>
                  Faltam {level.toNext} XP para o próximo nível
                </Text>
              </View>
            </Card>
          </Reveal>

          <Reveal index={2}>
            <CheckInCard window={window} tz={tz} moonIllum={live.moonState.illumination} showStreak={false} />
          </Reveal>

          <Reveal index={3}>
            <Card title="Conquistas" icon="trophy" accessory={<Text variant="caption" color={colors.textTertiary}>{Object.keys(state.badges).length}/{BADGES.length}</Text>}>
              <View style={styles.badges}>
                {BADGES.map((b) => {
                  const unlocked = !!state.badges[b.id];
                  const p = b.progress(ctx);
                  return (
                    <View key={b.id} style={[styles.badge, { width: badgeSize }]} accessibilityLabel={`${b.title}. ${b.description}${unlocked ? '' : ` ${Math.round(p * 100)}% concluída.`}`}>
                      <View style={[styles.medal, unlocked && styles.medalOn]}>
                        <ProgressRing size={60} progress={unlocked ? 1 : p} color={unlocked ? colors.accent : colors.textSecondary} />
                        <Icon name={b.icon} size={22} color={unlocked ? colors.accent : colors.textTertiary} weight="regular" />
                      </View>
                      <Text variant="footnote" align="center" numberOfLines={1} color={unlocked ? colors.text : colors.textSecondary} style={{ fontWeight: '600' }}>
                        {b.title}
                      </Text>
                      <Text variant="caption" align="center" color={colors.textTertiary} numberOfLines={2}>
                        {unlocked ? b.description : `${Math.round(p * 100)}%`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card title="Registros" icon="journal">
              {history.length === 0 ? (
                <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.lg }}>
                  <Icon name="sunHorizon" size={30} color={colors.textSecondary} />
                  <Text variant="headline">Seu diário está em branco</Text>
                  <Text variant="footnote" color={colors.textSecondary} align="center">
                    Perto do nascer ou do pôr do sol, ou com a lua no céu, toque em Registrar agora.
                  </Text>
                </View>
              ) : (
                history.map((c, i) => (
                  <View key={c.at}>
                    {i ? <Divider /> : null}
                    <View style={styles.histRow}>
                      <Icon name={KIND_ICON[c.kind]} size={16} color={c.kind === 'moon' ? colors.moon : colors.accent} />
                      <Text variant="callout" style={{ flex: 1 }}>
                        {KIND_LABEL[c.kind]}
                      </Text>
                      <Text variant="footnote" color={colors.textSecondary}>
                        {capitalize(formatDate(new Date(c.at), tz, 'short'))} · {formatTime(new Date(c.at), tz, use24h)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </Reveal>
        </ScrollView>
      <TopFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  streakRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  streakNumber: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  weekDay: { alignItems: 'center', gap: space.xs, width: 28 },
  weekDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.fillStrong },
  weekDotDone: { backgroundColor: colors.accent },
  weekDotToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, rowGap: space.xl, paddingTop: space.xs },
  badge: { alignItems: 'center', gap: space.xxs },
  medal: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: space.xxs },
  medalOn: { backgroundColor: colors.accentSoft },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
