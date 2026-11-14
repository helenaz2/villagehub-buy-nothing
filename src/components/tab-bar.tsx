import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/palette';
import { useStore } from '@/data/store';

import { Icon, type IconName } from './icon';

export const TAB_BODY_HEIGHT = 78;

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'explore', label: 'Explore', icon: 'search' },
  { name: 'saved', label: 'Saved', icon: 'heart' },
  { name: 'inbox', label: 'Inbox', icon: 'mail' },
  { name: 'profile', label: 'Profile', icon: 'person' },
];

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { conversations } = useStore();
  const unread = conversations.some((conversation) => conversation.unread);
  const active = state.routes[state.index]?.name;
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  function open(name: string) {
    const route = state.routes.find((entry) => entry.name === name);
    if (!route) return;
    navigateToTab(route.key);
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {left.map((tab) => (
          <TabButton key={tab.name} tab={tab} active={active === tab.name} onPress={() => open(tab.name)} />
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Post an item" onPress={() => router.push('/post')} style={styles.slot}>
          <View style={styles.plus}>
            <Icon name="plus" size={22} color={palette.white} strokeWidth={2.1} />
          </View>
          <Text style={styles.label}>Post</Text>
        </Pressable>
        {right.map((tab) => (
          <TabButton
            key={tab.name}
            tab={tab}
            active={active === tab.name}
            badge={tab.name === 'inbox' && unread}
            onPress={() => open(tab.name)}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({
  tab,
  active,
  badge,
  onPress,
}: {
  tab: { label: string; icon: IconName };
  active: boolean;
  badge?: boolean;
  onPress: () => void;
}) {
  const color = active ? palette.forest : palette.muted;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.slot}>
      <View>
        <Icon name={tab.icon} size={22} color={color} />
        {badge ? <View style={styles.badge} /> : null}
      </View>
      <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: palette.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 52,
  },
  label: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '500',
  },
  activeLabel: {
    color: palette.forest,
    fontWeight: '600',
  },
  plus: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.forest,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.terracotta,
  },
});
