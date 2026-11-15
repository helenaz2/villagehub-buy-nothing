import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useStore } from '@/data/store';
import { palette } from '@/constants/palette';
import { RecommendationChat } from './recommendation-screen';
import { Icon } from './icon';
import { TAB_BODY_HEIGHT } from './tab-bar';

export function FloatingAssistant(){
 const [open,setOpen]=useState(false),[started,setStarted]=useState(false);
 const {me}=useStore();
 const insets=useSafeAreaInsets(),path=usePathname();
 return <View pointerEvents="box-none" style={[s.anchor,{bottom:TAB_BODY_HEIGHT+insets.bottom+12},path!=='/explore' && {display:'none'}]}>
  {started?<View style={[s.panel,!open && {display:'none'}]}>
   <View style={s.header}><View style={{flex:1}}><Text style={s.title}>VillageHub assistant</Text><Text style={s.subtitle}>Find free items nearby</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Minimize VillageHub assistant" onPress={()=>setOpen(false)} style={s.close}><Icon name="close" size={20} /></Pressable></View>
   <RecommendationChat key={me.id} embedded visible={open && path==='/explore'} />
  </View>:null}
  {!open?<Pressable accessibilityRole="button" accessibilityLabel="Open VillageHub assistant" accessibilityHint="Opens a chat panel over Explore" onPress={()=>{setStarted(true);setOpen(true);}} style={s.bubble}><Icon name="chat" size={27} color={palette.white} /></Pressable>:null}
 </View>;
}
const s=StyleSheet.create({
 anchor:{position:'absolute',right:12,left:12,top:70,alignItems:'flex-end',justifyContent:'flex-end',zIndex:10},
 bubble:{width:56,height:56,borderRadius:28,backgroundColor:palette.forest,alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px #00000026'},
 panel:{width:'100%',height:'100%',maxHeight:560,backgroundColor:palette.bg,borderRadius:20,borderWidth:1,borderColor:palette.line,overflow:'hidden',boxShadow:'0 8px 30px #00000026'},
 header:{flexDirection:'row',alignItems:'center',paddingLeft:16,paddingVertical:8,paddingRight:8,borderBottomWidth:1,borderBottomColor:palette.line,backgroundColor:palette.white},
 title:{fontSize:16,fontWeight:'600',color:palette.forest},subtitle:{fontSize:12,color:palette.muted,marginTop:3},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
});
