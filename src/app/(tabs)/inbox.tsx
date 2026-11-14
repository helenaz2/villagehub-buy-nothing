import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Rule } from '@/components/bits';
import { Button } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { T } from '@/components/T';
import { useStore } from '@/data/store';
import { ago, dayAndTime, firstName } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

export default function Inbox() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const meId = useStore((s) => s.meId);
  const conversations = useStore((s) => s.conversations);
  const messages = useStore((s) => s.messages);
  const listings = useStore((s) => s.listings);
  const users = useStore((s) => s.users);
  const handoffs = useStore((s) => s.handoffs);

  const rows = conversations
    .filter((c) => c.buyerId === meId || c.sellerId === meId)
    .map((c) => {
      const last = messages.filter((m) => m.conversationId === c.id).at(-1);
      const listing = listings.find((l) => l.id === c.listingId);
      const other = users.find((u) => u.id === (c.sellerId === meId ? c.buyerId : c.sellerId));
      const done = handoffs.find((h) => h.conversationId === c.id)?.status === 'done';
      return { c, last, listing, other, done };
    })
    .sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.c.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <Rule style={{ marginLeft: space.gutter + 68 + space.sm }} />}
        ListHeaderComponent={
          <T variant="display" accessibilityRole="header" style={{ paddingHorizontal: space.gutter, paddingTop: insets.top + space.sm, paddingBottom: space.md }}>
            Messages
          </T>
        }
        ListEmptyComponent={
          <EmptyState icon={MessageCircle} title="Quiet for now" body="When you claim something, or a neighbor claims yours, the conversation shows up here.">
            <Button kind="secondary" compact label="See what is nearby" onPress={() => router.navigate('/browse')} />
          </EmptyState>
        }
        renderItem={({ item: { c, last, listing, other, done } }) => {
          if (!listing || !other) return null;
          const unread = !!last && last.senderId !== meId && last.senderId !== 'system' && !done;
          const selling = c.sellerId === meId;
          return (
            <Pressable
              onPress={() => router.push(`/chat/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${listing.title} with ${other.name}. ${last?.body ?? ''}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: space.sm,
                paddingHorizontal: space.gutter,
                paddingVertical: space.sm,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Photo uri={listing.photos[0]} rounded={radius.photo} style={{ width: 68, height: 68, opacity: done ? 0.55 : 1 }} />
              <View style={{ flex: 1, gap: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
                  <T variant="labelStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {listing.title}
                  </T>
                  <T variant="caption" color="textFaint">
                    {last ? ago(last.createdAt) : ''}
                  </T>
                </View>
                <T variant="caption" color="textSoft" numberOfLines={1}>
                  {done
                    ? `Handed off ${selling ? 'to' : 'by'} ${firstName(other.name)}`
                    : c.pickupAt
                      ? `${selling ? 'Giving to' : 'From'} ${firstName(other.name)}, pickup ${dayAndTime(c.pickupAt).toLowerCase()}`
                      : `${selling ? 'Giving to' : 'From'} ${firstName(other.name)}, no time set yet`}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
                  <T variant="label" color={unread ? 'text' : 'textSoft'} numberOfLines={1} style={{ flex: 1 }}>
                    {last?.senderId === meId ? 'You: ' : ''}
                    {last?.body ?? 'Say hello'}
                  </T>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
