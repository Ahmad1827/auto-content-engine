import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitDisplay, type Theme, useTheme} from '../theme';
import type {Headline} from '../types';

const SIZES = {xl: 190, l: 140, m: 96};

// "*44* TURKS" -> "44" in accent color, rest in text color.
function renderMarked(text: string, accent: string, base: string) {
  return text.split('*').map((part, i) => (
    <span key={i} style={{color: i % 2 === 1 ? accent : base}}>{part}</span>
  ));
}

// Big condensed headline that slams in line by line, with an optional skewed banner.
export const HeadlineBlock: React.FC<{headline: Headline; top?: number}> = ({headline, top = 1000}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const lineDelay = (i: number) => 3 + i * 6;
  const bannerDelay = lineDelay(headline.lines.length) + 4;

  return (
    <div style={{position: 'absolute', left: 72, right: 72, top, display: 'flex', flexDirection: 'column', alignItems: t.align === 'center' ? 'center' : 'flex-start', textAlign: t.align}}>
      {headline.lines.map((line, i) => {
        const s = spring({frame: frame - lineDelay(i), fps, config: {damping: 13, stiffness: 190}});
        const base = line.accent ? t.accent : t.text;
        return (
          <div
            key={i}
            style={{
              fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: t.displayLineHeight,
              fontSize: fitDisplay(t, line.text, SIZES[line.size ?? 'l']),
              letterSpacing: 1, opacity: s,
              transform: `translateY(${(1 - s) * 50}px) scale(${1 + (1 - s) * 0.18})`,
              transformOrigin: t.align === 'center' ? 'center' : t.rtl ? 'right center' : 'left center',
              textShadow: t.shadow,
            }}
          >
            {renderMarked(line.text, t.accent, base)}
          </div>
        );
      })}
      {headline.banner && <Banner text={headline.banner} frame={frame - bannerDelay} />}
    </div>
  );
};

// Torn edges for the ink style's strip of tape: a zigzag down each short side.
const TAPE_EDGE = (() => {
  const steps = 8;
  const left = Array.from({length: steps + 1}, (_, i) => `${i % 2 ? 1.6 : 0}% ${(i / steps) * 100}%`);
  const right = Array.from({length: steps + 1}, (_, i) => `${i % 2 ? 98.4 : 100}% ${100 - (i / steps) * 100}%`);
  return `polygon(${[...left, ...right].join(', ')})`;
})();

// Rough ink for the newspaper stamp: noise used as an alpha mask leaves bare patches.
const STAMP_MASK = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.35'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

// On/off pattern of a neon tube catching.
const FLICKER = [0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0.4, 1];

// The banner under a headline, in the current style's look: `frame` counts from when it should appear.
const Banner: React.FC<{text: string; frame: number}> = ({text, frame}) => {
  const t = useTheme();
  const {fps} = useVideoConfig();
  const base: React.CSSProperties = {
    marginTop: 18, fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: 1.05,
    fontSize: fitDisplay(t, text, 84, 880), color: t.onAccent, whiteSpace: 'nowrap',
  };
  const springIn = (config: object) => spring({frame, fps, config});
  return <div style={{...base, ...bannerStyle(t, frame, springIn, text)}}>{text}</div>;
};

function bannerStyle(t: Theme, frame: number, springIn: (config: object) => number, text: string): React.CSSProperties {
  switch (t.banner) {
    case 'tape': {
      const s = springIn({damping: 12, stiffness: 170});
      return {
        padding: '10px 40px 6px', background: t.accent, clipPath: TAPE_EDGE, opacity: Math.min(1, s * 2),
        transform: `rotate(${interpolate(s, [0, 1], [-9, -2.5])}deg) scale(${interpolate(s, [0, 1], [0.6, 1])})`, transformOrigin: 'left center',
      };
    }
    case 'ribbon': {
      // Unrolls from the left instead of flying in.
      const s = springIn({damping: 200, stiffness: 120});
      const notch = 'polygon(0 0, 100% 0, calc(100% - 26px) 50%, 100% 100%, 0 100%, 26px 50%)';
      return {
        padding: '10px 58px 8px', background: t.accent, clipPath: notch,
        transform: `scaleX(${s})`, transformOrigin: 'left center', opacity: s > 0.02 ? 1 : 0,
        boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.18), inset 0 4px 0 rgba(255,255,255,0.12)',
      };
    }
    case 'glow': {
      const on = frame < 0 ? 0 : FLICKER[Math.floor(frame / 2)] ?? 1;
      return {
        padding: '10px 26px 6px', color: t.accent, border: `4px solid ${t.accent}`, borderRadius: 10, opacity: on,
        boxShadow: `0 0 26px ${t.accent}, inset 0 0 18px ${t.accent}88`, textShadow: `0 0 18px ${t.accent}`,
        background: 'rgba(7,6,26,0.55)',
      };
    }
    case 'pixel': {
      // Blocky label with stepped corners that types itself in, 3 frames per step.
      const steps = Math.max(0, Math.min(1, Math.floor(frame / 3) / 4));
      const notch = 'polygon(0 8px, 8px 8px, 8px 0, calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 8px), 0 calc(100% - 8px))';
      return {
        padding: '12px 30px 8px', background: t.accent, clipPath: notch, opacity: steps > 0 ? 1 : 0,
        transform: `scaleX(${steps})`, filter: 'drop-shadow(6px 6px 0 rgba(0,0,0,0.5))',
      };
    }
    case 'pill': {
      const s = springIn({damping: 200, stiffness: 90});
      return {
        marginTop: 26, padding: '14px 34px 12px', borderRadius: 999, color: t.accent, fontFamily: t.fonts.body, fontWeight: 600,
        fontSize: Math.min(40, 880 / Math.max(1, text.length * 0.62)), letterSpacing: 6, textTransform: 'uppercase',
        background: 'rgba(20,16,12,0.45)', border: `2px solid ${t.accent}66`, backdropFilter: 'blur(10px)',
        opacity: s, transform: `translateY(${(1 - s) * 24}px)`,
      };
    }
    case 'stamp': {
      // Lands hard from above the page, like a rubber stamp.
      const s = springIn({damping: 16, stiffness: 320, mass: 0.7});
      return {
        marginTop: 34, padding: '10px 28px 6px', color: t.accent, border: `6px double ${t.accent}`, borderRadius: 6,
        transform: `rotate(-3deg) scale(${interpolate(s, [0, 1], [1.9, 1])})`, transformOrigin: 'left center',
        opacity: Math.min(1, s * 3) * 0.92, WebkitMaskImage: STAMP_MASK, WebkitMaskSize: '400px 200px',
      };
    }
    default: {
      const s = springIn({damping: 14, stiffness: 160});
      return {
        padding: '6px 22px 2px', background: t.accent,
        transform: `translateX(${interpolate(s, [0, 1], [-900, 0])}px) skewX(-6deg) rotate(-1.5deg)`,
        boxShadow: t.shadow === 'none' ? '0 6px 0 rgba(0,0,0,0.15)' : '0 10px 40px rgba(0,0,0,0.5)',
      };
    }
  }
}
