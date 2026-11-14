import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Photo } from '@/components/Photo';
import { T } from '@/components/T';
import { PHOTO, unsplash } from '@/data/seed/photos';
import { useStore } from '@/data/store';
import { radius, space, useTheme } from '@/theme';

const PAGES = [
  {
    photo: PHOTO.sofaGray,
    title: 'Point your camera at it.',
    body: 'Curbside recognizes the item and writes the whole listing. You check it over and publish.',
  },
  {
    photo: PHOTO.desk,
    title: 'A neighbor claims it.',
    body: 'Agree on a time in chat. Your address stays private until you confirm who is coming.',
  },
  {
    photo: PHOTO.brokenChair,
    title: 'Not worth passing on?',
    body: 'We find the nearest place that will do the most good with it, and say plainly when the only option is the dump.',
  },
] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const finish = useStore((s) => s.finishOnboarding);
  const last = page === PAGES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (!last) {
      scroller.current?.scrollTo({ x: width * (page + 1), animated: true });
      return;
    }
    finish();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={32}>
        {PAGES.map((p, i) => (
          <View key={p.title} style={{ width }}>
            {/* Each photo sits differently on the page so the three screens do not read as a template. */}
            <Photo
              uri={unsplash(p.photo)}
              rounded={i === 0 ? 0 : radius.photo}
              style={{
                height: height * (i === 1 ? 0.44 : 0.5),
                marginTop: i === 0 ? 0 : insets.top + space.lg,
                marginLeft: i === 1 ? space.gutter : i === 2 ? space.section : 0,
                marginRight: i === 2 ? 0 : i === 1 ? space.section : 0,
              }}
            />
            <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.sm }}>
              <T variant="display" accessibilityRole="header">
                {p.title}
              </T>
              <T color="textSoft" style={{ maxWidth: 340 }}>
                {p.body}
              </T>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.pips} accessibilityLabel={`Step ${page + 1} of ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <View
              key={p.title}
              style={{
                height: 4,
                width: i === page ? 28 : 10,
                borderRadius: 2,
                backgroundColor: i === page ? colors.text : colors.line,
              }}
            />
          ))}
        </View>
        <Button label={last ? 'Open the camera' : 'Next'} onPress={next} style={{ minWidth: 170 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
  },
  pips: { flexDirection: 'row', gap: 6, alignItems: 'center' },
});
