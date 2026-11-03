import { Chart, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { SunWidgetProps } from './types';

/**
 * Sol — the next sunrise or sunset at a glance, and the shape of the whole day on larger sizes.
 * Runs in the widget runtime: everything it needs is declared inside the function.
 */
export default function SunWidget(props: SunWidgetProps, env: WidgetEnvironment) {
  'widget';
  if (props.locked) {
    return (
      <VStack spacing={8} modifiers={[containerBackground({ type: 'color', color: '#0B1029' }, 'widget'), widgetURL('solune://paywall')]}>
        <Image systemName="lock.fill" size={22} color="#F2BE6E" />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(3)]}>{props.locked}</Text>
      </VStack>
    );
  }
  const accent = '#F2BE6E';
  const tinted = env.widgetRenderingMode === 'accented' || env.widgetRenderingMode === 'vibrant';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
  const background = containerBackground(
    tinted ? { type: 'color', color: '#00000000' } : { type: 'linearGradient', colors: props.bg, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );
  const symbol = props.nextKind === 'rise' ? 'sunrise.fill' : props.nextKind === 'set' ? 'sunset.fill' : 'sun.max.fill';
  const family = env.widgetFamily;

  const header = (
    <HStack spacing={5}>
      <Image systemName={symbol} size={12} color={tinted ? undefined : accent} />
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), secondary, lineLimit(1)]}>{props.nextLabel}</Text>
      <Spacer />
    </HStack>
  );

  const countdown = props.nextAt ? (
    <HStack spacing={3}>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>{props.labels.in}</Text>
      <Text date={new Date(props.nextAt)} dateStyle="relative" modifiers={[font({ size: 12, weight: 'medium' }), secondary, lineLimit(1)]} />
    </HStack>
  ) : (
    <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>{props.phase}</Text>
  );

  const bigTime = (size: number) => (
    <Text modifiers={[font({ size, weight: 'light' }), minimumScaleFactor(0.7), lineLimit(1)]}>{props.nextTime}</Text>
  );

  const curve = (height: number) => (
    <ZStack modifiers={[frame({ height })]}>
      <Chart
        type="area"
        showGrid={false}
        data={props.curve.map((y, h) => ({ x: h, y }))}
        areaStyle={{ color: tinted ? '#FFFFFF33' : '#F2BE6E40' }}
      />
      <Chart
        type="line"
        showGrid={false}
        data={props.curve.map((y, h) => ({ x: h, y }))}
        lineStyle={{ color: tinted ? '#FFFFFF' : accent, width: 2 }}
        referenceLines={[{ x: 0, y: 0 }]}
        ruleStyle={{ color: '#FFFFFF66', lineWidth: 1, dashArray: [2, 3] }}
      />
    </ZStack>
  );

  const stat = (label: string, value: string) => (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 11, weight: 'medium' }), tertiary]}>{label}</Text>
      <Text modifiers={[font({ size: 15, weight: 'medium' }), lineLimit(1)]}>{value}</Text>
    </VStack>
  );

  if (family === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[background, widgetURL('solune://'), padding({ all: 0 })]}>
        <VStack alignment="leading" spacing={2} modifiers={[frame({ width: 118, alignment: 'leading' })]}>
          {header}
          {bigTime(34)}
          {countdown}
          <Spacer />
          <Text modifiers={[font({ size: 11, weight: 'medium' }), tertiary, lineLimit(1)]}>{props.place}</Text>
        </VStack>
        <VStack alignment="leading" spacing={6}>
          {curve(78)}
          <HStack>
            {stat(props.labels.rise, props.rise)}
            <Spacer />
            {stat(props.labels.set, props.set)}
            <Spacer />
            {stat(props.labels.day, props.dayLength)}
          </HStack>
        </VStack>
      </HStack>
    );
  }

  if (family === 'systemLarge' || family === 'systemExtraLarge') {
    return (
      <VStack alignment="leading" spacing={10} modifiers={[background, widgetURL('solune://')]}>
        <HStack>
          {header}
          <Text modifiers={[font({ size: 12, weight: 'medium' }), tertiary, lineLimit(1)]}>{props.place}</Text>
        </HStack>
        <HStack alignment="lastTextBaseline" spacing={8}>
          {bigTime(48)}
          {countdown}
          <Spacer />
        </HStack>
        {curve(120)}
        <HStack>
          {stat(props.labels.rise, props.rise)}
          <Spacer />
          {stat(props.labels.noon, props.noon)}
          <Spacer />
          {stat(props.labels.set, props.set)}
        </HStack>
        <HStack>
          {stat(props.labels.golden, props.goldenEvening)}
          <Spacer />
          {stat(props.labels.blue, props.blueEvening)}
        </HStack>
        <HStack>
          {stat(props.labels.dayLength, props.dayLength)}
          <Spacer />
          {stat(props.labels.sinceYesterday, props.dayDelta)}
          <Spacer />
          {stat(props.labels.sunNow, `${props.altitude}°`)}
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={2} modifiers={[background, widgetURL('solune://')]}>
      {header}
      <Spacer />
      {bigTime(38)}
      {countdown}
      <Spacer />
      <HStack spacing={4}>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), tertiary, lineLimit(1)]}>{props.place}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'medium' }), tertiary]}>{`${props.altitude}°`}</Text>
      </HStack>
    </VStack>
  );
}
