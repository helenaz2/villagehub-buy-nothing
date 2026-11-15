import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, usePathname } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/data/auth';
import { StoreProvider, useStore } from '@/data/store';
import { Button } from '@/components/ui';
import { palette } from '@/constants/palette';
import { backendConfig } from '@/lib/backend-config';
import { AssistantProvider } from '@/data/assistant';
function Navigator() {
  const { signedIn, loading, storeError, retry, signOut } = useStore();
  const auth = useAuth();
  const path = usePathname();
  const authLink = path === '/auth/callback' || path === '/reset-password';
  if (loading && !authLink) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}><ActivityIndicator color={palette.forest} /><Text>Restoring your session...</Text></View>;
  if (storeError && !authLink) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: palette.bg }}><Text accessibilityRole="alert">{storeError}</Text><Text>Check the Supabase configuration and Phase 1 migration. Your account data has not been replaced by demo data.</Text><Button label="Retry" onPress={retry} />{signedIn ? <Button label="Log out" variant="ghost" onPress={signOut} /> : null}</View>;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="auth/callback" /><Stack.Screen name="reset-password" />
    <Stack.Protected guard={!signedIn}>
      <Stack.Screen name="welcome" /><Stack.Screen name="create-account" /><Stack.Screen name="login" />
    </Stack.Protected>
    <Stack.Protected guard={signedIn && (backendConfig.demo || !auth.recovering)}>
      <Stack.Screen name="(tabs)" /><Stack.Screen name="item" /><Stack.Screen name="post" /><Stack.Screen name="chat" /><Stack.Screen name="neighbor" /><Stack.Screen name="complete-profile" /><Stack.Screen name="recommendations" /><Stack.Screen name="tag" />
    </Stack.Protected>
  </Stack>;
}
export default function Layout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><AuthProvider><StoreProvider><AssistantProvider><Navigator /></AssistantProvider></StoreProvider></AuthProvider></GestureHandlerRootView>;
}
