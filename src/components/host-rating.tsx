import { Text, View, StyleSheet } from 'react-native';
import { Icon } from './icon';
import { palette } from '@/constants/palette';
export function HostRating({ value }: { value: number }) {
  return <View style={s.row} accessibilityLabel={value ? value.toFixed(1) + ' out of 5 stars' : 'No ratings yet'}><Icon name="star" size={14} color={palette.terracotta} /><Text style={s.text}>{value ? value.toFixed(1) + ' / 5' : 'No ratings yet'}</Text></View>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', gap: 5, alignItems: 'center', marginVertical: 3 }, text: { fontSize: 12, color: palette.forest, fontWeight: '600' } });
