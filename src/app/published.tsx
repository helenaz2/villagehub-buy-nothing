import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { T } from '@/components/T';
import { useListing, useStore } from '@/data/store';
import { firstName, price } from '@/lib/format';
import { palette, radius, space, useTheme } from '@/theme';

/**
 * The listing-created moment. The photo settles onto a paper hang tag, the
 * kind you would tie to a chair left on the curb, and the tag swings once.
 * The line under it updates live when the first neighbor claims.
 */
export default function Published() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);
  const next = useStore((s) => s.draft);
  const allClaims = useStore((s) => s.claims);
  const claims = allClaims.filter((c) => c.listingId === id && c.status !== 'passed');
  const users = useStore((s) => s.users);

  const drop = useSharedValue(reduced ? 0 : -260);
  const swing = useSharedValue(reduced ? 0 : -9);
  const text = useSharedValue(0);

  useEffect(() => {
    drop.value = withSpring(0, { damping: 13, stiffness: 140, mass: 1 });
    // A short pendulum that comes to rest slightly off level, the way a hand-tied tag hangs.
    swing.value = withDelay(
      160,
      withSequence(
        withTiming(6, { duration: 240 }),
        withTiming(-4, { duration: 300 }),
        withTiming(1.5, { duration: 300 }),
        withTiming(-1.5, { duration: 340 }),
      ),
    );
    text.value = withDelay(420, withTiming(1, { duration: 360 }));
  }, [drop, swing, text]);

  const tagStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value }, { rotate: `${swing.value}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 8 }] }));

  if (!listing) return <Redirect href="/" />;

  const first = claims[0] ? users.find((u) => u.id === claims[0]!.userId) : undefined;
  const waitingLine = first
    ? claims.length > 1
      ? `${firstName(first.name)} and ${claims.length - 1} more would like it.`
      : `${firstName(first.name)} would like it.`
    : 'Neighbors within two miles can see it now.';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.stage}>
        <View style={[styles.string, { backgroundColor: colors.textFaint }]} />
        <Animated.View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.line }, tagStyle]}>
          <View style={[styles.hole, { backgroundColor: colors.bg, borderColor: colors.line }]} />
          <Photo uri={listing.photos[0]} rounded={radius.photo} style={styles.photo} label={listing.title} priority="high" />
          <T variant="subhead" numberOfLines={2}>
            {listing.title}
          </T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T variant="label" color="textSoft">
              {listing.neighborhood}
            </T>
            <T variant="subhead" style={{ color: listing.priceUsd > 0 ? colors.text : colors.accentText }}>
              {price(listing.priceUsd)}
            </T>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[{ gap: space.xs, paddingHorizontal: space.gutter }, textStyle]}>
        <T variant="display" accessibilityRole="header">
          Published.
        </T>
        <T color={first ? 'text' : 'textSoft'} variant={first ? 'bodyStrong' : 'body'} accessibilityLiveRegion="polite">
          {waitingLine}
        </T>
      </Animated.View>

      <View style={{ paddingHorizontal: space.gutter, gap: space.xs }}>
        {next ? (
          <Button label={`Next item: ${next.item.name}`} onPress={() => router.replace('/review')} />
        ) : (
          <Button label={first ? 'See who is interested' : 'View listing'} onPress={() => router.replace(`/listing/${listing.id}`)} />
        )}
        <Button kind="quiet" label="Scan something else" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  stage: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  string: { position: 'absolute', top: -80, width: 2, height: '34%' },
  tag: {
    width: 248,
    padding: space.sm,
    paddingTop: 36,
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.control,
    borderTopLeftRadius: 46,
    borderTopRightRadius: 46,
    shadowColor: palette.forest,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    transformOrigin: 'top center',
  },
  hole: { position: 'absolute', top: 12, alignSelf: 'center', width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  photo: { width: '100%', aspectRatio: 1.05 },
});
