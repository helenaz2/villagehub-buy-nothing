import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { prepareAIPhoto } from '@/lib/ai-photo';
import { suggestPhoto } from '@/services/ai';
import { palette } from '@/constants/palette';
import type { PhotoSuggestion } from '@/types/ai';

export function PhotoAutofill({photo,onApply}:{photo?:string;onApply:(suggestion:PhotoSuggestion)=>void}){
 const [suggestion,setSuggestion]=useState<PhotoSuggestion|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef<string|null>(null);const prepared=useRef<string|null>(null);
 async function analyze(){
  if(!photo||busy)return;setBusy(true);setError('');
  try{prepared.current??=await prepareAIPhoto(photo);key.current??=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);setSuggestion(await suggestPhoto(prepared.current,key.current));}
  catch(e){setError(e instanceof Error?e.message:'Unable to analyze this photo.');}finally{setBusy(false);}
 }
 return <View style={s.box}><Text style={s.title}>AI photo autofill</Text><Text style={s.hint}>Send a resized copy of your cover photo to OpenAI for title, category, color and tag suggestions. Review them before applying. AI can make mistakes.</Text>
 <Button label={busy?'Analyzing photo...':'Suggest from cover photo'} disabled={!photo||busy} variant="ghost" onPress={()=>{void analyze();}} />
 {error?<Text accessibilityRole="alert" style={s.hint}>{error}</Text>:null}
 {suggestion?<><Text style={s.title}>{suggestion.title}</Text><Text style={s.hint}>{suggestion.description}</Text><Text style={s.hint}>{suggestion.category} · {suggestion.color}</Text><Text style={s.hint}>{suggestion.tags.map(t=>'#'+t).join(' ')}</Text><Button label="Apply suggestions to empty fields" onPress={()=>{onApply(suggestion);setSuggestion(null);}} /></>:null}</View>;
}
const s=StyleSheet.create({box:{borderWidth:1,borderStyle:'dashed',borderColor:palette.forest,backgroundColor:palette.forestSoft,borderRadius:20,padding:18,gap:12,marginVertical:12},title:{fontSize:18,fontWeight:'600',color:palette.forest},hint:{fontSize:12,color:palette.muted,lineHeight:19}});
