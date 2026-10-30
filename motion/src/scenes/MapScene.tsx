import {geoCentroid, geoGraticule10, geoMercator, geoPath} from 'd3-geo';
import type {Feature, FeatureCollection, Geometry} from 'geojson';
import countries from 'i18n-iso-countries';
import {useMemo} from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {feature} from 'topojson-client';
import type {Topology} from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';
import {flagFile} from '../flags';
import {easeOut, ramp} from '../fx';
import {useTheme} from '../theme';
import type {MapArrow, MapMarker, Visual} from '../types';

type MapVisual = Extract<Visual, {type: 'map'}>;

const topo = world as unknown as Topology;
const ALL = (feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, {name: string}>).features;

// Accepts ISO alpha-3 ("TUR"), alpha-2 ("TR") or a plain country name.
function findCountry(code: string): Feature<Geometry, {name: string}> | undefined {
  const c = code.trim();
  const numeric = c.length === 3 ? countries.alpha3ToNumeric(c.toUpperCase()) : c.length === 2 ? countries.alpha2ToNumeric(c.toUpperCase()) : undefined;
  return ALL.find((f) => (numeric && String(f.id) === numeric) || f.properties.name.toLowerCase() === c.toLowerCase());
}

// Frames a local story (a pass, a city) instead of the whole country; at least ~2 degrees across.
function regionBox(points: number[][]): FeatureCollection {
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const pad = (lo: number, hi: number) => Math.max(0.5, (2 - (hi - lo)) / 2);
  const [w, e] = [Math.min(...lons), Math.max(...lons)];
  const [s, n] = [Math.min(...lats), Math.max(...lats)];
  const px = pad(w, e);
  const py = pad(s, n) * 0.8;
  return {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'MultiPoint', coordinates: [[w - px, s - py], [e + px, n + py]]}}]};
}

// Viewport for the map inside the 1080x1920 frame: the top half when a headline shares the scene, otherwise the whole stage.
const VIEW_COMPACT = {x0: 40, y0: 230, x1: 1040, y1: 1000};
const VIEW_FULL = {x0: 40, y0: 230, x1: 1040, y1: 1380};
// Room above the fitted country for a flag on its pole, and below for a label.
const ROOM = {top: 160, bottom: 80, side: 90};

export const MapScene: React.FC<{visual: MapVisual; durationInFrames: number; compact?: boolean}> = ({visual, durationInFrames, compact}) => {
  const VIEW = compact ? VIEW_COMPACT : VIEW_FULL;
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const map = useMemo(() => {
    const focus = visual.focus.map(findCountry).filter(Boolean) as Feature<Geometry, {name: string}>[];
    const highlight = (visual.highlight ?? []).map(findCountry).filter(Boolean) as Feature<Geometry, {name: string}>[];
    const countryFit: FeatureCollection = {type: 'FeatureCollection', features: focus.length ? focus : ALL};
    const points = [...(visual.markers ?? []).map((m) => [m.lon, m.lat]), ...(visual.arrows ?? []).flatMap((a) => [a.from, a.to])];
    const fitTo = visual.zoom === 'region' && points.length ? regionBox(points) : countryFit;
    const [lon] = geoCentroid(fitTo);
    const projection = geoMercator()
      .rotate([-lon, 0])
      .fitExtent([[VIEW.x0 + ROOM.side, VIEW.y0 + ROOM.top], [VIEW.x1 - ROOM.side, VIEW.y1 - ROOM.bottom]], fitTo);
    const path = geoPath(projection);
    const crowded = (visual.markers ?? []).map((m, i) => {
      const p = projection([m.lon, m.lat]);
      return (visual.markers ?? []).slice(0, i).some((o) => {
        const q = projection([o.lon, o.lat]);
        return Boolean(p && q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 150);
      });
    });
    return {
      projection,
      land: ALL.map((f) => path(f) ?? '').filter(Boolean),
      focus: focus.map((f) => path(f) ?? ''),
      highlight: highlight.map((f) => path(f) ?? ''),
      graticule: path(geoGraticule10()) ?? '',
      crowded,
      center: focus.length ? projection(geoCentroid(countryFit)) : null,
      labels: placeLabels(visual, projection, t.language, crowded),
    };
  }, [visual, compact]);

  const cx = (VIEW.x0 + VIEW.x1) / 2;
  const cy = (VIEW.y0 + VIEW.y1) / 2;
  // The camera dives in from further out, then keeps creeping closer.
  const dive = easeOut(ramp(frame, 0, 26));
  const zoom = (0.72 + dive * 0.28) * interpolate(frame, [0, durationInFrames], [1, 1.07]);
  const reveal = spring({frame, fps, config: {damping: 200}, durationInFrames: 20});
  const outline = interpolate(frame, [4, 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const crisp = t.render === 'pixel';
  const hatched = t.decor === 'press' || t.decor === 'ornate' || t.decor === 'sketch';
  const scanY = VIEW.y0 + ((frame * 7) % (VIEW.y1 - VIEW.y0 + 300)) - 150;

  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering={crisp ? 'crispEdges' : undefined}>
      <defs>
        <pattern id="map-hatch" width={18} height={18} patternUnits="userSpaceOnUse" patternTransform={`rotate(45) translate(${frame * 0.5} 0)`}>
          <line x1={0} y1={0} x2={0} y2={18} stroke={t.outline} strokeWidth={2.5} opacity={0.3} />
        </pattern>
        {/* The other styles get a fine survey grid, so a close zoom is never one flat colour. */}
        <pattern id="map-dots" width={36} height={36} patternUnits="userSpaceOnUse" patternTransform={`translate(${frame * 0.3} ${frame * 0.15})`}>
          <rect x={17} y={17} width={3} height={3} fill={t.outline} opacity={0.45} />
        </pattern>
        <clipPath id="map-focus">{map.focus.map((d, i) => <path key={i} d={d} />)}</clipPath>
        <linearGradient id="map-scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.outline} stopOpacity="0" />
          <stop offset="0.5" stopColor={t.outline} stopOpacity="0.14" />
          <stop offset="1" stopColor={t.outline} stopOpacity="0" />
        </linearGradient>
        <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="map-fade" cx="50%" cy="50%" r="60%">
          <stop offset="60%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id="map-mask">
          <rect x={0} y={0} width={1080} height={1920} fill="url(#map-fade)" />
        </mask>
        {/* Close zooms make land spill far outside the map area; keep it out of the kicker and text zones. */}
        <linearGradient id="map-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="black" />
          <stop offset="0.06" stopColor="white" />
          <stop offset="0.9" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id="map-clip">
          <rect x={0} y={VIEW.y0 - 20} width={1080} height={VIEW.y1 - VIEW.y0 + 120} fill="url(#map-edge)" />
        </mask>
      </defs>
      <g mask="url(#map-clip)">
      <g transform={`translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`} mask="url(#map-mask)" opacity={reveal}>
        <path d={map.graticule} fill="none" stroke={t.border} strokeWidth={1} opacity={0.5} />
        {map.land.map((d, i) => (
          <path key={i} d={d} fill={t.land} stroke={t.border} strokeWidth={1.2} />
        ))}
        {map.highlight.map((d, i) => (
          <path key={`h${i}`} d={d} fill={t.accent} fillOpacity={0.22 * outline} stroke={t.accent} strokeWidth={2} strokeOpacity={outline} />
        ))}
        {map.focus.map((d, i) => (
          <g key={`f${i}`}>
            <path d={d} fill={t.landFocus} />
            <path d={d} fill={hatched ? 'url(#map-hatch)' : 'url(#map-dots)'} opacity={outline} />
            <path d={d} fill="none" stroke={t.accent} strokeWidth={10} opacity={Math.min(0.9, 0.55 * t.glow)} filter="url(#map-glow)"
              pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} />
            <path d={d} fill="none" stroke={t.outline} strokeWidth={3}
              pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} />
          </g>
        ))}
        {/* A band of light scans down the focus country, and sonar rings spread from its middle. */}
        {!hatched && map.focus.length > 0 && <rect x={0} y={scanY - 110} width={1080} height={260} fill="url(#map-scan)" clipPath="url(#map-focus)" opacity={outline} />}
        {map.center && [0, 1, 2].map((i) => {
          const q = ((frame + i * 26) % 78) / 78;
          return <circle key={`s${i}`} cx={map.center![0]} cy={map.center![1]} r={30 + q * 330} fill="none" stroke={t.accent} strokeWidth={3} opacity={(1 - q) * 0.4 * outline} />;
        })}
        {(visual.arrows ?? []).map((a, i) => (
          <Arrow key={`a${i}`} arrow={a} project={map.projection} delay={14 + i * 10} />
        ))}
        {(visual.markers ?? []).map((m, i) => (
          <Marker key={`m${i}`} marker={m} project={map.projection} delay={18 + i * 8} crowded={map.crowded[i]} />
        ))}
        {map.labels.map((l, i) => (
          <text key={`l${i}`} x={l.x} y={l.y} textAnchor={l.anchor} direction="ltr" fill={t.text} fontFamily={t.fonts.mono} fontWeight={700}
            fontSize={l.size} letterSpacing={3} opacity={interpolate(frame - l.delay, [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
            style={{paintOrder: 'stroke', stroke: t.bg, strokeWidth: 8}}>
            {l.text}
          </text>
        ))}
      </g>
      </g>
    </svg>
  );
};

type Projection = ReturnType<typeof geoMercator>;

const LABEL_SIZE = 28;
// Widest a map label may run, and a safe guess at a mono letter's width in em (the pixel font is wide).
const LABEL_MAX = 760;
const LABEL_EM = 0.74;
type Label = {x: number; y: number; size: number; anchor: 'start' | 'middle' | 'end'; text: string; delay: number};
const labelSize = (text: string) => Math.min(LABEL_SIZE, LABEL_MAX / (text.length * (LABEL_EM + 0.11)));

function labelBox(l: Label): [number, number, number, number] {
  const w = l.text.length * l.size * (LABEL_EM + 0.11) + 8;
  const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
  return [x0, l.y - l.size, x0 + w, l.y + 8];
}

const overlaps = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

// Markers label below the dot, arrows next to their start; then each label is nudged
// up/down until it clears the labels placed before it.
function placeLabels(visual: MapVisual, project: Projection, language: string, crowded: boolean[]): Label[] {
  const wanted: Label[] = [];
  (visual.markers ?? []).forEach((m, i) => {
    const p = project([m.lon, m.lat]);
    if (p && m.label) {
      const text = m.label.toLocaleUpperCase(language);
      wanted.push({x: p[0], y: p[1] + 52, size: labelSize(text), anchor: 'middle', text, delay: 22 + i * 8});
    }
  });
  (visual.arrows ?? []).forEach((ar, i) => {
    const a = project(ar.from);
    const b = project(ar.to);
    if (!a || !b || !ar.label) return;
    const right = a[0] >= b[0];
    const text = ar.label.toLocaleUpperCase(language);
    wanted.push({x: a[0] + (right ? 24 : -24), y: a[1] + (a[1] >= b[1] ? 44 : -20), size: labelSize(text), anchor: right ? 'start' : 'end', text, delay: 24 + i * 10});
  });

  // Flags stand on their markers, so labels must stay off them too.
  const flags = (visual.markers ?? []).flatMap((m, i) => {
    const p = project([m.lon, m.lat]);
    return p && m.flag && !crowded[i] ? [[p[0] - 6, p[1] - 130, p[0] + 124, p[1] + 14]] : [];
  });
  const placed: Label[] = [];
  for (const label of wanted) {
    // Pull labels back from the frame's edges.
    const w = labelBox(label)[2] - labelBox(label)[0];
    const x0 = labelBox(label)[0];
    const x = label.x + Math.max(0, 80 - x0) - Math.max(0, x0 + w - 1000);
    const steps = [0, 40, -40, 80, -80, 120, -120, 160, -160, 200];
    const fit = steps.map((dy) => ({...label, x, y: label.y + dy})).find((c) => !placed.some((o) => overlaps(labelBox(c), labelBox(o))) && !flags.some((f) => overlaps(labelBox(c), f)));
    placed.push(fit ?? {...label, x});
  }
  return placed;
}

// A crowded marker sits close to an earlier one: it skips the flag so poles don't stack.
const Marker: React.FC<{marker: MapMarker; project: Projection; delay: number; crowded?: boolean}> = ({marker, project, delay, crowded}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const point = project([marker.lon, marker.lat]);
  if (!point) return null;
  const [x, y] = point;
  const pop = spring({frame: frame - delay, fps, config: {damping: 11, stiffness: 170}});
  const pulse = (Math.max(0, frame - delay) % 40) / 40;
  const flag = crowded ? undefined : flagFile(marker.flag);
  const wave = Math.sin(frame / 6) * 4;

  return (
    <g opacity={Math.min(1, pop * 1.5)}>
      <circle cx={x} cy={y} r={10 + pulse * 34} fill="none" stroke={t.accent} strokeWidth={3} opacity={(1 - pulse) * pop} />
      <circle cx={x} cy={y} r={10 + ((pulse + 0.5) % 1) * 34} fill="none" stroke={t.accent} strokeWidth={2} opacity={(1 - (pulse + 0.5) % 1) * pop * 0.7} />
      <circle cx={x} cy={y} r={9 * pop} fill={t.accent} />
      {flag && (
        <g transform={`translate(${x} ${y - (1 - pop) * 90}) scale(${pop})`}>
          <line x1={0} y1={0} x2={0} y2={-120} stroke="#d9d4c7" strokeWidth={4} />
          <g transform={`skewY(${wave * 0.6})`}>
            <foreignObject x={2} y={-122} width={112} height={84}>
              <Img src={flag} style={{width: 112, height: 84, display: 'block', boxShadow: '0 6px 16px rgba(0,0,0,0.6)'}} />
            </foreignObject>
          </g>
        </g>
      )}
    </g>
  );
};

const Arrow: React.FC<{arrow: MapArrow; project: Projection; delay: number}> = ({arrow, project, delay}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const a = project(arrow.from);
  const b = project(arrow.to);
  if (!a || !b) return null;
  const p = interpolate(frame - delay, [0, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Bend the arrow sideways so it reads as a campaign route, not a ruler line.
  const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * 0.25;
  const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.25;
  const at = (q: number): [number, number] => [
    (1 - q) * (1 - q) * a[0] + 2 * (1 - q) * q * mx + q * q * b[0],
    (1 - q) * (1 - q) * a[1] + 2 * (1 - q) * q * my + q * q * b[1],
  ];
  // The head rides the tip of the line as it draws, then a spark keeps running along the route.
  const q = easeOut(p);
  const tip = at(q);
  const before = at(Math.max(0, q - 0.02));
  const angle = (Math.atan2(tip[1] - before[1], tip[0] - before[0]) * 180) / Math.PI;
  const spark = (Math.max(0, frame - delay) % 40) / 40;
  const sparkAt = at(spark);

  return (
    <g>
      <path d={`M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`} fill="none" stroke={t.accent} strokeWidth={7} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - q} style={{filter: `drop-shadow(0 0 ${8 * t.glow}px ${t.accent})`}} />
      {p >= 1 && <circle cx={sparkAt[0]} cy={sparkAt[1]} r={8} fill={t.onAccent} stroke={t.accent} strokeWidth={3} />}
      <polygon points="-6,-18 30,0 -6,18" fill={t.accent} transform={`translate(${tip[0]} ${tip[1]}) rotate(${angle})`} opacity={p > 0 ? 1 : 0} />
    </g>
  );
};
