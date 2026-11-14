import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Rule, Stars } from '@/components/bits';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { T } from '@/components/T';
import { useListing, useStore, useUser } from '@/data/store';
import { syncedBackend } from '@/lib/config';
import { firstName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { estimateImpact, milesNotDriven } from '@/lib/impact';
import { motion, palette, radius, space, useTheme } from '@/theme';

/**
 * The handoff. The giver shows a code, the receiver scans it. That one scan
 * marks the item as given, releases any held payment, and asks both sides for
 * a rating.
 */
export default function HandoffScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useStore((s) => s.conversations.find((c) => c.id === id));
  const handoff = useStore((s) => s.handoffs.find((h) => h.conversationId === id));
  const meId = useStore((s) => s.meId);
  const completeHandoff = useStore((s) => s.completeHandoff);
  const rate = useStore((s) => s.rate);
  const listing = useListing(conversation?.listingId);
  const iAmSeller = conversation?.sellerId === meId;
  const other = useUser(iAmSeller ? conversation?.buyerId : conversation?.sellerId);
  const [permission, requestPermission] = useCameraPermissions();
  const [stars, setStars] = useState(0);
  const [tip, setTip] = useState(0);
  const [tipTo, setTipTo] = useState<'seller' | 'charity'>('seller');
  const [wrong, setWrong] = useState(false);
  const locked = useRef(false);
  const pop = useSharedValue(0.8);

  const done = handoff?.status === 'done';

  useEffect(() => {
    if (done) {
      haptic.success();
      pop.value = withSpring(1, motion.spring);
    }
  }, [done, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  if (!conversation || !handoff || !listing || !other) return <Redirect href="/inbox" />;

  const onScan = (data: string) => {
    if (locked.current) return;
    locked.current = true;
    if (data.trim().toUpperCase() === handoff.token) {
      completeHandoff(handoff.token);
    } else {
      haptic.warn();
      setWrong(true);
      setTimeout(() => {
        locked.current = false;
      }, 1500);
    }
  };

  const finish = () => {
    if (stars > 0) rate(handoff.id, other.id, stars);
    router.dismissTo(iAmSeller ? '/you' : `/chat/${conversation.id}`);
  };

  const impact = estimateImpact(listing);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.xs }}>
      <IconButton icon={X} label="Close" onPress={() => router.back()} style={{ marginLeft: space.sm }} />
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + space.xl, gap: space.lg }} showsVerticalScrollIndicator={false}>
        {done ? (
          <>
            <Animated.View style={[{ gap: space.xs }, popStyle]}>
              <T variant="display" accessibilityRole="header">
                Handed off.
              </T>
              <T color="textSoft">
                {listing.title} now lives with {iAmSeller ? firstName(other.name) : 'you'}.
                {listing.priceUsd > 0 ? ` The $${listing.priceUsd} hold was released to ${iAmSeller ? 'you' : firstName(other.name)}.` : ''}
              </T>
            </Animated.View>

            <View>
              <Rule />
              <View style={styles.stats}>
                <Stat value={`${impact.lbs} lb`} label="kept out of landfill" />
                <Stat value={`${impact.co2Kg} kg`} label={`CO2e avoided, like ${milesNotDriven(impact.co2Kg)} miles not driven`} />
                {impact.savedUsd > 0 ? <Stat value={`$${impact.savedUsd}`} label="saved for a neighbor" /> : null}
              </View>
              <Rule />
            </View>

            <View style={{ gap: space.sm }}>
              <T variant="heading">How was {firstName(other.name)}?</T>
              <Stars value={stars} onChange={setStars} />
            </View>

            {!iAmSeller ? (
              <View style={{ gap: space.xs }}>
                <T variant="heading">Say thanks with a tip</T>
                <T variant="label" color="textSoft">
                  Optional. It can go to {firstName(other.name)} or to a local furniture bank. Test mode, no real charge.
                </T>
                <View style={styles.wrap}>
                  {[0, 2, 5, 10].map((n) => (
                    <Chip key={n} label={n === 0 ? 'No tip' : `$${n}`} selected={tip === n} onPress={() => setTip(n)} />
                  ))}
                </View>
                {tip > 0 ? (
                  <View style={styles.wrap}>
                    <Chip label={`To ${firstName(other.name)}`} selected={tipTo === 'seller'} onPress={() => setTipTo('seller')} />
                    <Chip label="To a furniture bank" selected={tipTo === 'charity'} onPress={() => setTipTo('charity')} />
                  </View>
                ) : null}
              </View>
            ) : null}

            <Button label={tip > 0 && !iAmSeller ? `Send $${tip} and finish` : 'Done'} onPress={finish} />
          </>
        ) : iAmSeller ? (
          <>
            <View style={{ gap: space.xs }}>
              <T variant="title" accessibilityRole="header">
                Show this to {firstName(other.name)}
              </T>
              <T color="textSoft">
                They scan it when the {listing.title.toLowerCase()} is in their hands. That closes the listing
                {listing.priceUsd > 0 ? ` and releases the $${listing.priceUsd} payment to you.` : '.'}
              </T>
            </View>
            <View style={[styles.ticket, { backgroundColor: palette.paperRaised, borderColor: colors.line }]}>
              <QRCode value={handoff.token} size={220} color={palette.forest} backgroundColor={palette.paperRaised} />
              <View style={[styles.tear, { borderColor: palette.rule }]} />
              <T variant="subhead" style={{ color: palette.forest, letterSpacing: 2 }} selectable>
                {handoff.token}
              </T>
            </View>
            {!syncedBackend ? (
              <Button
                kind="secondary"
                label={`Demo: ${firstName(other.name)} scans the code`}
                onPress={() => completeHandoff(handoff.token)}
                accessibilityHint="Stands in for the second phone in demo mode"
              />
            ) : null}
          </>
        ) : (
          <>
            <View style={{ gap: space.xs }}>
              <T variant="title" accessibilityRole="header">
                Scan {firstName(other.name)}’s code
              </T>
              <T color="textSoft">Do this once the item is in your hands. It confirms the handoff for both of you.</T>
            </View>
            <View style={[styles.finder, { backgroundColor: palette.nightSunk }]}>
              {permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => onScan(data)}
                />
              ) : (
                <View style={styles.finderGate}>
                  <T style={{ color: palette.cream }} center>
                    The camera reads the pickup code.
                  </T>
                  <Button label="Turn on the camera" onPress={() => void requestPermission()} style={{ backgroundColor: palette.sageBright }} />
                </View>
              )}
            </View>
            {wrong ? (
              <T variant="label" style={{ color: colors.accentText }} accessibilityLiveRegion="polite">
                That code belongs to a different pickup. Ask {firstName(other.name)} to open this listing’s code.
              </T>
            ) : null}
            {!syncedBackend ? (
              <Button
                kind="secondary"
                label="Demo: scan the code"
                onPress={() => completeHandoff(handoff.token)}
                accessibilityHint="Stands in for the second phone in demo mode"
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="heading">{value}</T>
      <T variant="caption" color="textSoft">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  ticket: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderRadius: radius.control,
  },
  tear: { alignSelf: 'stretch', borderTopWidth: 1.5, borderStyle: 'dashed' },
  finder: { height: 320, borderRadius: radius.control, overflow: 'hidden' },
  finderGate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
});
