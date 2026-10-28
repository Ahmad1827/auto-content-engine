import {AbsoluteFill} from 'remotion';
import {useTheme} from '../theme';

// Static background per theme: base color, vignette and a texture. Sits under every scene.
export const Backdrop: React.FC = () => {
  const t = useTheme();
  return (
    <AbsoluteFill style={{backgroundColor: t.bg}}>
      {t.texture === 'paper' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(255,250,235,0.5) 0%, rgba(0,0,0,0) 55%, rgba(92,58,22,0.45) 100%)'}} />
          <Noise opacity={0.22} blend="multiply" frequency={0.6} />
          <Noise opacity={0.12} blend="multiply" frequency={0.02} />
        </>
      )}
      {t.texture === 'halftone' && (
        <>
          <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(0,0,0,0.09) 1.6px, transparent 1.8px)', backgroundSize: '9px 9px'}} />
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 60%, rgba(60,50,30,0.3) 100%)'}} />
          <Noise opacity={0.15} blend="multiply" frequency={0.8} />
        </>
      )}
      {t.texture === 'grid' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(${t.border}55 1px, transparent 1px), linear-gradient(90deg, ${t.border}55 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
          <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 30%, ${t.accent}22 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, ${t.outline}1f 0%, transparent 45%)`}} />
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)'}} />
        </>
      )}
      {t.texture === 'grain' && (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 38%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
          <Noise opacity={0.07} blend="screen" frequency={0.9} />
        </>
      )}
    </AbsoluteFill>
  );
};

const Noise: React.FC<{opacity: number; blend: 'screen' | 'multiply'; frequency: number}> = ({opacity, blend, frequency}) => {
  const id = `noise-${String(frequency).replace('.', '')}`;
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', opacity, mixBlendMode: blend}}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};
