import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { GoldenWidgetProps } from './types';

/** Horas mágicas — the next golden hour, counting down; during it, a bar that fills on its own. */
export default function GoldenWidget(props: GoldenWidgetProps, env: WidgetEnvironment) {
  'widget';
  if (props.locked) {
    return (
      <VStack spacing={8} modifiers={[containerBackground({ type: 'color', color: '#0B1029' }, 'widget'), widgetURL('solune://paywall')]}>
        <Image systemName="lock.fill" size={22} color="#F2BE6E" />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(3)]}>{props.locked}</Text>
      </VStack>
    );
  }
  const amber = '#F0A35E';
  const blue = '#8FA6F0';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );
  const now = Date.now();
  const active = now >= props.startAt && now < props.endAt;

  const status = active ? (
    <VStack alignment="leading" spacing={4}>
      <ProgressView timerInterval={{ lower: new Date(props.startAt), upper: new Date(props.endAt) }} countsDown={false} modifiers={[tint(amber)]} />
      <HStack spacing={3}>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>{props.labels.endsIn}</Text>
        <Text date={new Date(props.endAt)} dateStyle="relative" modifiers={[font({ size: 12, weight: 'medium' }), secondary, lineLimit(1)]} />
      </HStack>
    </VStack>
  ) : props.startAt > now ? (
    <HStack spacing={3}>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>{props.labels.startsIn}</Text>
      <Text date={new Date(props.startAt)} dateStyle="relative" modifiers={[font({ size: 12, weight: 'medium' }), secondary, lineLimit(1)]} />
    </HStack>
  ) : (
    <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>{`${props.labels.tomorrow} ${props.morningWindow}`}</Text>
  );

  const block = (label: string, value: string, color: string, symbol: string) => (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={4}>
        <Image systemName={symbol as never} size={11} color={tinted ? undefined : color} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{label}</Text>
      </HStack>
      <Text modifiers={[font({ size: 17, weight: 'medium' }), lineLimit(1)]}>{value}</Text>
    </VStack>
  );

  if (env.widgetFamily === 'systemMedium') {
    return (
      <VStack alignment="leading" spacing={10} modifiers={[background, widgetURL('solune://')]}>
        <HStack>
          <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.labels.title}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'medium' }), tertiary, lineLimit(1)]}>{props.place}</Text>
        </HStack>
        <HStack spacing={18}>
          {block(props.labels.golden, props.window, amber, 'sun.horizon.fill')}
          {block(props.labels.blue, props.blueWindow, blue, 'moon.haze.fill')}
          <Spacer />
        </HStack>
        <Spacer />
        {status}
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={3} modifiers={[background, widgetURL('solune://')]}>
      <HStack spacing={5}>
        <Image systemName="sun.horizon.fill" size={12} color={tinted ? undefined : amber} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary, lineLimit(1)]}>{props.title}</Text>
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: 22, weight: 'light' }), lineLimit(1)]}>{props.window}</Text>
      {status}
    </VStack>
  );
}
