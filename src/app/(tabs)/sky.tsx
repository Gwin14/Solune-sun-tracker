import * as A from 'astronomy-engine';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { compassPoint, formatDate, formatDegrees, formatMinuteOfDay, formatTime } from '@/astro/format';
import { moonState } from '@/astro/moon';
import { catalog, starColor } from '@/astro/sky/catalog';
import { altAz, constellationAt, enuFromAltAz, horizonFrame, planViewing, PLANETS, starTrails, trailStars } from '@/astro/sky/engine';
import { describeTarget, kindOf, searchIndex, targetEnu, targetEqjAt, type TargetId } from '@/astro/sky/targets';
import { computePath, computeSunDay, LIGHT_PHASE_LABEL, lightPhase, moonPosition, observer, PATH_STEP_MIN, sunPosition } from '@/astro/sun';
import { addDays, dayKey, daysBetweenKeys, MIN_MS, startOfDay, wallClock } from '@/astro/time';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { lazyTab } from '@/components/LazyTab';
import { MoonGlyph } from '@/components/MoonGlyph';
import { FindSheet, type FindRow } from '@/components/planetarium/FindSheet';
import { PlanetariumSky, type SkyVisibility } from '@/components/planetarium/PlanetariumSky';
import { TargetCard } from '@/components/planetarium/TargetCard';
import { PressableScale } from '@/components/Pressable';
import { SkyBackground } from '@/components/SkyBackground';
import { SunGlyph } from '@/components/SunGlyph';
import { TAB_BAR_HEIGHT } from '@/components/TabSpace';
import { Text } from '@/components/Text';
import { usePlace } from '@/hooks/useAstro';
import { angleDiff, edgeIndicator, makeUnprojector, makeVecProjector, polylines, poseFromRotation, smoothAngle, wrap360, type Pose, type Projector } from '@/lib/arMath';
import { haptic } from '@/lib/haptics';
import { DEFAULT_PLANETARIUM, useApp, type PlanetariumPrefs } from '@/store/app';
import { useSkyIntent } from '@/store/skyIntent';
import { colors, weight, radius, space } from '@/theme/tokens';

type Mode = 'camera' | 'virtual';
type Layers = { sun: boolean; moon: boolean; solstices: boolean; grid: boolean };
type Cursor = { dayShift: number; minute: number };

const CAMERA_VFOV = 62;
const CARDINALS: [string, number][] = [
  ['N', 0], ['NE', 45], ['L', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315],
];
/** Time-lapse speeds in sky minutes per real second. */
const SPEEDS = [
  { label: '1 min/s', rate: 1 },
  { label: '10 min/s', rate: 10 },
  { label: '1 h/s', rate: 60 },
];
const LOCK_PX = 36;
const D2R = Math.PI / 180;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * clamp(k, 0, 1);

// Mounting asks for motion access, so it waits until the tab is actually opened.
export default lazyTab(SkyScreen, '#000');

function SkyScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const place = usePlace();
  const use24h = useApp((s) => s.use24h);
  const storedPrefs = useApp((s) => s.planetarium);
  const setPrefs = useApp((s) => s.setPlanetarium);
  const favorites = useApp((s) => s.favorites);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const P: PlanetariumPrefs = { ...DEFAULT_PLANETARIUM, ...storedPrefs };
  const tz = place.tz;
  const [cameraPerm, requestCamera] = useCameraPermissions();
  const [sensorsOk, setSensorsOk] = useState<boolean | null>(null);
  const [modeChoice, setMode] = useState<Mode | null>(null);
  const [layers, setLayers] = useState<Layers>({ sun: true, moon: true, solstices: false, grid: true });
  const [showLayers, setShowLayers] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [showSensorNote, setShowSensorNote] = useState(true);
  const [planetarium, setPlanetarium] = useState(false);
  const [selectedId, setSelectedId] = useState<TargetId | null>(null);
  const [finding, setFinding] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setShowSensorNote(false), 4000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 4200);
    return () => clearTimeout(t);
  }, [hint]);

  // ---- time: a cursor (day offset + minute of that day), live by default ----
  const [now, setNow] = useState(() => new Date());
  const [cursor, setCursor] = useState<Cursor>(() => ({ dayShift: 0, minute: wallClock(new Date(), tz).minuteOfDay }));
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const { minute, dayShift } = cursor;
  const dayStartMs = useMemo(() => addDays(startOfDay(now, tz), dayShift, tz).getTime(), [now, dayShift, tz]);
  const dayStart = useMemo(() => new Date(dayStartMs), [dayStartMs]);
  const nowMinute = wallClock(now, tz).minuteOfDay;

  const data = useMemo(() => {
    const zip = (p: { alt: number[]; az: number[] }) => p.alt.map((alt, i) => ({ alt, az: p.az[i] }));
    const sun = zip(computePath(A.Body.Sun, place, dayStart));
    const moon = zip(computePath(A.Body.Moon, place, dayStart));
    const seasons = A.Seasons(wallClock(dayStart, tz).year);
    const solstices = [seasons.jun_solstice.date, seasons.dec_solstice.date].map((d) => zip(computePath(A.Body.Sun, place, startOfDay(d, tz))));
    const day = computeSunDay(place, dayStart);
    return { sun, moon, solstices, day };
  }, [place, dayStart, tz]);

  const tMs = dayStartMs + minute * MIN_MS;
  const selected = useMemo(() => {
    const t = new Date(tMs);
    const obs = observer(place);
    return { t, sun: sunPosition(t, obs), moon: moonPosition(t, obs), phase: moonState(t) };
  }, [tMs, place]);

  // ---- pose ----
  const [pose, setPose] = useState<Pose>({ az: selected.sun.alt > -10 ? selected.sun.az : selected.moon.az, alt: 15, roll: 0 });
  const [vfov, setVfov] = useState(70);
  const declination = useRef(0);
  const offset = useRef({ az: 0, alt: 0 });
  const smooth = useRef<Pose | null>(null);
  const poseRef = useRef(pose);
  const vfovRef = useRef(vfov);
  useEffect(() => {
    vfovRef.current = vfov;
  }, [vfov]);
  // Sensors, drags and glides can all move the view several times per frame; the sky (a few
  // thousand SVG nodes) re-renders at most once per frame with the latest pose.
  const poseFrame = useRef<number | null>(null);
  const commitPose = (next: Pose) => {
    poseRef.current = next;
    if (poseFrame.current != null) return;
    poseFrame.current = requestAnimationFrame(() => {
      poseFrame.current = null;
      setPose(poseRef.current);
    });
  };
  useEffect(
    () => () => {
      if (poseFrame.current != null) cancelAnimationFrame(poseFrame.current);
    },
    [],
  );

  // As a tab this screen stays mounted: run the camera and sensors only while it is in front.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      const fresh = new Date();
      setNow(fresh);
      setCursor({ dayShift: 0, minute: wallClock(fresh, tz).minuteOfDay });
      setLive(true);
      useApp.getState().logArSession();
      return () => {
        setFocused(false);
        setPlaying(false);
      };
    }, [tz]),
  );

  // Live: follow the real clock. The planetarium refreshes often so stars visibly drift.
  useEffect(() => {
    if (!live || !focused) return;
    const id = setInterval(() => {
      const f = new Date();
      setNow(f);
      setCursor({ dayShift: 0, minute: wallClock(f, tz).minuteOfDay });
    }, planetarium ? 2000 : 15000);
    return () => clearInterval(id);
  }, [live, focused, planetarium, tz]);

  // Time-lapse.
  useEffect(() => {
    if (!playing || !focused) return;
    const rate = SPEEDS[speed].rate;
    let last = Date.now();
    const id = setInterval(() => {
      const t = Date.now();
      const dt = (t - last) / 1000;
      last = t;
      setCursor((c) => {
        let m = c.minute + rate * dt;
        let d = c.dayShift;
        while (m >= 1440) {
          m -= 1440;
          d += 1;
        }
        return { dayShift: d, minute: m };
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing, speed, focused]);

  const scrubTo = (m: number) => {
    setLive(false);
    setPlaying(false);
    setCursor((c) => ({ ...c, minute: m }));
  };
  const goLive = () => {
    const f = new Date();
    setNow(f);
    setPlaying(false);
    setLive(true);
    setCursor({ dayShift: 0, minute: wallClock(f, tz).minuteOfDay });
  };
  const jumpTo = (date: Date) => {
    setLive(false);
    setPlaying(false);
    setCursor({ dayShift: daysBetweenKeys(dayKey(now, tz), dayKey(date, tz)), minute: wallClock(date, tz).minuteOfDay });
  };

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
  // In the planetarium the phone can steer the sky without the camera image behind it.
  const showFeed = !planetarium || P.cameraFeed;

  useEffect(() => {
    if (mode !== 'camera' || !sensorsOk || !focused) return;
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
      const roll = next.roll > 180 ? next.roll - 360 : next.roll;
      const cur = poseRef.current;
      // A phone at rest still reports noise: don't redraw the sky for it.
      if (Math.abs(angleDiff(next.az, cur.az)) < 0.03 && Math.abs(next.alt - cur.alt) < 0.03 && Math.abs(roll - cur.roll) < 0.08) return;
      commitPose({ az: next.az, alt: next.alt, roll });
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
  }, [mode, sensorsOk, focused]);

  // ---- virtual sky motion: drag, fling with inertia, glide to targets ----
  // The planetarium can look all the way down: the sky continues under the ground.
  const minAlt = useRef(-30);
  useEffect(() => {
    minAlt.current = planetarium ? -85 : -30;
  }, [planetarium]);
  const motion = useRef<number | null>(null);
  const stopMotion = () => {
    if (motion.current != null) cancelAnimationFrame(motion.current);
    motion.current = null;
  };
  useEffect(() => stopMotion, []);
  const glideTo = (az: number, alt: number, fovTarget?: number) => {
    stopMotion();
    const from = { ...poseRef.current };
    const f0 = vfovRef.current;
    const dAz = angleDiff(az, from.az);
    const toAlt = clamp(alt, minAlt.current, 85);
    const dur = clamp(500 + Math.hypot(dAz, toAlt - from.alt) * 4, 600, 1300);
    const t0 = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / dur);
      const e = easeInOut(k);
      const next = { az: wrap360(from.az + dAz * e), alt: from.alt + (toAlt - from.alt) * e, roll: 0 };
      commitPose(next);
      if (fovTarget) setVfov(f0 + (fovTarget - f0) * e);
      motion.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    motion.current = requestAnimationFrame(step);
  };
  const fling = (vx: number, vy: number) => {
    stopMotion();
    const degPerPx = vfovRef.current / height;
    let vAz = -vx * degPerPx;
    let vAlt = vy * degPerPx;
    if (Math.hypot(vAz, vAlt) < 6) return;
    let last = Date.now();
    const step = () => {
      const t = Date.now();
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const p = poseRef.current;
      const next = { az: wrap360(p.az + vAz * dt), alt: clamp(p.alt + vAlt * dt, minAlt.current, 85), roll: 0 };
      commitPose(next);
      const decay = Math.exp(-dt * 3.4);
      vAz *= decay;
      vAlt *= decay;
      motion.current = Math.hypot(vAz, vAlt) > 1.5 ? requestAnimationFrame(step) : null;
    };
    motion.current = requestAnimationFrame(step);
  };

  const canZoom = mode === 'virtual' || (planetarium && !showFeed);
  const start = useRef({ az: 0, alt: 0, fov: 70 });
  const beginPan = () => {
    stopMotion();
    start.current = { ...start.current, az: poseRef.current.az, alt: poseRef.current.alt };
  };
  const movePan = (tx: number, ty: number) => {
    const degPerPx = vfovRef.current / height;
    const next = { az: wrap360(start.current.az - tx * degPerPx), alt: clamp(start.current.alt + ty * degPerPx, minAlt.current, 85), roll: 0 };
    commitPose(next);
  };
  const beginPinch = () => {
    stopMotion();
    start.current = { ...start.current, fov: vfovRef.current };
  };
  const movePinch = (s: number) => setVfov(clamp(start.current.fov / s, planetarium ? 18 : 30, 110));
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
    onDeactivate: (e) => {
      'worklet';
      scheduleOnRN(fling, e.velocityX, e.velocityY);
    },
  });
  const pinch = usePinchGesture({
    enabled: canZoom,
    onActivate: () => {
      'worklet';
      scheduleOnRN(beginPinch);
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(movePinch, e.scale);
    },
  });

  const fov = canZoom ? vfov : CAMERA_VFOV;
  const vecProject = useMemo(() => makeVecProjector(pose, width, height, fov), [pose, width, height, fov]);
  const project: Projector = useMemo(
    () => (az: number, alt: number) => vecProject(Math.sin(az * D2R) * Math.cos(alt * D2R), Math.cos(az * D2R) * Math.cos(alt * D2R), Math.sin(alt * D2R)),
    [vecProject],
  );

  // ---- planetarium sky for the selected instant ----
  const frame = useMemo(() => (planetarium ? horizonFrame(place, new Date(tMs)) : null), [planetarium, place, tMs]);
  const trailIdx = useMemo(() => trailStars(), []);
  const trails = useMemo(() => (frame && P.trails ? starTrails(place, frame.time, trailIdx) : null), [frame, P.trails, place, trailIdx]);
  const visibility: SkyVisibility = useMemo(() => {
    const dark = P.atmosphere ? clamp((-selected.sun.alt - 2) / 13, 0, 1) : 1;
    const base = fov > 95 ? 4.4 : fov > 60 ? 4.8 : 5.0;
    return { dark, magLimit: P.atmosphere ? lerp(-1.2, base, (-selected.sun.alt + 2) / 17) : base };
  }, [P.atmosphere, selected.sun.alt, fov]);
  const groundOn = mode === 'virtual' ? !planetarium || P.ground : planetarium && !showFeed && P.ground;
  const groundTint = groundOn ? (planetarium ? 0.55 : 0.86) : planetarium && !(mode === 'camera' && showFeed) ? 0.2 : 0;

  const bodies = useMemo(
    () => ({ sun: enuFromAltAz(selected.sun.alt, selected.sun.az), moon: enuFromAltAz(selected.moon.alt, selected.moon.az) }),
    [selected],
  );

  // Constellation under the crosshair (IAU boundaries), with a tick as you cross into a new one.
  // Rounded to half a degree so the boundary lookup doesn't run on every sensor sample.
  const centreAz = Math.round(pose.az * 2) / 2;
  const centreAlt = Math.round(pose.alt * 2) / 2;
  const crosshairConst = useMemo(() => {
    if (!frame) return null;
    const [e, n, u] = enuFromAltAz(centreAlt, centreAz);
    return constellationAt(frame, e, n, u);
  }, [frame, centreAz, centreAlt]);
  const lastConst = useRef<string | null>(null);
  useEffect(() => {
    if (crosshairConst && lastConst.current && crosshairConst !== lastConst.current && !playing) haptic.tick();
    lastConst.current = crosshairConst;
  }, [crosshairConst, playing]);
  const cat = catalog();
  const crosshairName = crosshairConst ? cat.constellationById.get(crosshairConst)?.name : null;
  const highlight = P.lines ? (selectedId && kindOf(selectedId) === 'constellation' ? selectedId.slice(6) : crosshairConst) : null;

  // Selected target: screen position, lock-on and the info card.
  const target = useMemo(() => {
    if (!frame || !selectedId) return null;
    const v = targetEnu(frame, selectedId, bodies);
    if (!v) return null;
    const pos = altAz(v[0], v[1], v[2]);
    const s = vecProject(v[0], v[1], v[2]);
    const visible = Number.isFinite(s.x) && s.x > 0 && s.x < width && s.y > 0 && s.y < height;
    return { ...pos, x: s.x, y: s.y, visible, locked: visible && Math.hypot(s.x - width / 2, s.y - height / 2) < LOCK_PX };
  }, [frame, selectedId, bodies, vecProject, width, height]);
  const info = useMemo(
    () => (frame && selectedId ? describeTarget(frame, selectedId, { moonIllum: selected.phase.illumination, moonDistKm: selected.phase.distanceKm }) : null),
    [frame, selectedId, selected.phase],
  );
  const planBucket = Math.floor(tMs / (10 * MIN_MS));
  const plan = useMemo(() => {
    if (!selectedId || !planetarium) return null;
    const at = targetEqjAt(selectedId, place);
    return at ? planViewing(place, new Date(planBucket * 10 * MIN_MS), at) : null;
  }, [selectedId, planetarium, place, planBucket]);
  const wasLocked = useRef(false);
  useEffect(() => {
    const locked = !!target?.locked;
    if (locked && !wasLocked.current) haptic.success();
    wasLocked.current = locked;
  }, [target?.locked]);

  const pointAt = (id: TargetId, after?: { alt: number; az: number }) => {
    if (!frame) return;
    const v = targetEnu(frame, id, bodies);
    if (!v) return;
    const { alt, az } = after ?? altAz(v[0], v[1], v[2]);
    if (mode !== 'virtual') return; // the edge arrow guides the phone instead
    const kind = kindOf(id);
    const fovTarget = kind === 'constellation' ? 70 : kind === 'dso' ? 48 : vfovRef.current > 85 ? 65 : undefined;
    glideTo(az, alt, fovTarget);
  };

  const select = (id: TargetId | null, glide = false) => {
    setSelectedId(id);
    if (id && glide) pointAt(id);
  };

  // "Ver no céu" from an object's page: select it and point there.
  const onRequest = useEffectEvent((id: TargetId) => {
    if (!frame) return;
    useSkyIntent.setState({ target: null });
    select(id, true);
  });
  useEffect(
    () =>
      useSkyIntent.subscribe((st) => {
        if (st.target) onRequest(st.target);
      }),
    [],
  );

  // After jumping to the best time, glide again: the target has moved.
  const pendingGlide = useRef(false);
  useEffect(() => {
    if (!pendingGlide.current || !selectedId || !frame) return;
    pendingGlide.current = false;
    pointAt(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  const togglePlanetarium = () => {
    const on = !planetarium;
    haptic.medium();
    setPlanetarium(on);
    setSelectedId(null);
    setShowLayers(false);
    if (on) {
      setHint(mode === 'camera' ? 'Aponte para o céu e toque numa estrela para saber o que é.' : 'Arraste o céu, faça pinça e toque numa estrela para saber o que é.');
      if (mode === 'virtual' && pose.alt < 20) glideTo(pose.az, 35);
    } else setPlaying(false);
  };

  // ---- tap: calibrate, or pick what is under the finger ----
  const hitTest = (x: number, y: number) => {
    if (!frame) return;
    let best: { id: TargetId; score: number } | null = null;
    const consider = (id: TargetId, e: number, n: number, u: number, radiusPx: number, bonus: number) => {
      const s = vecProject(e, n, u);
      if (!Number.isFinite(s.x)) return;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > radiusPx) return;
      const score = d - bonus;
      if (!best || score < best.score) best = { id, score };
    };
    if (P.planets) for (const p of frame.planets) consider(`planet:${p.id}`, p.enu[0], p.enu[1], p.enu[2], 44, 14);
    if (layers.moon) consider('moon', bodies.moon[0], bodies.moon[1], bodies.moon[2], 44, 16);
    if (layers.sun) consider('sun', bodies.sun[0], bodies.sun[1], bodies.sun[2], 48, 16);
    if (P.deepSky) for (const d of frame.dsos) consider(`dso:${d.dso.id}`, d.enu[0], d.enu[1], d.enu[2], 36, 6);
    if (P.milkyWay) consider('galactic', frame.galacticCenter[0], frame.galacticCenter[1], frame.galacticCenter[2], 36, 6);
    if (P.trails) {
      const pole = frame.latitude < 0 ? frame.south : frame.north;
      consider('pole', pole[0], pole[1], pole[2], 36, 6);
    }
    for (let i = 0; i < cat.count && cat.mag[i] <= visibility.magLimit; i++) {
      const bonus = (4 - cat.mag[i]) * 2.5 + (cat.namedByIndex.has(i) ? 6 : 0);
      consider(`star:${i}`, frame.stars[i * 3], frame.stars[i * 3 + 1], frame.stars[i * 3 + 2], 30, bonus);
    }
    const found = best as { id: TargetId; score: number } | null;
    if (found) {
      haptic.light();
      // The card covers the lower half: bring a low pick up to the crosshair.
      select(found.id, mode === 'virtual' && y > height * 0.52);
      return;
    }
    // Empty sky: select the constellation that region belongs to.
    if (P.lines) {
      const [e, n, u] = makeUnprojector(pose, width, height, fov)(x, y);
      haptic.tick();
      select(`const:${constellationAt(frame, e, n, u)}`);
      return;
    }
    setSelectedId(null);
  };

  const onTap = (x: number, y: number) => {
    if (calibrating) {
      // Treat the tapped point as where the sun really is: shift the pose so the sun projects there.
      const degPerPx = fov / height;
      const dx = x - sunScreen.x;
      const dy = y - sunScreen.y;
      offset.current = { az: offset.current.az - dx * degPerPx, alt: offset.current.alt + dy * degPerPx };
      haptic.success();
      setCalibrating(false);
      return;
    }
    if (planetarium) hitTest(x, y);
  };
  const tap = useTapGesture({
    maxDeltaX: 12,
    maxDeltaY: 12,
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(onTap, e.x, e.y);
    },
  });
  const gestures = useSimultaneousGestures(pan, pinch, tap);

  // ---- geometry ----
  const geo = useMemo(() => {
    const horizonPts = Array.from({ length: 73 }, (_, i) => ({ az: i * 5, alt: 0 }));
    const horizon = polylines(horizonPts, project, width, height).sort((a, b) => b.length - a.length);
    const ring = (alt: number) => polylines(Array.from({ length: 73 }, (_, i) => ({ az: i * 5, alt })), project, width, height);
    const above = (pts: { az: number; alt: number }[]) => pts.map((p) => (p.alt >= -1 ? p : { ...p, alt: NaN }));
    const below = (pts: { az: number; alt: number }[]) => pts.map((p) => (p.alt <= 1 ? p : { ...p, alt: NaN }));
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
    return {
      horizon,
      grid: layers.grid ? [...ring(30), ...ring(60)] : [],
      sunAbove: split(above(data.sun)),
      sunBelow: split(below(data.sun)),
      sunHours: hourMarks(data.sun),
      moonAbove: split(above(data.moon)),
      solstices: layers.solstices ? data.solstices.map((p) => split(above(p))) : [],
      cardinals,
      ticks,
    };
  }, [project, width, height, data, layers.grid, layers.solstices]);

  const sunScreen = project(selected.sun.az, selected.sun.alt);
  const moonScreen = project(selected.moon.az, selected.moon.alt);
  const onScreen = (s: { x: number; y: number }) => Number.isFinite(s.x) && s.x > 0 && s.x < width && s.y > 0 && s.y < height;
  // In the planetarium the ground is see-through: bodies under it stay, dimmed like the stars.
  const underGround = (alt: number) => (planetarium && groundOn && alt < -0.5 ? 0.42 : 1);
  const sunVisible = layers.sun && onScreen(sunScreen);
  const moonVisible = layers.moon && onScreen(moonScreen);
  const sunEdge = layers.sun && !sunVisible && !planetarium ? edgeIndicator(pose, selected.sun.az, selected.sun.alt, width, height) : null;
  const targetEdge = target && !target.visible ? edgeIndicator(pose, target.az, target.alt, width, height) : null;

  const lastLocked = useRef(false);
  useEffect(() => {
    const locked = sunVisible && Math.abs(sunScreen.x - width / 2) < 40 && Math.abs(sunScreen.y - height / 2) < 40;
    if (locked && !lastLocked.current && !planetarium) haptic.light();
    lastLocked.current = locked;
  }, [sunVisible, sunScreen.x, sunScreen.y, width, height, planetarium]);

  const enableCamera = async () => {
    // Pointing the planetarium only needs the motion sensors.
    if (planetarium && !P.cameraFeed && sensorsOk) {
      haptic.light();
      setMode('camera');
      return;
    }
    const res = cameraPerm?.granted ? cameraPerm : await requestCamera();
    if (res?.granted && sensorsOk) {
      haptic.light();
      setMode('camera');
    } else haptic.warning();
  };

  const cameraBlocked = mode === 'camera' && showFeed && !cameraPerm?.granted;
  const planetsUp = frame ? frame.planets.filter((p) => p.alt > 0 && p.mag < 6.5).length : 0;
  const timeLabel = formatMinuteOfDay(minute, use24h);
  const ground = groundTint > 0;
  const dayLabel = dayShift === 0 ? null : dayShift === 1 ? 'amanhã' : dayShift === -1 ? 'ontem' : formatDate(dayStart, tz, 'compact');

  const findRows: FindRow[] = useMemo(() => {
    if (!finding || !frame) return [];
    return searchIndex(place.latitude < 0).map((r) => {
      const v = targetEnu(frame, r.id, bodies);
      const pos = v ? altAz(v[0], v[1], v[2]) : null;
      const kind = kindOf(r.id);
      const color =
        kind === 'planet'
          ? PLANETS.find((p) => `planet:${p.id}` === r.id)?.color
          : kind === 'star'
            ? starColor(cat.bv[Number(r.id.slice(5))])
            : kind === 'dso'
              ? '#CDBBFF'
              : kind === 'constellation' || kind === 'asterism'
                ? '#93A6F0'
                : kind === 'moon'
                  ? colors.moon
                  : colors.accent;
      return { ...r, alt: pos?.alt ?? null, az: pos?.az ?? null, color };
    });
  }, [finding, frame, bodies, place.latitude, cat]);

  const background =
    mode === 'camera' && showFeed && cameraPerm?.granted && focused ? (
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
    ) : planetarium && !P.atmosphere ? (
      <DeepSky />
    ) : (
      <VirtualSky sunAlt={selected.sun.alt} />
    );

  return (
    <View style={styles.root}>
      {background}
      {mode === 'camera' && showFeed ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: planetarium ? 'rgba(2,4,16,0.55)' : 'rgba(4,8,30,0.18)' }]} pointerEvents="none" />
      ) : null}

      <GestureDetector gesture={gestures}>
        <View style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height} pointerEvents="none">
            {frame ? (
              <PlanetariumSky
                frame={frame}
                trails={trails}
                trailIndices={trailIdx}
                project={vecProject}
                width={width}
                height={height}
                fov={fov}
                layers={P}
                visibility={visibility}
                cull={false}
                highlight={highlight}
                selected={selectedId}
              />
            ) : null}
            {ground && geo.horizon.length ? (
              <Path d={`${geo.horizon[0]} L${width + 400},${height + 400} L-400,${height + 400} Z`} fill={planetarium ? '#03050F' : 'rgb(4,7,20)'} fillOpacity={groundTint} />
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
                <SvgText x={c.x} y={c.y + 20} fontSize={c.l.length === 1 ? 15 : 12} fontWeight={weight.bold} fill={c.l === 'N' ? colors.accent : '#FFFFFF'} textAnchor="middle">
                  {c.l}
                </SvgText>
              </G>
            ))}
            {geo.solstices.map((segs, i) =>
              segs.map((d, j) => (
                <Path key={`s${i}${j}`} d={d} stroke={i === 0 ? '#FF8A6B' : '#8FB4FF'} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 6" fill="none" />
              )),
            )}
            {layers.moon && !planetarium
              ? geo.moonAbove.map((d, i) => <Path key={`m${i}`} d={d} stroke={colors.moon} strokeOpacity={0.8} strokeWidth={2} strokeDasharray="3 7" strokeLinecap="round" fill="none" />)
              : null}
            {layers.sun && !planetarium ? (
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
                    <SvgText x={h.x + 9} y={h.y - 8} fontSize={11} fontWeight={weight.bold} fill="#FFFFFF">
                      {use24h ? `${h.h}h` : `${h.h % 12 || 12}${h.h < 12 ? 'a' : 'p'}`}
                    </SvgText>
                  </G>
                ))}
              </>
            ) : null}
            {target?.visible && info ? <SelectionRing x={target.x} y={target.y} color={info.color} locked={target.locked} /> : null}
            {calibrating ? <Circle cx={width / 2} cy={height / 2} r={26} stroke="#FFFFFF" strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
            <Line x1={width / 2 - 10} y1={height / 2} x2={width / 2 + 10} y2={height / 2} stroke="#FFFFFF" strokeOpacity={0.7} />
            <Line x1={width / 2} y1={height / 2 - 10} x2={width / 2} y2={height / 2 + 10} stroke="#FFFFFF" strokeOpacity={0.7} />
          </Svg>
          {moonVisible ? (
            <View pointerEvents="none" style={[styles.body, { left: moonScreen.x - 22, top: moonScreen.y - 22, opacity: underGround(selected.moon.alt) }]}>
              <MoonGlyph size={44} angle={selected.phase.angle} southern={place.latitude < 0} />
            </View>
          ) : null}
          {sunVisible ? (
            <View pointerEvents="none" style={[styles.body, { left: sunScreen.x - 30, top: sunScreen.y - 30, opacity: underGround(selected.sun.alt) }]}>
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
          {targetEdge && info ? (
            <View pointerEvents="none" style={[styles.targetEdge, { left: targetEdge.x - 22, top: targetEdge.y - 22 }]}>
              <View style={[styles.targetArrow, { transform: [{ rotate: `${targetEdge.rotation}deg` }] }]}>
                <Icon name="arrowUp" size={16} color={colors.onPrimary} weight="heavy" />
              </View>
              <View style={styles.targetTag}>
                <Text variant="caption" numberOfLines={1}>
                  {info.title} · {Math.round(targetEdge.distance)}°
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {/* Scrims keep the controls legible over a busy sky. */}
      {planetarium ? (
        <>
          <LinearGradient pointerEvents="none" colors={['rgba(2,4,14,0.6)', 'rgba(2,4,14,0)']} style={[styles.scrimTop, { height: insets.top + 120 }]} />
          <LinearGradient pointerEvents="none" colors={['rgba(2,4,14,0)', 'rgba(2,4,14,0.72)']} style={[styles.scrimBottom, { height: insets.bottom + TAB_BAR_HEIGHT + 190 }]} />
        </>
      ) : null}

      {/* Top HUD */}
      <View style={[styles.hudTop, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <View style={styles.hudRow} pointerEvents="box-none">
          <HudButton icon="stars" label={planetarium ? 'Sair do planetário' : 'Planetário'} onPress={togglePlanetarium} active={planetarium} />
          <View style={styles.modeSwitch}>
            {(['camera', 'virtual'] as Mode[]).map((m) => (
              <PressableScale
                key={m}
                onPress={() => (m === 'camera' ? enableCamera() : setMode('virtual'))}
                hapticOnPress="tick"
                style={[styles.modeBtn, mode === m && styles.modeBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}>
                <Text variant="subhead" color={mode === m ? colors.onPrimary : colors.text} style={{ fontWeight: '600' }}>
                  {m === 'camera' ? (showFeed ? 'Câmera' : 'Apontar') : 'Céu virtual'}
                </Text>
              </PressableScale>
            ))}
          </View>
          <HudButton icon="layers" label="Camadas" onPress={() => setShowLayers((v) => !v)} active={showLayers} />
        </View>
        <View style={styles.headingPill}>
          {planetarium && crosshairName ? (
            <Animated.View key={crosshairName} entering={FadeIn.duration(220)}>
              <Text variant="headline" align="center">
                {crosshairName}
              </Text>
            </Animated.View>
          ) : (
            <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
              {Math.round(pose.az)}° {compassPoint(pose.az)}
            </Text>
          )}
          <Text variant="caption" color={colors.textSecondary} style={{ fontVariant: ['tabular-nums'] }}>
            {planetarium && crosshairName ? `${Math.round(pose.az)}° ${compassPoint(pose.az)} · ` : ''}
            {pose.alt >= 0 ? `↑ ${formatDegrees(pose.alt)}` : `${formatDegrees(-pose.alt)} abaixo do horizonte`}
          </Text>
        </View>
        {showLayers ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.layersPanel}>
            {planetarium ? (
              <>
                <Text variant="footnote" color={colors.textSecondary} style={styles.layersHead}>
                  No céu
                </Text>
                <View style={styles.layers}>
                  <LayerToggle icon="constellation" label="Constelações" on={P.lines} onPress={() => setPrefs({ lines: !P.lines })} />
                  <LayerToggle icon="text" label="Nomes" on={P.labels} onPress={() => setPrefs({ labels: !P.labels })} />
                  <LayerToggle icon="galaxy" label="Via Láctea" on={P.milkyWay} onPress={() => setPrefs({ milkyWay: !P.milkyWay })} />
                  <LayerToggle icon="orbit" label="Planetas" on={P.planets} onPress={() => setPrefs({ planets: !P.planets })} />
                  <LayerToggle icon="telescope" label="Céu profundo" on={P.deepSky} onPress={() => setPrefs({ deepSky: !P.deepSky })} />
                  <LayerToggle icon="trails" label="Rastros" on={P.trails} onPress={() => {
                    if (!P.trails) setHint(`Simulando 2 h de exposição: as estrelas giram em volta do ${place.latitude < 0 ? 'polo sul' : 'polo norte'} celeste. Dê play para ver o céu girar.`);
                    setPrefs({ trails: !P.trails });
                  }} />
                  <LayerToggle icon="ecliptic" label="Eclíptica" on={P.ecliptic} onPress={() => setPrefs({ ecliptic: !P.ecliptic })} />
                  <LayerToggle icon="sun" label="Sol" on={layers.sun} onPress={() => setLayers((l) => ({ ...l, sun: !l.sun }))} />
                  <LayerToggle icon="moon" label="Lua" on={layers.moon} onPress={() => setLayers((l) => ({ ...l, moon: !l.moon }))} />
                </View>
                <Text variant="footnote" color={colors.textSecondary} style={styles.layersHead}>
                  Visual
                </Text>
                <View style={styles.layers}>
                  <LayerToggle icon="mountain" label="Chão translúcido" on={P.ground} onPress={() => setPrefs({ ground: !P.ground })} />
                  <LayerToggle icon="atmosphere" label="Atmosfera" on={P.atmosphere} onPress={() => setPrefs({ atmosphere: !P.atmosphere })} />
                  {mode === 'camera' ? <LayerToggle icon="camera" label="Câmera ao fundo" on={P.cameraFeed} onPress={() => setPrefs({ cameraFeed: !P.cameraFeed })} /> : null}
                  <LayerToggle icon="nightVision" label="Visão noturna" on={P.nightVision} onPress={() => setPrefs({ nightVision: !P.nightVision })} />
                  <LayerToggle icon="compass" label="Grade" on={layers.grid} onPress={() => setLayers((l) => ({ ...l, grid: !l.grid }))} />
                </View>
              </>
            ) : (
              <View style={styles.layers}>
                <LayerToggle icon="sun" label="Sol" on={layers.sun} onPress={() => setLayers((l) => ({ ...l, sun: !l.sun }))} />
                <LayerToggle icon="moon" label="Lua" on={layers.moon} onPress={() => setLayers((l) => ({ ...l, moon: !l.moon }))} />
                <LayerToggle icon="calendar" label="Solstícios" on={layers.solstices} onPress={() => setLayers((l) => ({ ...l, solstices: !l.solstices }))} />
                <LayerToggle icon="compass" label="Grade" on={layers.grid} onPress={() => setLayers((l) => ({ ...l, grid: !l.grid }))} />
              </View>
            )}
          </Animated.View>
        ) : null}
        {layers.solstices && !planetarium ? (
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
        {hint && !showLayers ? (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(300)} style={styles.notice}>
            <Icon name="sparkle" size={14} color={colors.accent} />
            <Text variant="footnote" style={{ flexShrink: 1 }}>
              {hint}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {/* Bottom HUD */}
      <View style={[styles.hudBottom, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT - space.md }]} pointerEvents="box-none">
        {planetarium && info && target && selectedId ? (
          <TargetCard
            key={selectedId}
            info={info}
            alt={target.alt}
            az={target.az}
            plan={plan}
            tz={tz}
            use24h={use24h}
            locked={target.locked}
            onClose={() => setSelectedId(null)}
            onDetails={() => router.push({ pathname: '/object/[id]', params: { id: selectedId } })}
            favorite={favorites.includes(selectedId)}
            onToggleFavorite={() => toggleFavorite(selectedId)}
            onBestTime={(t) => {
              haptic.medium();
              pendingGlide.current = true;
              jumpTo(t);
            }}
          />
        ) : planetarium && frame ? (
          <View style={styles.infoRow}>
            <InfoChip icon={selected.sun.alt > -6 ? 'sunHorizon' : 'stars'} label={LIGHT_PHASE_LABEL[lightPhase(selected.sun.alt)]} />
            <PressableScale onPress={() => setFinding(true)} hapticOnPress="soft" accessibilityRole="button" accessibilityLabel="Planetas visíveis">
              <InfoChip icon="orbit" label={planetsUp === 1 ? '1 planeta visível' : `${planetsUp} planetas visíveis`} highlight={planetsUp > 0} />
            </PressableScale>
          </View>
        ) : (
          <View style={styles.infoRow}>
            <InfoChip icon="sunrise" label={formatTime(data.day.sunrise, tz, use24h)} />
            <InfoChip icon="sun" label={`${formatDegrees(selected.sun.az)} · ${formatDegrees(selected.sun.alt)}`} highlight />
            <InfoChip icon="sunset" label={formatTime(data.day.sunset, tz, use24h)} />
          </View>
        )}
        <TimeScrubber
          minute={minute}
          nowMinute={dayShift === 0 ? nowMinute : null}
          live={live}
          dayLabel={dayLabel}
          onChange={scrubTo}
          onNow={goLive}
          use24h={use24h}
          sunrise={data.day.sunrise ? wallClock(data.day.sunrise, tz).minuteOfDay : null}
          sunset={data.day.sunset ? wallClock(data.day.sunset, tz).minuteOfDay : null}
          accessory={
            planetarium ? (
              <>
                {playing ? (
                  <PressableScale onPress={() => setSpeed((s) => (s + 1) % SPEEDS.length)} hapticOnPress="tick" style={styles.speed} accessibilityRole="button" accessibilityLabel="Velocidade">
                    <Text variant="footnote" style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>
                      {SPEEDS[speed].label}
                    </Text>
                  </PressableScale>
                ) : null}
                <PressableScale
                  onPress={() => {
                    setLive(false);
                    setPlaying((p) => !p);
                  }}
                  hapticOnPress="soft"
                  accessibilityRole="button"
                  accessibilityLabel={playing ? 'Pausar' : 'Acelerar o tempo'}
                  style={[styles.roundAction, playing && { backgroundColor: colors.primary }]}>
                  <Icon name={playing ? 'pause' : 'play'} size={14} color={playing ? colors.onPrimary : colors.text} />
                </PressableScale>
                {mode === 'camera' && showFeed && !playing ? (
                  <PressableScale
                    onPress={() => setCalibrating((c) => !c)}
                    hapticOnPress="soft"
                    style={[styles.roundAction, calibrating && { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel="Calibrar com o sol">
                    <Icon name="viewfinder" size={15} color={calibrating ? colors.onPrimary : colors.text} />
                  </PressableScale>
                ) : null}
                <PressableScale onPress={() => setFinding(true)} hapticOnPress="soft" style={styles.roundAction} accessibilityRole="button" accessibilityLabel="Encontrar no céu">
                  <Icon name="search" size={15} color={colors.text} />
                </PressableScale>
              </>
            ) : null
          }
        />
        {!planetarium ? (
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
        ) : null}
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
      {sensorsOk === false && mode === 'virtual' && showSensorNote && !hint ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(400)} style={[styles.sensorNote, { top: insets.top + 150 }]} pointerEvents="none">
          <Text variant="caption" color={colors.textSecondary} align="center">
            Sensores de movimento indisponíveis neste aparelho. Mostrando o céu virtual.
          </Text>
        </Animated.View>
      ) : null}

      {finding && frame ? (
        <FindSheet
          rows={findRows}
          favorites={favorites}
          onClose={() => setFinding(false)}
          onPick={(id) => {
            setFinding(false);
            haptic.light();
            select(id, true);
          }}
        />
      ) : null}

      {/* Night vision: a red multiply over everything keeps the eyes dark-adapted. */}
      {planetarium && P.nightVision ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.nightVision]} /> : null}
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

/** The planetarium dome: no atmosphere, just a deep night that lifts slightly towards the horizon. */
function DeepSky() {
  return (
    <Animated.View entering={FadeIn.duration(600)} style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#010208', '#03051A', '#0A0F2E']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function SelectionRing({ x, y, color, locked }: { x: number; y: number; color: string; locked: boolean }) {
  const r = locked ? 20 : 17;
  const tick = (a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return `M${x + c * (r + 3)} ${y + s * (r + 3)}L${x + c * (r + 9)} ${y + s * (r + 9)}`;
  };
  return (
    <G>
      {locked ? <Circle cx={x} cy={y} r={r + 10} fill={colors.accent} opacity={0.14} /> : null}
      <Circle cx={x} cy={y} r={r} stroke={locked ? colors.accent : color} strokeWidth={1.6} fill="none" />
      <Path d={[0, 0.5, 1, 1.5].map((k) => tick(k * Math.PI)).join('')} stroke={locked ? colors.accent : color} strokeWidth={1.6} strokeLinecap="round" />
    </G>
  );
}

function HudButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <PressableScale onPress={onPress} hapticOnPress="soft" accessibilityLabel={label} accessibilityRole="button" style={[styles.hudBtn, active && { backgroundColor: colors.primary }]}>
      <Icon name={icon} size={17} color={active ? colors.onPrimary : colors.text} />
    </PressableScale>
  );
}

function LayerToggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} hapticOnPress="tick" style={[styles.layerChip, on && styles.layerChipOn]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <Icon name={icon} size={14} color={on ? colors.onPrimary : colors.text} />
      <Text variant="subhead" color={on ? colors.onPrimary : colors.text}>
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
  live,
  dayLabel,
  onChange,
  onNow,
  use24h,
  sunrise,
  sunset,
  accessory,
}: {
  minute: number;
  /** Null when the cursor is on another day. */
  nowMinute: number | null;
  live: boolean;
  dayLabel: string | null;
  onChange: (m: number) => void;
  onNow: () => void;
  use24h: boolean;
  sunrise: number | null;
  sunset: number | null;
  /** Controls at the end of the header row. */
  accessory?: ReactNode;
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
  const off = !live && (nowMinute == null || Math.abs(minute - nowMinute) > 3);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.scrubHeader}>
        <View style={styles.scrubTime}>
          <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
            {formatMinuteOfDay(minute, use24h)}
          </Text>
          {dayLabel ? (
            <Text variant="footnote" color={colors.accent}>
              {dayLabel}
            </Text>
          ) : live ? (
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text variant="footnote" color={colors.textSecondary}>
                Ao vivo
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.scrubActions}>
          {off ? (
            <PressableScale onPress={onNow} hapticOnPress="soft" style={styles.nowPill} accessibilityRole="button">
              <Text variant="label" color={colors.onPrimary}>
                Agora
              </Text>
            </PressableScale>
          ) : null}
          {accessory}
        </View>
      </View>
      <GestureDetector gesture={pan}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.track} accessibilityLabel="Horário" accessibilityRole="adjustable">
          {sunrise != null && sunset != null && width ? (
            <View style={[styles.daySpan, { left: (sunrise / 1440) * width, width: ((sunset - sunrise) / 1440) * width }]} />
          ) : null}
          {nowMinute != null ? <View style={[styles.nowTick, { left: (nowMinute / 1440) * width - 1 }]} /> : null}
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
  targetEdge: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  targetArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(246,245,242,0.45)' },
  targetTag: { position: 'absolute', top: 48, backgroundColor: glassBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, minWidth: 90, alignItems: 'center' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  hudTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md, gap: space.sm, alignItems: 'center' },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  hudBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: glassBg, alignItems: 'center', justifyContent: 'center' },
  modeSwitch: { flexDirection: 'row', backgroundColor: glassBg, borderRadius: radius.pill, padding: 4, gap: 4 },
  modeBtn: { paddingHorizontal: space.sm, height: 34, borderRadius: radius.pill, justifyContent: 'center' },
  modeBtnOn: { backgroundColor: colors.primary },
  headingPill: { alignItems: 'center', backgroundColor: glassBg, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, minWidth: 120 },
  layersPanel: { alignSelf: 'stretch', gap: space.xs, backgroundColor: 'rgba(8,12,34,0.72)', borderRadius: radius.card, padding: space.sm },
  layersHead: { paddingHorizontal: space.xxs },
  layers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  layerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, height: 36, borderRadius: radius.pill, backgroundColor: glassBg },
  layerChipOn: { backgroundColor: colors.primary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: glassBg, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: glassBg, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.tile, maxWidth: 340 },
  hudBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, gap: space.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: glassBg, paddingHorizontal: space.sm, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', minHeight: 36, justifyContent: 'center', gap: space.xs },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: glassBg, paddingHorizontal: space.md, height: 36, borderRadius: radius.pill },
  roundAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: glassBg, alignItems: 'center', justifyContent: 'center' },
  scrubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.xxs, minHeight: 36 },
  scrubTime: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  scrubActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center' },
  speed: { height: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: glassBg, justifyContent: 'center' },
  nowPill: { backgroundColor: colors.primary, paddingHorizontal: space.sm, height: 30, justifyContent: 'center', borderRadius: radius.pill },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  track: { height: 44, borderRadius: radius.pill, backgroundColor: glassBg, justifyContent: 'center', overflow: 'visible' },
  daySpan: { position: 'absolute', top: 18, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,182,72,0.45)' },
  nowTick: { position: 'absolute', top: 12, width: 2, height: 20, borderRadius: 1, backgroundColor: '#FFFFFF' },
  thumb: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' },
  thumbDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF3D6' },
  blocker: { backgroundColor: 'rgba(4,7,22,0.94)', alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  sensorNote: { position: 'absolute', left: space.xl, right: space.xl },
  nightVision: { backgroundColor: '#FF1A00', mixBlendMode: 'multiply' },
});
