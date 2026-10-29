import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useTheme} from '../theme';

// Where the parchment compass rose sits; its rhumb lines radiate from here (Decor draws the rose itself).
export const COMPASS = {x: 930, y: 1760};
// Neon horizon, below the captions and handle: the perspective floor runs from here to the bottom.
const HORIZON = 1700;

// Background per theme: base color, vignette and a texture. Sits under every scene.
export const Backdrop: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: t.bg}}>
      {t.texture === 'paper' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(255,250,235,0.5) 0%, rgba(0,0,0,0) 55%, rgba(92,58,22,0.45) 100%)'}} />
          <RhumbLines color={t.line} />
          <Noise opacity={0.22} blend="multiply" frequency={0.6} />
          <Noise opacity={0.12} blend="multiply" frequency={0.02} />
          {/* Burnt, blotchy edges: coarse noise that only shows near the border. */}
          <AbsoluteFill style={{WebkitMaskImage: 'radial-gradient(ellipse 75% 62% at 50% 48%, transparent 62%, black 100%)'}}>
            <AbsoluteFill style={{background: 'rgba(70,40,14,0.35)'}} />
            <Noise opacity={0.55} blend="multiply" frequency={0.012} />
          </AbsoluteFill>
        </>
      )}
      {t.texture === 'halftone' && (
        <>
          <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(0,0,0,0.09) 1.6px, transparent 1.8px)', backgroundSize: '9px 9px'}} />
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 60%, rgba(60,50,30,0.3) 100%)'}} />
          {/* The fold across the middle of a paper that came out of a pocket. */}
          <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 48.6%, rgba(0,0,0,0.07) 49.9%, rgba(255,255,255,0.35) 50.1%, transparent 51.6%)'}} />
          <Noise opacity={0.15} blend="multiply" frequency={0.8} />
        </>
      )}
      {t.texture === 'grid' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(${t.border}55 1px, transparent 1px), linear-gradient(90deg, ${t.border}55 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
              WebkitMaskImage: `linear-gradient(180deg, black 0%, black 55%, transparent ${(HORIZON / 1920) * 100}%)`,
            }}
          />
          <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 30%, ${t.accent}22 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, ${t.outline}1f 0%, transparent 45%)`}} />
          <SynthFloor frame={frame} line={t.outline} accent={t.accent} bg={t.bg} />
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)'}} />
        </>
      )}
      {t.texture === 'grain' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 38%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
          {t.decor === 'sketch' && (
            <AbsoluteFill style={{background: `radial-gradient(circle at 78% 18%, ${t.accent}26 0%, transparent 38%), radial-gradient(ellipse at 20% 95%, ${t.accent}12 0%, transparent 45%)`}} />
          )}
          {/* A new seed every other frame keeps the grain alive, like film. */}
          <Noise opacity={0.07} blend="screen" frequency={0.9} seed={Math.floor(frame / 2) % 12} />
        </>
      )}
    </AbsoluteFill>
  );
};

const Noise: React.FC<{opacity: number; blend: 'screen' | 'multiply'; frequency: number; seed?: number}> = ({opacity, blend, frequency, seed = 0}) => {
  const id = `noise-${String(frequency).replace('.', '')}-${seed}`;
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', opacity, mixBlendMode: blend}}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves="3" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};

// The faint compass lines that criss-cross old portolan charts.
const RhumbLines: React.FC<{color: string}> = ({color}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: 0.09}}>
    {Array.from({length: 16}, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return (
        <line key={i} x1={COMPASS.x} y1={COMPASS.y} x2={COMPASS.x + Math.cos(a) * 2600} y2={COMPASS.y + Math.sin(a) * 2600}
          stroke={color} strokeWidth={i % 2 ? 1.2 : 2} strokeDasharray={i % 4 === 3 ? '10 8' : undefined} />
      );
    })}
  </svg>
);

// Perspective grid floor that scrolls toward the viewer, under a glowing horizon.
const SynthFloor: React.FC<{frame: number; line: string; accent: string; bg: string}> = ({frame, line, accent, bg}) => {
  const depth = 1920 - HORIZON;
  const rows = 9;
  const phase = (frame / 45) % 1;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="floor-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0.9" />
        </linearGradient>
        <mask id="floor-mask">
          <rect x={0} y={HORIZON} width={1080} height={depth} fill="url(#floor-fade)" />
        </mask>
      </defs>
      <rect x={0} y={HORIZON} width={1080} height={depth} fill={bg} opacity={0.85} />
      <g mask="url(#floor-mask)" stroke={line} strokeWidth={2}>
        {Array.from({length: 19}, (_, i) => {
          const x = 540 + (i - 9) * 260;
          return <line key={`v${i}`} x1={540 + (x - 540) * 0.04} y1={HORIZON} x2={540 + (x - 540) * 2.2} y2={1920} />;
        })}
        {Array.from({length: rows}, (_, i) => {
          const y = HORIZON + depth * Math.pow((i + phase) / rows, 2.2);
          return <line key={`h${i}`} x1={0} y1={y} x2={1080} y2={y} />;
        })}
      </g>
      <rect x={0} y={HORIZON - 2} width={1080} height={4} fill={accent} style={{filter: `drop-shadow(0 0 18px ${accent})`}} />
    </svg>
  );
};
