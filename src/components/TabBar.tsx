import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { MapPinned, MessageCircle, ScanLine, Sprout, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { haptic } from '@/lib/haptics';
import { palette, space, useTheme } from '@/theme';

import { ICON_STROKE } from './Button';
import { T } from './T';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Scan', icon: ScanLine },
  browse: { label: 'Nearby', icon: MapPinned },
  inbox: { label: 'Messages', icon: MessageCircle },
  you: { label: 'Impact', icon: Sprout },
};

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name;
  // The scanner is a full-bleed camera, so the bar goes dark to sit on top of it.
  const onCamera = active === 'index';
  const waiting = useStore((s) => {
    const mine = s.conversations.filter((c) => c.buyerId === s.meId || c.sellerId === s.meId);
    return mine.some((c) => {
      const last = s.messages.filter((m) => m.conversationId === c.id).at(-1);
      return !!last && last.senderId !== s.meId && last.senderId !== 'system';
    });
  });

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, space.xs),
          backgroundColor: onCamera ? palette.nightSunk : colors.bg,
          borderTopColor: onCamera ? palette.nightRule : colors.line,
        },
      ]}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const ink = onCamera
          ? focused
            ? palette.cream
            : palette.creamFaint
          : focused
            ? colors.text
            : colors.textFaint;
        const Icon = tab.icon;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (!focused) haptic.tap();
              navigateToTab(route.key);
            }}
            style={styles.tab}>
            <View>
              <Icon size={23} color={ink} strokeWidth={focused ? 2.1 : ICON_STROKE} />
              {route.name === 'inbox' && waiting ? (
                <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: onCamera ? palette.nightSunk : colors.bg }]} />
              ) : null}
            </View>
            <T variant="caption" maxFontSizeMultiplier={1.15} style={{ color: ink, fontFamily: focused ? 'InstrumentSans_600SemiBold' : 'InstrumentSans_400Regular' }}>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: space.xs },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  dot: { position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
