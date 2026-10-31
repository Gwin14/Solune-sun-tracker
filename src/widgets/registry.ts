/**
 * Native widget handles. This module imports `expo-widgets`, which throws without its native
 * module (Expo Go, web, Android) — require it lazily, only after `supportsWidgets()`.
 */
import { createLiveActivity, createWidget } from 'expo-widgets';

import EventWidget from './EventWidget';
import GoldenWidget from './GoldenWidget';
import LockWidget from './LockWidget';
import MoonWidget from './MoonWidget';
import SkyMomentActivity from './SkyMomentActivity';
import StreakWidget from './StreakWidget';
import SunWidget from './SunWidget';
import type { EventWidgetProps, GoldenWidgetProps, LockWidgetProps, MoonWidgetProps, SkyMomentProps, StreakWidgetProps, SunWidgetProps } from './types';

// Names match the `widgets` entries of the expo-widgets plugin in app.json.
export const widgets = {
  sun: createWidget<SunWidgetProps>('SunWidget', SunWidget),
  moon: createWidget<MoonWidgetProps>('MoonWidget', MoonWidget),
  golden: createWidget<GoldenWidgetProps>('GoldenWidget', GoldenWidget),
  lock: createWidget<LockWidgetProps, { focus?: string }>('LockWidget', LockWidget),
  streak: createWidget<StreakWidgetProps>('StreakWidget', StreakWidget),
  event: createWidget<EventWidgetProps>('EventWidget', EventWidget),
};

export const skyMoment = createLiveActivity<SkyMomentProps>('SkyMoment', SkyMomentActivity);

export { after } from 'expo-widgets';
