import { Text as RNText, type TextProps } from 'react-native';

import { colors, type as typeRamp, type TypeVariant } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: Props) {
  return <RNText {...rest} style={[typeRamp[variant], { color, textAlign: align }, style]} />;
}
