import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Check, ChevronRight, Images, Lightbulb, RotateCcw, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SAMPLES, type SampleKey } from '@/ai/mocks';
import { compressForUpload, precheck } from '@/ai/precheck';
import { probeScanServer, scanCamera, scanSample, useAiStatus, type ScanOutcome } from '@/ai/scan';
import { Button, ICON_STROKE } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { photoSource } from '@/data/seed/photos';
import { useStore } from '@/data/store';
import { CameraGate } from '@/features/CameraGate';
import { Reticle, type Box, type ReticlePhase } from '@/features/Reticle';
import { haptic } from '@/lib/haptics';
import { palette, radius, space, touch } from '@/theme';

type Phase =
  | { name: 'idle' }
  | { name: 'scanning'; uri: string }
  | { name: 'found'; uri: string; outcome: ScanOutcome }
  | { name: 'pick'; uri: string; outcome: ScanOutcome; picked: number[] };

const SCAN_STEPS = ['Taking a look', 'Working out what it is', 'Sizing it up', 'Still on it, nearly there'] as const;

const clampBox = (b: Box): Box => {
  const x = Math.min(0.9, Math.max(0.04, b.x));
  const y = Math.min(0.8, Math.max(0.1, b.y));
  return { x, y, w: Math.min(0.96 - x, Math.max(0.2, b.w)), h: Math.min(0.86 - y, Math.max(0.15, b.h)) };
};

export default function Scanner() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [hint, setHint] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  /** Set when a real photo could not be read because no AI is connected. */
  const [noAi, setNoAi] = useState<string | null>(null);
  const [aiInfoOpen, setAiInfoOpen] = useState(false);
  const aiStatus = useAiStatus();
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const busy = useRef(false);
  const startDraft = useStore((s) => s.startDraft);
  const logScan = useStore((s) => s.logScan);
  const toggleDebug = useStore((s) => s.toggleDebug);

  const granted = permission?.granted === true;

  // Progress copy while the model works, so a 5 second scan never looks stuck.
  const [scanStep, setScanStep] = useState(0);
  const scanning = phase.name === 'scanning';
  useEffect(() => {
    if (!scanning) return;
    const timers = [1800, 4200, 8000].map((ms, i) => setTimeout(() => setScanStep(i + 1), ms));
    return () => {
      timers.forEach(clearTimeout);
      setScanStep(0); // ready for the next scan
    };
  }, [scanning]);

  const finish = useCallback(
    (outcome: ScanOutcome, uri: string) => {
      logScan({
        at: Date.now(),
        source: outcome.source,
        latencyMs: outcome.latencyMs,
        fallbackReason: outcome.fallbackReason,
        items: outcome.result.items.length,
      });
      haptic.detect();
      if (outcome.result.items.length > 1) {
        setPhase({ name: 'pick', uri, outcome, picked: outcome.result.items.map((_, i) => i) });
        busy.current = false;
        return;
      }
      setPhase({ name: 'found', uri, outcome });
      // Hold on the name tag for a beat so the detection registers, then open the listing.
      setTimeout(() => {
        startDraft(outcome, uri);
        router.push('/review');
        setTimeout(() => {
          setPhase({ name: 'idle' });
          busy.current = false;
        }, 500);
      }, 850);
    },
    [logScan, startDraft],
  );

  const capture = useCallback(async () => {
    if (busy.current || !camera.current || !cameraReady) return;
    busy.current = true;
    setHint(null);
    haptic.press();
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.85 });
      if (!shot?.uri) throw new Error('No photo');
      // Freeze the frame right away, then check and shrink the photo in parallel.
      setPhase({ name: 'scanning', uri: shot.uri });
      const [check, upload] = await Promise.all([precheck(shot.uri), compressForUpload(shot.uri)]);
      if (!check.ok) {
        haptic.warn();
        setHint(check.hint);
        setPhase({ name: 'idle' });
        busy.current = false;
        return;
      }
      const scan = await scanCamera(upload.base64);
      if (scan.kind === 'ok') {
        finish(scan.outcome, upload.uri);
        return;
      }
      logScan({ at: Date.now(), source: scan.kind === 'no_item' ? 'live' : 'mock', latencyMs: scan.latencyMs, fallbackReason: scan.kind === 'no_ai' ? scan.reason : null, items: 0 });
      haptic.warn();
      setPhase({ name: 'idle' });
      busy.current = false;
      if (scan.kind === 'no_item') setHint(scan.hint);
      else setNoAi(scan.reason);
    } catch {
      haptic.warn();
      setHint('The camera did not catch that. Try once more.');
      setPhase({ name: 'idle' });
      busy.current = false;
    }
  }, [cameraReady, finish, logScan]);

  const runSample = useCallback(
    async (key: SampleKey) => {
      if (busy.current) return;
      const sample = SAMPLES.find((s) => s.key === key);
      if (!sample) return;
      busy.current = true;
      setSamplesOpen(false);
      setNoAi(null);
      setHint(null);
      setPhase({ name: 'scanning', uri: sample.photo });
      const outcome = await scanSample(key);
      finish(outcome, sample.photo);
    },
    [finish],
  );

  // Auto-capture: fire once the phone has been held still for about a second.
  useEffect(() => {
    if (!auto || !focused || !granted || Platform.OS === 'web') return;
    let last = { x: 0, y: 0, z: 0 };
    let still = 0;
    let armed = true;
    Accelerometer.setUpdateInterval(120);
    const sub = Accelerometer.addListener((a) => {
      const delta = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
      last = a;
      if (delta > 0.12) {
        still = 0;
        armed = true; // moving again re-arms it, so one steady hold means one photo
        return;
      }
      still += 1;
      if (armed && still >= 9 && !busy.current) {
        armed = false;
        void capture();
      }
    });
    return () => sub.remove();
  }, [auto, focused, granted, capture]);

  const onLayout = (e: LayoutChangeEvent) =>
    setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  const frozen = phase.name === 'idle' ? null : phase.uri;
  const gated = !granted && !frozen;
  const found = phase.name === 'found' ? phase.outcome.result.items[0] : null;
  const reticlePhase: ReticlePhase = phase.name === 'scanning' ? 'scanning' : phase.name === 'found' ? 'found' : 'idle';

  const confirmPick = () => {
    if (phase.name !== 'pick' || phase.picked.length === 0) return;
    startDraft(phase.outcome, phase.uri, phase.picked);
    router.push('/review');
    setTimeout(() => setPhase({ name: 'idle' }), 500);
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      {granted && focused ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setCameraReady(false)}
        />
      ) : null}

      {frozen ? <Image source={photoSource(frozen)} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}

      {/* Soft shade at the top and bottom keeps the wordmark, reticle and controls readable on a bright wall. */}
      {gated ? null : (
        <>
          <LinearGradient
            colors={['rgba(21,19,16,0.55)', 'rgba(21,19,16,0)']}
            style={[styles.shade, { top: 0, height: insets.top + 170 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(21,19,16,0)', 'rgba(21,19,16,0.5)']}
            style={[styles.shade, { bottom: 0, height: 260 }]}
            pointerEvents="none"
          />
        </>
      )}

      {gated ? (
        <CameraGate
          permission={permission}
          onAllow={() => void requestPermission()}
          onSamples={() => setSamplesOpen(true)}
        />
      ) : null}

      {phase.name !== 'pick' && (granted || frozen) ? (
        <Reticle phase={reticlePhase} frame={frame} target={found ? clampBox(found.box) : null} label={found?.name ?? null} />
      ) : null}

      {phase.name === 'pick' ? (
        <View style={StyleSheet.absoluteFill}>
          {phase.outcome.result.items.map((item, i) => {
            const b = clampBox(item.box);
            const on = phase.picked.includes(i);
            return (
              <Pressable
                key={`${item.name}_${i}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.name}
                onPress={() => {
                  haptic.tap();
                  setPhase({ ...phase, picked: on ? phase.picked.filter((p) => p !== i) : [...phase.picked, i] });
                }}
                style={[
                  styles.pickBox,
                  {
                    left: b.x * frame.width,
                    top: b.y * frame.height,
                    width: b.w * frame.width,
                    height: b.h * frame.height,
                    borderColor: on ? palette.terracotta : palette.paper,
                    borderStyle: on ? 'solid' : 'dashed',
                  },
                ]}>
                <View style={[styles.pickLabel, { backgroundColor: on ? palette.terracotta : palette.paper }]}>
                  {on ? <Check size={14} color="#FFFFFF" strokeWidth={2.5} /> : null}
                  <T variant="labelStrong" style={{ color: on ? '#FFFFFF' : palette.forest }} numberOfLines={1}>
                    {item.name}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {gated ? null : (
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onLongPress={toggleDebug} delayLongPress={600} accessibilityLabel="Curbside" hitSlop={10}>
            <T variant="heading" style={[styles.onPhoto, { color: palette.paper }]}>
              Curbside
            </T>
          </Pressable>
          {aiStatus === 'offline' ? (
            <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  void probeScanServer(true);
                  setAiInfoOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Demo mode. Learn more"
                hitSlop={8}
                style={styles.aiPill}>
                <View style={[styles.aiDot, { backgroundColor: palette.clay }]} />
                <T variant="caption" style={{ color: palette.paper }}>
                  Demo mode
                </T>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
        <T variant="label" style={[styles.onPhoto, { color: palette.paper }]}>
          {phase.name === 'scanning'
            ? SCAN_STEPS[scanStep]
            : phase.name === 'found'
              ? 'Got it'
              : phase.name === 'pick'
                ? 'Tap the ones you want to list'
                : 'Fit the whole item in the frame'}
        </T>
      </View>
      )}

      {hint ? (
        <Animated.View
          key={hint}
          entering={FadeInDown.duration(260)}
          exiting={FadeOut.duration(180)}
          style={[styles.hint, { top: insets.top + 86 }]}
          accessibilityLiveRegion="polite">
          <Pressable onPress={() => setHint(null)} accessibilityRole="button" accessibilityHint="Dismisses the tip" style={styles.hintRow}>
            <Lightbulb size={18} color={palette.terracotta} strokeWidth={ICON_STROKE} />
            <T variant="label" style={{ color: palette.forest, flex: 1 }}>
              {hint}
            </T>
          </Pressable>
        </Animated.View>
      ) : null}

      {gated || phase.name !== 'idle' || hint ? null : <NearbyPeek />}

      {gated ? null : (
      <View style={[styles.controls, { paddingBottom: space.lg }]} pointerEvents="box-none">
        {phase.name === 'pick' ? (
          <View style={{ flex: 1, flexDirection: 'row', gap: space.sm, paddingHorizontal: space.gutter }}>
            <Button
              kind="ghostOnDark"
              icon={RotateCcw}
              label="Retake"
              onPress={() => {
                setPhase({ name: 'idle' });
                busy.current = false;
              }}
            />
            <Button
              kind="accent"
              label={phase.picked.length === 1 ? 'List 1 item' : `List ${phase.picked.length} items`}
              onPress={confirmPick}
              disabled={phase.picked.length === 0}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setSamplesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Try a sample item"
              style={styles.side}>
              <View style={styles.sideIcon}>
                <Images size={22} color={palette.paper} strokeWidth={ICON_STROKE} />
              </View>
              <T variant="caption" style={[styles.onPhoto, { color: palette.paper }]}>
                Samples
              </T>
            </Pressable>

            <Pressable
              onPress={() => (granted ? void capture() : setSamplesOpen(true))}
              disabled={phase.name !== 'idle'}
              accessibilityRole="button"
              accessibilityLabel="Scan this item"
              style={({ pressed }) => [styles.shutter, { opacity: phase.name !== 'idle' ? 0.5 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
              <View style={styles.shutterCore} />
            </Pressable>

            <Pressable
              onPress={() => {
                haptic.tap();
                setAuto((a) => !a);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: auto }}
              accessibilityLabel="Scan automatically when the phone is steady"
              style={styles.side}>
              <View style={[styles.sideIcon, auto && { borderColor: palette.clay, backgroundColor: 'rgba(226, 132, 102, 0.18)' }]}>
                {auto ? (
                  <Zap size={22} color={palette.clay} fill={palette.clay} strokeWidth={ICON_STROKE} />
                ) : (
                  <ZapOff size={22} color={palette.paper} strokeWidth={ICON_STROKE} />
                )}
              </View>
              <T variant="caption" style={[styles.onPhoto, { color: auto ? palette.clay : palette.paper }]}>
                {auto ? 'Auto on' : 'Auto off'}
              </T>
            </Pressable>
          </>
        )}
      </View>
      )}

      <Sheet visible={noAi != null} onClose={() => setNoAi(null)} title="I could not read that photo">
        <T color="textSoft">
          Curbside could not reach its scanner just now, so it did not guess. It only fills in a listing when it can
          actually see your item. Check your connection and try again, or run the demo with a sample.
        </T>
        <T variant="labelStrong" style={{ marginTop: space.xs }}>
          Or run the demo with a sample
        </T>
        <View style={styles.sampleGrid}>
          {SAMPLES.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => void runSample(s.key)}
              accessibilityRole="button"
              accessibilityLabel={`Scan the sample ${s.label}`}
              style={({ pressed }) => [styles.sample, { opacity: pressed ? 0.8 : 1 }]}>
              <Photo uri={s.photo} rounded={radius.photo} style={{ width: '100%', aspectRatio: 1 }} />
              <T variant="label">{s.label}</T>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={aiInfoOpen} onClose={() => setAiInfoOpen(false)} title={aiStatus === 'live' ? 'Back online' : 'Demo mode'}>
        <T color="textSoft">
          {aiStatus === 'live'
            ? 'The scanner is connected again. Point the camera at anything you are passing on.'
            : 'The scanner is offline, so real photos cannot be read right now. The sample items still run the whole flow, from scan to handoff.'}
        </T>
        <View style={{ flexDirection: 'row', gap: space.sm, paddingBottom: space.md }}>
          {aiStatus !== 'live' ? (
            <Button
              kind="secondary"
              compact
              icon={RotateCcw}
              label="Try again"
              onPress={() => void probeScanServer(true)}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            compact
            label={aiStatus === 'live' ? 'Done' : 'Try a sample'}
            onPress={() => {
              setAiInfoOpen(false);
              if (aiStatus !== 'live') setSamplesOpen(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      <Sheet visible={samplesOpen} onClose={() => setSamplesOpen(false)} title="Try a sample item">
        <T color="textSoft">No furniture handy? Pick one and watch the whole flow.</T>
        <View style={styles.sampleGrid}>
          {SAMPLES.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => void runSample(s.key)}
              accessibilityRole="button"
              accessibilityLabel={`Scan the sample ${s.label}`}
              style={({ pressed }) => [styles.sample, { opacity: pressed ? 0.8 : 1 }]}>
              <Photo uri={s.photo} rounded={radius.photo} style={{ width: '100%', aspectRatio: 1 }} />
              <T variant="label">{s.label}</T>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/**
 * A small window onto the feed from the camera: real photos of what neighbors
 * just posted, one tap from the Nearby tab. It gives the home screen some life
 * before the first scan without covering the viewfinder.
 */
function NearbyPeek() {
  const listings = useStore((s) => s.listings);
  const meId = useStore((s) => s.meId);
  const { recent, free } = useMemo(() => {
    const open = listings.filter((l) => l.status === 'available' && l.ownerId !== meId);
    return {
      recent: [...open].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
      free: open.filter((l) => l.priceUsd <= 0).length,
    };
  }, [listings, meId]);
  if (recent.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.delay(200).duration(320)} exiting={FadeOut.duration(150)} style={[styles.peekWrap, { bottom: 82 + space.lg + space.md }]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          haptic.tap();
          router.navigate('/browse');
        }}
        accessibilityRole="button"
        accessibilityLabel={`${free} free things near you. Open Nearby`}
        style={({ pressed }) => [styles.peek, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.peekThumbs}>
          {recent.map((l, i) => (
            <Image
              key={l.id}
              source={photoSource(l.photos[0] ?? '')}
              style={[styles.peekThumb, { marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }]}
              contentFit="cover"
            />
          ))}
        </View>
        <T variant="label" style={{ color: palette.paper }}>
          {free === 1 ? '1 free thing' : `${free} free things`} near you
        </T>
        <ChevronRight size={16} color={palette.paper} strokeWidth={ICON_STROKE} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.nightSunk },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(21, 19, 16, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 239, 230, 0.35)',
  },
  aiDot: { width: 8, height: 8, borderRadius: 4 },
  sideIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 19, 16, 0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 239, 230, 0.35)',
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.gutter,
    gap: 2,
  },
  shade: { position: 'absolute', left: 0, right: 0 },
  onPhoto: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  hint: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    backgroundColor: palette.paper,
    borderRadius: radius.control,
    padding: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  peekWrap: { position: 'absolute', left: space.gutter, right: space.gutter, alignItems: 'center' },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: 6,
    paddingRight: 12,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(21, 19, 16, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 239, 230, 0.35)',
  },
  peekThumbs: { flexDirection: 'row' },
  peekThumb: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: palette.nightSunk },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  side: { width: 84, minHeight: touch.min, alignItems: 'center', gap: 4 },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: { width: 62, height: 62, borderRadius: 31, backgroundColor: palette.terracotta },
  pickBox: { position: 'absolute', borderWidth: 3, borderRadius: 10 },
  pickLabel: {
    position: 'absolute',
    left: -3,
    top: -3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    maxWidth: 220,
  },
  sampleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.md },
  sample: { width: '31%', gap: 6 },
});
