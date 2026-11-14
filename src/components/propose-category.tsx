import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '@/data/store';
import { palette } from '@/constants/palette';
import { validateCategoryProposal } from '@/lib/category-proposals';
import { Button, Chip } from './ui';
export function ProposeCategory({ onApproved }: { onApproved?: (name: string) => void }) {
  const { categories, proposeCategory, me } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit() {
    if (busy) return;
    const error = validateCategoryProposal({ name, reason, proposedBy: me.id });
    if (error) { setMessage(error); return; }
    const existing = categories.find(c => c.toLowerCase() === name.trim().replace(/\s+/g,' ').toLowerCase());
    if (existing) { setMessage('This category already exists.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await proposeCategory(name, reason);
      setMessage(result.message);
      if (result.status === 'approved') { onApproved?.(result.name); setOpen(false); setName(''); setReason(''); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={s.wrap}><Chip compact label={open ? 'Close category form' : '+ Add Category'} onPress={() => { setOpen(current => !current); setMessage(''); }} />
    {open ? <View style={s.form}><Text style={s.title}>Add a new category</Text><Text style={s.hint}>Suggest a category, such as Food, and explain what belongs in it.</Text>
      <Text style={s.label}>Category name</Text><TextInput accessibilityLabel="Proposed category name" placeholder="Food" placeholderTextColor={palette.muted} value={name} onChangeText={setName} maxLength={40} style={s.input} editable={!busy} />
      <Text style={s.label}>Why add this category</Text><TextInput accessibilityLabel="Category proposal reason" placeholder="Describe the items neighbors could share" placeholderTextColor={palette.muted} value={reason} onChangeText={setReason} maxLength={500} multiline style={s.input} editable={!busy} />
      <Text style={s.hint}>Demo: proposals auto-approve locally. AI review and approval for everyone will be connected later.</Text>
      <Button label={busy ? 'Submitting...' : 'Add category'} disabled={busy} onPress={() => { void submit(); }} />
    </View> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={s.hint}>{message}</Text> : null}
  </View>;
}
const s = StyleSheet.create({ wrap: { gap: 8 }, addButton: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white }, addLabel: { fontSize: 12, color: palette.forest, fontWeight: '500' }, form: { padding: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.white, gap: 10 }, title: { fontSize: 16, fontWeight: '600', color: palette.forest }, label: { fontSize: 13, fontWeight: '600', color: palette.ink }, hint: { fontSize: 12, color: palette.muted, lineHeight: 19 }, input: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 12, color: palette.ink, fontSize: 16 } });
