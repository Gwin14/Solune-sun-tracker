import { memo, useMemo, type ReactNode } from 'react';
import { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { catalog, starColor } from '@/astro/sky/catalog';
import type { HorizonFrame } from '@/astro/sky/engine';
import { ASTERISMS } from '@/astro/sky/names';
import type { TargetId } from '@/astro/sky/targets';
import type { VecProjector } from '@/lib/arMath';
import { localeTag, strings } from '@/i18n';
import { colors, weight } from '@/theme/tokens';

export type SkyLayers = {
  lines: boolean;
  labels: boolean;
  milkyWay: boolean;
  planets: boolean;
  deepSky: boolean;
  ecliptic: boolean;
  trails: boolean;
};

export type SkyVisibility = {
  /** Faintest magnitude drawn. */
  magLimit: number;
  /** 0 in full daylight with atmosphere on, 1 in a dark sky. */
  dark: number;
};

type Props = {
  frame: HorizonFrame;
  trails: Float64Array[] | null;
  trailIndices: number[];
  project: VecProjector & { focal: number };
  width: number;
  height: number;
  fov: number;
  layers: SkyLayers;
  visibility: SkyVisibility;
  /** Hide what is below the horizon (the ground is opaque). */
  cull: boolean;
  /** Constellation under the crosshair. */
  highlight: string | null;
  selected: TargetId | null;
};

const LINE = '#7F95E8';
const LINE_HI = '#D5DCFF';
const LABEL = '#93A6F0';
const DSO = '#CDBBFF';
const MW = '#C6CEFF';
/** Milky Way levels: [minimum brightness, disc radius in degrees, opacity]. */
const MW_LEVELS: [number, number, number][] = [
  [0.25, 2.6, 0.032],
  [0.8, 2.4, 0.03],
  [1.3, 2.2, 0.036],
  [1.9, 2.0, 0.042],
  [2.6, 1.8, 0.048],
  [3.4, 1.6, 0.055],
];

type Pt = { x: number; y: number; z: number };

/** Greedy label placement: skip a label whose box overlaps one already placed. */
class Labels {
  boxes: number[] = [];
  fits(x: number, y: number, w: number, h: number) {
    const b = this.boxes;
    for (let i = 0; i < b.length; i += 4) {
      if (x < b[i + 2] && x + w > b[i] && y < b[i + 3] && y + h > b[i + 1]) return false;
    }
    b.push(x, y, x + w, y + h);
    return true;
  }
}

/** SVG text has no inherited font on the web; native uses the system font already. */
const FONT = process.env.EXPO_OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

const textWidth = (s: string, size: number, spacing = 0) => s.length * (size * 0.56 + spacing);

export const PlanetariumSky = memo(function PlanetariumSky({ frame, trails, trailIndices, project, width, height, fov, layers, visibility, cull, highlight, selected }: Props) {
  const cat = catalog();
  // Trails come one array per time step; regroup them once per frame so each star's arc is
  // contiguous and can be walked without copying on every redraw.
  const trailsByStar = useMemo(() => {
    if (!trails?.length) return null;
    const steps = trails.length;
    const n = trails[0].length / 3;
    const out = new Float64Array(n * steps * 3);
    for (let k = 0; k < steps; k++) {
      const src = trails[k];
      for (let s = 0; s < n; s++) {
        const o = (s * steps + k) * 3;
        out[o] = src[s * 3];
        out[o + 1] = src[s * 3 + 1];
        out[o + 2] = src[s * 3 + 2];
      }
    }
    return out;
  }, [trails]);
  const degPx = project.focal * (Math.PI / 180);
  const pt: Pt = { x: 0, y: 0, z: 0 };
  const margin = 40;
  const onScreen = (p: Pt, m = margin) => p.x > -m && p.x < width + m && p.y > -m && p.y < height + m;
  const maxJump = Math.max(width, height) * 1.2;
  const maxJump2 = maxJump * maxJump;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const hw = width / 2;
  const hh = height / 2;

  /**
   * Polyline over flat ENU triples (`stride` apart, `count` vertices from `from`), broken
   * where it leaves the view or dips below the ground. Runs for every line on every frame,
   * so it avoids allocations and string scans.
   */
  const polyline = (v: ArrayLike<number>, out: string[], from = 0, count = (v.length - from) / 3, stride = 3) => {
    let cur = '';
    let n = 0;
    let lx = 0;
    let ly = 0;
    for (let k = 0, i = from; k < count; k++, i += stride) {
      const u = v[i + 2];
      project(v[i], v[i + 1], u, pt);
      const x = pt.x;
      const y = pt.y;
      const ok = x === x && !(cull && u < -0.01) && Math.abs(x - hw) < width * 3 && Math.abs(y - hh) < height * 3;
      if (!ok || (n && (x - lx) * (x - lx) + (y - ly) * (y - ly) > maxJump2)) {
        if (n > 1) out.push(cur);
        cur = '';
        n = 0;
        if (!ok) continue;
      }
      cur += (n ? 'L' : 'M') + r1(x) + ' ' + r1(y);
      lx = x;
      ly = y;
      n++;
    }
    if (n > 1) out.push(cur);
  };

  const labels = new Labels();
  const texts: ReactNode[] = [];
  const dark = visibility.dark;

  // ---------- Milky Way: nested brightness levels as unions of discs ----------
  // Each level is ONE filled path of circles: the nonzero fill unions overlapping discs, so
  // a level never darkens where its discs overlap. Brightness comes only from stacking
  // levels (fainter, wider halos under brighter, tighter cores), which also feathers edges.
  // A handful of paths, whatever the zoom — the sky redraws on every pose change.
  const milky: ReactNode[] = [];
  if (layers.milkyWay && dark > 0.05) {
    const v = frame.milkyWay;
    const val = cat.milkyWayValue;
    const xs: number[] = [];
    const ys: number[] = [];
    const bs: number[] = [];
    for (let i = 0, j = 0; i < v.length; i += 3, j++) {
      const u = v[i + 2];
      if (cull && u < -0.03) continue;
      project(v[i], v[i + 1], u, pt);
      if (!Number.isFinite(pt.x) || !onScreen(pt, degPx * 3)) continue;
      xs.push(Math.round(pt.x));
      ys.push(Math.round(pt.y));
      bs.push(val[j]);
    }
    for (const [min, rDeg, o] of MW_LEVELS) {
      const r = Math.max(1, Math.round(rDeg * degPx));
      let d = '';
      for (let i = 0; i < xs.length; i++) if (bs[i] >= min) d += `M${xs[i] - r} ${ys[i]}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      if (d) milky.push(<Path key={`mw${min}`} d={d} fill={MW} fillOpacity={o * dark} fillRule="nonzero" />);
    }
  }

  // ---------- Ecliptic ----------
  const ecliptic: string[] = [];
  if (layers.ecliptic) polyline(frame.ecliptic, ecliptic);

  // ---------- Constellation figures ----------
  const lines: string[] = [];
  const hiLines: string[] = [];
  if (layers.lines) {
    cat.constellations.forEach((c, i) => {
      const target = c.id === highlight || selected === `const:${c.id}` ? hiLines : lines;
      for (const pl of frame.lines[i]) polyline(pl, target);
    });
  }
  const asterism: string[] = [];
  if (selected?.startsWith('ast:')) {
    const ai = ASTERISMS.findIndex((a) => `ast:${a.id}` === selected);
    if (ai >= 0) for (const seg of frame.asterisms[ai]) polyline(seg, asterism);
  }

  // ---------- Celestial pole rings and star trails ----------
  const poleRings: string[] = [];
  const trailFaint: string[] = [];
  const trailBright: string[] = [];
  const showPole = layers.trails || selected === 'pole';
  const pole = frame.latitude < 0 ? frame.south : frame.north;
  if (showPole) {
    // Orthonormal basis around the pole axis.
    const p = pole;
    const ax = Math.abs(p[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let a0 = p[1] * ax[2] - p[2] * ax[1];
    let a1 = p[2] * ax[0] - p[0] * ax[2];
    let a2 = p[0] * ax[1] - p[1] * ax[0];
    const al = Math.hypot(a0, a1, a2);
    a0 /= al;
    a1 /= al;
    a2 /= al;
    const b0 = p[1] * a2 - p[2] * a1;
    const b1 = p[2] * a0 - p[0] * a2;
    const b2 = p[0] * a1 - p[1] * a0;
    for (const rho of [10, 20, 30]) {
      const cr = Math.cos((rho * Math.PI) / 180);
      const sr = Math.sin((rho * Math.PI) / 180);
      const ring = new Float64Array(73 * 3);
      for (let j = 0; j <= 72; j++) {
        const th = (j * 5 * Math.PI) / 180;
        const c = Math.cos(th);
        const s = Math.sin(th);
        ring[j * 3] = cr * p[0] + sr * (c * a0 + s * b0);
        ring[j * 3 + 1] = cr * p[1] + sr * (c * a1 + s * b1);
        ring[j * 3 + 2] = cr * p[2] + sr * (c * a2 + s * b2);
      }
      polyline(ring, poleRings);
    }
  }
  if (layers.trails && trailsByStar && dark > 0.05) {
    const steps = trails!.length;
    for (let s = 0; s < trailIndices.length; s++) polyline(trailsByStar, cat.mag[trailIndices[s]] < 2.2 ? trailBright : trailFaint, s * steps * 3, steps);
  }

  // ---------- Planets ----------
  const zoom = Math.min(1.7, Math.max(0.85, Math.pow(62 / fov, 0.4)));
  const planetNodes: ReactNode[] = [];
  if (layers.planets) {
    for (const p of frame.planets) {
      if (p.mag > visibility.magLimit + 1.5 && selected !== `planet:${p.id}`) continue;
      if (cull && p.alt < -0.5) continue;
      project(p.enu[0], p.enu[1], p.enu[2], pt);
      if (!Number.isFinite(pt.x) || !onScreen(pt)) continue;
      const r = Math.min(6, Math.max(2.4, 3.4 - p.mag * 0.55)) * zoom;
      planetNodes.push(
        <G key={p.id}>
          <Circle cx={pt.x} cy={pt.y} r={r * 3} fill={p.color} opacity={0.16} />
          <Circle cx={pt.x} cy={pt.y} r={r} fill={p.color} />
        </G>,
      );
      // Planets are placed first, so their labels always win the space.
      labels.boxes.push(pt.x + r + 5, pt.y - 8, pt.x + r + 5 + textWidth(p.name, 12), pt.y + 6);
      texts.push(
        <SvgText fontFamily={FONT} key={`p${p.id}`} x={pt.x + r + 6} y={pt.y + 4} fontSize={12} fontWeight={weight.semibold} fill={p.color}>
          {p.name}
        </SvgText>,
      );
    }
  }

  // ---------- Stars ----------
  // Faint stars batched by size: one path per quarter-pixel radius step.
  const buckets: string[] = [];
  const bright: ReactNode[] = [];
  const nameMag = fov > 95 ? 0.6 : fov > 70 ? 1.5 : fov > 45 ? 2.2 : 3.2;
  for (let i = 0; i < cat.count; i++) {
    const m = cat.mag[i];
    if (m > visibility.magLimit) break; // sorted brightest first
    const e = frame.stars[i * 3];
    const n = frame.stars[i * 3 + 1];
    const u = frame.stars[i * 3 + 2];
    if (cull && u < -0.005) continue;
    project(e, n, u, pt);
    if (!Number.isFinite(pt.x) || !onScreen(pt, 8)) continue;
    const r = Math.min(5.4, Math.max(0.7, (visibility.magLimit + 1.4 - m) * 0.55)) * zoom;
    if (m < 1.6) {
      const c = starColor(cat.bv[i]);
      bright.push(
        <G key={`b${i}`}>
          <Circle cx={pt.x} cy={pt.y} r={r * 3.2} fill={c} opacity={0.1 + 0.08 * (1.6 - m) * dark} />
          <Circle cx={pt.x} cy={pt.y} r={r} fill={c} />
        </G>,
      );
    } else {
      const key = Math.round(r * 4);
      buckets[key] = (buckets[key] ?? '') + 'M' + r1(pt.x) + ' ' + r1(pt.y) + 'h0';
    }
    const named = layers.labels ? cat.namedByIndex.get(i) : undefined;
    if (named && (m <= nameMag || selected === `star:${i}`)) {
      const x = pt.x + r + 5;
      const y = pt.y + 4;
      if (labels.fits(x, y - 12, textWidth(named.name, 12), 15)) {
        texts.push(
          <SvgText fontFamily={FONT} key={`n${i}`} x={x} y={y} fontSize={12} fontWeight={weight.medium} fill={colors.text} opacity={0.9}>
            {named.name}
          </SvgText>,
        );
      }
    }
  }
  const starPaths: ReactNode[] = [];
  buckets.forEach((d, key) => {
    const r = key / 4;
    starPaths.push(<Path key={`s${r}`} d={d} stroke="#F4F3FF" strokeOpacity={Math.min(1, 0.62 + r * 0.2)} strokeWidth={r * 2} strokeLinecap="round" fill="none" />);
  });

  // ---------- Deep sky ----------
  const dsoNodes: ReactNode[] = [];
  if (layers.deepSky) {
    for (const { dso, enu } of frame.dsos) {
      if (cull && enu[2] < -0.01) continue;
      project(enu[0], enu[1], enu[2], pt);
      const rad = Math.max(5, (dso.size / 2) * degPx);
      if (!Number.isFinite(pt.x) || !onScreen(pt, rad)) continue;
      if (dso.kind === 'cloud') {
        dsoNodes.push(
          <G key={dso.id}>
            <Circle cx={pt.x} cy={pt.y} r={rad} fill="#E2E7FF" opacity={0.07 * dark} />
            <Circle cx={pt.x} cy={pt.y} r={rad * 0.55} fill="#E2E7FF" opacity={0.08 * dark} />
          </G>,
        );
      } else if (dso.kind === 'dark') {
        dsoNodes.push(<Circle key={dso.id} cx={pt.x} cy={pt.y} r={rad} fill="#01020A" opacity={0.45 * dark} />);
      } else {
        dsoNodes.push(
          <Circle key={dso.id} cx={pt.x} cy={pt.y} r={Math.min(rad, 40)} stroke={DSO} strokeOpacity={0.75} strokeWidth={1} strokeDasharray={dso.kind === 'nebula' ? '3 3' : undefined} fill="none" />,
        );
      }
      if (layers.labels && (fov < 66 || dso.kind === 'cloud' || selected === `dso:${dso.id}`)) {
        const w = textWidth(dso.name, 10.5);
        const y = pt.y + Math.min(rad, 40) + 13;
        const lx = Math.min(width - w / 2 - 4, Math.max(w / 2 + 4, pt.x));
        if (labels.fits(lx - w / 2, y - 10, w, 13)) {
          texts.push(
            <SvgText fontFamily={FONT} key={`d${dso.id}`} x={lx} y={y} fontSize={10.5} fontWeight={weight.medium} fill={DSO} opacity={0.85} textAnchor="middle">
              {dso.name}
            </SvgText>,
          );
        }
      }
    }
  }

  // Galactic centre: the target for Milky Way photography.
  const gcNodes: ReactNode[] = [];
  if (layers.milkyWay || selected === 'galactic') {
    const g = frame.galacticCenter;
    if (!(cull && g[2] < -0.01)) {
      project(g[0], g[1], g[2], pt);
      if (Number.isFinite(pt.x) && onScreen(pt)) {
        gcNodes.push(
          <G key="gc">
            <Circle cx={pt.x} cy={pt.y} r={9} stroke={colors.accent} strokeOpacity={0.8} strokeWidth={1} fill="none" />
            <Circle cx={pt.x} cy={pt.y} r={2} fill={colors.accent} />
          </G>,
        );
        if (layers.labels && labels.fits(pt.x - 60, pt.y + 12, 120, 14)) {
          texts.push(
            <SvgText fontFamily={FONT} key="gct" x={pt.x} y={pt.y + 24} fontSize={11} fontWeight={weight.semibold} fill={colors.accent} textAnchor="middle">
              {strings().sky.galacticLabel}
            </SvgText>,
          );
        }
      }
    }
  }

  // Pole marker.
  const poleNodes: ReactNode[] = [];
  if (showPole) {
    project(pole[0], pole[1], pole[2], pt);
    if (Number.isFinite(pt.x) && onScreen(pt) && !(cull && pole[2] < 0)) {
      poleNodes.push(
        <G key="pole">
          <Path d={`M${pt.x - 9} ${pt.y}H${pt.x + 9}M${pt.x} ${pt.y - 9}V${pt.y + 9}`} stroke={colors.accent} strokeWidth={1.2} />
          <Circle cx={pt.x} cy={pt.y} r={4} stroke={colors.accent} strokeWidth={1.2} fill="none" />
        </G>,
      );
      if (layers.labels) {
        const name = frame.latitude < 0 ? strings().sky.southPole : strings().sky.northPole;
        texts.push(
          <SvgText fontFamily={FONT} key="polet" x={pt.x} y={pt.y + 44} fontSize={11} fontWeight={weight.semibold} fill={colors.accent} textAnchor="middle">
            {name}
          </SvgText>,
        );
      }
    }
  }

  // ---------- Constellation names ----------
  if (layers.labels && layers.lines) {
    const maxRank = fov > 85 ? 1 : fov > 55 ? 2 : 3;
    cat.constellations.forEach((c, i) => {
      const hi = c.id === highlight || selected === `const:${c.id}`;
      if (c.rank > maxRank && !hi) return;
      const u = frame.labels[i * 3 + 2];
      if (cull && u < 0.02) return;
      project(frame.labels[i * 3], frame.labels[i * 3 + 1], u, pt);
      if (!Number.isFinite(pt.x) || !onScreen(pt, -10)) return;
      const label = c.name.toLocaleUpperCase(localeTag());
      const size = hi ? 13 : 10.5;
      const w = textWidth(label, size, 1.6);
      if (pt.x - w / 2 < 4 || pt.x + w / 2 > width - 4) return;
      if (!hi && !labels.fits(pt.x - w / 2, pt.y - size, w, size + 4)) return;
      texts.push(
        <SvgText
          fontFamily={FONT}
          key={`c${c.id}`}
          x={pt.x}
          y={pt.y}
          fontSize={size}
          letterSpacing={1.6}
          fontWeight={hi ? weight.semibold : weight.medium}
          fill={hi ? LINE_HI : LABEL}
          opacity={hi ? 1 : 0.72 * (0.4 + 0.6 * dark)}
          textAnchor="middle">
          {label}
        </SvgText>,
      );
    });
  }

  const lineAlpha = 0.25 + 0.75 * dark;
  return (
    <G>
      {milky}
      {ecliptic.length ? <Path d={ecliptic.join('')} stroke={colors.accent} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="5 7" fill="none" /> : null}
      {poleRings.length ? <Path d={poleRings.join('')} stroke={colors.accent} strokeOpacity={0.28} strokeWidth={1} strokeDasharray="2 5" fill="none" /> : null}
      {trailFaint.length ? <Path d={trailFaint.join('')} stroke="#E6EBFF" strokeOpacity={0.34} strokeWidth={1.1} strokeLinecap="round" fill="none" /> : null}
      {trailBright.length ? <Path d={trailBright.join('')} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.8} strokeLinecap="round" fill="none" /> : null}
      {dsoNodes}
      {lines.length ? <Path d={lines.join('')} stroke={LINE} strokeOpacity={0.5 * lineAlpha} strokeWidth={1.1} strokeLinejoin="round" fill="none" /> : null}
      {hiLines.length ? <Path d={hiLines.join('')} stroke={LINE_HI} strokeOpacity={0.9} strokeWidth={1.6} strokeLinejoin="round" fill="none" /> : null}
      {asterism.length ? <Path d={asterism.join('')} stroke={colors.accent} strokeOpacity={0.9} strokeWidth={2} strokeLinecap="round" fill="none" /> : null}
      {starPaths}
      {bright}
      {gcNodes}
      {poleNodes}
      {planetNodes}
      {texts}
    </G>
  );
});
