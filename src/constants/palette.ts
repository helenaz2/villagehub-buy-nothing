import { Platform } from 'react-native';
export const palette = {
  shell: '#E4DFD6',
  bg: '#F3F0EA',
  card: '#FFFFFF',
  ink: '#1C1B19',
  muted: '#8A847C',
  faint: '#B3ADA4',
  line: '#E5DFD4',
  forest: '#1E3A2F',
  forestSoft: '#E4EFE7',
  sage: '#DCE8DF',
  terracotta: '#C4623A',
  white: '#FFFFFF',
  claimed: '#9A948A',
  danger: '#8E3B32',
} as const;

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
