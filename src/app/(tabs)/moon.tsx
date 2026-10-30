import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { formatCountdown, formatDate, formatNumber, formatTime, MONTHS, WEEKDAYS_LETTER, capitalize } from '@/astro/format';
import { computeMoonDay, MICROMOON_KM, moonState, PHASE_HINT, PHASE_LABEL, SUPERMOON_KM } from '@/astro/moon';
import { addDays, DAY_MS, localMidnight, startOfDay, wallClock } from '@/astro/time';
import { Card, Divider } from '@/components/Card';
import { ProgressBar } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { PressableScale } from '@/components/Pressable';
import { Metric, Reveal, ScreenTitle } from '@/components/Screen';
import { SkyBackground } from '@/components/SkyBackground';
import { useTabBarSpace } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { TopFade } from '@/components/TopFade';
import { useNow, usePlace, useQuarters } from '@/hooks/useAstro';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app';
import { SNAP } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

const PX_PER_DAY = 22;
const RANGE = 15;

export default function MoonScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { width } = useWindowDimensions();
  const place = usePlace();
  const now = useNow();
  const use24h = useApp((s) => s.use24h);
  const reduce = useReducedMotion();
  const southern = place.latitude < 0;
  const tz = place.tz;

  const night = useSharedValue(-22);
  const [offset, setOffset] = useState(0);
  const dayStart = useMemo(() => addDays(startOfDay(now, tz), offset, tz), [now, tz, offset]);
  const sampleMs = offset === 0 ? now.getTime() : dayStart.getTime() + DAY_MS / 2;
  const state = useMemo(() => moonState(new Date(sampleMs)), [sampleMs]);
  const moonDay = useMemo(() => computeMoonDay(place, dayStart), [place, dayStart]);
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
  useEffect(() => {
    if (reduce) return;
    float.set(withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [float, reduce]);
  const moonStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }, { translateY: float.get() * -6 }] }));

  const size = Math.min(width - 120, 240);
  const distPct = (state.distanceKm - 356_500) / (406_700 - 356_500);

  return (
    <View style={styles.root}>
      <SkyBackground altitude={night} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: bottom, paddingHorizontal: space.md, gap: space.sm }}>
        <ScreenTitle title="Lua" subtitle={offset === 0 ? `Hoje em ${place.name}` : capitalize(formatDate(dayStart, tz, 'weekday'))} />

        <GestureDetector gesture={pan}>
          <View style={styles.hero} accessibilityLabel="Arraste para ver a lua em outros dias">
            <Animated.View style={moonStyle}>
              <MoonGlyph size={size} angle={state.angle} southern={southern} />
            </Animated.View>
            <Text variant="title1" align="center" style={{ marginTop: space.xl }}>
              {PHASE_LABEL[state.key]}
            </Text>
            <Text variant="callout" color={colors.textSecondary} align="center">
              {Math.round(state.illumination * 100)}% iluminada · {state.waxing ? 'crescendo' : 'minguando'}
            </Text>
            <DayDots offset={offset} />
            {offset !== 0 ? (
              <PressableScale onPress={resetDay} style={styles.todayPill} hapticOnPress="soft">
                <Text variant="caption" color={colors.textOnAccent}>
                  Voltar para hoje
                </Text>
              </PressableScale>
            ) : (
              <Text variant="caption" color={colors.textTertiary} style={{ marginTop: space.sm }}>
                Arraste a lua para viajar no tempo
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
          <Card title="Nasce" icon="moonrise" iconColor={colors.moon} style={{ flex: 1 }}>
            <Text variant="metric" selectable>
              {formatTime(moonDay.moonrise, tz, use24h)}
            </Text>
          </Card>
          <Card title="Põe" icon="moon" iconColor={colors.moon} style={{ flex: 1 }}>
            <Text variant="metric" selectable>
              {formatTime(moonDay.moonset, tz, use24h)}
            </Text>
          </Card>
        </Reveal>

        <Reveal index={2}>
          <Card title="Próximas fases" icon="moonPhase" iconColor={colors.moon}>
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
          <Card title="Distância da Terra" icon="ruler">
            <View style={styles.row}>
              <Metric label="Agora" value={`${formatNumber(state.distanceKm)} km`} />
              <Metric label="Diâmetro aparente" value={`${((2 * 1737.4) / state.distanceKm * (180 / Math.PI) * 60).toFixed(1).replace('.', ',')}′`} />
            </View>
            <View style={{ marginTop: space.md, gap: 6 }}>
              <ProgressBar value={1 - distPct} color={colors.moon} height={10} />
              <View style={styles.between}>
                <Text variant="caption" color={colors.textTertiary}>
                  Perigeu 356 mil km
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  Apogeu 406 mil km
                </Text>
              </View>
            </View>
            {nextFull ? (
              <View style={styles.badgeRow}>
                <Icon name={nextFull.distanceKm < SUPERMOON_KM ? 'sparkle' : 'moonFull'} size={14} color={nextFull.distanceKm < SUPERMOON_KM ? colors.accent : colors.moon} />
                <Text variant="footnote" color={colors.textSecondary} style={{ flex: 1 }}>
                  {nextFull.distanceKm < SUPERMOON_KM
                    ? `A próxima lua cheia é uma superlua, a ${formatNumber(nextFull.distanceKm)} km.`
                    : nextFull.distanceKm > MICROMOON_KM
                      ? `A próxima lua cheia é uma microlua, a ${formatNumber(nextFull.distanceKm)} km.`
                      : `Próxima lua cheia a ${formatNumber(nextFull.distanceKm)} km.`}
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

function DayDots({ offset }: { offset: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: 9 }, (_, i) => {
        const d = i - 4;
        const active = Math.max(-4, Math.min(4, offset)) === d;
        return <View key={i} style={[styles.dot, active && { backgroundColor: colors.accent, width: 18 }]} />;
      })}
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
  return (
    <Card title={`Calendário lunar de ${MONTHS[w.month]}`} icon="calendar">
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
                <Text variant="caption" color={c.day === w.day ? colors.accent : colors.textSecondary} style={c.day === w.day ? { fontFamily: 'Manrope_800ExtraBold' } : undefined}>
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
  dots: { flexDirection: 'row', gap: 5, marginTop: space.md, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  todayPill: { marginTop: space.sm, backgroundColor: colors.accent, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.pill },
  weekHeader: { flexDirection: 'row', marginBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', gap: 3, paddingVertical: 6, minHeight: 48 },
});
