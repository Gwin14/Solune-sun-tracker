import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';

/** Native tab bar height above the home indicator (it can't be measured, so it is a constant). */
export const TAB_BAR_HEIGHT = 56;

/** Bottom padding that keeps scrolled content clear of the floating native tab bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT + space.lg;
}
