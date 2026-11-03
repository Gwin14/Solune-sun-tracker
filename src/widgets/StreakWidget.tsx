import { Circle, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, strokeBorder, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { StreakWidgetProps } from './types';

/** Diário — the sky-watching streak, the last seven days and the level. Opens the journal. */
export default function StreakWidget(props: StreakWidgetProps, env: WidgetEnvironment) {
  'widget';
  if (props.locked) {
    return (
      <VStack spacing={8} modifiers={[containerBackground({ type: 'color', color: '#0B1029' }, 'widget'), widgetURL('solune://paywall')]}>
        <Image systemName="lock.fill" size={22} color="#F2BE6E" />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(3)]}>{props.locked}</Text>
      </VStack>
    );
  }
  const amber = '#F2BE6E';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );

  const week = (dot: number, gap: number) => (
    <HStack spacing={gap}>
      {props.week.map((v, i) => (
        <VStack key={i} spacing={4}>
          {v ? (
            <Circle modifiers={[frame({ width: dot, height: dot }), foregroundStyle(tinted ? { type: 'hierarchical', style: 'primary' } : amber)]} />
          ) : i === props.week.length - 1 ? (
            <Circle modifiers={[frame({ width: dot, height: dot }), foregroundStyle('#00000000'), strokeBorder({ content: tinted ? '#FFFFFF' : amber, style: { lineWidth: 1.5 } })]} />
          ) : (
            <Circle modifiers={[frame({ width: dot, height: dot }), foregroundStyle({ type: 'hierarchical', style: 'quaternary' })]} />
          )}
          <Text modifiers={[font({ size: 9, weight: 'medium' }), tertiary]}>{props.letters[i]}</Text>
        </VStack>
      ))}
    </HStack>
  );

  if (env.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[background, widgetURL('solune://journal')]}>
        <VStack alignment="leading" spacing={2}>
          <HStack spacing={4}>
            <Image systemName="flame.fill" size={12} color={tinted ? undefined : amber} />
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{props.labels.title}</Text>
          </HStack>
          <Spacer />
          <HStack alignment="lastTextBaseline" spacing={4}>
            <Text modifiers={[font({ size: 44, weight: 'light' })]}>{String(props.streak)}</Text>
            <Text modifiers={[font({ size: 15, weight: 'medium' }), secondary]}>{props.labels.days}</Text>
          </HStack>
          <Text modifiers={[font({ size: 12, weight: 'medium' }), tertiary, lineLimit(1)]}>{props.hint}</Text>
        </VStack>
        <VStack alignment="leading" spacing={10}>
          {week(10, 8)}
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary, lineLimit(1)]}>{props.level}</Text>
          <ProgressView value={props.progress} modifiers={[tint(amber)]} />
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={2} modifiers={[background, widgetURL('solune://journal')]}>
      <HStack spacing={4}>
        <Image systemName="flame.fill" size={12} color={tinted ? undefined : amber} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary]}>{props.labels.title}</Text>
      </HStack>
      <Spacer />
      <HStack alignment="lastTextBaseline" spacing={4}>
        <Text modifiers={[font({ size: 40, weight: 'light' })]}>{String(props.streak)}</Text>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), secondary]}>{props.labels.days}</Text>
      </HStack>
      <Spacer />
      {week(7, 5)}
    </VStack>
  );
}
