import { useIsFocused } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * Native tabs mount every tab at launch. A tab wrapped here renders a plain night backdrop
 * until it is first opened, so launch only pays for the screen the user is looking at.
 * Once mounted it stays mounted, keeping its state and scroll position.
 */
export function lazyTab(Screen: ComponentType, backdrop: string = colors.ink) {
  return function LazyTab() {
    const focused = useIsFocused();
    const [ready, setReady] = useState(focused);
    if (focused && !ready) setReady(true);
    return ready ? <Screen /> : <View style={{ flex: 1, backgroundColor: backdrop }} />;
  };
}
