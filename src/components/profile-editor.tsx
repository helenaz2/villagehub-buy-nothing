import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { backendConfig } from '@/lib/backend-config';
import { saveProfilePhoto } from '@/services/profile-photos';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { useStore } from '@/data/store';
import { useAuth } from '@/data/auth';
import { fetchAddress, fetchProfile, saveProfile, saveStreet } from '@/services/profiles';
import { palette } from '@/constants/palette';
import { US_STATES } from '@/constants/us-states';
import { BackButton } from './back-button';
import { StateDropdown } from './state-dropdown';
import { Screen } from './screen';
import { Button } from './ui';

export function ProfileEditor() {
  const auth=useAuth();
  return <ProfileForm key={auth.session?.user.id??'signed-out'} />;
}
function ProfileForm() {
  const auth = useAuth();
  const { retry } = useStore();
  const id = auth.session?.user.id;
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [street, setStreet] = useState('');
  const [bio, setBio] = useState('');
  const [avatar,setAvatar]=useState('');
  const [selectedPhoto,setSelectedPhoto]=useState('');
  const [picking,setPicking]=useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    let active = true;
    void Promise.all([fetchProfile(id), fetchAddress(id)]).then(([p, address]) => {
      if (!active) return;
      setName(p?.name ?? ''); setCity(p?.city ?? ''); setState(p?.state ?? ''); setStreet(address); setBio(p?.bio ?? '');setAvatar(p?.avatar??''); setBusy(false);
    }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Unable to load profile'); setBusy(false); } });
    return () => { active = false; };
  }, [id]);
  async function choosePhoto(){
    if(busy||picking)return;setPicking(true);setError('');
    try{
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
      if(result.canceled)return;
      const asset=result.assets[0];
      const context=ImageManipulator.manipulate(asset.uri);
      context.resize(asset.width>=asset.height?{width:512}:{height:512});
      const rendered=await context.renderAsync();
      const photo=await rendered.saveAsync({format:SaveFormat.JPEG,compress:0.8});
      setSelectedPhoto(photo.uri);
    }catch{setError('Unable to open or prepare this photo. Please try another image.');}
    finally{setPicking(false);}
  }
  async function save() {
    if (busy || picking || !id) return;
    if(selectedPhoto&&!backendConfig.profilePhotos){setError('Photo uploads need the reviewed backend setup first. Your photo is only a preview.');return;}
    if (!name.trim() || !city.trim() || !US_STATES.some(s => s === state)) { setError('Name, city, and state are required.'); return; }
    setBusy(true); setError('');
    try { await saveProfile(id, { name, city, state, bio }); await saveStreet(id, street);if(selectedPhoto)await saveProfilePhoto(id,selectedPhoto); retry(); router.replace('/profile'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save profile'); }
    finally { setBusy(false); }
  }
  return <Screen keyboard><BackButton /><Text style={s.title}>Your profile</Text><Text>Street is optional and visible only to you.</Text>
    <View style={{alignItems:'center',gap:10,marginVertical:20}}>{selectedPhoto||avatar?<Image source={{uri:selectedPhoto||avatar}} style={{width:96,height:96,borderRadius:48}} contentFit="cover" />:<View style={{width:96,height:96,borderRadius:48,backgroundColor:palette.sage,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:30,color:palette.forest}}>{name.trim().slice(0,1).toUpperCase()}</Text></View>}<Button label={picking?'Preparing photo...':'Change profile photo'} variant="ghost" disabled={busy||picking} onPress={()=>{void choosePhoto();}} />{selectedPhoto?<Button label="Undo photo change" variant="ghost" disabled={busy||picking} onPress={()=>setSelectedPhoto('')} />:null}{!backendConfig.profilePhotos?<Text style={{fontSize:12,color:palette.muted,textAlign:'center'}}>Photo preview is available. Saving photos awaits backend approval.</Text>:null}</View>
    {[['Name *',name,setName],['City *',city,setCity],['Street (optional)',street,setStreet],['Bio',bio,setBio]].map(([label,value,onChange]) => <View key={label as string}><Text style={s.label}>{label as string}</Text><TextInput accessibilityLabel={label as string} style={s.input} value={value as string} onChangeText={onChange as (text: string) => void} editable={!busy} /></View>)}
    <StateDropdown value={state} onChange={setState} />{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Button label={busy ? 'Please wait...' : 'Save profile'} disabled={busy||picking||(!!selectedPhoto&&!backendConfig.profilePhotos)} onPress={() => { void save(); }} />
  </Screen>;
}
const s = StyleSheet.create({ title: { fontSize: 26, color: palette.forest, marginVertical: 20 }, label: { fontSize: 14, marginTop: 16, color: palette.ink }, input: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 14, marginVertical: 8, color: palette.ink }, error: { color: palette.danger, marginVertical: 12 } });
