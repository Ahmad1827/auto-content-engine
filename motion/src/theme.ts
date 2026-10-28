import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadCourier} from '@remotion/google-fonts/CourierPrime';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
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

export type Texture = 'grain' | 'paper' | 'grid' | 'halftone';

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
  fonts: {display: string; body: string; mono: string};
  // Display fonts differ in width; headlines are sized for Bebas and scaled by this.
  displayScale: number;
  displayWeight: number;
  // Average uppercase glyph width in em, used to shrink long lines so they never overflow.
  displayCharEm: number;
  displayLineHeight: number;
};

const dark = {shadow: '0 6px 30px rgba(0,0,0,0.7)', glow: 1, displayScale: 1, displayWeight: 400, displayCharEm: 0.4, displayLineHeight: 0.92};

export const THEMES: Record<StyleName, Theme> = {
  // Dark cartographic history look: glowing borders, cream type, red accent.
  atlas: {
    ...dark,
    bg: '#0d0e0e', land: '#191b1a', landFocus: '#262a27', border: '#2c302d', outline: '#f1c9b4',
    text: '#ece6d6', muted: '#8d877a', accent: '#e2342b', onAccent: '#ece6d6', line: '#ece6d6',
    panel: 'rgba(255,255,255,0.03)', texture: 'grain',
    fonts: {display: bebas, body: inter, mono: jetbrains},
  },
  // Warm line-art on near black, orange highlights.
  ink: {
    ...dark,
    bg: '#0c0a08', land: '#17130f', landFocus: '#221c16', border: '#2a231c', outline: '#ffb27a',
    text: '#f3ece0', muted: '#8a7f70', accent: '#ff8a3d', onAccent: '#1a0f06', line: '#f3ece0',
    panel: 'rgba(255,240,220,0.025)', texture: 'grain',
    fonts: {display: bebas, body: inter, mono: jetbrains},
  },
  // Old map on aged paper: sepia ink, oxblood accent, serif type. Medieval, ancient, empires.
  parchment: {
    bg: '#e9dcc0', land: '#dccaa3', landFocus: '#cdb487', border: '#b89f74', outline: '#5a3a1e',
    text: '#2b1d10', muted: '#7a6247', accent: '#8e1f14', onAccent: '#f3e8d0', line: '#3a2715',
    panel: 'rgba(90,58,30,0.05)', texture: 'paper', shadow: 'none', glow: 0.35,
    fonts: {display: playfair, body: lora, mono: courier},
    displayScale: 0.7, displayWeight: 900, displayCharEm: 0.66, displayLineHeight: 1.08,
  },
  // Synthwave glow: cyan lines, magenta accent on deep indigo. Mysteries, space, tech, conspiracies.
  neon: {
    bg: '#07061a', land: '#0f0d2b', landFocus: '#16134a', border: '#2a2368', outline: '#3ef2ff',
    text: '#e8f7ff', muted: '#7b78b8', accent: '#ff2bd6', onAccent: '#07061a', line: '#3ef2ff',
    panel: 'rgba(62,242,255,0.04)', texture: 'grid', shadow: '0 0 24px rgba(255,43,214,0.45)', glow: 1.6,
    fonts: {display: orbitron, body: inter, mono: shareTech},
    displayScale: 0.62, displayWeight: 900, displayCharEm: 0.9, displayLineHeight: 1.1,
  },
  // Front page of an old newspaper: black ink on newsprint, red stamp. 1900s events, crimes, disasters.
  newspaper: {
    bg: '#ece7dc', land: '#d9d2c3', landFocus: '#bfb6a3', border: '#a59c8a', outline: '#111111',
    text: '#111111', muted: '#5d574c', accent: '#c41e1e', onAccent: '#f4efe4', line: '#161616',
    panel: 'rgba(0,0,0,0.035)', texture: 'halftone', shadow: 'none', glow: 0.2,
    fonts: {display: oswald, body: oldStandard, mono: specialElite},
    displayScale: 0.8, displayWeight: 700, displayCharEm: 0.5, displayLineHeight: 1.02,
  },
};

// Display font size for one line of `text`: the design size, shrunk if the line would overflow.
export function fitDisplay(t: Theme, text: string, size: number, maxWidth = 936): number {
  const chars = Math.max(1, text.replace(/\*/g, '').length);
  return Math.min(size * t.displayScale, maxWidth / (chars * t.displayCharEm));
}

export const ThemeContext = createContext<Theme>(THEMES.atlas);
export const useTheme = () => useContext(ThemeContext);
