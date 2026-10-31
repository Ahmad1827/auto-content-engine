import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {createContext, useContext, useMemo} from 'react';
import {AbsoluteFill, Audio, Composition, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {localizeTheme} from '../language';
import {THEMES} from '../theme';

const {fontFamily} = loadMontserrat('normal', {weights: ['800'], subsets: ['latin']});

export type Word = {text: string; start: number; end: number};
export type Beat = {narration: string; start: number; duration: number; shots?: string[]};
export type FilmData = {
  id: string;
  title: string;
  language?: string;
  fps: number;
  width: number;
  height: number;
  captions: boolean;
  handle?: string;
  audio?: string;
  music?: string;
  beats: Beat[];
  words: Word[];
};

const FilmContext = createContext<(FilmData & {font: string}) | null>(null);

export const useFilm = () => useContext(FilmContext) as FilmData & {font: string};

// Film time in seconds. Prefer this over frames, since all the film's timing is in seconds.
export const useTime = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps;
};

// The time a word of the narration starts: wordAt('skeleton') for the first time it's said after `after` seconds. Cut on these.
export function useWordAt() {
  const {words} = useFilm();
  return (text: string, after = 0) => {
    const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const hit = words.find((w) => w.start >= after && clean(w.text) === clean(text));
    if (!hit) throw new Error(`"${text}" isn't said after ${after}s`);
    return hit.start;
  };
}

// Big white word-group captions like the TikTok originals. The film can pass `top` per moment to keep clear of a face.
// A soft warm finish over the picture: darker corners draw the eye inward. Goes between the Stage and the Captions.
export const Grade: React.FC<{warmth?: number; vignette?: number}> = ({warmth = 0.1, vignette = 0.42}) => (
  <>
    <AbsoluteFill style={{background: `rgba(255,170,90,${warmth})`, mixBlendMode: 'soft-light'}} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse 72% 62% at 50% 46%, rgba(20,12,45,0) 42%, rgba(20,12,45,${vignette}) 100%)`}} />
  </>
);

export const Captions: React.FC<{top?: number | ((t: number) => number); size?: number}> = ({top = 1180, size = 62}) => {
  const {words, font} = useFilm();
  const t = useTime();
  const groups = useMemo(() => {
    const out: Word[][] = [];
    let cur: Word[] = [];
    words.forEach((w, i) => {
      if (cur.length && w.start - words[i - 1].end > 0.5) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
      if (cur.length >= 4 || /[.!?;:؟؛।。！？；：,،]$/.test(w.text)) {
        out.push(cur);
        cur = [];
      }
    });
    if (cur.length) out.push(cur);
    return out;
  }, [words]);
  const group = groups.find((g, i) => t >= g[0].start && t < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.7));
  if (!group) return null;
  const y = typeof top === 'function' ? top(t) : top;
  const pop = Math.min(1, (t - group[0].start) * 12);
  return (
    <div style={{position: 'absolute', left: 90, right: 90, top: y, textAlign: 'center', fontFamily: font, fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: size, lineHeight: 1.2, color: '#fff', transform: `scale(${0.96 + 0.04 * pop})`,
      textShadow: '0 3px 0 #0b0b0d, 0 0 14px rgba(0,0,0,0.75)'}}>
      {group.map((w, i) => {
        // The word being said sits on a red bar.
        const now = t >= w.start && (i === group.length - 1 || t < group[i + 1].start);
        return <span key={i}><span style={now ? {background: '#c8102e', borderRadius: 6, padding: '0 10px', margin: '0 -10px'} : undefined}>{w.text}</span>{' '}</span>;
      })}
    </div>
  );
};

// Cuts need no transition, but these sell a few big moments: a white flash, a dip to black, or a smear of motion blur around a whip pan.
export const Transitions: React.FC<{marks: {at: number; kind: 'flash' | 'black' | 'whip'; length?: number}[]; children?: React.ReactNode}> = ({marks, children}) => {
  const t = useTime();
  let blur = 0;
  let cover = 0;
  let color = '#fff';
  for (const m of marks) {
    const half = (m.length ?? (m.kind === 'whip' ? 0.2 : 0.3)) / 2;
    const k = Math.max(0, 1 - Math.abs(t - m.at) / half);
    if (m.kind === 'whip') blur = Math.max(blur, k * 26);
    else if (k > cover) {
      cover = k;
      color = m.kind === 'flash' ? '#fff' : '#000';
    }
  }
  return (
    <AbsoluteFill style={{filter: blur ? `blur(${blur}px)` : undefined}}>
      {children}
      {cover > 0 && <AbsoluteFill style={{background: color, opacity: cover}} />}
    </AbsoluteFill>
  );
};

// Fills the frame edge to edge; everything the film draws goes inside. The narration, music and handle are handled here.
const Shell: React.FC<{data: FilmData; component: React.FC}> = ({data, component: Body}) => {
  const value = useMemo(() => {
    const text = data.beats.map((b) => b.narration).join(' ');
    const language = data.language ?? 'en';
    const font = language === 'en' ? fontFamily : `${fontFamily}, ${localizeTheme(THEMES.atlas, language, text).fonts.body}`;
    return {...data, font};
  }, [data]);
  return (
    <FilmContext.Provider value={value}>
      <AbsoluteFill style={{background: '#000', direction: data.language === 'ar' ? 'rtl' : 'ltr'}}>
        <Body />
        {data.handle && <div style={{position: 'absolute', top: 1720, width: '100%', textAlign: 'center', fontFamily: value.font, fontWeight: 800, fontSize: 30, color: '#fff', opacity: 0.8, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill', direction: 'ltr'}}>{data.handle}</div>}
        {data.audio && <Audio src={staticFile(data.audio)} />}
        {data.music && <Audio src={staticFile(data.music)} volume={0.1} />}
      </AbsoluteFill>
    </FilmContext.Provider>
  );
};

// Each film's index.ts passes this to registerRoot, with its own component and data.
export function filmRoot(component: React.FC, data: FilmData): React.FC {
  const last = data.beats[data.beats.length - 1];
  const seconds = last ? last.start + last.duration : 10;
  return () => <Composition id="Film" component={() => <Shell data={data} component={component} />} width={data.width} height={data.height} fps={data.fps} durationInFrames={Math.ceil(seconds * data.fps)} />;
}
