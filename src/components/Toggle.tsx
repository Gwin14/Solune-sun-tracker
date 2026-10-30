import { Switch, type SwitchProps } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * Native switch with the app's tint. The explicit frame keeps the iOS 26 control
 * vertically centred in its row (its intrinsic size no longer matches the measured one).
 */
export function Toggle(props: SwitchProps) {
  return <Switch trackColor={{ true: colors.accent }} {...props} style={[{ height: 31, alignSelf: 'center' }, props.style]} />;
}
