import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { haptic } from '@/lib/haptics';
import { radius, space, touch, useTheme } from '@/theme';

import { ICON_STROKE } from './Button';
import { T } from './T';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** Marks a value the AI was unsure about. */
  unsure?: boolean;
};

export function Chip({ label, selected, onPress, icon: Icon, unsure }: Props) {
  const { colors } = useTheme();
  const ink = selected ? colors.onAction : colors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      disabled={!onPress}
      hitSlop={4}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.action : 'transparent',
          borderColor: selected ? colors.action : unsure ? colors.accent : colors.line,
          borderStyle: unsure && !selected ? 'dashed' : 'solid',
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      {Icon ? <Icon size={16} color={ink} strokeWidth={ICON_STROKE} /> : null}
      <T variant="label" style={{ color: ink }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touch.min - 4,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
