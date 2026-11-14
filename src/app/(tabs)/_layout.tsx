import { Tabs } from 'expo-router';
import { TabBar } from '@/components/tab-bar';
export default function TabsLayout() {
  return <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" /><Tabs.Screen name="saved" /><Tabs.Screen name="inbox" /><Tabs.Screen name="profile" />
  </Tabs>;
}
