import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { backendConfig, configurationError } from './backend-config';

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    throw new Error('Supabase sessions are only initialized in the browser, never in web SSR.');
  }
  const error = configurationError();
  if (error) throw new Error(error);
  client ??= createClient(backendConfig.url, backendConfig.publishableKey, {
    auth: {
      storage: Platform.OS === 'web' ? window.localStorage : AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      // Supabase's browser lock coordinates tabs; processLock handles native.
      ...(Platform.OS !== 'web' ? { lock: processLock } : {}),
    },
  });
  return client;
}
