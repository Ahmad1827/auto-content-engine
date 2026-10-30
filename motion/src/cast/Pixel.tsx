import {useLayoutEffect, useMemo, useRef} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {continueRender, delayRender} from 'remotion';
import type {Theme} from '../theme';
import type {Cast} from '../types';
import {type CastMode, FlatScene} from './Flat';

// Pixel art: the flat scene drawn into a tiny canvas, then blown up with nearest-neighbour scaling.
const PIXEL = 12;

export const PixelScene: React.FC<{cast: Cast; t: Theme; time: number; W: number; H: number; mode: CastMode; enter: number[]}> = ({cast, t, time, W, H, mode, enter}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = Math.round(W / PIXEL);
  const h = Math.round(H / PIXEL);
  // Snap time to a low frame rate: pixel animation reads better choppy.
  const stepped = Math.floor(time * 12) / 12;
  const markup = useMemo(
    () => renderToStaticMarkup(<FlatScene cast={cast} t={t} time={stepped} W={w} H={h} mode={mode} crisp enter={enter.map((e) => Math.round(e * 4) / 4)} />),
    [cast, t, stepped, w, h, mode, enter],
  );

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const id = delayRender('Rasterising pixel scene');
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      }
      continueRender(id);
    };
    img.onerror = () => continueRender(id);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }, [markup, w, h]);

  return <canvas ref={ref} width={w} height={h} style={{width: W, height: H, imageRendering: 'pixelated', display: 'block'}} />;
};
