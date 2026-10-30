import * as Haptics from 'expo-haptics';

import { useApp } from '@/store/app';

const enabled = () => process.env.EXPO_OS !== 'web' && useApp.getState().haptics;

export const haptic = {
  tick: () => {
    if (enabled()) Haptics.selectionAsync().catch(() => {});
  },
  light: () => {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  soft: () => {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  },
  medium: () => {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success: () => {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning: () => {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
