import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Softens content as it scrolls under the status bar and Dynamic Island. */
export function TopFade() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(5,8,26,0.55)', 'rgba(5,8,26,0)']}
      style={[styles.fade, { height: insets.top + 24 }]}
    />
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
