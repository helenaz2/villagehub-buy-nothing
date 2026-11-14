import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config, hasSupabase } from '@/lib/config';

/**
 * null when no backend is configured. Every caller handles that case, which is
 * what lets the whole app run in demo mode with zero keys.
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
