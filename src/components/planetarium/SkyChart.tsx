import { memo, useMemo } from 'react';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { altAz, type HorizonFrame } from '@/astro/sky/engine';
import type { TargetId } from '@/astro/sky/targets';
import { makeVecProjector } from '@/lib/arMath';
import { colors, weight } from '@/theme/tokens';

import { PlanetariumSky, type SkyLayers } from './PlanetariumSky';

const LAYERS: SkyLayers = { lines: true, labels: true, milkyWay: true, planets: true, deepSky: true, ecliptic: false, trails: false };

type Props = {
  frame: HorizonFrame;
  /** Where to centre, as an [east, north, up] vector. */
  centre: ArrayLike<number>;
  width: number;
  height: number;
  fov: number;
  selected: TargetId;
  /** Constellation to draw brighter. */
  highlight?: string | null;
  /** Ring the selected object at the centre. */
  ring?: boolean;
  color?: string;
};

/**
 * A still of the planetarium framed on one object, oriented as it stands in the user's sky
 * right now (zenith up). Below the horizon, the ground is drawn see-through.
 */
export const SkyChart = memo(function SkyChart({ frame, centre, width, height, fov, selected, highlight = null, ring = true, color = colors.accent }: Props) {
  const geo = useMemo(() => {
    const { alt, az } = altAz(centre[0], centre[1], centre[2]);
    const project = makeVecProjector({ az, alt, roll: 0 }, width, height, fov);
    // Horizon as a polyline across the view; the ground is everything under it.
    let horizon = '';
    let label: { x: number; y: number } | null = null;
    const pt = { x: 0, y: 0, z: 0 };
    // Swept from behind-left to behind-right so the path runs left to right across the view.
    for (let i = 0; i <= 120; i++) {
      const a = ((az - 180 + i * 3) * Math.PI) / 180;
      project(Math.sin(a), Math.cos(a), 0, pt);
      if (!Number.isFinite(pt.x) || Math.abs(pt.x - width / 2) > width * 3) continue;
      horizon += `${horizon ? 'L' : 'M'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      // Label the horizon near the left edge, where it is on screen.
      if (pt.x > 12 && pt.x < width - 120 && pt.y > 20 && pt.y < height - 8 && (!label || pt.x < label.x)) label = { x: pt.x, y: pt.y };
    }
    const groundVisible = alt - fov / 2 < 0;
    return { project, horizon, groundVisible, label };
  }, [centre, width, height, fov]);

  return (
    <Svg width={width} height={height}>
      <PlanetariumSky
        frame={frame}
        trails={null}
        trailIndices={NO_TRAILS}
        project={geo.project}
        width={width}
        height={height}
        fov={fov}
        layers={LAYERS}
        visibility={VISIBILITY}
        cull={false}
        highlight={highlight}
        selected={selected}
      />
      {geo.groundVisible && geo.horizon ? (
        <>
          <Path d={`${geo.horizon}L${width + 600} ${height + 600}L-600 ${height + 600}Z`} fill="#03050F" fillOpacity={0.6} />
          <Path d={geo.horizon} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1} fill="none" />
          {geo.label ? (
            <SvgText fontFamily={FONT} x={geo.label.x + 4} y={geo.label.y - 6} fontSize={11} fontWeight={weight.medium} fill={colors.textSecondary}>
              Horizonte
            </SvgText>
          ) : null}
        </>
      ) : null}
      {ring ? <Circle cx={width / 2} cy={height / 2} r={18} stroke={color} strokeWidth={1.6} fill="none" /> : null}
    </Svg>
  );
});

const NO_TRAILS: number[] = [];
const FONT = process.env.EXPO_OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;
const VISIBILITY = { magLimit: 5, dark: 1 };
