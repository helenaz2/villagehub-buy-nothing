import { List, Map as MapIcon, PackageOpen } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, IconButton, Rule, Skeleton } from '@/components/bits';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ListingCard } from '@/components/ListingCard';
import { ListingMap } from '@/components/ListingMap';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import * as remote from '@/data/remote';
import { NEIGHBORHOOD_BASE_LBS } from '@/data/seed/listings';
import { useStore } from '@/data/store';
import type { Category, Listing } from '@/data/types';
import { config, syncedBackend } from '@/lib/config';
import { ago, categoryLabel, firstName, milesBetween } from '@/lib/format';
import { fonts, radius, space, type, useTheme } from '@/theme';

type Filters = { cost: 'any' | 'free' | 'paid'; today: boolean; close: boolean; easy: boolean; category: Category | null };
const NO_FILTERS: Filters = { cost: 'any', today: false, close: false, easy: false, category: null };

type Entry = { listing: Listing; distance: number };
type Row =
  | { kind: 'lead'; key: string; entry: Entry; ratio: number }
  | { kind: 'pair'; key: string; entries: Entry[]; ratios: [number, number]; drop: 0 | 1 }
  | { kind: 'wanted'; key: string };

/** The feed alternates one large photo with an uneven pair, like a magazine spread. */
function layOut(entries: Entry[]): Row[] {
  const rows: Row[] = [];
  const leadRatios = [1.08, 0.74, 0.92];
  const pairRatios: [number, number][] = [
    [1.28, 1.0],
    [1.0, 1.3],
  ];
  let i = 0;
  let block = 0;
  while (i < entries.length) {
    const lead = entries[i]!;
    rows.push({ kind: 'lead', key: lead.listing.id, entry: lead, ratio: leadRatios[block % leadRatios.length]! });
    i += 1;
    if (block === 0) rows.push({ kind: 'wanted', key: 'wanted' });
    const pair = entries.slice(i, i + 2);
    if (pair.length) {
      rows.push({
        kind: 'pair',
        key: `pair_${pair[0]!.listing.id}`,
        entries: pair,
        ratios: pairRatios[block % pairRatios.length]!,
        drop: (block % 2) as 0 | 1,
      });
      i += pair.length;
    }
    block += 1;
  }
  return rows;
}

export default function Browse() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listings = useStore((s) => s.listings);
  const impact = useStore((s) => s.impact);
  const seededAt = useStore((s) => s.seededAt);
  const lastPublishedId = useStore((s) => s.lastPublishedId);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wantedOpen, setWantedOpen] = useState(false);
  const list = useRef<FlatList<Row>>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (lastPublishedId) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [lastPublishedId]);

  const entries = useMemo(() => {
    return listings
      .filter((l) => l.status !== 'given')
      .map((listing) => ({ listing, distance: milesBetween(config.region, listing.approx) }))
      .filter(({ listing, distance }) => {
        if (filters.cost === 'free' && listing.priceUsd > 0) return false;
        if (filters.cost === 'paid' && listing.priceUsd <= 0) return false;
        if (filters.today && !listing.availableToday) return false;
        if (filters.close && distance > 1) return false;
        if (filters.easy && listing.pickup !== 'one_person') return false;
        if (filters.category && listing.category !== filters.category) return false;
        return true;
      })
      .sort((a, b) => {
        // Claimed items sink. Otherwise closer and newer rise: twelve hours of age counts like one mile.
        // Age is relative between two listings, so the current time cancels out and is left out.
        const HOURS_12 = 12 * 3_600_000;
        const rank = (e: Entry) =>
          (e.listing.status === 'available' ? 0 : 100) + e.distance - e.listing.createdAt / HOURS_12;
        return rank(a) - rank(b);
      });
  }, [listings, filters]);

  const rows = useMemo(() => layOut(entries), [entries]);
  const keptLbs = NEIGHBORHOOD_BASE_LBS + impact.filter((e) => e.at >= seededAt).reduce((n, e) => n + e.lbs, 0);
  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const half = (width - space.gutter * 2 - space.sm) / 2;

  const refresh = async () => {
    setRefreshing(true);
    if (syncedBackend) useStore.getState().mergeRemoteListings(await remote.fetchNearby());
    await new Promise((r) => setTimeout(r, 700));
    setRefreshing(false);
  };

  const header = (
    <View style={{ paddingTop: insets.top + space.sm }}>
      <View style={styles.titleRow}>
        <T variant="display" accessibilityRole="header">
          Nearby
        </T>
        <IconButton
          icon={view === 'list' ? MapIcon : List}
          label={view === 'list' ? 'Show map' : 'Show list'}
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
        />
      </View>
      <T color="textSoft" style={{ paddingHorizontal: space.gutter, marginTop: 2 }}>
        <T variant="subhead" style={{ fontFamily: fonts.serifBold }}>
          {keptLbs.toLocaleString()} lb
        </T>{' '}
        kept out of landfill around {config.regionName} this month.
      </T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        accessibilityLabel="Filters">
        <Chip label="Free" selected={filters.cost === 'free'} onPress={() => setFilters((f) => ({ ...f, cost: f.cost === 'free' ? 'any' : 'free' }))} />
        <Chip label="Low price" selected={filters.cost === 'paid'} onPress={() => setFilters((f) => ({ ...f, cost: f.cost === 'paid' ? 'any' : 'paid' }))} />
        <Chip label="Pickup today" selected={filters.today} onPress={() => setFilters((f) => ({ ...f, today: !f.today }))} />
        <Chip label="Within a mile" selected={filters.close} onPress={() => setFilters((f) => ({ ...f, close: !f.close }))} />
        <Chip label="One person can carry" selected={filters.easy} onPress={() => setFilters((f) => ({ ...f, easy: !f.easy }))} />
        {(['seating', 'tables', 'storage', 'lighting', 'appliances', 'bikes', 'decor'] as Category[]).map((c) => (
          <Chip
            key={c}
            label={categoryLabel[c]}
            selected={filters.category === c}
            onPress={() => setFilters((f) => ({ ...f, category: f.category === c ? null : c }))}
          />
        ))}
      </ScrollView>
    </View>
  );

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <View style={{ flex: 1, overflow: 'hidden', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet }}>
          <ListingMap listings={entries.map((e) => e.listing)} center={config.region} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={list}
        data={loading ? [] : rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.section, gap: space.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            title="Checking the curb"
            titleColor={colors.textSoft}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: space.sm }}>
              <Skeleton style={{ width, height: width * 1.08, borderRadius: 0 }} />
              <Skeleton style={{ marginLeft: space.gutter, width: width * 0.6, height: 26 }} />
              <Skeleton style={{ marginLeft: space.gutter, width: width * 0.35, height: 16 }} />
            </View>
          ) : (
            <EmptyState
              icon={PackageOpen}
              title="Nothing matches yet"
              body={active ? 'Try loosening a filter. New things show up most evenings.' : 'Be the first on your block. Scan something you no longer need.'}>
              {active ? <Button kind="secondary" compact label="Clear filters" onPress={() => setFilters(NO_FILTERS)} /> : null}
            </EmptyState>
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'lead') {
            return <ListingCard listing={item.entry.listing} distance={item.entry.distance} size="lead" ratio={item.ratio} width={width} />;
          }
          if (item.kind === 'wanted') return <WantedStrip onPost={() => setWantedOpen(true)} />;
          return (
            <View style={styles.pair}>
              {item.entries.map((e, i) => (
                <View key={e.listing.id} style={{ marginTop: item.drop === i ? space.xl : 0 }}>
                  <ListingCard listing={e.listing} distance={e.distance} size="half" ratio={item.ratios[i]!} width={half} />
                </View>
              ))}
            </View>
          );
        }}
      />
      <WantedSheet visible={wantedOpen} onClose={() => setWantedOpen(false)} />
    </View>
  );
}

function WantedStrip({ onPost }: { onPost: () => void }) {
  const wanted = useStore((s) => s.wanted);
  const users = useStore((s) => s.users);
  return (
    <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
      <Rule />
      <T variant="subhead">Neighbors are looking for</T>
      {wanted.slice(0, 3).map((w) => {
        const who = users.find((u) => u.id === w.userId);
        return (
          <View key={w.id} style={{ gap: 2 }}>
            <T variant="quote">{w.text}</T>
            <T variant="caption" color="textSoft">
              {firstName(who?.name ?? 'A neighbor')} in {who?.neighborhood ?? 'Berkeley'}, {ago(w.createdAt)}
            </T>
          </View>
        );
      })}
      <Button kind="secondary" compact label="Ask for something" onPress={onPost} style={{ alignSelf: 'flex-start' }} />
      <Rule />
    </View>
  );
}

function WantedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const addWanted = useStore((s) => s.addWanted);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('seating');
  const post = () => {
    if (text.trim().length < 4) return;
    addWanted(text, category);
    setText('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="What do you need?">
      <T color="textSoft">We will let you know when a matching listing appears nearby.</T>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="A desk for a dorm room, under 40 inches wide"
        placeholderTextColor={colors.textFaint}
        multiline
        accessibilityLabel="What you are looking for"
        style={[type.body, styles.input, { color: colors.text, borderColor: colors.line }]}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {(['seating', 'tables', 'storage', 'beds', 'lighting', 'appliances', 'other'] as Category[]).map((c) => (
          <Chip key={c} label={categoryLabel[c]} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Button label="Post request" onPress={post} disabled={text.trim().length < 4} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.gutter,
    paddingRight: space.sm,
  },
  filters: { paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.xs, gap: space.xs },
  pair: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.gutter, alignItems: 'flex-start' },
  input: { borderWidth: 1.5, borderRadius: radius.control, padding: space.md, minHeight: 96, textAlignVertical: 'top' },
});
