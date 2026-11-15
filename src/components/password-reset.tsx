import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useAuth } from '@/data/auth';
import { changePassword, completeAuthLink } from '@/services/auth';
import { Screen } from './screen';
import { Button } from './ui';
import { BackButton } from './back-button';
import { palette } from '@/constants/palette';

export function PasswordResetScreen() {
  const auth = useAuth();
  const url = Linking.useLinkingURL();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!auth.ready || !url) return;
    let active = true;
    void completeAuthLink(url).then(() => { if (active) setLinked(true); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'This reset link could not be verified.'); });
    return () => { active = false; };
  }, [auth.ready, url]);
  async function submit() {
    if (busy) return;
    if (password.length < 8 || password !== confirm) { setError('Use at least 8 characters and matching passwords.'); return; }
    setBusy(true); setError('');
    try { await changePassword(password); setPassword(''); setConfirm(''); auth.finishRecovery(); await auth.signOut(); router.replace('/login'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update password.'); }
    finally { setBusy(false); }
  }
  return <Screen keyboard><BackButton /><Text style={s.title}>Choose a new password</Text>
    {auth.session && linked ? <><TextInput accessibilityLabel="New password" placeholder="New password (8+ characters)" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" /><TextInput accessibilityLabel="Confirm new password" placeholder="Confirm password" style={s.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" /><Button label={busy ? 'Saving...' : 'Save password'} disabled={busy} onPress={() => { void submit(); }} /></> : <Text>Open the reset link from your email on the same device and browser where you requested it.</Text>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
  </Screen>;
}
const s = StyleSheet.create({ title: { fontSize: 26, color: palette.forest, marginVertical: 20 }, input: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, padding: 14, borderRadius: 12, marginVertical: 10, color: palette.ink }, error: { color: palette.danger, marginVertical: 12 } });
