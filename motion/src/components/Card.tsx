import {useCurrentFrame} from 'remotion';
import {easeInOut, easeOut, ramp, rnd} from '../fx';
import {type Theme, useTheme} from '../theme';
import {useSize} from './Fit';

// Stepped corners for pixel panels.
export const PIXEL_NOTCH = 'polygon(0 10px, 10px 10px, 10px 0, calc(100% - 10px) 0, calc(100% - 10px) 10px, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 10px calc(100% - 10px), 0 calc(100% - 10px))';

// The background and edge of a panel in the current style; `on` marks the highlighted one.
export function cardStyle(t: Theme, on = false): React.CSSProperties {
  const edge = on ? t.accent : t.border;
  switch (t.decor) {
    case 'sketch':
      return {background: t.panel, border: `3px solid ${on ? t.accent : t.muted}`, borderRadius: '26px 12px 30px 10px / 12px 28px 10px 26px'};
    case 'ornate':
      return {background: 'rgba(243,232,208,0.55)', border: `2px solid ${on ? t.accent : t.line}`, outline: `1px solid ${on ? t.accent : t.line}`, outlineOffset: -8, borderRadius: 2};
    case 'synth':
      return {background: 'rgba(15,13,43,0.72)', border: `2px solid ${on ? t.accent : t.outline}`, borderRadius: 12, boxShadow: `0 0 ${on ? 34 : 16}px ${on ? t.accent : t.outline}66, inset 0 0 22px ${on ? t.accent : t.outline}22`};
    case 'press':
      return {background: 'rgba(244,239,228,0.9)', border: `${on ? 5 : 3}px solid ${on ? t.accent : t.text}`, borderRadius: 0, boxShadow: on ? `7px 7px 0 ${t.accent}` : '7px 7px 0 rgba(0,0,0,0.75)'};
    case 'pixel':
      return {background: on ? '#2a2060' : '#1a1440', clipPath: PIXEL_NOTCH};
    case 'clean':
      return {background: 'rgba(255,240,215,0.07)', border: `1.5px solid ${on ? t.accent : 'rgba(255,240,215,0.2)'}`, borderRadius: 26, boxShadow: '0 20px 50px rgba(0,0,0,0.35)'};
    default:
      return {background: 'rgba(16,17,17,0.82)', border: `1.5px solid ${edge}`, borderRadius: 4, boxShadow: on ? `0 0 34px ${t.accent}40` : 'none'};
  }
}

// An animated frame drawn around its children: brackets, a scribble, a neon tube and so on, one for each style.
export const Dress: React.FC<{delay?: number; pad?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({delay = 0, pad = 44, style, children}) => {
  const t = useTheme();
  const frame = useCurrentFrame() - delay;
  const [ref, {w, h}] = useSize<HTMLDivElement>();
  const box = {w: w + 40, h: h + 40};
  return (
    <div ref={ref} style={{position: 'relative', padding: pad, ...style}}>
      {t.decor === 'pixel' && <PixelBox frame={frame} />}
      {w > 0 && (
        <svg width={box.w} height={box.h} viewBox={`-20 -20 ${box.w} ${box.h}`} style={{position: 'absolute', left: -20, top: -20, overflow: 'visible', pointerEvents: 'none'}}>
          <DressLines t={t} frame={frame} w={w} h={h} />
        </svg>
      )}
      <div style={{position: 'relative'}}>{children}</div>
    </div>
  );
};

const PixelBox: React.FC<{frame: number}> = ({frame}) => {
  const t = useTheme();
  const on = frame >= 0 && (Math.floor(frame / 3) >= 2 || frame % 2 === 0);
  return <div style={{position: 'absolute', inset: 0, background: 'rgba(26,20,64,0.9)', clipPath: PIXEL_NOTCH, opacity: on ? 1 : 0, boxShadow: `inset 0 0 0 6px ${t.accent}`}} />;
};

const DressLines: React.FC<{t: Theme; frame: number; w: number; h: number}> = ({t, frame, w, h}) => {
  const p = easeInOut(ramp(frame, 0, 22));
  const draw = {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p};
  switch (t.decor) {
    case 'hud': {
      // Brackets close in on the subject, and a tick runs along the edge.
      const off = (1 - easeOut(ramp(frame, 0, 16))) * 70;
      const corner = (x: number, y: number, dx: number, dy: number) => {
        const [X, Y] = [x - dx * off, y - dy * off];
        return `M${X + dx * 60},${Y} L${X},${Y} L${X},${Y + dy * 60}`;
      };
      const run = ((frame * 6) % (w + 200)) - 100;
      return (
        <g fill="none" stroke={t.accent} strokeWidth={5} opacity={ramp(frame, 0, 6)}>
          <path d={corner(0, 0, 1, 1)} /><path d={corner(w, 0, -1, 1)} /><path d={corner(0, h, 1, -1)} /><path d={corner(w, h, -1, -1)} />
          <line x1={Math.max(70, run)} x2={Math.min(w - 70, run + 90)} y1={0} y2={0} strokeWidth={2} opacity={run + 90 < 70 || run > w - 70 ? 0 : 0.8} />
        </g>
      );
    }
    case 'sketch': {
      // Two loose scribbled rectangles, redrawn every few frames so they boil.
      const seed = Math.floor(frame / 4) % 6;
      const rough = (k: number) => {
        const j = (i: number) => (rnd(i, seed + k * 9) - 0.5) * 12;
        return `M${-6 + j(0)},${j(1)} C${w * 0.3},${-10 + j(2)} ${w * 0.7},${8 + j(3)} ${w + 8 + j(4)},${j(5)} C${w + 12 + j(6)},${h * 0.35} ${w - 8 + j(7)},${h * 0.7} ${w + j(8)},${h + 6 + j(9)} C${w * 0.7},${h + 12 + j(10)} ${w * 0.3},${h - 8 + j(11)} ${-8 + j(12)},${h + j(13)} C${-14 + j(14)},${h * 0.7} ${8 + j(15)},${h * 0.3} ${-6 + j(0)},${-10 + j(1)}`;
      };
      return (
        <g fill="none" strokeLinecap="round">
          <path d={rough(0)} stroke={t.accent} strokeWidth={6} {...draw} />
          <path d={rough(1)} stroke={t.line} strokeWidth={2.5} opacity={0.6} {...draw} />
        </g>
      );
    }
    case 'ornate': {
      // A double rule that inks itself in, with a diamond at each corner and midpoint.
      const points: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h], [w / 2, 0], [w / 2, h]];
      const pop = easeOut(ramp(frame, 14, 26));
      return (
        <g fill="none" stroke={t.line}>
          <rect x={0} y={0} width={w} height={h} strokeWidth={3.5} {...draw} />
          <rect x={10} y={10} width={w - 20} height={h - 20} strokeWidth={1.2} {...draw} />
          {points.map(([x, y], i) => (
            <path key={i} d="M0,-13 L13,0 L0,13 L-13,0 Z" fill={i > 3 ? t.accent : t.bg} strokeWidth={2} transform={`translate(${x} ${y}) rotate(${Math.sin(frame / 25 + i) * 8}) scale(${pop})`} />
          ))}
        </g>
      );
    }
    case 'synth': {
      // A neon tube that lights around the edge, with a spark circling it for good.
      const pulse = 0.75 + Math.sin(frame / 7) * 0.25;
      return (
        <g fill="none">
          <rect x={0} y={0} width={w} height={h} rx={18} stroke={t.outline} strokeWidth={3} opacity={pulse} {...draw} style={{filter: `drop-shadow(0 0 12px ${t.outline})`}} />
          <rect x={0} y={0} width={w} height={h} rx={18} stroke={t.accent} strokeWidth={6} pathLength={1} strokeDasharray="0.1 0.9" strokeDashoffset={-frame / 90} opacity={p} style={{filter: `drop-shadow(0 0 16px ${t.accent})`}} />
        </g>
      );
    }
    case 'press': {
      // Heavy and hairline rules grow out from the centre, with a star in the gap.
      const half = (w / 2) * p;
      return (
        <g stroke={t.text}>
          <line x1={w / 2 - half} x2={w / 2 + half} y1={0} y2={0} strokeWidth={8} />
          <line x1={w / 2 - half} x2={w / 2 + half} y1={12} y2={12} strokeWidth={2} />
          <line x1={w / 2 - half} x2={w / 2 + half} y1={h} y2={h} strokeWidth={8} />
          <line x1={w / 2 - half} x2={w / 2 + half} y1={h - 12} y2={h - 12} strokeWidth={2} />
        </g>
      );
    }
    case 'pixel': {
      // The blinking "more text" arrow of a game's dialogue box.
      const on = frame > 20 && Math.floor(frame / 10) % 2 === 0;
      return on ? <path d={`M${w - 64},${h - 44} h28 v8 h-6 v8 h-6 v8 h-4 v-8 h-6 v-8 h-6 z`} fill={t.accent} shapeRendering="crispEdges" /> : null;
    }
    default: {
      // Two fine gold rules with a diamond, and a glint that travels along them.
      const half = (w / 2) * p;
      const glint = (((frame * 7) % (w * 2)) / w) * 1;
      return (
        <g stroke={t.accent} strokeWidth={2} fill={t.accent}>
          <line x1={w / 2 - half} x2={w / 2 + half} y1={0} y2={0} opacity={0.75} />
          <line x1={w / 2 - half} x2={w / 2 + half} y1={h} y2={h} opacity={0.75} />
          <path d="M0,-9 L9,0 L0,9 L-9,0 Z" stroke="none" transform={`translate(${w / 2} 0) scale(${p})`} />
          <path d="M0,-9 L9,0 L0,9 L-9,0 Z" stroke="none" transform={`translate(${w / 2} ${h}) scale(${p})`} />
          {glint < 1 && p === 1 && <circle cx={glint * w} cy={0} r={5} stroke="none" fill="#fff6dd" style={{filter: 'drop-shadow(0 0 8px #fff0c0)'}} />}
        </g>
      );
    }
  }
};
