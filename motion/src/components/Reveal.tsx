import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp01, easeOut, ramp, rnd} from '../fx';
import {type Theme, useTheme} from '../theme';

// On/off pattern of a neon tube catching.
const FLICKER = [0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0.4, 1];

const graphemes = (text: string) => Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text), (s) => s.segment);

// How one letter arrives and then stays alive, in the current style's manner. `f` counts from its own start, `frame` from the scene's.
function letterStyle(t: Theme, f: number, i: number, frame: number, fps: number): React.CSSProperties {
  switch (t.banner) {
    case 'tape': {
      // Written by hand: each letter pops down, then keeps jittering like redrawn animation.
      const s = ramp(f, 0, 4);
      const seed = Math.floor(frame / 4);
      return {
        opacity: f < 0 ? 0 : 1,
        transform: `translate(${(rnd(i, seed) - 0.5) * 3}px, ${(rnd(i, seed + 40) - 0.5) * 3}px) rotate(${(rnd(i, 7) - 0.5) * 5 + (rnd(i, seed + 80) - 0.5) * 1.6}deg) scale(${1.45 - 0.45 * easeOut(s)})`,
      };
    }
    case 'ribbon': {
      // Ink soaking into the paper.
      const s = easeOut(ramp(f, 0, 14));
      return {opacity: s, transform: `translateY(${(1 - s) * 14}px)`, filter: s < 1 ? `blur(${(1 - s) * 7}px)` : undefined};
    }
    case 'glow': {
      // A letter that catches like a tube and now and then stutters.
      const on = f < 0 ? 0 : FLICKER[Math.floor(f / 2)] ?? (rnd(i, Math.floor(frame / 30)) > 0.93 && frame % 30 < 5 ? 0.35 : 1);
      return {opacity: on};
    }
    case 'stamp': {
      // Set in metal type: drops hard with no bounce.
      const s = easeOut(ramp(f, 0, 5));
      return {opacity: f < 0 ? 0 : 1, transform: `scale(${1.7 - 0.7 * s})`};
    }
    case 'pixel': {
      // Appears in whole steps and then rides a slow stepped wave.
      const drop = f < 0 ? 0 : f < 2 ? -18 : f < 4 ? 6 : 0;
      const wave = f < 4 ? 0 : Math.round(Math.sin((frame - i * 3) / 9) * 1.4) * 3;
      return {opacity: f < 0 ? 0 : 1, transform: `translateY(${drop + wave}px)`};
    }
    case 'pill': {
      // Rises softly into place.
      const s = easeOut(ramp(f, 0, 16));
      return {opacity: s, transform: `translateY(${(1 - s) * 30}px)`};
    }
    default: {
      // Slams up with a little overshoot.
      const s = spring({frame: f, fps, config: {damping: 11, stiffness: 240}});
      return {opacity: clamp01(s * 2), transform: `translateY(${(1 - s) * 70}px) skewX(${(1 - s) * -14}deg)`};
    }
  }
}

// Text that animates in letter by letter; "*word*" takes the accent colour. Joined-up scripts move a word at a time.
export const Reveal: React.FC<{text: string; delay?: number; stagger?: number; color?: string; accent?: string}> = ({text, delay = 0, stagger = 1.2, color, accent}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const base = color ?? t.text;
  // Long text still finishes arriving in about a second.
  const pace = Math.min(stagger, 32 / Math.max(1, t.connected ? text.split(/\s+/).length * 4 : text.length));
  let index = 0;
  const unit = (content: string, tint: string, key: number, step: number) => {
    const i = index++;
    return (
      <span key={key} style={{display: 'inline-block', whiteSpace: 'pre', color: tint, ...letterStyle(t, frame - delay - i * pace * step, i, frame, fps)}}>
        {content}
      </span>
    );
  };
  return (
    <>
      {text.split('*').map((part, p) => {
        const tint = p % 2 ? accent ?? t.accent : base;
        // Chinese and Japanese can break anywhere, so every character is its own unbreakable piece.
        const pieces = t.wordGap ? part.split(/(\s+)/) : graphemes(part);
        return (
          <span key={p}>
            {pieces.map((piece, w) => {
              if (!piece) return null;
              if (/^\s+$/.test(piece)) return piece;
              if (t.connected) return unit(piece, tint, w, 4);
              return (
                <span key={w} style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                  {graphemes(piece).map((g, k) => unit(g, tint, k, 1))}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
};
