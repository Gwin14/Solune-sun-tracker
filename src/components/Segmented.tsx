import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { SNAP } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

import { Text } from './Text';

/** Segmented control with a sliding thumb, mirroring the iOS control's timing and haptic. */
export function Segmented({ options, index, onChange }: { options: string[]; index: number; onChange: (i: number) => void }) {
  const [width, setWidth] = useState(0);
  const seg = width / options.length;
  const thumb = useAnimatedStyle(() => ({ width: seg - 4, transform: [{ translateX: withSpring(index * seg + 2, SNAP) }] }));
  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {width ? <Animated.View style={[styles.thumb, thumb]} /> : null}
      {options.map((o, i) => (
        <Pressable
          key={o}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === index }}
          onPress={() => {
            if (i === index) return;
            haptic.tick();
            onChange(i);
          }}
          style={styles.item}>
          <Text variant="subhead" color={i === index ? colors.textOnAccent : colors.text}>
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: 36, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)' },
  thumb: { position: 'absolute', top: 2, bottom: 2, left: 0, borderRadius: radius.pill, backgroundColor: colors.accent },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
