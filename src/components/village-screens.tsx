import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from './screen';
import { ItemGrid } from './item-card';
import { Button, Chip } from './ui';
import { palette, serif } from '@/constants/palette';
import { useStore } from '@/data/store';
import { searchItems } from '@/lib/search';
import { CATEGORIES, type Item } from '@/types/listing';

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
return <View style={s.heading}><Text style={s.title}>{title}</Text>{subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}</View>;
}
function Back() { return <Button label="Explore" variant="ghost" onPress={() => router.navigate('/')} />; }
function Grid({ items }: { items: Item[] }) {
const { savedIds, toggleSave } = useStore();
return items.length ? <ItemGrid items={items} savedIds={savedIds} onSave={toggleSave} onPress={(id) => router.push({ pathname: '/item', params: { id } })} /> : <Text style={s.muted}>No items here yet. Try another search or save something you love.</Text>;
}
export function ExploreScreen() {
const { items, me } = useStore();
const [query, setQuery] = useState('');
const [category, setCategory] = useState('For you');
return <Screen tabBar><Heading title="VillageHub" subtitle={me.neighborhood + ', ' + me.city} /><Text style={s.title}>Good things, shared.</Text><Text style={s.muted}>Find something you need. Give something a new home.</Text>
<TextInput accessibilityLabel="Search items" placeholder="Search for something lovely" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} style={s.input} />
<View style={s.chips}>{['For you', ...CATEGORIES].map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</View>
<Heading title="Free in your neighborhood" /><Grid items={searchItems(items, query, category, 'All', 'Any', 'Any')} /></Screen>;
}
export function SavedScreen() {
const { items, savedIds } = useStore();
return <Screen tabBar><Heading title="Saved" subtitle="Good finds to come back to." /><Grid items={items.filter((i) => savedIds.includes(i.id))} /></Screen>;
}
export function InboxScreen() {
const { conversations, items, person } = useStore();
return <Screen tabBar><Heading title="Inbox" subtitle="A little conversation goes a long way." />{conversations.map((c) => {
const item = items.find((i) => i.id === c.itemId);
return <Pressable accessibilityRole="button" key={c.id} style={s.card} onPress={() => router.push({ pathname: '/chat', params: { id: c.id } })}><Text style={s.label}>{person(item?.hostId ?? '')?.name ?? 'Neighbor'}{c.unread ? ' ? New' : ''}</Text><Text style={s.label}>{item?.title ?? 'Listing removed'}</Text><Text numberOfLines={2} style={s.muted}>{c.messages.at(-1)?.text ?? 'Start a conversation'}</Text></Pressable>;
})}</Screen>;
}
export function ProfileScreen() {
const { me, items } = useStore();
return <Screen tabBar><Heading title={me.name} subtitle={me.handle} /><Image source={{ uri: me.avatar }} style={s.avatar} /><Text style={s.label}>{me.neighborhood}, {me.city}</Text><Text style={s.muted}>{me.bio}</Text><Text style={s.muted}>Member since {me.memberSince}</Text><Heading title="Your listings" /><Grid items={items.filter((i) => i.hostId === me.id)} /><Text style={s.note}>Demo data resets when the app restarts.</Text></Screen>;
}
export function DetailScreen() {
const { id } = useLocalSearchParams<{ id: string }>();
const { items, person, savedIds, toggleSave, openThread, me, claim, relist } = useStore();
const item = items.find((i) => i.id === id);
if (!item) return <Screen tabBar><Back /><Heading title="Item unavailable" /></Screen>;
return <Screen tabBar><Back /><Image source={{ uri: item.photos[0] }} style={s.photo} contentFit="cover" /><Heading title={item.title} subtitle={'Free ? ' + item.condition + ' ? ' + item.status} /><Text style={s.label}>{item.neighborhood} ? {item.distance}</Text><Text style={s.body}>{item.description}</Text><Text style={s.muted}>{item.conditionNote}</Text><Text style={s.body}>{item.size} ? {item.color}</Text><Text style={s.muted}>Shared by {person(item.hostId)?.name ?? 'a neighbor'}</Text><View style={s.actions}><Button label={savedIds.includes(id) ? 'Unsave item' : 'Save item'} variant="ghost" onPress={() => toggleSave(id)} />{item.hostId === me.id ? <Button label={item.status === 'claimed' ? 'Relist item' : 'Mark claimed'} onPress={() => item.status === 'claimed' ? relist(id) : claim(id)} /> : <Button label="Message neighbor" disabled={item.status === 'claimed'} onPress={() => router.push({ pathname: '/chat', params: { id: openThread(id) } })} />}</View></Screen>;
}
export function ChatScreen() {
const { id } = useLocalSearchParams<{ id: string }>();
const { conversations, items, sendMessage, markRead } = useStore();
const [text, setText] = useState('');
const conversation = conversations.find((c) => c.id === id);
const unread = conversation?.unread;
useEffect(() => { if (unread) markRead(id); }, [id, unread, markRead]);
return <Screen tabBar keyboard><Back /><Heading title={items.find((i) => i.id === conversation?.itemId)?.title ?? 'Conversation'} subtitle="Demo conversation ? replies are simulated" />{conversation?.messages.map((m) => <View key={m.id} style={[s.card, m.sender === 'me' && s.mine]}><Text style={s.body}>{m.text}</Text><Text style={s.note}>{m.time}</Text></View>)}{conversation ? <><TextInput accessibilityLabel="Message" placeholder="Write a friendly message" placeholderTextColor={palette.muted} value={text} onChangeText={setText} style={s.input} multiline /><Button label="Send message" disabled={!text.trim()} onPress={() => { sendMessage(id, text); setText(''); }} /></> : <Text style={s.muted}>Conversation unavailable.</Text>}</Screen>;
}
export function PostScreen() {
const { me, publish } = useStore();
const [title, setTitle] = useState('');
const [description, setDescription] = useState('');
const [photo, setPhoto] = useState('');
const [category, setCategory] = useState<Item['category']>('Home');
function post() {
const id = 'item_' + Date.now();
publish({ id, title: title.trim(), description: description.trim(), photos: [photo.trim()], category, condition: 'Good condition', conditionNote: '', size: 'One size', color: 'Natural', tags: [], features: [], materials: '', fabric: '', neighborhood: me.neighborhood, city: me.city, distance: 'Nearby', hostId: me.id, status: 'available', postedLabel: 'Just now', saves: 0 });
setTitle(''); setDescription(''); setPhoto('');
router.replace({ pathname: '/item', params: { id } });
}
return <Screen tabBar keyboard><Back /><Heading title="Give something a new home" subtitle="Everything on VillageHub is free." /><Text style={s.label}>Title</Text><TextInput accessibilityLabel="Item title" value={title} onChangeText={setTitle} style={s.input} /><Text style={s.label}>Description</Text><TextInput accessibilityLabel="Item description" value={description} onChangeText={setDescription} style={s.input} multiline /><Text style={s.label}>Photo URL</Text><TextInput accessibilityLabel="Photo URL" placeholder="https://?" placeholderTextColor={palette.muted} value={photo} onChangeText={setPhoto} autoCapitalize="none" keyboardType="url" style={s.input} /><View style={s.chips}>{CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</View><Text style={s.muted}>Listed as good condition in {me.neighborhood}. Describe any wear above.</Text><View style={s.actions}><Button label="Share for free" disabled={!title.trim() || !description.trim() || !/^https?:\/\/\S+$/i.test(photo.trim())} onPress={post} /></View></Screen>;
}
const s = StyleSheet.create({
heading: { gap: 6, marginTop: 18, marginBottom: 18 },
title: { fontFamily: serif, fontSize: 28, color: palette.forest },
muted: { fontSize: 14, color: palette.muted, lineHeight: 21 },
input: { backgroundColor: palette.white, borderRadius: 16, padding: 16, marginVertical: 14, color: palette.ink, fontSize: 16, borderWidth: 1, borderColor: palette.line, minHeight: 52 },
chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
card: { backgroundColor: palette.white, borderRadius: 16, padding: 16, gap: 8, marginBottom: 12 },
label: { fontSize: 16, fontWeight: '600', color: palette.ink },
body: { fontSize: 16, color: palette.ink, lineHeight: 24, marginVertical: 6 },
photo: { width: '100%', aspectRatio: 1, borderRadius: 20, marginTop: 18, backgroundColor: palette.sage },
avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 16 },
actions: { gap: 12, marginVertical: 20 },
mine: { backgroundColor: palette.forestSoft, marginLeft: 24 },
note: { fontSize: 12, color: palette.muted, marginVertical: 12 },
});
