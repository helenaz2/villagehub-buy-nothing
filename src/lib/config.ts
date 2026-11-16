import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { LatLng } from '@/data/types';

const env = process.env;

/**
 * Where scans go in development. The Expo dev server itself answers
 * /curbside-scan (see metro.config.js), so the default is the same address
 * the app was loaded from: it works on the LAN and through --tunnel with
 * nothing to configure. EXPO_PUBLIC_SCAN_URL overrides it.
 */
function localScanUrl(): string | null {
  if (env.EXPO_PUBLIC_SCAN_URL) return env.EXPO_PUBLIC_SCAN_URL.replace(/\/$/, '');
  if (!__DEV__) return null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/curbside-scan`;
  const hostUri = Constants.expoConfig?.hostUri ?? null;
  if (!hostUri) return null;
  // Tunnel hosts (exp.direct) are served over https; LAN hosts over plain http.
  const scheme = /\.exp\.direct/.test(hostUri) ? 'https' : 'http';
  return `${scheme}://${hostUri}/curbside-scan`;
}

const num = (v: string | undefined, fallback: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** 'demo' keeps listings and chat on the device. 'supabase' syncs them. */
  backend: (env.EXPO_PUBLIC_BACKEND === 'supabase' ? 'supabase' : 'demo') as 'demo' | 'supabase',
  /** Set to 'mock' to force canned scan results even when Supabase is configured. */
  forceMockAi: env.EXPO_PUBLIC_AI === 'mock',
  /** Local scan server, tried before the edge function. Null in release builds unless set. */
  scanServerUrl: env.EXPO_PUBLIC_AI === 'mock' ? null : localScanUrl(),
  /** Center of the seeded demo region. Defaults to Southside Berkeley. */
  region: {
    lat: num(env.EXPO_PUBLIC_REGION_LAT, 37.8676),
    lng: num(env.EXPO_PUBLIC_REGION_LNG, -122.2595),
  } satisfies LatLng,
  regionName: env.EXPO_PUBLIC_REGION_NAME ?? 'Southside',
};

export const hasSupabase = config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
export const liveAi = hasSupabase && !config.forceMockAi;
export const syncedBackend = hasSupabase && config.backend === 'supabase';
