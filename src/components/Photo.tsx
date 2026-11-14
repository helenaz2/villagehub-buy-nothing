import { Image } from 'expo-image';
import { Armchair } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  uri: string | undefined;
  style?: StyleProp<ViewStyle>;
  /** Describes the photo for screen readers. */
  label?: string;
  rounded?: number;
  priority?: 'high' | 'normal';
};

/**
 * Item photo with a warm placeholder. While loading, and if the photo is
 * missing or the phone is offline, the frame stays sand-colored instead of
 * collapsing or flashing white.
 */
export function Photo({ uri, style, label, rounded = 0, priority = 'normal' }: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={[{ backgroundColor: colors.sand, borderRadius: rounded, overflow: 'hidden' }, style]}
      accessible={!!label}
      accessibilityRole="image"
      accessibilityLabel={label}>
      {failed || !uri ? (
        <View style={styles.fallback}>
          <Armchair size={36} color={colors.textFaint} strokeWidth={1.25} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          cachePolicy="disk"
          priority={priority}
          recyclingKey={uri}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
