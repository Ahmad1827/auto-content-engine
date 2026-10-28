// Storyboard contract shared with the Python pipeline (src/motion_gen/).
// All times are in seconds from the start of the video.

export type StyleName = 'atlas' | 'ink' | 'parchment' | 'neon' | 'newspaper';

export type Word = {text: string; start: number; end: number};

export type HeadlineLine = {text: string; accent?: boolean; size?: 'xl' | 'l' | 'm'};

export type Headline = {lines: HeadlineLine[]; banner?: string};

export type MapMarker = {lon: number; lat: number; label?: string; flag?: string};

export type MapArrow = {from: [number, number]; to: [number, number]; label?: string};

export type VersusSide = {name: string; flag?: string};

export type Panel = {svg: string; label?: string; tag?: string};

export type Visual =
  | {type: 'map'; focus: string[]; highlight?: string[]; zoom?: 'country' | 'region'; markers?: MapMarker[]; arrows?: MapArrow[]}
  | {type: 'illustration'; svg: string; label?: string}
  | {type: 'compare'; top: Panel; bottom: Panel}
  | {type: 'counter'; value: number; prefix?: string; suffix?: string; label?: string}
  | {type: 'title'; text: string; sub?: string}
  | {type: 'timeline'; events: {date: string; label: string}[]; active?: number}
  | {type: 'quote'; text: string; source?: string}
  | {type: 'versus'; left: VersusSide; right: VersusSide; rows: {label: string; left: string; right: string}[]};

export type Scene = {
  start: number;
  duration: number;
  narration: string;
  kicker?: string;
  headline?: Headline;
  visual: Visual;
};

export type Storyboard = {
  style: StyleName;
  fps: number;
  width: number;
  height: number;
  audio?: string;
  music?: string;
  captions: boolean;
  handle?: string;
  words: Word[];
  scenes: Scene[];
};
