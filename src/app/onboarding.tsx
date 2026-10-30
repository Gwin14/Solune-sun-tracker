import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/charts';
import { Icon, type IconName } from '@/components/Icon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { PressableScale } from '@/components/Pressable';
import { SkyBackground } from '@/components/SkyBackground';
import { SunGlyph } from '@/components/SunGlyph';
import { Text } from '@/components/Text';
import { haptic } from '@/lib/haptics';
import { refreshCurrentLocation } from '@/lib/location';
import { requestNotificationPermission, rescheduleNotifications } from '@/lib/notifications';
import { DEFAULT_PLACE, useApp, type Interest, type NotificationPrefs } from '@/store/app';
import { EASE_OUT, POP, SNAP } from '@/theme/motion';
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

const INTERESTS: { key: Interest; label: string; icon: IconName }[] = [
  { key: 'photo', label: 'Fotografia', icon: 'camera' },
  { key: 'wellbeing', label: 'Bem-estar e sono', icon: 'heart' },
  { key: 'astro', label: 'Astronomia', icon: 'telescope' },
  { key: 'nature', label: 'Natureza e trilhas', icon: 'leaf' },
  { key: 'ritual', label: 'Contemplação', icon: 'sparkle' },
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

  const next = () => setIndex((i) => Math.min(STEPS.length - 1, i + 1));
  const back = () => {
    haptic.soft();
    setIndex((i) => Math.max(0, i - 1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SkyBackground altitude={sky} />
      <LinearGradient colors={['rgba(6,10,28,0)', 'rgba(6,10,28,0.72)']} style={styles.scrim} pointerEvents="none" />
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <View style={{ width: 40, height: 40 }}>
          {index > 0 && step !== 'done' ? (
            <PressableScale onPress={back} hapticOnPress={null} style={styles.back} accessibilityLabel="Voltar">
              <Icon name="chevronLeft" size={18} color={colors.text} />
            </PressableScale>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{index > 0 ? <ProgressBar value={index / (STEPS.length - 1)} height={12} /> : null}</View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View key={step} entering={FadeInRight.duration(380).easing(EASE_OUT)} exiting={FadeOutLeft.duration(200)} style={{ flex: 1 }}>
        {step === 'welcome' && <Welcome onNext={next} />}
        {step === 'sun' && (
          <Slide art={<SunArt />} title="Cada minuto de luz" body="Nascer, pôr, hora dourada e hora azul. Arraste o trajeto do sol para ver o céu em qualquer horário." onNext={next} />
        )}
        {step === 'moon' && (
          <Slide art={<MoonArt />} title="A lua, fase a fase" body="Iluminação, nascer e ocaso, superluas e eclipses. Arraste a lua para viajar pelos dias." onNext={next} />
        )}
        {step === 'ar' && (
          <Slide art={<ArArt />} title="Aponte para o céu" body="Levante o celular e veja o caminho exato do sol e da lua sobre a paisagem, a qualquer hora do dia." onNext={next} />
        )}
        {step === 'interests' && <Interests onNext={next} />}
        {step === 'location' && <LocationStep onNext={next} />}
        {step === 'notifications' && <NotificationsStep onNext={next} />}
        {step === 'done' && <Done />}
      </Animated.View>
    </View>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) + space.xs }]}>{children}</View>;
}

function Slide({ art, title, body, onNext }: { art: React.ReactNode; title: string; body: string; onNext: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.art}>{art}</View>
      <View style={styles.copy}>
        <Text variant="title1" align="center">
          {title}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {body}
        </Text>
      </View>
      <Footer>
        <Button label="Continuar" onPress={onNext} />
      </Footer>
    </View>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const { width } = useWindowDimensions();
  const rise = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    rise.set(reduce ? withTiming(1, { duration: 200 }) : withTiming(1, { duration: 2600, easing: EASE_OUT }));
  }, [rise, reduce]);
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.get()) * 150 }, { scale: 0.85 + rise.get() * 0.15 }] }));
  const horizonW = width;
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.art, { justifyContent: 'flex-end' }]}>
        <View style={{ width: horizonW, height: 260, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
          <Animated.View style={[{ position: 'absolute', bottom: 40 }, sunStyle]}>
            <SunGlyph size={150} rays />
          </Animated.View>
          <Svg width={horizonW} height={70} style={{ position: 'absolute', bottom: 0 }}>
            <Path d={`M0 40 Q ${horizonW * 0.25} 22 ${horizonW * 0.5} 34 T ${horizonW} 30 L ${horizonW} 70 L 0 70 Z`} fill="#0D1336" />
            <Path d={`M0 52 Q ${horizonW * 0.3} 38 ${horizonW * 0.6} 50 T ${horizonW} 46 L ${horizonW} 71 L 0 71 Z`} fill="#060A1C" />
          </Svg>
        </View>
      </View>
      <LinearGradient colors={['#060A1C', 'rgba(6,10,28,0.7)', 'rgba(6,10,28,0)']} locations={[0, 0.45, 1]} style={{ paddingTop: space.lg }}>
        <View style={styles.copy}>
          <Text variant="title1" align="center" style={{ fontSize: 38, lineHeight: 44 }}>
            Siga a luz do céu
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            Horários exatos do sol, fases da lua e o caminho dos astros, onde quer que você esteja.
          </Text>
        </View>
        <Footer>
          <Button label="Começar" onPress={onNext} />
        </Footer>
      </LinearGradient>
    </View>
  );
}

function SunArt() {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 48, 340);
  const h = 190;
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
        <Tag color={colors.golden} label="Hora dourada" />
        <Tag color={colors.blue} label="Hora azul" />
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
      <View style={[styles.copy, { marginTop: space.xl }]}>
        <Text variant="title1" align="center">
          O que te faz olhar para cima?
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          Escolha quantos quiser. Vamos ajustar seus lembretes.
        </Text>
      </View>
      <View style={styles.options}>
        {INTERESTS.map((o, i) => (
          <Animated.View key={o.key} entering={FadeIn.delay(80 + i * 60).duration(260)}>
            <OptionTile label={o.label} icon={o.icon} selected={picked.includes(o.key)} onPress={() => toggle(o.key)} />
          </Animated.View>
        ))}
      </View>
      <Footer>
        <Button label="Continuar" onPress={save} />
      </Footer>
    </View>
  );
}

function OptionTile({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const depth = useSharedValue(0);
  const pop = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    pop.set(selected ? withSequence(withTiming(1.25, { duration: 100 }), withSpring(1, POP)) : withTiming(0, { duration: 140 }));
  }, [selected, pop]);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: depth.get() * 4 }] }));
  const check = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.get()), transform: [{ scale: pop.get() }] }));
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => depth.set(withTiming(1, { duration: 90 }))}
      onPressOut={() => depth.set(withSpring(0, SNAP))}
      scaleTo={1}
      hapticOnPress={null}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={{ height: 66 }}>
      <View style={[styles.optionLip, { backgroundColor: selected ? colors.accentDeep : 'rgba(255,255,255,0.08)' }]} />
      <Animated.View style={[styles.option, selected && styles.optionOn, face]}>
        <View style={[styles.optionIcon, { backgroundColor: selected ? colors.accent : 'rgba(255,255,255,0.1)' }]}>
          <Icon name={icon} size={18} color={selected ? colors.textOnAccent : colors.text} />
        </View>
        <Text variant="headline" style={{ flex: 1 }}>
          {label}
        </Text>
        <Animated.View style={[styles.checkDot, check]}>
          <Icon name="check" size={13} color={colors.textOnAccent} weight="heavy" />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

function PulseIcon({ icon }: { icon: IconName }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - ring.get(), transform: [{ scale: 1 + ring.get() * 0.9 }] }));
  return (
    <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.pulse, ringStyle]} />
      <View style={styles.pulseCore}>
        <Icon name={icon} size={54} color={colors.textOnAccent} weight="bold" />
      </View>
    </View>
  );
}

function LocationStep({ onNext }: { onNext: () => void }) {
  const current = useApp((s) => s.current);
  const [status, setStatus] = useState<'idle' | 'busy' | 'denied' | 'error'>('idle');
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
      <View style={styles.art}>
        <PulseIcon icon="location" />
      </View>
      <View style={styles.copy}>
        <Text variant="title1" align="center">
          {current ? current.name : 'Onde fica o seu céu?'}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {status === 'denied'
            ? 'Sem permissão, usaremos São Paulo. Você pode trocar o local a qualquer momento.'
            : status === 'error'
              ? 'Não conseguimos sua posição agora. Tente de novo ou escolha depois.'
              : current
                ? 'Pronto! Os horários agora são calculados para você.'
                : 'Sua localização torna cada horário preciso ao minuto. Ela fica só no seu aparelho.'}
        </Text>
      </View>
      <Footer>
        <Button label={status === 'busy' ? 'Localizando…' : 'Usar minha localização'} icon="location" onPress={locate} disabled={status === 'busy' || !!current} />
        <Button
          label="Escolher depois"
          variant="quiet"
          onPress={() => {
            if (!current) useApp.getState().selectPlace('current');
            onNext();
          }}
        />
      </Footer>
    </View>
  );
}

function NotificationsStep({ onNext }: { onNext: () => void }) {
  const prefs = useApp((s) => s.notifications);
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
    { key: 'sunrise', label: 'Nascer do sol', icon: 'sunrise' },
    { key: 'sunset', label: 'Pôr do sol', icon: 'sunset' },
    { key: 'golden', label: 'Hora dourada', icon: 'sparkle' },
    { key: 'fullMoon', label: 'Lua cheia', icon: 'moonFull' },
    { key: 'newMoon', label: 'Lua nova', icon: 'stars' },
  ];
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.art, { flex: 0.9 }]}>
        <PulseIcon icon="bell" />
      </View>
      <View style={styles.copy}>
        <Text variant="title1" align="center">
          Não perca a melhor luz
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          Avisamos 15 minutos antes. Toque para ajustar.
        </Text>
      </View>
      <View style={styles.chips}>
        {items.map((it) => {
          const on = !!prefs[it.key];
          return (
            <PressableScale
              key={it.key}
              onPress={() => useApp.getState().setNotification(it.key, !on as never)}
              hapticOnPress="tick"
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              style={[styles.chip, on && styles.chipOn]}>
              <Icon name={it.icon} size={14} color={on ? colors.textOnAccent : colors.text} />
              <Text variant="subhead" color={on ? colors.textOnAccent : colors.text}>
                {it.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Footer>
        <Button label="Ativar lembretes" icon="bell" onPress={enable} />
        <Button label="Agora não" variant="quiet" onPress={onNext} />
      </Footer>
    </View>
  );
}

function Done() {
  const place = useApp((s) => s.current) ?? DEFAULT_PLACE;
  const badge = useSharedValue(0);
  useEffect(() => {
    haptic.success();
    badge.set(withDelay(200, withSpring(1, POP)));
  }, [badge]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }, { rotate: `${(1 - badge.get()) * -60}deg` }] }));
  const finish = () => {
    const s = useApp.getState();
    s.completeOnboarding();
    useApp.setState((st) => ({ celebrationQueue: st.celebrationQueue.filter((id) => id !== 'dawn') }));
    rescheduleNotifications();
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.art}>
        <Animated.View style={[styles.doneBadge, style]}>
          <Icon name="sunrise" size={64} color={colors.textOnAccent} weight="bold" />
        </Animated.View>
        <View style={styles.xpPill}>
          <Icon name="sparkle" size={13} color={colors.accent} />
          <Text variant="subhead" color={colors.accent}>
            Conquista desbloqueada: Primeira luz
          </Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text variant="title1" align="center">
          Seu céu está pronto
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          Registre nasceres, pores do sol e luas para manter sua sequência e subir de nível em {place.name}.
        </Text>
      </View>
      <Footer>
        <Button label="Ver meu céu" onPress={finish} />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 52 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
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
  options: { flex: 1, paddingHorizontal: space.md, gap: space.sm, justifyContent: 'center' },
  optionLip: { position: 'absolute', left: 0, right: 0, top: 4, height: 62, borderRadius: radius.card, borderCurve: 'continuous' },
  option: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(22,32,80,0.85)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  optionOn: { borderColor: colors.accent, backgroundColor: '#2C2F6E' },
  optionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  checkDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accent },
  pulseCore: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,240,210,0.6)',
    boxShadow: `0 6px 0 ${colors.accentDeep}`,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.md, paddingBottom: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  doneBadge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,240,210,0.6)',
    boxShadow: `0 8px 0 ${colors.accentDeep}, 0 0 60px rgba(255,182,72,0.6)`,
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xl,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
