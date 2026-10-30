import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { POP, PRESS_IN, SNAP } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Hoje', icon: 'sun' },
  moon: { label: 'Lua', icon: 'moon' },
  events: { label: 'Eventos', icon: 'calendar' },
  journal: { label: 'Diário', icon: 'flame' },
};

export const TAB_BAR_HEIGHT = 66;

export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, space.sm) + space.xl;
}

function TabItem({ focused, label, icon, onPress }: { focused: boolean; label: string; icon: IconName; onPress: () => void }) {
  const bounce = useSharedValue(1);
  const active = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    active.set(withTiming(focused ? 1 : 0, { duration: 180 }));
    if (focused) bounce.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, POP)));
  }, [focused, active, bounce]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.get() }, { translateY: -active.get() * 1 }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: active.get(), transform: [{ scale: 0.7 + active.get() * 0.3 }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.item}>
      <Animated.View style={[styles.activePill, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={21} color={focused ? colors.accent : colors.textSecondary} />
      </Animated.View>
      <Text variant="caption" color={focused ? colors.text : colors.textTertiary} style={{ fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ArButton() {
  const depth = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: depth.get() * 4 }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir céu em realidade aumentada"
      onPressIn={() => depth.set(withTiming(1, PRESS_IN))}
      onPressOut={() => depth.set(withSpring(0, SNAP))}
      onPress={() => {
        haptic.medium();
        router.push('/ar');
      }}
      style={styles.arWrap}>
      <View style={styles.arLip} />
      <Animated.View style={[styles.arFace, face]}>
        <Icon name="viewfinder" size={24} color={colors.textOnAccent} weight="bold" />
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const render = (route: (typeof routes)[number]) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = index === state.index;
    const meta = TABS[route.name];
    return (
      <TabItem
        key={route.key}
        focused={focused}
        label={meta.label}
        icon={meta.icon}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic.tick();
            navigateToTab(route.key);
          }
        }}
      />
    );
  };
  void descriptors;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 6, space.sm) }]}>
      <View style={styles.bar}>
        {process.env.EXPO_OS === 'android' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,14,40,0.92)' }]} />
        ) : (
          <BlurView intensity={50} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,34,0.35)' }]} />
        {left.map(render)}
        <View style={{ width: 72 }} />
        {right.map(render)}
      </View>
      <ArButton />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: 520,
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: space.xs,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  activePill: {
    position: 'absolute',
    width: 58,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  arWrap: { position: 'absolute', top: -14, width: 64, height: 68, alignSelf: 'center' },
  arLip: { position: 'absolute', top: 4, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentDeep },
  arFace: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,240,210,0.55)',
  },
});
