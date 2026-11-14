import { useId, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProposeCategory } from './propose-category';
import { HostRating } from './host-rating';
import { BackButton } from './back-button';
import { ProductGallery } from './product-gallery';
import { Screen } from './screen';
import { Button, Chip } from './ui';
import { palette, serif } from '@/constants/palette';
import { useStore } from '@/data/store';
import { CONDITIONS, type Item } from '@/types/listing';

export function PostEditor({ itemId }: { itemId?: string }) {
  const { items, me, publish, updateItem, ratingFor, categories } = useStore();
  const newPostId = useId();
  const existing = items.find(i => i.id === itemId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [category, setCategory] = useState<Item['category'] | ''>(existing?.category ?? '');
  const [condition, setCondition] = useState<Item['condition'] | ''>(existing?.condition ?? '');
  const [conditionNote, setConditionNote] = useState(existing?.conditionNote ?? '');
  const [neighborhood, setNeighborhood] = useState(existing?.neighborhood ?? me.neighborhood);
  const [city, setCity] = useState(existing?.city ?? me.city);
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [size, setSize] = useState(existing?.size ?? '');
  const [color, setColor] = useState(existing?.color ?? '');
  const [features, setFeatures] = useState(existing?.features.join(', ') ?? '');
  const [materials, setMaterials] = useState(existing?.materials ?? '');
  const [fabric, setFabric] = useState(existing?.fabric ?? '');
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (itemId && (!existing || existing.hostId !== me.id)) return <Screen><Text style={s.title}>You can only edit your own posts.</Text><Button label="Back to profile" onPress={() => router.navigate('/profile')} /></Screen>;
  async function pickPhotos() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, 5 - photos.length), quality: 0.8 });
      if (!result.canceled) setPhotos(current => [...current, ...result.assets.map(a => a.uri)].slice(0,5));
    } catch { setError('Unable to open photos. Please try again.'); }
  }
  const parsedTags = [...new Set(tags.split(',').map(t => t.trim().replace(/^#+/, '')).filter(Boolean))];
  function validate() {
    const missing = [!photos.length && 'at least one photo', !title.trim() && 'a title', !category && 'a category', !condition && 'a condition', !size.trim() && 'size or dimensions', !color.trim() && 'a color', !neighborhood.trim() && 'a neighborhood', !city.trim() && 'a city'].filter(Boolean);
    if (missing.length) { setError('Please add ' + missing.join(', ') + '.'); return false; }
    setError(''); return true;
  }
  function save() {
    if (busy) return;
    if (!validate() || !category || !condition) return;
    setBusy(true);
    const id = existing?.id ?? 'item_' + newPostId;
    const item: Item = { id, title: title.trim(), description: description.trim(), photos, category, condition, conditionNote: conditionNote.trim(), size: size.trim(), color: color.trim(), tags: parsedTags, features: [...new Set(features.split(',').map(f => f.trim()).filter(Boolean))], materials: materials.trim(), fabric: fabric.trim(), neighborhood: neighborhood.trim(), city: city.trim(), distance: existing?.distance ?? 'Nearby', hostId: me.id, status: existing?.status ?? 'available', postedLabel: existing?.postedLabel ?? 'Just now', saves: existing?.saves ?? 0 };
    if (existing) updateItem(id, item); else publish(item);
    if (!existing) { setTitle(''); setDescription(''); setPhotos([]); setTags(''); setConditionNote(''); }
    setBusy(false);
    router.replace({ pathname: '/item', params: { id } });
  }
  function field(label: string, value: string, onChange: (text: string) => void, multiline = false) {
    return <View><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} style={[s.input, multiline && s.multiline]} /></View>;
  }
  if (preview) return <Screen><BackButton label="Back to editing" onPress={() => setPreview(false)} /><Text style={s.title}>Review your post</Text><ProductGallery photos={photos} title={title} />
    <View style={s.section}><Text style={s.title}>{title}</Text><Text style={s.free}>Free</Text><Text style={s.location}>{neighborhood}, {city}</Text><View style={s.chips}>{[category,...parsedTags].filter(Boolean).map((tag,i) => <Text key={i} style={s.tag}>#{tag.replace(/\s+/g, '')}</Text>)}</View></View>
    <View style={s.section}><Text style={s.sectionTitle}>Condition & details</Text><Text style={s.label}>{condition}</Text><Text style={s.muted}>{conditionNote}</Text><Text>Size: {size}</Text><Text>Color: {color}</Text>{materials ? <Text>Materials: {materials}</Text> : null}{fabric ? <Text>Fabric: {fabric}</Text> : null}</View>
    <View style={s.section}><Text style={s.sectionTitle}>About this item</Text><Text style={s.muted}>{description}</Text>{features ? <Text style={s.muted}>{features}</Text> : null}</View>
    <View style={s.section}><Text style={s.sectionTitle}>Posted by</Text><View style={s.host}><Image source={{ uri: me.avatar }} style={s.hostAvatar} /><View><Text style={s.label}>{me.name}</Text><Text style={s.muted}>{me.handle}</Text><HostRating value={ratingFor(me.id)} /><Text style={s.muted}>Member since {me.memberSince}</Text></View></View></View>
    <Text style={s.muted}>Your post will appear in Explore and on your profile. Posts are kept for this demo session.</Text><Button label={existing ? 'Save changes' : 'Publish free post'} disabled={busy} onPress={() => save()} /></Screen>;
  return <Screen keyboard><BackButton label="Cancel" onPress={() => router.navigate(existing ? '/profile' : '/')} /><Text style={s.title}>{existing ? 'Edit your post' : 'Give something a new home'}</Text><Text style={s.muted}>Tell your neighbors what you are sharing. Fields marked * are required.</Text>
  <View style={s.section}><Text style={s.sectionTitle}>1. Show your item</Text><Text style={s.muted}>Add 1-5 photos. The first photo is your cover.</Text>
  <Text style={s.label}>Photos * ({photos.length}/5)</Text><View style={s.photos}>{photos.map((uri,index) => <View key={index} style={s.thumbnail}><Image source={{ uri }} style={s.image} /><Text style={s.photoLabel}>{index === 0 ? 'Cover photo' : 'Photo ' + (index + 1)}</Text>{index > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={'Make photo ' + (index + 1) + ' cover'} onPress={() => setPhotos(current => [current[index], ...current.filter((_,i) => i !== index)])}><Text style={s.link}>Make cover</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel={'Remove photo ' + (index + 1)} onPress={() => setPhotos(current => current.filter((_,i) => i !== index))}><Text style={s.remove}>Remove</Text></Pressable></View>)}</View><Button label="Choose photos" variant="ghost" disabled={photos.length >= 5} onPress={pickPhotos} /></View>
  <View style={s.ai}><Text style={s.sectionTitle}>AI photo autofill</Text><Text style={s.hint}>Coming soon: suggest a title, category, color, and tags from your photos. You will be able to review every suggestion.</Text><Button label="Autofill from photos - Coming soon" disabled variant="ghost" /></View>
  <View style={s.section}><Text style={s.sectionTitle}>2. The essentials</Text>{field('Title *', title, setTitle)}{field('Description (optional)', description, setDescription, true)}<Text style={s.hint}>What is it, what is included, and what makes it useful.</Text>
  <Text style={s.label}>Category *</Text><View style={s.chips}>{categories.map(c => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</View><ProposeCategory onApproved={setCategory} /></View>
  <View style={s.section}><Text style={s.sectionTitle}>3. Condition & details</Text><Text style={s.label}>Condition *</Text><View style={s.chips}>{CONDITIONS.map(c => <Chip key={c} label={c} selected={condition === c} onPress={() => setCondition(c)} />)}</View>
  {field('Condition notes (optional)', conditionNote, setConditionNote, true)}<Text style={s.hint}>Mention scratches, stains, damage, or anything that needs repair.</Text>
  {field('Size or dimensions *', size, setSize)}<Text style={s.hint}>Include units, a clothing size, or Not applicable.</Text>{field('Color *', color, setColor)}{field('Materials (optional)', materials, setMaterials)}{field('Fabric (optional)', fabric, setFabric)}{field('Features (comma separated, optional)', features, setFeatures)}<Text style={s.hint}>For example: solid wood, washable cover, folds flat.</Text></View>
  <View style={s.section}><Text style={s.sectionTitle}>4. Help neighbors find it</Text>{field('Neighborhood *', neighborhood, setNeighborhood)}{field('City *', city, setCity)}<Text style={s.hint}>Share your general pickup area. Arrange the exact address in messages.</Text>{field('Tags (comma separated, optional)', tags, setTags)}<Text style={s.hint}>For example: reading nook, vintage, sage green.</Text><View style={s.chips}>{parsedTags.map(tag => <Text key={tag} style={s.tag}>#{tag.replace(/\s+/g, '')}</Text>)}</View></View>
  <View style={s.section}><Text style={s.sectionTitle}>5. Your host details</Text><Text style={s.muted}>Your profile name, photo, and member information are added automatically.</Text><View style={s.host}><Image source={{ uri: me.avatar }} style={s.hostAvatar} /><View><Text style={s.label}>{me.name}</Text><Text style={s.muted}>{me.handle}</Text><HostRating value={ratingFor(me.id)} /></View></View><Text style={s.free}>Always free</Text><Text style={s.hint}>Neighbors can message you from the post to arrange pickup.</Text></View>
  {error ? <Text accessibilityRole="alert" style={s.remove}>{error}</Text> : null}
  <Button label="Review post" onPress={() => { if (validate()) setPreview(true); }} /></Screen>;

}
const s = StyleSheet.create({
  ai: { borderWidth: 1, borderStyle: 'dashed', borderColor: palette.forest, backgroundColor: palette.forestSoft, borderRadius: 20, padding: 18, gap: 12, marginVertical: 12 },
  section: { backgroundColor: palette.white, borderRadius: 20, padding: 18, marginVertical: 8, borderWidth: 1, borderColor: palette.line, gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: palette.forest, marginBottom: 6 },
  hint: { fontSize: 12, color: palette.muted, lineHeight: 19 },
  free: { color: palette.terracotta, fontSize: 22, fontWeight: '700', marginVertical: 8 },
  location: { color: palette.forest, textDecorationLine: 'underline', fontSize: 13 },
  tag: { fontSize: 11, color: palette.forest, backgroundColor: palette.forestSoft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  host: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hostAvatar: { width: 48, height: 48, borderRadius: 24 },
  photoLabel: { fontSize: 11, color: palette.muted, marginTop: 6 },
  link: { color: palette.forest, textDecorationLine: 'underline', paddingVertical: 8, fontSize: 12 },
  title: { fontFamily: serif, fontSize: 28, color: palette.forest, marginVertical: 20 },
  label: { fontSize: 15, fontWeight: '600', color: palette.ink, marginTop: 16 },
  muted: { color: palette.muted, lineHeight: 21, marginVertical: 12 },
  input: { backgroundColor: palette.white, color: palette.ink, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, minHeight: 48, marginVertical: 8, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 12 },
  thumbnail: { width: 96 }, image: { width: 96, height: 96, borderRadius: 12 },
  remove: { color: palette.danger, paddingVertical: 8 },
});
