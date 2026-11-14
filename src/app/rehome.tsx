import * as Linking from 'expo-linking';
import { Redirect, router } from 'expo-router';
import { CalendarPlus, Info, Navigation, Phone, Truck, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, IconButton, Rule } from '@/components/bits';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Photo } from '@/components/Photo';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { seedPlaces } from '@/data/seed/places';
import { useStore } from '@/data/store';
import { config } from '@/lib/config';
import { conditionLabel, miles } from '@/lib/format';
import { FLAG_NOUN, hourLabel, rankPlaces, TIER_BASE, TIER_LABEL, type RankedPlace } from '@/lib/goodScore';
import { haptic } from '@/lib/haptics';
import { addToCalendar, call, openDirections, suggestSlots } from '@/lib/pickup';
import { radius, space, useTheme } from '@/theme';

/** Donation and disposal finder. Ranks nearby options by how much good they do with this item. */
export default function Rehome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useStore((s) => s.draft);
  const logRehome = useStore((s) => s.logRehome);
  const clearDraft = useStore((s) => s.clearDraft);
  const [explain, setExplain] = useState<RankedPlace | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const item = draft?.item;
  const result = useMemo(
    () =>
      item
        ? rankPlaces(
            seedPlaces,
            { category: item.category, condition: item.condition, weightClass: item.weight_class, safetyFlag: item.safety.flag },
            config.region,
          )
        : null,
    [item],
  );

  if (!draft || !item || !result) return <Redirect href="/" />;

  const { ranked, rejected } = result;
  const best = ranked[0];
  // Tier 1 and 2 keep the item in use. If the best we can do is lower, say so plainly.
  const onlyDisposal = !!best && best.place.tier >= 4;

  const settle = (r: RankedPlace) => {
    haptic.success();
    logRehome({ title: item.name, category: item.category, item, kind: r.place.tier <= 2 ? 'donated' : 'recycled' });
    clearDraft();
    router.dismissTo('/you');
  };

  const subject = item.safety.flag ? FLAG_NOUN[item.safety.flag] : `${conditionLabel[item.condition].toLowerCase()} ${item.subcategory.toLowerCase()}s`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.xs, paddingBottom: insets.bottom + space.section }}>
        <View style={styles.top}>
          <IconButton icon={X} label="Back to the listing" onPress={() => router.back()} />
          <IconButton icon={Info} label="How the ranking works" onPress={() => setHowOpen(true)} />
        </View>

        <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
          <T variant="title" accessibilityRole="header">
            Where this can do the most good
          </T>
          <View style={styles.item}>
            <Photo uri={draft.photos[0]} rounded={radius.photo} style={{ width: 72, height: 72 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="labelStrong">{item.name}</T>
              <T variant="label" color="textSoft">
                {item.action.reason}
              </T>
            </View>
          </View>
          {onlyDisposal ? (
            <T style={{ color: colors.accentText }}>
              Nothing nearby will reuse {subject}, so these are the responsible ways to let it go.
            </T>
          ) : null}
        </View>

        {ranked.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No confirmed option nearby"
            body={`We could not confirm anyone within reach who takes ${subject}. Check the manufacturer for a take-back program, or call the city at 311 before putting it out.`}
          />
        ) : (
          ranked.map((r, i) => (
            <PlaceRow key={r.place.id} r={r} first={i === 0} itemName={item.name} onExplain={() => setExplain(r)} onSettle={() => settle(r)} />
          ))
        )}

        {rejected.length > 0 ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.sm }}>
            <Button
              kind="quiet"
              compact
              label={showRejected ? 'Hide places that will not take it' : `${rejected.length} places will not take it. See why`}
              onPress={() => setShowRejected((v) => !v)}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            />
            {showRejected
              ? rejected.map((x) => (
                  <View key={x.place.id} style={{ gap: 2 }}>
                    <T variant="labelStrong" color="textSoft">
                      {x.place.name}
                    </T>
                    <T variant="caption" color="textSoft">
                      {x.reason}
                    </T>
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>

      <Sheet visible={!!explain} onClose={() => setExplain(null)} title={explain ? `Good Score ${explain.score}` : ''}>
        {explain ? (
          <>
            <T color="textSoft">{explain.place.name}</T>
            {explain.parts.map((p) => (
              <View key={p.label} style={styles.part}>
                <T variant="label" style={{ flex: 1 }}>
                  {p.label}
                </T>
                <T variant="labelStrong">{p.points > 0 ? `+${p.points}` : p.points}</T>
              </View>
            ))}
            <Rule />
            <T variant="caption" color="textSoft">
              Source: {explain.place.source}. Checked {explain.place.checked}. Hours and rules change, so call before you load the car.
            </T>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={howOpen} onClose={() => setHowOpen(false)} title="How we rank">
        <T color="textSoft">
          The type of place sets the score. Everything else only breaks ties inside a type, so a paid hauler can never outrank a charity.
        </T>
        {([1, 2, 3, 4, 5] as const).map((t) => (
          <View key={t} style={styles.part}>
            <T variant="label" style={{ flex: 1 }}>
              {TIER_LABEL[t]}
            </T>
            <T variant="labelStrong">{TIER_BASE[t]}</T>
          </View>
        ))}
        <Rule />
        <T variant="label" color="textSoft">
          Then: up to 4 points if they come to you and the item is heavy, 2 if they are open now, 1 for a tax receipt, and up to 6 off for distance.
        </T>
        <T variant="label" color="textSoft">
          We only list a place if it takes this kind of item in this condition. Places we could not confirm say so.
        </T>
      </Sheet>
    </View>
  );
}

function PlaceRow({
  r,
  first,
  itemName,
  onExplain,
  onSettle,
}: {
  r: RankedPlace;
  first: boolean;
  itemName: string;
  onExplain: () => void;
  onSettle: () => void;
}) {
  const { colors } = useTheme();
  const { place } = r;
  const hours =
    place.hours === null
      ? 'Call ahead for hours'
      : r.openNow && r.closesAt !== null
        ? `Open now until ${hourLabel(r.closesAt)}`
        : 'Closed right now';
  const how =
    place.pickup === 'free'
      ? 'Free pickup from your door'
      : place.pickup === 'paid'
        ? place.dropoff
          ? 'Drop-off, or paid pickup'
          : 'Paid pickup'
        : place.pickup === 'request'
          ? 'Drop-off, pickup on request'
          : 'Drop-off only';
  const facts = [place.pickup === 'free' ? null : `${miles(r.miles)} away`, hours, how, place.taxReceipt ? 'Gives a tax receipt' : null].filter(Boolean);
  const schedule = place.pickup !== 'none' && place.url;

  return (
    <View style={[styles.place, first && { backgroundColor: colors.sageSoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="caption" style={{ color: first ? colors.text : colors.textSoft }}>
            {first ? `Best match. ${TIER_LABEL[place.tier]}` : TIER_LABEL[place.tier]}
          </T>
          <T variant={first ? 'heading' : 'subhead'}>{place.name}</T>
          <T variant="caption" color="textSoft">
            {place.kind}
          </T>
        </View>
        <Chip label={`${r.score}`} onPress={onExplain} />
      </View>

      <T variant="quote" style={{ fontSize: first ? 20 : 17, lineHeight: first ? 28 : 24 }}>
        {place.why}
      </T>

      <T variant="label" color="textSoft">
        {facts.join('. ')}.
      </T>
      {place.pickupNote ? (
        <T variant="caption" color="textSoft">
          {place.pickupNote}
        </T>
      ) : null}
      {place.note ? (
        <T variant="caption" color="textSoft">
          {place.note}
        </T>
      ) : null}
      {place.costNote ? (
        <T variant="caption" style={{ color: colors.accentText }}>
          {place.costNote}
        </T>
      ) : null}

      <View style={styles.actions}>
        {place.dropoff ? <Button compact kind={first ? 'primary' : 'secondary'} icon={Navigation} label="Directions" onPress={() => void openDirections(place.address)} /> : null}
        {schedule ? (
          <Button compact kind={first && !place.dropoff ? 'primary' : 'secondary'} icon={Truck} label="Schedule pickup" onPress={() => void Linking.openURL(place.url!)} />
        ) : null}
        {place.phone ? <Button compact kind="secondary" icon={Phone} label="Call" onPress={() => void call(place.phone!)} /> : null}
        <Button
          compact
          kind="secondary"
          icon={CalendarPlus}
          label="Calendar"
          onPress={() =>
            void addToCalendar({
              title: `${place.dropoff ? 'Drop off' : 'Pickup for'} ${itemName}`,
              at: suggestSlots()[1] ?? Date.now() + 86_400_000,
              where: place.address,
              details: `${place.name}. ${place.pickupNote ?? place.note ?? ''}`,
            })
          }
        />
      </View>
      <Button compact kind="quiet" label="I am going with this one" onPress={onSettle} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} accessibilityHint="Adds this to your impact and closes the item" />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm },
  item: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  place: { paddingHorizontal: space.gutter, paddingVertical: space.lg, gap: space.xs, marginTop: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  part: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingVertical: 2 },
});
