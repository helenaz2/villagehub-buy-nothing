import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonLine, Rule } from '@/components/bits';
import { Button } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { useMe, useStore } from '@/data/store';
import { ago, firstName, price } from '@/lib/format';
import { CARBON_FACTOR, DISPLACEMENT, milesNotDriven, totals, WEIGHT_LBS } from '@/lib/impact';
import { fonts, radius, space, useTheme } from '@/theme';

const KIND_LABEL = { rehomed: 'Rehomed with a neighbor', donated: 'Donated', recycled: 'Recycled responsibly' } as const;

export default function You() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const impact = useStore((s) => s.impact);
  const listings = useStore((s) => s.listings);
  const [howOpen, setHowOpen] = useState(false);

  const mine = impact.filter((e) => e.userId === me.id).sort((a, b) => b.at - a.at);
  const sum = totals(mine);
  const myListings = listings.filter((l) => l.ownerId === me.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space.section }}>
        <View style={{ paddingHorizontal: space.gutter, gap: space.xl }}>
          <PersonLine user={me} suffix={me.neighborhood} />

          <View style={{ gap: space.xs }}>
            <T variant="heading" color="textSoft">
              {firstName(me.name)}, you have kept
            </T>
            {/* The one oversized number on the screen. Everything else stays quiet around it. */}
            <T
              accessibilityRole="header"
              maxFontSizeMultiplier={1.1}
              style={{ fontFamily: fonts.serifBold, fontSize: 88, lineHeight: 88, letterSpacing: -3, color: colors.text }}>
              {sum.lbs.toLocaleString()}
              <T variant="title" style={{ color: colors.accentText }}>
                {' '}
                lb
              </T>
            </T>
            <T variant="heading" color="textSoft">
              out of the landfill.
            </T>
          </View>

          <View>
            <Rule />
            <View style={styles.stats}>
              <Stat value={`${sum.items}`} label={sum.items === 1 ? 'item passed on' : 'items passed on'} />
              <Stat value={`${sum.co2Kg} kg`} label={`CO2e avoided, about ${milesNotDriven(sum.co2Kg)} miles of driving`} />
              <Stat value={`$${sum.savedUsd}`} label="saved for neighbors" />
            </View>
            <Rule />
            <Pressable onPress={() => setHowOpen(true)} accessibilityRole="button" hitSlop={10} style={{ paddingTop: space.sm, alignSelf: 'flex-start' }}>
              <T variant="label" style={{ textDecorationLine: 'underline' }}>
                How we estimate these
              </T>
            </Pressable>
          </View>

          {myListings.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <T variant="heading">Your listings</T>
              {myListings.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => router.push(`/listing/${l.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={l.title}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
                  <Photo uri={l.photos[0]} rounded={radius.photo} style={{ width: 56, height: 56 }} />
                  <View style={{ flex: 1 }}>
                    <T variant="labelStrong" numberOfLines={1}>
                      {l.title}
                    </T>
                    <T variant="caption" color="textSoft">
                      {l.status === 'available' ? 'Waiting for a claim' : l.status === 'pending' ? 'Claimed, pickup pending' : 'Given'}, {price(l.priceUsd).toLowerCase()}, posted {ago(l.createdAt)}
                    </T>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: space.sm }}>
            <T variant="heading">The record</T>
            {mine.length === 0 ? (
              <T color="textSoft">Nothing yet. Your first handoff will show up here.</T>
            ) : (
              mine.map((e) => (
                <View key={e.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <T variant="labelStrong">{e.title}</T>
                    <T variant="caption" color="textSoft">
                      {KIND_LABEL[e.kind]}, {ago(e.at)}
                    </T>
                  </View>
                  <T variant="label" color="textSoft">
                    {e.lbs} lb
                  </T>
                </View>
              ))
            )}
          </View>

          <Button kind="secondary" label="Scan something" onPress={() => router.navigate('/')} />
        </View>
      </ScrollView>

      <Sheet visible={howOpen} onClose={() => setHowOpen(false)} title="How we estimate">
        <T color="textSoft">These are estimates, kept simple and on the cautious side. Treat them as a rough size, not a measurement.</T>
        <T variant="labelStrong">Weight</T>
        <T variant="label" color="textSoft">
          The middle of the item’s weight class: {WEIGHT_LBS.light} lb for light items, {WEIGHT_LBS.medium} for medium, {WEIGHT_LBS.heavy} for heavy and {WEIGHT_LBS.very_heavy} for very heavy.
        </T>
        <T variant="labelStrong">Carbon</T>
        <T variant="label" color="textSoft">
          Weight times a typical footprint for making that kind of item, from {CARBON_FACTOR.tables} kg CO2e per kg for wooden tables up to {CARBON_FACTOR.electronics} for electronics. We then count only {Math.round(DISPLACEMENT * 100)}% of it, because not every rehomed item replaces a new purchase.
        </T>
        <T variant="labelStrong">Money saved</T>
        <T variant="label" color="textSoft">
          What a similar used item usually sells for, minus anything the neighbor paid you.
        </T>
        <T variant="labelStrong">Recycling</T>
        <T variant="label" color="textSoft">
          Recycled items count toward weight only. Recycling recovers material but does not replace a new product.
        </T>
      </Sheet>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
});
