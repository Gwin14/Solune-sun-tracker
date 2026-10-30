import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** SF Symbols on iOS, Material Symbols on Android and web — one family per platform. */
const ICONS = {
  sun: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  sunOutline: { ios: 'sun.max', android: 'light_mode', web: 'light_mode' },
  sunrise: { ios: 'sunrise.fill', android: 'wb_twilight', web: 'wb_twilight' },
  sunset: { ios: 'sunset.fill', android: 'wb_twilight', web: 'wb_twilight' },
  sunHorizon: { ios: 'sun.horizon.fill', android: 'routine', web: 'routine' },
  moon: { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' },
  moonFull: { ios: 'circle.fill', android: 'circle', web: 'circle' },
  moonPhase: { ios: 'moonphase.waxing.gibbous', android: 'brightness_4', web: 'brightness_4' },
  moonrise: { ios: 'moon.haze.fill', android: 'bedtime', web: 'bedtime' },
  stars: { ios: 'moon.stars.fill', android: 'nights_stay', web: 'nights_stay' },
  sparkle: { ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' },
  viewfinder: { ios: 'camera.viewfinder', android: 'view_in_ar', web: 'view_in_ar' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  journal: { ios: 'book.closed.fill', android: 'auto_stories', web: 'auto_stories' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  location: { ios: 'location.fill', android: 'near_me', web: 'near_me' },
  pin: { ios: 'mappin', android: 'location_on', web: 'location_on' },
  globe: { ios: 'globe.americas.fill', android: 'public', web: 'public' },
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  compass: { ios: 'location.north.line.fill', android: 'explore', web: 'explore' },
  arrowUp: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  hourglass: { ios: 'hourglass', android: 'hourglass_top', web: 'hourglass_top' },
  ruler: { ios: 'ruler.fill', android: 'straighten', web: 'straighten' },
  eye: { ios: 'eye.fill', android: 'visibility', web: 'visibility' },
  orbit: { ios: 'circle.dotted.circle', android: 'motion_photos_on', web: 'motion_photos_on' },
  eclipse: { ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' },
  meteor: { ios: 'sparkles', android: 'flare', web: 'flare' },
  leaf: { ios: 'leaf.fill', android: 'eco', web: 'eco' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  heart: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  telescope: { ios: 'binoculars.fill', android: 'travel_explore', web: 'travel_explore' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  hand: { ios: 'hand.draw.fill', android: 'swipe', web: 'swipe' },
  arrowCounter: { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' },
  layers: { ios: 'square.3.layers.3d', android: 'layers', web: 'layers' },
  info: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  thermometer: { ios: 'thermometer.sun.fill', android: 'thermostat', web: 'thermostat' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
} as const satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color = colors.text, weight = 'semibold', style }: Props) {
  return (
    <SymbolView
      name={ICONS[name] as SymbolName}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
    />
  );
}
