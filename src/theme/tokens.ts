import type { TextStyle } from 'react-native';

/**
 * Solune design tokens.
 *
 * The app is sky-driven: every surface sits on a live sky gradient that follows
 * the sun's altitude, so text is always light and surfaces are translucent.
 * Shape rule: actions are pills, cards are 22, inner tiles are 12, chips are pills.
 * Neutrals carry the interface. One accent (sunlight amber) is spent on solar data
 * and the active state; primary actions are a quiet near-white, like the system's.
 * Moon silver is a data color, never an action color.
 */

export const colors = {
  ink: '#05081A',
  inkRaised: '#0B1029',
  inkSheet: '#0E1330',

  text: '#F6F5F2',
  textSecondary: 'rgba(246,245,242,0.62)',
  textTertiary: 'rgba(246,245,242,0.38)',

  primary: '#F6F5F2',
  onPrimary: '#0A0E24',

  accent: '#F2BE6E',
  accentSoft: 'rgba(242,190,110,0.16)',
  textOnAccent: '#1E1405',

  moon: '#CBD2F2',
  moonSoft: 'rgba(203,210,242,0.14)',

  golden: '#F0A35E',
  blue: '#6D86F2',
  civil: '#7767C9',
  nautical: '#3E3F95',
  astro: '#22245A',
  night: '#0A0D26',
  day: '#9DC6EE',

  danger: '#FF6B6B',

  fill: 'rgba(255,255,255,0.08)',
  fillStrong: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.08)',
  hairline: 'rgba(255,255,255,0.10)',
  scrim: 'rgba(2,4,14,0.6)',
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
  tile: 12,
  card: 22,
  pill: 999,
} as const;

/** System font (SF Pro on iOS, Roboto on Android) — weights only. */
export const weight = {
  thin: '200',
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

const num: TextStyle['fontVariant'] = ['tabular-nums'];

export const type = {
  display: { fontWeight: weight.thin, fontSize: 88, lineHeight: 96, letterSpacing: -2.5, fontVariant: num },
  hero: { fontWeight: weight.thin, fontSize: 60, lineHeight: 66, letterSpacing: -1.5, fontVariant: num },
  largeTitle: { fontWeight: weight.bold, fontSize: 34, lineHeight: 41, letterSpacing: 0.37 },
  title1: { fontWeight: weight.bold, fontSize: 28, lineHeight: 34, letterSpacing: 0.36 },
  title2: { fontWeight: weight.semibold, fontSize: 22, lineHeight: 28, letterSpacing: 0.35 },
  title3: { fontWeight: weight.semibold, fontSize: 20, lineHeight: 25, letterSpacing: 0.38 },
  headline: { fontWeight: weight.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  body: { fontWeight: weight.regular, fontSize: 17, lineHeight: 24, letterSpacing: -0.41 },
  callout: { fontWeight: weight.regular, fontSize: 16, lineHeight: 21, letterSpacing: -0.32 },
  subhead: { fontWeight: weight.regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.24 },
  footnote: { fontWeight: weight.regular, fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  caption: { fontWeight: weight.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  label: { fontWeight: weight.semibold, fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  metric: { fontWeight: weight.light, fontSize: 34, lineHeight: 40, letterSpacing: -0.5, fontVariant: num },
  metricSmall: { fontWeight: weight.regular, fontSize: 20, lineHeight: 25, letterSpacing: -0.2, fontVariant: num },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
