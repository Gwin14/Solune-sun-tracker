import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { usePlace } from '@/hooks/useAstro';
import { haptic } from '@/lib/haptics';
import { rescheduleNotifications, requestNotificationPermission } from '@/lib/notifications';
import { useApp, type NotificationPrefs } from '@/store/app';
import { colors, radius, space } from '@/theme/tokens';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const place = usePlace();
  const s = useApp();

  const toggleNotifications = async (v: boolean) => {
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        haptic.warning();
        Alert.alert('Notificações desativadas', 'Permita notificações para o Solune nos ajustes do sistema.', [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    s.setNotificationsEnabled(v);
    rescheduleNotifications();
  };

  const setPref = <K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) => {
    s.setNotification(k, v);
    rescheduleNotifications();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.inkSheet }}>
      <View style={styles.header}>
        <Text variant="title2">Ajustes</Text>
        <PressableScale onPress={() => router.back()} style={styles.done} hapticOnPress="soft" accessibilityRole="button" accessibilityLabel="Concluir">
          <Text variant="headline" color={colors.accent}>
            OK
          </Text>
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}>
        <Group title="Local">
          <Row icon={place.id === 'current' ? 'location' : 'pin'} label={place.name} detail={place.region} onPress={() => router.push('/locations')} chevron />
        </Group>

        <Group title="Exibição">
          <Row icon="clock" label="Formato 24 horas">
            <Switch value={s.use24h} onValueChange={(v) => { haptic.tick(); s.setUse24h(v); }} trackColor={{ true: colors.accent }} />
          </Row>
          <Divider style={styles.inset} />
          <Row icon="hand" label="Vibração ao interagir">
            <Switch value={s.haptics} onValueChange={(v) => { s.setHaptics(v); haptic.tick(); }} trackColor={{ true: colors.accent }} />
          </Row>
        </Group>

        <Group title="Lembretes" footer="Os lembretes são calculados para os próximos 7 dias no local selecionado.">
          <Row icon="bell" label="Ativar lembretes">
            <Switch value={s.notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ true: colors.accent }} />
          </Row>
          {s.notificationsEnabled ? (
            <>
              <Divider style={styles.inset} />
              <Row icon="sunrise" label="Nascer do sol">
                <Switch value={s.notifications.sunrise} onValueChange={(v) => setPref('sunrise', v)} trackColor={{ true: colors.accent }} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon="sunset" label="Pôr do sol">
                <Switch value={s.notifications.sunset} onValueChange={(v) => setPref('sunset', v)} trackColor={{ true: colors.accent }} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon="sparkle" label="Hora dourada">
                <Switch value={s.notifications.golden} onValueChange={(v) => setPref('golden', v)} trackColor={{ true: colors.accent }} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon="moonFull" label="Lua cheia">
                <Switch value={s.notifications.fullMoon} onValueChange={(v) => setPref('fullMoon', v)} trackColor={{ true: colors.accent }} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon="stars" label="Lua nova">
                <Switch value={s.notifications.newMoon} onValueChange={(v) => setPref('newMoon', v)} trackColor={{ true: colors.accent }} />
              </Row>
              <Divider style={styles.inset} />
              <View style={{ padding: space.md, gap: space.xs }}>
                <Text variant="callout" color={colors.textSecondary}>
                  Avisar com antecedência
                </Text>
                <Segmented
                  options={['Na hora', '15 min', '30 min']}
                  index={[0, 15, 30].indexOf(s.notifications.leadMinutes)}
                  onChange={(i) => setPref('leadMinutes', ([0, 15, 30] as const)[i])}
                />
              </View>
            </>
          ) : null}
        </Group>

        <Group title="Sobre">
          <Row icon="arrowCounter" label="Rever introdução" onPress={() => s.resetOnboarding()} chevron />
          <Divider style={styles.inset} />
          <Row icon="info" label="Cálculos astronômicos" detail="Astronomy Engine · precisão de ~1 minuto" />
        </Group>
        <Text variant="caption" color={colors.textTertiary} align="center">
          Solune 1.0
        </Text>
      </ScrollView>
    </View>
  );
}

function Group({ title, children, footer }: { title: string; children: ReactNode; footer?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="headline" style={{ marginLeft: space.xxs }}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
      {footer ? (
        <Text variant="caption" color={colors.textTertiary} style={{ marginHorizontal: space.xxs }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

function Row({ icon, label, detail, children, onPress, chevron }: { icon: IconName; label: string; detail?: string; children?: ReactNode; onPress?: () => void; chevron?: boolean }) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {detail ? (
          <Text variant="footnote" color={colors.textSecondary}>
            {detail}
          </Text>
        ) : null}
      </View>
      {children}
      {chevron ? <Icon name="chevronRight" size={13} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} hapticOnPress="soft">
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.xs },
  done: { paddingHorizontal: space.xs, height: 44, justifyContent: 'center' },
  group: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 56, paddingVertical: space.xs },
  rowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  inset: { marginLeft: 58 },
});
