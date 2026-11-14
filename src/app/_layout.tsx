import { Tabs } from 'expo-router';
import { TabBar } from '@/components/tab-bar';
import { StoreProvider } from '@/data/store';
export default function Layout() {
return <StoreProvider><Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
{['index','saved','inbox','profile'].map(name => <Tabs.Screen key={name} name={name} />)}
{['explore','post','item','chat'].map(name => <Tabs.Screen key={name} name={name} options={{ href: null }} />)}
</Tabs></StoreProvider>;
}