import { localized, strings } from '@/i18n';

/**
 * Sky content beyond the raw catalogue: the stars people actually look for, deep-sky
 * highlights and asterisms. Positions and facts live here; names and notes come from the
 * active language (src/i18n/sky).
 */

export const CONSTELLATION_NAMES: Record<string, string> = localized((s) => s.skyData.constellations);

/** Short notes for the constellations people ask about. */
export const CONSTELLATION_NOTES: Record<string, string> = localized((s) => s.skyData.constellationNotes);

export type StarInfo = {
  readonly name: string;
  /** Distance in light years. */
  ly?: number;
  readonly note?: string;
  /** The state it represents on the Brazilian flag. */
  flag?: string;
};

/** International name, distance and Brazilian-flag state by Hipparcos number. */
const STAR_DATA: Record<number, { name: string; ly?: number; flag?: string }> = {
  32349: { name: 'Sirius', ly: 8.6, flag: 'Mato Grosso' },
  30438: { name: 'Canopus', ly: 310, flag: 'Goiás' },
  69673: { name: 'Arcturus', ly: 37 },
  71683: { name: 'Alpha Centauri', ly: 4.37 },
  71681: { name: 'Toliman', ly: 4.37 },
  91262: { name: 'Vega', ly: 25 },
  24608: { name: 'Capella', ly: 43 },
  24436: { name: 'Rigel', ly: 860 },
  37279: { name: 'Procyon', ly: 11.5, flag: 'Amazonas' },
  7588: { name: 'Achernar', ly: 139 },
  27989: { name: 'Betelgeuse', ly: 550 },
  68702: { name: 'Hadar', ly: 390 },
  97649: { name: 'Altair', ly: 16.7 },
  60718: { name: 'Acrux', ly: 320, flag: 'São Paulo' },
  21421: { name: 'Aldebaran', ly: 65 },
  65474: { name: 'Spica', ly: 250, flag: 'Pará' },
  80763: { name: 'Antares', ly: 550, flag: 'Piauí' },
  37826: { name: 'Pollux', ly: 34 },
  113368: { name: 'Fomalhaut', ly: 25 },
  102098: { name: 'Deneb', ly: 2600 },
  62434: { name: 'Mimosa', ly: 280, flag: 'Rio de Janeiro' },
  49669: { name: 'Regulus', ly: 79 },
  33579: { name: 'Adhara', ly: 430 },
  36850: { name: 'Castor', ly: 51 },
  61084: { name: 'Gacrux', ly: 88, flag: 'Bahia' },
  59747: { name: 'Imai', ly: 345, flag: 'Minas Gerais' },
  60260: { name: 'Ginan', ly: 230, flag: 'Espírito Santo' },
  85927: { name: 'Shaula', ly: 570 },
  25336: { name: 'Bellatrix', ly: 250 },
  25428: { name: 'Elnath', ly: 130 },
  45238: { name: 'Miaplacidus', ly: 113 },
  26311: { name: 'Alnilam', ly: 2000 },
  26727: { name: 'Alnitak', ly: 1260 },
  25930: { name: 'Mintaka', ly: 1200 },
  109268: { name: 'Alnair', ly: 101 },
  62956: { name: 'Alioth', ly: 81 },
  90185: { name: 'Kaus Australis', ly: 143 },
  15863: { name: 'Mirfak', ly: 510 },
  54061: { name: 'Dubhe', ly: 123 },
  34444: { name: 'Wezen', ly: 1600 },
  67301: { name: 'Alkaid', ly: 104 },
  41037: { name: 'Avior', ly: 630 },
  86228: { name: 'Sargas', ly: 300 },
  28360: { name: 'Menkalinan', ly: 82 },
  82273: { name: 'Atria', ly: 390 },
  31681: { name: 'Alhena', ly: 109 },
  42913: { name: 'Alsephina', ly: 80 },
  100751: { name: 'Peacock', ly: 180 },
  11767: { name: 'Polaris', ly: 430 },
  104382: { name: 'Sigma Octantis', ly: 294, flag: 'Distrito Federal' },
  30324: { name: 'Mirzam', ly: 500 },
  46390: { name: 'Alphard', ly: 180 },
  50583: { name: 'Algieba', ly: 130 },
  9884: { name: 'Hamal', ly: 66 },
  3419: { name: 'Diphda', ly: 96 },
  92855: { name: 'Nunki', ly: 228 },
  68933: { name: 'Menkent', ly: 59 },
  677: { name: 'Alpheratz', ly: 97 },
  72607: { name: 'Kochab', ly: 131 },
  5447: { name: 'Mirach', ly: 197 },
  27366: { name: 'Saiph', ly: 650 },
  86032: { name: 'Rasalhague', ly: 49 },
  14576: { name: 'Algol', ly: 90 },
  57632: { name: 'Denebola', ly: 36 },
  65378: { name: 'Mizar', ly: 83 },
  53910: { name: 'Merak', ly: 79 },
  58001: { name: 'Phecda', ly: 84 },
  113963: { name: 'Markab', ly: 133 },
  113881: { name: 'Scheat', ly: 196 },
  107315: { name: 'Enif', ly: 690 },
  45556: { name: 'Aspidiske', ly: 690 },
  44816: { name: 'Suhail', ly: 545 },
};

/** Names and notes by Hipparcos number, read from the active language. */
export const STAR_INFO: Record<number, StarInfo> = Object.fromEntries(
  Object.entries(STAR_DATA).map(([h, base]) => [
    h,
    {
      ly: base.ly,
      flag: base.flag,
      get name() {
        return strings().skyData.starNames[Number(h)] ?? base.name;
      },
      get note() {
        return strings().skyData.starNotes[Number(h)];
      },
    },
  ]),
);

export type DsoKind = 'galaxy' | 'nebula' | 'open' | 'globular' | 'dark' | 'cloud';

export const DSO_KIND_LABEL: Record<DsoKind, string> = localized((s) => s.skyData.dsoKinds);

export type Dso = {
  id: string;
  readonly name: string;
  kind: DsoKind;
  /** J2000 degrees. */
  ra: number;
  dec: number;
  mag: number;
  /** Apparent size in degrees. */
  size: number;
  ly: number;
  readonly note: string;
};

const dso = (id: string, kind: DsoKind, ra: number, dec: number, mag: number, size: number, ly: number): Dso => ({
  id,
  kind,
  ra,
  dec,
  mag,
  size,
  ly,
  get name() {
    return strings().skyData.dsos[id].name;
  },
  get note() {
    return strings().skyData.dsos[id].note;
  },
});

export const DSOS: Dso[] = [
  dso('lmc', 'cloud', 80.89, -69.76, 0.9, 9, 160_000),
  dso('smc', 'cloud', 13.16, -72.8, 2.7, 5, 200_000),
  dso('m42', 'nebula', 83.82, -5.39, 4, 1.1, 1_350),
  dso('m45', 'open', 56.75, 24.12, 1.6, 1.8, 444),
  dso('hyades', 'open', 66.75, 15.87, 0.5, 5.5, 153),
  dso('m31', 'galaxy', 10.68, 41.27, 3.4, 3, 2_500_000),
  dso('omegaCen', 'globular', 201.7, -47.48, 3.7, 0.6, 17_000),
  dso('47tuc', 'globular', 6.02, -72.08, 4.1, 0.5, 13_000),
  dso('carina', 'nebula', 161.27, -59.87, 1, 2, 8_500),
  dso('jewel', 'open', 193.4, -60.33, 4.2, 0.17, 6_400),
  dso('coalsack', 'dark', 192.5, -62.8, 99, 6, 600),
  dso('m7', 'open', 268.46, -34.79, 3.3, 1.3, 980),
  dso('m8', 'nebula', 270.92, -24.38, 6, 1, 4_100),
  dso('m44', 'open', 130.1, 19.67, 3.7, 1.6, 577),
  dso('m13', 'globular', 250.42, 36.46, 5.8, 0.3, 22_000),
];

/** The galactic centre (Sagittarius A*), J2000 degrees. */
export const GALACTIC_CENTER = { ra: 266.405, dec: -28.936 };

export const GALACTIC_CENTER_NOTE: { readonly text: string } = {
  get text() {
    return strings().skyData.galacticNote;
  },
};

export type Asterism = { id: string; readonly name: string; readonly note: string; members: number[]; lines: [number, number][] };

const asterism = (id: string, members: number[], lines: [number, number][]): Asterism => ({
  id,
  members,
  lines,
  get name() {
    return strings().skyData.asterisms[id].name;
  },
  get note() {
    return strings().skyData.asterisms[id].note;
  },
});

export const ASTERISMS: Asterism[] = [
  asterism('tresMarias', [26727, 26311, 25930], [[26727, 26311], [26311, 25930]]),
  asterism('falsoCruzeiro', [41037, 45556, 42913, 45941], [[41037, 45941], [42913, 45556]]),
  asterism('ponteiros', [71683, 68702], [[71683, 68702]]),
];

export const PLANET_NOTES: Record<string, string> = localized((s) => Object.fromEntries(Object.entries(s.skyData.planets).map(([k, v]) => [k, v.note])));
