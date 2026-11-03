import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { compassPoint, formatDegrees } from '@/astro/format';
import type { SearchEntry, TargetId } from '@/astro/sky/targets';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

export type FindRow = SearchEntry & { alt: number | null; az: number | null; color?: string };

type Props = {
  rows: FindRow[];
  favorites: string[];
  onPick: (id: TargetId) => void;
  onClose: () => void;
};

type Group = SearchEntry['group'] | 'Favoritos';

const GROUP_ICON: Record<Group, IconName> = {
  Favoritos: 'star',
  Destaques: 'sparkle',
  Planetas: 'orbit',
  Estrelas: 'star',
  'Céu profundo': 'telescope',
  Constelações: 'constellation',
};
const ORDER: Group[] = ['Favoritos', 'Destaques', 'Planetas', 'Estrelas', 'Céu profundo', 'Constelações'];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Names never change, so each entry is folded once for the life of the app. */
const folded = new Map<string, string>();
const searchKey = (r: FindRow) => {
  let k = folded.get(r.id);
  if (k == null) {
    k = `${fold(r.name)}\n${fold(r.hint)}`;
    folded.set(r.id, k);
  }
  return k;
};

type Section = { key: Group; g: Group; data: FindRow[] };

export const FindSheet = memo(function FindSheet({ rows, favorites, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [onlyVisible, setOnlyVisible] = useState(false);
  // Typing stays responsive: the list catches up with the query in a lower-priority render.
  const deferredQuery = useDeferredValue(query);

  const sections = useMemo(() => {
    const q = fold(deferredQuery.trim());
    const filtered = rows.filter((r) => (!q || searchKey(r).includes(q)) && (!onlyVisible || (r.alt ?? -1) > 0));
    const byId = new Map(filtered.map((r) => [r.id, r]));
    const out: Section[] = [];
    for (const g of ORDER) {
      // Favourites also stay in their own group, so searching finds them where expected.
      let data = g === 'Favoritos' ? favorites.map((id) => byId.get(id as TargetId)).filter((r): r is FindRow => !!r) : filtered.filter((r) => r.group === g);
      // Planets: what is up right now comes first.
      if (g === 'Planetas') data = [...data].sort((a, b) => (b.alt ?? -90) - (a.alt ?? -90));
      if (data.length) out.push({ key: g, g, data });
    }
    return out;
  }, [rows, deferredQuery, onlyVisible, favorites]);
  const starred = useMemo(() => new Set(favorites), [favorites]);

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.scrim]}>
      <Animated.View entering={SlideInDown.duration(320).easing(EASE_OUT)} exiting={SlideOutDown.duration(220)} style={[styles.sheet, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text variant="title2">Encontrar no céu</Text>
          <PressableScale onPress={onClose} hapticOnPress="soft" accessibilityLabel="Fechar" accessibilityRole="button" style={styles.close}>
            <Icon name="close" size={14} color={colors.text} />
          </PressableScale>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Icon name="search" size={15} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Estrela, planeta, constelação…"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <PressableScale
            onPress={() => setOnlyVisible((v) => !v)}
            hapticOnPress="tick"
            accessibilityRole="switch"
            accessibilityState={{ checked: onlyVisible }}
            style={[styles.filter, onlyVisible && { backgroundColor: colors.primary }]}>
            <Icon name="eye" size={13} color={onlyVisible ? colors.onPrimary : colors.text} />
            <Text variant="subhead" color={onlyVisible ? colors.onPrimary : colors.text}>
              Visíveis
            </Text>
          </PressableScale>
        </View>
        {/* Virtualized: only the rows on screen are mounted, so opening and typing stay light. */}
        <SectionList
          sections={sections}
          keyExtractor={(r) => r.id}
          renderSectionHeader={({ section }) => <GroupHead g={section.g} />}
          renderItem={({ item, index, section }) => (
            <Row row={item} first={index === 0} last={index === section.data.length - 1} star={section.g !== 'Favoritos' && starred.has(item.id)} onPick={onPick} />
          )}
          stickySectionHeadersEnabled={false}
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: space.xxxl * 2 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text variant="body" color={colors.textSecondary} align="center" style={{ marginTop: space.xxl }}>
              Nada com esse nome no céu de hoje.
            </Text>
          }
        />
      </Animated.View>
    </Animated.View>
  );
});

const GroupHead = memo(function GroupHead({ g }: { g: Group }) {
  return (
    <View style={styles.groupHead}>
      <Icon name={GROUP_ICON[g]} size={13} color={colors.textSecondary} />
      <Text variant="footnote" color={colors.textSecondary}>
        {g}
      </Text>
    </View>
  );
});

const Row = memo(function Row({ row: r, first, last, star, onPick }: { row: FindRow; first: boolean; last: boolean; star: boolean; onPick: (id: TargetId) => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tick();
        onPick(r.id);
      }}
      style={({ pressed }) => [styles.row, first ? styles.rowFirst : styles.rowBorder, last && styles.rowLast, pressed && styles.rowPressed]}
      accessibilityRole="button">
      <View style={[styles.rowDot, { backgroundColor: r.color ?? colors.fillStrong }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTitle}>
          <Text variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
            {r.name}
          </Text>
          {star ? <Icon name="star" size={11} color={colors.accent} /> : null}
        </View>
        <Text variant="footnote" color={colors.textSecondary} numberOfLines={1}>
          {r.hint}
        </Text>
      </View>
      {r.alt != null && r.az != null ? (
        r.alt > 0 ? (
          <Text variant="subhead" color={colors.accent} style={{ fontVariant: ['tabular-nums'] }}>
            {formatDegrees(r.alt)} {compassPoint(r.az)}
          </Text>
        ) : (
          <Text variant="footnote" color={colors.textTertiary}>
            abaixo
          </Text>
        )
      ) : null}
      <Icon name="chevronRight" size={12} color={colors.textTertiary} />
    </Pressable>
  );
});

const rowBg = 'rgba(255,255,255,0.05)';

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  sheet: { flex: 1, backgroundColor: 'rgba(6,9,26,0.96)', paddingHorizontal: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: space.sm, height: 40 },
  input: { flex: 1, color: colors.text, fontSize: 16, height: 40 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: space.sm, height: 40 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, marginBottom: 6, paddingHorizontal: space.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 10, backgroundColor: rowBg },
  rowFirst: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  rowLast: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowDot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowPressed: { backgroundColor: colors.fill },
});
