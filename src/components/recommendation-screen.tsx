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
import { askRecommendations, refreshRecommendations } from '@/services/recommendations';
import { useAssistant } from '@/data/assistant';
import { AssistantMessage } from './assistant-message';
import { VillageLogo } from './village-logo';


export function RecommendationScreen(){
 const {me}=useStore();return <RecommendationChat key={me.id} />;
}
export function RecommendationChat({embedded=false,visible=true}:{embedded?:boolean;visible?:boolean}){
 const {refreshListing,me}=useStore(),path=usePathname();
 const {turns,setTurns,text,setText,busy,setBusy,error,setError,canRetry,setCanRetry,pendingRef,inFlightRef,pendingQuestion,setPendingQuestion,notices,noticeError}=useAssistant();
 const [opening,setOpening]=useState<string|null>(null),[refreshing,setRefreshing]=useState(false);
 const active=useRef(true);
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
  if(inFlightRef.current||opening||refreshing||!usable)return;
  let request=pendingRef.current;
  if(!retry){if(!text.trim())return;request={requestKey:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),messages:[...turns.slice(-5).map(t=>t.question),text.trim()],previousPlan:turns.at(-1)?.reply.plan??null};pendingRef.current=request;}
  if(!request)return;setPendingQuestion(request.messages.at(-1)??'');inFlightRef.current=true;setBusy(true);setError('');setCanRetry(false);
  try{const reply=await askRecommendations(request);setTurns(old=>[...old.slice(-5),{id:request!.requestKey,question:request!.messages.at(-1)!,reply,createdAt:Date.now()}]);setText('');pendingRef.current=null;}
  catch(e){setError(e instanceof Error?e.message:'Unable to search. Please retry.');setCanRetry(true);}
  finally{inFlightRef.current=false;setBusy(false);}
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
 const content=<>{!embedded?<BackButton />:null}<View style={s.topline}><View style={{width:40,height:40}}><VillageLogo /></View><Text style={[s.title,{flex:1,fontSize:20},embedded && {marginVertical:8}]}>VillageHub Buy Nothing</Text>{!embedded?reload:null}</View><Text style={s.note}>Your listing assistant and private system messages</Text>
 {!turns.length?<AssistantMessage><Text style={s.body}>{'Hi, '+(me.name||me.handle.replace(/^@/,''))+', welcome to Villagehub Buy Nothing. What are you looking for?'}</Text></AssistantMessage>:null}
 {noticeError?<Text accessibilityRole="alert" style={s.note}>{noticeError}</Text>:null}
 {notices.slice().reverse().map(notice=><AssistantMessage key={notice.id}><Text style={s.free}>System message</Text><Text style={s.body}>{notice.status==='rejected'?'Your request to add '+notice.name+' was not approved.':'Your category '+notice.name+' is available in the shared category list.'}</Text><Text style={s.body}>{notice.message}</Text><Text style={s.note}>{new Date(notice.reviewed_at??notice.created_at).toLocaleString()}</Text></AssistantMessage>)}
 {!usable?<View style={s.card}><Text style={s.body}>{backendConfig.demo?'The assistant uses real signed-in listings. Log in outside demo mode to use it.':'The assistant is prepared and waiting for backend verification.'}</Text></View>:<>
 <Text style={s.note}>Your recent messages go to OpenAI to interpret the search. Results come from VillageHub. No geographic distances are estimated. Availability may change; it is checked again when opening an item.</Text>
 {!turns.length?<View style={s.examples}>{['Find me a free desk in Berkeley','Show me baby clothes near me'].map(query=><Chip key={query} label={query} onPress={()=>setText(query)} />)}</View>:null}
 {turns.map(turn=><View key={turn.id} style={s.turn}><AssistantMessage fromUser><Text style={[s.body,{color:palette.white}]}>{turn.question}</Text></AssistantMessage><AssistantMessage><Text accessibilityLiveRegion="polite" style={s.body}>{turn.reply.message}</Text>
 {turn.reply.items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'View '+item.title} disabled={opening!==null} onPress={()=>{void open(item.id);}} style={s.row}>
 {item.imageUrl?<Image source={{uri:item.imageUrl}} style={s.image} contentFit="cover" />:<View style={[s.image,s.noImage]}><Text style={s.note}>No photo</Text></View>}
 <View style={s.details}><Text style={s.name}>{item.title}</Text><Text style={s.free}>Free · Available</Text><Text style={s.note}>{item.neighborhood}, {item.city}</Text>{opening===item.id?<Text style={s.note}>Checking availability...</Text>:null}</View></Pressable>)}
 {!turn.reply.items.length&&turn.reply.plan.action==='search'?<Text style={s.note}>Try a different city or remove a preference.</Text>:null}</AssistantMessage></View>)}
 {busy||canRetry?<AssistantMessage fromUser><Text style={[s.body,{color:palette.white}]}>{pendingQuestion}</Text></AssistantMessage>:null}
 {busy?<AssistantMessage><View style={s.loading}><ActivityIndicator color={palette.forest} /><Text style={s.body}>Searching...</Text></View></AssistantMessage>:null}
 {error?<AssistantMessage><Text accessibilityRole="alert" style={s.body}>{error}</Text>{canRetry?<Button label="Retry search" variant="ghost" disabled={busy} onPress={()=>{void send(true);}} />:null}</AssistantMessage>:null}
 <View style={s.composer}><TextInput accessibilityLabel="Ask VillageHub" placeholder="What are you looking for" placeholderTextColor={palette.muted} value={text} onChangeText={setText} maxLength={500} editable={!busy} multiline style={[s.input,{flex:1,marginVertical:0}]} /><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={busy||refreshing||opening!==null||!text.trim()} onPress={()=>{void send();}} style={[s.send,(busy||refreshing||opening!==null||!text.trim()) && {opacity:0.4}]}>{busy?<ActivityIndicator color={palette.white} size="small" />:<Icon name="arrowUp" size={22} color={palette.white} />}</Pressable></View>
 {turns.length?<Pressable accessibilityRole="button" disabled={busy||refreshing||opening!==null} onPress={()=>{setTurns([]);setText('');setError('');setCanRetry(false);pendingRef.current=null;}} style={s.newSearch}><Text style={s.newSearchLabel}>Start new search</Text></Pressable>:null}</>}
 </>;
 return embedded?<View style={{flex:1}}><View style={s.reloadBar}>{reload}</View><ScrollView style={{flex:1}} contentContainerStyle={{padding:16}} keyboardShouldPersistTaps="handled">{content}</ScrollView></View>:<Screen keyboard>{content}</Screen>;
}
const s=StyleSheet.create({reloadBar:{alignItems:'flex-end',paddingRight:8,borderBottomWidth:1,borderBottomColor:palette.line},topline:{flexDirection:'row',alignItems:'center',gap:8},reload:{width:44,height:44,alignItems:'center',justifyContent:'center'},composer:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:12},send:{width:44,height:44,borderRadius:22,backgroundColor:palette.forest,alignItems:'center',justifyContent:'center',marginBottom:8},newSearch:{alignSelf:'center',paddingHorizontal:12,minHeight:44,justifyContent:'center',marginTop:4},newSearchLabel:{fontSize:12,color:palette.muted},title:{fontFamily:serif,fontSize:28,color:palette.forest,marginVertical:18},body:{fontSize:15,lineHeight:22,color:palette.ink},note:{fontSize:12,lineHeight:18,color:palette.muted,marginVertical:5},examples:{gap:8,marginVertical:18},card:{padding:16,borderRadius:16,backgroundColor:palette.white,marginVertical:10,gap:8},turn:{gap:0,marginVertical:5},question:{alignSelf:'flex-end',maxWidth:'94%',padding:14,borderRadius:16,backgroundColor:palette.forestSoft},row:{flexDirection:'row',gap:8,padding:8,borderRadius:12,borderWidth:1,borderColor:palette.line,backgroundColor:palette.bg},image:{width:56,height:64,borderRadius:8,backgroundColor:palette.sage},noImage:{alignItems:'center',justifyContent:'center'},details:{flex:1,gap:3},name:{fontSize:14,fontWeight:'600',color:palette.ink},free:{fontSize:13,color:palette.forest,fontWeight:'600'},loading:{flexDirection:'row',gap:10,paddingVertical:14},input:{borderWidth:1,borderColor:palette.line,borderRadius:14,padding:14,minHeight:64,color:palette.ink,fontSize:15,backgroundColor:palette.white,marginVertical:12}});
