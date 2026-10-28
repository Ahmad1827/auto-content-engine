import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitDisplay, useTheme} from '../theme';
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
  const bannerIn = spring({frame: frame - bannerDelay, fps, config: {damping: 14, stiffness: 160}});

  return (
    <div style={{position: 'absolute', left: 72, right: 72, top, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
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
              transformOrigin: 'left center',
              textShadow: t.shadow,
            }}
          >
            {renderMarked(line.text, t.accent, base)}
          </div>
        );
      })}
      {headline.banner && (
        <div
          style={{
            marginTop: 18, padding: '6px 22px 2px',
            background: t.accent, color: t.onAccent,
            fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: fitDisplay(t, headline.banner, 84, 880), lineHeight: 1.05,
            transform: `translateX(${interpolate(bannerIn, [0, 1], [-900, 0])}px) skewX(-6deg) rotate(-1.5deg)`,
            boxShadow: t.shadow === 'none' ? '0 6px 0 rgba(0,0,0,0.15)' : '0 10px 40px rgba(0,0,0,0.5)',
          }}
        >
          {headline.banner}
        </div>
      )}
    </div>
  );
};
