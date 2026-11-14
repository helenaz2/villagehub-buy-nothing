import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, QrCode } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/bits';
import { Button, ICON_STROKE } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Photo } from '@/components/Photo';
import { T } from '@/components/T';
import { afterMyMessage } from '@/data/demoBot';
import * as remote from '@/data/remote';
import { useListing, useStore, useUser } from '@/data/store';
import { syncedBackend } from '@/lib/config';
import { clock, dayAndTime, firstName } from '@/lib/format';
import { addToCalendar, remindBeforePickup, safeSpot, suggestSlots } from '@/lib/pickup';
import { radius, space, touch, type, useTheme } from '@/theme';

const QUICK_BUYER = ['Is this still available?', 'I can come at 5pm', 'Can you hold it until tomorrow?', 'On my way, about 10 minutes out'];
const QUICK_SELLER = ['Yes, still available', 'That time works', 'I can hold it until tomorrow', 'It is on the porch for you'];

export default function Chat() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useStore((s) => s.conversations.find((c) => c.id === id));
  const allMessages = useStore((s) => s.messages);
  const meId = useStore((s) => s.meId);
  const sendMessage = useStore((s) => s.sendMessage);
  const setPickup = useStore((s) => s.setPickup);
  const handoffs = useStore((s) => s.handoffs);
  const listing = useListing(conversation?.listingId);
  const iAmSeller = conversation?.sellerId === meId;
  const other = useUser(iAmSeller ? conversation?.buyerId : conversation?.sellerId);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const messages = allMessages.filter((m) => m.conversationId === id);
  const handoff = handoffs.find((h) => h.conversationId === id);

  useEffect(() => {
    if (!syncedBackend || !id) return;
    return remote.subscribeToMessages(id, useStore.getState().receiveMessage);
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (!conversation || !listing || !other) return <Redirect href="/inbox" />;

  const send = (body: string) => {
    if (!body.trim()) return;
    sendMessage(conversation.id, body);
    setText('');
    afterMyMessage(conversation.id);
  };

  const propose = (ts: number) => {
    setPickup(conversation.id, { pickupAt: ts });
    send(`How about ${dayAndTime(ts)}?`);
  };

  const done = handoff?.status === 'done';
  const where = conversation.porch
    ? `Porch pickup at ${listing.address}`
    : (conversation.meetSpot ?? listing.address);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.head, { paddingTop: insets.top + space.xxs, borderBottomColor: colors.line }]}>
        <BackButton onPress={() => router.back()} />
        <Pressable style={styles.headMain} onPress={() => router.push(`/listing/${listing.id}`)} accessibilityRole="button" accessibilityLabel={`${listing.title}, view listing`}>
          <Photo uri={listing.photos[0]} rounded={radius.photo} style={{ width: 44, height: 44 }} />
          <View style={{ flex: 1 }}>
            <T variant="labelStrong" numberOfLines={1}>
              {listing.title}
            </T>
            <T variant="caption" color="textSoft" numberOfLines={1}>
              {iAmSeller ? `${firstName(other.name)} is picking it up` : `From ${firstName(other.name)} in ${other.neighborhood}`}
            </T>
          </View>
        </Pressable>
        {!done ? (
          <Button
            compact
            kind="secondary"
            icon={QrCode}
            label={iAmSeller ? 'Code' : 'Scan'}
            onPress={() => router.push(`/handoff/${conversation.id}`)}
            accessibilityHint="Opens the pickup code for the handoff"
          />
        ) : null}
      </View>

      <ScrollView ref={scroller} contentContainerStyle={styles.thread} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!done ? (
          <View style={[styles.plan, { backgroundColor: colors.sageSoft }]}>
            {conversation.pickupAt ? (
              <>
                <T variant="caption" color="textSoft">
                  Pickup
                </T>
                <T variant="subhead">{dayAndTime(conversation.pickupAt)}</T>
                <T variant="label" color="textSoft">
                  {where}
                </T>
                <View style={styles.wrap}>
                  <Chip
                    label="Add to calendar"
                    onPress={() =>
                      void addToCalendar({ title: `Curbside pickup: ${listing.title}`, at: conversation.pickupAt!, where, details: `With ${other.name}. Bring the Curbside app for the pickup code.` })
                    }
                  />
                  <Chip label="Remind me" onPress={() => void remindBeforePickup(listing.title, conversation.pickupAt!).then(setStatus)} />
                  <Chip label="Change time" onPress={() => setPickup(conversation.id, { pickupAt: null })} />
                </View>
                {status ? (
                  <T variant="caption" color="textSoft" accessibilityLiveRegion="polite">
                    {status}
                  </T>
                ) : null}
              </>
            ) : (
              <>
                <T variant="subhead">Pick a time</T>
                <T variant="label" color="textSoft">
                  Suggested from daylight hours and how soon the item is available.
                </T>
                <View style={styles.wrap}>
                  {suggestSlots().map((ts) => (
                    <Chip key={ts} label={dayAndTime(ts)} onPress={() => propose(ts)} />
                  ))}
                </View>
              </>
            )}
            {iAmSeller ? (
              <View style={styles.wrap}>
                <Chip
                  label="Leave it on the porch"
                  selected={conversation.porch}
                  onPress={() => setPickup(conversation.id, { porch: !conversation.porch, meetSpot: null })}
                />
                <Chip
                  label="Meet somewhere public"
                  selected={!!conversation.meetSpot}
                  onPress={() =>
                    setPickup(conversation.id, { meetSpot: conversation.meetSpot ? null : safeSpot(listing.neighborhood), porch: false })
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {messages.map((m) => {
          if (m.senderId === 'system') {
            return (
              <T key={m.id} variant="caption" color="textSoft" center style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
                {m.body}
              </T>
            );
          }
          const mine = m.senderId === meId;
          return (
            <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: colors.action, borderBottomRightRadius: 4 }
                    : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderBottomLeftRadius: 4 },
                ]}>
                <T style={{ color: mine ? colors.onAction : colors.text }}>{m.body}</T>
              </View>
              <T variant="caption" color="textFaint" style={{ marginTop: 2, marginHorizontal: 4 }}>
                {clock(m.createdAt)}
              </T>
            </View>
          );
        })}
      </ScrollView>

      {done ? (
        <View style={{ padding: space.gutter, paddingBottom: insets.bottom + space.md }}>
          <T color="textSoft" center>
            This handoff is complete.
          </T>
        </View>
      ) : (
        <View style={{ paddingBottom: insets.bottom + space.xs, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.line }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quick}>
            {(iAmSeller ? QUICK_SELLER : QUICK_BUYER).map((q) => (
              <Chip key={q} label={q} onPress={() => send(q)} />
            ))}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${firstName(other.name)}`}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Message"
              multiline
              style={[type.body, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }]}
            />
            <Pressable
              onPress={() => send(text)}
              disabled={!text.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={[styles.send, { backgroundColor: colors.action, opacity: text.trim() ? 1 : 0.35 }]}>
              <ArrowUp size={22} color={colors.onAction} strokeWidth={ICON_STROKE + 0.5} />
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.xs,
    paddingRight: space.md,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  thread: { padding: space.gutter, gap: space.sm },
  plan: { marginHorizontal: -space.gutter, marginTop: -space.gutter, padding: space.gutter, gap: space.xxs, marginBottom: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  bubble: { maxWidth: '82%', paddingHorizontal: space.md, paddingVertical: 10, borderRadius: 18 },
  quick: { paddingHorizontal: space.gutter, paddingVertical: space.xs, gap: space.xs },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, paddingHorizontal: space.gutter },
  input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: space.md, paddingTop: 10, paddingBottom: 10, maxHeight: 120, minHeight: touch.min },
  send: { width: touch.min, height: touch.min, borderRadius: touch.min / 2, alignItems: 'center', justifyContent: 'center' },
});
