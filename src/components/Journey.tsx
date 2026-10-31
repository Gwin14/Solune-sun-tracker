import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { haptic } from "@/lib/haptics";
import { colors } from "@/theme/tokens";

import { SunGlyph } from "./SunGlyph";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Where each station sits, in screen units (x right, y down), and how the trail reaches it. */
const STATIONS = [
  { x: 0, y: 0 },
  { x: 1.25, y: -0.55, loop: 1 },
  { x: 2.3, y: 0.35 },
  { x: 3.25, y: -0.45, loop: -1 },
  { x: 4.45, y: 0.15 },
  { x: 5.4, y: -0.6, loop: 1 },
  { x: 6.5, y: 0.25 },
  { x: 7.55, y: -0.2, loop: -1 },
];

const SAMPLES = 120;
const TRAVEL_MS = 1500;
const CAMERA_LAG_MS = 140;

const TRAVEL_EASE = Easing.bezier(0.65, 0, 0.25, 1);

type Geometry = {
  tx: number[];
  ty: number[];
  cx: number[];
  cy: number[];
  len: number[];
  total: number;
  segments: {
    left: number;
    top: number;
    width: number;
    height: number;
    d: string;
    start: number;
    length: number;
  }[];
  anchors: { x: number; y: number }[];
  worldW: number;
  worldH: number;
};

/**
 * Builds the trail. The traveller follows curls and pirouettes; the camera rides a calmer
 * line through the same stations so the screen never spins with the loops.
 */
function buildGeometry(count: number, W: number, H: number): Geometry {
  const pts = STATIONS.slice(0, count).map((s) => ({
    x: s.x * W,
    y: s.y * H * 0.7,
    loop: (s as { loop?: number }).loop ?? 0,
  }));
  const tx: number[] = [];
  const ty: number[] = [];
  const cx: number[] = [];
  const cy: number[] = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const nx = -dy / dist;
    const ny = dx / dist;
    const side = s % 2 ? 1 : -1;
    const loop = b.loop;
    const r = Math.min(W, H) * 0.16;
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / SAMPLES;
      const e = t * t * (3 - 2 * t);
      // Gentle S between stations.
      const wob = Math.sin(Math.PI * t) * dist * 0.22 * side;
      let x = a.x + dx * e + nx * wob;
      let y = a.y + dy * e + ny * wob;
      cx.push(a.x + dx * e + nx * wob * 0.35);
      cy.push(a.y + dy * e + ny * wob * 0.35);
      if (loop) {
        // A full pirouette in the middle of the leg.
        const lt = Math.min(1, Math.max(0, (t - 0.32) / 0.36));
        const ang = lt * Math.PI * 2;
        const ox = Math.sin(ang) * r;
        const oy = (1 - Math.cos(ang)) * r * loop;
        const ux = dx / dist;
        const uy = dy / dist;
        x += ux * ox + nx * oy;
        y += uy * ox + ny * oy;
      }
      tx.push(x);
      ty.push(y);
    }
  }
  const last = pts[pts.length - 1];
  tx.push(last.x);
  ty.push(last.y);
  cx.push(last.x);
  cy.push(last.y);

  // Shift everything into positive world coordinates with room for a full screen around it.
  const minX = Math.min(...tx) - W;
  const minY = Math.min(...ty) - H;
  const maxX = Math.max(...tx) + W;
  const maxY = Math.max(...ty) + H;
  for (let i = 0; i < tx.length; i++) {
    tx[i] -= minX;
    ty[i] -= minY;
    cx[i] -= minX;
    cy[i] -= minY;
  }
  const len: number[] = [0];
  for (let i = 1; i < tx.length; i++)
    len.push(len[i - 1] + Math.hypot(tx[i] - tx[i - 1], ty[i] - ty[i - 1]));
  const segments = Array.from({ length: pts.length - 1 }, (_, sIdx) => {
    const from = sIdx * SAMPLES;
    const to = from + SAMPLES;
    const xs = tx.slice(from, to + 1);
    const ys = ty.slice(from, to + 1);
    const pad = 12;
    const left = Math.min(...xs) - pad;
    const top = Math.min(...ys) - pad;
    return {
      left,
      top,
      width: Math.max(...xs) + pad - left,
      height: Math.max(...ys) + pad - top,
      d: xs
        .map(
          (x, i) =>
            `${i ? "L" : "M"}${(x - left).toFixed(1)},${(ys[i] - top).toFixed(1)}`,
        )
        .join(" "),
      start: len[from],
      length: len[to] - len[from],
    };
  });
  return {
    segments,
    tx,
    ty,
    cx,
    cy,
    len,
    total: len[len.length - 1],
    anchors: pts.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    worldW: maxX - minX,
    worldH: maxY - minY,
  };
}

function sample(arr: number[], p: number): number {
  "worklet";
  const f = Math.max(0, Math.min(arr.length - 1.0001, p * SAMPLES));
  const i = Math.floor(f);
  const t = f - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}

type Props = {
  count: number;
  index: number;
  renderStation: (k: number) => ReactNode;
};

/** A camera flight between onboarding stations along a dotted trail. */
export function Journey({ count, index, renderStation }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const reduce = useReducedMotion();
  const geo = useMemo(() => buildGeometry(count, W, H), [count, W, H]);

  const traveller = useSharedValue(index);
  const camera = useSharedValue(index);
  // The station being left stays mounted until the flight lands (derived during render so
  // it never disappears for a frame).
  const [shown, setShown] = useState<{
    current: number;
    leaving: number | null;
  }>({ current: index, leaving: null });
  if (shown.current !== index)
    setShown({ current: index, leaving: shown.current });
  const leaving = shown.leaving;
  const setLeaving = (v: number | null) =>
    setShown((st) => ({ ...st, leaving: v }));
  const prev = useRef(index);

  useEffect(() => {
    if (prev.current === index) return;
    prev.current = index;
    if (reduce) {
      traveller.set(index);
      camera.set(index);
      return;
    }
    traveller.set(
      withTiming(index, { duration: TRAVEL_MS, easing: TRAVEL_EASE }),
    );
    camera.set(
      withDelay(
        CAMERA_LAG_MS,
        withTiming(
          index,
          { duration: TRAVEL_MS, easing: TRAVEL_EASE },
          (done) => {
            if (done) {
              scheduleOnRN(setLeaving, null);
              scheduleOnRN(haptic.soft);
            }
          },
        ),
      ),
    );
  }, [index, reduce, traveller, camera]);

  const { tx, ty, cx, cy, len } = geo;

  const worldStyle = useAnimatedStyle(() => {
    const c = camera.get();
    const x = sample(cx, c);
    const y = sample(cy, c);
    const flight = Math.sin(Math.PI * (c - Math.floor(c)));
    // Pull back and bank a little while flying, settle flat on arrival.
    const ahead = Math.min(count - 1, Math.floor(c) + 1);
    const heading = Math.atan2(
      sample(cy, ahead) - sample(cy, Math.floor(c)),
      Math.max(1, sample(cx, ahead) - sample(cx, Math.floor(c))),
    );
    return {
      transform: [
        { translateX: W / 2 },
        { translateY: H / 2 },
        { scale: 1 - flight * 0.28 },
        { rotate: `${heading * flight * 0.18}rad` },
        { translateX: -x },
        { translateY: -y },
      ],
    };
  });

  const travellerStyle = useAnimatedStyle(() => {
    const p = traveller.get();
    const flight = Math.sin(Math.PI * (p - Math.floor(p)));
    return {
      opacity: 0.35 + flight * 0.65,
      transform: [
        { translateX: sample(tx, p) - 14 },
        { translateY: sample(ty, p) - 14 },
        { scale: 0.7 + flight * 0.6 },
      ],
    };
  });

  const stations = [index, leaving].filter(
    (k, i, a): k is number => k !== null && a.indexOf(k) === i,
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: geo.worldW,
            height: geo.worldH,
            transformOrigin: "0 0",
          },
          worldStyle,
        ]}
      >
        {geo.segments.map((seg, k) =>
          Math.abs(k + 0.5 - index) < 2.6 ||
          (leaving !== null && Math.abs(k + 0.5 - leaving) < 1.6) ? (
            <TrailSegment key={k} seg={seg} traveller={traveller} len={len} />
          ) : null,
        )}

        {stations.map((k) => (
          <View
            key={k}
            pointerEvents={k === index ? "box-none" : "none"}
            style={{
              position: "absolute",
              left: geo.anchors[k].x - W / 2,
              top: geo.anchors[k].y - H / 2,
              width: W,
              height: H,
            }}
          >
            {renderStation(k)}
          </View>
        ))}

        <Animated.View
          pointerEvents="none"
          style={[styles.traveller, travellerStyle]}
        >
          <View style={styles.trail} />
          <SunGlyph size={18} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  traveller: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  trail: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,200,120,0.3)",
  },
});

/** One leg of the trail: faint dots, plus a golden thread drawn behind the traveller. */
function TrailSegment({
  seg,
  traveller,
  len,
}: {
  seg: Geometry["segments"][number];
  traveller: SharedValue<number>;
  len: number[];
}) {
  const litProps = useAnimatedProps(() => {
    const p = traveller.get();
    const travelled = Math.max(
      0,
      Math.min(seg.length, sample(len, p) - seg.start),
    );
    return { strokeDashoffset: seg.length - travelled };
  });
  // Bright while flying, quiet once landed so it never competes with the station's text.
  const presence = useAnimatedStyle(() => {
    const p = traveller.get();
    return { opacity: 0.28 + Math.sin(Math.PI * (p - Math.floor(p))) * 0.72 };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: seg.left,
          top: seg.top,
          width: seg.width,
          height: seg.height,
        },
        presence,
      ]}
    >
      <Svg width={seg.width} height={seg.height}>
        <Path
          d={seg.d}
          stroke="#FFFFFF"
          strokeOpacity={0.24}
          strokeWidth={3}
          strokeDasharray="0.1 11"
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          d={seg.d}
          stroke={colors.accent}
          strokeOpacity={0.28}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${seg.length} ${seg.length}`}
          animatedProps={litProps}
        />
        <AnimatedPath
          d={seg.d}
          stroke="#FFE2B0"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${seg.length} ${seg.length}`}
          animatedProps={litProps}
        />
      </Svg>
    </Animated.View>
  );
}
