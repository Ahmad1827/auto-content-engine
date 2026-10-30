import {useMemo} from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp01} from '../fx';
import {type Theme, useTheme} from '../theme';
import type {Word} from '../types';
import {PIXEL_NOTCH} from './Card';
import {FitText} from './Fit';

const MAX_WORDS = 6;
const MAX_GAP = 0.6;
// The caption plate grows upward from here, so it can never reach the handle below it.
const BOTTOM = 1625;
const MAX_TEXT_HEIGHT = 200;

type Phrase = {words: Word[]; start: number; end: number};

function toPhrases(words: Word[]): Phrase[] {
  const phrases: Phrase[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (current.length) phrases.push({words: current, start: current[0].start, end: current[current.length - 1].end});
    current = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (prev && (w.start - prev.end > MAX_GAP)) flush();
    current.push(w);
    if (/[.!?;:؟؛।。！？；：]$/.test(w.text) || current.length >= MAX_WORDS) flush();
  });
  flush();
  return phrases;
}

// The plate that keeps captions readable over any scene.
function plateStyle(t: Theme): React.CSSProperties {
  switch (t.decor) {
    case 'sketch': return {background: 'rgba(12,10,8,0.82)', borderRadius: '18px 8px 20px 8px / 8px 18px 8px 20px', border: `2px solid ${t.muted}`};
    case 'ornate': return {background: 'rgba(243,232,208,0.93)', border: `2px solid ${t.line}`, borderRadius: 2};
    case 'synth': return {background: 'rgba(7,6,26,0.82)', border: `2px solid ${t.outline}`, borderRadius: 10, boxShadow: `0 0 18px ${t.outline}66`};
    case 'press': return {background: 'rgba(244,239,228,0.96)', border: `3px solid ${t.text}`, boxShadow: '5px 5px 0 rgba(0,0,0,0.8)'};
    case 'pixel': return {background: 'rgba(14,10,36,0.92)', clipPath: PIXEL_NOTCH};
    case 'clean': return {background: 'rgba(20,16,12,0.72)', borderRadius: 24};
    default: return {background: 'rgba(8,9,9,0.82)', borderInlineStart: `6px solid ${t.accent}`};
  }
}

// The word being spoken, in the style's own emphasis. `s` is its pop from 0 to 1.
function speakingStyle(t: Theme, s: number, frame: number): React.CSSProperties {
  const pop = `scale(${1 + (1 - s) * 0.22})`;
  switch (t.banner) {
    case 'slash': return {background: t.accent, color: t.onAccent, transform: `${pop} skewX(-5deg)`};
    case 'tape': return {color: t.accent, boxShadow: `inset 0 -8px 0 ${t.accent}55`, transform: `${pop} rotate(${Math.floor(frame / 4) % 2 ? -1.5 : 1.5}deg)`};
    case 'glow': return {color: t.accent, textShadow: `0 0 18px ${t.accent}, 0 0 4px ${t.accent}`, transform: pop};
    case 'stamp': return {background: t.accent, color: t.onAccent, transform: pop};
    case 'pixel': return {color: t.bg, background: t.accent, transform: `translateY(${s < 1 ? -6 : 0}px)`};
    case 'ribbon': return {color: t.accent, boxShadow: `inset 0 -5px 0 ${t.accent}`, transform: pop};
    default: return {color: t.accent, transform: pop};
  }
}

// Word-by-word karaoke captions: spoken words solid, the current word lit in the style's way, upcoming words dim.
export const Captions: React.FC<{words: Word[]; hidden?: [number, number][]}> = ({words, hidden = []}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const phrases = useMemo(() => toPhrases(words), [words]);

  const index = phrases.findIndex((p, i) => time >= p.start && time < (phrases[i + 1]?.start ?? p.end + 0.8));
  if (index === -1 || hidden.some(([a, b]) => time >= a && time < b)) return null;
  const phrase = phrases[index];
  const rise = clamp01((time - phrase.start) * fps / 5);
  const center = t.align === 'center';

  return (
    <div style={{position: 'absolute', insetInlineStart: 72, insetInlineEnd: center ? 72 : 150, bottom: 1920 - BOTTOM, display: 'flex', justifyContent: center ? 'center' : 'flex-start'}}>
      <div style={{padding: '12px 24px', opacity: rise, transform: `translateY(${(1 - rise) * 16}px)`, ...plateStyle(t)}}>
        <FitText size={54} maxHeight={MAX_TEXT_HEIGHT} style={{textAlign: t.align, fontFamily: t.fonts.body, fontWeight: t.bodyWeight, lineHeight: 1.24, color: t.text}}>
          {phrase.words.map((w, i) => {
            const spoken = time >= w.end;
            const speaking = time >= w.start && time < w.end;
            const s = spring({frame: frame - w.start * fps, fps, config: {damping: 14, stiffness: 300}, durationInFrames: 7});
            return (
              <span key={i}>
                <span style={{display: 'inline-block', padding: '0 0.1em', opacity: spoken || speaking ? 1 : 0.42, ...(speaking ? speakingStyle(t, s, frame) : {})}}>{w.text}</span>
                {t.wordGap}
              </span>
            );
          })}
        </FitText>
      </div>
    </div>
  );
};
