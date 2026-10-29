import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../theme';
import {COMPASS} from './Backdrop';

// Frame dressing that gives each style its identity; drawn over the scenes, under the captions.
export const Decor: React.FC = () => {
  const t = useTheme();
  if (t.decor === 'hud') return <Hud />;
  if (t.decor === 'ornate') return <Ornate />;
  if (t.decor === 'synth') return <Synth />;
  if (t.decor === 'press') return <Masthead />;
  return null;
};

const pad = (n: number) => String(n).padStart(2, '0');

// Atlas: camera-style corner brackets, a running reel counter and a survey ruler down the left edge.
const Hud: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = Math.floor(frame / fps);
  const corner = (x: number, y: number, dx: number, dy: number) => `M${x + dx * 56},${y} L${x},${y} L${x},${y + dy * 56}`;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <g fill="none" stroke={t.muted} strokeWidth={3} opacity={0.55}>
          <path d={corner(40, 40, 1, 1)} />
          <path d={corner(1040, 40, -1, 1)} />
          <path d={corner(40, 1880, 1, -1)} />
          <path d={corner(1040, 1880, -1, -1)} />
        </g>
        <g stroke={t.muted} opacity={0.35}>
          {Array.from({length: 36}, (_, i) => (
            <line key={i} x1={40} x2={i % 5 ? 50 : 62} y1={300 + i * 20} y2={300 + i * 20} strokeWidth={i % 5 ? 1.5 : 2.5} />
          ))}
        </g>
      </svg>
      <div style={{position: 'absolute', top: 68, right: 74, display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: t.fonts.mono, fontWeight: 500, fontSize: 22, letterSpacing: 3, color: t.muted}}>
        <span style={{width: 12, height: 12, borderRadius: 6, background: t.accent, opacity: frame % 30 < 18 ? 1 : 0.15}} />
        REEL {pad(Math.floor(s / 60))}:{pad(s % 60)}:{pad(frame % fps)}
      </div>
    </AbsoluteFill>
  );
};

// Parchment: double ruled border with corner diamonds, and a compass rose at the foot of the chart.
const Ornate: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 50) * 3;
  const diamond = (x: number, y: number) => `M${x},${y - 14} L${x + 14},${y} L${x},${y + 14} L${x - 14},${y} Z`;
  const r = 78;
  const points = Array.from({length: 8}, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const len = i % 2 ? r * 0.55 : r;
    const side = a + Math.PI / 2;
    const w = i % 2 ? 7 : 11;
    return `M${Math.cos(a) * len},${Math.sin(a) * len} L${Math.cos(side) * w},${Math.sin(side) * w} L${-Math.cos(side) * w},${-Math.sin(side) * w} Z`;
  });
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <g fill="none" stroke={t.line} opacity={0.5}>
        <rect x={26} y={26} width={1028} height={1868} strokeWidth={3} />
        <rect x={38} y={38} width={1004} height={1844} strokeWidth={1.2} />
      </g>
      <g fill={t.bg} stroke={t.line} strokeWidth={2} opacity={0.75}>
        {[[32, 32], [1048, 32], [32, 1888], [1048, 1888]].map(([x, y], i) => <path key={i} d={diamond(x, y)} />)}
      </g>
      <g transform={`translate(${COMPASS.x} ${COMPASS.y}) rotate(${drift})`} opacity={0.6}>
        <circle r={r * 0.72} fill="none" stroke={t.line} strokeWidth={1.5} />
        <circle r={r * 0.62} fill="none" stroke={t.line} strokeWidth={1} strokeDasharray="3 5" />
        {points.map((d, i) => <path key={i} d={d} fill={i === 0 ? t.accent : i % 2 ? t.muted : t.line} />)}
        <text y={-r - 12} textAnchor="middle" fill={t.line} fontFamily={t.fonts.display} fontWeight={700} fontSize={30}>N</text>
      </g>
    </svg>
  );
};

// Neon: CRT scanlines and a slow bright band rolling down the screen.
const Synth: React.FC = () => {
  const frame = useCurrentFrame();
  const band = interpolate(frame % 150, [0, 150], [-200, 2100]);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0.22) 5px)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: band, height: 160, mixBlendMode: 'screen',
        background: 'linear-gradient(180deg, transparent, rgba(120,200,255,0.05), transparent)'}} />
    </AbsoluteFill>
  );
};

// Newspaper: a front-page masthead across the top and column rules down the sides.
const Masthead: React.FC = () => {
  const t = useTheme();
  const small = {fontFamily: t.fonts.mono, fontSize: 20, letterSpacing: 3, color: t.muted} as const;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 44, left: 56, right: 56}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={small}>LATE EDITION</span>
          <span style={{fontFamily: t.fonts.body, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: t.text}}>★ EXTRA ★</span>
          <span style={small}>ONE CENT</span>
        </div>
        <div style={{height: 5, background: t.text, marginTop: 10}} />
        <div style={{height: 1.5, background: t.text, marginTop: 4}} />
      </div>
      <div style={{position: 'absolute', top: 130, bottom: 40, left: 36, width: 1.5, background: t.text, opacity: 0.35}} />
      <div style={{position: 'absolute', top: 130, bottom: 40, right: 36, width: 1.5, background: t.text, opacity: 0.35}} />
    </AbsoluteFill>
  );
};
