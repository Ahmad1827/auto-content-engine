import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CastView} from '../cast/CastView';
import {cardStyle, Dress} from '../components/Card';
import {Fit, FitText} from '../components/Fit';
import {LineArt} from '../components/LineArt';
import {Reveal} from '../components/Reveal';
import {clamp01, easeInOut, easeOut, ramp, rnd} from '../fx';
import {fitDisplay, STAGE, useTheme} from '../theme';
import type {Panel, Visual} from '../types';

const Tag: React.FC<{text: string; accent?: boolean; delay: number; style?: React.CSSProperties}> = ({text, accent, delay, style}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 11, stiffness: 240}});
  const color = accent ? t.accent : t.muted;
  return (
    <div
      style={{
        position: 'absolute', maxWidth: 820, padding: '6px 14px', border: `2px solid ${color}`, borderRadius: t.render === 'pixel' ? 0 : 4,
        fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 4, lineHeight: 1.3, color, textTransform: 'uppercase',
        background: t.bg, opacity: clamp01(s * 2), transform: `scale(${1.5 - 0.5 * s}) rotate(${(1 - s) * -4}deg)`, ...style,
      }}
    >
      <Fit size={24} max={780}>{text}</Fit>
    </div>
  );
};

// A panel holding drawn art or people. It wipes open, and a band of light crosses it once it's open.
const Frame: React.FC<{panel: Panel; top: number; height: number; delay: number; accentTag?: boolean}> = ({panel, top, height, delay, accentTag}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const open = easeInOut(ramp(frame, delay, delay + 14));
  const sheen = ramp(frame, delay + 26, delay + 50);
  const float = Math.sin((frame - delay) / 26) * 6;
  const insideClip = t.decor === 'pixel' ? undefined : t.decor === 'clean' ? 24 : 12;
  return (
    <div style={{position: 'absolute', left: STAGE.left, right: STAGE.right, top, height}}>
      <div style={{position: 'absolute', inset: 0, ...cardStyle(t), clipPath: open < 1 ? `inset(0 ${(1 - open) * 100}% 0 0)` : cardStyle(t).clipPath}}>
        <div style={{position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: insideClip}}>
          {panel.cast ? (
            <CastView cast={panel.cast} W={932} H={height - 4} mode="panel" delay={delay} />
          ) : (
            <div style={{position: 'absolute', inset: '40px 40px 50px', transform: `translateY(${float}px)`}}>
              <LineArt svg={panel.svg ?? ''} delay={delay + 4} drawSeconds={1.8} />
            </div>
          )}
          {sheen > 0 && sheen < 1 && (
            <div style={{position: 'absolute', top: -200, bottom: -200, left: `${-30 + sheen * 150}%`, width: 120, transform: 'rotate(14deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)'}} />
          )}
        </div>
      </div>
      {panel.tag && <Tag text={panel.tag} accent={accentTag} delay={delay + 12} style={{top: -22, insetInlineEnd: 28}} />}
      {panel.label && <Tag text={panel.label} accent={accentTag} delay={delay + 16} style={{bottom: -22, insetInlineStart: 28}} />}
    </div>
  );
};

// `compact` leaves the lower third free for a headline.
export const IllustrationScene: React.FC<{visual: Extract<Visual, {type: 'illustration'}>; compact?: boolean}> = ({visual, compact}) => (
  <Frame panel={{svg: visual.svg, label: visual.label}} top={STAGE.top + 10} height={compact ? 790 : STAGE.bottom - STAGE.top - 40} delay={0} accentTag />
);

// Two stacked panels, like "with X / without X", with chevrons pointing from one to the other.
export const CompareScene: React.FC<{visual: Extract<Visual, {type: 'compare'}>}> = ({visual}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const height = 510;
  const top = STAGE.top + 10;
  // The gap between panels clears both panels' tags and leaves room for the chevrons.
  const mid = top + height + 40;
  return (
    <>
      <Frame panel={visual.top} top={top} height={height} delay={0} accentTag />
      <Frame panel={visual.bottom} top={mid + 40} height={height} delay={14} />
      <svg width={1080} height={40} style={{position: 'absolute', left: 0, top: mid - 20}}>
        {[0, 1, 2].map((i) => (
          <path key={i} d="M-26,-7 L0,8 L26,-7" fill="none" stroke={t.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
            opacity={(0.25 + 0.75 * Math.abs(Math.sin(frame / 12 - i * 0.6))) * ramp(frame, 10, 18)} transform={`translate(${540 + (i - 1) * 70} 20)`} />
        ))}
      </svg>
    </>
  );
};

// A dial that sweeps round as the number climbs, then bursts when it lands.
const Dial: React.FC<{progress: number; landed: number; frame: number}> = ({progress, landed, frame}) => {
  const t = useTheme();
  const R = 400;
  const seg = t.render === 'pixel';
  const seed = Math.floor(frame / 4) % 6;
  const wobble = t.boil ? (rnd(1, seed) - 0.5) * 2 : 0;
  return (
    <svg width={1000} height={1000} viewBox="-500 -500 1000 1000" style={{position: 'absolute', left: 40, top: STAGE.top + 60, overflow: 'visible'}} shapeRendering={seg ? 'crispEdges' : undefined}>
      {t.decor === 'press' && (
        <g transform={`rotate(${frame * 0.5})`} fill={t.text} opacity={0.06}>
          {Array.from({length: 16}, (_, i) => <path key={i} d="M0,0 L-70,-720 L70,-720 Z" transform={`rotate(${i * 22.5})`} />)}
        </g>
      )}
      <g transform={`rotate(${wobble})`}>
        <circle r={R} fill={t.panel} stroke={t.border} strokeWidth={3} />
        <g transform={`rotate(${frame * 0.25})`}>
          {Array.from({length: 72}, (_, i) => (
            <line key={i} y1={-R - 18} y2={-R - (i % 6 ? 30 : 46)} stroke={t.muted} strokeWidth={i % 6 ? 2 : 4} transform={`rotate(${i * 5})`} opacity={0.65} />
          ))}
        </g>
        <circle r={R - 34} fill="none" stroke={t.muted} strokeWidth={2} strokeDasharray="5 15" opacity={0.6} transform={`rotate(${frame * -0.45})`} />
        <circle r={R} fill="none" stroke={t.accent} strokeWidth={14} strokeLinecap={seg ? 'butt' : 'round'} pathLength={1} strokeDasharray={seg ? '0.02 0.005' : `${progress} 1`} transform="rotate(-90)"
          style={{filter: t.glow > 0.5 ? `drop-shadow(0 0 ${14 * t.glow}px ${t.accent})` : undefined, ...(seg ? {clipPath: progress < 1 ? undefined : undefined} : {})}} opacity={seg && progress === 0 ? 0 : 1} />
        <g transform={`rotate(${progress * 360})`}>
          <circle cy={-R} r={15} fill={t.bg} stroke={t.accent} strokeWidth={6} />
        </g>
      </g>
      {landed > 0 && landed < 1 && Array.from({length: 28}, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + rnd(i, 1);
        const d = R + easeOut(landed) * (60 + rnd(i, 2) * 240);
        const size = 6 + rnd(i, 3) * 10;
        return <rect key={i} x={Math.cos(a) * d - size / 2} y={Math.sin(a) * d - size / 2} width={size} height={size} rx={seg ? 0 : size / 2} fill={i % 3 ? t.accent : t.text} opacity={1 - landed} />;
      })}
      {landed > 0 && landed < 1 && <circle r={R + easeOut(landed) * 150} fill="none" stroke={t.accent} strokeWidth={6 * (1 - landed)} opacity={1 - landed} />}
    </svg>
  );
};

// `compact` shrinks the dial to leave the lower half free for a headline.
export const CounterScene: React.FC<{visual: Extract<Visual, {type: 'counter'}>; compact?: boolean}> = ({visual, compact}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [0, 1.3 * fps], [0, 1], {extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3)});
  const pop = spring({frame: frame - 1.3 * fps, fps, config: {damping: 9, stiffness: 200}});
  const landed = ramp(frame, 1.3 * fps, 1.3 * fps + 24);
  const locale = t.language === 'ar' ? 'ar-EG' : t.language;
  const value = Math.round(visual.value * p).toLocaleString(locale);
  const final = `${visual.prefix ?? ''}${visual.value.toLocaleString(locale)}${visual.suffix ?? ''}`;

  return (
    <div style={{position: 'absolute', inset: 0, transform: compact ? 'scale(0.66)' : undefined, transformOrigin: '540px 180px'}}>
      <Dial progress={p} landed={landed} frame={frame} />
      <div style={{position: 'absolute', left: 170, right: 170, top: STAGE.top + 60, height: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', transform: `scale(${1 + 0.06 * pop * (1 - pop) * 4})`}}>
        <Fit size={fitDisplay(t, final, 300, 700)} max={700} sizer={final} style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: 1.12, color: t.accent, textShadow: t.glow > 0.5 ? `0 0 ${60 * t.glow}px ${t.accent}55` : 'none'}}>
          {visual.prefix}{value}{visual.suffix}
        </Fit>
        {visual.label && (
          <FitText size={38} maxHeight={150} style={{marginTop: 24, fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 6, lineHeight: 1.25, color: t.text, textTransform: 'uppercase'}}>
            <Reveal text={visual.label} delay={14} stagger={0.7} />
          </FitText>
        )}
      </div>
    </div>
  );
};

// `raised` moves the card up to make room for a headline underneath.
export const TitleScene: React.FC<{visual: Extract<Visual, {type: 'title'}>; raised?: boolean}> = ({visual, raised}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const rule = easeOut(ramp(frame, 14, 34));
  const height = raised ? 730 : STAGE.bottom - STAGE.top;
  const rings = t.render !== 'pixel' && t.decor !== 'press';

  return (
    <div style={{position: 'absolute', left: STAGE.left, right: STAGE.right, top: STAGE.top, height, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {rings && !raised && (
        <svg width={1080} height={1140} viewBox="-540 -570 1080 1140" style={{position: 'absolute', left: -STAGE.left, top: 0}}>
          {[0, 1, 2, 3].map((i) => {
            const q = ((frame + i * 30) % 120) / 120;
            return <circle key={i} r={260 + q * 460} fill="none" stroke={t.accent} strokeWidth={2.5} opacity={(1 - q) * 0.22} />;
          })}
        </svg>
      )}
      <Dress delay={2} style={{width: '100%', boxSizing: 'border-box', textAlign: t.align}}>
        <FitText size={170 * t.displayScale} maxHeight={height - 300} style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: t.displayWrapHeight, color: t.text, textShadow: t.shadow}}>
          <Reveal text={visual.text} delay={6} />
        </FitText>
        <div style={{height: 6, width: 260 * rule, background: t.accent, margin: t.align === 'center' ? '30px auto' : '30px 0'}} />
        {visual.sub && (
          <FitText size={34} maxHeight={100} style={{fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 5, lineHeight: 1.25, color: t.muted, textTransform: 'uppercase', opacity: rule}}>
            {visual.sub}
          </FitText>
        )}
      </Dress>
    </div>
  );
};
