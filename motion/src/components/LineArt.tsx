import {useLayoutEffect, useMemo, useRef} from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../theme';

// AI-written SVG is untrusted: keep only drawing markup.
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\s*(script|foreignObject|iframe|style)[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
}

const GEOMETRY = 'path, line, polyline, polygon, circle, ellipse, rect';

// Renders line-art SVG and draws its strokes on one after another.
// Classes the AI may use: "accent" (glowing accent stroke), "solid" (filled), "warm" (sunrise glow fill).
export const LineArt: React.FC<{svg: string; drawSeconds?: number; delay?: number}> = ({svg, drawSeconds = 2.2, delay = 0}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => sanitizeSvg(svg), [svg]);
  // A stable id per drawing so stacked panels don't share (and fight over) one filter.
  const filterId = useMemo(() => `ace-ink-${Math.abs([...svg].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`, [svg]);
  const seed = t.boil ? Math.floor(frame / 4) % 6 : 1;
  const progress = interpolate(frame - delay, [0, drawSeconds * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const elements = Array.from(root.querySelectorAll<SVGGeometryElement>(GEOMETRY));
    const n = elements.length || 1;
    elements.forEach((el, i) => {
      // Each element gets an overlapping slice of the overall progress.
      const local = Math.min(1, Math.max(0, (progress - (i / n) * 0.7) / 0.3));
      if (el.classList.contains('solid') || el.classList.contains('warm')) {
        el.style.opacity = String(local);
        return;
      }
      const len = el.getTotalLength?.() || 1000;
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len * (1 - local)}`;
    });
    root.querySelectorAll<SVGTextElement>('text').forEach((el) => {
      el.style.opacity = String(Math.min(1, Math.max(0, (progress - 0.6) / 0.4)));
    });
  }, [progress, html]);

  return (
    <div ref={ref} style={{width: '100%', height: '100%'}}>
      <style>{`
        .lineart svg { width: 100%; height: 100%; overflow: visible; }
        .lineart svg :is(${GEOMETRY}) { fill: none; stroke: ${t.line}; stroke-width: ${t.lineWidth}; stroke-linecap: round; stroke-linejoin: round;
          ${t.glow > 1.2 ? `filter: drop-shadow(0 0 ${4 * t.glow}px ${t.line});` : ''} }
        .lineart svg .accent { stroke: ${t.accent}; filter: drop-shadow(0 0 ${8 * t.glow}px ${t.accent}); }
        .lineart svg .solid { fill: ${t.line}; stroke: none; }
        .lineart svg .warm { fill: url(#ace-warm); stroke: none; filter: drop-shadow(0 0 ${30 * t.glow}px ${t.accent}88); }
        .lineart svg text { fill: ${t.muted}; stroke: none; font-family: ${t.fonts.mono}; font-size: 26px; letter-spacing: 3px; }
      `}</style>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="ace-warm" cx="50%" cy="65%" r="70%">
            <stop offset="0%" stopColor="#ffd9a0" />
            <stop offset="45%" stopColor={t.accent} />
            <stop offset="100%" stopColor={t.bg} />
          </radialGradient>
          {/* Hand-inked lines: displace strokes with low-frequency noise; a changing seed makes them boil. */}
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed={seed} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={t.wobble} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="lineart" style={{width: '100%', height: '100%', filter: t.wobble ? `url(#${filterId})` : undefined}} dangerouslySetInnerHTML={{__html: html}} />
    </div>
  );
};
