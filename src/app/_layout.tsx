import {
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DebugOverlay } from '@/components/DebugOverlay';
import * as remote from '@/data/remote';
import { allSeedPhotoUrls } from '@/data/seed/photos';
import { useStore } from '@/data/store';
import { syncedBackend } from '@/lib/config';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors, dark } = useTheme();
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());

  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);

  useEffect(() => {
    // Warm the photo cache once so the seeded feed still works with no signal.
    void Image.prefetch(allSeedPhotoUrls(), 'disk').catch(() => {});
    if (syncedBackend) void remote.fetchNearby().then(useStore.getState().mergeRemoteListings);
  }, []);

  const ready = fontsLoaded && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="review" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="published" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="rehome" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="handoff/[id]" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <DebugOverlay />
    </SafeAreaProvider>
  );
}
