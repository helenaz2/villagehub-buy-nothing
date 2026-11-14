import { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { palette, serif } from '@/constants/palette';

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'default',
  compact = false,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'quiet';
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, compact && styles.compactChip, tone === 'quiet' && styles.quiet, selected && styles.selected]}>
      <Text style={[styles.chipLabel, compact && styles.compactLabel, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'solid',
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'ghost';
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {icon}
      <Text style={[styles.buttonLabel, variant === 'ghost' && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function cardShadow(): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: '#2A241C',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: { boxShadow: '0 8px 24px rgba(42, 36, 28, 0.06)' },
  }) as ViewStyle;
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  compactChip: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6 },
  compactLabel: { fontSize: 12 },
  quiet: {
    backgroundColor: palette.forestSoft,
    borderColor: 'transparent',
  },
  selected: {
    backgroundColor: palette.forest,
    borderColor: palette.forest,
  },
  chipLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedLabel: {
    color: palette.white,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.forest,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  ghost: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
  },
  buttonLabel: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '600',
  },
  ghostLabel: {
    color: palette.ink,
  },
  fieldLabel: {
    fontFamily: serif,
    color: palette.ink,
    fontSize: 16,
  },
});
