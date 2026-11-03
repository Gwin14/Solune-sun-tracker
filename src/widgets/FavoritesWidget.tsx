import { Divider, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, multilineTextAlignment, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { FavoritesWidgetProps } from './types';

/** Favoritos — where each starred object of the planetarium is right now, or when it rises. */
export default function FavoritesWidget(props: FavoritesWidgetProps, env: WidgetEnvironment) {
  'widget';
  const amber = '#F2BE6E';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );
  const family = env.widgetFamily;
  const upStyle = foregroundStyle(tinted ? { type: 'hierarchical', style: 'primary' } : amber);

  if (!props.rows.length) {
    return (
      <VStack spacing={6} modifiers={[background, widgetURL('solune://sky')]}>
        <Image systemName="star" size={24} color={tinted ? undefined : amber} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), multilineTextAlignment('center')]}>{props.labels.emptyTitle}</Text>
        <Text modifiers={[font({ size: 11 }), secondary, multilineTextAlignment('center'), lineLimit(3)]}>{props.labels.emptyBody}</Text>
      </VStack>
    );
  }

  if (family === 'systemSmall') {
    const r = props.rows[0];
    return (
      <VStack alignment="leading" spacing={3} modifiers={[background, widgetURL(r.url)]}>
        <HStack spacing={5}>
          <Image systemName="star.fill" size={11} color={tinted ? undefined : amber} />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{props.labels.title}</Text>
        </HStack>
        <Spacer />
        <Image systemName={r.symbol as never} size={18} color={tinted ? undefined : r.color} />
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), lineLimit(2)]}>{r.name}</Text>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), r.up ? upStyle : secondary, lineLimit(1)]}>{r.status}</Text>
        {r.best ? <Text modifiers={[font({ size: 11 }), tertiary, lineLimit(1)]}>{r.best}</Text> : null}
      </VStack>
    );
  }

  const rows = props.rows.slice(0, family === 'systemLarge' ? 7 : 3);
  return (
    <VStack alignment="leading" spacing={family === 'systemLarge' ? 10 : 6} modifiers={[background, widgetURL('solune://sky')]}>
      <HStack spacing={5}>
        <Image systemName="star.fill" size={11} color={tinted ? undefined : amber} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{props.labels.title}</Text>
      </HStack>
      {rows.map((r, i) => (
        <Link key={r.id} destination={r.url}>
          <VStack alignment="leading" spacing={family === 'systemLarge' ? 8 : 5}>
            {i ? <Divider /> : null}
            <HStack spacing={8}>
              <Image systemName={r.symbol as never} size={12} color={tinted ? undefined : r.color} modifiers={[frame({ width: 16 })]} />
              <VStack alignment="leading" spacing={0}>
                <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{r.name}</Text>
                {family === 'systemLarge' && r.best ? <Text modifiers={[font({ size: 11 }), tertiary, lineLimit(1)]}>{r.best}</Text> : null}
              </VStack>
              <Spacer />
              <Text modifiers={[font({ size: 12, weight: 'medium' }), r.up ? upStyle : secondary, lineLimit(1)]}>{r.status}</Text>
            </HStack>
          </VStack>
        </Link>
      ))}
      <Spacer />
    </VStack>
  );
}
