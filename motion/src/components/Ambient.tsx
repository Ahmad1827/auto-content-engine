import {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {easeOut, ramp, rnd} from '../fx';
import {useTheme} from '../theme';
import {HORIZON} from './Backdrop';

// Moving scenery behind the scenes, so no style ever sits on a still background. Kept faint: text goes on top of it.
export const Ambient: React.FC = () => {
  const t = useTheme();
  switch (t.decor) {
    case 'hud': return <Radar />;
    case 'sketch': return <Doodles />;
    case 'ornate': return <Voyage />;
    case 'synth': return <Sunset />;
    case 'press': return <Press />;
    case 'pixel': return <PixelWorld />;
    default: return <Bokeh />;
  }
};

const Svg: React.FC<{crisp?: boolean; children: React.ReactNode}> = ({crisp, children}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering={crisp ? 'crispEdges' : undefined}>{children}</svg>
);

// Specks of dust rising through the frame.
const Motes: React.FC<{frame: number; color: string; count: number; opacity: number}> = ({frame, color, count, opacity}) => (
  <g fill={color}>
    {Array.from({length: count}, (_, i) => {
      const y = 1980 - (frame * (0.4 + rnd(i, 1) * 1.1) + rnd(i, 2) * 2000) % 2000;
      const x = rnd(i, 3) * 1080 + Math.sin(frame / (30 + rnd(i, 4) * 40) + i) * 18;
      return <circle key={i} cx={x} cy={y} r={1.5 + rnd(i, 5) * 3} opacity={opacity * (0.35 + 0.65 * Math.abs(Math.sin(frame / 22 + i)))} />;
    })}
  </g>
);

// Atlas: a range-finder sweeping behind everything, with a survey line crossing the frame and drifting dust.
const Radar: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const c = {x: 540, y: 820};
  const scan = (frame * 2.4) % 2300 - 200;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: c.x - 1000, top: c.y - 1000, width: 2000, height: 2000, borderRadius: '50%', opacity: 0.5,
        background: `conic-gradient(from ${frame * 1.6}deg, transparent 0deg, ${t.accent}05 20deg, ${t.accent}26 62deg, ${t.accent}08 72deg, transparent 90deg, transparent 360deg)`}} />
      <Svg>
        <g fill="none" stroke={t.muted} opacity={0.16}>
          {[220, 420, 620, 820, 1020].map((r, i) => <circle key={i} cx={c.x} cy={c.y} r={r} strokeWidth={1.5} strokeDasharray={i % 2 ? '4 10' : undefined} transform={`rotate(${frame * (i % 2 ? 0.12 : -0.08)} ${c.x} ${c.y})`} />)}
          <line x1={c.x} x2={c.x} y1={0} y2={1920} /><line x1={0} x2={1080} y1={c.y} y2={c.y} />
        </g>
        <line x1={0} x2={1080} y1={scan} y2={scan} stroke={t.accent} strokeWidth={2} opacity={0.22} />
        <Motes frame={frame} color={t.text} count={26} opacity={0.32} />
      </Svg>
    </AbsoluteFill>
  );
};

// Ink: little marker doodles that keep getting drawn around the edges, plus flecks of spattered ink.
const DOODLES: [number, number, number, string][] = [
  [132, 90, 1, 'M-30,8 L0,-30 L30,8 L-22,-14 L22,-14 Z'],
  [880, 96, 0.9, 'M-36,0 C-20,-34 10,-34 18,-8 C24,10 2,20 -6,6 C-10,-2 2,-10 8,-4'],
  [85, 660, 0.9, 'M-20,-34 L14,-6 L-10,-2 L18,34'],
  [1010, 520, 1, 'M-20,-20 L20,20 M20,-20 L-20,20'],
  [996, 1150, 1, 'M-30,0 L28,0 M10,-16 L28,0 L10,16'],
  [78, 1300, 1, 'M-28,8 Q-14,-22 0,8 T28,8'],
  [190, 1760, 1.5, 'M-40,8 Q-20,-30 0,8 T40,8 M-40,28 Q-20,-10 0,28 T40,28'],
  [540, 1800, 1.4, 'M-30,8 L0,-30 L30,8 L-22,-14 L22,-14 Z'],
  [900, 1770, 1.5, 'M-36,0 C-20,-34 10,-34 18,-8 C24,10 2,20 -6,6 C-10,-2 2,-10 8,-4'],
];

const Doodles: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 4) % 6;
  return (
    <Svg>
      <g fill={t.accent} opacity={0.2}>
        {Array.from({length: 22}, (_, i) => <circle key={i} cx={rnd(i, 1) * 1080} cy={rnd(i, 2) * 1920} r={2 + rnd(i, 3) * rnd(i, 4) * 11} />)}
      </g>
      <g fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        {DOODLES.map(([x, y, k, d], i) => {
          // Each doodle draws itself, stays a while, then fades before being drawn again.
          const f = (frame + i * 37) % 170;
          const draw = easeOut(ramp(f, 0, 22));
          return (
            <path key={i} d={d} stroke={i % 3 ? t.line : t.accent} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={(1 - ramp(f, 140, 170)) * 0.3}
              transform={`translate(${x + (rnd(i, seed) - 0.5) * 3} ${y + (rnd(i, seed + 9) - 0.5) * 3}) scale(${k}) rotate(${(rnd(i, seed + 18) - 0.5) * 4})`} />
          );
        })}
      </g>
    </Svg>
  );
};

// Parchment: an inked sea across the foot of the chart, a ship working along it, and candlelight on the page.
const Voyage: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const wave = (y: number, shift: number) => {
    const x0 = -160 + ((frame * shift) % 160);
    return `M${x0},${y} ` + Array.from({length: 10}, (_, i) => `q40,-22 80,0 q40,22 80,0`).join(' ');
  };
  const shipX = ((frame * 0.8) % 980) - 110;
  const candle = 0.13 + Math.sin(frame / 7) * 0.03 + Math.sin(frame / 2.9) * 0.02;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 72% 58% at 50% 46%, rgba(255,238,190,1) 0%, transparent 100%)', opacity: candle, mixBlendMode: 'soft-light'}} />
      <Svg>
        <g fill="none" stroke={t.line} opacity={0.26} strokeWidth={2.5}>
          <path d={wave(1760, 0.5)} /><path d={wave(1800, -0.35)} opacity={0.7} /><path d={wave(1840, 0.25)} opacity={0.5} />
        </g>
        <g transform={`translate(${shipX} ${1742 + Math.sin(frame / 14) * 5}) rotate(${Math.sin(frame / 18) * 3})`} fill="none" stroke={t.line} strokeWidth={3} strokeLinejoin="round" opacity={0.6}>
          <path d="M-46,-6 Q0,26 46,-6 Z" fill={t.line} />
          <path d="M0,-6 V-72 M-22,-6 V-52" />
          <path d="M3,-68 Q34,-44 3,-20 Z" fill={t.bg} />
          <path d="M-19,-48 Q2,-32 -19,-16 Z" fill={t.bg} />
          <path d="M0,-72 l18,-7 l-18,-5" fill={t.accent} stroke="none" />
        </g>
        <Motes frame={frame} color={t.line} count={20} opacity={0.3} />
      </Svg>
    </AbsoluteFill>
  );
};

// Neon: a striped sun sinking behind wireframe peaks at the horizon, and a sky of twinkling stars.
const Sunset: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const peaks = (seed: number, height: number) => {
    const shift = -((frame * (seed + 1) * 0.25) % 240);
    const pts = Array.from({length: 13}, (_, i) => `${shift + i * 120},${HORIZON - (i % 2 ? height * (0.4 + rnd(i % 6, seed) * 0.6) : 4)}`);
    return `M${shift},${HORIZON} L${pts.join(' L')} L${shift + 1440},${HORIZON} Z`;
  };
  const r = 225;
  const cy = HORIZON - 70;
  return (
    <Svg>
      <defs>
        <linearGradient id="sun" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe76b" /><stop offset="0.55" stopColor={t.accent} /><stop offset="1" stopColor="#6a1fd0" />
        </linearGradient>
        <clipPath id="above-horizon"><rect x={0} y={0} width={1080} height={HORIZON} /></clipPath>
      </defs>
      <g fill={t.outline}>
        {Array.from({length: 46}, (_, i) => <circle key={i} cx={rnd(i, 1) * 1080} cy={rnd(i, 2) * 1400} r={1 + rnd(i, 3) * 2.2} opacity={0.15 + 0.6 * Math.abs(Math.sin(frame / (9 + rnd(i, 4) * 26) + i))} />)}
      </g>
      <g clipPath="url(#above-horizon)">
        <circle cx={540} cy={cy} r={r + 60} fill={t.accent} opacity={0.12 + Math.sin(frame / 20) * 0.03} />
        <circle cx={540} cy={cy} r={r} fill="url(#sun)" opacity={0.62} />
        {Array.from({length: 7}, (_, i) => {
          const p = ((i + (frame / 40) % 1) / 7);
          return <rect key={i} x={260} width={560} y={cy - 30 + p * (r + 30)} height={3 + p * 20} fill={t.bg} />;
        })}
        <path d={peaks(1, 190)} fill={t.bg} stroke={t.accent} strokeWidth={2} opacity={0.7} />
        <path d={peaks(0, 120)} fill={t.bg} stroke={t.outline} strokeWidth={2.5} />
      </g>
      <g fill="none" strokeWidth={2.5}>
        {Array.from({length: 7}, (_, i) => {
          const y = 1500 - (frame * (0.5 + rnd(i, 1)) + rnd(i, 2) * 1400) % 1400;
          const x = i % 2 ? 40 + rnd(i, 3) * 50 : 990 + rnd(i, 3) * 50;
          return <path key={i} d="M0,-20 L18,12 L-18,12 Z" stroke={i % 3 ? t.outline : t.accent} opacity={0.4} transform={`translate(${x} ${y}) rotate(${frame * (1 + rnd(i, 4))})`} />;
        })}
      </g>
    </Svg>
  );
};

// Newspaper: ghost columns of type across the page, a slow halftone shadow, and the odd hair in the gate of an old film.
const Press: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const lines = useMemo(() => {
    const out: {x: number; y: number; w: number}[] = [];
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 62; row++) {
        const y = 140 + row * 25;
        if (rnd(row, col + 20) > 0.93) continue;
        out.push({x: 60 + col * 325, y, w: rnd(row, col) > 0.82 ? 120 + rnd(row, col + 5) * 120 : 300});
      }
    }
    return out;
  }, []);
  const blobX = 540 + Math.sin(frame / 60) * 320;
  const blobY = 900 + Math.cos(frame / 80) * 520;
  const hair = Math.floor(frame / 3);
  const showHair = rnd(hair, 3) > 0.72;
  return (
    <AbsoluteFill>
      <Svg>
        <g fill={t.text} opacity={0.07}>{lines.map((l, i) => <rect key={i} x={l.x} y={l.y} width={l.w} height={8} />)}</g>
      </Svg>
      <AbsoluteFill style={{
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.42) 2.6px, transparent 3px)', backgroundSize: '12px 12px',
        WebkitMaskImage: `radial-gradient(circle 420px at ${blobX}px ${blobY}px, black 0%, transparent 100%)`, opacity: 0.45,
      }} />
      <Svg>
        {showHair && <path d={`M${rnd(hair, 1) * 1080},${rnd(hair, 2) * 1500} q${rnd(hair, 4) * 50 - 25},90 ${rnd(hair, 5) * 40 - 20},${160 + rnd(hair, 6) * 240}`} fill="none" stroke={t.text} strokeWidth={1.4} opacity={0.28} />}
        <g fill={t.text} opacity={0.3}>
          {Array.from({length: 7}, (_, i) => <circle key={i} cx={rnd(i, Math.floor(frame / 4)) * 1080} cy={rnd(i, Math.floor(frame / 4) + 30) * 1920} r={1 + rnd(i, 3) * 2} />)}
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

// A tiny 8-bit runner, in two frames: each string is a row, X a filled pixel.
const RUNNER = [
  ['..XXX...', '..XXXX..', '..XX....', '.XXXX...', 'X.XX.X..', '..XX....', '.X..X...', 'X....X..'],
  ['..XXX...', '..XXXX..', '..XX....', '..XXX...', '.XXXX...', '..XX....', '..XX....', '..X.X...'],
];
const COIN = ['.XXX.', 'XX.XX', 'XX.XX', 'XX.XX', '.XXX.'];

const Sprite: React.FC<{rows: string[]; x: number; y: number; size: number; fill: string; opacity?: number}> = ({rows, x, y, size, fill, opacity}) => (
  <g fill={fill} opacity={opacity}>
    {rows.flatMap((row, r) => [...row].map((c, k) => (c === 'X' ? <rect key={`${r}-${k}`} x={x + k * size} y={y + r * size} width={size} height={size} /> : null)))}
  </g>
);

const snap = (n: number, step: number) => Math.floor(n / step) * step;

// Pixel: parallax stars, a blocky moon, two ranges of hills rolling by, and someone running through it all.
const PixelWorld: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  const hills = (seed: number, base: number, speed: number, fill: string) => {
    const w = 60;
    const shift = (stepped * speed) % w;
    const start = Math.floor((stepped * speed) / w);
    return (
      <g fill={fill}>
        {Array.from({length: 20}, (_, i) => {
          const h = snap(Math.abs(Math.sin((i + start) * seed)) * 110 + 20, 12);
          return <rect key={i} x={i * w - shift} y={1920 - base - h} width={w} height={base + h} />;
        })}
      </g>
    );
  };
  const runnerX = snap((stepped * 2.2) % 1240 - 80, 6);
  const shooting = (frame % 260) / 26;
  return (
    <Svg crisp>
      {Array.from({length: 54}, (_, i) => {
        const layer = i % 3;
        const size = layer === 0 ? 9 : 6;
        const x = (rnd(i, 1) * 1140 - stepped * (0.12 + layer * 0.14)) % 1140;
        const on = Math.floor(frame / 8 + rnd(i, 3) * 10) % 5 !== 0;
        return <rect key={i} x={snap(x < 0 ? x + 1140 : x, 6)} y={snap(rnd(i, 2) * 1650, 6)} width={size} height={size} fill={t.line} opacity={on ? 0.2 + rnd(i, 4) * 0.55 : 0.06} />;
      })}
      <g transform="translate(830 250)" opacity={0.9}>
        {['...XXXX...', '.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '...XXXX...'].map((row, r) => (
          [...row].map((c, k) => (c === 'X' ? <rect key={`${r}-${k}`} x={k * 14} y={r * 14} width={14} height={14} fill={(r === 2 && k === 3) || (r === 4 && k === 6) || (r === 5 && k === 2) ? '#d9c483' : '#ffe9a8'} /> : null))
        ))}
      </g>
      {shooting < 1 && <rect x={snap(160 + shooting * 760, 6)} y={snap(120 + shooting * 300, 6)} width={36} height={6} fill="#fff" opacity={1 - shooting} />}
      {Array.from({length: 5}, (_, i) => (
        <Sprite key={i} rows={COIN} size={6} fill="#ffd24a" opacity={0.65} x={snap(rnd(i, 1) * 1000 + 20, 6)} y={snap(1900 - (stepped * (0.8 + rnd(i, 2)) + rnd(i, 3) * 1900) % 1900, 6)} />
      ))}
      {hills(0.7, 120, 0.6, '#1d1650')}
      {hills(1.3, 40, 1.4, '#2a2069')}
      <Sprite rows={RUNNER[Math.floor(frame / 5) % 2]} size={7} fill={t.accent} x={runnerX} y={1800} />
    </Svg>
  );
};

// Diorama: warm dust caught in slow beams of light, out of focus.
const Bokeh: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{position: 'absolute', left: 120 + i * 300, top: -300, width: 170 + i * 50, height: 2500, transformOrigin: '50% 0',
          transform: `rotate(${-14 + i * 11 + Math.sin(frame / (70 + i * 25) + i) * 5}deg)`, opacity: 0.1 + Math.sin(frame / 40 + i) * 0.04,
          background: 'linear-gradient(180deg, rgba(255,226,170,0.9), transparent 75%)', mixBlendMode: 'screen'}} />
      ))}
      {Array.from({length: 20}, (_, i) => {
        const size = 24 + rnd(i, 1) * 90;
        const y = 2000 - (frame * (0.35 + rnd(i, 2) * 0.7) + rnd(i, 3) * 2100) % 2100;
        const x = rnd(i, 4) * 1080 + Math.sin(frame / (50 + rnd(i, 5) * 60) + i) * 34;
        return (
          <div key={i} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%',
            opacity: 0.06 + Math.abs(Math.sin(frame / 34 + i)) * 0.1, background: `radial-gradient(circle, ${i % 3 ? t.accent : '#fff3d6'} 0%, ${i % 3 ? t.accent : '#fff3d6'}88 62%, transparent 72%)`}} />
        );
      })}
    </AbsoluteFill>
  );
};
