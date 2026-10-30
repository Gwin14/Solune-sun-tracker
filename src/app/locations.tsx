import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { formatTime } from '@/astro/format';
import { computeSunDay } from '@/astro/sun';
import { startOfDay } from '@/astro/time';
import { Divider } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { searchCities } from '@/lib/cities';
import { haptic } from '@/lib/haptics';
import { geocodePlaces, refreshCurrentLocation } from '@/lib/location';
import { rescheduleNotifications } from '@/lib/notifications';
import { DEFAULT_PLACE, useApp, type SavedPlace } from '@/store/app';
import { colors, weight, radius, space } from '@/theme/tokens';

export default function LocationsScreen() {
  const current = useApp((s) => s.current);
  const places = useApp((s) => s.places);
  const selectedId = useApp((s) => s.selectedId);
  const use24h = useApp((s) => s.use24h);
  const { addPlace, removePlace, selectPlace } = useApp.getState();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const local = searchCities(query).map<SavedPlace>((c) => ({
    id: `city-${c.name}`,
    name: c.name,
    region: c.region,
    latitude: c.latitude,
    longitude: c.longitude,
    tz: c.tz,
  }));

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) return;
    timer.current = setTimeout(async () => {
      const hits = await geocodePlaces(query);
      setRemote(hits.filter((h) => !local.some((l) => Math.abs(l.latitude - h.latitude) < 0.2 && Math.abs(l.longitude - h.longitude) < 0.2)));
      setLoading(false);
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const choose = (id: string) => {
    haptic.light();
    selectPlace(id);
    rescheduleNotifications();
    router.back();
  };

  const useCurrent = async () => {
    setLocating(true);
    setLocError(null);
    const res = await refreshCurrentLocation(true);
    setLocating(false);
    if (res === 'ok') choose('current');
    else {
      haptic.warning();
      setLocError(res === 'denied' ? 'Permissão negada. Ative a localização nos ajustes do sistema.' : 'Não foi possível obter sua posição agora.');
    }
  };

  const results = [...local, ...remote];
  const searching = query.trim().length > 0;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ backgroundColor: colors.inkSheet }} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xxxl }}>
        <View style={styles.header}>
          <Text variant="title2">Locais</Text>
        </View>
        <View style={styles.searchWrap}>
          <Icon name="search" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Buscar cidade"
            placeholderTextColor={colors.textTertiary}
            defaultValue=""
            onChangeText={(q) => {
              setQuery(q);
              const searchable = q.trim().length >= 3;
              setLoading(searchable);
              if (!searchable) setRemote([]);
            }}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={styles.search}
            selectionColor={colors.accent}
          />
          {loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        </View>
        {searching ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.group}>
            {results.length === 0 && !loading ? (
              <View style={{ padding: space.lg, alignItems: 'center', gap: space.xxs }}>
                <Text variant="headline">Nenhum lugar encontrado</Text>
                <Text variant="footnote" color={colors.textSecondary} align="center">
                  Tente o nome da cidade sem abreviações.
                </Text>
              </View>
            ) : null}
            {results.map((p, i) => (
              <Animated.View key={p.id} layout={LinearTransition.duration(180)}>
                {i ? <Divider style={{ marginLeft: space.md }} /> : null}
                <PressableScale
                  scaleTo={0.99}
                  hapticOnPress={null}
                  onPress={() => {
                    addPlace(p);
                    choose(p.id);
                  }}
                  style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text variant="body">{p.name}</Text>
                    {p.region ? (
                      <Text variant="footnote" color={colors.textSecondary}>
                        {p.region}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="plus" size={16} color={colors.accent} />
                </PressableScale>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <>
            <View style={styles.group}>
              <PressableScale scaleTo={0.99} hapticOnPress={null} onPress={current ? () => choose('current') : useCurrent} style={styles.row}>
                <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="location" size={15} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{current ? current.name : 'Usar minha localização'}</Text>
                  <Text variant="footnote" color={colors.textSecondary}>
                    {current ? 'Localização atual' : 'Horários exatos para onde você está'}
                  </Text>
                </View>
                {locating ? <ActivityIndicator color={colors.textSecondary} /> : selectedId === 'current' && current ? <Icon name="check" size={16} color={colors.accent} /> : null}
              </PressableScale>
              {current ? (
                <>
                  <Divider style={{ marginLeft: 60 }} />
                  <PressableScale scaleTo={0.99} hapticOnPress="soft" onPress={useCurrent} style={styles.row}>
                    <View style={styles.badge}>
                      <Icon name="arrowCounter" size={14} color={colors.textSecondary} />
                    </View>
                    <Text variant="callout" color={colors.textSecondary}>
                      Atualizar posição
                    </Text>
                  </PressableScale>
                </>
              ) : null}
            </View>
            {locError ? (
              <Text variant="footnote" color={colors.danger}>
                {locError}
              </Text>
            ) : null}

            <Text variant="headline">Salvos</Text>
            <View style={styles.group}>
              {places.length === 0 ? (
                <View style={{ padding: space.lg, alignItems: 'center', gap: space.xxs }}>
                  <Icon name="globe" size={26} color={colors.textSecondary} />
                  <Text variant="headline">Nenhum lugar salvo</Text>
                  <Text variant="footnote" color={colors.textSecondary} align="center">
                    Busque uma cidade para planejar viagens e fotos em outros céus.
                  </Text>
                </View>
              ) : null}
              {places.map((p, i) => (
                <Animated.View key={p.id} layout={LinearTransition.duration(200)} exiting={FadeOut.duration(140)}>
                  {i ? <Divider style={{ marginLeft: space.md }} /> : null}
                  <SavedRow place={p} selected={selectedId === p.id} use24h={use24h} onPress={() => choose(p.id)} onRemove={() => { haptic.medium(); removePlace(p.id); }} />
                </Animated.View>
              ))}
            </View>
            {!current && places.length === 0 ? (
              <Text variant="caption" color={colors.textTertiary}>
                Enquanto isso, mostramos {DEFAULT_PLACE.name}.
              </Text>
            ) : null}
          </>
        )}
    </ScrollView>
  );
}

function SavedRow({ place, selected, use24h, onPress, onRemove }: { place: SavedPlace; selected: boolean; use24h: boolean; onPress: () => void; onRemove: () => void }) {
  const day = computeSunDay(place, startOfDay(new Date(), place.tz));
  return (
    <PressableScale scaleTo={0.99} hapticOnPress={null} onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{place.name}</Text>
        <Text variant="footnote" color={colors.textSecondary}>
          Nascer {formatTime(day.sunrise, place.tz, use24h)} · Pôr {formatTime(day.sunset, place.tz, use24h)}
        </Text>
      </View>
      {selected ? <Icon name="check" size={16} color={colors.accent} /> : null}
      <PressableScale onPress={onRemove} hapticOnPress={null} style={styles.remove} accessibilityLabel={`Remover ${place.name}`}>
        <Icon name="trash" size={15} color={colors.textTertiary} />
      </PressableScale>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    height: 46,
    borderRadius: radius.tile,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  search: { flex: 1, color: colors.text, fontWeight: weight.medium, fontSize: 16, height: '100%' },
  group: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 60, paddingVertical: space.xs },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
