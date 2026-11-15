import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { backendConfig } from '@/lib/backend-config';
import { getSupabase } from '@/lib/supabase';

export type SignupInput = { name: string; email: string; password: string; city: string; state: string };
export function callbackUrl(reset = false): string {
  const configured = reset ? backendConfig.resetRedirect : backendConfig.authRedirect;
  if (configured) return configured;
  const route = reset ? '/reset-password' : '/auth/callback';
  return Platform.OS === 'web' ? `${window.location.origin}${route}` : Linking.createURL(route);
}
export async function signUp(input: SignupInput) {
  // Street is deliberately excluded from auth metadata and public profiles.
  const { data, error } = await getSupabase().auth.signUp({
    email: input.email.trim(), password: input.password,
    options: { emailRedirectTo: callbackUrl(), data: { full_name: input.name.trim(), city: input.city.trim(), state: input.state } },
  });
  if (error) throw error;
  return data;
}
export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}
export async function sendPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl(true) });
  if (error) throw error;
}
export async function changePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

// Accept only PKCE codes on the configured callback routes. No tokens in logs.
// Sharing confirmation links to another browser/device needs an OTP flow; PKCE
// intentionally requires the device that started signup/reset.
const exchanges = new Map<string, Promise<void>>();
export function completeAuthLink(url: string): Promise<void> {
  const parsed = new URL(url);
  const error = parsed.searchParams.get('error_description');
  if (error) return Promise.reject(new Error(error));
  const code = parsed.searchParams.get('code');
  if (!code) return Promise.resolve();
  const existing = exchanges.get(code);
  if (existing) return existing;
  const pending = (async () => {
    const { error: exchangeError } = await getSupabase().auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  })();
  exchanges.set(code, pending);
  return pending;
}
