import { create } from 'zustand';

import type { TargetId } from '@/astro/sky/targets';

/** A target another screen asked the planetarium to point at ("Ver no céu"). */
export const useSkyIntent = create<{ target: TargetId | null }>(() => ({ target: null }));

export const pointSkyAt = (target: TargetId) => useSkyIntent.setState({ target });
