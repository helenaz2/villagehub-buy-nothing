import { backendConfig } from '@/lib/backend-config';
import { useEffect, useRef, useState } from 'react';
import { router, usePathname, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { VillageLogo } from './village-logo';
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
import { AssistantInboxRow } from './assistant-inbox-row';
import { InboxRow } from './inbox-row';
import { PostEditor } from './post-editor';
import { FloatingAssistant } from './floating-assistant';
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
const { items, categories, feedItems, fetchFeed, feedLoading, hasMoreListings } = useStore();
const [query, setQuery] = useState('');
const [category, setCategory] = useState('For you');
const path = usePathname();
useEffect(() => { if (path === '/explore' && !backendConfig.demo && backendConfig.listings) { const timer=setTimeout(() => { void fetchFeed(query,category); },250); return () => clearTimeout(timer); } }, [path,query,category,fetchFeed]);
return <Screen tabBar keyboard overlay={!backendConfig.demo && backendConfig.recommendations ? <FloatingAssistant /> : null}><View style={s.exploreBrand}><View style={s.exploreLogo}><VillageLogo /></View><View style={s.exploreBrandText}><Text style={s.exploreName}>VillageHub</Text><Text style={s.exploreSubtitle}>Buy Nothing</Text></View></View><Text style={s.title}>Good things, shared.</Text>{!backendConfig.demo && !backendConfig.listings ? <View style={s.card}><Text style={s.muted}>Your real account is connected. Listings, messaging, and ratings are scheduled for the next backend phases. No sample listings are shown in real mode.</Text><Button label="Complete or edit profile" variant="ghost" onPress={() => router.push('/complete-profile')} /></View> : null}<Text style={s.muted}>Find something you need. Give something a new home.</Text>
<TextInput accessibilityLabel="Search items" placeholder="Search for something lovely" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} style={s.input} />
<View style={s.chips}>{['For you', ...categories].map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</View>{backendConfig.demo || backendConfig.ai ? <ProposeCategory onApproved={setCategory} /> : null}
<Heading title="Free in your neighborhood" />{feedLoading ? <Text style={s.muted}>Loading items...</Text> : null}<Grid items={backendConfig.demo ? searchItems(items, query, category, 'All', 'Any', 'Any') : feedItems} />{!backendConfig.demo && backendConfig.listings && hasMoreListings ? <Button label="Load more" disabled={feedLoading} variant="ghost" onPress={() => { void fetchFeed(query,category,true); }} /> : null}</Screen>;
}
export function SavedScreen() {
const { items, savedIds, loadSavedListings, moreSaved } = useStore();
const path = usePathname();
useEffect(() => { if(path === '/saved') void loadSavedListings(); },[path,loadSavedListings]);
return <Screen tabBar><Heading title="Saved" subtitle="Good finds to come back to." /><Grid items={items.filter((i) => savedIds.includes(i.id))} />{moreSaved ? <Button label="Load more saved items" onPress={() => { void loadSavedListings(true); }} variant="ghost" /> : null}</Screen>;
}
export function InboxScreen() {
const { conversations, loadInbox, moreInbox, messagingStatus } = useStore();
const path=usePathname();
useEffect(()=>{if(path==='/inbox') void loadInbox();},[path,loadInbox]);
const [refreshing,setRefreshing]=useState(false);
async function refreshInbox(){if(refreshing)return;setRefreshing(true);try{await loadInbox();}finally{setRefreshing(false);}}
const sorted = conversations.filter(c=>!c.hidden).sort((a,b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.lastMessageAt??0)-(a.lastMessageAt??0));
return <Screen tabBar><View style={s.inboxHeading}><View style={{flex:1}}><Heading title="Inbox" subtitle="Swipe left for conversation options." /></View>{!backendConfig.demo && backendConfig.messaging ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh inbox" disabled={refreshing} onPress={()=>{void refreshInbox();}} style={s.refreshInbox}><Text style={s.refreshLabel}>{refreshing?'Refreshing...':'Refresh'}</Text></Pressable> : null}</View>{messagingStatus ? <Text style={s.muted}>{messagingStatus}</Text> : null}<AssistantInboxRow />{sorted.map(c => <InboxRow key={c.id} conversation={c} />)}{moreInbox ? <Button label="Load more conversations" variant="ghost" onPress={()=>{void loadInbox(true);}} /> : null}</Screen>;
}
export function ProfileScreen() {
const { me, items, signOut, loadOwnListings, moreOwn } = useStore();
const path = usePathname();
useEffect(() => { if(path === '/profile') void loadOwnListings(); },[path,loadOwnListings]);
return <Screen tabBar>
<View style={s.profileHeader}><View style={s.profileIdentity}><Heading title={'Hi, ' + me.name} subtitle={me.handle} />{me.avatar ? <Image source={{ uri: me.avatar }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' }]}><Icon name="person" size={38} /></View>}<Text style={s.label}>{[me.neighborhood,me.city].filter(Boolean).join(', ')}</Text><Text style={s.muted}>{me.bio}</Text><Text style={s.muted}>Member since {me.memberSince}</Text></View>{!backendConfig.demo ? <Pressable accessibilityRole="button" onPress={() => router.push('/complete-profile')} style={s.editProfile}><Text style={s.profileButtonLabel}>Edit profile</Text></Pressable> : null}</View>
<Heading title="Your listings" /><Grid items={items.filter((i) => i.hostId === me.id)} />{moreOwn ? <Button label="Load more posts" variant="ghost" onPress={() => { void loadOwnListings(true); }} /> : null}{backendConfig.demo ? <Text style={s.note}>Demo data resets when the app restarts.</Text> : null}<View style={s.logoutSpace}><Pressable accessibilityRole="button" onPress={signOut} style={s.logout}><Text style={[s.profileButtonLabel,{fontSize:14,color:palette.danger}]}>Log out</Text></Pressable></View></Screen>;
}
export function DetailScreen() {
const { id } = useLocalSearchParams<{ id: string }>();
const { items, person, savedIds, toggleSave, openThread, me, claim, relist, ratingFor, refreshListing, removeItem } = useStore();
const [opening,setOpening]=useState(false);
const [messageError,setMessageError]=useState<string|null>(null);
async function messageHost() {
  setOpening(true);setMessageError(null);
  try {const key=await openThread(id);router.push({pathname:'/chat',params:{id:key}});}
  catch(e) {setMessageError((e as {message?:string})?.message??'Unable to open conversation.');}
  finally {setOpening(false);}
}
useEffect(() => { void refreshListing(id); },[id,refreshListing]);
const item = items.find(i => i.id === id);
if (!item) return <Screen><Back /><Heading title="Item unavailable" /></Screen>;
const host = person(item.hostId);
const own = item.hostId === me.id;
return <Screen><Back /><ProductGallery key={item.id} photos={item.photos} title={item.title} />
<View style={d.summary}>
<View style={d.topline}><Text style={d.eyebrow}>{item.category}</Text><View style={[d.status, item.status === 'claimed' && d.claimed]}><Text style={d.statusText}>{item.status === 'available' ? 'Available' : 'Claimed'}</Text></View></View>
<Text style={d.title}>{item.title}</Text><View style={d.priceRow}><Text style={d.price}>Free</Text><Text style={d.muted}>A new home, at no cost</Text></View>
<View style={d.location}><Icon name="pin" size={16} /><Text style={d.locationText}>{item.neighborhood}, {item.city}</Text></View>
<View style={d.tags}>{[item.category,...item.tags].filter((tag,i,all) => all.indexOf(tag) === i).map(tag => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={'Browse '+tag} onPress={()=>router.push({pathname:'/tag',params:{name:tag,kind:tag===item.category?'category':'tag'}})} style={d.tag}><Text style={d.tagText}>#{tag.replace(/^#+/, '').replace(/\s+/g, '')}</Text></Pressable>)}</View>
</View>
<View style={d.panel}><Text style={d.section}>Condition & details</Text><View style={d.condition}><Icon name="check" size={16} /><Text style={d.conditionText}>{item.condition}</Text></View>{item.conditionNote ? <Text style={d.body}>{item.conditionNote}</Text> : null}
<View style={d.specs}><View style={d.spec}><Text style={d.muted}>Size</Text><Text style={d.value}>{item.size || 'Not specified'}</Text></View><View style={d.spec}><Text style={d.muted}>Color</Text><Text style={d.value}>{item.color || 'Not specified'}</Text></View>{item.materials ? <View style={d.spec}><Text style={d.muted}>Materials</Text><Text style={d.value}>{item.materials}</Text></View> : null}{item.fabric ? <View style={d.spec}><Text style={d.muted}>Fabric</Text><Text style={d.value}>{item.fabric}</Text></View> : null}</View></View>
<View style={d.panel}><Text style={d.section}>About this item</Text><Text style={d.body}>{item.description}</Text>{item.features.length ? <View style={d.features}>{item.features.map(feature => <View key={feature} style={d.feature}><Icon name="check" size={14} /><Text style={d.body}>{feature}</Text></View>)}</View> : null}</View>
<View style={d.panel}><Text style={d.section}>Meet your neighbor</Text><Pressable accessibilityRole="button" accessibilityLabel={'View profile of ' + (host?.name ?? 'neighbor')} disabled={!host} onPress={() => host && router.push({ pathname: '/neighbor', params: { id: host.id } })} style={d.hostRow}>{host ? <>{host.avatar ? <Image source={{ uri: host.avatar }} style={d.avatar} /> : <View style={[d.avatar, { backgroundColor: palette.sage }]} />}<View style={d.hostInfo}><Text style={d.hostName}>{host.name}</Text><Text style={d.muted}>{host.handle}</Text><HostRating value={ratingFor(host.id)} /><Text style={d.muted}>Member since {host.memberSince}</Text></View></> : <Text style={d.hostName}>Neighbor</Text>}</Pressable><Text style={d.posted}>Posted {item.postedLabel.toLowerCase()}</Text></View>
<View style={d.actionPanel}><Text style={d.section}>{own ? 'Manage your post' : 'Give it a new chapter'}</Text><Text style={d.muted}>{own ? 'Keep your neighbors up to date.' : 'Arrange pickup directly with the host.'}</Text><Button label={savedIds.includes(id) ? 'Unsave item' : 'Save item'} variant="ghost" onPress={() => toggleSave(id)} />{own ? <><Button label="Edit post" onPress={() => router.push({ pathname: '/post', params: { id } })} /><Button label="Delete post" variant="ghost" onPress={() => removeItem(id)} /><Button label={item.status === 'claimed' ? 'Relist item' : 'Mark as claimed'} variant="ghost" onPress={() => item.status === 'claimed' ? relist(id) : claim(id)} /></> : <Button label={item.status === 'claimed' ? 'Already claimed' : opening ? 'Opening...' : backendConfig.demo || backendConfig.messaging ? 'Message host' : 'Messaging available in Phase 3'} disabled={opening || item.status === 'claimed' || (!backendConfig.demo && !backendConfig.messaging)} onPress={() => {void messageHost();}} />}{messageError ? <Text style={s.muted}>{messageError}</Text> : null}</View></Screen>;

}
export function ChatScreen() {
const { id } = useLocalSearchParams<{ id: string }>();
const { conversations, items, sendMessage, markRead, person, ratingFor, loadThread, messagingStatus } = useStore();
const [text, setText] = useState('');
const [sending,setSending]=useState(false);
const [sendError,setSendError]=useState<string|null>(null);
const retry=useRef<{id:string;text:string;key:string}|null>(null);
const conversation = conversations.find((c) => c.id === id);
const chatItem = items.find(i => i.id === conversation?.itemId);
const neighbor = person(conversation?.participantId ?? chatItem?.hostId ?? '');
const unread = conversation?.unread;
const lastSequence=conversation?.lastSequence;
const visibleSequence=conversation?.messages.at(-1)?.sequence;
const pathname = usePathname();
useEffect(()=>{if(pathname==='/chat') void loadThread(id);},[pathname,id,loadThread]);
useEffect(() => { if (pathname === '/chat' && unread && (backendConfig.demo || visibleSequence===lastSequence)) markRead(id); }, [pathname,id,unread,markRead,visibleSequence,lastSequence]);
async function send() {
  if(sending || !text.trim()) return;
  setSending(true);setSendError(null);
  if(!retry.current || retry.current.id!==id || retry.current.text!==text) retry.current={id,text,key:Date.now()+'-'+Math.random().toString(36).slice(2)};
  try {await sendMessage(id,text,retry.current.key);setText('');retry.current=null;}
  catch(e) {setSendError((e as {message?:string})?.message??'Message not sent. Try again.');}
  finally {setSending(false);}
}
return <Screen keyboard><Back />{neighbor ? <Pressable accessibilityRole="button" accessibilityLabel={'View profile of ' + neighbor.name} onPress={() => router.push({ pathname: '/neighbor', params: { id: neighbor.id } })} style={[s.card, d.hostRow]}>{neighbor.avatar ? <Image source={{ uri: neighbor.avatar }} style={d.avatar} /> : <View style={[d.avatar,{backgroundColor:palette.sage}]} />}<View><Text style={d.hostName}>{neighbor.name}</Text><Text style={d.muted}>{neighbor.handle}</Text><HostRating value={ratingFor(neighbor.id)} /></View></Pressable> : null}
<Heading title={chatItem?.title ?? conversation?.title ?? 'Conversation'} subtitle={backendConfig.demo ? 'Demo conversation - replies are simulated' : undefined} />
{messagingStatus ? <Text style={s.muted}>{messagingStatus}</Text> : null}
{!backendConfig.demo && backendConfig.messaging ? <Button label="Refresh conversation" variant="ghost" onPress={()=>{void loadThread(id);}} /> : null}
{conversation?.moreMessages ? <Button label="Earlier messages" variant="ghost" onPress={()=>{void loadThread(id,true);}} /> : null}
{conversation?.messages.map((m) => <View key={m.id} style={[s.card, m.sender === 'me' && s.mine]}><Text style={s.body}>{m.text}</Text><Text style={s.note}>{m.time}</Text></View>)}
{conversation ? <>{backendConfig.demo || backendConfig.ratings ? <ChatRating key={id} conversation={conversation} /> : null}<TextInput accessibilityLabel="Message" placeholder="Write a friendly message" placeholderTextColor={palette.muted} value={text} onChangeText={setText} style={s.input} multiline maxLength={4000} editable={!sending} />{sendError ? <Text style={s.muted}>{sendError}</Text> : null}<Button label={sending ? 'Sending...' : 'Send message'} disabled={sending || !text.trim()} onPress={()=>{void send();}} /></> : <Text style={s.muted}>Conversation unavailable or still loading.</Text>}</Screen>;
}
export function PostScreen() {
const { id } = useLocalSearchParams<{ id?: string }>();
return <PostEditor key={id ?? 'new'} itemId={id} />;
}
const s = StyleSheet.create({
profileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
profileIdentity: { flex: 1, gap: 4 },
editProfile: { marginTop: 18, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, borderRadius: 12 },
profileButtonLabel: { fontSize: 12, fontWeight: '500', color: palette.forest },
logoutSpace: { marginTop: 48, marginBottom: 12, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
logout: { minWidth: 156, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#F8E1DF', borderWidth: 1, borderColor: '#EBC1BE', borderRadius: 12 },
inboxHeading:{flexDirection:'row',alignItems:'flex-start',gap:8},
refreshInbox:{marginTop:18,minHeight:44,paddingHorizontal:10,justifyContent:'center',borderRadius:12,borderWidth:1,borderColor:palette.line,backgroundColor:palette.white},
refreshLabel:{fontSize:12,color:palette.forest,fontWeight:'600'},
exploreBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 24 },
exploreLogo: { width: 58, height: 58 },
exploreBrandText: { flex: 1 },
exploreName: { fontFamily: serif, fontSize: 27, color: palette.forest },
exploreSubtitle: { fontSize: 13, letterSpacing: 1.3, color: palette.forest, marginTop: 2 },
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
  tag: { paddingHorizontal: 10, paddingVertical: 8, minHeight:44, justifyContent:'center', borderRadius: 7, backgroundColor: palette.forestSoft },
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
