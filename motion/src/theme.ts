import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadCourier} from '@remotion/google-fonts/CourierPrime';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadKalam} from '@remotion/google-fonts/Kalam';
import {loadFont as loadMarker} from '@remotion/google-fonts/PermanentMarker';
import {loadFont as loadNewsreader} from '@remotion/google-fonts/Newsreader';
import {loadFont as loadPixelify} from '@remotion/google-fonts/PixelifySans';
import {loadFont as loadSilkscreen} from '@remotion/google-fonts/Silkscreen';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadLora} from '@remotion/google-fonts/Lora';
import {loadFont as loadOldStandard} from '@remotion/google-fonts/OldStandardTT';
import {loadFont as loadOrbitron} from '@remotion/google-fonts/Orbitron';
import {loadFont as loadOswald} from '@remotion/google-fonts/Oswald';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadShareTech} from '@remotion/google-fonts/ShareTechMono';
import {loadFont as loadSpecialElite} from '@remotion/google-fonts/SpecialElite';
import {createContext, useContext} from 'react';
import type {StyleName} from './types';

const latin = {subsets: ['latin', 'latin-ext'] as ('latin' | 'latin-ext')[]};
const bebas = loadBebas().fontFamily;
const inter = loadInter('normal', {weights: ['400', '600', '800'], ...latin}).fontFamily;
const jetbrains = loadMono('normal', {weights: ['500', '700'], ...latin}).fontFamily;
const playfair = loadPlayfair('normal', {weights: ['700', '900'], ...latin}).fontFamily;
const lora = loadLora('normal', {weights: ['500', '600'], ...latin}).fontFamily;
const courier = loadCourier('normal', {weights: ['400', '700'], ...latin}).fontFamily;
const orbitron = loadOrbitron('normal', {weights: ['700', '900'], subsets: ['latin']}).fontFamily;
const shareTech = loadShareTech('normal', {subsets: ['latin']}).fontFamily;
const oswald = loadOswald('normal', {weights: ['600', '700'], ...latin}).fontFamily;
const oldStandard = loadOldStandard('normal', {weights: ['400', '700'], ...latin}).fontFamily;
const specialElite = loadSpecialElite('normal', {subsets: ['latin']}).fontFamily;
const marker = loadMarker().fontFamily;
const kalam = loadKalam('normal', {weights: ['700'], ...latin}).fontFamily;
const newsreader = loadNewsreader('normal', {weights: ['400', '500'], ...latin}).fontFamily;
const pixelify = loadPixelify('normal', {weights: ['500', '700'], ...latin}).fontFamily;
const silkscreen = loadSilkscreen('normal', {weights: ['400'], ...latin}).fontFamily;

export type Texture = 'grain' | 'paper' | 'grid' | 'halftone' | 'pixel' | 'soft';
// Per-style frame dressing drawn over every scene (components/Decor.tsx).
export type Decor = 'hud' | 'sketch' | 'ornate' | 'synth' | 'press' | 'pixel' | 'clean';
// How the headline banner looks and lands (components/HeadlineBlock.tsx).
export type BannerStyle = 'slash' | 'tape' | 'ribbon' | 'glow' | 'stamp' | 'pixel' | 'pill';

export type Theme = {
  bg: string;
  land: string;
  landFocus: string;
  border: string;
  outline: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  line: string;
  panel: string;
  // Text shadow that lifts type off the background (dark halo on dark themes, none on paper).
  shadow: string;
  glow: number;
  texture: Texture;
  decor: Decor;
  banner: BannerStyle;
  // How cast scenes (people) are drawn, and whether headlines sit left or centred.
  render: 'flat' | 'pixel' | '3d';
  align: 'start' | 'center';
  // How far cast-scene sets are pulled toward the background colour (0 = natural colours), and greyscale for print.
  setTone: number;
  setMono?: boolean;
  // Outline colour for people and sets, when it should differ from `line`.
  castOutline?: string;
  // Line art: stroke width, and how far strokes are pushed off true (0 = clean vector, >0 = hand-inked).
  lineWidth: number;
  wobble: number;
  // Redraw the wobble every few frames so lines "boil" like hand-drawn animation.
  boil: boolean;
  bodyWeight: number;
  fonts: {display: string; body: string; mono: string};
  // Display fonts differ in width; headlines are sized for Bebas and scaled by this.
  displayScale: number;
  displayWeight: number;
  // Average uppercase glyph width in em, used to shrink long lines so they never overflow.
  displayCharEm: number;
  displayLineHeight: number;
  // Set per video by localizeTheme (language.ts).
  language: string;
  rtl: boolean;
  // Line height for wrapped display text, roomier for alphabets with tall marks.
  displayWrapHeight: number;
  // What separates words: nothing in Chinese and Japanese.
  wordGap: string;
  // Arabic and Devanagari letters join up, so tracking would tear words apart.
  connected: boolean;
};

const LATIN_LANGUAGE = {language: 'en', rtl: false, displayWrapHeight: 0.98, wordGap: ' ', connected: false};

const dark = {shadow: '0 6px 30px rgba(0,0,0,0.7)', glow: 1, displayScale: 1, displayWeight: 400, displayCharEm: 0.4, displayLineHeight: 0.92,
  lineWidth: 5, wobble: 0, boil: false, bodyWeight: 600, render: 'flat' as const, align: 'start' as const, setTone: 0.55, ...LATIN_LANGUAGE};

export const THEMES: Record<StyleName, Theme> = {
  // Dark cartographic history look: glowing borders, cream type, red accent.
  atlas: {
    ...dark,
    bg: '#0d0e0e', land: '#191b1a', landFocus: '#262a27', border: '#2c302d', outline: '#f1c9b4',
    text: '#ece6d6', muted: '#8d877a', accent: '#e2342b', onAccent: '#ece6d6', line: '#ece6d6',
    panel: 'rgba(255,255,255,0.03)', texture: 'grain', decor: 'hud', banner: 'slash',
    fonts: {display: bebas, body: inter, mono: jetbrains},
  },
  // Hand-drawn on near black: marker headlines, boiling ink lines, orange highlights.
  ink: {
    ...dark,
    bg: '#0c0a08', land: '#17130f', landFocus: '#221c16', border: '#2a231c', outline: '#ffb27a',
    text: '#f3ece0', muted: '#8a7f70', accent: '#ff8a3d', onAccent: '#1a0f06', line: '#f3ece0',
    panel: 'rgba(255,240,220,0.025)', texture: 'grain', decor: 'sketch', banner: 'tape',
    lineWidth: 5.5, wobble: 5, boil: true, bodyWeight: 700, setTone: 0.42,
    fonts: {display: marker, body: kalam, mono: jetbrains},
    displayScale: 0.72, displayCharEm: 0.72, displayLineHeight: 1.06,
  },
  // Old map on aged paper: sepia ink, oxblood accent, serif type. Medieval, ancient, empires.
  parchment: {
    ...LATIN_LANGUAGE,
    bg: '#e9dcc0', land: '#dccaa3', landFocus: '#cdb487', border: '#b89f74', outline: '#5a3a1e',
    text: '#2b1d10', muted: '#7a6247', accent: '#8e1f14', onAccent: '#f3e8d0', line: '#3a2715',
    panel: 'rgba(90,58,30,0.05)', texture: 'paper', decor: 'ornate', banner: 'ribbon', render: 'flat', align: 'start', setTone: 0.4, shadow: 'none', glow: 0.35,
    lineWidth: 4, wobble: 2, boil: false, bodyWeight: 600,
    fonts: {display: playfair, body: lora, mono: courier},
    displayScale: 0.7, displayWeight: 900, displayCharEm: 0.66, displayLineHeight: 1.08,
  },
  // Synthwave glow: cyan lines, magenta accent on deep indigo. Mysteries, space, tech, conspiracies.
  neon: {
    ...LATIN_LANGUAGE,
    bg: '#07061a', land: '#0f0d2b', landFocus: '#16134a', border: '#2a2368', outline: '#3ef2ff',
    text: '#e8f7ff', muted: '#7b78b8', accent: '#ff2bd6', onAccent: '#07061a', line: '#3ef2ff',
    panel: 'rgba(62,242,255,0.04)', texture: 'grid', decor: 'synth', banner: 'glow', render: 'flat', align: 'start', setTone: 0.6, glow: 1.6,
    // Chromatic split plus glow, like a CRT out of convergence.
    shadow: '-3px 0 0 rgba(62,242,255,0.55), 3px 0 0 rgba(255,43,214,0.6), 0 0 26px rgba(255,43,214,0.45)',
    lineWidth: 4.5, wobble: 0, boil: false, bodyWeight: 600,
    fonts: {display: orbitron, body: inter, mono: shareTech},
    displayScale: 0.62, displayWeight: 900, displayCharEm: 0.9, displayLineHeight: 1.1,
  },
  // Front page of an old newspaper: black ink on newsprint, red stamp. 1900s events, crimes, disasters.
  newspaper: {
    ...LATIN_LANGUAGE,
    bg: '#ece7dc', land: '#d9d2c3', landFocus: '#bfb6a3', border: '#a59c8a', outline: '#111111',
    text: '#111111', muted: '#5d574c', accent: '#c41e1e', onAccent: '#f4efe4', line: '#161616',
    panel: 'rgba(0,0,0,0.035)', texture: 'halftone', decor: 'press', banner: 'stamp', render: 'flat', align: 'start', setTone: 0.2, setMono: true, shadow: 'none', glow: 0.2,
    lineWidth: 4.5, wobble: 0.8, boil: false, bodyWeight: 600,
    fonts: {display: oswald, body: oldStandard, mono: specialElite},
    displayScale: 0.8, displayWeight: 700, displayCharEm: 0.5, displayLineHeight: 1.02,
  },
  // 8-bit: pixel-art people on a deep violet night, glowing floor, pixel type.
  pixel: {
    ...LATIN_LANGUAGE,
    bg: '#0e0a24', land: '#191338', landFocus: '#221a4a', border: '#3a2f7a', outline: '#b6a8ff',
    text: '#efeaff', muted: '#8a82c0', accent: '#a493ff', onAccent: '#0e0a24', line: '#d9d2ff',
    panel: 'rgba(164,147,255,0.05)', texture: 'pixel', decor: 'pixel', banner: 'pixel', render: 'pixel', align: 'center', setTone: 0.5, castOutline: '#140e2c',
    shadow: '5px 5px 0 rgba(0,0,0,0.5)', glow: 0.8, lineWidth: 5, wobble: 0, boil: false, bodyWeight: 500,
    fonts: {display: pixelify, body: pixelify, mono: silkscreen},
    displayScale: 0.72, displayWeight: 700, displayCharEm: 0.62, displayLineHeight: 1.0,
  },
  // Low-poly 3D people in little sets, soft daylight, elegant serif titles with a gold accent.
  diorama: {
    ...LATIN_LANGUAGE,
    bg: '#1c1712', land: '#2a241d', landFocus: '#3a3127', border: '#4a4034', outline: '#f0d9a8',
    text: '#fbf6ec', muted: '#d9ccb6', accent: '#f2b84b', onAccent: '#1c1712', line: '#fbf6ec',
    panel: 'rgba(255,255,255,0.05)', texture: 'soft', decor: 'clean', banner: 'pill', render: '3d', align: 'center', setTone: 0,
    shadow: '0 3px 22px rgba(0,0,0,0.6)', glow: 0.6, lineWidth: 5, wobble: 0, boil: false, bodyWeight: 600,
    fonts: {display: newsreader, body: inter, mono: inter},
    displayScale: 0.62, displayWeight: 400, displayCharEm: 0.56, displayLineHeight: 1.1,
  },
};

// Display font size for one line of `text`: the design size, shrunk if the line would overflow.
export function fitDisplay(t: Theme, text: string, size: number, maxWidth = 936): number {
  const chars = Math.max(1, text.replace(/\*/g, '').length);
  return Math.min(size * t.displayScale, maxWidth / (chars * t.displayCharEm));
}

export const ThemeContext = createContext<Theme>(THEMES.atlas);
export const useTheme = () => useContext(ThemeContext);
