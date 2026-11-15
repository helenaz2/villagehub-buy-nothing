// Expo statically replaces these exact EXPO_PUBLIC references in client bundles.
export const backendConfig = {
  demo: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
  listings: Number(process.env.EXPO_PUBLIC_BACKEND_PHASE ?? '1') >= 2,
  messaging: Number(process.env.EXPO_PUBLIC_BACKEND_PHASE ?? '1') >= 3,
  ratings: Number(process.env.EXPO_PUBLIC_BACKEND_PHASE ?? '1') >= 4,
  ai: Number(process.env.EXPO_PUBLIC_BACKEND_PHASE ?? '1') >= 5,
  recommendations: process.env.EXPO_PUBLIC_RECOMMENDATIONS_ENABLED === 'true',
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  authRedirect: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? '',
  resetRedirect: process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ?? '',
};

export function configurationError(): string | null {
  if (backendConfig.demo) return null;
  if (!/^https?:\/\/[^\s\\]+$/.test(backendConfig.url) || !backendConfig.publishableKey) {
    return 'Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart Expo.';
  }
  return null;
}
