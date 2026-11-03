import { NativeTabs } from 'expo-router/native-tabs';

import { useT } from '@/i18n';
import { PlatformBridges } from '@/platform/Bridges';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const tx = useT();
  return (
    <>
    <PlatformBridges />
    <NativeTabs tintColor={colors.accent} labelStyle={{ color: colors.textSecondary }} iconColor={{ default: colors.textSecondary, selected: colors.accent }}>
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="wb_sunny" />
        <NativeTabs.Trigger.Label>{tx.tabs.today}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="moon" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'moon', selected: 'moon.fill' }} md="dark_mode" />
        <NativeTabs.Trigger.Label>{tx.tabs.moon}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sky" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="camera.viewfinder" md="view_in_ar" />
        <NativeTabs.Trigger.Label>{tx.tabs.sky}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
        <NativeTabs.Trigger.Label>{tx.tabs.events}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} md="auto_stories" />
        <NativeTabs.Trigger.Label>{tx.tabs.journal}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
    </>
  );
}
