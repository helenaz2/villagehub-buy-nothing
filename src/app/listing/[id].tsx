import { router, useLocalSearchParams } from 'expo-router';
import { Flag, Lock, MapPin, SearchX } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BackButton, EmptyState, IconButton, PersonLine, Rule } from '@/components/bits';
import { Button, ICON_STROKE } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Photo } from '@/components/Photo';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { afterConfirm, afterMyClaim } from '@/data/demoBot';
import { useListing, useStore, useUser } from '@/data/store';
import { config } from '@/lib/config';
import {
  ago,
  categoryLabel,
  conditionLabel,
  dims,
  away,
  firstName,
  milesBetween,
  modeLabel,
  pickupLabel,
  price,
  weightLabel,
} from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { space, useTheme } from '@/theme';

export default function ListingDetail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);
  const owner = useUser(listing?.ownerId);
  const meId = useStore((s) => s.meId);
  const users = useStore((s) => s.users);
  const allClaims = useStore((s) => s.claims);
  const conversations = useStore((s) => s.conversations);
  const claim = useStore((s) => s.claim);
  const confirmClaim = useStore((s) => s.confirmClaim);
  const withdrawClaim = useStore((s) => s.withdrawClaim);
  const [page, setPage] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  if (!listing || !owner) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <BackButton onPress={() => router.back()} />
        <EmptyState icon={SearchX} title="This listing is gone" body="It may have been picked up or removed by the owner." />
      </View>
    );
  }

  const mine = listing.ownerId === meId;
  const claims = allClaims.filter((c) => c.listingId === listing.id && c.status !== 'passed').sort((a, b) => a.createdAt - b.createdAt);
  const myClaim = claims.find((c) => c.userId === meId);
  const confirmed = claims.find((c) => c.status === 'confirmed');
  const conversation = conversations.find(
    (c) => c.listingId === listing.id && (c.buyerId === meId || c.sellerId === meId),
  );
  const canSeeAddress = mine || myClaim?.status === 'confirmed';
  const distance = milesBetween(config.region, listing.approx);
  const free = listing.priceUsd <= 0;

  const doClaim = () => {
    const made = claim(listing.id, '');
    if (!made) return;
    haptic.success();
    afterMyClaim(listing.id);
    setPayOpen(false);
    // First come, first served confirms on the spot, so go straight to the chat.
    const conv = useStore.getState().conversations.find((c) => c.listingId === listing.id && c.buyerId === meId);
    if (conv) router.push(`/chat/${conv.id}`);
  };

  const choose = (claimId: string) => {
    const conv = confirmClaim(claimId);
    if (!conv) return;
    haptic.success();
    afterConfirm(listing.id);
    router.push(`/chat/${conv.id}`);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const bar = (() => {
    if (listing.status === 'given') return <T color="textSoft" center>This one found a new home.</T>;
    if (conversation) return <Button label={mine ? 'Open chat with the claimant' : 'Open chat'} onPress={() => router.push(`/chat/${conversation.id}`)} />;
    if (mine) {
      return (
        <T color="textSoft" center>
          {claims.length === 0 ? 'No claims yet. Most items get one within the hour.' : 'Pick someone from the list above.'}
        </T>
      );
    }
    if (myClaim) {
      return (
        <View style={{ gap: space.xs }}>
          <T center variant="bodyStrong">
            You are in line. {firstName(owner.name)} will pick someone soon.
          </T>
          <Button kind="quiet" compact label="Withdraw my claim" onPress={() => withdrawClaim(myClaim.id)} />
        </View>
      );
    }
    if (confirmed) return <T color="textSoft" center>Someone else is picking this up.</T>;
    return (
      <Button
        label={free ? (listing.mode === 'first_come' ? 'Claim it' : 'Ask for it') : `Claim it for $${listing.priceUsd}`}
        onPress={() => (free ? doClaim() : setPayOpen(true))}
        accessibilityHint={listing.mode === 'first_come' ? 'The first claim gets the item' : 'Adds you to the list the owner picks from'}
      />
    );
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
            {listing.photos.map((uri, i) => (
              <Photo key={uri} uri={uri} style={{ width, height: width * 1.08 }} label={`${listing.title}, photo ${i + 1} of ${listing.photos.length}`} priority="high" />
            ))}
          </ScrollView>
          <View style={[styles.photoBar, { top: insets.top + space.xs }]}>
            <BackButton onPress={() => router.back()} tone="onPhoto" />
            {!mine ? <IconButton icon={Flag} label="Report or block" onPress={() => setReportOpen(true)} tone="onPhoto" /> : null}
          </View>
          {listing.photos.length > 1 ? (
            <View style={[styles.count, { backgroundColor: colors.bg }]}>
              <T variant="caption">
                {page + 1} of {listing.photos.length}
              </T>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.lg, gap: space.lg }}>
          <View style={{ gap: space.xxs }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              <T variant="title" style={{ flex: 1 }} accessibilityRole="header">
                {listing.title}
              </T>
              <T variant="title" style={{ color: free ? colors.accentText : colors.text }}>
                {price(listing.priceUsd)}
              </T>
            </View>
            <T variant="label" color="textSoft">
              {away(distance)} in {listing.neighborhood}, posted {ago(listing.createdAt)}
            </T>
          </View>

          <View style={styles.wrap}>
            <Chip label={conditionLabel[listing.condition]} />
            <Chip label={pickupLabel[listing.pickup]} />
            {listing.availableToday ? <Chip label="Pickup today" /> : null}
          </View>

          <T>{listing.description}</T>

          <View>
            <Rule />
            {[
              ['Size', `${dims(listing.dims, 'in')}  (${dims(listing.dims, 'cm')})`],
              ['Weight', weightLabel[listing.weightClass]],
              ['Color', listing.color],
              ['Material', listing.material],
              ...(listing.brand ? [['Brand', listing.brand]] : []),
              ['Kind', `${listing.subcategory}, ${categoryLabel[listing.category].toLowerCase()}`],
            ].map(([k, v]) => (
              <View key={k}>
                <View style={styles.fact}>
                  <T variant="label" color="textSoft" style={{ width: 86 }}>
                    {k}
                  </T>
                  <T variant="label" style={{ flex: 1 }}>
                    {v}
                  </T>
                </View>
                <Rule />
              </View>
            ))}
          </View>

          <View style={{ gap: space.sm }}>
            <PersonLine user={owner} suffix={mine ? 'this is you' : undefined} />
            <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}>
              {canSeeAddress ? (
                <MapPin size={18} color={colors.text} strokeWidth={ICON_STROKE} style={{ marginTop: 3 }} />
              ) : (
                <Lock size={18} color={colors.textSoft} strokeWidth={ICON_STROKE} style={{ marginTop: 3 }} />
              )}
              <T variant="label" color={canSeeAddress ? 'text' : 'textSoft'} style={{ flex: 1 }}>
                {canSeeAddress
                  ? listing.address
                  : `Somewhere in ${listing.neighborhood}. The address is shared once ${firstName(owner.name)} confirms a pickup.`}
              </T>
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            <T variant="heading">{listing.mode === 'first_come' ? 'First come, first served' : claims.length ? `${claims.length} interested` : 'Owner picks'}</T>
            <T variant="label" color="textSoft">
              {modeLabel[listing.mode]}. This list updates live.
            </T>
            {claims.length === 0 ? (
              <T color="textSoft">Nobody has claimed it yet.</T>
            ) : (
              claims.map((c, i) => {
                const who = users.find((u) => u.id === c.userId);
                if (!who) return null;
                const isMe = c.userId === meId;
                return (
                  <View key={c.id} style={styles.claim}>
                    <T variant="subhead" color="textFaint" style={{ width: 22 }}>
                      {i + 1}
                    </T>
                    <Avatar name={who.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <T variant="labelStrong">
                        {isMe ? 'You' : firstName(who.name)}
                        {c.status === 'confirmed' ? ', confirmed' : ''}
                      </T>
                      <T variant="caption" color="textSoft">
                        {mine && c.note ? c.note : `${who.neighborhood}, ${ago(c.createdAt)}`}
                      </T>
                    </View>
                    {mine && listing.status === 'available' ? (
                      <Button compact label={`Choose ${firstName(who.name)}`} onPress={() => choose(c.id)} />
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: insets.bottom + space.sm }]}>{bar}</View>

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title={`Hold $${listing.priceUsd} for pickup`}>
        <T color="textSoft">
          Your payment is held, not sent. {firstName(owner.name)} is only paid when you scan the pickup code in person. If the pickup falls through, the hold is released.
        </T>
        <T variant="caption" color="textFaint">
          Stripe test mode. No real money moves in this build.
        </T>
        <Button label={`Hold $${listing.priceUsd} and claim`} onPress={doClaim} />
      </Sheet>

      <Sheet visible={reportOpen} onClose={() => setReportOpen(false)} title={reported ? 'Thank you' : 'Something wrong?'}>
        {reported ? (
          <T color="textSoft">We got your report: “{reported}”. A person reviews every one, usually within a day.</T>
        ) : (
          <>
            {['Not safe to give away', 'Looks like a scam', 'Wrong or misleading photos', `Block ${firstName(owner.name)}`].map((r) => (
              <Button key={r} kind="secondary" label={r} onPress={() => setReported(r)} />
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  photoBar: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between' },
  count: { position: 'absolute', right: 0, bottom: 0, paddingHorizontal: space.md, paddingVertical: 6, borderTopLeftRadius: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  fact: { flexDirection: 'row', paddingVertical: space.sm, gap: space.sm },
  claim: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
});
