import { NativeTabs } from 'expo-router/native-tabs';

import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.accent} labelStyle={{ color: colors.textSecondary }} iconColor={{ default: colors.textSecondary, selected: colors.accent }}>
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="wb_sunny" />
        <NativeTabs.Trigger.Label>Hoje</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="moon" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'moon', selected: 'moon.fill' }} md="dark_mode" />
        <NativeTabs.Trigger.Label>Lua</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sky" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="camera.viewfinder" md="view_in_ar" />
        <NativeTabs.Trigger.Label>Céu</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
        <NativeTabs.Trigger.Label>Eventos</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} md="auto_stories" />
        <NativeTabs.Trigger.Label>Diário</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
