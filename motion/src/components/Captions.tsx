import {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../theme';
import type {Word} from '../types';

const MAX_WORDS = 6;
const MAX_GAP = 0.6;

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
    if (/[.!?;:]$/.test(w.text) || current.length >= MAX_WORDS) flush();
  });
  flush();
  return phrases;
}

// Word-by-word karaoke captions: spoken words solid, current word accent, upcoming words dim.
export const Captions: React.FC<{words: Word[]; hidden?: [number, number][]}> = ({words, hidden = []}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const phrases = useMemo(() => toPhrases(words), [words]);

  const index = phrases.findIndex((p, i) => time >= p.start && time < (phrases[i + 1]?.start ?? p.end + 0.8));
  if (index === -1 || hidden.some(([a, b]) => time >= a && time < b)) return null;
  const phrase = phrases[index];

  return (
    <div
      style={{
        position: 'absolute', left: 72, right: 150, top: 1430,
        fontFamily: t.fonts.body, fontWeight: 600, fontSize: 56, lineHeight: 1.22,
        textShadow: t.shadow === 'none' ? 'none' : '0 3px 18px rgba(0,0,0,0.85)',
      }}
    >
      {phrase.words.map((w, i) => {
        const spoken = time >= w.end;
        const speaking = time >= w.start && time < w.end;
        return (
          <span
            key={i}
            style={{
              color: speaking ? t.accent : t.text,
              opacity: spoken || speaking ? 1 : 0.32,
            }}
          >
            {w.text}{' '}
          </span>
        );
      })}
    </div>
  );
};
