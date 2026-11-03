/** Props each widget receives. Plain JSON only: they cross into the widget runtime. */

export type SunWidgetProps = {
  place: string;
  /** 'rise' | 'set' | 'polarDay' | 'polarNight' */
  nextKind: string;
  nextLabel: string;
  nextTime: string;
  nextAt: number;
  rise: string;
  set: string;
  noon: string;
  dayLength: string;
  dayDelta: string;
  goldenEvening: string;
  blueEvening: string;
  altitude: number;
  phase: string;
  /** 0..1 through the daylight span; 0 before sunrise, 1 after sunset. */
  dayProgress: number;
  /** Hourly solar altitude for the local day (25 points, clamped at −12°). */
  curve: number[];
  bg: string[];
};

export type MoonWidgetProps = {
  place: string;
  phase: string;
  symbol: string;
  illumination: number;
  age: string;
  rise: string;
  set: string;
  nextFull: string;
  nextFullIn: string;
  nextNew: string;
  nextNewIn: string;
  bg: string[];
};

export type GoldenWidgetProps = {
  place: string;
  /** 'before' | 'golden' | 'blue' | 'after' */
  state: string;
  title: string;
  window: string;
  startAt: number;
  endAt: number;
  blueWindow: string;
  blueStartAt: number;
  blueEndAt: number;
  morningWindow: string;
  bg: string[];
};

export type LockWidgetProps = {
  sun: { label: string; time: string; at: number; progress: number; symbol: string; place: string };
  moon: { phase: string; symbol: string; illumination: number; next: string };
  golden: { label: string; window: string; at: number };
};

export type StreakWidgetProps = {
  streak: number;
  best: number;
  done: boolean;
  /** Last seven days, oldest first: 1 checked, 0 not. */
  week: number[];
  letters: string[];
  hint: string;
  level: string;
  progress: number;
  bg: string[];
};

export type EventWidgetProps = {
  title: string;
  subtitle: string;
  date: string;
  daysLabel: string;
  symbol: string;
  visible: boolean;
  following: { title: string; date: string }[];
  bg: string[];
};

export type SkyMomentProps = {
  kind: 'golden' | 'sunset' | 'sunrise';
  title: string;
  place: string;
  symbol: string;
  startAt: number;
  endAt: number;
  startTime: string;
  endTime: string;
  caption: string;
};

/** One planetarium object as a widget row. */
export type SkyObjectRow = {
  id: string;
  name: string;
  color: string;
  symbol: string;
  /** Where it is at the entry's time: "34° NE", "Nasce 01:30", "Abaixo do horizonte". */
  status: string;
  /** "Melhor 04:05", or empty. */
  best: string;
  up: boolean;
  url: string;
};

export type TonightWidgetProps = {
  place: string;
  /** Astronomical darkness tonight, "20:41–04:12", or a sentence when there is none. */
  dark: string;
  darkLabel: string;
  moon: string;
  moonSymbol: string;
  /** Planets worth looking for tonight, in the order they are best seen. */
  rows: SkyObjectRow[];
  bg: string[];
};

export type FavoritesWidgetProps = {
  rows: SkyObjectRow[];
  bg: string[];
};
