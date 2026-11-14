import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StoreProvider } from '@/data/store';
export default function Layout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><StoreProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="item" />
      <Stack.Screen name="post" />
      <Stack.Screen name="chat" />
    </Stack>
  </StoreProvider></GestureHandlerRootView>;
}
