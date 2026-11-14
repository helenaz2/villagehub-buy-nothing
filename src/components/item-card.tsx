import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, serif } from '@/constants/palette';
import type { Item } from '@/types/listing';

import { Icon } from './icon';


export function ItemCard({
  item,
  saved,
  onPress,
  onSave,
}: {
  item: Item;
  saved: boolean;
  onPress: () => void;
  onSave: () => void;
}) {
  const claimed = item.status === 'claimed';
  return (
    <View>
    <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={onPress} style={styles.card}>
      <View>
        <Image source={{ uri: item.photos[0] }} style={[styles.photo, claimed && styles.claimedPhoto]} contentFit="cover" />

        {claimed ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Claimed</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.free}>Free</Text>
      <Text numberOfLines={1} style={styles.meta}>
        {item.distance} · {item.condition}
      </Text>
    </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove saved item' : 'Save item'}
          hitSlop={8}
          onPress={onSave}
          style={styles.heart}>
          <Icon name={saved ? 'heartFill' : 'heart'} size={16} color={saved ? palette.terracotta : palette.ink} />
        </Pressable>
    </View>
  );
}

export function ItemGrid({
  items,
  savedIds,
  onPress,
  onSave,
}: {
  items: Item[];
  savedIds: string[];
  onPress: (id: string) => void;
  onSave: (id: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.id} style={styles.cell}>
          <ItemCard item={item} saved={savedIds.includes(item.id)} onPress={() => onPress(item.id)} onSave={() => onSave(item.id)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
  },
  cell: {
    width: '48%',
  },
  card: {
    gap: 4,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: palette.sage,

  },
  claimedPhoto: {
    opacity: 0.45,
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.claimed,
  },
  title: {
    marginTop: 8,
    fontFamily: serif,
    fontSize: 16,
    color: palette.ink,
  },
  free: {
    color: palette.terracotta,
    fontWeight: '600',
    fontSize: 14,
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
  },
});
