import {loadFont as loadArabic} from '@remotion/google-fonts/NotoSansArabic';
import {loadFont as loadDevanagari} from '@remotion/google-fonts/NotoSansDevanagari';
import {getInfo as jpInfo, loadFont as loadJP} from '@remotion/google-fonts/NotoSansJP';
import {getInfo as krInfo, loadFont as loadKR} from '@remotion/google-fonts/NotoSansKR';
import {loadFont as loadSans} from '@remotion/google-fonts/NotoSans';
import {getInfo as scInfo, loadFont as loadSC} from '@remotion/google-fonts/NotoSansSC';
import type {Theme} from './theme';

type Script = {
  // Loads the font drawing this alphabet. It backs up the style's own fonts, which still draw what they can (digits, Latin names).
  font: (text: string) => string;
  // Average glyph width in em for fitDisplay, and the line height the alphabet's marks need.
  charEm: number;
  lineHeight: number;
};

const weights: ('400' | '700')[] = ['400', '700'];
const sans = (subset: 'latin-ext' | 'cyrillic') => () => loadSans('normal', {weights, subsets: ['latin', subset]}).fontFamily;

// CJK fonts come in over a hundred slices, so fetch only the ones this video's text needs.
function slicesFor(ranges: Record<string, string>, text: string): string[] {
  const codes = new Set([...text].map((c) => c.codePointAt(0) as number));
  const covers = (range: string) => {
    const [from, to = from] = range.trim().slice(2).split('-').map((n) => parseInt(n, 16));
    for (const code of codes) if (code >= from && code <= to) return true;
    return false;
  };
  return Object.keys(ranges).filter((slice) => ranges[slice].split(',').some(covers));
}

const cjk = (info: () => {unicodeRanges: Record<string, string>}, load: (style: 'normal', options: {weights: '700'[]; subsets: never[]}) => {fontFamily: string}) => (text: string) =>
  load('normal', {weights: ['700'], subsets: slicesFor(info().unicodeRanges, text) as never[]}).fontFamily;

const SCRIPTS: Record<string, Script> = {
  latinExt: {font: sans('latin-ext'), charEm: 0, lineHeight: 0},
  cyrillic: {font: sans('cyrillic'), charEm: 0.66, lineHeight: 1.1},
  arabic: {font: () => loadArabic('normal', {weights, subsets: ['arabic']}).fontFamily, charEm: 0.5, lineHeight: 1.4},
  devanagari: {font: () => loadDevanagari('normal', {weights, subsets: ['devanagari']}).fontFamily, charEm: 0.62, lineHeight: 1.4},
  ja: {font: cjk(jpInfo, loadJP), charEm: 1.06, lineHeight: 1.2},
  ko: {font: cjk(krInfo, loadKR), charEm: 0.95, lineHeight: 1.2},
  zh: {font: cjk(scInfo, loadSC), charEm: 1.06, lineHeight: 1.2},
};

const SCRIPT_OF: Record<string, string> = {ar: 'arabic', hi: 'devanagari', ru: 'cyrillic', uk: 'cyrillic', ja: 'ja', ko: 'ko', zh: 'zh'};

// `text` is every string in the video, so CJK fonts can load just what it uses.
export function localizeTheme(theme: Theme, language: string, text: string): Theme {
  if (language === 'en') return theme;
  const script = SCRIPTS[SCRIPT_OF[language] ?? 'latinExt'];
  const noto = script.font(text);
  const withNoto = (font: string) => `${font}, ${noto}`;
  const localized: Theme = {
    ...theme,
    language,
    rtl: language === 'ar',
    connected: language === 'ar' || language === 'hi',
    wordGap: language === 'zh' || language === 'ja' ? '' : ' ',
    fonts: {display: withNoto(theme.fonts.display), body: withNoto(theme.fonts.body), mono: withNoto(theme.fonts.mono)},
  };
  // Latin-script languages keep the style's sizing; a few letters just borrow from the backup font.
  if (!script.charEm) return localized;
  return {
    ...localized,
    // Noto is much wider than the condensed display fonts and has no light cut to match.
    displayScale: Math.min(theme.displayScale, 0.72),
    displayWeight: 700,
    displayCharEm: Math.max(theme.displayCharEm, script.charEm),
    displayLineHeight: Math.max(theme.displayLineHeight, script.lineHeight),
    displayWrapHeight: script.lineHeight,
  };
}
