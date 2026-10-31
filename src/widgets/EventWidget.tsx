import { Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { EventWidgetProps } from './types';

/** Próximo evento — eclipses, superluas, solstícios e chuvas de meteoros, com a contagem de dias. */
export default function EventWidget(props: EventWidgetProps, env: WidgetEnvironment) {
  'widget';
  const silver = '#CBD2F2';
  const amber = '#F2BE6E';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );

  const lead = (
    <VStack alignment="leading" spacing={3}>
      <HStack spacing={5}>
        <Image systemName={props.symbol as never} size={13} color={tinted ? undefined : silver} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{props.daysLabel}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'medium' }), tertiary]}>{props.date}</Text>
      </HStack>
      <Text modifiers={[font({ size: 16, weight: 'semibold' }), lineLimit(2)]}>{props.title}</Text>
      <HStack spacing={4}>
        {props.visible ? <Image systemName="eye.fill" size={10} color={tinted ? undefined : amber} /> : null}
        <Text modifiers={[font({ size: 12 }), secondary, lineLimit(2)]}>{props.subtitle}</Text>
      </HStack>
    </VStack>
  );

  if (env.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[background, widgetURL('solune://events')]}>
        {lead}
        <VStack alignment="leading" spacing={6}>
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), tertiary]}>Depois</Text>
          {props.following.map((e, i) => (
            <VStack key={i} alignment="leading" spacing={1}>
              {i ? <Divider /> : null}
              <Text modifiers={[font({ size: 12, weight: 'medium' }), lineLimit(1)]}>{e.title}</Text>
              <Text modifiers={[font({ size: 11 }), tertiary]}>{e.date}</Text>
            </VStack>
          ))}
          <Spacer />
        </VStack>
      </HStack>
    );
  }

  return <VStack modifiers={[background, widgetURL('solune://events')]}>{lead}<Spacer /></VStack>;
}
