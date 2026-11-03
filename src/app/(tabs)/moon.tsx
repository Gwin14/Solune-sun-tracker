import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { formatCountdown, formatDate, formatDecimal, formatNumber, formatTime, MONTHS, WEEKDAYS_LETTER, capitalize } from '@/astro/format';
import { computeMoonDay, MICROMOON_KM, moonState, PHASE_HINT, PHASE_LABEL, SUPERMOON_KM } from '@/astro/moon';
import { addDays, DAY_MS, localMidnight, startOfDay, wallClock } from '@/astro/time';
import { Appear } from '@/components/Appear';
import { Card, Divider } from '@/components/Card';
import { LunarWave, ProgressBar } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { lazyTab } from '@/components/LazyTab';
import { MoonGlyph } from '@/components/MoonGlyph';
import { PressableScale } from '@/components/Pressable';
import { Metric, Reveal, ScreenTitle } from '@/components/Screen';
import { SkyBackground } from '@/components/SkyBackground';
import { useTabBarSpace } from '@/components/TabSpace';
import { Text } from '@/components/Text';
import { TopFade } from '@/components/TopFade';
import { useNow, usePlace, useQuarters } from '@/hooks/useAstro';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app';
import { SNAP } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

const PX_PER_DAY = 22;
const RANGE = 15;

export default lazyTab(MoonScreen);

function MoonScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { width } = useWindowDimensions();
  const place = usePlace();
  const now = useNow();
  const use24h = useApp((s) => s.use24h);
  const reduce = useReducedMotion();
  const tx = useT();
  const southern = place.latitude < 0;
  const tz = place.tz;

  const night = useSharedValue(-22);
  const [offset, setOffset] = useState(0);
  const dayStart = useMemo(() => addDays(startOfDay(now, tz), offset, tz), [now, tz, offset]);
  const sampleMs = offset === 0 ? now.getTime() : dayStart.getTime() + DAY_MS / 2;
  const state = useMemo(() => moonState(new Date(sampleMs)), [sampleMs]);
  const moonDay = useMemo(() => computeMoonDay(place, dayStart), [place, dayStart]);
  const todayStart = useMemo(() => startOfDay(now, tz), [now, tz]);
  const wave = useMemo(
    () => Array.from({ length: RANGE * 2 + 1 }, (_, i) => moonState(new Date(addDays(todayStart, i - RANGE, tz).getTime() + DAY_MS / 2)).illumination),
    [todayStart, tz],
  );
  const quarters = useQuarters(now).filter((q) => q.date.getTime() > now.getTime()).slice(0, 4);
  const nextFull = quarters.find((q) => q.key === 'full');

  // Scrub through days by dragging the moon.
  const drag = useSharedValue(0);
  const base = useSharedValue(0);
  const lastDay = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    failOffsetY: [-14, 14],
    onActivate: () => {
      'worklet';
      base.set(lastDay.get());
    },
    onUpdate: (e) => {
      'worklet';
      const d = Math.max(-RANGE, Math.min(RANGE, Math.round(base.get() - e.translationX / PX_PER_DAY)));
      drag.set(e.translationX * 0.12);
      if (d !== lastDay.get()) {
        lastDay.set(d);
        scheduleOnRN(setOffset, d);
        scheduleOnRN(haptic.tick);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      drag.set(withSpring(0, { ...SNAP, velocity: e.velocityX * 0.12 }));
    },
  });
  const resetDay = () => {
    lastDay.set(0);
    setOffset(0);
  };

  const float = useSharedValue(0);
  const focused = useIsFocused();
  useEffect(() => {
    if (reduce || !focused) return;
    float.set(withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(float);
  }, [float, reduce, focused]);
  const moonStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }, { translateY: float.get() * -6 }] }));

  const size = Math.min(width - 120, 240);
  const distPct = (state.distanceKm - 356_500) / (406_700 - 356_500);

  return (
    <View style={styles.root}>
      <SkyBackground altitude={night} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: bottom, paddingHorizontal: space.md, gap: space.sm }}>
          <ScreenTitle title={tx.tabs.moon} subtitle={offset === 0 ? tx.moon.todayIn(place.name) : capitalize(formatDate(dayStart, tz, 'weekday'))} />

          <GestureDetector gesture={pan}>
            <View style={styles.hero} accessibilityLabel={tx.moon.dragA11y}>
              <Appear delay={100} y={0} scale={0.9} duration={1100}>
                <Animated.View style={moonStyle}>
                  <MoonGlyph size={size} angle={state.angle} southern={southern} />
                </Animated.View>
              </Appear>
              <Appear delay={260} y={14} duration={700}>
                <Text variant="title1" align="center" style={{ marginTop: space.xl }}>
                  {PHASE_LABEL[state.key]}
                </Text>
                <Text variant="callout" color={colors.textSecondary} align="center">
                  {tx.moon.litTrend(Math.round(state.illumination * 100), state.waxing)}
                </Text>
              </Appear>
              <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
                <LunarWave illum={wave} offset={offset} range={RANGE} />
              </View>
              {offset !== 0 ? (
                <PressableScale onPress={resetDay} style={styles.todayPill} hapticOnPress="soft">
                  <Text variant="label" color={colors.onPrimary}>
                    {tx.moon.backToToday}
                  </Text>
                </PressableScale>
              ) : (
                <Text variant="caption" color={colors.textTertiary} style={{ marginTop: space.sm }}>
                  {tx.moon.dragHint}
                </Text>
              )}
            </View>
          </GestureDetector>

          <Reveal index={0}>
            <Card>
              <Text variant="callout" color={colors.textSecondary}>
                {PHASE_HINT[state.key]}
              </Text>
            </Card>
          </Reveal>

          <Reveal index={1} style={styles.row}>
            <Card title={tx.moon.rises} icon="moonrise" iconColor={colors.moon} style={{ flex: 1 }}>
              <Text variant="metric" selectable>
                {formatTime(moonDay.moonrise, tz, use24h)}
              </Text>
            </Card>
            <Card title={tx.moon.sets} icon="moon" iconColor={colors.moon} style={{ flex: 1 }}>
              <Text variant="metric" selectable>
                {formatTime(moonDay.moonset, tz, use24h)}
              </Text>
            </Card>
          </Reveal>

          <Reveal index={2}>
            <Card title={tx.moon.nextPhases} icon="moonPhase" iconColor={colors.moon}>
              {quarters.map((q, i) => (
                <View key={q.date.getTime()}>
                  {i ? <Divider /> : null}
                  <View style={styles.phaseRow}>
                    <MoonGlyph size={30} angle={{ new: 0, firstQuarter: 90, full: 180, lastQuarter: 270 }[q.key as 'new'] ?? 0} southern={southern} glow={false} />
                    <View style={{ flex: 1 }}>
                      <Text variant="headline">{PHASE_LABEL[q.key]}</Text>
                      <Text variant="footnote" color={colors.textSecondary}>
                        {capitalize(formatDate(q.date, tz, 'compact'))} · {formatTime(q.date, tz, use24h)}
                      </Text>
                    </View>
                    <Text variant="subhead" color={colors.textSecondary}>
                      {formatCountdown(q.date.getTime() - now.getTime())}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </Reveal>

          <Reveal index={3}>
            <Card title={tx.moon.distanceTitle} icon="ruler">
              <View style={styles.row}>
                <Metric label={tx.moon.now} value={`${formatNumber(state.distanceKm)} km`} />
                <Metric label={tx.moon.apparentSize} value={`${formatDecimal((2 * 1737.4) / state.distanceKm * (180 / Math.PI) * 60)}′`} />
              </View>
              <View style={{ marginTop: space.md, gap: 6 }}>
                <ProgressBar value={1 - distPct} color={colors.moon} height={10} />
                <View style={styles.between}>
                  <Text variant="caption" color={colors.textTertiary}>
                    {tx.moon.perigee}
                  </Text>
                  <Text variant="caption" color={colors.textTertiary}>
                    {tx.moon.apogee}
                  </Text>
                </View>
              </View>
              {nextFull ? (
                <View style={styles.badgeRow}>
                  <Icon name={nextFull.distanceKm < SUPERMOON_KM ? 'sparkle' : 'moonFull'} size={14} color={nextFull.distanceKm < SUPERMOON_KM ? colors.accent : colors.moon} />
                  <Text variant="footnote" color={colors.textSecondary} style={{ flex: 1 }}>
                    {nextFull.distanceKm < SUPERMOON_KM
                      ? tx.moon.nextSupermoon(formatNumber(nextFull.distanceKm))
                      : nextFull.distanceKm > MICROMOON_KM
                        ? tx.moon.nextMicromoon(formatNumber(nextFull.distanceKm))
                        : tx.moon.nextFull(formatNumber(nextFull.distanceKm))}
                  </Text>
                </View>
              ) : null}
            </Card>
          </Reveal>

          <Reveal index={4}>
            <MoonCalendar now={now} tz={tz} southern={southern} />
          </Reveal>
        </ScrollView>
      <TopFade />
    </View>
  );
}


function MoonCalendar({ now, tz, southern }: { now: Date; tz?: string; southern: boolean }) {
  const w = wallClock(now, tz);
  const days = useMemo(() => {
    const first = localMidnight(w.year, w.month, 1, tz);
    const lead = wallClock(first, tz).weekday;
    const count = new Date(Date.UTC(w.year, w.month + 1, 0)).getUTCDate();
    const cells: ({ day: number; angle: number } | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) {
      const noon = new Date(localMidnight(w.year, w.month, d, tz).getTime() + DAY_MS / 2);
      cells.push({ day: d, angle: moonState(noon).angle });
    }
    return cells;
  }, [w.year, w.month, tz]);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - space.md * 4) / 7);
  const tx = useT();
  return (
    <Card title={tx.moon.calendar(MONTHS[w.month])} icon="calendar">
      <View style={styles.weekHeader}>
        {WEEKDAYS_LETTER.map((l, i) => (
          <Text key={i} variant="caption" color={colors.textTertiary} align="center" style={{ width: cell }}>
            {l}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((c, i) => (
          <View key={i} style={[styles.cell, { width: cell }]}>
            {c ? (
              <>
                <MoonGlyph size={Math.min(26, cell - 14)} angle={c.angle} southern={southern} glow={false} earthshine={false} />
                <Text variant="caption" color={c.day === w.day ? colors.accent : colors.textSecondary} style={c.day === w.day ? { fontWeight: '700' } : undefined}>
                  {c.day}
                </Text>
              </>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  hero: { alignItems: 'center', paddingVertical: space.xl },
  row: { flexDirection: 'row', gap: space.sm },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md },
  todayPill: { marginTop: space.sm, backgroundColor: colors.primary, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  weekHeader: { flexDirection: 'row', marginBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', gap: 3, paddingVertical: 6, minHeight: 48 },
});
