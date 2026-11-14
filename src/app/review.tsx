import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { Plus, ShieldAlert, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Stepper } from '@/components/bits';
import { Button, ICON_STROKE } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Photo } from '@/components/Photo';
import { T } from '@/components/T';
import { afterPublish } from '@/data/demoBot';
import { LOW_CONFIDENCE, type ConfidenceKey, type ScanItem } from '@/data/schema';
import { useStore } from '@/data/store';
import type { ActionKind, Category, Condition, Pickup, WeightClass } from '@/data/types';
import {
  actionLabel,
  categoryLabel,
  conditionLabel,
  inToCm,
  modeLabel,
  pickupShort,
  weightLabel,
} from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { radius, space, type, useTheme } from '@/theme';

const FIELD_NAMES: Record<ConfidenceKey, string> = {
  name: 'the name',
  category: 'the category',
  color: 'the color',
  material: 'the material',
  condition: 'the condition',
  dimensions: 'the size',
  brand: 'the brand',
  pickup: 'how hard it is to carry',
  weight: 'the weight',
};

function list(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export default function Review() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const draft = useStore((s) => s.draft);
  const patch = useStore((s) => s.patchDraft);
  const patchMeta = useStore((s) => s.patchDraftMeta);
  const clearDraft = useStore((s) => s.clearDraft);
  const publishDraft = useStore((s) => s.publishDraft);
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  // Once the user touches a field it is theirs, so the "check this" mark goes away.
  const [touched, setTouched] = useState<Set<ConfidenceKey>>(new Set());

  if (!draft) return <Redirect href="/" />;

  const { item } = draft;
  const flagged = item.safety.flag !== null;
  const toMarket = !flagged && (item.action.kind === 'give' || item.action.kind === 'sell');
  // Brand is skipped here: "no brand visible" is a normal answer, not a doubt worth raising.
  const unsureKeys = (Object.keys(item.confidence) as ConfidenceKey[]).filter(
    (k) => k !== 'brand' && draft.original.confidence[k] < LOW_CONFIDENCE && !touched.has(k),
  );
  const unsure = (k: ConfidenceKey) => unsureKeys.includes(k);

  const edit = (key: ConfidenceKey, change: Partial<ScanItem>) => {
    setTouched((t) => new Set(t).add(key));
    patch(change);
  };

  const setAction = (kind: ActionKind) => {
    haptic.tap();
    patch({
      action: {
        kind,
        price_usd: kind === 'sell' ? (item.action.price_usd ?? Math.max(5, Math.round(item.est_value_usd / 4 / 5) * 5)) : null,
        reason: kind === draft.original.action.kind ? draft.original.action.reason : 'Your call. You know the item better than a photo does.',
      },
    });
  };

  const addPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const uri = res.canceled ? null : res.assets[0]?.uri;
    if (uri) patchMeta({ photos: [...draft.photos, uri].slice(0, 4) });
  };

  const close = () => {
    clearDraft();
    router.back();
  };

  const primary = () => {
    if (!toMarket) {
      router.push('/rehome');
      return;
    }
    const id = publishDraft();
    if (!id) return;
    haptic.success();
    afterPublish(id);
    router.replace(`/published?id=${id}`);
  };

  const d = item.dimensions_in;
  const fmt = (n: number) => (unit === 'in' ? `${Math.round(n)}` : `${inToCm(n)}`);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View>
          <Photo uri={draft.photos[0]} style={{ width, height: width * 0.86 }} label={`Photo of ${item.name}`} priority="high" />
          <IconButton icon={X} label="Discard and go back" onPress={close} tone="onPhoto" style={{ position: 'absolute', top: insets.top + space.xs, left: space.md }} />
          <View style={[styles.stamp, { backgroundColor: colors.bg }]}>
            <T variant="caption" color="textSoft">
              {draft.source === 'live' ? 'Read by Claude' : 'Sample result'} in {(draft.latencyMs / 1000).toFixed(1)}s
              {draft.remaining.length > 0 ? `, ${draft.remaining.length} more from this photo` : ''}
            </T>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {draft.photos.slice(1).map((uri) => (
            <Photo key={uri} uri={uri} rounded={radius.photo} style={styles.thumb} />
          ))}
          {draft.photos.length < 4 ? (
            <Pressable
              onPress={() => void addPhoto()}
              accessibilityRole="button"
              accessibilityLabel="Add another photo"
              style={[styles.thumb, styles.addThumb, { borderColor: colors.line }]}>
              <Plus size={20} color={colors.textSoft} strokeWidth={ICON_STROKE} />
              <T variant="caption" color="textSoft">
                {draft.photos.length} of 4
              </T>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: space.gutter, gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <TextInput
              value={item.name}
              onChangeText={(name) => edit('name', { name })}
              accessibilityLabel="Item name"
              multiline
              style={[type.title, { color: colors.text, padding: 0 }]}
            />
            {unsureKeys.length > 0 ? (
              <T variant="label" style={{ color: colors.accentText }}>
                I was less sure about {list(unsureKeys.map((k) => FIELD_NAMES[k]))}. {unsureKeys.length === 1 ? 'It is' : 'They are'} marked below.
              </T>
            ) : (
              <T variant="label" color="textSoft">
                Everything is filled in. Change anything that looks off.
              </T>
            )}
          </View>

          {flagged ? (
            <View style={[styles.notice, { borderColor: colors.accent }]}>
              <ShieldAlert size={22} color={colors.accentText} strokeWidth={ICON_STROKE} />
              <T style={{ flex: 1 }}>{item.safety.message}</T>
            </View>
          ) : null}

          <View style={[styles.verdict, { backgroundColor: colors.sageSoft }]}>
            <T variant="caption" color="textSoft">
              Best next step
            </T>
            <T variant="heading">{actionLabel[item.action.kind]}</T>
            <T color="textSoft">{item.action.reason}</T>
            {!flagged ? (
              <View style={styles.wrap}>
                {(['give', 'sell', 'donate', 'dispose'] as ActionKind[]).map((k) => (
                  <Chip key={k} label={actionLabel[k]} selected={item.action.kind === k} onPress={() => setAction(k)} />
                ))}
              </View>
            ) : null}
            {item.action.kind === 'sell' && !flagged ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <Stepper
                  label="asking price"
                  value={item.action.price_usd ?? 0}
                  step={5}
                  min={5}
                  max={500}
                  format={(n) => `$${n}`}
                  onChange={(n) => patch({ action: { ...item.action, price_usd: n } })}
                />
              </View>
            ) : null}
          </View>

          <Field label="Condition" unsure={unsure('condition')}>
            <View style={styles.wrap}>
              {(Object.keys(conditionLabel) as Condition[]).map((c) => (
                <Chip key={c} label={conditionLabel[c]} selected={item.condition === c} unsure={unsure('condition')} onPress={() => edit('condition', { condition: c })} />
              ))}
            </View>
          </Field>

          <Field label={`Size, in ${unit === 'in' ? 'inches' : 'centimeters'}`} unsure={unsure('dimensions')} action={unit === 'in' ? 'Show cm' : 'Show inches'} onAction={() => setUnit(unit === 'in' ? 'cm' : 'in')}>
            <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
              {(['w', 'd', 'h'] as const).map((k) => (
                <Stepper
                  key={k}
                  label={k === 'w' ? 'wide' : k === 'd' ? 'deep' : 'tall'}
                  value={d[k]}
                  step={unit === 'in' ? 1 : 1 / 2.54}
                  min={1}
                  max={200}
                  format={fmt}
                  onChange={(n) => edit('dimensions', { dimensions_in: { ...d, [k]: n } })}
                />
              ))}
            </View>
          </Field>

          <Field label="Carrying it" unsure={unsure('pickup')}>
            <View style={styles.wrap}>
              {(Object.keys(pickupShort) as Pickup[]).map((p) => (
                <Chip key={p} label={pickupShort[p]} selected={item.pickup === p} unsure={unsure('pickup')} onPress={() => edit('pickup', { pickup: p })} />
              ))}
            </View>
          </Field>

          <Field label="Weight" unsure={unsure('weight')}>
            <View style={styles.wrap}>
              {(Object.keys(weightLabel) as WeightClass[]).map((w) => (
                <Chip key={w} label={weightLabel[w]} selected={item.weight_class === w} unsure={unsure('weight')} onPress={() => edit('weight', { weight_class: w })} />
              ))}
            </View>
          </Field>

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Field label="Color" unsure={unsure('color')} style={{ flex: 1 }}>
              <Line value={item.color} onChange={(color) => edit('color', { color })} label="Color" unsure={unsure('color')} />
            </Field>
            <Field label="Material" unsure={unsure('material')} style={{ flex: 1.3 }}>
              <Line value={item.material} onChange={(material) => edit('material', { material })} label="Material" unsure={unsure('material')} />
            </Field>
          </View>

          <Field label="Category" unsure={unsure('category')}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -space.gutter }}
              contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.gutter }}>
              {(Object.keys(categoryLabel) as Category[]).map((c) => (
                <Chip key={c} label={categoryLabel[c]} selected={item.category === c} onPress={() => edit('category', { category: c })} />
              ))}
            </ScrollView>
          </Field>

          <Field label="Brand">
            <Line value={item.brand ?? ''} onChange={(brand) => patch({ brand: brand || null })} label="Brand" placeholder="None visible" />
          </Field>

          <Field label="In your words">
            <TextInput
              value={item.description}
              onChangeText={(description) => patch({ description })}
              multiline
              accessibilityLabel="Description"
              style={[type.body, styles.area, { color: colors.text, borderColor: colors.line }]}
            />
          </Field>

          <Field label="Search tags">
            <View style={styles.wrap}>
              {item.tags.map((t) => (
                <Chip key={t} label={t} icon={X} onPress={item.tags.length > 3 ? () => patch({ tags: item.tags.filter((x) => x !== t) }) : undefined} />
              ))}
            </View>
          </Field>

          {toMarket ? (
            <Field label="Who gets it">
              <View style={styles.wrap}>
                <Chip label={modeLabel.first_come} selected={draft.mode === 'first_come'} onPress={() => patchMeta({ mode: 'first_come' })} />
                <Chip label={modeLabel.owner_picks} selected={draft.mode === 'owner_picks'} onPress={() => patchMeta({ mode: 'owner_picks' })} />
                <Chip label="Pickup possible today" selected={draft.availableToday} onPress={() => patchMeta({ availableToday: !draft.availableToday })} />
              </View>
            </Field>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: insets.bottom + space.sm }]}>
        <Button
          label={toMarket ? (item.action.kind === 'sell' ? `Publish for $${item.action.price_usd ?? 0}` : 'Publish') : 'Find the best place for it'}
          onPress={primary}
          accessibilityHint={toMarket ? 'Makes the listing visible to neighbors' : 'Shows nearby donation and recycling options'}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  unsure,
  children,
  action,
  onAction,
  style,
}: {
  label: string;
  unsure?: boolean;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: space.xs }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <T variant="label" color="textSoft" style={{ flex: 1 }}>
          {label}
          {unsure ? <T variant="label" style={{ color: colors.accentText }}>{'  '}Check this</T> : null}
        </T>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              {action}
            </T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Line({
  value,
  onChange,
  label,
  unsure,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  unsure?: boolean;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      accessibilityLabel={label}
      style={[
        type.body,
        styles.line,
        { color: colors.text, borderBottomColor: unsure ? colors.accent : colors.line, borderStyle: unsure ? 'dashed' : 'solid' },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: space.gutter,
    paddingVertical: 6,
    borderTopRightRadius: radius.control,
  },
  thumbs: { paddingHorizontal: space.gutter, paddingVertical: space.md, gap: space.xs },
  thumb: { width: 64, height: 64 },
  addThumb: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.photo, alignItems: 'center', justifyContent: 'center', gap: 2 },
  notice: { flexDirection: 'row', gap: space.sm, borderWidth: 1.5, borderRadius: radius.control, padding: space.md },
  verdict: { marginHorizontal: -space.gutter, paddingHorizontal: space.gutter, paddingVertical: space.lg, gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 2 },
  line: { borderBottomWidth: 1.5, paddingVertical: 8, paddingHorizontal: 0, minHeight: 44 },
  area: { borderWidth: 1.5, borderRadius: radius.control, padding: space.md, minHeight: 110, textAlignVertical: 'top' },
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
