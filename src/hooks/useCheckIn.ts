import { useMemo } from 'react';

import { formatTime } from '@/astro/format';
import type { SunDay } from '@/astro/sun';
import { dayKey, MIN_MS } from '@/astro/time';
import type { CheckInKind } from '@/lib/achievements';
import { useApp } from '@/store/app';

export type CheckInWindow = {
  kind: CheckInKind | null;
  prompt: string;
  done: boolean;
  nextHint: string;
};

/** Decides whether the user can log a sky moment right now (sunrise, sunset or moon). */
export function useCheckInWindow(args: {
  now: Date;
  tz?: string;
  today: SunDay;
  tomorrow: SunDay;
  sunAlt: number;
  moonAlt: number;
  use24h: boolean;
}): CheckInWindow {
  const checkIns = useApp((s) => s.checkIns);
  const { now, tz, today, tomorrow, sunAlt, moonAlt, use24h } = args;
  return useMemo(() => {
    const t = now.getTime();
    const key = dayKey(now, tz);
    const doneFor = (k: CheckInKind) => checkIns.some((c) => c.key === key && c.kind === k);
    const near = (d: Date | null, before: number, after: number) => !!d && t >= d.getTime() - before * MIN_MS && t <= d.getTime() + after * MIN_MS;

    let kind: CheckInKind | null = null;
    let prompt = '';
    if (near(today.sunset, 75, 40)) {
      kind = 'sunset';
      prompt = 'Está vendo o pôr do sol?';
    } else if (near(today.sunrise, 40, 75)) {
      kind = 'sunrise';
      prompt = 'Viu o sol nascer?';
    } else if (moonAlt > 5 && sunAlt < -6) {
      kind = 'moon';
      prompt = 'A lua está no céu. Foi olhar?';
    }

    let nextHint: string;
    if (today.sunset && t < today.sunset.getTime() - 75 * MIN_MS) nextHint = `Próxima janela: pôr do sol às ${formatTime(today.sunset, tz, use24h)}`;
    else if (tomorrow.sunrise) nextHint = `Próxima janela: nascer do sol às ${formatTime(tomorrow.sunrise, tz, use24h)}`;
    else nextHint = 'Volte quando o céu mudar.';

    return { kind, prompt, done: kind ? doneFor(kind) : false, nextHint };
  }, [checkIns, now, tz, today, tomorrow, sunAlt, moonAlt, use24h]);
}
