import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ink } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="moon" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="journal" />
    </Tabs>
  );
}
