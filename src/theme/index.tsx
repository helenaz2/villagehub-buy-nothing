import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './tokens';

export * from './tokens';

export type Theme = { colors: ColorTokens; dark: boolean };

export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  return { colors: dark ? darkColors : lightColors, dark };
}
