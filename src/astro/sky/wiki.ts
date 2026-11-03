import { catalog } from './catalog';
import { PROPER_NAMES } from './data';
import { PLANETS } from './engine';
import { ASTERISMS, DSOS } from './names';
import { kindOf, type TargetId } from './targets';

/**
 * Pictures and longer descriptions for an object page come from Wikipedia: the Portuguese
 * article for the text, and whichever article has a lead image for the picture.
 */

type Candidate = { lang: 'pt' | 'en'; title: string };

export type WikiImage = { uri: string; width: number; height: number };

export type WikiArticle = {
  extract: string | null;
  url: string | null;
  image: WikiImage | null;
};

const PLANET_EN: Record<string, string> = {
  Mercury: 'Mercury (planet)',
  Venus: 'Venus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturn',
  Uranus: 'Uranus',
  Neptune: 'Neptune',
};

const DSO_EN: Record<string, string> = {
  lmc: 'Large Magellanic Cloud',
  smc: 'Small Magellanic Cloud',
  m42: 'Orion Nebula',
  m45: 'Pleiades',
  hyades: 'Hyades (star cluster)',
  m31: 'Andromeda Galaxy',
  omegaCen: 'Omega Centauri',
  '47tuc': '47 Tucanae',
  carina: 'Carina Nebula',
  jewel: 'Jewel Box (star cluster)',
  coalsack: 'Coalsack Nebula',
  m7: 'Ptolemy Cluster',
  m8: 'Lagoon Nebula',
  m44: 'Beehive Cluster',
  m13: 'Messier 13',
};

const ASTERISM_EN: Record<string, string> = {
  tresMarias: "Orion's Belt",
  falsoCruzeiro: 'False Cross',
};

/** Article titles to try, most specific first. */
export function wikiCandidates(id: TargetId): Candidate[] {
  const cat = catalog();
  const pt = (title: string): Candidate => ({ lang: 'pt', title });
  const en = (title: string): Candidate => ({ lang: 'en', title });
  switch (kindOf(id)) {
    case 'star': {
      const i = Number(id.slice(5));
      const named = cat.namedByIndex.get(i);
      // The IAU name ("Sirius") finds the article when the Portuguese spelling ("Sírius") doesn't.
      const iau = PROPER_NAMES[cat.hip[i]];
      const names = [...new Set([named?.name, iau].filter((n): n is string => !!n))];
      return [...names.flatMap((n) => [pt(`${n} (estrela)`), pt(n)]), ...names.flatMap((n) => [en(`${n} (star)`), en(n)])];
    }
    case 'planet': {
      const p = PLANETS.find((x) => `planet:${x.id}` === id);
      return p ? [pt(`${p.name} (planeta)`), en(PLANET_EN[p.id])] : [];
    }
    case 'dso': {
      const d = DSOS.find((x) => `dso:${x.id}` === id);
      return d ? [pt(d.name), ...(DSO_EN[d.id] ? [en(DSO_EN[d.id])] : [])] : [];
    }
    case 'constellation': {
      const c = cat.constellationById.get(id.slice(6));
      return c ? [pt(`${c.name} (constelação)`), pt(c.name), en(`${c.latin} (constellation)`), en(c.latin)] : [];
    }
    case 'asterism': {
      const a = ASTERISMS.find((x) => `ast:${x.id}` === id);
      return a ? [pt(a.name), ...(ASTERISM_EN[a.id] ? [en(ASTERISM_EN[a.id])] : [])] : [];
    }
    case 'galactic':
      return [pt('Centro galáctico'), en('Galactic Center')];
    case 'pole':
      return [pt('Polo celeste'), en('Celestial pole')];
    case 'moon':
      return [pt('Lua'), en('Moon')];
    case 'sun':
      return [pt('Sol'), en('Sun')];
  }
}

type Summary = {
  type: string;
  extract?: string;
  content_urls?: { mobile?: { page?: string } };
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
};

const HERO_PX = 1280;

/** A hero-sized rendition: the original when it is small enough, else a resized thumbnail. */
function heroImage(s: Summary): WikiImage | null {
  const o = s.originalimage;
  const t = s.thumbnail;
  if (!o) return null;
  // Vector lead images are maps and diagrams, not pictures of the sky.
  if (/\.svg$/i.test(o.source)) return null;
  if (o.width <= HERO_PX * 1.5 || !t) return { uri: o.source, width: o.width, height: o.height };
  return {
    uri: t.source.replace(/\/\d+px-/, `/${HERO_PX}px-`),
    width: HERO_PX,
    height: Math.round((o.height / o.width) * HERO_PX),
  };
}

async function summary({ lang, title }: Candidate, signal?: AbortSignal): Promise<Summary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const res = await fetch(url, { signal, headers: { 'Api-User-Agent': 'Solune/1.0 (planetarium object pages)' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const json = (await res.json()) as Summary;
  // Disambiguation and missing pages are not an answer.
  return json.type === 'standard' ? json : null;
}

export async function fetchWikiArticle(id: TargetId, signal?: AbortSignal): Promise<WikiArticle> {
  const out: WikiArticle = { extract: null, url: null, image: null };
  for (const c of wikiCandidates(id)) {
    if (out.extract && out.image) break;
    // Text only from the Portuguese article; English is tried for the picture alone.
    if (c.lang === 'pt' && out.extract) continue;
    const s = await summary(c, signal);
    if (!s) continue;
    if (c.lang === 'pt' && s.extract) {
      out.extract = s.extract;
      out.url = s.content_urls?.mobile?.page ?? null;
    }
    out.image ??= heroImage(s);
  }
  return out;
}
