import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS !== 'web';
const safe = (p: Promise<void>) => void p.catch(() => {});

/** A small vocabulary of haptics, so the same action always feels the same. */
export const haptic = {
  tap: () => on && safe(Haptics.selectionAsync()),
  press: () => on && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  detect: () => on && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
