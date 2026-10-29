import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CastView} from '../cast/CastView';
import {LineArt} from '../components/LineArt';
import {fitDisplay, useTheme} from '../theme';
import type {Panel, Visual} from '../types';

const Tag: React.FC<{text: string; accent?: boolean; style?: React.CSSProperties}> = ({text, accent, style}) => {
  const t = useTheme();
  const color = accent ? t.accent : t.muted;
  return (
    <div
      style={{
        position: 'absolute', padding: '6px 14px', border: `2px solid ${color}`, borderRadius: 4,
        fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color, textTransform: 'uppercase',
        background: t.bg, ...style,
      }}
    >
      {text}
    </div>
  );
};

const Frame: React.FC<{panel: Panel; top: number; height: number; delay: number; accentTag?: boolean}> = ({panel, top, height, delay, accentTag}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 200}, durationInFrames: 16});
  return (
    <div
      style={{
        position: 'absolute', left: 72, right: 72, top, height,
        border: `2px solid ${t.border}`, borderRadius: 18, background: t.panel,
        opacity: enter, transform: `translateY(${(1 - enter) * 30}px)`,
      }}
    >
      {panel.cast ? (
        <div style={{position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden'}}>
          <CastView cast={panel.cast} W={932} H={height - 4} mode="panel" delay={delay} />
        </div>
      ) : (
        <div style={{position: 'absolute', inset: '40px 40px 50px'}}>
          <LineArt svg={panel.svg ?? ''} delay={delay + 4} drawSeconds={1.8} />
        </div>
      )}
      {panel.tag && <Tag text={panel.tag} accent={accentTag} style={{top: -22, right: 28}} />}
      {panel.label && <Tag text={panel.label} accent={accentTag} style={{bottom: -22, left: 28}} />}
    </div>
  );
};

// `compact` leaves the lower third free for a headline.
export const IllustrationScene: React.FC<{visual: Extract<Visual, {type: 'illustration'}>; compact?: boolean}> = ({visual, compact}) => (
  <Frame panel={{svg: visual.svg, label: visual.label}} top={260} height={compact ? 760 : 1000} delay={0} accentTag />
);

// Two stacked panels, like "with X / without X".
export const CompareScene: React.FC<{visual: Extract<Visual, {type: 'compare'}>}> = ({visual}) => (
  <>
    <Frame panel={visual.top} top={250} height={540} delay={0} accentTag />
    <Frame panel={visual.bottom} top={850} height={540} delay={14} />
  </>
);

export const CounterScene: React.FC<{visual: Extract<Visual, {type: 'counter'}>}> = ({visual}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [0, 1.3 * fps], [0, 1], {extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3)});
  const pop = spring({frame: frame - 1.3 * fps, fps, config: {damping: 9, stiffness: 200}});
  const value = Math.round(visual.value * p).toLocaleString('en-US');

  return (
    <div style={{position: 'absolute', left: 72, right: 72, top: 420, textAlign: 'center'}}>
      <div
        style={{
          fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: 0.9, color: t.accent,
          fontSize: fitDisplay(t, `${visual.prefix ?? ''}${visual.value.toLocaleString('en-US')}${visual.suffix ?? ''}`, 330),
          transform: `scale(${1 + 0.06 * pop * (1 - pop) * 4})`, textShadow: t.glow > 0.5 ? `0 0 ${60 * t.glow}px ${t.accent}55` : 'none',
        }}
      >
        {visual.prefix}{value}{visual.suffix}
      </div>
      {visual.label && (
        <div style={{marginTop: 30, fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 38, letterSpacing: 6, color: t.text, textTransform: 'uppercase', opacity: p}}>
          {visual.label}
        </div>
      )}
    </div>
  );
};

// `raised` moves the card up to make room for a headline underneath.
export const TitleScene: React.FC<{visual: Extract<Visual, {type: 'title'}>; raised?: boolean}> = ({visual, raised}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 14}});
  const rule = interpolate(frame, [8, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', left: 72, right: 72, top: raised ? 280 : 520}}>
      <div style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: 170 * t.displayScale, lineHeight: 0.98, color: t.text, textShadow: t.shadow, opacity: s, transform: `translateY(${(1 - s) * 40}px)`}}>
        {visual.text.split('*').map((part, i) => <span key={i} style={{color: i % 2 ? t.accent : t.text}}>{part}</span>)}
      </div>
      <div style={{height: 6, width: 260 * rule, background: t.accent, margin: '36px 0'}} />
      {visual.sub && (
        <div style={{fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: t.muted, textTransform: 'uppercase', opacity: rule}}>
          {visual.sub}
        </div>
      )}
    </div>
  );
};
