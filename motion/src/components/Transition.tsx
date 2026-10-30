import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {easeIn, easeOut, ramp, rnd} from '../fx';
import {useTheme} from '../theme';

// Frames before and after the cut. The screen is fully covered at the cut itself, so the swap never shows.
const IN = 7;
const OUT = 8;

// Plays each style's own wipe at every scene change; `cuts` are the frames where scenes start.
export const Transition: React.FC<{cuts: number[]}> = ({cuts}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const cut = cuts.find((c) => frame >= c - IN && frame <= c + OUT);
  if (cut === undefined) return null;
  const f = frame - cut;
  const cover = f < 0 ? ramp(f, -IN, 0) : 1;
  const leave = f > 0 ? ramp(f, 0, OUT) : 0;
  switch (t.decor) {
    case 'sketch': return <Scribble cover={cover} leave={leave} />;
    case 'ornate': return <Roll cover={cover} leave={leave} />;
    case 'synth': return <Glitch cover={cover} leave={leave} f={f} />;
    case 'press': return <SpinningPaper cover={cover} leave={leave} />;
    case 'pixel': return <Mosaic cover={cover} leave={leave} />;
    case 'clean': return <Bloom cover={cover} leave={leave} />;
    default: return <Slash cover={cover} leave={leave} />;
  }
};

type Wipe = {cover: number; leave: number};

const Svg: React.FC<{crisp?: boolean; children: React.ReactNode}> = ({crisp, children}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering={crisp ? 'crispEdges' : undefined}>{children}</svg>
);

// Atlas: red then black bands cut across on a slant.
const Slash: React.FC<Wipe> = ({cover, leave}) => {
  const t = useTheme();
  const band = (lead: number, trail: number, fill: string) => {
    const a = -500 + 2000 * easeIn(lead);
    const b = -500 + 2000 * easeOut(trail);
    return <polygon points={`${b},0 ${a},0 ${a - 400},1920 ${b - 400},1920`} fill={fill} />;
  };
  return (
    <Svg>
      {band(Math.min(1, cover * 1.25), Math.min(1, leave * 0.9), t.accent)}
      {band(cover, leave, t.bg)}
      {leave === 0 && cover > 0.9 ? <rect width={1080} height={1920} fill={t.bg} /> : null}
    </Svg>
  );
};

// Ink: a fat marker scribbles over the frame, then gets rubbed away from its start.
const SCRIBBLE = (() => {
  const steps = 8;
  const pts = Array.from({length: steps}, (_, i) => `${i % 2 ? -520 : 1600},${-120 + i * 310}`);
  return `M-520,-300 L${pts.join(' L')}`;
})();

const Scribble: React.FC<Wipe> = ({cover, leave}) => {
  const t = useTheme();
  const end = easeOut(cover);
  const start = easeIn(leave);
  const stroke = (from: number, to: number, color: string, width: number) => (
    <path d={SCRIBBLE} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${Math.max(0, to - from)} 2`} strokeDashoffset={-from} />
  );
  return (
    <Svg>
      {stroke(Math.max(0, start - 0.04), Math.min(1, end + 0.04), t.accent, 520)}
      {stroke(start, end, t.bg, 460)}
    </Svg>
  );
};

// Parchment: a fresh sheet unrolls across, with the curl of the roll at its edge.
const Roll: React.FC<Wipe> = ({cover, leave}) => {
  const t = useTheme();
  const lead = -180 + 1440 * easeOut(cover);
  const trail = -180 + 1440 * easeIn(leave);
  const curl = 'linear-gradient(90deg, rgba(70,40,14,0.55), #f6ecd2 45%, rgba(70,40,14,0.7))';
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 0, bottom: 0, left: trail, width: Math.max(0, lead - trail), background: t.bg}} />
      {cover < 1 && <div style={{position: 'absolute', top: 0, bottom: 0, left: lead - 90, width: 180, background: curl}} />}
      {leave > 0 && <div style={{position: 'absolute', top: 0, bottom: 0, left: trail - 90, width: 180, background: curl}} />}
    </AbsoluteFill>
  );
};

// Neon: bars of signal tear across in steps, in both directions, with a flash at the cut.
const Glitch: React.FC<Wipe & {f: number}> = ({cover, leave, f}) => {
  const t = useTheme();
  const rows = 14;
  const h = 1920 / rows;
  return (
    <Svg>
      {Array.from({length: rows}, (_, i) => {
        const dir = i % 2 ? 1 : -1;
        const lead = Math.min(1, Math.ceil(Math.min(1, cover * (1 + rnd(i, 1))) * 4) / 4);
        const trail = Math.floor(Math.min(1, leave * (1 + rnd(i, 2))) * 4) / 4;
        const w = 1080 * Math.max(0, lead - trail);
        const x = dir > 0 ? 1080 * trail : 1080 * (1 - lead);
        return (
          <g key={i}>
            <rect x={x} y={i * h} width={w} height={h + 1} fill={t.bg} />
            {w > 0 && w < 1080 && <rect x={dir > 0 ? x + w - 22 : x} y={i * h} width={22} height={h + 1} fill={i % 3 ? t.outline : t.accent} />}
          </g>
        );
      })}
      {Math.abs(f) <= 1 && <rect width={1080} height={1920} fill={t.outline} opacity={0.22} />}
    </Svg>
  );
};

// Newspaper: the classic spinning front page, flying up to fill the screen and then away.
const SpinningPaper: React.FC<Wipe> = ({cover, leave}) => {
  const t = useTheme();
  const s = easeOut(cover);
  const angle = (1 - s) * 620 + leave * 24;
  const y = easeIn(leave) * -3400;
  return (
    <div style={{position: 'absolute', left: 540 - 1700, top: 960 - 1700, width: 3400, height: 3400, background: t.bg, transform: `translateY(${y}px) rotate(${angle}deg) scale(${s})`,
      boxShadow: '0 0 90px rgba(0,0,0,0.6)', backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.11) 0 8px, transparent 8px 30px)'}}>
      <div style={{position: 'absolute', left: 1240, right: 1240, top: 1100, height: 60, background: t.text}} />
      <div style={{position: 'absolute', left: 1240, right: 1240, top: 1190, height: 14, background: t.text}} />
      <div style={{position: 'absolute', left: 1370, right: 1370, top: 1560, height: 280, border: `26px solid ${t.accent}`, transform: 'rotate(-4deg)'}} />
    </div>
  );
};

// Pixel: the screen fills with blocks in a scattered order, then clears the same way.
const Mosaic: React.FC<Wipe> = ({cover, leave}) => {
  const t = useTheme();
  const size = 90;
  const cells = [];
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 12; x++) {
      const i = x + y * 12;
      const inAt = rnd(i, 1) * 0.92;
      const outAt = rnd(i, 2) * 0.92;
      if (cover <= inAt || leave > outAt) continue;
      const rim = cover - inAt < 0.14 || outAt - leave < 0.14;
      cells.push(<rect key={i} x={x * size} y={y * size} width={size} height={size} fill={rim && cover + leave < 2 ? t.accent : t.bg} />);
    }
  }
  return <Svg crisp>{cells}</Svg>;
};

// Diorama: the frame blooms into warm light, like a lens catching the sun.
const Bloom: React.FC<Wipe> = ({cover, leave}) => {
  const t = useTheme();
  const up = easeOut(cover) * (1 - easeIn(leave));
  return (
    <AbsoluteFill style={{opacity: up, background: `radial-gradient(circle at ${30 + cover * 25 + leave * 25}% 42%, #fff4d8 0%, ${t.accent} 50%, #6c4716 100%)`}} />
  );
};
