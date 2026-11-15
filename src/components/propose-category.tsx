import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '@/data/store';
import { palette } from '@/constants/palette';
import { validateCategoryProposal } from '@/lib/category-proposals';
import { Button, Chip } from './ui';
import { backendConfig } from '@/lib/backend-config';
import { getProposals, reviewProposal } from '@/services/ai';
import type { CategoryProposal } from '@/types/ai';
export function ProposeCategory({ onApproved }: { onApproved?: (name: string) => void }) {
  const { categories, proposeCategory, me, reloadCategories } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [history,setHistory]=useState<{owner:string;rows:CategoryProposal[]}|null>(null);
  useEffect(()=>{
    if(!open || !backendConfig.ai || backendConfig.demo)return;
    let active=true;void getProposals().then(rows=>{if(active)setHistory({owner:me.id,rows});}).catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Unable to load proposals.');});
    return()=>{active=false;};
  },[open,me.id]);
  async function retry(id:string){
    setBusy(true);setMessage('');
    try{const result=await reviewProposal(id);setMessage(result.message);await reloadCategories();setHistory({owner:me.id,rows:await getProposals()});if(result.status==='approved')onApproved?.(result.name);}
    catch(e){setMessage(e instanceof Error?e.message:'Review unavailable. Please retry later.');}finally{setBusy(false);}
  }
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
      if(backendConfig.ai && !backendConfig.demo)setHistory({owner:me.id,rows:await getProposals()});
      if (result.status === 'approved') { onApproved?.(result.name); setName(''); setReason(''); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit. Please try again.'); }
    finally { setBusy(false); }
  }
  if(!backendConfig.demo && !backendConfig.ai)return null;
  return <View style={s.wrap}><Chip compact label={open ? 'Close category form' : '+ Add Category'} onPress={() => { setOpen(current => !current); setMessage(''); }} />
    {open ? <View style={s.form}><Text style={s.title}>Add a new category</Text><Text style={s.hint}>Suggest a category and explain what belongs in it. AI checks it before it joins the shared category list.</Text>
      <Text style={s.label}>Category name</Text><TextInput accessibilityLabel="Proposed category name" placeholder="Food" placeholderTextColor={palette.muted} value={name} onChangeText={setName} maxLength={40} style={s.input} editable={!busy} />
      <Text style={s.label}>Why add this category</Text><TextInput accessibilityLabel="Category proposal reason" placeholder="Describe the items neighbors could share" placeholderTextColor={palette.muted} value={reason} onChangeText={setReason} maxLength={500} multiline style={s.input} editable={!busy} />
      <Text style={s.hint}>{backendConfig.demo?'Demo: proposals auto-approve locally.':'AI reviews suggestions before adding them for everyone. If review is unavailable, your proposal stays pending.'}</Text>
      <Button label={busy ? 'Reviewing...' : 'Submit for AI review'} disabled={busy} onPress={() => { void submit(); }} />
      {!backendConfig.demo && history?.owner===me.id ? history.rows.map(p=><View key={p.id}><Text style={s.label}>{p.name} · {p.status}</Text><Text style={s.hint}>{p.message}</Text>{p.status==='pending'?<Button label="Retry review" variant="ghost" disabled={busy} onPress={()=>{void retry(p.id);}} />:null}</View>):null}
    </View> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={s.hint}>{message}</Text> : null}
  </View>;
}
const s = StyleSheet.create({ wrap: { gap: 8 }, addButton: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white }, addLabel: { fontSize: 12, color: palette.forest, fontWeight: '500' }, form: { padding: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.white, gap: 10 }, title: { fontSize: 16, fontWeight: '600', color: palette.forest }, label: { fontSize: 13, fontWeight: '600', color: palette.ink }, hint: { fontSize: 12, color: palette.muted, lineHeight: 19 }, input: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 12, color: palette.ink, fontSize: 16 } });
