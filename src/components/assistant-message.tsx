import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/palette';
import { useStore } from '@/data/store';
import { VillageLogo } from './village-logo';

export function AssistantMessage({children,fromUser=false}:{children:ReactNode;fromUser?:boolean}){
 const {me}=useStore();
 return <View style={[s.row,fromUser&&s.outgoing]}>
  <View accessible accessibilityRole="image" accessibilityLabel={fromUser?me.name+' profile photo':'VillageHub Buy Nothing profile photo'} style={[s.avatar,!fromUser&&s.logo]}>
   {fromUser?(me.avatar?<Image source={{uri:me.avatar}} contentFit="cover" style={s.photo} />:<Text style={s.initial}>{me.name.trim().slice(0,1).toUpperCase()||'You'}</Text>):<VillageLogo />}
  </View>
  <View style={[s.bubble,fromUser&&s.userBubble]}>
   <View style={[s.tail,fromUser?s.userTail:s.assistantTail]} />
   {children}
  </View>
 </View>;
}
const s=StyleSheet.create({
 row:{flexDirection:'row',alignItems:'flex-start',gap:9,marginVertical:7},outgoing:{flexDirection:'row-reverse'},
 avatar:{width:32,height:32,borderRadius:16,backgroundColor:palette.sage,alignItems:'center',justifyContent:'center',overflow:'hidden',marginTop:2},logo:{padding:4,backgroundColor:palette.white},photo:{width:32,height:32},initial:{fontSize:12,fontWeight:'600',color:palette.forest},
 bubble:{flexShrink:1,maxWidth:'86%',padding:12,borderRadius:16,borderTopLeftRadius:4,backgroundColor:palette.white,gap:8},userBubble:{backgroundColor:palette.forest,borderTopLeftRadius:16,borderTopRightRadius:4},
 tail:{position:'absolute',top:9,width:0,height:0,borderTopWidth:5,borderBottomWidth:5,borderTopColor:'transparent',borderBottomColor:'transparent'},assistantTail:{left:-6,borderRightWidth:7,borderRightColor:palette.white},userTail:{right:-6,borderLeftWidth:7,borderLeftColor:palette.forest},
});
