import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/lib/haptics';
import { radius, space, touch, useTheme } from '@/theme';

import { T } from './T';

type Props = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet' | 'accent';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export const ICON_STROKE = 1.75;

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon: Icon,
  loading,
  disabled,
  compact,
  style,
  accessibilityHint,
}: Props) {
  const { colors } = useTheme();
  const fill =
    kind === 'primary' ? colors.action : kind === 'accent' ? colors.accent : 'transparent';
  const ink =
    kind === 'primary' ? colors.onAction : kind === 'accent' ? '#FFFFFF' : colors.text;
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: fill, opacity: disabled ? 0.4 : pressed ? 0.82 : 1 },
        kind === 'secondary' && { borderWidth: 1.5, borderColor: colors.text },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={compact ? 17 : 19} color={ink} strokeWidth={ICON_STROKE} /> : null}
          <T variant={compact ? 'labelStrong' : 'bodyStrong'} style={{ color: ink }}>
            {label}
          </T>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: touch.min, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
