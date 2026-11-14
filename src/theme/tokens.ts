/**
 * Design tokens. Every color, size and font in the app comes from here.
 * Light and dark share the same warmth: dark is a deep brown-black, never #000.
 */

export const palette = {
  paper: '#F4EFE6',
  paperRaised: '#FBF8F2',
  paperSunk: '#EAE3D5',
  forest: '#1E3B2F',
  forestSoft: '#4A5F54',
  forestFaint: '#6F7D73',
  terracotta: '#C4573A',
  terracottaDeep: '#A3432A',
  sage: '#A9B8A0',
  sageSoft: '#DDE4D4',
  sand: '#E3D8C3',
  rule: '#D8CFBD',
  night: '#1C1A16',
  nightRaised: '#27241E',
  nightSunk: '#151310',
  cream: '#EDE6D6',
  creamSoft: '#BDB6A4',
  creamFaint: '#938D7D',
  sageBright: '#C3D6B9',
  clay: '#E28466',
  nightRule: '#3B372E',
} as const;

export type ColorTokens = {
  bg: string;
  surface: string;
  sunk: string;
  text: string;
  textSoft: string;
  textFaint: string;
  line: string;
  /** Primary action fill and the text that sits on it. */
  action: string;
  onAction: string;
  /** Terracotta. Used for a few key moments only. */
  accent: string;
  accentText: string;
  sage: string;
  sageSoft: string;
  sand: string;
  scrim: string;
};

export const lightColors: ColorTokens = {
  bg: palette.paper,
  surface: palette.paperRaised,
  sunk: palette.paperSunk,
  text: palette.forest,
  textSoft: palette.forestSoft,
  textFaint: palette.forestFaint,
  line: palette.rule,
  action: palette.forest,
  onAction: palette.paper,
  accent: palette.terracotta,
  accentText: palette.terracottaDeep,
  sage: palette.sage,
  sageSoft: palette.sageSoft,
  sand: palette.sand,
  scrim: 'rgba(30, 40, 33, 0.45)',
};

export const darkColors: ColorTokens = {
  bg: palette.night,
  surface: palette.nightRaised,
  sunk: palette.nightSunk,
  text: palette.cream,
  textSoft: palette.creamSoft,
  textFaint: palette.creamFaint,
  line: palette.nightRule,
  action: palette.sageBright,
  onAction: '#16261E',
  accent: palette.clay,
  accentText: palette.clay,
  sage: '#73866B',
  sageSoft: '#2F372B',
  sand: '#3A3428',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  gutter: 20,
  lg: 24,
  xl: 32,
  xxl: 44,
  section: 56,
} as const;

export const radius = {
  photo: 6,
  control: 12,
  sheet: 22,
  pill: 999,
} as const;

export const fonts = {
  serif: 'Fraunces_500Medium',
  serifBold: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_400Regular_Italic',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansBold: 'InstrumentSans_600SemiBold',
} as const;

/** Type scale: 13, 15, 17, 20, 25, 32, 40. Large serif sizes get tighter tracking. */
export const type = {
  display: { fontFamily: fonts.serifBold, fontSize: 40, lineHeight: 43, letterSpacing: -1 },
  title: { fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.7 },
  heading: { fontFamily: fonts.serif, fontSize: 25, lineHeight: 30, letterSpacing: -0.4 },
  subhead: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  quote: { fontFamily: fonts.serifItalic, fontSize: 20, lineHeight: 28, letterSpacing: -0.1 },
  body: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 26, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.sansBold, fontSize: 17, lineHeight: 26, letterSpacing: 0 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  labelStrong: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
} as const;

export type TypeVariant = keyof typeof type;

export const touch = { min: 44 } as const;

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
  quick: 160,
  base: 240,
} as const;
