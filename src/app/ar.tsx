import * as A from 'astronomy-engine';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { compassPoint, formatDegrees, formatMinuteOfDay, formatTime } from '@/astro/format';
import { moonState } from '@/astro/moon';
import { computePath, computeSunDay, moonPosition, observer, PATH_STEP_MIN, sunPosition } from '@/astro/sun';
import { MIN_MS, startOfDay, wallClock } from '@/astro/time';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { SkyBackground } from '@/components/SkyBackground';
import { PressableScale } from '@/components/Pressable';
import { SunGlyph } from '@/components/SunGlyph';
import { Text } from '@/components/Text';
import { usePlace } from '@/hooks/useAstro';
import { angleDiff, edgeIndicator, makeProjector, polylines, poseFromRotation, smoothAngle, wrap360, type Pose } from '@/lib/arMath';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app';
import { colors, font, radius, space } from '@/theme/tokens';

type Mode = 'camera' | 'virtual';
type Layers = { sun: boolean; moon: boolean; solstices: boolean; grid: boolean };

const CAMERA_VFOV = 62;
const CARDINALS: [string, number][] = [
  ['N', 0], ['NE', 45], ['L', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315],
];

export default function ArScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const place = usePlace();
  const use24h = useApp((s) => s.use24h);
  const tz = place.tz;
  const [cameraPerm, requestCamera] = useCameraPermissions();
  const [sensorsOk, setSensorsOk] = useState<boolean | null>(null);
  const [modeChoice, setMode] = useState<Mode | null>(null);
  const [layers, setLayers] = useState<Layers>({ sun: true, moon: true, solstices: false, grid: true });
  const [showLayers, setShowLayers] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [showSensorNote, setShowSensorNote] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSensorNote(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // ---- astronomy for today ----
  const now = useMemo(() => new Date(), []);
  const dayStart = useMemo(() => startOfDay(now, tz), [now, tz]);
  const nowMinute = wallClock(now, tz).minuteOfDay;
  const [minute, setMinute] = useState(nowMinute);
  const data = useMemo(() => {
    const zip = (p: { alt: number[]; az: number[] }) => p.alt.map((alt, i) => ({ alt, az: p.az[i] }));
    const sun = zip(computePath(A.Body.Sun, place, dayStart));
    const moon = zip(computePath(A.Body.Moon, place, dayStart));
    const seasons = A.Seasons(now.getUTCFullYear());
    const solstices = [seasons.jun_solstice.date, seasons.dec_solstice.date].map((d) => zip(computePath(A.Body.Sun, place, startOfDay(d, tz))));
    const day = computeSunDay(place, dayStart);
    return { sun, moon, solstices, day };
  }, [place, dayStart, tz, now]);

  const selected = useMemo(() => {
    const t = new Date(dayStart.getTime() + minute * MIN_MS);
    const obs = observer(place);
    return { t, sun: sunPosition(t, obs), moon: moonPosition(t, obs), phase: moonState(t) };
  }, [minute, dayStart, place]);

  // ---- pose ----
  const [pose, setPose] = useState<Pose>({ az: selected.sun.alt > -10 ? selected.sun.az : selected.moon.az, alt: 15, roll: 0 });
  const [vfov, setVfov] = useState(70);
  const declination = useRef(0);
  const offset = useRef({ az: 0, alt: 0 });
  const smooth = useRef<Pose | null>(null);

  useEffect(() => {
    useApp.getState().logArSession();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (process.env.EXPO_OS === 'web') {
        setSensorsOk(false);
        return;
      }
      try {
        const ok = await DeviceMotion.isAvailableAsync();
        if (!ok) return alive && setSensorsOk(false);
        const perm = await DeviceMotion.requestPermissionsAsync();
        if (alive) setSensorsOk(perm.granted);
      } catch {
        if (alive) setSensorsOk(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Camera mode is the default once both the sensors and the camera are available.
  const mode: Mode = modeChoice ?? (sensorsOk && cameraPerm?.granted ? 'camera' : 'virtual');

  useEffect(() => {
    if (mode !== 'camera' || !sensorsOk) return;
    smooth.current = null;
    DeviceMotion.setUpdateInterval(33);
    const sub = DeviceMotion.addListener((m) => {
      if (!m.rotation) return;
      const raw = poseFromRotation(m.rotation.alpha, m.rotation.beta, m.rotation.gamma, process.env.EXPO_OS);
      const target: Pose = {
        az: wrap360(raw.az + declination.current + offset.current.az),
        alt: raw.alt + offset.current.alt,
        roll: Math.abs(raw.alt) > 80 ? (smooth.current?.roll ?? 0) : raw.roll,
      };
      const prev = smooth.current;
      const k = 0.3;
      const next = prev
        ? { az: smoothAngle(prev.az, target.az, k), alt: prev.alt + (target.alt - prev.alt) * k, roll: smoothAngle(prev.roll, target.roll, k) }
        : target;
      smooth.current = next;
      setPose({ az: next.az, alt: next.alt, roll: next.roll > 180 ? next.roll - 360 : next.roll });
    });
    let headingSub: Location.LocationSubscription | null = null;
    Location.watchHeadingAsync((h) => {
      if (h.trueHeading >= 0 && h.magHeading >= 0) declination.current = angleDiff(h.trueHeading, h.magHeading);
      setLowAccuracy(h.accuracy > 0 && h.accuracy < 2);
    })
      .then((s) => (headingSub = s))
      .catch(() => {});
    return () => {
      sub.remove();
      headingSub?.remove();
    };
  }, [mode, sensorsOk]);

  // ---- virtual sky gestures ----
  const start = useRef({ az: 0, alt: 0, fov: 70 });
  const beginPan = () => (start.current = { ...start.current, az: pose.az, alt: pose.alt });
  const movePan = (tx: number, ty: number) => {
    const degPerPx = vfov / height;
    setPose({ az: wrap360(start.current.az - tx * degPerPx), alt: Math.max(-30, Math.min(85, start.current.alt + ty * degPerPx)), roll: 0 });
  };
  const beginPinch = () => (start.current = { ...start.current, fov: vfov });
  const movePinch = (s: number) => setVfov(Math.max(30, Math.min(110, start.current.fov / s)));
  const pan = usePanGesture({
    enabled: mode === 'virtual',
    onActivate: () => {
      'worklet';
      scheduleOnRN(beginPan);
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(movePan, e.translationX, e.translationY);
    },
  });
  const pinch = usePinchGesture({
    enabled: mode === 'virtual',
    onActivate: () => {
      'worklet';
      scheduleOnRN(beginPinch);
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(movePinch, e.scale);
    },
  });
  const gestures = useSimultaneousGestures(pan, pinch);

  const fov = mode === 'camera' ? CAMERA_VFOV : vfov;
  const project = useMemo(() => makeProjector(pose, width, height, fov), [pose, width, height, fov]);

  // ---- geometry ----
  const geo = useMemo(() => {
    const horizonPts = Array.from({ length: 73 }, (_, i) => ({ az: i * 5, alt: 0 }));
    const horizon = polylines(horizonPts, project, width, height).sort((a, b) => b.length - a.length);
    const ring = (alt: number) => polylines(Array.from({ length: 73 }, (_, i) => ({ az: i * 5, alt })), project, width, height);
    const above = (pts: { az: number; alt: number }[]) => pts.map((p) => (p.alt >= -1 ? p : { ...p, alt: NaN }));
    const below = (pts: { az: number; alt: number }[]) => pts.map((p) => (p.alt <= 1 ? p : { ...p, alt: NaN }));
    const clean = (pts: { az: number; alt: number }[]) => pts.filter((p) => !Number.isNaN(p.alt));
    const split = (pts: { az: number; alt: number }[]) => {
      // keep NaN gaps as breaks
      const segs: { az: number; alt: number }[][] = [[]];
      for (const p of pts) {
        if (Number.isNaN(p.alt)) segs.push([]);
        else segs[segs.length - 1].push(p);
      }
      return segs.filter((s) => s.length > 1).flatMap((s) => polylines(s, project, width, height));
    };
    const hourMarks = (pts: { az: number; alt: number }[]) =>
      Array.from({ length: 24 }, (_, h) => {
        const p = pts[(h * 60) / PATH_STEP_MIN];
        if (!p || p.alt < -2) return null;
        const s = project(p.az, p.alt);
        if (!Number.isFinite(s.x) || s.x < -40 || s.x > width + 40 || s.y < -40 || s.y > height + 40) return null;
        return { h, x: s.x, y: s.y };
      }).filter(Boolean) as { h: number; x: number; y: number }[];
    const cardinals = CARDINALS.map(([l, az]) => {
      const s = project(az, 0);
      return Number.isFinite(s.x) ? { l, x: s.x, y: s.y } : null;
    }).filter(Boolean) as { l: string; x: number; y: number }[];
    const ticks = Array.from({ length: 24 }, (_, i) => i * 15)
      .filter((az) => az % 45)
      .map((az) => {
        const a = project(az, 0);
        const b = project(az, 1.2);
        return Number.isFinite(a.x) && Number.isFinite(b.x) ? { az, a, b } : null;
      })
      .filter(Boolean) as { az: number; a: { x: number; y: number }; b: { x: number; y: number } }[];
    void clean;
    return {
      horizon,
      grid: layers.grid ? [...ring(30), ...ring(60)] : [],
      sunAbove: split(above(data.sun)),
      sunBelow: split(below(data.sun)),
      sunHours: hourMarks(data.sun),
      moonAbove: split(above(data.moon)),
      moonHours: hourMarks(data.moon),
      solstices: layers.solstices ? data.solstices.map((p) => split(above(p))) : [],
      cardinals,
      ticks,
    };
  }, [project, width, height, data, layers.grid, layers.solstices]);

  const sunScreen = project(selected.sun.az, selected.sun.alt);
  const moonScreen = project(selected.moon.az, selected.moon.alt);
  const onScreen = (s: { x: number; y: number }) => Number.isFinite(s.x) && s.x > 0 && s.x < width && s.y > 0 && s.y < height;
  const sunVisible = layers.sun && onScreen(sunScreen);
  const moonVisible = layers.moon && onScreen(moonScreen);
  const sunEdge = layers.sun && !sunVisible ? edgeIndicator(pose, selected.sun.az, selected.sun.alt, width, height) : null;

  const lastLocked = useRef(false);
  useEffect(() => {
    const locked = sunVisible && Math.abs(sunScreen.x - width / 2) < 40 && Math.abs(sunScreen.y - height / 2) < 40;
    if (locked && !lastLocked.current) haptic.light();
    lastLocked.current = locked;
  }, [sunVisible, sunScreen.x, sunScreen.y, width, height]);

  const onCalibrateTap = (x: number, y: number) => {
    if (!calibrating) return;
    // Treat the tapped point as where the sun really is: shift the pose so the sun projects there.
    const degPerPx = fov / height;
    const dx = x - sunScreen.x;
    const dy = y - sunScreen.y;
    offset.current = { az: offset.current.az - dx * degPerPx, alt: offset.current.alt + dy * degPerPx };
    haptic.success();
    setCalibrating(false);
  };

  const enableCamera = async () => {
    const res = cameraPerm?.granted ? cameraPerm : await requestCamera();
    if (res?.granted && sensorsOk) {
      haptic.light();
      setMode('camera');
    } else haptic.warning();
  };

  const cameraBlocked = mode === 'camera' && !cameraPerm?.granted;
  const timeLabel = formatMinuteOfDay(minute, use24h);
  const ground = mode === 'virtual';

  return (
    <View style={styles.root}>
      {mode === 'camera' && cameraPerm?.granted ? <CameraView style={StyleSheet.absoluteFill} facing="back" /> : <VirtualSky sunAlt={selected.sun.alt} />}
      {mode === 'camera' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,30,0.18)' }]} pointerEvents="none" /> : null}

      <GestureDetector gesture={gestures}>
        <Pressable style={StyleSheet.absoluteFill} onPress={(e) => onCalibrateTap(e.nativeEvent.locationX, e.nativeEvent.locationY)} disabled={!calibrating}>
          <Svg width={width} height={height} pointerEvents="none">
            {ground && geo.horizon.length ? (
              <Path d={`${geo.horizon[0]} L${width + 400},${height + 400} L-400,${height + 400} Z`} fill="rgba(4,7,20,0.82)" />
            ) : null}
            {geo.grid.map((d, i) => (
              <Path key={`g${i}`} d={d} stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1} strokeDasharray="2 6" fill="none" />
            ))}
            {geo.horizon.map((d, i) => (
              <Path key={`h${i}`} d={d} stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.5} fill="none" />
            ))}
            {geo.ticks.map((t) => (
              <Line key={t.az} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1} />
            ))}
            {geo.cardinals.map((c) => (
              <G key={c.l}>
                <Circle cx={c.x} cy={c.y} r={3} fill={c.l === 'N' ? colors.accent : '#FFFFFF'} />
                <SvgText x={c.x} y={c.y + 20} fontSize={c.l.length === 1 ? 15 : 12} fontFamily={font.heavy} fill={c.l === 'N' ? colors.accent : '#FFFFFF'} textAnchor="middle">
                  {c.l}
                </SvgText>
              </G>
            ))}
            {geo.solstices.map((segs, i) =>
              segs.map((d, j) => (
                <Path key={`s${i}${j}`} d={d} stroke={i === 0 ? '#FF8A6B' : '#8FB4FF'} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 6" fill="none" />
              )),
            )}
            {layers.moon
              ? geo.moonAbove.map((d, i) => <Path key={`m${i}`} d={d} stroke={colors.moon} strokeOpacity={0.8} strokeWidth={2} strokeDasharray="3 7" strokeLinecap="round" fill="none" />)
              : null}
            {layers.sun ? (
              <>
                {geo.sunBelow.map((d, i) => (
                  <Path key={`sb${i}`} d={d} stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={1.5} strokeDasharray="2 6" fill="none" />
                ))}
                {geo.sunAbove.map((d, i) => (
                  <G key={`sa${i}`}>
                    <Path d={d} stroke={colors.accent} strokeOpacity={0.35} strokeWidth={8} fill="none" strokeLinecap="round" />
                    <Path d={d} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                  </G>
                ))}
                {geo.sunHours.map((h) => (
                  <G key={`hr${h.h}`}>
                    <Circle cx={h.x} cy={h.y} r={4} fill="#FFFFFF" stroke={colors.accent} strokeWidth={2} />
                    <SvgText x={h.x + 9} y={h.y - 8} fontSize={11} fontFamily={font.bold} fill="#FFFFFF">
                      {use24h ? `${h.h}h` : `${h.h % 12 || 12}${h.h < 12 ? 'a' : 'p'}`}
                    </SvgText>
                  </G>
                ))}
              </>
            ) : null}
            {calibrating ? <Circle cx={width / 2} cy={height / 2} r={26} stroke="#FFFFFF" strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
            <Line x1={width / 2 - 10} y1={height / 2} x2={width / 2 + 10} y2={height / 2} stroke="#FFFFFF" strokeOpacity={0.7} />
            <Line x1={width / 2} y1={height / 2 - 10} x2={width / 2} y2={height / 2 + 10} stroke="#FFFFFF" strokeOpacity={0.7} />
          </Svg>
          {moonVisible ? (
            <View pointerEvents="none" style={[styles.body, { left: moonScreen.x - 22, top: moonScreen.y - 22 }]}>
              <MoonGlyph size={44} angle={selected.phase.angle} southern={place.latitude < 0} />
            </View>
          ) : null}
          {sunVisible ? (
            <View pointerEvents="none" style={[styles.body, { left: sunScreen.x - 30, top: sunScreen.y - 30 }]}>
              <SunGlyph size={60} />
              <View style={styles.bodyLabel}>
                <Text variant="caption">
                  {timeLabel} · {formatDegrees(selected.sun.alt)}
                </Text>
              </View>
            </View>
          ) : null}
          {sunEdge ? (
            <View pointerEvents="none" style={[styles.edge, { left: sunEdge.x - 26, top: sunEdge.y - 26 }]}>
              <View style={{ transform: [{ rotate: `${sunEdge.rotation}deg` }] }}>
                <Icon name="arrowUp" size={18} color={colors.textOnAccent} weight="heavy" />
              </View>
            </View>
          ) : null}
        </Pressable>
      </GestureDetector>

      {/* Top HUD */}
      <View style={[styles.hudTop, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <View style={styles.hudRow} pointerEvents="box-none">
          <HudButton icon="close" label="Fechar" onPress={() => router.back()} />
          <View style={styles.modeSwitch}>
            {(['camera', 'virtual'] as Mode[]).map((m) => (
              <PressableScale
                key={m}
                onPress={() => (m === 'camera' ? enableCamera() : setMode('virtual'))}
                hapticOnPress="tick"
                style={[styles.modeBtn, mode === m && styles.modeBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}>
                <Text variant="subhead" color={mode === m ? colors.textOnAccent : colors.text}>
                  {m === 'camera' ? 'Câmera' : 'Céu virtual'}
                </Text>
              </PressableScale>
            ))}
          </View>
          <HudButton icon="layers" label="Camadas" onPress={() => setShowLayers((v) => !v)} active={showLayers} />
        </View>
        <View style={styles.headingPill}>
          <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
            {Math.round(pose.az)}° {compassPoint(pose.az)}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {pose.alt >= 0 ? '↑' : '↓'} {formatDegrees(Math.abs(pose.alt))}
          </Text>
        </View>
        {showLayers ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.layers}>
            <LayerToggle icon="sun" label="Sol" on={layers.sun} onPress={() => setLayers((l) => ({ ...l, sun: !l.sun }))} />
            <LayerToggle icon="moon" label="Lua" on={layers.moon} onPress={() => setLayers((l) => ({ ...l, moon: !l.moon }))} />
            <LayerToggle icon="calendar" label="Solstícios" on={layers.solstices} onPress={() => setLayers((l) => ({ ...l, solstices: !l.solstices }))} />
            <LayerToggle icon="compass" label="Grade" on={layers.grid} onPress={() => setLayers((l) => ({ ...l, grid: !l.grid }))} />
          </Animated.View>
        ) : null}
        {layers.solstices ? (
          <View style={styles.legend}>
            <View style={[styles.legendLine, { backgroundColor: '#FF8A6B' }]} />
            <Text variant="caption">Junho</Text>
            <View style={[styles.legendLine, { backgroundColor: '#8FB4FF' }]} />
            <Text variant="caption">Dezembro</Text>
          </View>
        ) : null}
        {mode === 'camera' && lowAccuracy ? (
          <View style={styles.notice}>
            <Icon name="compass" size={14} color={colors.accent} />
            <Text variant="footnote">Mova o celular desenhando um 8 para calibrar a bússola.</Text>
          </View>
        ) : null}
        {calibrating ? (
          <View style={styles.notice}>
            <Icon name="hand" size={14} color={colors.accent} />
            <Text variant="footnote">Toque onde o sol está na tela. Nunca olhe diretamente para ele.</Text>
          </View>
        ) : null}
      </View>

      {/* Bottom HUD */}
      <View style={[styles.hudBottom, { paddingBottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
        <View style={styles.infoRow}>
          <InfoChip icon="sunrise" label={formatTime(data.day.sunrise, tz, use24h)} />
          <InfoChip icon="sun" label={`${formatDegrees(selected.sun.az)} · ${formatDegrees(selected.sun.alt)}`} highlight />
          <InfoChip icon="sunset" label={formatTime(data.day.sunset, tz, use24h)} />
        </View>
        <TimeScrubber minute={minute} nowMinute={nowMinute} onChange={setMinute} use24h={use24h} sunrise={data.day.sunrise ? wallClock(data.day.sunrise, tz).minuteOfDay : null} sunset={data.day.sunset ? wallClock(data.day.sunset, tz).minuteOfDay : null} />
        <View style={styles.bottomActions}>
          {mode === 'camera' ? (
            <PressableScale onPress={() => setCalibrating((c) => !c)} hapticOnPress="soft" style={styles.smallAction}>
              <Icon name="viewfinder" size={14} color={colors.text} />
              <Text variant="subhead">{calibrating ? 'Cancelar' : 'Calibrar com o sol'}</Text>
            </PressableScale>
          ) : (
            <Text variant="footnote" color={colors.textSecondary}>
              Arraste para olhar em volta · pinça para zoom
            </Text>
          )}
        </View>
      </View>

      {cameraBlocked ? (
        <View style={[StyleSheet.absoluteFill, styles.blocker]}>
          <Icon name="camera" size={44} color={colors.accent} />
          <Text variant="title2" align="center">
            Veja o céu pela câmera
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            O Solune usa a câmera só para desenhar o trajeto do sol e da lua sobre a imagem. Nada é gravado.
          </Text>
          <Button label="Permitir câmera" onPress={enableCamera} style={{ alignSelf: 'stretch' }} />
          <Button label="Usar céu virtual" variant="quiet" onPress={() => setMode('virtual')} />
        </View>
      ) : null}
      {sensorsOk === false && mode === 'virtual' && showSensorNote ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(400)} style={[styles.sensorNote, { top: insets.top + 150 }]} pointerEvents="none">
          <Text variant="caption" color={colors.textSecondary} align="center">
            Sensores de movimento indisponíveis neste aparelho. Mostrando o céu virtual.
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function VirtualSky({ sunAlt }: { sunAlt: number }) {
  // Same sky palette as the rest of the app, driven by the selected time.
  const altitude = useSharedValue(sunAlt);
  useEffect(() => {
    altitude.set(withTiming(sunAlt, { duration: 240 }));
  }, [sunAlt, altitude]);
  return <SkyBackground altitude={altitude} />;
}

function HudButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <PressableScale onPress={onPress} hapticOnPress="soft" accessibilityLabel={label} accessibilityRole="button" style={[styles.hudBtn, active && { backgroundColor: colors.accent }]}>
      <Icon name={icon} size={17} color={active ? colors.textOnAccent : colors.text} />
    </PressableScale>
  );
}

function LayerToggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} hapticOnPress="tick" style={[styles.layerChip, on && styles.layerChipOn]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <Icon name={icon} size={14} color={on ? colors.textOnAccent : colors.text} />
      <Text variant="subhead" color={on ? colors.textOnAccent : colors.text}>
        {label}
      </Text>
    </PressableScale>
  );
}

function InfoChip({ icon, label, highlight }: { icon: IconName; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.infoChip, highlight && { borderColor: colors.accent }]}>
      <Icon name={icon} size={13} color={highlight ? colors.accent : colors.textSecondary} />
      <Text variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
        {label}
      </Text>
    </View>
  );
}

function TimeScrubber({
  minute,
  nowMinute,
  onChange,
  use24h,
  sunrise,
  sunset,
}: {
  minute: number;
  nowMinute: number;
  onChange: (m: number) => void;
  use24h: boolean;
  sunrise: number | null;
  sunset: number | null;
}) {
  const [width, setWidth] = useState(0);
  const lastHour = useRef(Math.floor(minute / 60));
  const update = (x: number) => {
    const m = Math.max(0, Math.min(1439, (x / Math.max(1, width)) * 1440));
    const h = Math.floor(m / 60);
    if (h !== lastHour.current) {
      lastHour.current = h;
      haptic.tick();
    }
    onChange(m);
  };
  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      scheduleOnRN(update, e.x);
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(update, e.x);
    },
  });
  const pct = minute / 1440;
  const off = Math.abs(minute - nowMinute) > 3;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.scrubHeader}>
        <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
          {formatMinuteOfDay(minute, use24h)}
        </Text>
        {off ? (
          <PressableScale onPress={() => onChange(nowMinute)} hapticOnPress="soft" style={styles.nowPill}>
            <Text variant="caption" color={colors.textOnAccent}>
              Agora
            </Text>
          </PressableScale>
        ) : (
          <Text variant="caption" color={colors.textSecondary}>
            Agora
          </Text>
        )}
      </View>
      <GestureDetector gesture={pan}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.track} accessibilityLabel="Horário" accessibilityRole="adjustable">
          {sunrise != null && sunset != null && width ? (
            <View style={[styles.daySpan, { left: (sunrise / 1440) * width, width: ((sunset - sunrise) / 1440) * width }]} />
          ) : null}
          <View style={[styles.nowTick, { left: (nowMinute / 1440) * width - 1 }]} />
          <View style={[styles.thumb, { left: pct * width - 14 }]}>
            <View style={styles.thumbDot} />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const glassBg = 'rgba(8,12,34,0.55)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  body: { position: 'absolute', alignItems: 'center' },
  bodyLabel: { marginTop: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  edge: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 24px rgba(255,182,72,0.7)',
  },
  hudTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md, gap: space.sm, alignItems: 'center' },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  hudBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: glassBg, alignItems: 'center', justifyContent: 'center' },
  modeSwitch: { flexDirection: 'row', backgroundColor: glassBg, borderRadius: radius.pill, padding: 4, gap: 4 },
  modeBtn: { paddingHorizontal: space.sm, height: 34, borderRadius: radius.pill, justifyContent: 'center' },
  modeBtnOn: { backgroundColor: colors.accent },
  headingPill: { alignItems: 'center', backgroundColor: glassBg, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  layers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  layerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, height: 36, borderRadius: radius.pill, backgroundColor: glassBg },
  layerChipOn: { backgroundColor: colors.accent },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: glassBg, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: glassBg, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.tile, maxWidth: 340 },
  hudBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, gap: space.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: glassBg, paddingHorizontal: space.sm, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent' },
  bottomActions: { alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: glassBg, paddingHorizontal: space.md, height: 36, borderRadius: radius.pill },
  scrubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xxs },
  nowPill: { backgroundColor: colors.accent, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  track: { height: 44, borderRadius: radius.pill, backgroundColor: glassBg, justifyContent: 'center', overflow: 'visible' },
  daySpan: { position: 'absolute', top: 18, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,182,72,0.45)' },
  nowTick: { position: 'absolute', top: 12, width: 2, height: 20, borderRadius: 1, backgroundColor: '#FFFFFF' },
  thumb: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' },
  thumbDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF3D6' },
  blocker: { backgroundColor: 'rgba(4,7,22,0.94)', alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  sensorNote: { position: 'absolute', left: space.xl, right: space.xl },
});
