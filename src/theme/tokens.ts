import type { TextStyle } from 'react-native';

/**
 * Solune design tokens.
 *
 * The app is sky-driven: every surface sits on a live sky gradient that follows
 * the sun's altitude, so text is always light and surfaces are translucent.
 * Shape rule: actions are pills, cards are 24, inner tiles are 14, chips are pills.
 * One accent (solar gold). Moon silver is a data color, never an action color.
 */

export const colors = {
  ink: '#060A1C',
  inkRaised: '#0D1330',
  inkSheet: '#11173A',

  text: '#F7F4EE',
  textSecondary: 'rgba(247,244,238,0.68)',
  textTertiary: 'rgba(247,244,238,0.44)',
  textOnAccent: '#2A1704',

  accent: '#FFB648',
  accentPressed: '#E89A2C',
  accentDeep: '#C9781A',
  accentSoft: 'rgba(255,182,72,0.18)',

  moon: '#CDD4F7',
  moonSoft: 'rgba(205,212,247,0.16)',

  golden: '#FF9E4A',
  blue: '#5E7BFF',
  civil: '#7C67D9',
  nautical: '#3F3F9E',
  astro: '#22245E',
  night: '#0B0E2A',
  day: '#8EC3F5',

  danger: '#FF6B6B',

  glass: 'rgba(255,255,255,0.09)',
  glassStrong: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.13)',
  hairline: 'rgba(255,255,255,0.12)',
  scrim: 'rgba(3,5,15,0.55)',
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  tile: 14,
  card: 24,
  pill: 999,
} as const;

export const font = {
  thin: 'Manrope_200ExtraLight',
  light: 'Manrope_300Light',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
} as const;

const num: TextStyle['fontVariant'] = ['tabular-nums'];

export const type = {
  display: { fontFamily: font.thin, fontSize: 84, lineHeight: 92, letterSpacing: -3, fontVariant: num },
  hero: { fontFamily: font.light, fontSize: 56, lineHeight: 62, letterSpacing: -2, fontVariant: num },
  title1: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title2: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  title3: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  headline: { fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.medium, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  subhead: { fontFamily: font.semibold, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  metric: { fontFamily: font.light, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, fontVariant: num },
  metricSmall: { fontFamily: font.medium, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, fontVariant: num },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
