import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Screen } from './screen';
import { BackButton } from './back-button';
import { Icon } from './icon';
import { Button, Chip } from './ui';
import { palette, serif } from '@/constants/palette';
import { backendConfig } from '@/lib/backend-config';
import { useStore } from '@/data/store';
import { getListing } from '@/services/listings';
import { askRecommendations, refreshRecommendations, type RecommendationRequest } from '@/services/recommendations';
import type { RecommendationReply } from '@/lib/recommendation-contract';

type Turn={id:string;question:string;reply:RecommendationReply};
export function RecommendationScreen(){
 const {me}=useStore();return <RecommendationChat key={me.id} />;
}
export function RecommendationChat({embedded=false,visible=true}:{embedded?:boolean;visible?:boolean}){
 const {refreshListing}=useStore(),path=usePathname();
 const [turns,setTurns]=useState<Turn[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[opening,setOpening]=useState<string|null>(null),[refreshing,setRefreshing]=useState(false);
 const [canRetry,setCanRetry]=useState(false);
 const pending=useRef<RecommendationRequest|null>(null),active=useRef(true),inFlight=useRef(false);
 const usable=!backendConfig.demo&&backendConfig.recommendations;
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{if(!visible || (path!=='/recommendations' && !embedded))return;let alive=true;
  const latest=turns.at(-1),ids=latest?.reply.items.map(i=>i.id)??[];if(!ids.length)return;
  void refreshRecommendations(ids).then(items=>{if(alive)setTurns(old=>old.map(turn=>turn.id===latest?.id?{...turn,reply:{...turn.reply,items}}:turn));}).catch(()=>{if(alive)setError('Unable to refresh availability. Try the reload button at the top.');});
  return()=>{alive=false;};
 // Recheck the latest cards on return from detail; sending a turn already queries fresh data.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[path,visible,embedded]);
 async function send(retry=false){
  if(inFlight.current||opening||refreshing||!usable)return;
  let request=pending.current;
  if(!retry){if(!text.trim())return;request={requestKey:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),messages:[...turns.slice(-5).map(t=>t.question),text.trim()],previousPlan:turns.at(-1)?.reply.plan??null};pending.current=request;}
  if(!request)return;inFlight.current=true;setBusy(true);setError('');setCanRetry(false);
  try{const reply=await askRecommendations(request);if(active.current){setTurns(old=>[...old.slice(-5),{id:request!.requestKey,question:request!.messages.at(-1)!,reply}]);setText('');pending.current=null;}}
  catch(e){if(active.current){setError(e instanceof Error?e.message:'Unable to search. Please retry.');setCanRetry(true);}}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 async function refresh(){
  if(refreshing||busy)return;const latest=turns.at(-1);if(!latest)return;setRefreshing(true);setError('');
  try{const items=await refreshRecommendations(latest.reply.items.map(i=>i.id));if(active.current)setTurns(old=>old.map(turn=>turn.id===latest.id?{...turn,reply:{...turn.reply,items,message:items.length?'These matches are still available.':'These matches are no longer available. Try a new search.'}}:turn));}
  catch(e){if(active.current)setError(e instanceof Error?e.message:'Unable to refresh results.');}finally{if(active.current)setRefreshing(false);}
 }
 async function open(id:string){
  if(opening)return;setOpening(id);setError('');
  try{const item=await getListing(id);if(!item||item.status!=='available'){if(active.current){setTurns(old=>old.map(turn=>({...turn,reply:{...turn.reply,items:turn.reply.items.filter(i=>i.id!==id)}})));setError('This item is no longer available. Try refreshing your results.');}return;}await refreshListing(id);if(active.current)router.push({pathname:'/item',params:{id}});}
  catch(e){if(active.current)setError(e instanceof Error?e.message:'Unable to open this item.');}finally{if(active.current)setOpening(null);}
 }
 const reload=<Pressable accessibilityRole="button" accessibilityLabel="Reload latest results" disabled={!turns.length||busy||refreshing||opening!==null} onPress={()=>{void refresh();}} style={[s.reload,(!turns.length||busy||refreshing) && {opacity:0.4}]}>{refreshing?<ActivityIndicator color={palette.forest} size="small" />:<Icon name="reload" size={20} />}</Pressable>;
 const content=<>{!embedded?<BackButton />:null}<View style={s.topline}><Text style={[s.title,{flex:1},embedded && {fontSize:22,marginVertical:8}]}>Find your next good thing</Text>{!embedded?reload:null}</View><Text style={s.body}>Ask VillageHub to search free items. Follow up with a material, another item or a city.</Text>
 {!usable?<View style={s.card}><Text style={s.body}>{backendConfig.demo?'The assistant uses real signed-in listings. Log in outside demo mode to use it.':'The assistant is prepared and waiting for backend verification.'}</Text></View>:<>
 <Text style={s.note}>Your recent messages go to OpenAI to interpret the search. Results come from VillageHub. No geographic distances are estimated. Availability may change; it is checked again when opening an item.</Text>
 {!turns.length?<View style={s.examples}>{['Find me a free desk in Berkeley','Show me baby clothes near me'].map(query=><Chip key={query} label={query} onPress={()=>setText(query)} />)}</View>:null}
 {turns.map(turn=><View key={turn.id} style={s.turn}><View style={s.question}><Text style={s.body}>{turn.question}</Text></View><Text accessibilityLiveRegion="polite" style={s.body}>{turn.reply.message}</Text>
 {turn.reply.items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'View '+item.title} disabled={opening!==null} onPress={()=>{void open(item.id);}} style={s.row}>
 {item.imageUrl?<Image source={{uri:item.imageUrl}} style={s.image} contentFit="cover" />:<View style={[s.image,s.noImage]}><Text style={s.note}>No photo</Text></View>}
 <View style={s.details}><Text style={s.name}>{item.title}</Text><Text style={s.free}>Free · Available</Text><Text style={s.note}>{item.neighborhood}, {item.city}</Text>{opening===item.id?<Text style={s.note}>Checking availability...</Text>:null}</View></Pressable>)}
 {!turn.reply.items.length&&turn.reply.plan.action==='search'?<Text style={s.note}>Try a different city or remove a preference. No items were invented to fill the results.</Text>:null}</View>)}
 {busy?<View style={s.loading}><ActivityIndicator color={palette.forest} /><Text style={s.body}>Searching available listings...</Text></View>:null}
 {error?<View style={s.card}><Text accessibilityRole="alert" style={s.body}>{error}</Text>{canRetry?<Button label="Retry search" variant="ghost" disabled={busy} onPress={()=>{void send(true);}} />:null}</View>:null}
 <View style={s.composer}><TextInput accessibilityLabel="Ask VillageHub" placeholder="What are you looking for" placeholderTextColor={palette.muted} value={text} onChangeText={setText} maxLength={500} editable={!busy} multiline style={[s.input,{flex:1,marginVertical:0}]} /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={busy||refreshing||opening!==null||!text.trim()} onPress={()=>{void send();}} style={[s.send,(busy||refreshing||opening!==null||!text.trim()) && {opacity:0.4}]}>{busy?<ActivityIndicator color={palette.white} size="small" />:<Icon name="arrowUp" size={22} color={palette.white} />}</Pressable></View>
 {turns.length?<Pressable accessibilityRole="button" disabled={busy||refreshing||opening!==null} onPress={()=>{setTurns([]);setText('');setError('');setCanRetry(false);pending.current=null;}} style={s.newSearch}><Text style={s.newSearchLabel}>Start new search</Text></Pressable>:null}</>}
 </>;
 return embedded?<View style={{flex:1}}><View style={s.reloadBar}>{reload}</View><ScrollView style={{flex:1}} contentContainerStyle={{padding:16}} keyboardShouldPersistTaps="handled">{content}</ScrollView></View>:<Screen keyboard>{content}</Screen>;
}
const s=StyleSheet.create({reloadBar:{alignItems:'flex-end',paddingRight:8,borderBottomWidth:1,borderBottomColor:palette.line},topline:{flexDirection:'row',alignItems:'center',gap:8},reload:{width:44,height:44,alignItems:'center',justifyContent:'center'},composer:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:12},send:{width:44,height:44,borderRadius:22,backgroundColor:palette.forest,alignItems:'center',justifyContent:'center',marginBottom:8},newSearch:{alignSelf:'center',paddingHorizontal:12,minHeight:44,justifyContent:'center',marginTop:4},newSearchLabel:{fontSize:12,color:palette.muted},title:{fontFamily:serif,fontSize:28,color:palette.forest,marginVertical:18},body:{fontSize:15,lineHeight:22,color:palette.ink},note:{fontSize:12,lineHeight:18,color:palette.muted,marginVertical:5},examples:{gap:8,marginVertical:18},card:{padding:16,borderRadius:16,backgroundColor:palette.white,marginVertical:10,gap:8},turn:{gap:12,marginVertical:14},question:{alignSelf:'flex-end',maxWidth:'94%',padding:14,borderRadius:16,backgroundColor:palette.forestSoft},row:{flexDirection:'row',gap:12,padding:12,borderRadius:16,backgroundColor:palette.white},image:{width:88,height:88,borderRadius:12,backgroundColor:palette.sage},noImage:{alignItems:'center',justifyContent:'center'},details:{flex:1,gap:3},name:{fontSize:16,fontWeight:'600',color:palette.ink},free:{fontSize:13,color:palette.forest,fontWeight:'600'},loading:{flexDirection:'row',gap:10,paddingVertical:14},input:{borderWidth:1,borderColor:palette.line,borderRadius:14,padding:14,minHeight:64,color:palette.ink,fontSize:15,backgroundColor:palette.white,marginVertical:12}});
