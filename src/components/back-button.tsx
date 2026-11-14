import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from './icon';
import { palette } from '@/constants/palette';
export function BackButton({ label = 'Back', onPress }: { label?: string; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress ?? (() => router.canGoBack() ? router.back() : router.replace('/'))} style={s.button}><Icon name="back" size={18} /><Text style={s.text}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({ button: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 44, paddingRight: 12 }, text: { fontSize: 13, color: palette.forest } });
