import { CONSTELLATIONS, DESIGNATIONS, LINES, MILKY_WAY, PROPER_NAMES, STAR_ROW, STARS } from './data';
import { ASTERISMS, CONSTELLATION_NAMES, STAR_INFO, type StarInfo } from './names';

/**
 * The sky catalogue as flat typed arrays of J2000 equatorial unit vectors, built once
 * on first use. Everything downstream rotates these into the observer's horizon.
 */

const D2R = Math.PI / 180;

export function eqVector(raDeg: number, decDeg: number, out: Float64Array, i: number) {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const c = Math.cos(dec);
  out[i] = c * Math.cos(ra);
  out[i + 1] = c * Math.sin(ra);
  out[i + 2] = Math.sin(dec);
}

export type NamedStar = StarInfo & { index: number; hip: number };


export type ConstellationEntry = {
  id: string;
  name: string;
  latin: string;
  rank: number;
  label: Float64Array;
  /** Stick-figure polylines as flat xyz vectors. */
  lines: Float64Array[];
};

export type Catalog = {
  count: number;
  vectors: Float64Array;
  mag: Float32Array;
  bv: Float32Array;
  hip: Int32Array;
  byHip: Map<number, number>;
  named: NamedStar[];
  namedByIndex: Map<number, NamedStar>;
  constellations: ConstellationEntry[];
  constellationById: Map<string, ConstellationEntry>;
  /** Milky Way lattice as flat xyz, with a smoothed brightness (0 … 5) per sample. */
  milkyWay: Float64Array;
  milkyWayValue: Float32Array;
  asterismLines: { id: string; name: string; segments: Float64Array[] }[];
};

let cache: Catalog | null = null;

export function catalog(): Catalog {
  if (cache) return cache;
  const count = STARS.length / STAR_ROW;
  const vectors = new Float64Array(count * 3);
  const mag = new Float32Array(count);
  const bv = new Float32Array(count);
  const hip = new Int32Array(count);
  const byHip = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const r = i * STAR_ROW;
    eqVector(STARS[r] / 100, STARS[r + 1] / 100, vectors, i * 3);
    mag[i] = STARS[r + 2] / 100;
    bv[i] = STARS[r + 3] / 100;
    hip[i] = STARS[r + 4];
    byHip.set(hip[i], i);
  }

  const named: NamedStar[] = [];
  for (const [h, info] of Object.entries(STAR_INFO)) {
    const index = byHip.get(Number(h));
    // Copy the descriptors, not the values: names and notes follow the active language.
    if (index != null) named.push(Object.defineProperties({ index, hip: Number(h) }, Object.getOwnPropertyDescriptors(info)) as NamedStar);
  }
  // IAU names for the remaining bright stars, so a tap rarely lands on a bare designation.
  for (const [h, name] of Object.entries(PROPER_NAMES)) {
    const n = Number(h);
    const index = byHip.get(n);
    if (index != null && !STAR_INFO[n] && mag[index] <= 3) named.push({ name, index, hip: n });
  }
  named.sort((a, b) => mag[a.index] - mag[b.index]);
  const namedByIndex = new Map(named.map((s) => [s.index, s]));

  const constellations: ConstellationEntry[] = CONSTELLATIONS.map(([id, latin, ra, dec, rank]) => {
    const label = new Float64Array(3);
    eqVector(ra, dec, label, 0);
    const lines = (LINES[id] ?? []).map((pl) => {
      const v = new Float64Array((pl.length / 2) * 3);
      for (let i = 0; i < pl.length; i += 2) eqVector(pl[i], pl[i + 1], v, (i / 2) * 3);
      return v;
    });
    return {
      id,
      latin,
      rank,
      label,
      lines,
      get name() {
        return CONSTELLATION_NAMES[id] ?? latin;
      },
    };
  });

  const mwCount = MILKY_WAY.length / 3;
  const milkyWay = new Float64Array(mwCount * 3);
  const milkyWayValue = new Float32Array(mwCount);
  for (let i = 0; i < mwCount; i++) {
    eqVector(MILKY_WAY[i * 3] / 10, MILKY_WAY[i * 3 + 1] / 10, milkyWay, i * 3);
    milkyWayValue[i] = MILKY_WAY[i * 3 + 2] / 20;
  }

  const starVec = (h: number) => {
    const i = byHip.get(h);
    return i == null ? null : vectors.subarray(i * 3, i * 3 + 3);
  };
  const asterismLines = ASTERISMS.map((a) => ({
    id: a.id,
    get name() {
      return a.name;
    },
    segments: a.lines
      .map(([p, q]) => {
        const va = starVec(p);
        const vb = starVec(q);
        if (!va || !vb) return null;
        const seg = new Float64Array(6);
        seg.set(va, 0);
        seg.set(vb, 3);
        return seg;
      })
      .filter((s) => s != null),
  }));

  const built: Catalog = {
    count,
    vectors,
    mag,
    bv,
    hip,
    byHip,
    named,
    namedByIndex,
    constellations,
    constellationById: new Map(constellations.map((c) => [c.id, c])),
    milkyWay,
    milkyWayValue,
    asterismLines,
  };
  cache = built;
  return built;
}

export function designation(hip: number): string | undefined {
  return DESIGNATIONS[hip];
}

/** Star colour from B−V, tuned to read on a dark sky (blue-white → orange-red). */
export function starColor(bv: number): string {
  if (bv < -0.1) return '#AFC6FF';
  if (bv < 0.15) return '#D3E0FF';
  if (bv < 0.45) return '#F4F3FF';
  if (bv < 0.75) return '#FFF3DC';
  if (bv < 1.1) return '#FFDDA8';
  if (bv < 1.45) return '#FFC48A';
  return '#FFA779';
}
