import type {Person} from '../types';

const SKIN = {light: '#f2c9a5', tan: '#d9a171', brown: '#a8704a', dark: '#6e452c'};
const HAIR = {black: '#231a15', brown: '#5b3a22', blonde: '#d9b36a', red: '#a8462a', grey: '#9a948c', white: '#e8e4dc'};
const CLOTH = {
  red: '#b8433a', blue: '#33579c', green: '#3f7a4c', yellow: '#d8a63a', purple: '#6c4fa0', white: '#e9e4d8',
  black: '#2a2a2e', brown: '#7a5233', grey: '#7d7f86', orange: '#d4763a', pink: '#c9617f', teal: '#2f8a87',
};
// Trousers that go with each top.
const BOTTOM: Record<keyof typeof CLOTH, string> = {
  red: '#2a2f45', blue: '#2b2b30', green: '#4a3b2c', yellow: '#2f3a55', purple: '#2a2a32', white: '#3a4258',
  black: '#2b2b30', brown: '#3b3227', grey: '#2b2f3a', orange: '#2a3550', pink: '#2c3142', teal: '#3b3227',
};

export type Colors = {skin: string; hair: string; top: string; bottom: string; shoe: string; metal: string; gold: string};

// Concrete colours for a person; missing choices get a stable pick from their index so a cast stays varied.
export function colorsFor(p: Person, index: number): Colors {
  const tops = Object.keys(CLOTH) as (keyof typeof CLOTH)[];
  const color = p.color ?? tops[(index * 5 + 1) % tops.length];
  const outfitTop = p.outfit === 'suit' ? '#2c3040' : p.outfit === 'armor' ? '#8d929a' : p.outfit === 'uniform' ? '#5b6340' : CLOTH[color] ?? CLOTH.blue;
  return {
    skin: SKIN[p.skin ?? (['light', 'tan', 'brown', 'dark'] as const)[index % 4]],
    hair: HAIR[p.hairColor ?? (['black', 'brown', 'black', 'blonde'] as const)[index % 4]],
    top: outfitTop,
    bottom: p.outfit === 'suit' ? '#262a36' : p.outfit === 'uniform' ? '#4a5134' : BOTTOM[color] ?? '#2b2b30',
    shoe: '#2a221c',
    metal: '#a9aeb6',
    gold: '#e0b44a',
  };
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

// Natural colours per setting; each style blends them toward its own background (see `toner`).
export type SetColors = {sky: string; ground: string; a: string; b: string; glass: string; trim: string};
export const SET_COLORS: Record<string, SetColors> = {
  house: {sky: '#8f8a80', ground: '#4f7a3a', a: '#2f5a2c', b: '#9a3e52', glass: '#7fa7c4', trim: '#e9e4d8'},
  bedroom: {sky: '#c9b79c', ground: '#8a6646', a: '#6b4a32', b: '#c0623f', glass: '#24345e', trim: '#efe9df'},
  street: {sky: '#c9b8a6', ground: '#55585e', a: '#b5826a', b: '#c9b48e', glass: '#f4d58a', trim: '#8b8a86'},
  desert: {sky: '#f0c88e', ground: '#d6ad74', a: '#c99b62', b: '#4f7a36', glass: '#fff2c8', trim: '#8a6a44'},
  mosque: {sky: '#e8b78c', ground: '#d6ccb8', a: '#efe6d4', b: '#4f8a7a', glass: '#6b4f3a', trim: '#8c2f2f'},
  battlefield: {sky: '#b99a78', ground: '#6b6646', a: '#c9b48a', b: '#a8322a', glass: '#8a8478', trim: '#5e5a48'},
  office: {sky: '#cfd6dc', ground: '#6f7782', a: '#8a6a4a', b: '#5d8fc4', glass: '#a9c8de', trim: '#f2efe8'},
  night: {sky: '#0f1630', ground: '#1f2a26', a: '#18221e', b: '#fff6d8', glass: '#fff0c4', trim: '#2c3a34'},
  field: {sky: '#9fd0ee', ground: '#5e8f45', a: '#3f6e34', b: '#ffffff', glass: '#fff4dc', trim: '#6b4a2e'},
  classroom: {sky: '#e6dcc8', ground: '#8a6646', a: '#2f4a3a', b: '#8a6a4a', glass: '#a9c8de', trim: '#efe9df'},
  empty: {sky: '#2b2520', ground: '#3a3128', a: '#4a4034', b: '#5a4e40', glass: '#6a5c4c', trim: '#7a6a58'},
};

const mix = (a: string, b: string, f: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('')}`;
};

// A function that pulls a natural colour into the style's world: toward its background, or to grey for print.
export function toner(bg: string, amount: number, mono = false): (hex: string) => string {
  return (hex) => {
    const c = mix(hex, bg, amount);
    if (!mono) return c;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b).toString(16).padStart(2, '0');
    return `#${l}${l}${l}`;
  };
}
