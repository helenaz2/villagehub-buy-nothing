import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/data/store';
import { useAssistant } from '@/data/assistant';
import { palette } from '@/constants/palette';
import { VillageLogo } from './village-logo';

export function AssistantInboxRow(){
 const {me}=useStore(),{turns,notices}=useAssistant();
 const latest=notices.slice().sort((a,b)=>Date.parse(b.reviewed_at??b.created_at)-Date.parse(a.reviewed_at??a.created_at))[0];
 const turn=turns.at(-1);
 const showNotice=latest&&Date.parse(latest.reviewed_at??latest.created_at)>(turn?.createdAt??0);
 const preview=showNotice?(latest.status==='rejected'?'Your category request “'+latest.name+'” was not approved. '+latest.message:'Your category “'+latest.name+'” is available. '+latest.message):turn?.reply.message??'Hi, '+(me.name||me.handle.replace(/^@/,''))+', welcome to Villagehub Buy Nothing. What are you looking for?';
 return <Pressable accessibilityRole="button" accessibilityLabel="Open VillageHub Buy Nothing assistant and system messages" onPress={()=>router.push('/recommendations')} style={s.row}><View style={s.avatar}><VillageLogo /></View><View style={s.content}><Text style={s.name}>VillageHub Buy Nothing</Text><Text style={s.preview} numberOfLines={2}>{preview}</Text></View></Pressable>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:palette.white,marginBottom:12},avatar:{width:48,height:48,padding:4,borderRadius:24,backgroundColor:palette.forestSoft},content:{flex:1,gap:5},name:{fontSize:15,fontWeight:'600',color:palette.ink},preview:{fontSize:14,color:palette.muted,lineHeight:20}});
