import { Divider, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { TonightWidgetProps } from './types';

/** Céu esta noite — the dark-sky window, the Moon's say in it, and the planets worth finding. */
export default function TonightWidget(props: TonightWidgetProps, env: WidgetEnvironment) {
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
  const amber = '#F2BE6E';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );
  const family = env.widgetFamily;
  const max = family === 'systemLarge' ? 6 : 3;
  const rows = props.rows.slice(0, max);

  const head = (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={5}>
        <Image systemName="moon.stars.fill" size={12} color={tinted ? undefined : amber} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{props.darkLabel}</Text>
      </HStack>
      <Text modifiers={[font({ size: family === 'systemSmall' ? 20 : 22, weight: 'light' }), lineLimit(1)]}>{props.dark}</Text>
      <HStack spacing={4}>
        <Image systemName={props.moonSymbol as never} size={11} color={tinted ? undefined : silver} />
        <Text modifiers={[font({ size: 11, weight: 'medium' }), tertiary, lineLimit(1)]}>{props.moon}</Text>
      </HStack>
    </VStack>
  );

  const row = (r: TonightWidgetProps['rows'][number], i: number) => (
    <Link key={r.id} destination={r.url}>
      <VStack alignment="leading" spacing={4}>
        {i ? <Divider /> : null}
        <HStack spacing={7}>
          <Image systemName="circle.fill" size={8} color={tinted ? undefined : r.color} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{r.name}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'medium' }), r.up ? foregroundStyle(tinted ? { type: 'hierarchical', style: 'primary' } : amber) : secondary, lineLimit(1)]}>{r.status}</Text>
        </HStack>
        {family === 'systemLarge' && r.best ? (
          <HStack>
            <Spacer />
            <Text modifiers={[font({ size: 11 }), tertiary, lineLimit(1)]}>{r.best}</Text>
          </HStack>
        ) : null}
      </VStack>
    </Link>
  );

  const empty = <Text modifiers={[font({ size: 12 }), secondary, lineLimit(2)]}>{props.labels.empty}</Text>;

  if (family === 'systemSmall') {
    const first = props.rows[0];
    return (
      <VStack alignment="leading" spacing={4} modifiers={[background, widgetURL('solune://sky')]}>
        {head}
        <Spacer />
        {first ? (
          <VStack alignment="leading" spacing={1}>
            <HStack spacing={5}>
              <Image systemName="circle.fill" size={7} color={tinted ? undefined : first.color} />
              <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{first.name}</Text>
            </HStack>
            <Text modifiers={[font({ size: 11, weight: 'medium' }), secondary, lineLimit(1)]}>{first.up ? first.status : first.best || first.status}</Text>
          </VStack>
        ) : (
          empty
        )}
      </VStack>
    );
  }

  if (family === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[background, widgetURL('solune://sky')]}>
        <VStack alignment="leading" spacing={0} modifiers={[frame({ width: 120, alignment: 'leading' })]}>
          {head}
          <Spacer />
        </VStack>
        <VStack alignment="leading" spacing={6}>
          {rows.length ? rows.map(row) : empty}
          <Spacer />
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={12} modifiers={[background, widgetURL('solune://sky')]}>
      <HStack>
        {head}
        <Spacer />
      </HStack>
      <Divider />
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), tertiary]}>{props.labels.title}</Text>
      <VStack alignment="leading" spacing={8}>{rows.length ? rows.map(row) : empty}</VStack>
      <Spacer />
    </VStack>
  );
}
