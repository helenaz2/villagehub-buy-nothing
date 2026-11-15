import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/data/store';
import { palette, serif } from '@/constants/palette';
import { Screen } from './screen';
import { BackButton } from './back-button';
import { HostRating } from './host-rating';
import { ItemGrid } from './item-card';
import { Icon } from './icon';
import { Button } from './ui';
import { backendConfig } from '@/lib/backend-config';
import { fetchProfile } from '@/services/profiles';
import { listListings, PAGE_SIZE } from '@/services/listings';
import type { Item, Person } from '@/types/listing';

export function NeighborScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { person, items, ratingFor, savedIds, toggleSave } = useStore();
  const [live, setLive] = useState<{ id: string; profile: Person | null } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [shared, setShared] = useState<Item[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (backendConfig.demo || !id) return;
    let active = true;
    void Promise.all([fetchProfile(id), backendConfig.listings ? listListings({ ownerId: id }) : Promise.resolve([])]).then(([p,rows]) => { if (active) { setLive({ id, profile: p }); setShared(rows); setMore(rows.length === PAGE_SIZE); setError(''); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load profile.'); });
    return () => { active = false; };
  }, [id, attempt]);
  const neighbor = backendConfig.demo ? person(id) : live?.id === id ? live.profile : undefined;
  if (error) return <Screen><BackButton /><Text accessibilityRole="alert">{error}</Text><Button label="Retry" onPress={() => setAttempt(n => n + 1)} /></Screen>;
  if (!backendConfig.demo && live?.id !== id) return <Screen><BackButton /><Text>Loading profile...</Text></Screen>;
  if (!neighbor) return <Screen><BackButton /><Text style={s.title}>Profile unavailable</Text><Text style={s.muted}>This neighbor could not be found.</Text></Screen>;
  const listings = backendConfig.demo ? items.filter(item => item.hostId === neighbor.id) : shared;
  async function loadMore() {
    if (busy) return;
    setBusy(true);
    try { const next = await listListings({ ownerId: id, offset: shared.length }); setShared(old => [...old,...next]); setMore(next.length === PAGE_SIZE); }
    catch(e) { setError(e instanceof Error ? e.message : 'Unable to load more.'); }
    finally { setBusy(false); }
  }
  return <Screen><BackButton /><View style={s.card}>
    {neighbor.avatar ? <Image source={{ uri: neighbor.avatar }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' }]}><Icon name="person" size={36} /></View>}
    <Text style={s.title}>{neighbor.name}</Text><Text style={s.muted}>{neighbor.handle}</Text><HostRating value={backendConfig.demo ? ratingFor(neighbor.id) : neighbor.rating} />
    <Text style={s.location}>{neighbor.neighborhood}, {neighbor.city}</Text>
    <Text style={s.bio}>{neighbor.bio}</Text><Text style={s.muted}>Member since {neighbor.memberSince}</Text>
  </View><Text style={s.section}>Shared by {neighbor.name}</Text><Text style={s.muted}>{listings.filter(i => i.status === 'available').length} available items</Text>
  {listings.length ? <View style={s.list}><ItemGrid items={listings} savedIds={savedIds} onSave={toggleSave} onPress={itemId => router.push({ pathname: '/item', params: { id: itemId } })} /></View> : <Text style={s.empty}>No shared items yet.</Text>}{more ? <Button label="Load more posts" disabled={busy} variant="ghost" onPress={() => { void loadMore(); }} /> : null}</Screen>;
}
const s = StyleSheet.create({ card: { backgroundColor: palette.white, borderRadius: 24, padding: 22, gap: 9, marginVertical: 16, borderWidth: 1, borderColor: palette.line }, avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 6 }, title: { fontFamily: serif, fontSize: 28, color: palette.forest }, muted: { color: palette.muted, fontSize: 13, lineHeight: 20 }, location: { color: palette.forest, fontSize: 14 }, bio: { color: palette.ink, fontSize: 15, lineHeight: 23 }, section: { fontSize: 18, fontWeight: '600', color: palette.ink, marginVertical: 10 }, list: { marginTop: 18 }, empty: { marginVertical: 24, color: palette.muted } });
