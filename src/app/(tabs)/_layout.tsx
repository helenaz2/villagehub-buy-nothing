import { Tabs } from 'expo-router';
import { TabBar } from '@/components/tab-bar';
export default function TabsLayout() {
  return <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="explore" /><Tabs.Screen name="saved" /><Tabs.Screen name="inbox" /><Tabs.Screen name="profile" />
  </Tabs>;
}
