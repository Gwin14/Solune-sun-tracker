import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { compassPoint, formatDegrees, formatTime } from '@/astro/format';
import type { ViewingPlan } from '@/astro/sky/engine';
import type { TargetInfo } from '@/astro/sky/targets';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { colors, radius, space } from '@/theme/tokens';

type Props = {
  info: TargetInfo;
  alt: number;
  az: number;
  plan: ViewingPlan | null;
  tz: string | undefined;
  use24h: boolean;
  /** The target sits in the crosshair. */
  locked: boolean;
  onClose: () => void;
  /** Opens the object's full page. */
  onDetails: () => void;
  onBestTime?: (t: Date) => void;
};

const fmtMag = (m: number) => m.toFixed(1).replace('.', ',');

export function TargetCard({ info, alt, az, plan, tz, use24h, locked, onClose, onDetails, onBestTime }: Props) {
  const up = alt > 0;
  // Compact so the crosshair above stays clear; the full story is on the object's page.
  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(180)} layout={LinearTransition.duration(220)} style={styles.card}>
      <View style={styles.header}>
        <PressableScale onPress={onDetails} scaleTo={0.98} hapticOnPress="soft" style={styles.title} accessibilityRole="button" accessibilityHint="Abre a página completa">
          <View style={[styles.dot, { backgroundColor: info.color, boxShadow: `0 0 10px ${info.color}` }]} />
          <View style={{ flex: 1 }}>
            <Text variant="title3" numberOfLines={1}>
              {info.title}
            </Text>
            <Text variant="footnote" color={colors.textSecondary} numberOfLines={1}>
              {info.subtitle}
            </Text>
          </View>
        </PressableScale>
        <PressableScale onPress={onClose} hapticOnPress="soft" accessibilityLabel="Fechar" accessibilityRole="button" style={styles.close}>
          <Icon name="close" size={13} color={colors.text} />
        </PressableScale>
      </View>

      <View style={styles.chips}>
        <View style={[styles.chip, locked && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Icon name={locked ? 'check' : up ? 'arrowUp' : 'sunHorizon'} size={12} color={locked || up ? colors.accent : colors.textSecondary} />
          <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
            {locked ? 'Na mira' : up ? `${formatDegrees(alt)} · ${compassPoint(az)}` : 'Abaixo do horizonte'}
          </Text>
        </View>
        {info.mag != null ? (
          <View style={styles.chip}>
            <Icon name="sparkle" size={12} color={colors.textSecondary} />
            <Text variant="caption">Brilho {fmtMag(info.mag)}</Text>
          </View>
        ) : null}
        <PressableScale onPress={onDetails} hapticOnPress="soft" style={[styles.chip, styles.more]} accessibilityRole="button">
          <Text variant="caption" color={colors.text}>
            Detalhes
          </Text>
          <Icon name="chevronRight" size={10} color={colors.text} />
        </PressableScale>
      </View>

      {plan ? (
        <View style={styles.times}>
          {plan.alwaysUp ? (
            <Text variant="footnote" color={colors.textSecondary}>
              Nunca se põe daqui: gira o dia todo acima do horizonte.
            </Text>
          ) : plan.neverUp ? (
            <Text variant="footnote" color={colors.textSecondary}>
              Não nasce nas próximas 24 horas vista daqui.
            </Text>
          ) : (
            <>
              <TimeCell label="Nasce" value={formatTime(plan.rise, tz, use24h)} />
              <TimeCell label="Se põe" value={formatTime(plan.set, tz, use24h)} />
            </>
          )}
          {plan.best && onBestTime ? (
            <PressableScale onPress={() => onBestTime(plan.best!.time)} hapticOnPress="light" style={styles.best} accessibilityRole="button" accessibilityLabel="Ir para o melhor horário">
              <Text variant="caption" color={colors.textOnAccent}>
                {plan.best.dark ? 'Melhor à noite' : 'Melhor no crepúsculo'}
              </Text>
              <Text variant="headline" color={colors.textOnAccent} style={{ fontVariant: ['tabular-nums'] }}>
                {formatTime(plan.best.time, tz, use24h)} · {formatDegrees(plan.best.alt)}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

    </Animated.View>
  );
}

function TimeCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(8,12,34,0.82)',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    padding: space.md,
    gap: space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: colors.fill, borderWidth: 1, borderColor: 'transparent' },
  more: { marginLeft: 'auto', backgroundColor: colors.fillStrong },
  times: { flexDirection: 'row', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' },
  best: { marginLeft: 'auto', backgroundColor: colors.accent, borderRadius: radius.tile, paddingHorizontal: space.sm, paddingVertical: 6 },
});
