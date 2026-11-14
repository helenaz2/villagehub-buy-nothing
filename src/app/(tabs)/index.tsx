import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Camera, Check, Images, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SAMPLES, type SampleKey } from '@/ai/mocks';
import { compressForUpload, precheck } from '@/ai/precheck';
import { scanPhoto, type ScanOutcome } from '@/ai/scan';
import { Button, ICON_STROKE } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { useStore } from '@/data/store';
import { Reticle, type Box, type ReticlePhase } from '@/features/Reticle';
import { haptic } from '@/lib/haptics';
import { palette, radius, space, touch } from '@/theme';

type Phase =
  | { name: 'idle' }
  | { name: 'scanning'; uri: string }
  | { name: 'found'; uri: string; outcome: ScanOutcome }
  | { name: 'pick'; uri: string; outcome: ScanOutcome; picked: number[] };

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
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const busy = useRef(false);
  const startDraft = useStore((s) => s.startDraft);
  const logScan = useStore((s) => s.logScan);
  const toggleDebug = useStore((s) => s.toggleDebug);

  const granted = permission?.granted === true;

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
      const shot = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!shot?.uri) throw new Error('No photo');
      const check = await precheck(shot.uri);
      if (!check.ok) {
        haptic.warn();
        setHint(check.hint);
        busy.current = false;
        return;
      }
      setPhase({ name: 'scanning', uri: shot.uri });
      const upload = await compressForUpload(shot.uri);
      const outcome = await scanPhoto({ base64: upload.base64 });
      finish(outcome, upload.uri);
    } catch {
      haptic.warn();
      setHint('The camera did not catch that. Try once more.');
      setPhase({ name: 'idle' });
      busy.current = false;
    }
  }, [cameraReady, finish]);

  const runSample = useCallback(
    async (key: SampleKey) => {
      if (busy.current) return;
      const sample = SAMPLES.find((s) => s.key === key);
      if (!sample) return;
      busy.current = true;
      setSamplesOpen(false);
      setHint(null);
      setPhase({ name: 'scanning', uri: sample.photo });
      const outcome = await scanPhoto({ base64: null, sample: key });
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

      {frozen ? <Image source={{ uri: frozen }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}

      {!granted && !frozen ? (
        <View style={[styles.gate, { paddingTop: insets.top + space.section }]}>
          <Camera size={40} color={palette.sageBright} strokeWidth={1.25} />
          <T variant="title" style={{ color: palette.cream }}>
            The camera does the typing.
          </T>
          <T style={{ color: palette.creamSoft, maxWidth: 320 }}>
            Point it at a chair, a lamp or a whole sofa. Curbside fills in the listing and you publish it.
          </T>
          {permission && !permission.canAskAgain ? (
            <T variant="label" style={{ color: palette.creamSoft }}>
              Camera access is off. Turn it on for Curbside in your phone settings, or try a sample item.
            </T>
          ) : (
            <Button label="Turn on the camera" onPress={() => void requestPermission()} style={{ alignSelf: 'flex-start', backgroundColor: palette.sageBright }} />
          )}
        </View>
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

      <View style={[styles.top, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <Pressable onLongPress={toggleDebug} delayLongPress={600} accessibilityLabel="Curbside" hitSlop={10}>
          <T variant="heading" style={[styles.onPhoto, { color: palette.paper }]}>
            Curbside
          </T>
        </Pressable>
        <T variant="label" style={[styles.onPhoto, { color: palette.paper }]}>
          {phase.name === 'scanning'
            ? 'Taking a look'
            : phase.name === 'found'
              ? 'Got it'
              : phase.name === 'pick'
                ? 'Tap the ones you want to list'
                : granted
                  ? 'Fit the whole item in the frame'
                  : ''}
        </T>
      </View>

      {hint ? (
        <View style={[styles.hint, { top: insets.top + 86 }]} accessibilityLiveRegion="polite">
          <T variant="label" style={{ color: palette.forest }}>
            {hint}
          </T>
        </View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: space.lg }]} pointerEvents="box-none">
        {phase.name === 'pick' ? (
          <View style={{ flex: 1, flexDirection: 'row', gap: space.sm, paddingHorizontal: space.gutter }}>
            <Button kind="secondary" label="Retake" onPress={() => setPhase({ name: 'idle' })} style={{ borderColor: palette.paper, backgroundColor: 'rgba(0,0,0,0.35)' }} />
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
              <Images size={24} color={palette.paper} strokeWidth={ICON_STROKE} />
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
              {auto ? (
                <Zap size={24} color={palette.clay} fill={palette.clay} strokeWidth={ICON_STROKE} />
              ) : (
                <ZapOff size={24} color={palette.paper} strokeWidth={ICON_STROKE} />
              )}
              <T variant="caption" style={[styles.onPhoto, { color: auto ? palette.clay : palette.paper }]}>
                {auto ? 'Auto on' : 'Auto off'}
              </T>
            </Pressable>
          </>
        )}
      </View>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.nightSunk },
  gate: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingHorizontal: space.gutter, gap: space.md },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.gutter,
    gap: 2,
  },
  onPhoto: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  hint: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    backgroundColor: palette.paper,
    borderRadius: radius.control,
    padding: space.md,
  },
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
