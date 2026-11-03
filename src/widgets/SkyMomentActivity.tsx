import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityEnvironment } from 'expo-widgets';

import type { SkyMomentProps } from './types';

/**
 * Momento no céu — a Live Activity for the golden hour, a sunset or a sunrise. The countdown and
 * the progress bar are system timers, so they keep moving with the app closed.
 */
export default function SkyMomentActivity(props: SkyMomentProps, env: LiveActivityEnvironment) {
  'widget';
  const amber = props.kind === 'sunrise' ? '#F7C98B' : '#F0A35E';
  const accent = env.isLuminanceReduced ? '#FFFFFF' : amber;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const range = { lower: new Date(props.startAt), upper: new Date(props.endAt) };
  const started = Date.now() >= props.startAt;
  const target = new Date(started ? props.endAt : props.startAt);

  const countdown = (size: number) =>
    env.isStale ? (
      <Text modifiers={[font({ size, weight: 'light' })]}>{props.endTime}</Text>
    ) : (
      <Text date={target} dateStyle="timer" modifiers={[font({ size, weight: 'light' }), monospacedDigit(), lineLimit(1)]} />
    );

  const title = (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
      <Text modifiers={[font({ size: 13 }), secondary, lineLimit(1)]}>{env.isStale ? props.labels.ended : props.caption}</Text>
    </VStack>
  );

  const bar = (
    <VStack spacing={4}>
      <ProgressView timerInterval={range} countsDown={false} modifiers={[tint(accent)]} />
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), secondary]}>{props.startTime}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'medium' }), secondary]}>{props.place}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'medium' }), secondary]}>{props.endTime}</Text>
      </HStack>
    </VStack>
  );

  return {
    banner: (
      <VStack spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint('#0B1029')]}>
        <HStack spacing={12}>
          <Image systemName={props.symbol as never} size={22} color={accent} />
          {title}
          <Spacer />
          <VStack alignment="trailing" spacing={0}>
            {countdown(28)}
            <Text modifiers={[font({ size: 11, weight: 'medium' }), secondary]}>{started ? props.labels.remaining : props.labels.untilStart}</Text>
          </VStack>
        </HStack>
        {bar}
      </VStack>
    ),
    compactLeading: <Image systemName={props.symbol as never} color={accent} />,
    compactTrailing: (
      <Text date={target} dateStyle="timer" modifiers={[font({ size: 14, weight: 'medium' }), monospacedDigit(), frame({ maxWidth: 52 }), foregroundStyle(accent)]} />
    ),
    minimal: <Image systemName={props.symbol as never} color={accent} />,
    expandedLeading: (
      <HStack spacing={8} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={props.symbol as never} size={20} color={accent} />
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
      </HStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 4 })]}>{countdown(22)}</VStack>,
    expandedBottom: <VStack modifiers={[padding({ horizontal: 4, top: 6 })]}>{bar}</VStack>,
  };
}
