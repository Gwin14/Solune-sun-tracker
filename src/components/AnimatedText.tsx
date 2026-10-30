import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

import { colors, type as typeRamp, type TypeVariant } from '@/theme/tokens';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  text: SharedValue<string>;
  variant?: TypeVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/** Text driven from the UI thread (scrubbers, live readouts) with no React re-render. */
export function AnimatedText({ text, variant = 'body', color = colors.text, style }: Props) {
  const animatedProps = useAnimatedProps(() => ({ text: text.get(), defaultValue: text.get() }) as never);
  return (
    <AnimatedInput
      underlineColorAndroid="transparent"
      editable={false}
      pointerEvents="none"
      defaultValue={text.get()}
      animatedProps={animatedProps}
      style={[typeRamp[variant], styles.reset, { color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  reset: { padding: 0, margin: 0, borderWidth: 0 },
});
