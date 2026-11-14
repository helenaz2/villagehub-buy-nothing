import { useEffect, useState } from 'react';
import { router, usePathname, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackButton } from './back-button';
import { HostRating } from './host-rating';
import { ChatRating } from './chat-rating';
import { ProductGallery } from './product-gallery';
import { Icon } from './icon';
import { Screen } from './screen';
import { ItemGrid } from './item-card';
import { Button, Chip } from './ui';
import { palette, serif } from '@/constants/palette';
import { useStore } from '@/data/store';
import { searchItems } from '@/lib/search';
import { InboxRow } from './inbox-row';
import { PostEditor } from './post-editor';
import { ProposeCategory } from './propose-category';
import { type Item } from '@/types/listing';

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
return <View style={s.heading}><Text style={s.title}>{title}</Text>{subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}</View>;
}
function Back() { return <BackButton />; }
function Grid({ items }: { items: Item[] }) {
const { savedIds, toggleSave } = useStore();
return items.length ? <ItemGrid items={items} savedIds={savedIds} onSave={toggleSave} onPress={(id) => router.push({ pathname: '/item', params: { id } })} /> : <Text style={s.muted}>No items here yet. Try another search or save something you love.</Text>;
}
export function ExploreScreen() {
const { items, me, categories } = useStore();
const [query, setQuery] = useState('');
const [category, setCategory] = useState('For you');
return <Screen tabBar><Heading title="VillageHub" subtitle={me.neighborhood + ', ' + me.city} /><Text style={s.title}>Good things, shared.</Text><Text style={s.muted}>Find something you need. Give something a new home.</Text>
<TextInput accessibilityLabel="Search items" placeholder="Search for something lovely" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} style={s.input} />
<View style={s.chips}>{['For you', ...categories].map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</View><ProposeCategory onApproved={setCategory} />
<Heading title="Free in your neighborhood" /><Grid items={searchItems(items, query, category, 'All', 'Any', 'Any')} /></Screen>;
}
export function SavedScreen() {
const { items, savedIds } = useStore();
return <Screen tabBar><Heading title="Saved" subtitle="Good finds to come back to." /><Grid items={items.filter((i) => savedIds.includes(i.id))} /></Screen>;
}
export function InboxScreen() {
const { conversations } = useStore();
const sorted = [...conversations].sort((a,b) => Number(!!b.pinned) - Number(!!a.pinned));
return <Screen tabBar><Heading title="Inbox" subtitle="Swipe left for conversation options." />{sorted.length ? sorted.map(c => <InboxRow key={c.id} conversation={c} />) : <Text style={s.muted}>No conversations yet. Message a host to get started.</Text>}</Screen>;
}
export function ProfileScreen() {
const { me, items } = useStore();
return <Screen tabBar><Heading title={'Hi, ' + me.name} subtitle={me.handle} /><Image source={{ uri: me.avatar }} style={s.avatar} /><Text style={s.label}>{me.neighborhood}, {me.city}</Text><Text style={s.muted}>{me.bio}</Text><Text style={s.muted}>Member since {me.memberSince}</Text><Heading title="Your listings" /><Grid items={items.filter((i) => i.hostId === me.id)} /><Text style={s.note}>Demo data resets when the app restarts.</Text></Screen>;
}
export function DetailScreen() {
const { id } = useLocalSearchParams<{ id: string }>();
const { items, person, savedIds, toggleSave, openThread, me, claim, relist, ratingFor } = useStore();
const item = items.find(i => i.id === id);
if (!item) return <Screen><Back /><Heading title="Item unavailable" /></Screen>;
const host = person(item.hostId);
const own = item.hostId === me.id;
return <Screen><Back /><ProductGallery key={item.id} photos={item.photos} title={item.title} />
<View style={d.summary}>
<View style={d.topline}><Text style={d.eyebrow}>{item.category}</Text><View style={[d.status, item.status === 'claimed' && d.claimed]}><Text style={d.statusText}>{item.status === 'available' ? 'Available' : 'Claimed'}</Text></View></View>
<Text style={d.title}>{item.title}</Text><View style={d.priceRow}><Text style={d.price}>Free</Text><Text style={d.muted}>A new home, at no cost</Text></View>
<View style={d.location}><Icon name="pin" size={16} /><Text style={d.locationText}>{item.neighborhood}, {item.city}</Text></View>
<View style={d.tags}>{[item.category,...item.tags].filter((tag,i,all) => all.indexOf(tag) === i).map(tag => <View key={tag} style={d.tag}><Text style={d.tagText}>#{tag.replace(/^#+/, '').replace(/\s+/g, '')}</Text></View>)}</View>
</View>
<View style={d.panel}><Text style={d.section}>Condition & details</Text><View style={d.condition}><Icon name="check" size={16} /><Text style={d.conditionText}>{item.condition}</Text></View>{item.conditionNote ? <Text style={d.body}>{item.conditionNote}</Text> : null}
<View style={d.specs}><View style={d.spec}><Text style={d.muted}>Size</Text><Text style={d.value}>{item.size || 'Not specified'}</Text></View><View style={d.spec}><Text style={d.muted}>Color</Text><Text style={d.value}>{item.color || 'Not specified'}</Text></View>{item.materials ? <View style={d.spec}><Text style={d.muted}>Materials</Text><Text style={d.value}>{item.materials}</Text></View> : null}{item.fabric ? <View style={d.spec}><Text style={d.muted}>Fabric</Text><Text style={d.value}>{item.fabric}</Text></View> : null}</View></View>
<View style={d.panel}><Text style={d.section}>About this item</Text><Text style={d.body}>{item.description}</Text>{item.features.length ? <View style={d.features}>{item.features.map(feature => <View key={feature} style={d.feature}><Icon name="check" size={14} /><Text style={d.body}>{feature}</Text></View>)}</View> : null}</View>
<View style={d.panel}><Text style={d.section}>Meet your neighbor</Text><Pressable accessibilityRole="button" accessibilityLabel={'View profile of ' + (host?.name ?? 'neighbor')} disabled={!host} onPress={() => host && router.push({ pathname: '/neighbor', params: { id: host.id } })} style={d.hostRow}>{host ? <><Image source={{ uri: host.avatar }} style={d.avatar} /><View style={d.hostInfo}><Text style={d.hostName}>{host.name}</Text><Text style={d.muted}>{host.handle}</Text><HostRating value={ratingFor(host.id)} /><Text style={d.muted}>Member since {host.memberSince}</Text></View></> : <Text style={d.hostName}>Neighbor</Text>}</Pressable><Text style={d.posted}>Posted {item.postedLabel.toLowerCase()}</Text></View>
<View style={d.actionPanel}><Text style={d.section}>{own ? 'Manage your post' : 'Give it a new chapter'}</Text><Text style={d.muted}>{own ? 'Keep your neighbors up to date.' : 'Arrange pickup directly with the host.'}</Text><Button label={savedIds.includes(id) ? 'Unsave item' : 'Save item'} variant="ghost" onPress={() => toggleSave(id)} />{own ? <><Button label="Edit post" onPress={() => router.push({ pathname: '/post', params: { id } })} /><Button label={item.status === 'claimed' ? 'Relist item' : 'Mark as claimed'} variant="ghost" onPress={() => item.status === 'claimed' ? relist(id) : claim(id)} /></> : <Button label={item.status === 'claimed' ? 'Already claimed' : 'Message host'} disabled={item.status === 'claimed'} onPress={() => router.push({ pathname: '/chat', params: { id: openThread(id) } })} />}</View></Screen>;

}
export function ChatScreen() {
const { id } = useLocalSearchParams<{ id: string }>();
const { conversations, items, sendMessage, markRead, person, ratingFor } = useStore();
const [text, setText] = useState('');
const conversation = conversations.find((c) => c.id === id);
const chatItem = items.find(i => i.id === conversation?.itemId);
const neighbor = person(conversation?.participantId ?? chatItem?.hostId ?? '');
const unread = conversation?.unread;
const pathname = usePathname();
useEffect(() => { if (pathname === '/chat' && unread) markRead(id); }, [pathname, id, unread, markRead]);
return <Screen keyboard><Back />{neighbor ? <Pressable accessibilityRole="button" accessibilityLabel={'View profile of ' + neighbor.name} onPress={() => router.push({ pathname: '/neighbor', params: { id: neighbor.id } })} style={[s.card, d.hostRow]}><Image source={{ uri: neighbor.avatar }} style={d.avatar} /><View><Text style={d.hostName}>{neighbor.name}</Text><Text style={d.muted}>{neighbor.handle}</Text><HostRating value={ratingFor(neighbor.id)} /></View></Pressable> : null}<Heading title={items.find((i) => i.id === conversation?.itemId)?.title ?? 'Conversation'} subtitle="Demo conversation - replies are simulated" />{conversation?.messages.map((m) => <View key={m.id} style={[s.card, m.sender === 'me' && s.mine]}><Text style={s.body}>{m.text}</Text><Text style={s.note}>{m.time}</Text></View>)}{conversation ? <><ChatRating key={id} conversation={conversation} /><TextInput accessibilityLabel="Message" placeholder="Write a friendly message" placeholderTextColor={palette.muted} value={text} onChangeText={setText} style={s.input} multiline /><Button label="Send message" disabled={!text.trim()} onPress={() => { sendMessage(id, text); setText(''); }} /></> : <Text style={s.muted}>Conversation unavailable.</Text>}</Screen>;
}
export function PostScreen() {
const { id } = useLocalSearchParams<{ id?: string }>();
return <PostEditor key={id ?? 'new'} itemId={id} />;
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

const d = StyleSheet.create({
  summary: { paddingHorizontal: 2, gap: 12, marginBottom: 20 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', color: palette.muted },
  status: { backgroundColor: palette.forestSoft, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  claimed: { backgroundColor: palette.line }, statusText: { color: palette.forest, fontSize: 11, fontWeight: '600' },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 36, color: palette.ink },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  price: { color: palette.terracotta, fontSize: 26, fontWeight: '700' },
  muted: { fontSize: 12, lineHeight: 19, color: palette.muted },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { flex: 1, textDecorationLine: 'underline', fontSize: 13, color: palette.forest, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: palette.forestSoft },
  tagText: { color: palette.forest, fontSize: 11, fontWeight: '500' },
  panel: { backgroundColor: palette.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: palette.line, gap: 12 },
  section: { fontSize: 17, color: palette.ink, fontWeight: '600' },
  body: { color: palette.ink, lineHeight: 23, fontSize: 14 },
  condition: { flexDirection: 'row', gap: 7, alignItems: 'center', alignSelf: 'flex-start', backgroundColor: palette.forestSoft, borderRadius: 9, padding: 9 },
  conditionText: { fontSize: 13, color: palette.forest, fontWeight: '600' },
  specs: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12, gap: 10 },
  spec: { flexDirection: 'row', gap: 12 }, value: { flex: 1, fontSize: 13, color: palette.ink, textAlign: 'right' },
  features: { gap: 8 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27 }, hostInfo: { flex: 1, gap: 2 }, hostName: { fontSize: 16, color: palette.ink, fontWeight: '600' },
  posted: { color: palette.muted, fontSize: 11, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 },
  actionPanel: { padding: 18, gap: 12, backgroundColor: palette.sage, borderRadius: 20, marginTop: 4, marginBottom: 16 },
});
