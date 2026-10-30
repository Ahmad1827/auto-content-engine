// Storyboard contract shared with the Python pipeline (src/motion_gen/).
// All times are in seconds from the start of the video.

export type StyleName = 'atlas' | 'ink' | 'parchment' | 'neon' | 'newspaper' | 'pixel' | 'diorama';

export type Word = {text: string; start: number; end: number};

export type HeadlineLine = {text: string; accent?: boolean; size?: 'xl' | 'l' | 'm'};

export type Headline = {lines: HeadlineLine[]; banner?: string};

export type MapMarker = {lon: number; lat: number; label?: string; flag?: string};

export type MapArrow = {from: [number, number]; to: [number, number]; label?: string};

export type VersusSide = {name: string; flag?: string};

// A character the AI casts: everything is picked from fixed options, the engine draws them.
export type Skin = 'light' | 'tan' | 'brown' | 'dark';
export type Hair = 'short' | 'long' | 'curly' | 'bun' | 'bald' | 'hijab' | 'turban' | 'cap' | 'helmet' | 'crown';
export type Outfit = 'casual' | 'robe' | 'suit' | 'dress' | 'armor' | 'uniform';
export type Pose = 'stand' | 'wave' | 'walk' | 'run' | 'sit' | 'sleep' | 'pray' | 'point' | 'think' | 'cheer' | 'phone' | 'sad' | 'fight' | 'kneel';
export type Person = {
  pose: Pose;
  skin?: Skin;
  hair?: Hair;
  hairColor?: 'black' | 'brown' | 'blonde' | 'red' | 'grey' | 'white';
  outfit?: Outfit;
  // Main clothing colour; trousers are picked to go with it.
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'white' | 'black' | 'brown' | 'grey' | 'orange' | 'pink' | 'teal';
  beard?: boolean;
  mood?: 'happy' | 'neutral' | 'sad' | 'angry' | 'surprised';
  label?: string;
  // Horizontal place on stage, -1 (left) .. 1 (right); spread evenly when omitted.
  x?: number;
};
export type Setting = 'bedroom' | 'house' | 'street' | 'desert' | 'mosque' | 'battlefield' | 'office' | 'night' | 'field' | 'classroom' | 'empty';
export type Prop = 'bed' | 'table' | 'chair' | 'phone' | 'clock' | 'book' | 'lamp' | 'tree' | 'door' | 'window' | 'moon' | 'sun' | 'fire' | 'sword' | 'mat' | 'tent' | 'car';
export type Cast = {setting: Setting; people: Person[]; props?: Prop[]};

export type Panel = {svg?: string; cast?: Cast; label?: string; tag?: string};

export type Visual =
  | {type: 'map'; focus: string[]; highlight?: string[]; zoom?: 'country' | 'region'; markers?: MapMarker[]; arrows?: MapArrow[]}
  | {type: 'illustration'; svg: string; label?: string}
  | ({type: 'cast'; label?: string} & Cast)
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
  // ISO 639-1 code of the narration and on-screen text; English when missing.
  language?: string;
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
