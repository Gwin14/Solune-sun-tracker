import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { compassPoint, formatDegrees } from '@/astro/format';
import type { SearchEntry, TargetId } from '@/astro/sky/targets';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { colors, radius, space } from '@/theme/tokens';

export type FindRow = SearchEntry & { alt: number | null; az: number | null; color?: string };

type Props = {
  rows: FindRow[];
  onPick: (id: TargetId) => void;
  onClose: () => void;
};

const GROUP_ICON: Record<SearchEntry['group'], IconName> = {
  Destaques: 'sparkle',
  Planetas: 'orbit',
  Estrelas: 'star',
  'Céu profundo': 'telescope',
  Constelações: 'constellation',
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function FindSheet({ rows, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [onlyVisible, setOnlyVisible] = useState(false);

  const groups = useMemo(() => {
    const q = fold(query.trim());
    const filtered = rows.filter((r) => (!q || fold(r.name).includes(q) || fold(r.hint).includes(q)) && (!onlyVisible || (r.alt ?? -1) > 0));
    const order: SearchEntry['group'][] = ['Destaques', 'Planetas', 'Estrelas', 'Céu profundo', 'Constelações'];
    return order
      .map((g) => {
        let items = filtered.filter((r) => r.group === g);
        // Planets: what is up right now comes first.
        if (g === 'Planetas') items = [...items].sort((a, b) => (b.alt ?? -90) - (a.alt ?? -90));
        return { g, items };
      })
      .filter((x) => x.items.length);
  }, [rows, query, onlyVisible]);

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.scrim]}>
      <Animated.View entering={SlideInDown.springify().damping(22).stiffness(220)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom }]}>
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.xxxl * 2 }} showsVerticalScrollIndicator={false}>
          {groups.map(({ g, items }) => (
            <View key={g} style={{ marginTop: space.md }}>
              <View style={styles.groupHead}>
                <Icon name={GROUP_ICON[g]} size={13} color={colors.textSecondary} />
                <Text variant="footnote" color={colors.textSecondary} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {g}
                </Text>
              </View>
              <View style={styles.group}>
                {items.map((r, i) => (
                  <PressableScale key={r.id} scaleTo={0.98} hapticOnPress="tick" onPress={() => onPick(r.id)} style={[styles.row, i > 0 && styles.rowBorder]} accessibilityRole="button">
                    <View style={[styles.rowDot, { backgroundColor: r.color ?? colors.fillStrong }]} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" numberOfLines={1}>
                        {r.name}
                      </Text>
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
                  </PressableScale>
                ))}
              </View>
            </View>
          ))}
          {!groups.length ? (
            <Text variant="body" color={colors.textSecondary} align="center" style={{ marginTop: space.xxl }}>
              Nada com esse nome no céu de hoje.
            </Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  sheet: { flex: 1, backgroundColor: 'rgba(6,9,26,0.96)', paddingHorizontal: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: space.sm, height: 40 },
  input: { flex: 1, color: colors.text, fontSize: 16, height: 40 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: space.sm, height: 40 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: space.xxs },
  group: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowDot: { width: 8, height: 8, borderRadius: 4 },
});
