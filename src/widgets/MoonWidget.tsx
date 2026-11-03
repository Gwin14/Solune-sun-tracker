import { Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { MoonWidgetProps } from './types';

/** Lua — today's phase as the system draws it, with illumination and the next full and new moon. */
export default function MoonWidget(props: MoonWidgetProps, env: WidgetEnvironment) {
  'widget';
  if (props.locked) {
    return (
      <VStack spacing={8} modifiers={[containerBackground({ type: 'color', color: '#0B1029' }, 'widget'), widgetURL('solune://paywall')]}>
        <Image systemName="lock.fill" size={22} color="#F2BE6E" />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(3)]}>{props.locked}</Text>
      </VStack>
    );
  }
  const silver = '#CBD2F2';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );
  const glyph = (size: number) => <Image systemName={props.symbol as never} size={size} color={tinted ? undefined : silver} />;
  const row = (label: string, value: string, hint?: string) => (
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), tertiary]}>{label}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'medium' }), lineLimit(1)]}>{value}</Text>
      {hint ? <Text modifiers={[font({ size: 12 }), tertiary, lineLimit(1)]}>{hint}</Text> : null}
    </HStack>
  );

  if (env.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[background, widgetURL('solune://moon')]}>
        <VStack alignment="leading" spacing={4} modifiers={[frame({ width: 112, alignment: 'leading' })]}>
          {glyph(52)}
          <Spacer />
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>{props.phase}</Text>
          <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>{props.labels.lit}</Text>
        </VStack>
        <VStack alignment="leading" spacing={7}>
          {row(props.labels.rises, props.rise)}
          {row(props.labels.sets, props.set)}
          <Divider />
          {row(props.labels.full, props.nextFull, props.nextFullIn)}
          {row(props.labels.new, props.nextNew, props.nextNewIn)}
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={2} modifiers={[background, widgetURL('solune://moon')]}>
      <HStack>
        {glyph(40)}
        <Spacer />
        <Text modifiers={[font({ size: 20, weight: 'light' })]}>{`${props.illumination}%`}</Text>
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>{props.phase}</Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary, lineLimit(1)]}>{`${props.labels.full} ${props.nextFullIn}`}</Text>
    </VStack>
  );
}
