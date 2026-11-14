import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useStore } from '@/data/store';

export default function TabsLayout() {
  const onboarded = useStore((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
