import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/data/store';
import type { Conversation } from '@/types/listing';
import { palette } from '@/constants/palette';
import { Button } from './ui';
import { ratingDueAt } from '@/lib/rating-timing';
import { Icon } from './icon';

export function ChatRating({ conversation: c }: { conversation: Conversation }) {
  const { me, items, person, rateConversation, dismissRating } = useStore();
  const pathname = usePathname();
  const [stars, setStars] = useState(0);
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const host = items.find(i => i.id === c.itemId)?.hostId;
  const otherId = c.participantId ?? (host !== me.id ? host : undefined);
  const other = person(otherId ?? '');
  const eligible = !!other && other.id !== me.id && c.messages.some(m => m.sender === 'me') && c.messages.some(m => m.sender === 'them');
  const mine = c.ratings?.[me.id];
  const theirs = otherId ? c.ratings?.[otherId] : undefined;
  const dueAt = ratingDueAt(c);
  useEffect(() => {
    if (!eligible || mine || dueAt === undefined || pathname !== '/chat') return;
    const timer = setTimeout(() => setReadyAt(dueAt), Math.max(0, dueAt - Date.now()));
    return () => clearTimeout(timer);
  }, [dueAt, eligible, mine, pathname]);
  if (!eligible || pathname !== '/chat' || dueAt === undefined || readyAt !== dueAt) return null;
  if (!mine && c.ratingDismissedBy?.includes(me.id)) return null;
  return <View style={s.status} accessibilityLiveRegion="polite">
    <View style={s.sender}><Icon name="spark" size={16} /><Text style={s.small}>VillageHub assistant</Text></View>
    {mine ? <><Text style={s.body}>Thanks for rating {other?.name}. Your rating: {mine}/5.</Text><Text style={s.small}>{theirs ? 'Your neighbor has also submitted a rating.' : 'Your neighbor can rate you too.'}</Text></> : <>
      <Text style={s.title}>How was chatting with {other?.name}</Text>
      <Text style={s.small}>Leave a rating whenever you are ready. Both neighbors can rate each other.</Text>
      <View style={s.stars}>{[1,2,3,4,5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={n + ' stars'} accessibilityState={{ selected: stars === n }} onPress={() => setStars(n)} style={[s.star, n <= stars && s.selected]}><Icon name="star" size={24} color={n <= stars ? palette.terracotta : palette.muted} /></Pressable>)}</View>
      <Text style={s.small}>{stars ? stars + ' out of 5 stars' : 'Choose a rating'}</Text>
      <Button label="Submit rating" disabled={!stars} onPress={() => rateConversation(c.id, stars)} />
      <Pressable accessibilityRole="button" onPress={() => dismissRating(c.id)} style={s.skip}><Text style={s.small}>Skip for now</Text></Pressable>
    </>}
  </View>;
}
const s = StyleSheet.create({
  status: { alignSelf: 'flex-start', width: '94%', padding: 16, borderRadius: 18, borderTopLeftRadius: 4, backgroundColor: palette.forestSoft, gap: 12, marginVertical: 14 },
  sender: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, color: palette.forest, fontWeight: '600' },
  body: { color: palette.ink, fontSize: 14, lineHeight: 21 },
  small: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  stars: { flexDirection: 'row', justifyContent: 'space-between' },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  selected: { backgroundColor: palette.white }, skip: { alignSelf: 'center', padding: 8 },
});
