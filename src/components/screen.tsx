import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, Pressable, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { palette } from '@/constants/palette';

import { TAB_BODY_HEIGHT } from './tab-bar';

export function Screen({
  children,
  scroll = true,
  footer,
  overlay,
  tabBar = false,
  keyboard = false,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  overlay?: ReactNode;
  tabBar?: boolean;
  keyboard?: boolean;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const { operationError, dismissOperationError } = useStore();
  const tabSpace = tabBar ? TAB_BODY_HEIGHT : 0;
  const footerSpace = footer ? 84 : 18;
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle, { paddingBottom: tabSpace + footerSpace + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  const phone = (
    <View style={styles.phone}>
      <View style={{ height: insets.top }} />
<>{operationError ? <View style={{ padding: 14, backgroundColor: palette.forestSoft }}><Text accessibilityRole="alert">{operationError}</Text><Pressable accessibilityRole="button" onPress={dismissOperationError}><Text style={{ color: palette.forest, paddingTop: 8 }}>Dismiss</Text></Pressable></View> : null}{body}</>
      {overlay}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>{footer}</View> : null}
    </View>
  );

  return (
    <View style={styles.shell}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.phoneWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {phone}
        </KeyboardAvoidingView>
      ) : (
        phone
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: palette.shell,
  },
  phoneWrap: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: palette.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: palette.bg,
  },
});
