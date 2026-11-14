import type { LatLng } from '@/data/types';

const env = process.env;

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
