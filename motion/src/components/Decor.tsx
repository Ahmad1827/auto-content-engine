import {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, ramp, rnd} from '../fx';
import {useTheme} from '../theme';
import {useSize} from './Fit';
import {COMPASS, HORIZON} from './Backdrop';

// Frame dressing that gives each style its identity; drawn over the scenes, under the captions.
// Text in it stays in the margins: above y=130 or below y=1690, where nothing else goes.
export const Decor: React.FC<{ticker: string[]}> = ({ticker}) => {
  const t = useTheme();
  if (t.decor === 'hud') return <Hud />;
  if (t.decor === 'sketch') return <SketchFrame />;
  if (t.decor === 'ornate') return <Ornate />;
  if (t.decor === 'synth') return <Synth />;
  if (t.decor === 'press') return <Masthead ticker={ticker} />;
  if (t.decor === 'pixel') return <PixelFrame />;
  return <Gilt />;
};

const pad = (n: number) => String(n).padStart(2, '0');

// Atlas: camera brackets, a reel counter, a survey ruler with a moving marker, and live coordinates in the bottom margin.
const Hud: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const s = Math.floor(frame / fps);
  const corner = (x: number, y: number, dx: number, dy: number) => `M${x + dx * 56},${y} L${x},${y} L${x},${y + dy * 56}`;
  const marker = 300 + (frame / Math.max(1, durationInFrames)) * 700;
  const lat = 41.0082 + Math.sin(frame / 90) * 0.42 + rnd(Math.floor(frame / 3), 1) * 0.0009;
  const lon = 28.9784 + Math.cos(frame / 70) * 0.61 + rnd(Math.floor(frame / 3), 2) * 0.0009;
  const small = {fontFamily: t.fonts.mono, fontWeight: 500, fontSize: 20, letterSpacing: 3, color: t.muted} as const;
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
        <path d={`M38,${marker} l-14,-9 v18 z`} fill={t.accent} />
      </svg>
      <div style={{position: 'absolute', top: 68, right: 74, display: 'flex', alignItems: 'center', gap: 12, direction: 'ltr', ...small, fontSize: 22}}>
        <span style={{width: 12, height: 12, borderRadius: 6, background: t.accent, opacity: frame % 30 < 18 ? 1 : 0.15}} />
        {t.language === 'en' && 'REEL '}{pad(Math.floor(s / 60))}:{pad(s % 60)}:{pad(frame % fps)}
      </div>
      <div style={{position: 'absolute', top: 1790, left: 74, direction: 'ltr', ...small}}>{lat.toFixed(4)}° {lon.toFixed(4)}°</div>
      <div style={{position: 'absolute', top: 1790, right: 74, direction: 'ltr', ...small}}>{pad(Math.floor(frame / 60) % 24)}/{pad(24)}</div>
    </AbsoluteFill>
  );
};

// Ink: a loose hand-drawn border that redraws itself every few frames.
const SketchFrame: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 4) % 6;
  const d = useMemo(() => {
    const j = (i: number) => (rnd(i, seed) - 0.5) * 14;
    const side = (x0: number, y0: number, x1: number, y1: number, k: number) =>
      Array.from({length: 7}, (_, i) => `L${x0 + ((x1 - x0) * (i + 1)) / 7 + j(k + i)},${y0 + ((y1 - y0) * (i + 1)) / 7 + j(k + i + 40)}`).join(' ');
    return `M34,34 ${side(34, 34, 1046, 34, 0)} ${side(1046, 34, 1046, 1886, 10)} ${side(1046, 1886, 34, 1886, 20)} ${side(34, 1886, 34, 34, 30)}`;
  }, [seed]);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <path d={d} fill="none" stroke={t.line} strokeWidth={3.5} strokeLinejoin="round" opacity={0.42} />
    </svg>
  );
};

// Parchment: double ruled border with corner diamonds, and a compass rose whose ring turns slowly at the foot of the chart.
const Ornate: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 50) * 6;
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
        {[[32, 32], [1048, 32], [32, 1888], [1048, 1888]].map(([x, y], i) => <path key={i} d={diamond(x, y)} transform={`rotate(${Math.sin(frame / 30 + i) * 10} ${x} ${y})`} />)}
      </g>
      <g transform={`translate(${COMPASS.x} ${COMPASS.y})`} opacity={0.65}>
        <g transform={`rotate(${frame * 0.3})`}>
          <circle r={r * 0.72} fill="none" stroke={t.line} strokeWidth={1.5} />
          <circle r={r * 0.62} fill="none" stroke={t.line} strokeWidth={1} strokeDasharray="3 5" />
          {Array.from({length: 24}, (_, i) => <line key={i} x1={0} x2={0} y1={-r * 0.72} y2={-r * (i % 6 ? 0.76 : 0.8)} stroke={t.line} strokeWidth={1.4} transform={`rotate(${i * 15})`} />)}
        </g>
        <g transform={`rotate(${drift})`}>
          {points.map((d, i) => <path key={i} d={d} fill={i === 0 ? t.accent : i % 2 ? t.muted : t.line} />)}
          <text y={-r - 12} textAnchor="middle" fill={t.line} fontFamily={t.fonts.display} fontWeight={700} fontSize={30}>N</text>
        </g>
      </g>
    </svg>
  );
};

// Neon: CRT scanlines, a slow bright band rolling down, and short bursts of signal tearing.
const Synth: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const band = interpolate(frame % 150, [0, 150], [-200, 2100]);
  const burst = Math.floor(frame / 8);
  const tearing = rnd(burst, 5) > 0.82;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0.22) 5px)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: band, height: 160, mixBlendMode: 'screen',
        background: 'linear-gradient(180deg, transparent, rgba(120,200,255,0.06), transparent)'}} />
      {tearing && Array.from({length: 3}, (_, i) => (
        <div key={i} style={{position: 'absolute', left: rnd(i, burst) * 500, width: 180 + rnd(i, burst + 3) * 500, top: rnd(i, burst + 6) * 1900, height: 3 + rnd(i, burst + 9) * 9,
          background: i % 2 ? t.accent : t.outline, opacity: 0.5, mixBlendMode: 'screen'}} />
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: HORIZON - 2, height: 4, background: t.accent, opacity: 0.5 + Math.sin(frame / 12) * 0.2}} />
    </AbsoluteFill>
  );
};

// Newspaper: masthead across the top, column rules that print themselves down the sides, and a news ticker in the bottom margin.
const Masthead: React.FC<{ticker: string[]}> = ({ticker}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const english = t.language === 'en';
  const [ref, {w}] = useSize<HTMLSpanElement>();
  const small = {fontFamily: t.fonts.mono, fontSize: 20, letterSpacing: 3, color: t.muted} as const;
  const rules = easeOut(ramp(frame, 0, 24));
  const line = `${ticker.join('  ★  ')}  ★  `;
  const offset = w ? (frame * 3) % w : 0;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 44, left: 56, right: 56}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={small}>{english && 'LATE EDITION'}</span>
          <span style={{fontFamily: t.fonts.body, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: t.text}}>{english ? '★ EXTRA ★' : '★ ★ ★'}</span>
          <span style={small}>{english && 'ONE CENT'}</span>
        </div>
        <div style={{height: 5, background: t.text, marginTop: 10, transform: `scaleX(${rules})`}} />
        <div style={{height: 1.5, background: t.text, marginTop: 4, transform: `scaleX(${rules})`}} />
      </div>
      <div style={{position: 'absolute', top: 130, bottom: 40, left: 36, width: 1.5, background: t.text, opacity: 0.35, transform: `scaleY(${rules})`, transformOrigin: 'top'}} />
      <div style={{position: 'absolute', top: 130, bottom: 40, right: 36, width: 1.5, background: t.text, opacity: 0.35, transform: `scaleY(${rules})`, transformOrigin: 'top'}} />
      {ticker.length > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1760, height: 62, background: t.text, overflow: 'hidden', display: 'flex', alignItems: 'center', direction: 'ltr'}}>
          <div style={{whiteSpace: 'pre', transform: `translateX(${-offset}px)`, fontFamily: t.fonts.mono, fontSize: 30, letterSpacing: 3, color: t.bg, textTransform: 'uppercase'}}>
            <span ref={ref}>{line}</span><span>{line}</span><span>{line}</span><span>{line}</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Pixel: a chunky stepped frame, rising dust, and a game's hearts and timer in the top margin.
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

const PixelFrame: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = Math.floor(frame / 15) % 2 === 0;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
        <g fill={t.border} opacity={0.9}>
          {[[30, 30], [1032, 30], [30, 1872], [1032, 1872]].map(([x, y], i) => (
            <g key={i}>
              <rect x={x} y={y} width={18} height={18} />
              <rect x={x + (x < 540 ? 18 : -18)} y={y} width={18} height={18} opacity={0.55} />
              <rect x={x} y={y + (y < 960 ? 18 : -18)} width={18} height={18} opacity={0.55} />
            </g>
          ))}
        </g>
        {[0, 1, 2].map((n) => (
          <g key={n} fill={n === 2 && !beat ? t.border : '#ff5d7a'} transform={`translate(${84 + n * 66} 62)`}>
            {HEART.flatMap((row, r) => [...row].map((c, k) => (c === 'X' ? <rect key={`${r}-${k}`} x={k * 7} y={r * 7} width={7} height={7} /> : null)))}
          </g>
        ))}
        {Array.from({length: 14}, (_, i) => {
          const y = 1900 - ((frame * (0.6 + rnd(i, 1)) + rnd(i, 2) * 1900) % 1900);
          return <rect key={i} x={Math.floor((rnd(i, 3) * 1080) / 6) * 6} y={Math.floor(y / 6) * 6} width={6} height={6} fill={t.accent} opacity={0.35} />;
        })}
      </svg>
      <div style={{position: 'absolute', top: 66, right: 84, direction: 'ltr', fontFamily: t.fonts.mono, fontSize: 28, letterSpacing: 2, color: t.line}}>
        {String(Math.floor((frame / fps) * 10)).padStart(5, '0')}
      </div>
    </AbsoluteFill>
  );
};

// Diorama: a hairline gold frame that draws itself in, with a light running round it.
const Gilt: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = easeOut(ramp(frame, 0, 30));
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <rect x={34} y={34} width={1012} height={1852} rx={26} fill="none" stroke={t.accent} strokeWidth={1.5} opacity={0.45} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      <rect x={34} y={34} width={1012} height={1852} rx={26} fill="none" stroke="#fff3d6" strokeWidth={3} opacity={0.7} pathLength={1} strokeDasharray="0.03 0.97" strokeDashoffset={-frame / 400} />
    </svg>
  );
};
