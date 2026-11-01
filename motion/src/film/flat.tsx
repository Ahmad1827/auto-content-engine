import {geoGraticule10, geoMercator, geoPath} from 'd3-geo';
import type {FeatureCollection, Geometry} from 'geojson';
import countries from 'i18n-iso-countries';
import {createContext, useContext, useMemo} from 'react';
import {feature} from 'topojson-client';
import type {Topology} from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';
import {useTime} from './Film';

// Tools for anything that isn't 3D: pixel art, ink drawings, paper, maps, diagrams. A 2D film is still one continuous world with a camera, not a row of slides.
const smooth = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export type CamStop = {at: number; x: number; y: number; zoom?: number; turn?: number};

const CamContext = createContext({x: 540, y: 960, zoom: 1, snap: 0});

function camAt(stops: CamStop[], t: number) {
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].at <= t) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const k = b.at > a.at ? smooth(clamp01((t - a.at) / (b.at - a.at))) : 0;
  const za = a.zoom ?? 1;
  const zb = b.zoom ?? 1;
  return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: Math.exp(Math.log(za) + (Math.log(zb) - Math.log(za)) * k), turn: (a.turn ?? 0) + ((b.turn ?? 0) - (a.turn ?? 0)) * k};
}

// A camera over a 2D world. Draw in world pixels as large as you like, and move between stops: {x, y} is what's centred, `zoom` is how close. Put parts in <Layer depth> for parallax.
// `snap` rounds its movement to that many pixels, so that pixel art never swims between pixels.
export const World2D: React.FC<{stops: CamStop[]; snap?: number; children: React.ReactNode}> = ({stops, snap = 0, children}) => {
  const t = useTime();
  const c = camAt(stops, t);
  const value = useMemo(() => ({x: c.x, y: c.y, zoom: c.zoom, snap}), [c.x, c.y, c.zoom, snap]);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <CamContext.Provider value={value}>{children}</CamContext.Provider>
    </div>
  );
};

// One plane of a World2D. depth 1 moves with the world, 0 stays fixed to the screen, 0.3 is a far background, 1.5 passes close to the lens.
export const Layer: React.FC<{depth?: number; children: React.ReactNode}> = ({depth = 1, children}) => {
  const {x, y, zoom, snap} = useContext(CamContext);
  const z = 1 + (zoom - 1) * depth;
  const round = (v: number) => (snap ? Math.round(v / snap) * snap : v);
  const tx = round(540 - x * depth * z - 540 * (1 - depth) * z);
  const ty = round(960 - y * depth * z - 960 * (1 - depth) * z);
  return <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})`, willChange: 'transform'}}>{children}</div>;
};

// Pixel art from rows of characters: <Sprite art={['.aa.', 'abba']} colors={{a: '#334', b: '#f80'}} px={8} x={100} y={200} />. '.' and ' ' are clear.
// Pass `frames` (a list of `art`) and `rate` for animation: walk cycles, flames, flapping. Keep every sprite's `px` the same across a film so the pixels match.
export const Sprite: React.FC<{art?: string[]; frames?: string[][]; rate?: number; colors: Record<string, string>; px?: number; x?: number; y?: number; flip?: boolean; opacity?: number; phase?: number}> = ({art, frames, rate = 8, colors, px = 8, x = 0, y = 0, flip, opacity, phase = 0}) => {
  const t = useTime();
  const list = frames ?? (art ? [art] : [[]]);
  const rows = list[Math.floor((t + phase) * rate) % list.length];
  const width = Math.max(1, ...rows.map((r) => r.length));
  const rects: React.ReactNode[] = [];
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      let run = 1;
      while (i + run < row.length && row[i + run] === ch) run++;
      if (ch !== '.' && ch !== ' ' && colors[ch]) rects.push(<rect key={`${j}/${i}`} x={i} y={j} width={run} height={1} fill={colors[ch]} />);
      i += run;
    }
  });
  return (
    <svg width={width * px} height={rows.length * px} viewBox={`0 0 ${width} ${rows.length}`} shapeRendering="crispEdges" style={{position: 'absolute', left: x, top: y, transform: flip ? 'scaleX(-1)' : undefined, opacity, overflow: 'visible'}}>
      {rects}
    </svg>
  );
};

let boilIds = 0;

// Hand-drawn "boil": everything inside wobbles slightly, re-drawn a few times a second, as if each frame were inked by hand. Wrap whole drawings, not captions.
export const Boil: React.FC<{strength?: number; rate?: number; grain?: number; children: React.ReactNode}> = ({strength = 7, rate = 8, grain = 0.012, children}) => {
  const t = useTime();
  const id = useMemo(() => `boil${boilIds++}`, []);
  const seed = Math.floor(t * rate) % 9;
  return (
    <div style={{position: 'absolute', inset: 0, filter: `url(#${id})`}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency={grain} numOctaves={2} seed={seed + 1} />
          <feDisplacementMap in="SourceGraphic" scale={strength} />
        </filter>
      </svg>
      {children}
    </div>
  );
};

// Paper, film or sensor grain over everything: put it after the picture and before the captions. It flickers a little, like a real surface under a camera.
export const Grain: React.FC<{opacity?: number; size?: number; blend?: React.CSSProperties['mixBlendMode']; rate?: number}> = ({opacity = 0.22, size = 0.8, blend = 'multiply', rate = 0}) => {
  const t = useTime();
  const id = useMemo(() => `grain${boilIds++}`, []);
  return (
    <svg width="1080" height="1920" style={{position: 'absolute', inset: 0, opacity, mixBlendMode: blend, pointerEvents: 'none'}}>
      <filter id={id}><feTurbulence type="fractalNoise" baseFrequency={size} numOctaves={3} seed={rate ? Math.floor(t * rate) % 9 + 1 : 1} /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="1080" height="1920" filter={`url(#${id})`} />
    </svg>
  );
};

// An SVG line that draws itself between two moments: ink strokes, charts, wiring, arrows. Goes inside an <svg>.
export const Draw: React.FC<{d: string; at: number; take?: number; stroke?: string; width?: number; dash?: string; opacity?: number; fill?: string}> = ({d, at, take = 1, stroke = '#fff', width = 6, dash, opacity, fill = 'none'}) => {
  const t = useTime();
  const k = smooth(clamp01((t - at) / take));
  if (k <= 0) return null;
  if (dash) {
    const id = `draw${d.length}_${Math.round(at * 100)}`;
    return (
      <>
        <defs><mask id={id} maskUnits="userSpaceOnUse" x="-20000" y="-20000" width="40000" height="40000"><path d={d} pathLength={1} stroke="#fff" strokeWidth={width * 3} fill="none" strokeDasharray={`${k} 1`} /></mask></defs>
        <path d={d} stroke={stroke} strokeWidth={width} fill={fill} strokeDasharray={dash} strokeLinecap="butt" opacity={opacity} mask={`url(#${id})`} />
      </>
    );
  }
  return <path d={d} pathLength={1} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill={fill} strokeDasharray={`${k} 1`} opacity={opacity} />;
};

// Where something is along a list of screen points at progress k (0..1), and which way it's heading in degrees. Puts armies, ships and sprites on a line.
export function onLine(points: [number, number][], k: number): {x: number; y: number; angle: number} {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let left = clamp01(k) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] ? left / lengths[i] : 0;
      const [a, b] = [points[i], points[i + 1]];
      return {x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI};
    }
    left -= lengths[i];
  }
  return {x: points[0][0], y: points[0][1], angle: 0};
}

// A journey on a map or diagram: the line draws behind a marker that stays exactly on its end. `points` are screen pixels. Draw your own marker with `children(x, y, angle)`: an army, a ship, a sprite. Goes in an <svg> unless you pass `wrap`.
export const Route: React.FC<{points: [number, number][]; at: number; take: number; color?: string; width?: number; dash?: string; head?: number; headColor?: string; children?: (x: number, y: number, angle: number) => React.ReactNode}> = ({points, at, take, color = '#c0392b', width = 9, dash, head = 18, headColor = '#fff', children}) => {
  const t = useTime();
  const k = smooth(clamp01((t - at) / take));
  if (t < at) return null;
  const lead = onLine(points, k);
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const reached: [number, number][] = [points[0]];
  let run = 0;
  for (let i = 0; i < lengths.length && run + lengths[i] <= k * total; i++) {
    run += lengths[i];
    reached.push(points[i + 1]);
  }
  reached.push([lead.x, lead.y]);
  return (
    <>
      <path d={`M${reached.map((p) => p.join(' ')).join('L')}`} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap={dash ? 'butt' : 'round'} strokeLinejoin="round" fill="none" />
      {children ? children(lead.x, lead.y, lead.angle) : <circle cx={lead.x} cy={lead.y} r={head} fill={color} stroke={headColor} strokeWidth={head * 0.3} />}
    </>
  );
};

const topo = world as unknown as Topology;
const ALL = (feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, {name: string}>).features;

const numericOf = (code: string) => (code.length === 3 ? countries.alpha3ToNumeric(code.toUpperCase()) : countries.alpha2ToNumeric(code.toUpperCase()));

export type GeoStop = {at: number; lon: number; lat: number; span: number; tilt?: number};
export type GeoStyle = {sea?: string; land?: string; border?: string; borderWidth?: number; glow?: string; grid?: string};

// A world map with one continuous camera. `span` is how many degrees of longitude fill the frame's width: 120 for a continent, 8 for a region, 1 for a city.
// `paint` colours whole countries by ISO code, and those colours can change over time: conquest spreading, alliances forming. Children get `project(lon, lat)` in screen pixels.
export const GeoMap: React.FC<{stops: GeoStop[]; look?: GeoStyle; paint?: Record<string, string> | ((t: number) => Record<string, string>); children?: (project: (lon: number, lat: number) => [number, number]) => React.ReactNode}> = ({stops, look = {}, paint, children}) => {
  const t = useTime();
  const {sea = '#102231', land = '#27424f', border = '#5d7f8b', borderWidth = 1.4, glow, grid} = look;
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].at <= t) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const k = b.at > a.at ? smooth(clamp01((t - a.at) / (b.at - a.at))) : 0;
  const lon = a.lon + (b.lon - a.lon) * k;
  const lat = a.lat + (b.lat - a.lat) * k;
  const span = Math.exp(Math.log(a.span) + (Math.log(b.span) - Math.log(a.span)) * k);
  const projection = geoMercator().scale((1080 / ((span * Math.PI) / 180))).center([lon, lat]).translate([540, 960]).clipExtent([[-40, -40], [1120, 1960]]);
  const draw = geoPath(projection);
  const colors = typeof paint === 'function' ? paint(t) : paint ?? {};
  const byId = Object.fromEntries(Object.entries(colors).map(([code, c]) => [numericOf(code) ?? code, c]));
  const project = (x: number, y: number): [number, number] => (projection([x, y]) ?? [-999, -999]) as [number, number];
  return (
    <div style={{position: 'absolute', inset: 0, background: sea, overflow: 'hidden'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: glow ? `drop-shadow(0 0 10px ${glow})` : undefined}}>
        {grid && <path d={draw(geoGraticule10()) ?? ''} stroke={grid} strokeWidth={1} fill="none" />}
        {ALL.map((f, n) => {
          const d = draw(f);
          return d ? <path key={n} d={d} fill={byId[String(f.id)] ?? land} stroke={border} strokeWidth={borderWidth} strokeLinejoin="round" /> : null;
        })}
      </svg>
      {children?.(project)}
    </div>
  );
};

// A level that changes over time: air, money, distance, heat. `value` is 0..1, and it turns `low` under a quarter. Keep it clear of the top 150px and bottom 250px.
export const Meter: React.FC<{label: string; value: number; x?: number; y?: number; w?: number; color?: string; low?: string; font?: string; size?: number; opacity?: number}> = ({label, value, x = 90, y = 180, w = 360, color = '#f0c14b', low = '#e0483e', font, size = 30, opacity = 1}) => {
  const v = clamp01(value);
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 18, fontFamily: font, fontWeight: 800, fontSize: size, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.8)', opacity}}>
      {label}
      <div style={{width: w, height: size * 0.72, borderRadius: size, border: '3px solid rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.45)', overflow: 'hidden'}}>
        <div style={{width: `${v * 100}%`, height: '100%', background: v < 0.25 ? low : color, borderRadius: size}} />
      </div>
    </div>
  );
};
