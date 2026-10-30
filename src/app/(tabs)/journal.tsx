import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { capitalize, formatDate, formatTime, WEEKDAYS_LETTER } from '@/astro/format';
import { dayKey, shiftKey } from '@/astro/time';
import { Card, Divider } from '@/components/Card';
import { ProgressBar } from '@/components/charts';
import { CheckInCard } from '@/components/CheckInCard';
import { Icon } from '@/components/Icon';
import { Reveal, ScreenTitle } from '@/components/Screen';
import { SkyBackground } from '@/components/SkyBackground';
import { useTabBarSpace } from '@/components/TabBar';
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
          <Card>
            <View style={styles.streakRow}>
              <View style={[styles.flame, { backgroundColor: keys.has(todayKey) ? colors.accentSoft : 'rgba(255,255,255,0.08)' }]}>
                <Icon name="flame" size={40} color={keys.has(todayKey) ? colors.accent : colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="hero" style={{ lineHeight: 58 }}>
                  {ctx.streak}
                </Text>
                <Text variant="subhead" color={colors.textSecondary}>
                  {ctx.streak === 1 ? 'dia seguido' : 'dias seguidos'} · recorde {ctx.bestStreak}
                </Text>
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
                    <Text variant="caption" color={isToday ? colors.text : colors.textTertiary}>
                      {WEEKDAYS_LETTER[wd]}
                    </Text>
                    <View style={[styles.weekDot, done && styles.weekDotDone, isToday && !done && styles.weekDotToday]}>
                      {done ? <Icon name="check" size={14} color={colors.textOnAccent} weight="heavy" /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </Reveal>

        <Reveal index={1}>
          <Card title={`Nível ${level.level} · ${level.title}`} icon="trophy" iconColor={colors.accent}>
            <View style={{ gap: space.xs }}>
              <ProgressBar value={level.progress} delay={200} />
              <View style={styles.between}>
                <Text variant="footnote" color={colors.textSecondary}>
                  {state.xp} XP
                </Text>
                <Text variant="footnote" color={colors.textSecondary}>
                  faltam {level.toNext} XP
                </Text>
              </View>
            </View>
          </Card>
        </Reveal>

        <Reveal index={2}>
          <CheckInCard window={window} tz={tz} moonIllum={live.moonState.illumination} showStreak={false} />
        </Reveal>

        <Reveal index={3}>
          <Card title="Conquistas" icon="sparkle" accessory={<Text variant="caption" color={colors.textTertiary}>{Object.keys(state.badges).length}/{BADGES.length}</Text>}>
            <View style={styles.badges}>
              {BADGES.map((b) => {
                const unlocked = !!state.badges[b.id];
                const p = b.progress(ctx);
                return (
                  <View key={b.id} style={[styles.badge, { width: badgeSize }]} accessibilityLabel={`${b.title}. ${b.description}${unlocked ? '' : ' Bloqueada.'}`}>
                    <View style={[styles.badgeIcon, unlocked ? styles.badgeOn : styles.badgeOff]}>
                      <Icon name={unlocked ? b.icon : 'lock'} size={unlocked ? 26 : 18} color={unlocked ? colors.textOnAccent : colors.textTertiary} />
                    </View>
                    <Text variant="subhead" align="center" numberOfLines={1} color={unlocked ? colors.text : colors.textSecondary}>
                      {b.title}
                    </Text>
                    {unlocked ? (
                      <Text variant="caption" align="center" color={colors.textTertiary} numberOfLines={2}>
                        {b.description}
                      </Text>
                    ) : (
                      <View style={{ width: '80%' }}>
                        <ProgressBar value={p} height={6} color={colors.textSecondary} />
                      </View>
                    )}
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
                    <Icon name={KIND_ICON[c.kind]} size={18} color={c.kind === 'moon' ? colors.moon : colors.accent} />
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
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flame: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  weekDay: { alignItems: 'center', gap: 6 },
  weekDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  weekDotDone: { backgroundColor: colors.accent, boxShadow: `0 3px 0 ${colors.accentDeep}` },
  weekDotToday: { borderWidth: 2, borderColor: colors.accent, borderStyle: 'dashed' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, rowGap: space.lg, paddingTop: space.xs },
  badge: { alignItems: 'center', gap: 6 },
  badgeIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.accent, boxShadow: `0 4px 0 ${colors.accentDeep}`, borderWidth: 3, borderColor: 'rgba(255,240,210,0.5)' },
  badgeOff: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
