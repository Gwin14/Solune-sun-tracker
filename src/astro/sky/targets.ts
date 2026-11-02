import * as A from 'astronomy-engine';

import { formatNumber } from '@/astro/format';
import type { Place } from '@/astro/sun';

import { catalog, designation, eqVector, starColor } from './catalog';
import { constellationAt, observerOf, PLANETS, type HorizonFrame, type PlanetId } from './engine';
import { ASTERISMS, CONSTELLATION_NOTES, DSO_KIND_LABEL, DSOS, GALACTIC_CENTER, GALACTIC_CENTER_NOTE, PLANET_NOTES } from './names';

/**
 * Everything the planetarium can select, search for and guide the user to.
 * Ids are stable strings so a selection survives frame recomputes.
 */
export type TargetId =
  | `star:${number}`
  | `planet:${PlanetId}`
  | `dso:${string}`
  | `const:${string}`
  | `ast:${string}`
  | 'galactic'
  | 'pole'
  | 'moon'
  | 'sun';

export type TargetKind = 'star' | 'planet' | 'dso' | 'constellation' | 'asterism' | 'galactic' | 'pole' | 'moon' | 'sun';

export function kindOf(id: TargetId): TargetKind {
  if (id.startsWith('star:')) return 'star';
  if (id.startsWith('planet:')) return 'planet';
  if (id.startsWith('dso:')) return 'dso';
  if (id.startsWith('const:')) return 'constellation';
  if (id.startsWith('ast:')) return 'asterism';
  return id as TargetKind;
}

const mean = (vs: ArrayLike<number>[]) => {
  const out = new Float64Array(3);
  for (const v of vs) {
    out[0] += v[0];
    out[1] += v[1];
    out[2] += v[2];
  }
  const l = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
};

/** Constellation "centre" for pointing: the mean of its stick-figure vertices. */
function constellationCentre(frame: HorizonFrame, id: string) {
  const cat = catalog();
  const i = cat.constellations.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const verts: Float64Array[] = [];
  for (const pl of frame.lines[i]) for (let k = 0; k < pl.length; k += 3) verts.push(pl.subarray(k, k + 3));
  return verts.length ? mean(verts) : frame.labels.subarray(i * 3, i * 3 + 3);
}

/**
 * ENU direction of a target in this frame. Sun and Moon are passed in since the screen
 * already computes them (with refraction) for the rest of the AR view.
 */
export function targetEnu(frame: HorizonFrame, id: TargetId, bodies: { sun: ArrayLike<number>; moon: ArrayLike<number> }): ArrayLike<number> | null {
  const cat = catalog();
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      return frame.stars.subarray(i * 3, i * 3 + 3);
    }
    case 'planet':
      return frame.planets.find((p) => `planet:${p.id}` === id)?.enu ?? null;
    case 'dso':
      return frame.dsos.find((d) => `dso:${d.dso.id}` === id)?.enu ?? null;
    case 'constellation':
      return constellationCentre(frame, id.slice(6));
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
      if (!a) return null;
      const vs = a.members.map((h) => cat.byHip.get(h)).filter((i): i is number => i != null).map((i) => frame.stars.subarray(i * 3, i * 3 + 3));
      return vs.length ? mean(vs) : null;
    }
    case 'galactic':
      return frame.galacticCenter;
    case 'pole':
      return frame.latitude < 0 ? frame.south : frame.north;
    case 'moon':
      return bodies.moon;
    case 'sun':
      return bodies.sun;
  }
}

/** J2000 direction of a target at any time, for rise/set and best-time planning. */
export function targetEqjAt(id: TargetId, place: Place): ((t: Date) => ArrayLike<number>) | null {
  const cat = catalog();
  const obs = observerOf(place);
  const body = (b: A.Body) => (t: Date) => {
    const v = A.Equator(b, t, obs, false, true).vec;
    const l = v.Length();
    return [v.x / l, v.y / l, v.z / l];
  };
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      const v = cat.vectors.subarray(i * 3, i * 3 + 3);
      return () => v;
    }
    case 'planet': {
      const p = PLANETS.find((x) => `planet:${x.id}` === id);
      return p ? body(p.body) : null;
    }
    case 'dso':
    case 'galactic': {
      const d = id === 'galactic' ? GALACTIC_CENTER : DSOS.find((x) => `dso:${x.id}` === id);
      if (!d) return null;
      const v = new Float64Array(3);
      eqVector(d.ra, d.dec, v, 0);
      return () => v;
    }
    case 'constellation': {
      const c = cat.constellationById.get(id.slice(6));
      if (!c) return null;
      const verts: number[][] = [];
      for (const pl of c.lines) for (let k = 0; k < pl.length; k += 3) verts.push([pl[k], pl[k + 1], pl[k + 2]]);
      const v = verts.length ? mean(verts) : c.label;
      return () => v;
    }
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
      if (!a) return null;
      const v = mean(a.members.map((h) => cat.byHip.get(h)).filter((i): i is number => i != null).map((i) => cat.vectors.subarray(i * 3, i * 3 + 3)));
      return () => v;
    }
    case 'moon':
      return body(A.Body.Moon);
    case 'sun':
      return body(A.Body.Sun);
    case 'pole':
      return null;
  }
}

export type TargetInfo = {
  title: string;
  subtitle: string;
  color: string;
  mag?: number;
  note?: string;
  /** A sentence about distance or light travel time. */
  distance?: string;
  flag?: string;
};

function lightTravel(ly: number, now: Date): string {
  if (ly < 100) return `A luz que você vê agora saiu de lá há ${ly.toString().replace('.', ',')} anos.`;
  if (ly < 3000) {
    const year = now.getFullYear() - Math.round(ly);
    const when = year > 0 ? `por volta do ano ${year}` : `por volta de ${Math.abs(year)} a.C.`;
    return `A luz que chega agora saiu de lá há uns ${formatNumber(ly)} anos, ${when}.`;
  }
  return `A ${formatNumber(ly)} anos-luz: a luz que você vê saiu de lá há ${formatNumber(ly)} anos.`;
}

const constellationName = (sym: string) => catalog().constellationById.get(sym)?.name ?? sym;

export function describeTarget(frame: HorizonFrame, id: TargetId, extra: { moonIllum?: number; moonDistKm?: number } = {}): TargetInfo {
  const cat = catalog();
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      const named = cat.namedByIndex.get(i);
      const hip = cat.hip[i];
      const v = frame.stars.subarray(i * 3, i * 3 + 3);
      const con = constellationName(constellationAt(frame, v[0], v[1], v[2]));
      const desig = designation(hip);
      return {
        title: named?.name ?? desig ?? `HIP ${hip}`,
        subtitle: ['Estrela', con, named && desig ? desig : null].filter(Boolean).join(' · '),
        color: starColor(cat.bv[i]),
        mag: cat.mag[i],
        note: named?.note,
        distance: named?.ly ? lightTravel(named.ly, frame.time) : undefined,
        flag: named?.flag,
      };
    }
    case 'planet': {
      const p = frame.planets.find((x) => `planet:${x.id}` === id)!;
      const km = p.dist * 149_597_870.7;
      const minutes = (p.dist * 499) / 60;
      return {
        title: p.name,
        subtitle: `Planeta · em ${constellationName(p.constellation)}`,
        color: p.color,
        mag: p.mag,
        note: PLANET_NOTES[p.id],
        distance: `Está a ${formatNumber(km / 1e6)} milhões de km. A luz leva ${minutes < 60 ? `${Math.round(minutes)} min` : `${(minutes / 60).toFixed(1).replace('.', ',')} h`} para chegar até você.`,
      };
    }
    case 'dso': {
      const d = DSOS.find((x) => `dso:${x.id}` === id)!;
      const e = frame.dsos.find((x) => x.dso.id === d.id)!.enu;
      return {
        title: d.name,
        subtitle: `${DSO_KIND_LABEL[d.kind]} · ${constellationName(constellationAt(frame, e[0], e[1], e[2]))}`,
        color: d.kind === 'dark' ? '#9AA3C7' : '#CDBBFF',
        mag: d.mag < 50 ? d.mag : undefined,
        note: d.note,
        distance: lightTravel(d.ly, frame.time),
      };
    }
    case 'constellation': {
      const c = cat.constellationById.get(id.slice(6))!;
      return { title: c.name, subtitle: `Constelação · ${c.latin}`, color: '#B9C6FF', note: CONSTELLATION_NOTES[c.id] };
    }
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id)!;
      return { title: a.name, subtitle: 'Asterismo', color: '#B9C6FF', note: a.note };
    }
    case 'galactic':
      return { title: 'Centro da Via Láctea', subtitle: 'Núcleo galáctico · Sagitário', color: '#F2BE6E', note: GALACTIC_CENTER_NOTE };
    case 'pole': {
      const south = frame.latitude < 0;
      const alt = Math.abs(frame.latitude);
      return {
        title: south ? 'Polo Sul Celeste' : 'Polo Norte Celeste',
        subtitle: 'O eixo do céu',
        color: '#F2BE6E',
        note: `Todas as estrelas giram em volta deste ponto, ${alt.toFixed(0)}° acima do horizonte ${south ? 'sul' : 'norte'} — a mesma altura que a sua latitude. Aponte a câmera para cá numa foto de longa exposição e os rastros formam círculos perfeitos.${south ? ' Não há estrela brilhante marcando o polo sul: use o Cruzeiro do Sul como guia.' : ''}`,
      };
    }
    case 'moon':
      return {
        title: 'Lua',
        subtitle: extra.moonIllum != null ? `${Math.round(extra.moonIllum * 100)}% iluminada` : 'Satélite natural',
        color: '#CBD2F2',
        distance: extra.moonDistKm ? `Está a ${formatNumber(extra.moonDistKm)} km. A luz leva ${(extra.moonDistKm / 299_792).toFixed(1).replace('.', ',')} s para chegar.` : undefined,
      };
    case 'sun':
      return { title: 'Sol', subtitle: 'Nossa estrela', color: '#F2BE6E', note: 'Nunca aponte binóculo ou telescópio para o Sol, nem olhe diretamente para ele.', distance: 'A luz leva 8 min 20 s para chegar.' };
  }
}

export type SearchEntry = { id: TargetId; name: string; hint: string; group: 'Destaques' | 'Planetas' | 'Estrelas' | 'Céu profundo' | 'Constelações' };

/** The searchable index, built once. Planets come first; the screen adds live visibility. */
export function searchIndex(southern: boolean): SearchEntry[] {
  const cat = catalog();
  const out: SearchEntry[] = [
    { id: 'galactic', name: 'Centro da Via Láctea', hint: 'Núcleo galáctico', group: 'Destaques' },
    { id: 'pole', name: southern ? 'Polo Sul Celeste' : 'Polo Norte Celeste', hint: 'Para fotos de rastros de estrelas', group: 'Destaques' },
    { id: 'const:Cru', name: 'Cruzeiro do Sul', hint: 'Constelação', group: 'Destaques' },
    ...ASTERISMS.map((a) => ({ id: `ast:${a.id}` as TargetId, name: a.name, hint: 'Asterismo', group: 'Destaques' as const })),
    { id: 'moon', name: 'Lua', hint: 'Satélite', group: 'Destaques' },
    { id: 'sun', name: 'Sol', hint: 'Nossa estrela', group: 'Destaques' },
    ...PLANETS.map((p) => ({ id: `planet:${p.id}` as TargetId, name: p.name, hint: 'Planeta', group: 'Planetas' as const })),
    ...DSOS.map((d) => ({ id: `dso:${d.id}` as TargetId, name: d.name, hint: DSO_KIND_LABEL[d.kind], group: 'Céu profundo' as const })),
    ...cat.named.filter((s) => s.ly != null || cat.mag[s.index] < 2).map((s) => ({ id: `star:${s.index}` as TargetId, name: s.name, hint: 'Estrela', group: 'Estrelas' as const })),
    ...[...cat.constellations].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((c) => ({ id: `const:${c.id}` as TargetId, name: c.name, hint: c.latin, group: 'Constelações' as const })),
  ];
  return out;
}

