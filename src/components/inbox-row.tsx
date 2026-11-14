import { useRef } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useStore } from '@/data/store';
import { palette } from '@/constants/palette';
import type { Conversation } from '@/types/listing';

export function InboxRow({ conversation: c }: { conversation: Conversation }) {
  const { items, person, deleteConversation, togglePin, setUnread } = useStore();
  const swipe = useRef<SwipeableMethods>(null);
  const item = items.find(i => i.id === c.itemId);
  const neighbor = person(c.participantId ?? item?.hostId ?? '');
  function action(run: () => void) { swipe.current?.close(); run(); }
  return <View style={s.wrap}><Swipeable ref={swipe} overshootRight={false} renderRightActions={() => <View style={s.actions}>
    <Pressable accessibilityRole="button" style={[s.action,s.delete]} onPress={() => action(() => deleteConversation(c.id))}><Text style={s.white}>Delete</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.action} onPress={() => action(() => togglePin(c.id))}><Text style={s.white}>{c.pinned ? 'Unpin' : 'Pin'}</Text></Pressable>
    <Pressable accessibilityRole="button" style={s.action} onPress={() => action(() => setUnread(c.id, !c.unread))}><Text style={s.white}>{c.unread ? 'Mark read' : 'Mark unread'}</Text></Pressable>
  </View>}><View style={s.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Open conversation with ' + (neighbor?.name ?? 'neighbor')} style={s.open} onPress={() => router.push({ pathname: '/chat', params: { id: c.id } })}>
      {neighbor ? <Image source={{ uri: neighbor.avatar }} style={s.avatar} /> : <View style={s.avatar} />}
      <View style={s.text}><Text style={s.name}>{neighbor?.name ?? 'Neighbor'}{c.pinned ? ' ? Pinned' : ''}</Text><Text style={s.handle}>{neighbor?.handle}</Text><Text style={s.preview} numberOfLines={2}>{c.messages.at(-1)?.text ?? 'Start a conversation'}</Text></View>
      <View accessibilityLabel={c.unread ? 'Unread' : 'Read'} style={[s.dot, !c.unread && s.read]} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={8} onPress={() => swipe.current?.openRight()} style={s.more}><Text style={s.name}>???</Text></Pressable>
  </View></Swipeable></View>;
}
const s = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  row: { backgroundColor: palette.white, flexDirection: 'row', alignItems: 'center' },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.sage },
  text: { flex: 1, gap: 3 }, name: { fontSize: 15, fontWeight: '600', color: palette.ink },
  handle: { fontSize: 12, color: palette.muted }, preview: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.danger }, read: { backgroundColor: 'transparent' },
  more: { padding: 10 }, actions: { flexDirection: 'row' },
  action: { width: 72, justifyContent: 'center', alignItems: 'center', padding: 8, backgroundColor: palette.forest },
  delete: { backgroundColor: palette.danger }, white: { color: palette.white, fontSize: 12, textAlign: 'center' },
});
