import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { backendConfig, configurationError } from '@/lib/backend-config';
import { getSupabase } from '@/lib/supabase';

type AuthState = { session: Session | null; ready: boolean; error: string | null; recovering: boolean; finishRecovery: () => void; reload: () => void; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let removeState = () => {};
    async function restore() {
      if (backendConfig.demo) { if (active) setReady(true); return; }
      try {
        const configError = configurationError();
        if (configError) throw new Error(configError);
        const supabase = getSupabase();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
          if (!active) return;
          setSession(next);
          if (event === 'PASSWORD_RECOVERY') setRecovering(true);
          if (event === 'SIGNED_OUT') setRecovering(false);
        });
        unsubscribe = () => subscription.unsubscribe();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        setSession(data.session); setError(null);
        if (Platform.OS !== 'web') {
          if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
          const listener = AppState.addEventListener('change', state => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
          removeState = () => { listener.remove(); supabase.auth.stopAutoRefresh(); };
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Unable to restore your session.'); }
      finally { if (active) setReady(true); }
    }
    void restore();
    return () => { active = false; unsubscribe(); removeState(); };
  }, [attempt]);
  return <AuthContext.Provider value={{ session, ready, error, recovering, finishRecovery: () => setRecovering(false), reload: () => { setReady(false); setAttempt(n => n + 1); }, signOut: async () => { const { error: signOutError } = await getSupabase().auth.signOut(); if (signOutError) throw signOutError; setSession(null); setRecovering(false); } }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is missing'); return value; }
