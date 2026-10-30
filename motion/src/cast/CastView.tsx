import {useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../theme';
import type {Cast} from '../types';
import {DioramaScene} from './Diorama';
import {type CastMode, FlatScene} from './Flat';
import {PixelScene} from './Pixel';

// Draws a cast in the current style's renderer: flat cartoon, pixel art or 3D.
// People pop in one after another, `delay` frames after the view appears.
export const CastView: React.FC<{cast: Cast; W: number; H: number; mode: CastMode; delay?: number}> = ({cast, W, H, mode, delay = 0}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const people = cast.people.slice(0, 4);
  const trimmed = {...cast, people};
  const enter = people.map((_, i) => {
    const x = Math.max(0, Math.min(1, (frame - delay - 4 - i * 5) / 10));
    return 1 - Math.pow(1 - x, 3);
  });
  if (t.render === '3d') return <DioramaScene cast={trimmed} W={W} H={H} mode={mode} enter={enter} />;
  if (t.render === 'pixel') return <PixelScene cast={trimmed} t={t} time={frame / fps} W={W} H={H} mode={mode} enter={enter} />;
  if (!t.wobble) return <FlatScene cast={trimmed} t={t} time={frame / fps} W={W} H={H} mode={mode} enter={enter} />;
  // Hand-drawn styles push the outlines off true, re-seeded every few frames so they boil like the line art.
  const id = `cast-ink-${mode}-${W}`;
  return (
    <div style={{width: W, height: H, filter: `url(#${id})`}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id={id} x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={t.boil ? Math.floor(frame / 4) % 6 : 1} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={t.wobble * 1.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <FlatScene cast={trimmed} t={t} time={frame / fps} W={W} H={H} mode={mode} enter={enter} />
    </div>
  );
};
