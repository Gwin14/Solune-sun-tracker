import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SkyEvent, SkyEventKind } from '@/astro/events';
import { capitalize, formatDate, formatDaysUntil, formatDuration, formatTime, MONTHS, WEEKDAYS_SHORT } from '@/astro/format';
import { computeMoonDay, moonState, PHASE_LABEL } from '@/astro/moon';
import { computeSunDay } from '@/astro/sun';
import { addDays, dayKey, daysBetweenKeys, startOfDay, wallClock } from '@/astro/time';
import { Card, Divider } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { lazyTab } from '@/components/LazyTab';
import { MoonGlyph } from '@/components/MoonGlyph';
import { PressableScale } from '@/components/Pressable';
import { Metric, Reveal, ScreenTitle } from '@/components/Screen';
import { SkyBackground } from '@/components/SkyBackground';
import { useTabBarSpace } from '@/components/TabSpace';
import { Text } from '@/components/Text';
import { TopFade } from '@/components/TopFade';
import { useEvents, useNow, usePlace } from '@/hooks/useAstro';
import { useT } from '@/i18n';
import { useApp } from '@/store/app';
import { colors, radius, space } from '@/theme/tokens';

type Filter = 'all' | 'eclipse' | 'moon' | 'season' | 'meteor';
const FILTERS: Filter[] = ['all', 'eclipse', 'moon', 'season', 'meteor'];

const KIND_META: Record<SkyEventKind, { icon: IconName; color: string; filter: Filter }> = {
  season: { icon: 'leaf', color: '#7FD6A4', filter: 'season' },
  lunarEclipse: { icon: 'eclipse', color: '#FF8A7A', filter: 'eclipse' },
  solarEclipse: { icon: 'eclipse', color: colors.accent, filter: 'eclipse' },
  fullMoon: { icon: 'moonFull', color: colors.moon, filter: 'moon' },
  supermoon: { icon: 'sparkle', color: colors.moon, filter: 'moon' },
  meteor: { icon: 'meteor', color: '#9DB2FF', filter: 'meteor' },
};

export default lazyTab(EventsScreen);

function EventsScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const place = usePlace();
  const now = useNow();
  const tz = place.tz;
  const events = useEvents(place, now);
  const [filter, setFilter] = useState<Filter>('all');
  const tx = useT();
  const night = useSharedValue(-16);

  const todayKey = dayKey(now, tz);
  const grouped = useMemo(() => {
    const list = events.filter((e) => filter === 'all' || KIND_META[e.kind].filter === filter);
    const map = new Map<string, SkyEvent[]>();
    for (const e of list) {
      const w = wallClock(e.date, tz);
      const k = `${capitalize(MONTHS[w.month])} ${w.year}`;
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [events, filter, tz]);

  return (
    <View style={styles.root}>
      <SkyBackground altitude={night} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: bottom, gap: space.sm }}>
          <View style={{ paddingHorizontal: space.md }}>
            <ScreenTitle title={tx.tabs.events} subtitle={tx.events.subtitle} />
          </View>

          <Reveal index={0}>
            <DayPlanner />
          </Reveal>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => {
              const active = f === filter;
              return (
                <PressableScale
                  key={f}
                  onPress={() => setFilter(f)}
                  hapticOnPress="tick"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.filter, active && styles.filterActive]}>
                  <Text variant="subhead" color={active ? colors.onPrimary : colors.text} style={{ fontWeight: '500' }}>
                    {tx.events.filters[f]}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          <Animated.View layout={LinearTransition.duration(240)} style={{ paddingHorizontal: space.md, gap: space.lg }}>
            {grouped.length === 0 ? (
              <Card>
                <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.lg }}>
                  <Icon name="telescope" size={28} color={colors.textSecondary} />
                  <Text variant="headline">{tx.events.emptyTitle}</Text>
                  <Text variant="footnote" color={colors.textSecondary} align="center">
                    {tx.events.emptyBody}
                  </Text>
                </View>
              </Card>
            ) : null}
            {grouped.map(([month, list]) => (
              <Animated.View key={`${filter}-${month}`} entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)} style={{ gap: space.xs }}>
                <Text variant="title3">{month}</Text>
                <Card padded={false}>
                  {list.map((e, i) => (
                    <View key={e.id}>
                      {i ? <Divider style={{ marginLeft: 68 }} /> : null}
                      <EventRow e={e} todayKey={todayKey} tz={tz} />
                    </View>
                  ))}
                </Card>
              </Animated.View>
            ))}
          </Animated.View>
        </ScrollView>
      <TopFade />
    </View>
  );
}

function EventRow({ e, todayKey, tz }: { e: SkyEvent; todayKey: string; tz?: string }) {
  const use24h = useApp((s) => s.use24h);
  const tx = useT();
  const meta = KIND_META[e.kind];
  const days = daysBetweenKeys(todayKey, dayKey(e.date, tz));
  const w = wallClock(e.date, tz);
  return (
    <View style={styles.eventRow}>
      <View style={[styles.dateBadge, { borderColor: `${meta.color}55` }]}>
        <Text variant="caption" color={meta.color}>
          {WEEKDAYS_SHORT[w.weekday]}
        </Text>
        <Text variant="title3" style={{ lineHeight: 24 }}>
          {w.day}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleLine}>
          <Icon name={meta.icon} size={13} color={meta.color} />
          <Text variant="headline" style={{ flex: 1 }} numberOfLines={2}>
            {e.title}
          </Text>
        </View>
        <Text variant="footnote" color={colors.textSecondary}>
          {e.subtitle}
        </Text>
        {e.detail ? (
          <Text variant="caption" color={colors.textTertiary}>
            {e.detail}
            {e.kind !== 'meteor' && e.kind !== 'season' ? ` · ${formatTime(e.date, tz, use24h)}` : ''}
          </Text>
        ) : null}
        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text variant="caption" color={colors.text}>
              {formatDaysUntil(days)}
            </Text>
          </View>
          {e.visibleHere ? (
            <View style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
              <Icon name="eye" size={11} color={colors.accent} />
              <Text variant="caption" color={colors.accent}>
                {tx.events.visibleHere}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Horizontal day strip + a summary of the chosen day. */
function DayPlanner() {
  const place = usePlace();
  const now = useNow(60_000);
  const use24h = useApp((s) => s.use24h);
  const tx = useT();
  const tz = place.tz;
  const start = useMemo(() => startOfDay(now, tz), [now, tz]);
  const days = useMemo(() => Array.from({ length: 60 }, (_, i) => addDays(start, i, tz)), [start, tz]);
  const [index, setIndex] = useState(0);
  const selected = days[index] ?? start;
  const info = useMemo(() => {
    const sun = computeSunDay(place, selected);
    const moon = computeMoonDay(place, selected);
    const ms = moonState(new Date(selected.getTime() + 12 * 3_600_000));
    return { sun, moon, ms };
  }, [place, selected]);
  const t = (d: Date | null) => formatTime(d, tz, use24h);

  return (
    <View style={{ gap: space.sm }}>
      <FlatList
        horizontal
        data={days}
        keyExtractor={(d) => String(d.getTime())}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}
        getItemLayout={(_, i) => ({ length: 56, offset: space.md + i * 56, index: i })}
        renderItem={({ item, index: i }) => {
          const w = wallClock(item, tz);
          const active = i === index;
          return (
            <PressableScale onPress={() => setIndex(i)} hapticOnPress="tick" style={[styles.day, active && styles.dayActive]} accessibilityLabel={formatDate(item, tz, 'weekday')}>
              <Text variant="caption" color={active ? colors.onPrimary : colors.textSecondary}>
                {i === 0 ? tx.relative.today : WEEKDAYS_SHORT[w.weekday]}
              </Text>
              <Text variant="headline" color={active ? colors.onPrimary : colors.text}>
                {w.day}
              </Text>
            </PressableScale>
          );
        }}
      />
      <View style={{ paddingHorizontal: space.md }}>
        <Card title={capitalize(formatDate(selected, tz, 'weekday'))} icon="calendar">
          <View style={styles.planRow}>
            <Metric label={tx.sun.rise} icon="sunrise" value={t(info.sun.sunrise)} />
            <Metric label={tx.sun.set} icon="sunset" value={t(info.sun.sunset)} />
            <Metric label={tx.events.duration} icon="hourglass" value={formatDuration(info.sun.dayLengthMin, { compact: true })} />
          </View>
          <Divider style={{ marginVertical: space.sm }} />
          <View style={styles.planRow}>
            <Metric label={tx.sun.goldenShort} value={info.sun.goldenEvening.start ? `${t(info.sun.goldenEvening.start)}` : '—'} sub={tx.events.inTheEvening} color={colors.golden} />
            <Metric label={tx.sun.blueShort} value={info.sun.blueEvening.start ? `${t(info.sun.blueEvening.start)}` : '—'} sub={tx.events.inTheEvening} color="#9DB2FF" />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <MoonGlyph size={30} angle={info.ms.angle} southern={place.latitude < 0} glow={false} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
                  {PHASE_LABEL[info.ms.key]}
                </Text>
                <Text variant="subhead">{Math.round(info.ms.illumination * 100)}%</Text>
              </View>
            </View>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  filters: { paddingHorizontal: space.md, gap: space.xs, paddingVertical: space.xs },
  filter: {
    paddingHorizontal: space.md,
    height: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  eventRow: { flexDirection: 'row', gap: space.sm, padding: space.md },
  dateBadge: {
    width: 44,
    height: 52,
    borderRadius: radius.tile,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  day: {
    width: 48,
    height: 62,
    borderRadius: radius.tile,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planRow: { flexDirection: 'row', gap: space.sm },
});
