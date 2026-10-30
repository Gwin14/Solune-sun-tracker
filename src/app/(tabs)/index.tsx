import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { compassPoint, formatCountdown, formatDegrees, formatDuration, formatSignedMinutes, formatTime } from '@/astro/format';
import { PHASE_LABEL } from '@/astro/moon';
import { shadowRatio, type Window } from '@/astro/sun';
import { Card, Divider } from '@/components/Card';
import { CompassDial, DaylightChart, LegendDot, LightTimeline, PHASE_LEGEND } from '@/components/charts';
import { CheckInCard } from '@/components/CheckInCard';
import { Icon } from '@/components/Icon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { PressableScale } from '@/components/Pressable';
import { IconButton, Metric, Reveal } from '@/components/Screen';
import { SkyBackground } from '@/components/SkyBackground';
import { altitudeAt, SunArc, type ArcEvent } from '@/components/SunArc';
import { useTabBarSpace } from '@/components/TabSpace';
import { Text } from '@/components/Text';
import { TopFade } from '@/components/TopFade';
import { minuteOfDay, useLivePositions, useNow, usePlace, useSunToday, useYearDaylight } from '@/hooks/useAstro';
import { useCheckInWindow } from '@/hooks/useCheckIn';
import { useApp } from '@/store/app';
import { colors, radius, space } from '@/theme/tokens';

type NextEvent = { label: string; date: Date };

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const place = usePlace();
  const now = useNow();
  const use24h = useApp((s) => s.use24h);
  const { today, yesterday, tomorrow, sunPath, moonPath, moonDay } = useSunToday(place, now);
  const live = useLivePositions(place, now);
  const nowMin = minuteOfDay(now, place.tz);
  const southern = place.latitude < 0;
  const tz = place.tz;
  const t = (d: Date | null) => formatTime(d, tz, use24h);

  const scrub = useSharedValue(nowMin);
  const lastNow = useRef(nowMin);
  useEffect(() => {
    // Follow the clock unless the user has scrubbed away from "now".
    if (Math.abs(scrub.get() - lastNow.current) < 5) scrub.set(nowMin);
    lastNow.current = nowMin;
  }, [nowMin, scrub]);
  const skyAlt = useDerivedValue(() => altitudeAt(sunPath.alt, scrub.get()));
  const glowX = useDerivedValue(() => scrub.get() / 1440);

  const next: NextEvent | null = useMemo(() => {
    const list: NextEvent[] = [];
    const push = (label: string, d: Date | null) => d && list.push({ label, date: d });
    for (const day of [today, tomorrow]) {
      push('Nascer do sol', day.sunrise);
      push('Hora dourada', day.goldenEvening.start);
      push('Pôr do sol', day.sunset);
    }
    return list.filter((e) => e.date.getTime() > now.getTime()).sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
  }, [today, tomorrow, now]);

  const arcEvents: ArcEvent[] = useMemo(() => {
    const out: ArcEvent[] = [];
    const add = (label: string, d: Date | null) => d && out.push({ label, minute: minuteOfDay(d, tz) });
    add('Nascer', today.sunrise);
    add('Meio-dia', today.noon);
    add('Pôr', today.sunset);
    add('Dourada', today.goldenEvening.start);
    add('Dourada manhã', today.goldenMorning.end);
    return out;
  }, [today, tz]);

  const year = useYearDaylight(place, now.getUTCFullYear());
  const window = useCheckInWindow({ now, tz, today, tomorrow, sunAlt: live.sun.alt, moonAlt: live.moon.alt, use24h });
  const dayDelta = today.dayLengthMin - yesterday.dayLengthMin;
  const shadow = shadowRatio(live.sun.alt);
  const longest = Math.max(...year.map((y) => y.minutes));
  const shortest = Math.min(...year.map((y) => y.minutes));

  return (
    <View style={styles.root}>
      <SkyBackground altitude={skyAlt} glowX={glowX} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.xs, paddingBottom: bottom, paddingHorizontal: space.md, gap: space.sm }}>
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.push('/locations')} style={styles.placeBtn} hapticOnPress="soft" accessibilityLabel={`Local: ${place.name}. Trocar local`}>
            <Icon name={place.id === 'current' ? 'location' : 'pin'} size={14} color={colors.text} />
            <Text variant="subhead" numberOfLines={1} style={{ maxWidth: 220 }}>
              {place.name}
            </Text>
            <Icon name="chevronDown" size={12} color={colors.textSecondary} />
          </PressableScale>
          <IconButton icon="settings" label="Ajustes" onPress={() => router.push('/settings')} />
        </View>

        <Reveal index={0} style={styles.hero}>
          {next ? (
            <>
              <Text variant="display" align="center" selectable>
                {t(next.date)}
              </Text>
              <Text variant="title3" align="center">
                {next.label} {formatCountdown(next.date.getTime() - now.getTime())}
              </Text>
            </>
          ) : (
            <>
              <Text variant="hero" align="center">
                {today.polar === 'day' ? 'Sol da meia-noite' : 'Noite polar'}
              </Text>
              <Text variant="title3" align="center">
                {today.polar === 'day' ? 'O sol não se põe hoje.' : 'O sol não nasce hoje.'}
              </Text>
            </>
          )}
          <Text variant="callout" color={colors.textSecondary} align="center" style={{ marginTop: space.xxs }}>
            Dia de {formatDuration(today.dayLengthMin)} · {formatSignedMinutes(dayDelta)} que ontem
          </Text>
        </Reveal>

        <Reveal index={1}>
          <Card title="Trajeto de hoje" icon="sun" accessory={<Hint />}>
            <SunArc
              sunAlt={sunPath.alt}
              moonAlt={moonPath.alt}
              nowMinute={nowMin}
              scrub={scrub}
              events={arcEvents}
              use24h={use24h}
              moonAngle={live.moonState.angle}
              southern={southern}
            />
          </Card>
        </Reveal>

        <Reveal index={2} style={styles.row}>
          <Card title="Nascer" icon="sunrise" style={{ flex: 1 }}>
            <Text variant="metric" selectable>
              {t(today.sunrise)}
            </Text>
            <Text variant="footnote" color={colors.textSecondary}>
              {today.sunriseAzimuth != null ? `${formatDegrees(today.sunriseAzimuth)} ${compassPoint(today.sunriseAzimuth)}` : '—'}
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Amanhã {t(tomorrow.sunrise)}
            </Text>
          </Card>
          <Card title="Pôr" icon="sunset" style={{ flex: 1 }}>
            <Text variant="metric" selectable>
              {t(today.sunset)}
            </Text>
            <Text variant="footnote" color={colors.textSecondary}>
              {today.sunsetAzimuth != null ? `${formatDegrees(today.sunsetAzimuth)} ${compassPoint(today.sunsetAzimuth)}` : '—'}
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Amanhã {t(tomorrow.sunset)}
            </Text>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <Card title="Horas mágicas" icon="sparkle">
            <View style={{ gap: space.sm }}>
              <MagicRow label="Manhã" blue={today.blueMorning} golden={today.goldenMorning} order="blueFirst" t={t} />
              <Divider />
              <MagicRow label="Tarde" blue={today.blueEvening} golden={today.goldenEvening} order="goldenFirst" t={t} />
            </View>
            <Text variant="caption" color={colors.textTertiary} style={{ marginTop: space.sm }}>
              Dourada: sol entre −4° e 6°. Azul: entre −6° e −4°.
            </Text>
          </Card>
        </Reveal>

        <Reveal index={4}>
          <Card title="Luz ao longo do dia" icon="clock">
            <LightTimeline sunAlt={sunPath.alt} nowMinute={nowMin} />
            <View style={styles.legend}>
              {PHASE_LEGEND.map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <LegendDot color={l.color} />
                  <Text variant="caption" color={colors.textSecondary}>
                    {l.label}
                  </Text>
                </View>
              ))}
            </View>
            <Divider style={{ marginVertical: space.sm }} />
            <TwilightRow label="Crepúsculo civil" w={today.civil} t={t} />
            <TwilightRow label="Crepúsculo náutico" w={today.nautical} t={t} />
            <TwilightRow label="Crepúsculo astronômico" w={today.astronomical} t={t} />
            <TwilightRow label="Meio-dia solar" w={{ start: today.noon, end: null }} t={t} single={`${t(today.noon)} · ${formatDegrees(today.noonAltitude)}`} />
          </Card>
        </Reveal>

        <Reveal index={5}>
          <Card title={PHASE_LABEL[live.moonState.key]} icon="moon" iconColor={colors.moon} onPress={() => router.navigate('/moon')} accessory={<Icon name="chevronRight" size={13} color={colors.textTertiary} />}>
            <View style={styles.moonRow}>
              <MoonGlyph size={76} angle={live.moonState.angle} southern={southern} />
              <View style={{ flex: 1, gap: space.sm }}>
                <View style={styles.row}>
                  <Metric label="Iluminação" value={`${Math.round(live.moonState.illumination * 100)}%`} />
                  <Metric label="Idade" value={`${live.moonState.ageDays.toFixed(1).replace('.', ',')} d`} />
                </View>
                <View style={styles.row}>
                  <Metric label="Nasce" value={t(moonDay.moonrise)} />
                  <Metric label="Põe" value={t(moonDay.moonset)} />
                </View>
              </View>
            </View>
          </Card>
        </Reveal>

        <Reveal index={6}>
          <Card title="Posição agora" icon="compass">
            <View style={styles.moonRow}>
              <CompassDial
                size={148}
                sunAz={live.sun.az}
                sunAlt={live.sun.alt}
                moonAz={live.moon.az}
                moonAlt={live.moon.alt}
                riseAz={today.sunriseAzimuth}
                setAz={today.sunsetAzimuth}
              />
              <View style={{ flex: 1, gap: space.sm }}>
                <Metric label="Altitude do sol" value={formatDegrees(live.sun.alt, 1)} color={live.sun.alt > 0 ? colors.accent : colors.text} />
                <Metric label="Direção" value={`${formatDegrees(live.sun.az)} ${compassPoint(live.sun.az)}`} />
                <Metric label="Sua sombra" value={shadow ? `${shadow.toFixed(1).replace('.', ',')}×` : '—'} sub={shadow ? 'da sua altura' : 'sol abaixo do horizonte'} />
              </View>
            </View>
          </Card>
        </Reveal>

        <Reveal index={7}>
          <CheckInCard window={window} tz={tz} moonIllum={live.moonState.illumination} />
        </Reveal>

        <Reveal index={8}>
          <Card title="Duração do dia no ano" icon="hourglass">
            <DaylightChart data={year} todayT={now.getTime()} />
            <View style={[styles.row, { marginTop: space.sm }]}>
              <Metric label="Mais longo" value={formatDuration(longest, { compact: true })} />
              <Metric label="Mais curto" value={formatDuration(shortest, { compact: true })} />
              <Metric label="Hoje" value={formatDuration(today.dayLengthMin, { compact: true })} color={colors.accent} />
            </View>
          </Card>
        </Reveal>

        <Text variant="caption" color={colors.textTertiary} align="center" style={{ marginTop: space.xs }}>
          {place.name}
          {place.region ? `, ${place.region}` : ''} · {place.latitude.toFixed(3)}, {place.longitude.toFixed(3)}
        </Text>
      </ScrollView>
      <TopFade />
    </View>
  );
}

function Hint() {
  return (
    <View style={styles.hint}>
      <Icon name="hand" size={11} color={colors.textTertiary} />
      <Text variant="caption" color={colors.textTertiary}>
        Arraste
      </Text>
    </View>
  );
}

function MagicRow({ label, blue, golden, order, t }: { label: string; blue: Window; golden: Window; order: 'blueFirst' | 'goldenFirst'; t: (d: Date | null) => string }) {
  const chips = [
    { key: 'blue', name: 'Azul', w: blue, color: colors.blue },
    { key: 'golden', name: 'Dourada', w: golden, color: colors.golden },
  ];
  if (order === 'goldenFirst') chips.reverse();
  return (
    <View style={styles.magicRow}>
      <Text variant="subhead" color={colors.textSecondary} style={{ width: 56 }}>
        {label}
      </Text>
      {chips.map((c) => (
        <View key={c.key} style={[styles.chip, { backgroundColor: `${c.color}2E`, borderColor: `${c.color}66` }]}>
          <LegendDot color={c.color} />
          <View>
            <Text variant="caption" color={colors.textSecondary}>
              {c.name}
            </Text>
            <Text variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
              {c.w.start && c.w.end ? `${t(c.w.start)}–${t(c.w.end)}` : '—'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TwilightRow({ label, w, t, single }: { label: string; w: Window; t: (d: Date | null) => string; single?: string }) {
  return (
    <View style={styles.twRow}>
      <Text variant="callout" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="callout" style={{ fontVariant: ['tabular-nums'] }}>
        {single ?? `${t(w.start)}  ·  ${t(w.end)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  placeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  hero: { alignItems: 'center', paddingVertical: space.xl },
  row: { flexDirection: 'row', gap: space.sm },
  moonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: 6, marginTop: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  magicRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.tile,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  twRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
});
