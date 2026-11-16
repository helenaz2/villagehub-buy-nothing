import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { palette, radius, space, touch, useTheme } from '@/theme';

import { T } from './T';

type Kind =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'accent'
  /** Solid paper button for the dark camera screens. */
  | 'onDark'
  /** Outlined button for the dark camera screens. */
  | 'ghostOnDark';

type Props = {
  label: string;
  onPress: () => void;
  kind?: Kind;
  icon?: LucideIcon;
  /** Icon after the label, for buttons that move you forward. */
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export const ICON_STROKE = 1.75;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const press = { damping: 15, stiffness: 420, mass: 0.6 };

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon: Icon,
  trailingIcon: Trailing,
  loading,
  disabled,
  compact,
  style,
  accessibilityHint,
}: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const dim = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 1 - dim.value * 0.12 }));

  const look: Record<Kind, { fill: string; ink: string; border?: string }> = {
    primary: { fill: colors.action, ink: colors.onAction },
    accent: { fill: colors.accent, ink: '#FFFFFF' },
    secondary: { fill: 'transparent', ink: colors.text, border: colors.text },
    quiet: { fill: 'transparent', ink: colors.text },
    onDark: { fill: palette.paper, ink: palette.forest },
    ghostOnDark: { fill: 'rgba(21, 19, 16, 0.45)', ink: palette.paper, border: 'rgba(244, 239, 230, 0.55)' },
  };
  const { fill, ink, border } = look[kind];
  const off = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPressIn={() => {
        if (!reduced) scale.set(withSpring(0.965, press));
        dim.set(withTiming(1, { duration: 80 }));
      }}
      onPressOut={() => {
        scale.set(reduced ? 1 : withSpring(1, press));
        dim.set(withTiming(0, { duration: 160 }));
      }}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      hitSlop={compact ? 6 : 0}
      style={[
        styles.base,
        compact && styles.compact,
        kind === 'quiet' && styles.quiet,
        { backgroundColor: fill },
        border ? { borderWidth: 1.5, borderColor: border } : null,
        disabled ? { opacity: 0.4 } : null,
        style,
        animated,
      ]}>
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={compact ? 17 : 20} color={ink} strokeWidth={ICON_STROKE + 0.25} /> : null}
          <T
            variant={compact ? 'labelStrong' : 'bodyStrong'}
            style={[{ color: ink }, kind === 'quiet' && styles.quietLabel]}
            numberOfLines={1}>
            {label}
          </T>
          {Trailing ? <Trailing size={compact ? 16 : 18} color={ink} strokeWidth={ICON_STROKE + 0.25} /> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: touch.min, paddingHorizontal: space.md, borderRadius: radius.control - 2 },
  quiet: { paddingHorizontal: space.sm },
  quietLabel: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
