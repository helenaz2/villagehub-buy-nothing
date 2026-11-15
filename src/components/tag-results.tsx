import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/data/store';
import { backendConfig } from '@/lib/backend-config';
import { listListings, PAGE_SIZE } from '@/services/listings';
import { palette, serif } from '@/constants/palette';
import type { Item } from '@/types/listing';
import { Screen } from './screen';
import { BackButton } from './back-button';
import { ItemGrid } from './item-card';
import { Button } from './ui';

export function TagResultsScreen(){
 const params=useLocalSearchParams<{name?:string;kind?:string}>();
 const name=typeof params.name==='string'?params.name:'';
 const category=params.kind==='category';
 return <TagResults key={JSON.stringify([name,category])} name={name} category={category} />;
}
function TagResults({name,category}:{name:string;category:boolean}){
 const {items,savedIds,toggleSave}=useStore();const path=usePathname();
 const [rows,setRows]=useState<Item[]>([]),[busy,setBusy]=useState(false),[more,setMore]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const active=useRef(true),loadingMore=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{
  if(backendConfig.demo||path!=='/tag'||!name||name.length>2000)return;
  let current=true;
  async function load(){setBusy(true);setError('');try{const next=await listListings(category?{category:name}:{tag:name});if(current){setRows(next);setMore(next.length===PAGE_SIZE);}}catch(e){if(current)setError(e instanceof Error?e.message:'Unable to load matching items.');}finally{if(current)setBusy(false);}}
  void load();return()=>{current=false;};
 },[name,category,path,retry]);
 async function loadMore(){
  if(busy||loadingMore.current)return;loadingMore.current=true;setBusy(true);setError('');
  try{const next=await listListings({...category?{category:name}:{tag:name},offset:rows.length});if(active.current){setRows(old=>[...old,...next.filter(item=>!old.some(existing=>existing.id===item.id))]);setMore(next.length===PAGE_SIZE);}}
  catch(e){if(active.current)setError(e instanceof Error?e.message:'Unable to load more items.');}finally{loadingMore.current=false;if(active.current)setBusy(false);}
 }
 const shown=backendConfig.demo?items.filter(item=>item.status==='available'&&(category?item.category===name:item.tags.includes(name))):rows;
 return <Screen><BackButton /><Text style={s.title}>#{name.replace(/^#+/,'').replace(/\s+/g,'')}</Text><Text style={s.subtitle}>{category?'Free items in this category':'Free items with this tag'}</Text>
 {!name||name.length>2000?<Text style={s.subtitle}>This tag is invalid. Go back and choose a tag on a post.</Text>:<>
 {shown.length?<ItemGrid items={shown} savedIds={savedIds} onSave={toggleSave} onPress={id=>router.push({pathname:'/item',params:{id}})} />:!busy&&!error?<View style={s.empty}><Text style={s.subtitle}>No available items with this {category?'category':'tag'} yet.</Text></View>:null}
 {busy?<ActivityIndicator accessibilityLabel="Loading matching items" color={palette.forest} style={{marginVertical:20}} />:null}
 {error?<View style={s.empty}><Text accessibilityRole="alert" style={s.subtitle}>{error}</Text><Button label="Retry" variant="ghost" disabled={busy} onPress={()=>{if(rows.length&&more){void loadMore();}else setRetry(value=>value+1);}} /></View>:null}
 {!backendConfig.demo&&more&&!error?<Button label="Load more" variant="ghost" disabled={busy} onPress={()=>{void loadMore();}} />:null}
 </>}</Screen>;
}
const s=StyleSheet.create({title:{fontFamily:serif,fontSize:28,color:palette.forest,marginTop:20,marginBottom:8},subtitle:{fontSize:14,color:palette.muted,lineHeight:22,marginBottom:20},empty:{paddingVertical:24,gap:8}});
