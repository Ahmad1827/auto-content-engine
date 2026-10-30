import {interpolate, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme';

// Small mono tag at the top: "● TURKEY · MAY 1920"
export const Kicker: React.FC<{text: string}> = ({text}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  const shown = Math.floor(interpolate(frame, [0, 18], [0, text.length], {extrapolateRight: 'clamp'}));
  const blink = 0.55 + 0.45 * Math.sin(frame / 5);

  return (
    <div
      style={{
        position: 'absolute', top: 150, insetInlineStart: 72, insetInlineEnd: t.align === 'center' ? 72 : undefined, opacity,
        justifyContent: t.align === 'center' ? 'center' : undefined,
        display: 'flex', alignItems: 'center', gap: 16,
        fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4,
        color: t.text, textTransform: 'uppercase',
      }}
    >
      <span style={{width: 16, height: 16, borderRadius: 8, background: t.accent, opacity: blink, boxShadow: `0 0 14px ${t.accent}`}} />
      {text.slice(0, shown)}
    </div>
  );
};
