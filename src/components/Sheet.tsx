import { X } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion, radius, space, touch, useTheme } from '@/theme';

import { ICON_STROKE } from './Button';
import { T } from './T';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Bottom sheet on a spring. Falls back to a plain fade when reduced motion is on. */
export function Sheet({ visible, onClose, title, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(600);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    y.value = reduced ? 0 : 600;
    fade.value = 0;
    y.value = reduced ? 0 : withSpring(0, motion.spring);
    fade.value = withTiming(1, { duration: motion.base });
  }, [visible, reduced, y, fade]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg },
            sheetStyle,
          ]}>
          <View style={styles.head}>
            <T variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </T>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
              hitSlop={8}>
              <X size={22} color={colors.text} strokeWidth={ICON_STROKE} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md, gap: space.sm },
  close: { width: touch.min, height: touch.min, alignItems: 'flex-end', justifyContent: 'flex-start' },
});
