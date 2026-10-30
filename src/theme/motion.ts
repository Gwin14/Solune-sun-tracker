import { Easing } from 'react-native-reanimated';

/** One spring vocabulary for the whole app. */
export const SNAP = { duration: 420, dampingRatio: 1 } as const;
export const SHEET = { duration: 320, dampingRatio: 0.85 } as const;
export const POP = { duration: 520, dampingRatio: 0.62 } as const;

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const PRESS_IN = { duration: 110, easing: EASE_OUT } as const;
