import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { Listing } from '@/data/types';
import { ago, away, miles, pickupShort, price } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

import { Photo } from './Photo';
import { T } from './T';

type Props = {
  listing: Listing;
  distance: number;
  /** 'lead' runs edge to edge. 'half' sits in a two-up row. */
  size: 'lead' | 'half';
  /** Photo height divided by width. Varied on purpose so the feed has rhythm. */
  ratio: number;
  width: number;
};

export function ListingCard({ listing, distance, size, ratio, width }: Props) {
  const { colors } = useTheme();
  const lead = size === 'lead';
  const free = listing.priceUsd <= 0;
  const status =
    listing.status === 'pending' ? 'Claimed, pickup pending' : listing.status === 'given' ? 'Given' : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${price(listing.priceUsd)}, ${miles(distance)} away in ${listing.neighborhood}`}
      onPress={() => router.push(`/listing/${listing.id}`)}
      style={({ pressed }) => ({ width, opacity: pressed ? 0.9 : 1 })}>
      <Photo
        uri={listing.photos[0]}
        rounded={lead ? 0 : radius.photo}
        style={{ width, height: Math.round(width * ratio), opacity: listing.status === 'available' ? 1 : 0.55 }}
        priority={lead ? 'high' : 'normal'}
      />
      <View style={{ paddingHorizontal: lead ? space.gutter : 0, paddingTop: space.sm, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <T variant={lead ? 'heading' : 'labelStrong'} style={{ flex: 1 }} numberOfLines={2}>
            {listing.title}
          </T>
          <T variant={lead ? 'subhead' : 'labelStrong'} style={{ color: free ? colors.accentText : colors.text }}>
            {price(listing.priceUsd)}
          </T>
        </View>
        <T variant="caption" color="textSoft" numberOfLines={1}>
          {status ?? `${away(distance)}, ${listing.neighborhood}`}
        </T>
        {lead ? (
          <T variant="caption" color="textFaint">
            {pickupShort[listing.pickup]} to carry, posted {ago(listing.createdAt)}
            {listing.availableToday ? ', pickup today' : ''}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}
