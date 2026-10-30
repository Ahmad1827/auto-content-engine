import {interpolate, useCurrentFrame} from 'remotion';
import {ramp} from '../fx';
import {STAGE, useTheme} from '../theme';
import {Fit} from './Fit';

// Small mono tag at the top: "● TURKEY · MAY 1920"; it types itself out behind a caret.
export const Kicker: React.FC<{text: string}> = ({text}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const shown = Math.floor(interpolate(frame, [0, 18], [0, text.length], {extrapolateRight: 'clamp'}));
  const blink = 0.55 + 0.45 * Math.sin(frame / 5);
  const rule = ramp(frame, 8, 30);
  const center = t.align === 'center';

  return (
    <div style={{position: 'absolute', top: 150, left: STAGE.left, right: STAGE.right, display: 'flex', alignItems: 'center', gap: 16, justifyContent: center ? 'center' : undefined, opacity: ramp(frame, 0, 8)}}>
      <span style={{width: 16, height: 16, flexShrink: 0, borderRadius: t.render === 'pixel' ? 0 : 8, background: t.accent, opacity: blink, boxShadow: `0 0 14px ${t.accent}`}} />
      <Fit size={30} max={STAGE.width - 120} sizer={text} style={{fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 4, lineHeight: 1.3, color: t.text, textTransform: 'uppercase', textShadow: t.shadow === 'none' ? 'none' : '0 2px 10px rgba(0,0,0,0.8)'}}>
        {text.slice(0, shown)}
        <span style={{opacity: shown < text.length || frame % 16 < 8 ? 1 : 0, color: t.accent}}>{t.render === 'pixel' ? '█' : '_'}</span>
      </Fit>
      {!center && <span style={{flex: 1, height: 2, background: `linear-gradient(90deg, ${t.accent}, transparent)`, transform: `scaleX(${rule})`, transformOrigin: t.rtl ? 'right' : 'left', opacity: 0.7}} />}
    </div>
  );
};
