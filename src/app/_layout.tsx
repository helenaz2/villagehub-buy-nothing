import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StoreProvider, useStore } from '@/data/store';
function Navigator() {
  const { signedIn } = useStore();
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!signedIn}>
      <Stack.Screen name="index" /><Stack.Screen name="welcome" /><Stack.Screen name="create-account" /><Stack.Screen name="login" />
    </Stack.Protected>
    <Stack.Protected guard={signedIn}>
      <Stack.Screen name="(tabs)" /><Stack.Screen name="item" /><Stack.Screen name="post" /><Stack.Screen name="chat" /><Stack.Screen name="neighbor" />
    </Stack.Protected>
  </Stack>;
}
export default function Layout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><StoreProvider><Navigator /></StoreProvider></GestureHandlerRootView>;
}
