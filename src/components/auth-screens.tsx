import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/data/auth';
import { backendConfig } from '@/lib/backend-config';
import * as authService from '@/services/auth';
import { rememberPendingStreet } from '@/services/pending-address';
import { useStore } from '@/data/store';
import { palette, serif } from '@/constants/palette';
import { VillageLogo } from './village-logo';
import { Screen } from './screen';
import { Button } from './ui';
import { BackButton } from './back-button';
import { StateDropdown } from './state-dropdown';
import { US_STATES } from '@/constants/us-states';
import { Icon } from './icon';

export function WelcomeScreen() {
  const { signedIn } = useStore();
  const auth = useAuth();
  if (signedIn) return <Redirect href={auth.recovering ? '/reset-password' : '/explore'} />;
  return <Screen contentStyle={s.landing}><View style={s.landingBrand}><View style={s.landingLogo}><VillageLogo /></View><Text accessibilityRole="header" style={s.landingTitle}>VillageHub</Text><Text style={s.landingSubtitle}>Buy Nothing</Text></View><Button label="Log in" onPress={() => router.push('/login')} /><Button label="Create account" variant="ghost" onPress={() => router.push('/create-account')} /></Screen>;
}
export function CreateAccountScreen() { return <AccountForm mode="signup" />; }
export function LoginScreen() { return <AccountForm mode="login" />; }
function AccountForm({ mode }: { mode: 'signup' | 'login' }) {
  const signup = mode === 'signup';
  const { startDemoSession } = useStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [street, setStreet] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setError(''); setNotice('');
    if (signup && (!name.trim() || !city.trim() || !US_STATES.some(value => value === state))) { setError('Enter your name, city, and state.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (signup && password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      if (backendConfig.demo) {
        startDemoSession(signup ? { name: name.trim(), street: street.trim(), city: city.trim(), state } : undefined);
        router.replace('/explore');
      } else if (signup) {
        await rememberPendingStreet(email, street);
        const data = await authService.signUp({ name, email, password, city, state });
        setNotice(data.session ? 'Account created.' : 'Check your email to confirm your account, then log in on this device. Your optional street is kept privately on this device for up to 24 hours until confirmation.');
      } else {
        await authService.signIn(email, password);
        router.replace('/explore');
      }
      setPassword(''); setConfirm('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to continue. Please try again.'); }
    finally { setBusy(false); }
  }
  async function resetPassword() {
    if (busy) return;
    if (backendConfig.demo) { setNotice('Password reset is unavailable in demo mode.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { await authService.sendPasswordReset(email); setNotice('If an account exists, a password reset email will arrive shortly. Open it on this device.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to send reset email.'); }
    finally { setBusy(false); }
  }

  function field(label: string, value: string, change: (text: string) => void, placeholder: string) {
    return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor={palette.muted} /></View>;
  }
  return <Screen keyboard><BackButton /><View style={s.brand}><Icon name="heart" size={22} /><Text style={s.brandText}>VillageHub</Text></View>
    <Text style={s.headline}>{signup ? 'A place to belong.' : 'Welcome back.'}</Text><Text style={s.intro}>{signup ? 'Start sharing good things with the people around you.' : 'Your neighborhood has something good waiting.'}</Text>
    {backendConfig.demo ? <View style={s.noticeBox}><Text style={s.noticeText}>Demo mode: credentials are not verified or saved. Log in opens the Alex Chen sample profile.</Text></View> : null}

    <View style={s.form}>
      {signup ? field('Full name *', name, setName, 'Your name') : null}
      <View style={s.field}><Text style={s.label}>{signup ? 'Email address *' : 'Email address'}</Text><TextInput accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={palette.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" /></View>
      <View style={s.field}><View style={s.passwordLabel}><Text style={s.label}>{signup ? 'Password *' : 'Password'}</Text><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(current => !current)} style={s.show}><Text style={s.link}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View><TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="At least 8 characters" placeholderTextColor={palette.muted} autoCapitalize="none" autoCorrect={false} autoComplete="off" /></View>
      {signup ? <><View style={s.field}><Text style={s.label}>Confirm password *</Text><TextInput accessibilityLabel="Confirm password" style={s.input} value={confirm} onChangeText={setConfirm} secureTextEntry={!showPassword} placeholder="Repeat your password" placeholderTextColor={palette.muted} autoCapitalize="none" autoCorrect={false} autoComplete="off" /></View>{field('City *', city, setCity, 'e.g. Brooklyn')}{field('Street (optional)', street, setStreet, 'Street address')}<StateDropdown value={state} onChange={setState} /><Text style={s.notice}>Fields marked * are required. Street is optional and is not shown on your public profile.</Text></> : null}
      {!signup ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void resetPassword(); }} style={s.show}><Text style={s.link}>Forgot password</Text></Pressable> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Button label={busy ? 'Please wait...' : signup ? 'Create account' : 'Log in'} disabled={busy} onPress={() => { void submit(); }} />
    </View>
    <View style={s.switchRow}><Text style={s.notice}>{signup ? 'Already have an account' : 'New to VillageHub'}</Text><Pressable accessibilityRole="button" onPress={() => router.replace(signup ? '/login' : '/create-account')} style={s.show}><Text style={s.link}>{signup ? 'Log in' : 'Create account'}</Text></Pressable></View>
  </Screen>;
}
const s = StyleSheet.create({
  landing: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  landingBrand: { alignItems: 'center', marginBottom: 28 },
  landingLogo: { width: '72%', maxWidth: 230, aspectRatio: 1, marginBottom: 12 },
  landingTitle: { fontFamily: serif, fontSize: 44, color: palette.forest, textAlign: 'center' },
  landingSubtitle: { fontSize: 19, letterSpacing: 2, color: palette.forest, textAlign: 'center', marginTop: 6 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 22 }, brandText: { fontSize: 23, fontFamily: serif, color: palette.forest },
  hero: { marginBottom: 30 }, heroImage: { width: '100%', aspectRatio: 1.2, borderRadius: 28, backgroundColor: palette.sage }, heroBadge: { position: 'absolute', bottom: 14, left: 12, right: 12, backgroundColor: palette.bg, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }, badgeText: { color: palette.forest, fontSize: 12, flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: '600', color: palette.terracotta }, headline: { fontFamily: serif, fontSize: 38, lineHeight: 44, color: palette.forest, marginVertical: 14 }, intro: { fontSize: 15, color: palette.muted, lineHeight: 24, marginBottom: 18 },
  benefits: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 }, benefit: { gap: 8, alignItems: 'center' }, benefitText: { fontSize: 11, color: palette.forest }, actions: { gap: 12, marginVertical: 22 },
  notice: { color: palette.muted, fontSize: 12, lineHeight: 18 }, noticeBox: { padding: 14, backgroundColor: palette.forestSoft, borderRadius: 14, marginBottom: 18 }, noticeText: { fontSize: 12, lineHeight: 19, color: palette.forest },
  form: { backgroundColor: palette.white, padding: 18, borderRadius: 22, gap: 16, borderWidth: 1, borderColor: palette.line }, field: { gap: 8 }, label: { fontSize: 13, fontWeight: '600', color: palette.ink }, input: { minHeight: 50, borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: palette.ink, backgroundColor: palette.bg }, passwordLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, show: { padding: 8, minHeight: 36, justifyContent: 'center' }, link: { color: palette.forest, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 22 }, error: { color: palette.danger, fontSize: 13, lineHeight: 20 },
});
