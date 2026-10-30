import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {ramp} from '../fx';
import {fitDisplay, type Theme, STAGE, useTheme} from '../theme';
import type {Headline} from '../types';
import {PIXEL_NOTCH} from './Card';
import {Fit, FitBlock} from './Fit';
import {Reveal} from './Reveal';

const SIZES = {xl: 190, l: 140, m: 96};
// Headlines stop above the handle, whichever scene they sit on.
const LOWEST = 1620;

// Big headline whose lines land one after another in the style's manner, with an optional banner under them.
export const HeadlineBlock: React.FC<{headline: Headline; top?: number; maxHeight?: number}> = ({headline, top = 1000, maxHeight}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const lineDelay = (i: number) => 3 + i * 7;
  const bannerDelay = lineDelay(headline.lines.length) + 6;
  const center = t.align === 'center';
  const origin = center ? 'center top' : t.rtl ? 'right top' : 'left top';

  return (
    <FitBlock maxHeight={maxHeight ?? LOWEST - top} origin={origin} style={{position: 'absolute', left: STAGE.left, right: STAGE.right, top, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', textAlign: t.align}}>
      {headline.lines.map((line, i) => (
        <Fit key={i} size={fitDisplay(t, line.text, SIZES[line.size ?? 'l'])} max={STAGE.width}
          style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: t.displayLineHeight, letterSpacing: 1, textShadow: t.shadow}}>
          <Reveal text={line.text} delay={lineDelay(i)} color={line.accent ? t.accent : t.text} />
        </Fit>
      ))}
      {headline.banner && <Banner text={headline.banner} frame={frame - bannerDelay} />}
    </FitBlock>
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
  const springIn = (config: object) => spring({frame, fps, config});
  const pill = t.banner === 'pill';
  return (
    <div style={{marginTop: 18, maxWidth: '100%', fontFamily: pill ? t.fonts.body : t.fonts.display, fontWeight: pill ? 600 : t.displayWeight, lineHeight: 1.05, color: t.onAccent, ...bannerStyle(t, frame, springIn)}}>
      <Fit size={pill ? 40 : fitDisplay(t, text, 84, 840)} max={840} style={pill ? {letterSpacing: 6, textTransform: 'uppercase'} : undefined}>{text}</Fit>
    </div>
  );
};

function bannerStyle(t: Theme, frame: number, springIn: (config: object) => number): React.CSSProperties {
  switch (t.banner) {
    case 'tape': {
      const s = springIn({damping: 12, stiffness: 170});
      return {
        padding: '10px 40px 6px', background: t.accent, clipPath: TAPE_EDGE, opacity: Math.min(1, s * 2),
        transform: `rotate(${interpolate(s, [0, 1], [-9, -2.5]) + Math.sin(frame / 18) * 0.5}deg) scale(${interpolate(s, [0, 1], [0.6, 1])})`, transformOrigin: 'left center',
      };
    }
    case 'ribbon': {
      // Unrolls from the left instead of flying in, then lifts a little in a breeze.
      const s = springIn({damping: 200, stiffness: 120});
      const notch = 'polygon(0 0, 100% 0, calc(100% - 26px) 50%, 100% 100%, 0 100%, 26px 50%)';
      return {
        padding: '10px 58px 8px', background: t.accent, clipPath: notch,
        transform: `scaleX(${s}) rotate(${Math.sin(frame / 22) * 0.5}deg)`, transformOrigin: 'left center', opacity: s > 0.02 ? 1 : 0,
        boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.18), inset 0 4px 0 rgba(255,255,255,0.12)',
      };
    }
    case 'glow': {
      const on = frame < 0 ? 0 : FLICKER[Math.floor(frame / 2)] ?? 0.86 + Math.sin(frame / 5) * 0.14;
      return {
        padding: '10px 26px 6px', color: t.accent, border: `4px solid ${t.accent}`, borderRadius: 10, opacity: on,
        boxShadow: `0 0 26px ${t.accent}, inset 0 0 18px ${t.accent}88`, textShadow: `0 0 18px ${t.accent}`,
        background: 'rgba(7,6,26,0.55)',
      };
    }
    case 'pixel': {
      // Blocky label with stepped corners that types itself in, 3 frames per step.
      const steps = Math.max(0, Math.min(1, Math.floor(frame / 3) / 4));
      return {
        padding: '12px 30px 8px', background: t.accent, clipPath: PIXEL_NOTCH, opacity: steps > 0 ? 1 : 0,
        transform: `scaleX(${steps}) translateY(${frame > 12 ? Math.round(Math.sin(frame / 9)) * 3 : 0}px)`, filter: 'drop-shadow(6px 6px 0 rgba(0,0,0,0.5))',
      };
    }
    case 'pill': {
      const s = springIn({damping: 200, stiffness: 90});
      return {
        marginTop: 26, padding: '14px 34px 12px', borderRadius: 999, color: t.accent,
        background: 'rgba(20,16,12,0.72)', border: `2px solid ${t.accent}66`, opacity: s, transform: `translateY(${(1 - s) * 24}px)`,
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
      // Slashes in, then a band of light crosses it.
      const s = springIn({damping: 14, stiffness: 160});
      const sheen = ramp(frame, 12, 30) * 160 - 30;
      return {
        padding: '6px 22px 2px', backgroundColor: t.accent, backgroundImage: `linear-gradient(100deg, transparent ${sheen - 12}%, rgba(255,255,255,0.45) ${sheen}%, transparent ${sheen + 12}%)`,
        transform: `translateX(${interpolate(s, [0, 1], [-900, 0])}px) skewX(-6deg) rotate(-1.5deg)`,
        boxShadow: t.shadow === 'none' ? '0 6px 0 rgba(0,0,0,0.15)' : '0 10px 40px rgba(0,0,0,0.5)',
      };
    }
  }
}
