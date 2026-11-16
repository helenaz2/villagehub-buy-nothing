import type { PermissionResponse } from 'expo-camera';
import { Image } from 'expo-image';
import { ArrowRight, Camera, Check, Images, ScanLine, Settings, Tag } from 'lucide-react-native';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SAMPLES } from '@/ai/mocks';
import { Button, ICON_STROKE } from '@/components/Button';
import { T } from '@/components/T';
import { photoSource } from '@/data/seed/photos';
import { palette, radius, space } from '@/theme';

type Props = {
  permission: PermissionResponse | null;
  onAllow: () => void;
  onSamples: () => void;
};

const STEPS = [
  { icon: ScanLine, text: 'Point at something you are passing on' },
  { icon: Tag, text: 'Curbside fills in the name, size and condition' },
  { icon: Check, text: 'You check it over and publish' },
] as const;

const preview = SAMPLES[0]!;

/**
 * Shown before the camera is allowed. It previews what a scan looks like, so
 * the permission ask is backed by a reason, and it handles the "denied for
 * good" case with a direct route to Settings instead of a dead end.
 */
export function CameraGate({ permission, onAllow, onSamples }: Props) {
  const insets = useSafeAreaInsets();
  const blocked = permission != null && !permission.granted && !permission.canAskAgain;
  const canOpenSettings = Platform.OS !== 'web';

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.viewfinder} accessible={false}>
          <Image source={photoSource(preview.photo)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <View style={[StyleSheet.absoluteFill, styles.shade]} />
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
          <View style={styles.tag}>
            <View style={styles.tagDot} />
            <T variant="labelStrong" style={{ color: palette.forest }}>
              {preview.item.name}
            </T>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.copy}>
          <T variant="title" style={{ color: palette.cream }} accessibilityRole="header">
            The camera does{'\n'}the typing.
          </T>
          <View style={styles.steps}>
            {STEPS.map(({ icon: Icon, text }, i) => (
              <View key={text} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Icon size={18} color={palette.sageBright} strokeWidth={ICON_STROKE} />
                </View>
                <T style={{ color: palette.creamSoft, flex: 1 }}>
                  <T variant="labelStrong" style={{ color: palette.cream }}>
                    {i + 1}.{' '}
                  </T>
                  {text}
                </T>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(220).duration(380)}
        style={[styles.actions, { paddingBottom: space.md }]}>
        {blocked ? (
          <>
            <T variant="label" style={styles.blockedNote}>
              Camera access is turned off for Curbside. Turn it back on in Settings and come straight back.
            </T>
            {canOpenSettings ? (
              <Button kind="onDark" icon={Settings} label="Open Settings" onPress={() => void Linking.openSettings()} />
            ) : null}
          </>
        ) : (
          <Button
            kind="onDark"
            icon={Camera}
            trailingIcon={ArrowRight}
            label="Allow camera"
            onPress={onAllow}
            accessibilityHint="Asks your phone for permission to use the camera"
          />
        )}
        <Button kind="ghostOnDark" icon={Images} label="Try a sample item first" onPress={onSamples} />
        <T variant="caption" style={styles.fine}>
          Photos are only used to build your listing.
        </T>
      </Animated.View>
    </View>
  );
}

const CORNER = 26;
const LINE = 3;

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.nightSunk },
  scroll: { paddingHorizontal: space.gutter, gap: space.xl, paddingBottom: space.lg },
  viewfinder: {
    width: '78%',
    maxWidth: 340,
    aspectRatio: 4 / 4.4,
    alignSelf: 'center',
    borderRadius: radius.photo,
    overflow: 'hidden',
    backgroundColor: palette.nightRaised,
  },
  shade: { backgroundColor: 'rgba(21, 19, 16, 0.18)' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: palette.paper },
  tl: { top: 14, left: 14, borderTopWidth: LINE, borderLeftWidth: LINE, borderTopLeftRadius: 8 },
  tr: { top: 14, right: 14, borderTopWidth: LINE, borderRightWidth: LINE, borderTopRightRadius: 8 },
  bl: { bottom: 14, left: 14, borderBottomWidth: LINE, borderLeftWidth: LINE, borderBottomLeftRadius: 8 },
  br: { bottom: 14, right: 14, borderBottomWidth: LINE, borderRightWidth: LINE, borderBottomRightRadius: 8 },
  tag: {
    position: 'absolute',
    left: 22,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.paper,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  tagDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.terracotta },
  copy: { gap: space.lg },
  steps: { gap: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.nightRule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.nightRule,
    backgroundColor: palette.nightSunk,
  },
  blockedNote: { color: palette.creamSoft },
  fine: { color: palette.creamFaint, textAlign: 'center' },
});
