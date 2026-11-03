import { AccessoryWidgetBackground, Gauge, HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, gaugeStyle, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { LockWidgetProps } from './types';

type LockConfiguration = { focus?: string };

/**
 * Céu no bloqueio — Lock Screen and StandBy accessories. The user picks what it follows
 * (sun, moon or golden hour) when editing the widget.
 */
export default function LockWidget(props: LockWidgetProps, env: WidgetEnvironment<LockConfiguration>) {
  'widget';
  const focus = env.configuration?.focus ?? 'sun';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const family = env.widgetFamily;
  const url = focus === 'moon' ? 'solune://moon' : 'solune://';

  if (family === 'accessoryInline') {
    if (focus === 'moon') {
      return (
        <HStack modifiers={[widgetURL(url)]}>
          <Image systemName={props.moon.symbol as never} />
          <Text>{`${props.moon.phase} ${props.moon.illumination}%`}</Text>
        </HStack>
      );
    }
    if (focus === 'golden') {
      return (
        <HStack modifiers={[widgetURL(url)]}>
          <Image systemName="sun.horizon.fill" />
          <Text>{`${props.golden.short} ${props.golden.window}`}</Text>
        </HStack>
      );
    }
    return (
      <HStack modifiers={[widgetURL(url)]}>
        <Image systemName={props.sun.symbol as never} />
        <Text>{`${props.sun.label} ${props.sun.time}`}</Text>
      </HStack>
    );
  }

  if (family === 'accessoryCircular') {
    if (focus === 'moon') {
      return (
        <ZStack modifiers={[widgetURL(url)]}>
          <AccessoryWidgetBackground />
          <VStack spacing={1}>
            <Image systemName={props.moon.symbol as never} size={20} />
            <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{`${props.moon.illumination}%`}</Text>
          </VStack>
        </ZStack>
      );
    }
    if (focus === 'golden') {
      return (
        <ZStack modifiers={[widgetURL(url)]}>
          <AccessoryWidgetBackground />
          <VStack spacing={0}>
            <Image systemName="sun.horizon.fill" size={16} />
            <Text date={new Date(props.golden.at)} dateStyle="timer" modifiers={[font({ size: 11, weight: 'semibold' }), lineLimit(1)]} />
          </VStack>
        </ZStack>
      );
    }
    // Daylight elapsed, from sunrise to sunset.
    return (
      <Gauge value={props.sun.progress} min={0} max={1} modifiers={[gaugeStyle('circular'), widgetURL(url)]} currentValueLabel={<Image systemName="sun.max.fill" size={14} />} />
    );
  }

  // accessoryRectangular
  if (focus === 'moon') {
    return (
      <HStack spacing={8} modifiers={[widgetURL(url)]}>
        <Image systemName={props.moon.symbol as never} size={30} />
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.moon.phase}</Text>
          <Text modifiers={[font({ size: 13 }), secondary, lineLimit(1)]}>{`${props.moon.illumination}% · ${props.moon.next}`}</Text>
        </VStack>
      </HStack>
    );
  }
  if (focus === 'golden') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(url)]}>
        <HStack spacing={4}>
          <Image systemName="sun.horizon.fill" size={12} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{props.golden.label}</Text>
        </HStack>
        <Text modifiers={[font({ size: 20, weight: 'medium' }), lineLimit(1)]}>{props.golden.window}</Text>
        <Text date={new Date(props.golden.at)} dateStyle="relative" modifiers={[font({ size: 13 }), secondary, lineLimit(1)]} />
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={1} modifiers={[widgetURL(url)]}>
      <HStack spacing={4}>
        <Image systemName={props.sun.symbol as never} size={12} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{props.sun.label}</Text>
      </HStack>
      <Text modifiers={[font({ size: 24, weight: 'medium' }), lineLimit(1)]}>{props.sun.time}</Text>
      <Text date={new Date(props.sun.at)} dateStyle="relative" modifiers={[font({ size: 13 }), secondary, lineLimit(1)]} />
    </VStack>
  );
}
