import { Text, type TextProps } from 'react-native';

import { type, useTheme, type ColorTokens, type TypeVariant } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: keyof ColorTokens;
  center?: boolean;
};

/** The only text component in the app. Size, face and color always come from tokens. */
export function T({ variant = 'body', color = 'text', center, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.35}
      {...rest}
      style={[type[variant], { color: colors[color] }, center && { textAlign: 'center' }, style]}
    />
  );
}
