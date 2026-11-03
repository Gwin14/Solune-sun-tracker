import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { usePlace } from '@/hooks/useAstro';
import { deviceLanguage, LANGUAGES, useLanguage, useT, type LanguagePref } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { rescheduleNotifications, requestNotificationPermission } from '@/lib/notifications';
import { manageSubscription, requirePro, usePro } from '@/lib/purchases';
import { useApp, type NotificationPrefs } from '@/store/app';
import { colors, radius, space } from '@/theme/tokens';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const place = usePlace();
  const s = useApp();
  const tx = useT();
  const langPref = useLanguage((l) => l.pref);
  const setLanguage = (p: LanguagePref) => {
    if (p === langPref) return;
    haptic.tick();
    useLanguage.getState().setPref(p);
  };
  const pro = usePro((p) => p.isPro);
  const deviceName = LANGUAGES.find((l) => l.id === deviceLanguage())!.native;

  const toggleNotifications = async (v: boolean) => {
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        haptic.warning();
        Alert.alert(tx.settings.notificationsOffTitle, tx.settings.notificationsOffBody, [
          { text: tx.common.notNow, style: 'cancel' },
          { text: tx.settings.openSettings, onPress: () => Linking.openSettings() },
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
  /** Golden hour, moon phases and lead time are Solune Pro; others see the paywall instead. */
  const setProPref = <K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) => {
    requirePro(() => setPref(k, v));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.inkSheet }}>
      <View style={styles.header}>
        <Text variant="title2">{tx.settings.title}</Text>
        <PressableScale onPress={() => router.back()} style={styles.done} hapticOnPress="soft" accessibilityRole="button" accessibilityLabel={tx.common.done}>
          <Text variant="headline" color={colors.accent}>
            {tx.common.ok}
          </Text>
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}>
        <Group title={tx.pro.title}>
          {pro ? (
            <Row icon="sun" label={tx.pro.title} detail={tx.pro.active} onPress={manageSubscription}>
              <Text variant="callout" color={colors.accent}>
                {tx.pro.manage}
              </Text>
            </Row>
          ) : (
            <Row icon="sun" label={tx.pro.discover} detail={tx.pro.discoverDetail} onPress={() => router.push('/paywall')} chevron />
          )}
        </Group>

        <Group title={tx.settings.place}>
          <Row icon={place.id === 'current' ? 'location' : 'pin'} label={place.name} detail={place.region} onPress={() => router.push('/locations')} chevron />
        </Group>

        <Group title={tx.settings.language} footer={tx.settings.languageFooter}>
          <Row icon="globe" label={tx.settings.automatic} detail={deviceName} onPress={() => setLanguage('auto')}>
            {langPref === 'auto' ? <Icon name="check" size={16} color={colors.accent} /> : null}
          </Row>
          {LANGUAGES.map((l) => (
            <View key={l.id}>
              <Divider style={styles.inset} />
              <Row label={l.native} onPress={() => setLanguage(l.id)}>
                {langPref === l.id ? <Icon name="check" size={16} color={colors.accent} /> : null}
              </Row>
            </View>
          ))}
        </Group>

        <Group title={tx.settings.display}>
          <Row icon="clock" label={tx.settings.clock24}>
            <Toggle value={s.use24h} onValueChange={(v) => { haptic.tick(); s.setUse24h(v); }} />
          </Row>
          <Divider style={styles.inset} />
          <Row icon="hand" label={tx.settings.haptics}>
            <Toggle value={s.haptics} onValueChange={(v) => { s.setHaptics(v); haptic.tick(); }} />
          </Row>
        </Group>

        <Group title={tx.settings.reminders} footer={pro ? tx.settings.remindersFooter : `${tx.settings.remindersFooter} ${tx.pro.remindersPro}`}>
          <Row icon="bell" label={tx.settings.enableReminders}>
            <Toggle value={s.notificationsEnabled} onValueChange={toggleNotifications} />
          </Row>
          {s.notificationsEnabled ? (
            <>
              <Divider style={styles.inset} />
              <Row icon="sunrise" label={tx.sun.sunrise}>
                <Toggle value={s.notifications.sunrise} onValueChange={(v) => setPref('sunrise', v)} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon="sunset" label={tx.sun.sunset}>
                <Toggle value={s.notifications.sunset} onValueChange={(v) => setPref('sunset', v)} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon={pro ? 'sparkle' : 'lock'} label={tx.sun.golden}>
                <Toggle value={pro && s.notifications.golden} onValueChange={(v) => setProPref('golden', v)} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon={pro ? 'moonFull' : 'lock'} label={tx.moon.phase.full}>
                <Toggle value={pro && s.notifications.fullMoon} onValueChange={(v) => setProPref('fullMoon', v)} />
              </Row>
              <Divider style={styles.inset} />
              <Row icon={pro ? 'stars' : 'lock'} label={tx.moon.phase.new}>
                <Toggle value={pro && s.notifications.newMoon} onValueChange={(v) => setProPref('newMoon', v)} />
              </Row>
              <Divider style={styles.inset} />
              <View style={{ padding: space.md, gap: space.xs }}>
                <Text variant="callout" color={colors.textSecondary}>
                  {tx.settings.leadTime}
                </Text>
                <Segmented
                  options={[tx.settings.onTime, '15 min', '30 min']}
                  index={pro ? [0, 15, 30].indexOf(s.notifications.leadMinutes) : 0}
                  onChange={(i) => (i === 0 ? setPref('leadMinutes', 0) : setProPref('leadMinutes', ([0, 15, 30] as const)[i]))}
                />
              </View>
            </>
          ) : null}
        </Group>

        <Group title={tx.settings.about}>
          <Row icon="arrowCounter" label={tx.settings.replayIntro} onPress={() => s.resetOnboarding()} chevron />
          <Divider style={styles.inset} />
          <Row icon="info" label={tx.settings.calculations} detail={tx.settings.calculationsDetail} />
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

function Row({ icon, label, detail, children, onPress, chevron }: { icon?: IconName; label: string; detail?: string; children?: ReactNode; onPress?: () => void; chevron?: boolean }) {
  const body = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.rowIcon}>
          <Icon name={icon} size={15} color={colors.textSecondary} />
        </View>
      ) : (
        <View style={styles.rowIconSpace} />
      )}
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
  rowIconSpace: { width: 28 },
  rowIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  inset: { marginLeft: 58 },
});
