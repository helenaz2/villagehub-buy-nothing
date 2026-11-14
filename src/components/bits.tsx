import { BadgeCheck, ChevronLeft, Minus, Plus, Star, type LucideIcon } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { User } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { radius, space, touch, useTheme } from '@/theme';

import { ICON_STROKE } from './Button';
import { T } from './T';

/** Small shared pieces. Each one is too small to deserve its own file. */

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.sageSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T variant={size > 44 ? 'subhead' : 'labelStrong'} color="text" maxFontSizeMultiplier={1}>
        {initials}
      </T>
    </View>
  );
}

export function PersonLine({ user, suffix }: { user: User; suffix?: string }) {
  const { colors } = useTheme();
  const verifiedLabel =
    user.verified === 'edu' ? 'University email verified' : user.verified === 'phone' ? 'Phone verified' : null;
  return (
    <View style={styles.person}>
      <Avatar name={user.name} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="labelStrong">{user.name}</T>
          {verifiedLabel ? (
            <BadgeCheck size={16} color={colors.textSoft} strokeWidth={ICON_STROKE} accessibilityLabel={verifiedLabel} />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={13} color={colors.accent} fill={colors.accent} strokeWidth={0} />
          <T variant="caption" color="textSoft">
            {user.rating.toFixed(1)} from {user.handoffs} handoffs{suffix ? `, ${suffix}` : ''}
          </T>
        </View>
      </View>
    </View>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'plain',
  style,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'onPhoto';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconBtn,
        tone === 'onPhoto' && { backgroundColor: colors.bg },
        { opacity: pressed ? 0.7 : 1 },
        style,
      ]}>
      <Icon size={22} color={colors.text} strokeWidth={ICON_STROKE} />
    </Pressable>
  );
}

export function BackButton({ onPress, tone }: { onPress: () => void; tone?: 'plain' | 'onPhoto' }) {
  return <IconButton icon={ChevronLeft} label="Back" onPress={onPress} tone={tone} />;
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  label,
  format = (n) => String(n),
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  format?: (n: number) => string;
}) {
  const { colors } = useTheme();
  const bump = (dir: 1 | -1) => {
    haptic.tap();
    onChange(Math.min(max, Math.max(min, value + dir * step)));
  };
  return (
    <View style={[styles.stepper, { borderColor: colors.line }]} accessibilityLabel={`${label}, ${format(value)}`}>
      <Pressable onPress={() => bump(-1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`}>
        <Minus size={18} color={colors.text} strokeWidth={ICON_STROKE} />
      </Pressable>
      <View style={{ alignItems: 'center', minWidth: 52 }}>
        <T variant="labelStrong">{format(value)}</T>
        <T variant="caption" color="textSoft">
          {label}
        </T>
      </View>
      <Pressable onPress={() => bump(1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Increase ${label}`}>
        <Plus size={18} color={colors.text} strokeWidth={ICON_STROKE} />
      </Pressable>
    </View>
  );
}

export function Stars({ value, onChange, size = 34 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityRole="adjustable" accessibilityLabel={`Rating, ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => {
            haptic.tap();
            onChange(n);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
          <Star
            size={size}
            color={n <= value ? colors.accent : colors.line}
            fill={n <= value ? colors.accent : 'transparent'}
            strokeWidth={ICON_STROKE}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** A thin rule. Used to separate sections on a page, never to box things in. */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.line }, style]} />;
}

/** Loading placeholder that breathes. Give it the same size as the thing it stands in for. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [o, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: colors.sand, borderRadius: radius.photo }, style, anim]} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon size={40} color={colors.sage} strokeWidth={1.25} />
      <T variant="heading" center>
        {title}
      </T>
      <T color="textSoft" center>
        {body}
      </T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: {
    width: touch.min,
    height: touch.min,
    borderRadius: touch.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.control,
  },
  stepBtn: { width: touch.min, height: 52, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.section },
});
