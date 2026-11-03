import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Appear } from '@/components/Appear';
import { Journey } from '@/components/Journey';
import { Button } from '@/components/Button';
import { ProgressBar, ProgressRing } from '@/components/charts';
import { Icon, type IconName } from '@/components/Icon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { PressableScale } from '@/components/Pressable';
import { SkyBackground } from '@/components/SkyBackground';
import { SunGlyph } from '@/components/SunGlyph';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { strings, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { refreshCurrentLocation } from '@/lib/location';
import { requestNotificationPermission, rescheduleNotifications } from '@/lib/notifications';
import { DEFAULT_PLACE, useApp, type Interest, type NotificationPrefs } from '@/store/app';
import { EASE_OUT } from '@/theme/motion';
import { colors, radius, space } from '@/theme/tokens';

const STEPS = ['welcome', 'sun', 'moon', 'ar', 'interests', 'location', 'notifications', 'done'] as const;
type Step = (typeof STEPS)[number];

const SKY_ALT: Record<Step, number> = {
  welcome: 6,
  sun: 24,
  moon: -20,
  ar: -5,
  interests: 40,
  location: 12,
  notifications: 0,
  done: 3,
};

const INTERESTS: { key: Interest; icon: IconName }[] = [
  { key: 'photo', icon: 'camera' },
  { key: 'wellbeing', icon: 'heart' },
  { key: 'astro', icon: 'telescope' },
  { key: 'nature', icon: 'leaf' },
  { key: 'ritual', icon: 'sparkle' },
];

const ALERTS_FOR: Record<Interest, (keyof NotificationPrefs)[]> = {
  photo: ['golden', 'sunset'],
  wellbeing: ['sunrise', 'sunset'],
  astro: ['newMoon', 'fullMoon'],
  nature: ['sunrise', 'sunset'],
  ritual: ['fullMoon', 'newMoon'],
};

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const sky = useSharedValue(-14);
  const tx = useT();

  useEffect(() => {
    sky.set(withTiming(SKY_ALT[step], { duration: index === 0 ? 2600 : 900, easing: EASE_OUT }));
  }, [index, step, sky]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      setIndex((i) => Math.max(0, i - 1));
      return true;
    });
    return () => sub.remove();
  }, [index]);

  const next = () => {
    setIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const back = () => {
    haptic.soft();
    setIndex((i) => Math.max(0, i - 1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SkyBackground altitude={sky} />
      <LinearGradient colors={['rgba(6,10,28,0)', 'rgba(6,10,28,0.72)']} style={styles.scrim} pointerEvents="none" />
      <Journey
        count={STEPS.length}
        index={index}
        renderStation={(k) => (
          <Appear delay={k === 0 ? 0 : 820} y={0} duration={760} style={{ flex: 1, paddingTop: insets.top + 52 }}>
            {renderStep(STEPS[k], next)}
          </Appear>
        )}
      />
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <View style={{ width: 40, height: 40 }}>
          {index > 0 && step !== 'done' ? (
            <PressableScale onPress={back} hapticOnPress={null} style={styles.back} accessibilityLabel={tx.common.back}>
              <Icon name="chevronLeft" size={18} color={colors.text} />
            </PressableScale>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{index > 0 ? <ProgressBar value={index / (STEPS.length - 1)} height={4} /> : null}</View>
        <View style={{ width: 40 }} />
      </View>

    </View>
  );
}

function renderStep(step: Step, next: () => void) {
  const tx = strings().onboarding;
  switch (step) {
    case 'welcome':
      return <Welcome onNext={next} />;
    case 'sun':
      return <Slide art={<SunArt />} title={tx.sunTitle} body={tx.sunBody} onNext={next} />;
    case 'moon':
      return <Slide art={<MoonArt />} title={tx.moonTitle} body={tx.moonBody} onNext={next} />;
    case 'ar':
      return <Slide art={<ArArt />} title={tx.arTitle} body={tx.arBody} onNext={next} />;
    case 'interests':
      return <Interests onNext={next} />;
    case 'location':
      return <LocationStep onNext={next} />;
    case 'notifications':
      return <NotificationsStep onNext={next} />;
    case 'done':
      return <Done />;
  }
}

function Footer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Appear delay={200} y={18} style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) + space.xs }]}>
      {children}
    </Appear>
  );
}

function Slide({ art, title, body, onNext }: { art: React.ReactNode; title: string; body: string; onNext: () => void }) {
  const tx = useT();
  return (
    <View style={{ flex: 1 }}>
      <Appear delay={0} y={0} scale={0.94} duration={760} style={styles.art}>{art}</Appear>
      <Appear delay={110} y={14} style={styles.copy}>
        <Text variant="title1" align="center">
          {title}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {body}
        </Text>
      </Appear>
      <Footer>
        <Button label={tx.common.continue} onPress={onNext} />
      </Footer>
    </View>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const { width } = useWindowDimensions();
  const rise = useSharedValue(0);
  const reduce = useReducedMotion();
  const tx = useT();
  useEffect(() => {
    rise.set(reduce ? withTiming(1, { duration: 200 }) : withTiming(1, { duration: 2600, easing: EASE_OUT }));
  }, [rise, reduce]);
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.get()) * 150 }, { scale: 0.85 + rise.get() * 0.15 }] }));
  const horizonW = width;
  return (
    <View style={{ flex: 1 }}>
      <Appear delay={0} y={0} scale={0.94} duration={760} style={[styles.art, { justifyContent: 'flex-end' }]}>
        <View style={{ width: horizonW, height: 260, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
          <Animated.View style={[{ position: 'absolute', bottom: 40 }, sunStyle]}>
            <SunGlyph size={112} />
          </Animated.View>
          <Svg width={horizonW} height={70} style={{ position: 'absolute', bottom: 0 }}>
            <Path d={`M0 40 Q ${horizonW * 0.25} 22 ${horizonW * 0.5} 34 T ${horizonW} 30 L ${horizonW} 70 L 0 70 Z`} fill="#0D1336" />
            <Path d={`M0 52 Q ${horizonW * 0.3} 38 ${horizonW * 0.6} 50 T ${horizonW} 46 L ${horizonW} 71 L 0 71 Z`} fill="#060A1C" />
          </Svg>
        </View>
      </Appear>
      <LinearGradient colors={['#060A1C', 'rgba(6,10,28,0.7)', 'rgba(6,10,28,0)']} locations={[0, 0.45, 1]} style={{ paddingTop: space.lg }}>
        <Appear delay={110} y={14} style={styles.copy}>
          <Text variant="title1" align="center" style={{ fontSize: 38, lineHeight: 44 }}>
            {tx.onboarding.welcomeTitle}
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            {tx.onboarding.welcomeBody}
          </Text>
        </Appear>
        <Footer>
          <Button label={tx.onboarding.start} onPress={onNext} />
        </Footer>
      </LinearGradient>
    </View>
  );
}

function SunArt() {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 48, 340);
  const h = 190;
  const tx = useT();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [t]);
  const horizon = h * 0.72;
  const curveY = (p: number) => horizon + 30 - Math.sin(Math.PI * p) * (horizon + 8);
  const arc = Array.from({ length: 49 }, (_, i) => `${i ? 'L' : 'M'}${((i / 48) * w).toFixed(1)} ${curveY(i / 48).toFixed(1)}`).join(' ');
  const marker = useAnimatedStyle(() => {
    const p = 0.12 + t.get() * 0.76;
    const x = p * w;
    const y = horizon + 30 - Math.sin(Math.PI * p) * (horizon + 8);
    return { transform: [{ translateX: x - 22 }, { translateY: y - 22 }] };
  });
  return (
    <View style={[styles.artCard, { width: w + 32 }]}>
      <View style={{ width: w, height: h }}>
        <Svg width={w} height={h}>
          <Rect x={0} y={horizon} width={w} height={h - horizon} fill="rgba(3,6,22,0.35)" rx={10} />
          <Path d={arc} stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Rect x={0} y={horizon} width={w} height={1} fill="rgba(255,255,255,0.5)" />
        </Svg>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, marker]}>
          <SunGlyph size={44} />
        </Animated.View>
      </View>
      <View style={styles.artLegend}>
        <Tag color={colors.golden} label={tx.sun.golden} />
        <Tag color={colors.blue} label={tx.sun.blue} />
      </View>
    </View>
  );
}

function Tag({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}33`, borderColor: `${color}77` }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function MoonArt() {
  const [angle, setAngle] = useState(20);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setAngle((a) => (a + 6) % 360), 70);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <View style={{ alignItems: 'center', gap: space.xl }}>
      <MoonGlyph size={200} angle={angle} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <MoonGlyph key={a} size={22} angle={a} glow={false} />
        ))}
      </View>
    </View>
  );
}

function ArArt() {
  const { width } = useWindowDimensions();
  const pw = Math.min(width * 0.56, 220);
  const ph = pw * 1.9;
  const scan = useSharedValue(0);
  useEffect(() => {
    scan.set(withRepeat(withSequence(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.quad) })), -1));
  }, [scan]);
  const tilt = useAnimatedStyle(() => ({ transform: [{ rotate: `${(scan.get() - 0.5) * 10}deg` }, { translateX: (scan.get() - 0.5) * 30 }] }));
  const dots = Array.from({ length: 9 }, (_, i) => {
    const p = i / 8;
    return { x: pw * (0.1 + p * 0.8), y: ph * 0.62 - Math.sin(p * Math.PI) * ph * 0.34 };
  });
  return (
    <Animated.View style={[styles.phone, { width: pw, height: ph }, tilt]}>
      <Svg width={pw} height={ph} style={StyleSheet.absoluteFill}>
        <Path d={`M ${dots.map((d) => `${d.x} ${d.y}`).join(' L ')}`} stroke={colors.accent} strokeWidth={2} strokeDasharray="4 6" fill="none" />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={i === 5 ? 0 : 3} fill="#FFFFFF" opacity={0.8} />
        ))}
        <Rect x={0} y={ph * 0.7} width={pw} height={1.5} fill="rgba(255,255,255,0.6)" />
        <Path d={`M0 ${ph * 0.78} Q ${pw * 0.3} ${ph * 0.72} ${pw * 0.55} ${ph * 0.76} T ${pw} ${ph * 0.74} L ${pw} ${ph} L 0 ${ph} Z`} fill="#081029" />
      </Svg>
      <View style={{ position: 'absolute', left: dots[5].x - 22, top: dots[5].y - 22 }}>
        <SunGlyph size={44} />
      </View>
      <View style={[styles.arLabel, { left: dots[5].x - 28, top: dots[5].y + 26 }]}>
        <Text variant="caption">15:00</Text>
      </View>
    </Animated.View>
  );
}

function Interests({ onNext }: { onNext: () => void }) {
  const [picked, setPicked] = useState<Interest[]>(useApp.getState().interests);
  const tx = useT();
  const toggle = (k: Interest) => {
    haptic.tick();
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };
  const save = () => {
    const s = useApp.getState();
    s.setInterests(picked);
    if (picked.length) {
      const wanted = new Set(picked.flatMap((p) => ALERTS_FOR[p]));
      (['sunrise', 'sunset', 'golden', 'fullMoon', 'newMoon'] as const).forEach((k) => s.setNotification(k, wanted.has(k)));
    }
    onNext();
  };
  return (
    <View style={{ flex: 1 }}>
      <Appear delay={110} y={14} style={[styles.copy, { marginTop: space.xl }]}>
        <Text variant="title1" align="center">
          {tx.onboarding.interestsTitle}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {tx.onboarding.interestsBody}
        </Text>
      </Appear>
      <View style={styles.options}>
        <Animated.View entering={FadeIn.delay(80).duration(260)} style={styles.group}>
          {INTERESTS.map((o, i) => (
            <View key={o.key}>
              {i ? <View style={styles.groupDivider} /> : null}
              <OptionRow label={tx.onboarding.interests[o.key]} icon={o.icon} selected={picked.includes(o.key)} onPress={() => toggle(o.key)} />
            </View>
          ))}
        </Animated.View>
      </View>
      <Footer>
        <Button label={tx.common.continue} onPress={save} />
      </Footer>
    </View>
  );
}

function OptionRow({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const check = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    check.set(withTiming(selected ? 1 : 0, { duration: 160, easing: EASE_OUT }));
  }, [selected, check]);
  const checkStyle = useAnimatedStyle(() => ({ opacity: check.get(), transform: [{ scale: 0.8 + check.get() * 0.2 }] }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.fill }]}>
      <Icon name={icon} size={18} color={selected ? colors.accent : colors.textSecondary} weight="regular" />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <View style={[styles.checkRing, selected && { borderColor: colors.primary }]}>
        <Animated.View style={[styles.checkFill, checkStyle]}>
          <Icon name="check" size={12} color={colors.onPrimary} weight="bold" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** Quiet symbol medallion: a hairline ring with a slow breathing halo. */
function Glyph({ icon, size = 120 }: { icon: IconName; size?: number }) {
  const reduce = useReducedMotion();
  const halo = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    halo.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [halo, reduce]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + halo.get() * 0.35, transform: [{ scale: 1 + halo.get() * 0.06 }] }));
  return (
    <View style={{ width: size * 1.4, height: size * 1.4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.halo, { width: size * 1.4, height: size * 1.4, borderRadius: size * 0.7 }, haloStyle]} />
      <View style={[styles.glyph, { width: size, height: size, borderRadius: size / 2 }]}>
        <ProgressRing size={size} progress={1} color={colors.hairline} track="transparent" stroke={1} />
        <Icon name={icon} size={size * 0.36} color={colors.accent} weight="light" />
      </View>
    </View>
  );
}

function LocationStep({ onNext }: { onNext: () => void }) {
  const current = useApp((s) => s.current);
  const [status, setStatus] = useState<'idle' | 'busy' | 'denied' | 'error'>('idle');
  const tx = useT();
  const locate = async () => {
    setStatus('busy');
    const res = await refreshCurrentLocation(true);
    if (res === 'ok') {
      haptic.success();
      useApp.getState().selectPlace('current');
      setTimeout(onNext, 700);
    } else {
      haptic.warning();
      setStatus(res);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <Appear delay={0} y={0} scale={0.94} duration={760} style={styles.art}>
        <Glyph icon="location" />
      </Appear>
      <Appear delay={110} y={14} style={styles.copy}>
        <Text variant="title1" align="center">
          {current ? current.name : tx.onboarding.locationTitle}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {status === 'denied'
            ? tx.onboarding.locationDenied(DEFAULT_PLACE.name)
            : status === 'error'
              ? tx.onboarding.locationError
              : current
                ? tx.onboarding.locationReady
                : tx.onboarding.locationBody}
        </Text>
      </Appear>
      <Footer>
        {current ? (
          <Button label={tx.common.continue} onPress={onNext} />
        ) : (
          <Button label={tx.locations.useMine} loading={status === 'busy'} onPress={locate} />
        )}
        {current ? null : (
          <Button
            label={tx.onboarding.later}
            variant="quiet"
            onPress={() => {
              useApp.getState().selectPlace('current');
              onNext();
            }}
          />
        )}
      </Footer>
    </View>
  );
}

function NotificationsStep({ onNext }: { onNext: () => void }) {
  const prefs = useApp((s) => s.notifications);
  const tx = useT();
  const enable = async () => {
    const ok = await requestNotificationPermission();
    useApp.getState().setNotificationsEnabled(ok);
    if (ok) {
      haptic.success();
      rescheduleNotifications();
    }
    onNext();
  };
  const items: { key: keyof NotificationPrefs; label: string; icon: IconName }[] = [
    { key: 'sunrise', label: tx.sun.sunrise, icon: 'sunrise' },
    { key: 'sunset', label: tx.sun.sunset, icon: 'sunset' },
    { key: 'golden', label: tx.sun.golden, icon: 'sparkle' },
    { key: 'fullMoon', label: tx.moon.phase.full, icon: 'moonFull' },
    { key: 'newMoon', label: tx.moon.phase.new, icon: 'stars' },
  ];
  return (
    <View style={{ flex: 1 }}>
      <Appear delay={0} y={0} scale={0.94} duration={760} style={[styles.art, { flex: 0.85 }]}>
        <Glyph icon="bell" size={88} />
      </Appear>
      <Appear delay={110} y={14} style={styles.copy}>
        <Text variant="title1" align="center">
          {tx.onboarding.notifTitle}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {tx.onboarding.notifBody}
        </Text>
      </Appear>
      <View style={{ paddingHorizontal: space.md, paddingBottom: space.lg }}>
        <View style={styles.group}>
          {items.map((it, i) => (
            <View key={it.key}>
              {i ? <View style={styles.groupDivider} /> : null}
              <View style={[styles.option, { minHeight: 50 }]}>
                <Icon name={it.icon} size={17} color={colors.textSecondary} weight="regular" />
                <Text variant="body" style={{ flex: 1 }}>
                  {it.label}
                </Text>
                <Toggle
                  value={!!prefs[it.key]}
                  onValueChange={(v) => {
                    haptic.tick();
                    useApp.getState().setNotification(it.key, v as never);
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
      <Footer>
        <Button label={tx.settings.enableReminders} onPress={enable} />
        <Button label={tx.common.notNow} variant="quiet" onPress={onNext} />
      </Footer>
    </View>
  );
}

function Done() {
  const place = useApp((s) => s.current) ?? DEFAULT_PLACE;
  const ring = useSharedValue(0);
  const tx = useT();
  useEffect(() => {
    haptic.success();
    ring.set(withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT })));
  }, [ring]);
  const style = useAnimatedStyle(() => ({ opacity: ring.get(), transform: [{ scale: 0.92 + ring.get() * 0.08 }] }));
  const finish = () => {
    const s = useApp.getState();
    s.completeOnboarding();
    useApp.setState((st) => ({ celebrationQueue: st.celebrationQueue.filter((id) => id !== 'dawn') }));
    rescheduleNotifications();
  };
  return (
    <View style={{ flex: 1 }}>
      <Appear delay={0} y={0} scale={0.94} duration={760} style={styles.art}>
        <Animated.View style={style}>
          <Glyph icon="sunrise" />
        </Animated.View>
      </Appear>
      <Appear delay={110} y={14} style={styles.copy}>
        <Text variant="largeTitle" align="center">
          {tx.onboarding.doneTitle}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {tx.onboarding.doneBody(place.name)}
        </Text>
      </Appear>
      <Footer>
        <Button label={tx.onboarding.seeSky} onPress={finish} />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 52 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artCard: {
    padding: space.md,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    gap: space.sm,
  },
  artLegend: { flexDirection: 'row', gap: space.xs },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
  copy: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.lg },
  footer: { paddingHorizontal: space.md, gap: space.xs },
  phone: {
    borderRadius: 34,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(40,50,120,0.45)',
    overflow: 'hidden',
  },
  arLabel: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  options: { flex: 1, paddingHorizontal: space.md, justifyContent: 'center' },
  group: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: 'rgba(8,12,34,0.45)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder },
  groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 50 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 56 },
  checkRing: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.textTertiary, alignItems: 'center', justifyContent: 'center' },
  checkFill: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: colors.accentSoft },
  glyph: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,12,34,0.35)' },
});
