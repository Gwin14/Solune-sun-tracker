/**
 * Sky keyframes keyed by solar altitude (degrees). Layers are stacked in
 * ascending order and each fades in between the previous keyframe and its own,
 * so any altitude resolves to a clean cross-fade of two neighbours.
 */
export type SkyKeyframe = { alt: number; colors: readonly [string, string, string] };

export const SKY: readonly SkyKeyframe[] = [
  { alt: -24, colors: ['#02040D', '#070B22', '#10153A'] },
  { alt: -15, colors: ['#050822', '#10164A', '#25276A'] },
  { alt: -9, colors: ['#0B1043', '#272A78', '#544499'] },
  { alt: -3, colors: ['#151D5E', '#55479E', '#D9809B'] },
  { alt: 2, colors: ['#26418F', '#C9768C', '#FFB877'] },
  { alt: 9, colors: ['#2659B8', '#5E95DC', '#F2C9A0'] },
  { alt: 22, colors: ['#1C58C2', '#4A8EE0', '#A8D2F5'] },
  { alt: 45, colors: ['#1450BD', '#3F87E0', '#94C8F5'] },
];

/** Plain JS version (worklet-safe) used for status bar / static tinting. */
export function skyBaseColor(alt: number): string {
  'worklet';
  let pick = SKY[0].colors[1];
  for (let i = 0; i < SKY.length; i++) {
    if (alt >= SKY[i].alt) pick = SKY[i].colors[1];
  }
  return pick;
}
