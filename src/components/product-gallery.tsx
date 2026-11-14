import { useRef, useState, type ComponentRef } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/palette';

export function ProductGallery({ photos, title }: { photos: string[]; title: string }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(350);
  const [active, setActive] = useState(0);
  function go(index: number) {
    const next = Math.max(0, Math.min(photos.length - 1, index));
    scroll.current?.scrollTo({ x: next * width, animated: true });
    setActive(next);
  }
  return <View style={s.gallery}>
    <View style={s.viewport} onLayout={event => { const nextWidth = event.nativeEvent.layout.width; if (nextWidth > 0 && nextWidth !== width) { setWidth(nextWidth); scroll.current?.scrollTo({ x: active * nextWidth, animated: false }); } }}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={event => setActive(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))} scrollEventThrottle={32}>
        {photos.map((uri,index) => <Image key={index} source={{ uri }} style={{ width, height: width }} contentFit="cover" accessibilityLabel={title + ', photo ' + (index + 1)} />)}
      </ScrollView>
      <View pointerEvents="none" style={s.counter}><Text style={s.counterText}>{active + 1} / {photos.length}</Text></View>
    </View>
    {photos.length > 1 ? <View style={s.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" disabled={active === 0} onPress={() => go(active - 1)} style={[s.arrow, active === 0 && s.disabled]}><Text style={s.arrowText}>{'\u203a'}</Text></Pressable>
      <View style={s.dots}>{photos.map((_,i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={'Show photo ' + (i + 1)} accessibilityState={{ selected: active === i }} onPress={() => go(i)} style={s.dotTarget}><View style={[s.dot, active === i && s.selected]} /></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next photo" disabled={active === photos.length - 1} onPress={() => go(active + 1)} style={[s.arrow, active === photos.length - 1 && s.disabled]}><Text style={s.arrowText}>{'\u203a'}</Text></Pressable>
    </View> : null}
  </View>;
}
const s = StyleSheet.create({
  gallery: { marginTop: 18, marginBottom: 16 },
  viewport: { overflow: 'hidden', borderRadius: 24, backgroundColor: palette.sage, aspectRatio: 1 },
  counter: { position: 'absolute', bottom: 14, right: 14, backgroundColor: 'rgba(28,27,25,0.7)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  counterText: { color: palette.white, fontSize: 12, fontWeight: '600' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: palette.white },
  arrowText: { fontSize: 26, color: palette.forest }, disabled: { opacity: 0.3 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', flex: 1 }, dotTarget: { width: 28, height: 44, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.faint }, selected: { width: 18, backgroundColor: palette.forest },
});
