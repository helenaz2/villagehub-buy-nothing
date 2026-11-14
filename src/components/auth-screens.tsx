import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '@/data/store';
import { palette, serif } from '@/constants/palette';
import { Screen } from './screen';
import { Button } from './ui';
import { BackButton } from './back-button';
import { StateDropdown } from './state-dropdown';
import { US_STATES } from '@/constants/us-states';
import { Icon } from './icon';

export function WelcomeScreen() {
  return <Screen scroll={false} contentStyle={s.landing}><Button label="Log in" onPress={() => router.push('/login')} /><Button label="Create account" variant="ghost" onPress={() => router.push('/create-account')} /></Screen>;
}
export function CreateAccountScreen() { return <AccountForm mode="signup" />; }
export function LoginScreen() { return <AccountForm mode="login" />; }
function AccountForm({ mode }: { mode: 'signup' | 'login' }) {
  const signup = mode === 'signup';
  const { startDemoSession } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [street, setStreet] = useState('');
  const [state, setState] = useState('');
  const [resetNotice, setResetNotice] = useState(false);
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  function submit() {
    if (signup && (!name.trim() || !city.trim() || !US_STATES.some(value => value === state))) { setError('Enter your name, city, and state.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Use a demo password with at least 8 characters.'); return; }
    if (signup && password !== confirm) { setError('The passwords do not match.'); return; }
    // Auth integration: call the backend signup/sign-in service here. Only enter
    // a real session after it succeeds; passwords must never be stored locally.
    setPassword(''); setConfirm(''); setEmail('');
    startDemoSession(signup ? { name: name.trim(), street: street.trim(), city: city.trim(), state } : undefined);
  }
  function field(label: string, value: string, change: (text: string) => void, placeholder: string) {
    return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor={palette.muted} /></View>;
  }
  return <Screen keyboard><BackButton /><View style={s.brand}><Icon name="heart" size={22} /><Text style={s.brandText}>VillageHub</Text></View>
    <Text style={s.headline}>{signup ? 'A place to belong.' : 'Welcome back.'}</Text><Text style={s.intro}>{signup ? 'Start sharing good things with the people around you.' : 'Your neighborhood has something good waiting.'}</Text>
    <View style={s.noticeBox}><Text style={s.noticeText}>Demo only. Use a sample email and password. Credentials are not verified or saved; real accounts and authentication are not connected yet.{!signup ? ' Log in opens the Alex Chen demo profile.' : ''}</Text></View>
    <View style={s.form}>
      {signup ? field('Full name *', name, setName, 'Your name') : null}
      <View style={s.field}><Text style={s.label}>{signup ? 'Email address *' : 'Email address'}</Text><TextInput accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={palette.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" /></View>
      <View style={s.field}><View style={s.passwordLabel}><Text style={s.label}>{signup ? 'Password *' : 'Password'}</Text><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(current => !current)} style={s.show}><Text style={s.link}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View><TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="At least 8 characters" placeholderTextColor={palette.muted} autoCapitalize="none" autoCorrect={false} autoComplete="off" /></View>
      {signup ? <><View style={s.field}><Text style={s.label}>Confirm password *</Text><TextInput accessibilityLabel="Confirm password" style={s.input} value={confirm} onChangeText={setConfirm} secureTextEntry={!showPassword} placeholder="Repeat your password" placeholderTextColor={palette.muted} autoCapitalize="none" autoCorrect={false} autoComplete="off" /></View>{field('City *', city, setCity, 'e.g. Brooklyn')}{field('Street (optional)', street, setStreet, 'Street address')}<StateDropdown value={state} onChange={setState} /><Text style={s.notice}>Fields marked * are required. Street is optional and is not shown on your public profile.</Text></> : null}
      {!signup ? <><Pressable accessibilityRole="button" onPress={() => setResetNotice(true)} style={s.show}><Text style={s.link}>Forgot password</Text></Pressable>{resetNotice ? <Text accessibilityLiveRegion="polite" style={s.notice}>Password reset is coming soon. This button is a placeholder.</Text> : null}</> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Button label={signup ? 'Create demo account' : 'Log in to demo'} onPress={submit} />
    </View>
    <View style={s.switchRow}><Text style={s.notice}>{signup ? 'Already have an account' : 'New to VillageHub'}</Text><Pressable accessibilityRole="button" onPress={() => router.replace(signup ? '/login' : '/create-account')} style={s.show}><Text style={s.link}>{signup ? 'Log in' : 'Create account'}</Text></Pressable></View>
  </Screen>;
}
const s = StyleSheet.create({
  landing: { justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 22 }, brandText: { fontSize: 23, fontFamily: serif, color: palette.forest },
  hero: { marginBottom: 30 }, heroImage: { width: '100%', aspectRatio: 1.2, borderRadius: 28, backgroundColor: palette.sage }, heroBadge: { position: 'absolute', bottom: 14, left: 12, right: 12, backgroundColor: palette.bg, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }, badgeText: { color: palette.forest, fontSize: 12, flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: '600', color: palette.terracotta }, headline: { fontFamily: serif, fontSize: 38, lineHeight: 44, color: palette.forest, marginVertical: 14 }, intro: { fontSize: 15, color: palette.muted, lineHeight: 24, marginBottom: 18 },
  benefits: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 }, benefit: { gap: 8, alignItems: 'center' }, benefitText: { fontSize: 11, color: palette.forest }, actions: { gap: 12, marginVertical: 22 },
  notice: { color: palette.muted, fontSize: 12, lineHeight: 18 }, noticeBox: { padding: 14, backgroundColor: palette.forestSoft, borderRadius: 14, marginBottom: 18 }, noticeText: { fontSize: 12, lineHeight: 19, color: palette.forest },
  form: { backgroundColor: palette.white, padding: 18, borderRadius: 22, gap: 16, borderWidth: 1, borderColor: palette.line }, field: { gap: 8 }, label: { fontSize: 13, fontWeight: '600', color: palette.ink }, input: { minHeight: 50, borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: palette.ink, backgroundColor: palette.bg }, passwordLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, show: { padding: 8, minHeight: 36, justifyContent: 'center' }, link: { color: palette.forest, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 22 }, error: { color: palette.danger, fontSize: 13, lineHeight: 20 },
});
