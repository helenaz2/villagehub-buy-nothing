import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEMO_NEIGHBOR, ME } from '@/data/seed/people';
import { useStore } from '@/data/store';
import { config, hasSupabase, liveAi } from '@/lib/config';
import { palette, radius, space } from '@/theme';

import { Button } from './Button';
import { T } from './T';

/**
 * Hidden debug panel. Long-press the Curbside wordmark on the scanner to
 * toggle it. Shows scan latency and lets a presenter switch sides or reset.
 */
export function DebugOverlay() {
  const insets = useSafeAreaInsets();
  const debug = useStore((s) => s.debug);
  const last = useStore((s) => s.scanLog[0]);
  const count = useStore((s) => s.scanLog.length);
  const meId = useStore((s) => s.meId);
  const setMe = useStore((s) => s.setMe);
  const reset = useStore((s) => s.reset);
  const toggle = useStore((s) => s.toggleDebug);
  const users = useStore((s) => s.users);

  if (!debug) return null;
  const me = users.find((u) => u.id === meId);
  const light = { color: palette.cream };

  return (
    <View style={[styles.panel, { top: insets.top + 48 }]} accessibilityLabel="Debug panel">
      <T variant="caption" style={light}>
        AI {liveAi ? 'live (edge function)' : 'mock'}, data {config.backend}
        {hasSupabase ? '' : ', no backend keys'}
      </T>
      <T variant="caption" style={light}>
        {last
          ? `Last scan ${last.latencyMs} ms, ${last.source}, ${last.items} item${last.items === 1 ? '' : 's'}${last.fallbackReason ? `, fell back: ${last.fallbackReason}` : ''}`
          : 'No scans yet'}
        {count > 1 ? ` (${count} this session)` : ''}
      </T>
      <T variant="caption" style={light}>
        Signed in as {me?.name ?? meId}
      </T>
      <View style={styles.row}>
        <Button compact kind="secondary" label={meId === ME ? 'Be Maya' : 'Be Riley'} onPress={() => setMe(meId === ME ? DEMO_NEIGHBOR : ME)} style={styles.btn} />
        <Button compact kind="secondary" label="Reset data" onPress={reset} style={styles.btn} />
        <Button compact kind="secondary" label="Hide" onPress={toggle} style={styles.btn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    backgroundColor: 'rgba(21, 19, 16, 0.92)',
    borderRadius: radius.control,
    padding: space.sm,
    gap: 4,
  },
  row: { flexDirection: 'row', gap: space.xs, marginTop: 4 },
  btn: { borderColor: palette.creamFaint, backgroundColor: palette.nightRaised, minHeight: 36 },
});
