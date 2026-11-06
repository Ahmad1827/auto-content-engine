import {Fragment, useMemo} from 'react';
import * as THREE from 'three';
import {THEMES} from '../theme';
import {useTime} from './Film';

// Tools for explaining how things move: motion that obeys real physics, forces as arrows, graphs that draw as it happens, and equations that build on the words.
// Everything is a pure function of film time. 2D parts are SVG and go inside an <svg width={1080} height={1920}>, except Equation, Readout and GraphPaper, which are DOM.
type P2 = [number, number];
type V3 = [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (p: number) => p * p * (3 - 2 * p);
const PHYSICS = THEMES.physics;
const MATH = PHYSICS.fonts.math ?? PHYSICS.fonts.body;

// ---------- Motion that's really right ----------

export type Sim<S extends number[]> = {
  // The state at film time t: before `from` it's the start, after the end (or the stop) it stays where it finished.
  at: (t: number) => S;
  // When `stop` first came true, or null if it never did: the moment it lands, hits, or comes to rest.
  stopped: number | null;
  end: number;
};

const add = (a: number[], b: number[], k: number) => a.map((v, i) => v + b[i] * k);

// Runs a state forward with a fixed-step Runge-Kutta, so the motion is exact and the same in every frame.
// `rate(s, t)` gives how fast each number in the state changes; `after(s, t)` can change the state after each step (a bounce, a collision);
// `stop(s, t)` freezes it at that moment. Build it once (at module level or in useMemo), then read `sim.at(t)` anywhere.
//   const fall = simulate([0, 20, 4, 0], ([x, y, vx, vy]) => [vx, vy, 0, -9.81], {from: 2, until: 8, stop: ([, y]) => y <= 0});
export function simulate<S extends number[]>(start: S, rate: (s: S, t: number) => S, opts: {from?: number; until: number; dt?: number; after?: (s: S, t: number) => S; stop?: (s: S, t: number) => boolean}): Sim<S> {
  const {from = 0, until, dt = 1 / 240, after, stop} = opts;
  const steps = Math.max(1, Math.ceil((until - from) / dt));
  const samples: S[] = [start];
  let s = start;
  let stopped: number | null = null;
  for (let i = 0; i < steps; i++) {
    const t = from + i * dt;
    if (stopped === null) {
      const k1 = rate(s, t);
      const k2 = rate(add(s, k1, dt / 2) as S, t + dt / 2);
      const k3 = rate(add(s, k2, dt / 2) as S, t + dt / 2);
      const k4 = rate(add(s, k3, dt) as S, t + dt);
      s = s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as S;
      if (after) s = after(s, t + dt);
      if (stop?.(s, t + dt)) stopped = t + dt;
    }
    samples.push(s);
  }
  const at = (t: number): S => {
    const f = (t - from) / dt;
    if (f <= 0) return samples[0];
    if (f >= steps) return samples[steps];
    const i = Math.floor(f);
    const k = f - i;
    return samples[i].map((v, j) => v + (samples[i + 1][j] - v) * k) as S;
  };
  return {at, stopped, end: from + steps * dt};
}

// From metres (y up) to frame pixels: `const px = metres([540, 1300], 60)` puts 0,0 at that pixel with 60 px a metre. px.back turns pixels into metres.
export function metres(origin: P2, scale: number | P2) {
  const [sx, sy] = typeof scale === 'number' ? [scale, scale] : scale;
  const px = (x: number, y: number): P2 => [origin[0] + x * sx, origin[1] - y * sy];
  px.back = (x: number, y: number): P2 => [(x - origin[0]) / sx, (origin[1] - y) / sy];
  return px;
}

// ---------- Maths type ----------

// 'F_g', 'v_0', 'x^2', 'Δt': one letter after _ or ^, or a {group}.
function scripts(text: string): {s: string; shift?: 'sub' | 'sup'}[] {
  const out: {s: string; shift?: 'sub' | 'sup'}[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if ((c === '_' || c === '^') && i + 1 < text.length) {
      let s = text[i + 1];
      let j = i + 2;
      if (s === '{') {
        const close = text.indexOf('}', i + 2);
        s = text.slice(i + 2, close === -1 ? text.length : close);
        j = close === -1 ? text.length : close + 1;
      }
      out.push({s, shift: c === '_' ? 'sub' : 'sup'});
      i = j;
    } else {
      const last = out.at(-1);
      if (last && !last.shift) last.s += c;
      else out.push({s: c});
      i++;
    }
  }
  return out;
}

// Variables are italic, as in print; numbers, units and operators stand upright. A short run of letters is a variable until the first number, and a unit after it: 'h = 20 m', 'v = 12 m/s'.
function tokens(text: string): {s: string; shift?: 'sub' | 'sup'; italic: boolean}[] {
  let number = false;
  return scripts(text).flatMap((p) => {
    if (p.shift) return [{...p, italic: !number && /^\p{L}+$/u.test(p.s)}];
    return (p.s.match(/\p{L}+|[^\p{L}]+/gu) ?? []).map((s) => {
      const italic = !number && /^\p{L}{1,2}$/u.test(s);
      if (/\d/.test(s)) number = true;
      return {s, italic};
    });
  });
}

const MathSpans: React.FC<{text: string}> = ({text}) => (
  <>
    {tokens(text).map((p, i) => (
      <span key={i} style={{fontStyle: p.italic ? 'italic' : 'normal', fontSize: p.shift ? '0.62em' : undefined, verticalAlign: p.shift === 'sub' ? '-0.3em' : p.shift === 'sup' ? '0.55em' : undefined, whiteSpace: 'pre'}}>{p.s}</span>
    ))}
  </>
);

const SvgMath: React.FC<{text: string}> = ({text}) => (
  <>
    {tokens(text).map((p, i) => (
      <tspan key={i} fontStyle={p.italic ? 'italic' : 'normal'} fontSize={p.shift ? '0.62em' : undefined} baselineShift={p.shift === 'sub' ? '-25%' : p.shift === 'sup' ? '45%' : undefined}>{p.s}</tspan>
    ))}
  </>
);

// ---------- Diagrams (SVG) ----------

// An arrow for a force, a velocity or a field. It grows out of its tail from `at` over `take`, and follows `from` and `to` as they change, so it can shrink, turn and flip with the motion.
// Arrows under 4 px vanish, so a force that goes to zero disappears. `label` is maths text like 'F_g' or 'v = 12 m/s', drawn beside the head.
export const Vector: React.FC<{from: P2; to: P2; at?: number; take?: number; color?: string; width?: number; head?: number; label?: string; size?: number; labelColor?: string; side?: 1 | -1; dash?: string; opacity?: number}> = ({from, to, at = 0, take = 0.5, color = PHYSICS.accent, width = 9, head = 30, label, size = 46, labelColor, side = 1, dash, opacity = 1}) => {
  const t = useTime();
  const k = smooth(clamp01((t - at) / take));
  if (k <= 0) return null;
  const dx = (to[0] - from[0]) * k;
  const dy = (to[1] - from[1]) * k;
  const len = Math.hypot(dx, dy);
  if (len < 4) return null;
  const [ux, uy] = [dx / len, dy / len];
  const h = Math.min(head, len * 0.55);
  const tip: P2 = [from[0] + dx, from[1] + dy];
  const base: P2 = [tip[0] - ux * h, tip[1] - uy * h];
  const wing = h * 0.55;
  const [nx, ny] = [-uy, ux];
  const labelAt: P2 = [tip[0] + ux * size * 0.5 + nx * size * 0.75 * side, tip[1] + uy * size * 0.5 + ny * size * 0.75 * side];
  return (
    <g opacity={opacity}>
      <line x1={from[0]} y1={from[1]} x2={base[0] + ux * 2} y2={base[1] + uy * 2} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />
      <path d={`M${tip[0]} ${tip[1]}L${base[0] + nx * wing} ${base[1] + ny * wing}L${base[0] - nx * wing} ${base[1] - ny * wing}Z`} fill={color} strokeLinejoin="round" stroke={color} strokeWidth={2} />
      {label && (
        <text x={labelAt[0]} y={labelAt[1]} fill={labelColor ?? color} fontFamily={MATH} fontSize={size} textAnchor="middle" dominantBaseline="middle" opacity={clamp01(k * 2 - 1)}
          stroke={PHYSICS.bg} strokeWidth={size * 0.16} paintOrder="stroke" strokeLinejoin="round">
          <SvgMath text={label} />
        </text>
      )}
    </g>
  );
};

// The line something has drawn behind it, from `from` up to now (or `to`). `path(t)` gives its place in pixels at film time t. `fade` lets the old part fade out.
export const Trail: React.FC<{path: (t: number) => P2; from: number; to?: number; color?: string; width?: number; fade?: boolean; dash?: string; rate?: number; opacity?: number}> = ({path, from, to, color = PHYSICS.outline, width = 6, fade = false, dash, rate = 60, opacity = 0.9}) => {
  const t = useTime();
  const end = Math.min(t, to ?? Infinity);
  if (end <= from) return null;
  const n = Math.max(2, Math.ceil((end - from) * rate));
  const pts = Array.from({length: n + 1}, (_, i) => path(from + ((end - from) * i) / n));
  if (!fade) return <path d={`M${pts.map((p) => p.join(' ')).join('L')}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} opacity={opacity} />;
  const parts = 14;
  return (
    <g>
      {Array.from({length: parts}, (_, j) => {
        const a = Math.floor((n * j) / parts);
        const b = Math.floor((n * (j + 1)) / parts);
        const seg = pts.slice(a, b + 1);
        return seg.length > 1 ? <path key={j} d={`M${seg.map((p) => p.join(' ')).join('L')}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} opacity={opacity * ((j + 1) / parts) ** 1.5} /> : null;
      })}
    </g>
  );
};

// A strobe photograph: a faint copy of the moving thing at each of `times` that has passed. Equal times apart, the gaps show the speed changing.
// Draw the copy yourself with `children(x, y, i)`, or get a ring of radius `r`.
export const Strobe: React.FC<{path: (t: number) => P2; times: number[]; r?: number; color?: string; opacity?: number; children?: (x: number, y: number, i: number) => React.ReactNode}> = ({path, times, r = 22, color = PHYSICS.line, opacity = 0.35, children}) => {
  const t = useTime();
  return (
    <g opacity={opacity}>
      {times.filter((at) => at <= t).map((at, i) => {
        const [x, y] = path(at);
        return <Fragment key={i}>{children ? children(x, y, i) : <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={4} />}</Fragment>;
      })}
    </g>
  );
};

// A measured span between two points, with end ticks and a label in the middle: 'h = 20 m'. Draws itself from `at`. `offset` pushes it to the side in pixels.
export const Dimension: React.FC<{from: P2; to: P2; label: string; at?: number; take?: number; offset?: number; color?: string; size?: number}> = ({from, to, label, at = 0, take = 0.6, offset = 0, color = PHYSICS.muted, size = 40}) => {
  const t = useTime();
  const k = smooth(clamp01((t - at) / take));
  if (k <= 0) return null;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const [nx, ny] = [-(to[1] - from[1]) / len, (to[0] - from[0]) / len];
  const a: P2 = [from[0] + nx * offset, from[1] + ny * offset];
  const b: P2 = [to[0] + nx * offset, to[1] + ny * offset];
  const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const half = (len / 2) * k;
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const tick = 16;
  const horizontal = Math.abs(ux) > Math.abs(uy);
  // The label goes on the far side, away from what's measured.
  const away = offset < 0 ? -1 : 1;
  const out: P2 = [nx * away, ny * away];
  return (
    <g stroke={color} strokeWidth={4} strokeLinecap="round">
      <line x1={mid[0] - ux * half} y1={mid[1] - uy * half} x2={mid[0] + ux * half} y2={mid[1] + uy * half} />
      {k > 0.98 && [a, b].map((p, i) => <line key={i} x1={p[0] - nx * tick} y1={p[1] - ny * tick} x2={p[0] + nx * tick} y2={p[1] + ny * tick} />)}
      <text x={mid[0] + out[0] * (tick + 10)} y={mid[1] + out[1] * (size * 0.5 + tick)} fill={color} stroke={PHYSICS.bg} strokeWidth={size * 0.18} paintOrder="stroke" fontFamily={MATH} fontSize={size}
        textAnchor={horizontal ? 'middle' : out[0] < 0 ? 'end' : 'start'} dominantBaseline="middle" opacity={clamp01(k * 2 - 1)}>
        <SvgMath text={label} />
      </text>
    </g>
  );
};

export type Series = {fn: (x: number) => number; upTo?: number; color?: string; label?: string; width?: number};

// A graph that draws itself as the thing happens. `xs` and `ys` are the ranges shown; the box is x, y, w, h in pixels. The axes draw in from `at`.
// Each series draws `fn` up to x = `upTo` (usually the time elapsed, so the curve keeps pace with the motion), with a dot on its newest point.
// `ticks` puts numbers on the axes; `marks` drops a dashed line and a label at an x value worth pointing at.
export const Plot: React.FC<{x: number; y: number; w: number; h: number; xs: P2; ys: P2; series: Series[]; at?: number; xLabel?: string; yLabel?: string; ticks?: {x?: number[]; y?: number[]}; marks?: {x: number; label?: string; color?: string}[]; color?: string; size?: number}> = ({x, y, w, h, xs, ys, series, at = 0, xLabel, yLabel, ticks = {}, marks = [], color = PHYSICS.muted, size = 34}) => {
  const t = useTime();
  const k = smooth(clamp01((t - at) / 0.7));
  if (k <= 0) return null;
  const X = (v: number) => x + ((v - xs[0]) / (xs[1] - xs[0])) * w;
  const Y = (v: number) => y + h - ((v - ys[0]) / (ys[1] - ys[0])) * h;
  const zeroY = Y(Math.min(Math.max(0, ys[0]), ys[1]));
  const text = {fill: color, fontFamily: MATH, fontSize: size, stroke: PHYSICS.bg, strokeWidth: size * 0.15, paintOrder: 'stroke' as const};
  return (
    <g>
      <rect x={x - 24} y={y - 24} width={w + 48} height={h + 48} rx={18} fill={PHYSICS.bg} opacity={0.72 * k} />
      <line x1={x} y1={y + h} x2={x} y2={y + h - h * k} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <line x1={x} y1={zeroY} x2={x + w * k} y2={zeroY} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <g opacity={clamp01(k * 2 - 1)}>
        {(ticks.x ?? []).map((v) => <text key={`x${v}`} x={X(v)} y={zeroY + size * 1.1} textAnchor="middle" {...text} fontSize={size * 0.8}>{v}</text>)}
        {(ticks.y ?? []).map((v) => <text key={`y${v}`} x={x - 14} y={Y(v)} textAnchor="end" dominantBaseline="middle" {...text} fontSize={size * 0.8}>{v}</text>)}
        {xLabel && <text x={x + w} y={zeroY - 14} textAnchor="end" {...text}><SvgMath text={xLabel} /></text>}
        {yLabel && <text x={x + 14} y={y + size * 0.4} {...text}><SvgMath text={yLabel} /></text>}
      </g>
      {marks.map((m, i) => (
        <g key={i} opacity={k}>
          <line x1={X(m.x)} y1={y} x2={X(m.x)} y2={y + h} stroke={m.color ?? color} strokeWidth={3} strokeDasharray="10 10" />
          {m.label && <text x={X(m.x)} y={y - 8} textAnchor="middle" {...text} fill={m.color ?? color}><SvgMath text={m.label} /></text>}
        </g>
      ))}
      {series.map((s, i) => {
        const end = Math.min(xs[1], s.upTo ?? xs[1]);
        if (end <= xs[0]) return null;
        const n = 120;
        const pts = Array.from({length: n + 1}, (_, j) => {
          const v = xs[0] + ((end - xs[0]) * j) / n;
          return [X(v), Y(Math.min(ys[1], Math.max(ys[0], s.fn(v))))];
        });
        const c = s.color ?? PHYSICS.outline;
        const head = pts[n];
        return (
          <g key={i}>
            <path d={`M${pts.map((p) => p.join(' ')).join('L')}`} stroke={c} strokeWidth={s.width ?? 7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={head[0]} cy={head[1]} r={11} fill={c} />
            {s.label && <text x={head[0] + 18} y={head[1] - 18} {...text} fill={c}><SvgMath text={s.label} /></text>}
          </g>
        );
      })}
    </g>
  );
};

// ---------- Arrows in 3D ----------

// A force or velocity arrow in a 3D Stage, in metres. Follows `from` and `to` as they change, and grows in from `at`.
export const Arrow3D: React.FC<{from: V3; to: V3; at?: number; take?: number; color?: string; radius?: number; glow?: number}> = ({from, to, at = 0, take = 0.5, color = PHYSICS.accent, radius = 0.035, glow = 0.35}) => {
  const t = useTime();
  const k = smooth(clamp01((t - at) / take));
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).multiplyScalar(k);
  const len = dir.length();
  const quat = useMemo(() => new THREE.Quaternion(), []);
  if (len < 0.02) return null;
  quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const head = Math.min(radius * 5, len * 0.45);
  const shaft = len - head;
  return (
    <group position={from} quaternion={quat}>
      <mesh position={[0, shaft / 2, 0]}><cylinderGeometry args={[radius, radius, shaft, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.4} /></mesh>
      <mesh position={[0, shaft + head / 2, 0]}><coneGeometry args={[radius * 2.6, head, 18]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.4} /></mesh>
    </group>
  );
};

// ---------- On top (DOM) ----------

export type Term = string | {t: string; at?: number; color?: string; becomes?: [number, string]};

// An equation that builds on the narration. Each term arrives at its own `at` (or the equation's), flashes as it lands, then settles.
// Write variables plainly with _ and ^ ('v_0', 't^2'); letters are set in italic. `becomes: [time, '9.8']` swaps a term for a number when the voice plugs it in.
// x, y is the centre of the equation in frame pixels.
export const Equation: React.FC<{terms: Term[]; x?: number; y?: number; size?: number; at?: number; color?: string; flash?: string; font?: string; gap?: number}> = ({terms, x = 540, y = 400, size = 110, at = 0, color = PHYSICS.text, flash = PHYSICS.accent, font = MATH, gap = 0.22}) => {
  const t = useTime();
  return (
    <div style={{position: 'absolute', left: 0, width: 1080, top: y, transform: `translate(${x - 540}px, -50%)`, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: size * gap, fontFamily: font, fontSize: size, lineHeight: 1, color, whiteSpace: 'nowrap',
      textShadow: '0 4px 20px rgba(0,0,0,0.65)'}}>
      {terms.map((term, i) => {
        const tm = typeof term === 'string' ? {t: term} : term;
        const start = tm.at ?? at;
        const k = clamp01((t - start) / 0.35);
        if (t < start) return <span key={i} style={{opacity: 0}}><MathSpans text={tm.t} /></span>;
        const swapped = tm.becomes && t >= tm.becomes[0];
        const since = swapped ? t - tm.becomes![0] : t - start;
        const lit = clamp01(1 - since / 0.9);
        const base = tm.color ?? color;
        return (
          <span key={`${i}${swapped ? 'b' : 'a'}`} style={{display: 'inline-block', opacity: smooth(k), transform: `translateY(${(1 - smooth(k)) * size * 0.35}px) scale(${1 + lit * 0.18})`, color: lit > 0.05 ? flash : base, transition: 'none'}}>
            <MathSpans text={swapped ? tm.becomes![1] : tm.t} />
          </span>
        );
      })}
    </div>
  );
};

// A live number: 'v = 14.2 m/s'. `value` is whatever it is at this moment; it may rise and fall with the motion.
export const Readout: React.FC<{label: string; value: number; unit?: string; digits?: number; x?: number; y?: number; size?: number; color?: string; align?: 'left' | 'center' | 'right'; at?: number}> = ({label, value, unit = '', digits = 1, x = 90, y = 200, size = 64, color = PHYSICS.text, align = 'left', at = 0}) => {
  const t = useTime();
  const k = clamp01((t - at) / 0.35);
  if (k <= 0) return null;
  const shift = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translateX(${shift})`, opacity: k, fontFamily: MATH, fontSize: size, color, whiteSpace: 'nowrap', textShadow: '0 3px 16px rgba(0,0,0,0.7)'}}>
      <MathSpans text={label} /> = <span style={{fontFamily: PHYSICS.fonts.mono, fontSize: size * 0.86, fontVariantNumeric: 'tabular-nums'}}>{value.toFixed(digits)}</span>
      {unit && <span style={{fontSize: size * 0.72, color: PHYSICS.muted}}> {unit}</span>}
    </div>
  );
};

// Graph paper behind a diagram: a fine grid with a stronger line every fifth. Pass `x`, `y` to slide it with a World2D camera, and `scale` to match its zoom.
export const GraphPaper: React.FC<{color?: string; bg?: string; cell?: number; x?: number; y?: number; scale?: number; opacity?: number}> = ({color = PHYSICS.border, bg = PHYSICS.bg, cell = 36, x = 0, y = 0, scale = 1, opacity = 1}) => {
  const c = cell * scale;
  const pos = `${-x * scale}px ${-y * scale}px`;
  return (
    <div style={{position: 'absolute', inset: 0, background: bg}}>
      <div style={{position: 'absolute', inset: 0, opacity,
        backgroundImage: `linear-gradient(${color} 2px, transparent 2px), linear-gradient(90deg, ${color} 2px, transparent 2px), linear-gradient(${color}88 1px, transparent 1px), linear-gradient(90deg, ${color}88 1px, transparent 1px)`,
        backgroundSize: `${c * 5}px ${c * 5}px, ${c * 5}px ${c * 5}px, ${c}px ${c}px, ${c}px ${c}px`, backgroundPosition: `${pos}, ${pos}, ${pos}, ${pos}`}} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)'}} />
    </div>
  );
};
