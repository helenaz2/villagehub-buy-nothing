import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/data/store';
import { palette, serif } from '@/constants/palette';
import { Screen } from './screen';
import { BackButton } from './back-button';
import { HostRating } from './host-rating';
import { ItemGrid } from './item-card';

export function NeighborScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { person, items, ratingFor, savedIds, toggleSave } = useStore();
  const neighbor = person(id);
  if (!neighbor) return <Screen><BackButton /><Text style={s.title}>Profile unavailable</Text><Text style={s.muted}>This neighbor could not be found.</Text></Screen>;
  const listings = items.filter(item => item.hostId === neighbor.id);
  return <Screen><BackButton /><View style={s.card}>
    <Image source={{ uri: neighbor.avatar }} style={s.avatar} />
    <Text style={s.title}>{neighbor.name}</Text><Text style={s.muted}>{neighbor.handle}</Text><HostRating value={ratingFor(neighbor.id)} />
    <Text style={s.location}>{neighbor.neighborhood}, {neighbor.city}</Text>
    <Text style={s.bio}>{neighbor.bio}</Text><Text style={s.muted}>Member since {neighbor.memberSince}</Text>
  </View><Text style={s.section}>Shared by {neighbor.name}</Text><Text style={s.muted}>{listings.filter(i => i.status === 'available').length} available items</Text>
  {listings.length ? <View style={s.list}><ItemGrid items={listings} savedIds={savedIds} onSave={toggleSave} onPress={itemId => router.push({ pathname: '/item', params: { id: itemId } })} /></View> : <Text style={s.empty}>No shared items yet.</Text>}</Screen>;
}
const s = StyleSheet.create({ card: { backgroundColor: palette.white, borderRadius: 24, padding: 22, gap: 9, marginVertical: 16, borderWidth: 1, borderColor: palette.line }, avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 6 }, title: { fontFamily: serif, fontSize: 28, color: palette.forest }, muted: { color: palette.muted, fontSize: 13, lineHeight: 20 }, location: { color: palette.forest, fontSize: 14 }, bio: { color: palette.ink, fontSize: 15, lineHeight: 23 }, section: { fontSize: 18, fontWeight: '600', color: palette.ink, marginVertical: 10 }, list: { marginTop: 18 }, empty: { marginVertical: 24, color: palette.muted } });
