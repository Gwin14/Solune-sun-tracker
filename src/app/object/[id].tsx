import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { directionName, formatDegrees, formatNumber, formatTime } from '@/astro/format';
import { moonState } from '@/astro/moon';
import { catalog } from '@/astro/sky/catalog';
import { altAz, constellationAt, enuFromAltAz, enuToEquator, horizonFrame, planViewing, type HorizonFrame } from '@/astro/sky/engine';
import { ASTERISMS, DSO_KIND_LABEL, DSOS } from '@/astro/sky/names';
import { describeTarget, kindOf, targetEnu, targetEqjAt, type TargetId, type TargetKind } from '@/astro/sky/targets';
import { fetchWikiArticle } from '@/astro/sky/wiki';
import { moonPosition, observer, sunPosition } from '@/astro/sun';
import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { SkyChart } from '@/components/planetarium/SkyChart';
import { PressableScale } from '@/components/Pressable';
import { Metric } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TopFade } from '@/components/TopFade';
import { useNow, usePlace } from '@/hooks/useAstro';
import { pointSkyAt } from '@/store/skyIntent';
import { useApp } from '@/store/app';
import { colors, radius, space } from '@/theme/tokens';

/** Objects whose shape is the point: their hero is the sky chart, not a photo. */
const CHART_HERO: TargetKind[] = ['constellation', 'asterism', 'pole'];

const fmt1 = (v: number) => v.toFixed(1).replace('.', ',');

export default function ObjectScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = raw as TargetId;
  const place = usePlace();
  const now = useNow(60_000);
  const model = useMemo(() => buildModel(id, place, now), [id, place, now]);
  if (!model) return <Missing />;
  return <ObjectPage id={id} model={model} />;
}

type Model = NonNullable<ReturnType<typeof buildModel>>;

function buildModel(id: TargetId, place: ReturnType<typeof usePlace>, now: Date) {
  try {
    const kind = kindOf(id);
    const frame = horizonFrame(place, now);
    const obs = observer(place);
    const sun = sunPosition(now, obs);
    const moon = moonPosition(now, obs);
    const phase = moonState(now);
    const bodies = { sun: enuFromAltAz(sun.alt, sun.az), moon: enuFromAltAz(moon.alt, moon.az) };
    const enu = targetEnu(frame, id, bodies);
    if (!enu) return null;
    const info = describeTarget(frame, id, { moonIllum: phase.illumination, moonDistKm: phase.distanceKm });
    const pos = altAz(enu[0], enu[1], enu[2]);
    const at = targetEqjAt(id, place);
    const plan = at ? planViewing(place, now, at) : null;
    return { kind, frame, enu, info, pos, plan, phase, facts: facts(id, kind, frame, enu, phase.distanceKm) };
  } catch {
    // An id from an older build or a mistyped link.
    return null;
  }
}

function facts(id: TargetId, kind: TargetKind, frame: HorizonFrame, enu: ArrayLike<number>, moonKm: number): { label: string; value: string }[] {
  const cat = catalog();
  const out: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => value && out.push({ label, value });
  const constellation = () => cat.constellationById.get(constellationAt(frame, enu[0], enu[1], enu[2]))?.name;

  switch (kind) {
    case 'star': {
      const i = Number(id.slice(5));
      const named = cat.namedByIndex.get(i);
      add('Tipo', 'Estrela');
      add('Constelação', constellation());
      add('Brilho aparente', `${fmt1(cat.mag[i])} (quanto menor, mais brilhante)`);
      add('Distância', named?.ly ? `${named.ly < 100 ? fmt1(named.ly) : formatNumber(named.ly)} anos-luz` : null);
      add('Catálogo Hipparcos', `HIP ${cat.hip[i]}`);
      break;
    }
    case 'planet': {
      const p = frame.planets.find((x) => `planet:${x.id}` === id);
      add('Tipo', 'Planeta');
      add('Constelação', p ? cat.constellationById.get(p.constellation)?.name : null);
      add('Brilho aparente', p ? fmt1(p.mag) : null);
      add('Distância da Terra', p ? `${formatNumber((p.dist * 149_597_870.7) / 1e6)} milhões de km` : null);
      break;
    }
    case 'dso': {
      const d = DSOS.find((x) => `dso:${x.id}` === id);
      add('Tipo', d ? DSO_KIND_LABEL[d.kind] : null);
      add('Constelação', constellation());
      add('Brilho aparente', d && d.mag < 50 ? fmt1(d.mag) : null);
      add('Tamanho no céu', d ? (d.size >= 1 ? `${fmt1(d.size)}°` : `${Math.round(d.size * 60)}′ de arco`) : null);
      add('Distância', d ? `${formatNumber(d.ly)} anos-luz` : null);
      break;
    }
    case 'constellation': {
      const c = cat.constellationById.get(id.slice(6));
      add('Nome oficial', c?.latin);
      add('Estrelas no desenho', c ? String(new Set(c.lines.flatMap((l) => Array.from({ length: l.length / 3 }, (_, k) => `${l[k * 3].toFixed(5)},${l[k * 3 + 1].toFixed(5)}`))).size) : null);
      break;
    }
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
      add('Tipo', 'Asterismo: um desenho de estrelas que não é uma constelação oficial');
      add('Estrelas', a ? String(a.members.length) : null);
      add('Constelação', constellation());
      break;
    }
    case 'moon':
      add('Distância da Terra', `${formatNumber(moonKm)} km`);
      break;
    case 'sun':
      add('Distância da Terra', '149,6 milhões de km');
      add('Tipo', 'Anã amarela');
      break;
    case 'galactic':
      add('Distância', '26 mil anos-luz');
      add('Constelação', 'Sagitário');
      break;
    case 'pole':
      add('Altura acima do horizonte', formatDegrees(Math.abs(frame.latitude)));
      break;
  }
  if (kind !== 'constellation' && kind !== 'asterism' && kind !== 'pole') {
    const eq = enuToEquator(frame, enu[0], enu[1], enu[2]);
    const h = Math.floor(eq.ra);
    const m = Math.round((eq.ra - h) * 60);
    const d = Math.abs(eq.dec);
    out.push({ label: 'Coordenadas', value: `AR ${h}h ${String(m % 60).padStart(2, '0')}m · Dec ${eq.dec < 0 ? '−' : '+'}${Math.floor(d)}° ${String(Math.round((d % 1) * 60)).padStart(2, '0')}′` });
  }
  return out;
}

function ObjectPage({ id, model }: { id: TargetId; model: Model }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const use24h = useApp((s) => s.use24h);
  const place = usePlace();
  const tz = place.tz;
  const { kind, info, pos, plan, frame, enu } = model;
  const chartHero = CHART_HERO.includes(kind);
  const wiki = useQuery({
    queryKey: ['wiki', id],
    queryFn: ({ signal }) => fetchWikiArticle(id, signal),
    staleTime: Infinity,
  });
  const [photoShown, setPhotoShown] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = !chartHero && kind !== 'moon' && !photoFailed ? wiki.data?.image : null;
  const heroH = Math.round(Math.min(width * 0.92, 400)) + insets.top;
  const up = pos.alt > 0;
  const t = (d: Date | null) => formatTime(d, tz, use24h);
  const highlight = kind === 'constellation' ? id.slice(6) : null;
  const chartFov = useMemo(() => fitFov(frame, id, enu), [frame, id, enu]);

  const showInSky = () => {
    pointSkyAt(id);
    router.back();
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.root} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={{ height: heroH, backgroundColor: colors.ink }}>
          {kind === 'moon' ? (
            <View style={[StyleSheet.absoluteFill, styles.centred, { paddingTop: insets.top }]}>
              <MoonGlyph size={Math.min(width * 0.58, 240)} angle={model.phase.angle} southern={place.latitude < 0} />
            </View>
          ) : chartHero || (wiki.isFetched && !photo) ? (
            <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]}>
              <SkyChart frame={frame} centre={enu} width={width} height={heroH - insets.top} fov={chartFov} selected={id} highlight={highlight} ring={!chartHero} color={info.color} />
            </View>
          ) : (
            <>
              {/* While the picture loads: the object's own colour as a soft glow. */}
              {photoShown ? null : (
                <View style={[StyleSheet.absoluteFill, styles.centred, { paddingTop: insets.top }]}>
                  <View style={[styles.glow, { backgroundColor: info.color, boxShadow: `0 0 60px 20px ${info.color}66` }]} />
                </View>
              )}
              {photo ? (
                <Image
                  source={{ uri: photo.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={260}
                  onDisplay={() => setPhotoShown(true)}
                  onError={() => setPhotoFailed(true)}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </>
          )}
          <LinearGradient pointerEvents="none" colors={['rgba(5,8,26,0.55)', 'rgba(5,8,26,0)']} style={[styles.fadeTop, { height: insets.top + 56 }]} />
          <LinearGradient pointerEvents="none" colors={['rgba(5,8,26,0)', colors.ink]} style={styles.fadeBottom} />
        </View>

        <View style={styles.body}>
          <View style={{ gap: 2 }}>
            <Text variant="largeTitle" selectable>
              {info.title}
            </Text>
            <Text variant="callout" color={colors.textSecondary}>
              {info.subtitle}
            </Text>
          </View>

          <View style={[styles.status, up && { borderColor: 'rgba(242,190,110,0.4)' }]}>
            <Icon name={up ? 'eye' : 'sunHorizon'} size={14} color={up ? colors.accent : colors.textSecondary} />
            <Text variant="subhead" style={{ flexShrink: 1 }}>
              {up
                ? `No céu agora, ${formatDegrees(pos.alt)} acima do horizonte, a ${directionName(pos.az)}`
                : `Abaixo do horizonte agora: ${formatDegrees(-pos.alt)} abaixo, a ${directionName(pos.az)}`}
            </Text>
          </View>

          <Button label="Ver no céu" icon="viewfinder" onPress={showInSky} />

          {plan ? (
            <Card title="Próximas 24 horas" icon="clock">
              {plan.alwaysUp ? (
                <Text variant="subhead" color={colors.textSecondary}>
                  Nunca se põe daqui: gira o dia todo acima do horizonte.
                </Text>
              ) : plan.neverUp ? (
                <Text variant="subhead" color={colors.textSecondary}>
                  Não nasce nas próximas 24 horas vista daqui.
                </Text>
              ) : (
                <View style={styles.row}>
                  <Metric label="Nasce" value={t(plan.rise)} icon="arrowUp" />
                  <Metric label="Se põe" value={t(plan.set)} icon="sunHorizon" />
                  <Metric label="Altura máxima" value={formatDegrees(plan.maxAlt)} />
                </View>
              )}
              {plan.best ? (
                <>
                  <Divider style={{ marginVertical: space.sm }} />
                  <View style={styles.best}>
                    <Icon name="stars" size={14} color={colors.accent} />
                    <Text variant="subhead" style={{ flex: 1 }}>
                      {plan.best.dark ? 'Melhor horário à noite' : 'Melhor horário no crepúsculo'}
                    </Text>
                    <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
                      {t(plan.best.time)} · {formatDegrees(plan.best.alt)}
                    </Text>
                  </View>
                </>
              ) : null}
            </Card>
          ) : null}

          <About info={info} extract={wiki.data?.extract ?? null} url={wiki.data?.url ?? null} loading={wiki.isPending} failed={wiki.isError} onRetry={() => wiki.refetch()} />

          {!chartHero && kind !== 'sun' ? (
            <Card
              title="Onde fica no céu"
              icon="compass"
              padded={false}
              accessory={
                up ? null : (
                  <Text variant="caption" color={colors.textTertiary}>
                    Abaixo do horizonte
                  </Text>
                )
              }>
              <View style={styles.chart}>
                <SkyChart frame={frame} centre={enu} width={width - space.md * 2 - 2} height={240} fov={kind === 'moon' || kind === 'planet' ? 40 : chartFov} selected={id} color={info.color} />
              </View>
            </Card>
          ) : null}

          {model.facts.length ? (
            <Card title="Ficha" icon="info">
              {model.facts.map((f, i) => (
                <View key={f.label}>
                  {i ? <Divider /> : null}
                  <View style={styles.fact}>
                    <Text variant="subhead" color={colors.textSecondary}>
                      {f.label}
                    </Text>
                    <Text variant="subhead" align="right" style={styles.factValue} selectable>
                      {f.value}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {wiki.data?.extract || photo ? (
            <Text variant="caption" color={colors.textTertiary} align="center">
              {photo ? 'Imagem e texto da Wikipédia (CC BY-SA)' : 'Texto da Wikipédia (CC BY-SA)'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <TopFade />
    </View>
  );
}

function About({ info, extract, url, loading, failed, onRetry }: { info: Model['info']; extract: string | null; url: string | null; loading: boolean; failed: boolean; onRetry: () => void }) {
  if (!info.note && !info.distance && !info.flag && !extract && !loading && !failed) return null;
  return (
    <Card title="Sobre" icon="sparkle">
      <View style={{ gap: space.sm }}>
        {info.note ? <Text variant="body">{info.note}</Text> : null}
        {info.distance ? (
          <Text variant="subhead" color={colors.textSecondary}>
            {info.distance}
          </Text>
        ) : null}
        {info.flag ? (
          <View style={styles.flag}>
            <View style={styles.flagMark} />
            <Text variant="subhead" color={colors.textSecondary} style={{ flex: 1 }}>
              Na bandeira do Brasil, representa {info.flag}.
            </Text>
          </View>
        ) : null}
        {loading ? (
          <View style={{ gap: 8 }} accessibilityLabel="Carregando descrição">
            {[1, 0.94, 0.62].map((w, i) => (
              <View key={i} style={[styles.skeleton, { width: `${w * 100}%` }]} />
            ))}
          </View>
        ) : extract ? (
          <>
            {info.note ? <Divider /> : null}
            <Text variant="subhead" color={colors.textSecondary} selectable>
              {extract}
            </Text>
            {url ? (
              <PressableScale onPress={() => WebBrowser.openBrowserAsync(url)} hapticOnPress="soft" style={styles.link} accessibilityRole="link">
                <Icon name="globe" size={13} color={colors.text} />
                <Text variant="subhead">Ler na Wikipédia</Text>
                <Icon name="chevronRight" size={11} color={colors.textSecondary} />
              </PressableScale>
            ) : null}
          </>
        ) : failed ? (
          <PressableScale onPress={onRetry} hapticOnPress="soft" style={styles.link} accessibilityRole="button">
            <Icon name="arrowCounter" size={13} color={colors.text} />
            <Text variant="subhead">Sem conexão para a descrição completa. Tentar de novo</Text>
          </PressableScale>
        ) : null}
      </View>
    </Card>
  );
}

function Missing() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.centred, { padding: space.xl, paddingTop: insets.top + space.xxl, gap: space.md }]}>
      <Icon name="stars" size={36} color={colors.textSecondary} />
      <Text variant="title3" align="center">
        Objeto não encontrado
      </Text>
      <Text variant="subhead" color={colors.textSecondary} align="center">
        Ele não está no catálogo desta versão do Solune.
      </Text>
      <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

/** A field of view that fits a figure (constellation, asterism) with some sky around it. */
function fitFov(frame: HorizonFrame, id: TargetId, centre: ArrayLike<number>): number {
  const cat = catalog();
  const verts: ArrayLike<number>[] = [];
  const kind = kindOf(id);
  if (kind === 'constellation') {
    const i = cat.constellations.findIndex((c) => c.id === id.slice(6));
    for (const pl of frame.lines[i] ?? []) for (let k = 0; k < pl.length; k += 3) verts.push(pl.subarray(k, k + 3));
  } else if (kind === 'asterism') {
    const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
    for (const h of a?.members ?? []) {
      const i = cat.byHip.get(h);
      if (i != null) verts.push(frame.stars.subarray(i * 3, i * 3 + 3));
    }
  } else if (kind === 'pole') return 70;
  else if (kind === 'dso') {
    const d = DSOS.find((x) => `dso:${x.id}` === id);
    return Math.max(24, Math.min(60, (d?.size ?? 1) * 6));
  } else return 48;
  let max = 0;
  for (const v of verts) {
    const dot = v[0] * centre[0] + v[1] * centre[1] + v[2] * centre[2];
    max = Math.max(max, Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI));
  }
  return Math.max(26, Math.min(100, max * 2.6));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  centred: { alignItems: 'center', justifyContent: 'center' },
  glow: { width: 28, height: 28, borderRadius: 14 },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  fadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  body: { paddingHorizontal: space.md, gap: space.sm, marginTop: -space.xl },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderRadius: radius.tile,
    borderCurve: 'continuous',
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    marginTop: space.xs,
  },
  row: { flexDirection: 'row', gap: space.sm },
  best: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  chart: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, overflow: 'hidden', backgroundColor: '#02040D' },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 10 },
  factValue: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  skeleton: { height: 12, borderRadius: 6, backgroundColor: colors.fill },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagMark: { width: 10, height: 7, borderRadius: 1.5, backgroundColor: '#2BA84A', borderWidth: 1.5, borderColor: '#F7D117' },
});
