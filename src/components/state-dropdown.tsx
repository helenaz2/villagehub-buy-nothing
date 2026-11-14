import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { US_STATES } from '@/constants/us-states';
import { palette } from '@/constants/palette';
export function StateDropdown({ value, onChange }: { value: string; onChange: (state: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={s.wrap}><Text style={s.label}>State *</Text><Pressable accessibilityRole="button" accessibilityLabel={'State, ' + (value || 'Select a state')} accessibilityState={{ expanded: open }} onPress={() => setOpen(current => !current)} style={s.trigger}><Text style={value ? s.value : s.placeholder}>{value || 'Select a state'}</Text><Text style={s.value}>{open ? '-' : '+'}</Text></Pressable>
  {open ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={s.options}>{US_STATES.map(state => <Pressable key={state} accessibilityRole="button" accessibilityState={{ selected: value === state }} onPress={() => { onChange(state); setOpen(false); }} style={[s.option, value === state && s.selected]}><Text style={s.value}>{state}</Text></Pressable>)}</ScrollView> : null}</View>;
}
const s = StyleSheet.create({ wrap: { gap: 8 }, label: { fontSize: 13, fontWeight: '600', color: palette.ink }, trigger: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.bg }, value: { color: palette.ink, fontSize: 16 }, placeholder: { color: palette.muted, fontSize: 16 }, options: { maxHeight: 240, borderWidth: 1, borderColor: palette.line, borderRadius: 12 }, option: { minHeight: 44, padding: 12 }, selected: { backgroundColor: palette.forestSoft } });
