import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { useStore } from '@/data/store';
import { useAuth } from '@/data/auth';
import { fetchAddress, fetchProfile, saveProfile, saveStreet } from '@/services/profiles';
import { palette } from '@/constants/palette';
import { US_STATES } from '@/constants/us-states';
import { BackButton } from './back-button';
import { StateDropdown } from './state-dropdown';
import { Screen } from './screen';
import { Button } from './ui';

export function ProfileEditor() {
  const auth = useAuth();
  const { retry } = useStore();
  const id = auth.session?.user.id;
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [street, setStreet] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    let active = true;
    void Promise.all([fetchProfile(id), fetchAddress(id)]).then(([p, address]) => {
      if (!active) return;
      setName(p?.name ?? ''); setCity(p?.city ?? ''); setState(p?.state ?? ''); setStreet(address); setBio(p?.bio ?? ''); setBusy(false);
    }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Unable to load profile'); setBusy(false); } });
    return () => { active = false; };
  }, [id]);
  async function save() {
    if (busy || !id) return;
    if (!name.trim() || !city.trim() || !US_STATES.some(s => s === state)) { setError('Name, city, and state are required.'); return; }
    setBusy(true); setError('');
    try { await saveProfile(id, { name, city, state, bio }); await saveStreet(id, street); retry(); router.replace('/profile'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save profile'); }
    finally { setBusy(false); }
  }
  return <Screen keyboard><BackButton /><Text style={s.title}>Your profile</Text><Text>Street is optional and visible only to you.</Text>
    {[['Name *',name,setName],['City *',city,setCity],['Street (optional)',street,setStreet],['Bio',bio,setBio]].map(([label,value,onChange]) => <View key={label as string}><Text style={s.label}>{label as string}</Text><TextInput accessibilityLabel={label as string} style={s.input} value={value as string} onChangeText={onChange as (text: string) => void} editable={!busy} /></View>)}
    <StateDropdown value={state} onChange={setState} />{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Button label={busy ? 'Please wait...' : 'Save profile'} disabled={busy} onPress={() => { void save(); }} />
  </Screen>;
}
const s = StyleSheet.create({ title: { fontSize: 26, color: palette.forest, marginVertical: 20 }, label: { fontSize: 14, marginTop: 16, color: palette.ink }, input: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 14, marginVertical: 8, color: palette.ink }, error: { color: palette.danger, marginVertical: 12 } });
