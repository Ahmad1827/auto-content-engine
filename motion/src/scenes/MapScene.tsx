import {geoCentroid, geoGraticule10, geoMercator, geoPath} from 'd3-geo';
import type {Feature, FeatureCollection, Geometry} from 'geojson';
import countries from 'i18n-iso-countries';
import {useMemo} from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {feature} from 'topojson-client';
import type {Topology} from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';
import {flagFile} from '../flags';
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

// Viewport for the map inside the 1080x1920 frame (top half, under the kicker).
const VIEW = {x0: 40, y0: 230, x1: 1040, y1: 1000};

export const MapScene: React.FC<{visual: MapVisual; durationInFrames: number}> = ({visual, durationInFrames}) => {
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
      .fitExtent([[VIEW.x0 + 90, VIEW.y0 + 90], [VIEW.x1 - 90, VIEW.y1 - 90]], fitTo);
    const path = geoPath(projection);
    return {
      projection,
      land: ALL.map((f) => path(f) ?? '').filter(Boolean),
      focus: focus.map((f) => path(f) ?? ''),
      highlight: highlight.map((f) => path(f) ?? ''),
      graticule: path(geoGraticule10()) ?? '',
      crowded: (visual.markers ?? []).map((m, i) => {
        const p = projection([m.lon, m.lat]);
        return (visual.markers ?? []).slice(0, i).some((o) => {
          const q = projection([o.lon, o.lat]);
          return p && q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 150;
        });
      }),
      labels: placeLabels(visual, projection),
    };
  }, [visual]);

  const cx = (VIEW.x0 + VIEW.x1) / 2;
  const cy = (VIEW.y0 + VIEW.y1) / 2;
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.07]);
  const reveal = spring({frame, fps, config: {damping: 200}, durationInFrames: 20});
  const outline = interpolate(frame, [4, 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs>
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
            <path d={d} fill="none" stroke={t.accent} strokeWidth={10} opacity={Math.min(0.9, 0.55 * t.glow)} filter="url(#map-glow)"
              pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} />
            <path d={d} fill="none" stroke={t.outline} strokeWidth={3}
              pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} />
          </g>
        ))}
        {(visual.arrows ?? []).map((a, i) => (
          <Arrow key={`a${i}`} arrow={a} project={map.projection} delay={14 + i * 10} />
        ))}
        {(visual.markers ?? []).map((m, i) => (
          <Marker key={`m${i}`} marker={m} project={map.projection} delay={18 + i * 8} crowded={map.crowded[i]} />
        ))}
        {map.labels.map((l, i) => (
          <text key={`l${i}`} x={l.x} y={l.y} textAnchor={l.anchor} fill={t.text} fontFamily={t.fonts.mono} fontWeight={700}
            fontSize={LABEL_SIZE} letterSpacing={3} opacity={interpolate(frame - l.delay, [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
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
type Label = {x: number; y: number; anchor: 'start' | 'middle' | 'end'; text: string; delay: number};

function labelBox(l: Label): [number, number, number, number] {
  const w = l.text.length * (LABEL_SIZE * 0.6 + 3) + 8;
  const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
  return [x0, l.y - LABEL_SIZE, x0 + w, l.y + 8];
}

const overlaps = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

// Markers label below the dot, arrows next to their start; then each label is nudged
// up/down until it clears the labels placed before it.
function placeLabels(visual: MapVisual, project: Projection): Label[] {
  const wanted: Label[] = [];
  (visual.markers ?? []).forEach((m, i) => {
    const p = project([m.lon, m.lat]);
    if (p && m.label) wanted.push({x: p[0], y: p[1] + 52, anchor: 'middle', text: m.label.toUpperCase(), delay: 22 + i * 8});
  });
  (visual.arrows ?? []).forEach((ar, i) => {
    const a = project(ar.from);
    const b = project(ar.to);
    if (!a || !b || !ar.label) return;
    const right = a[0] >= b[0];
    wanted.push({x: a[0] + (right ? 24 : -24), y: a[1] + (a[1] >= b[1] ? 44 : -20), anchor: right ? 'start' : 'end',
      text: ar.label.toUpperCase(), delay: 24 + i * 10});
  });

  const placed: Label[] = [];
  for (const label of wanted) {
    const steps = [0, 40, -40, 80, -80, 120, -120, 160];
    const fit = steps.map((dy) => ({...label, y: label.y + dy})).find((c) => !placed.some((o) => overlaps(labelBox(c), labelBox(o))));
    placed.push(fit ?? label);
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
  const pulse = ((frame - delay) % 40) / 40;
  const flag = crowded ? undefined : flagFile(marker.flag);
  const wave = Math.sin(frame / 6) * 4;

  return (
    <g opacity={Math.min(1, pop * 1.5)}>
      <circle cx={x} cy={y} r={10 + pulse * 34} fill="none" stroke={t.accent} strokeWidth={3} opacity={(1 - pulse) * pop} />
      <circle cx={x} cy={y} r={9 * pop} fill={t.accent} />
      {flag && (
        <g transform={`translate(${x} ${y}) scale(${pop})`}>
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
  const angle = (Math.atan2(b[1] - my, b[0] - mx) * 180) / Math.PI;

  return (
    <g>
      <path d={`M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`} fill="none" stroke={t.accent} strokeWidth={7} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} style={{filter: `drop-shadow(0 0 ${8 * t.glow}px ${t.accent})`}} />
      <polygon points="0,-16 30,0 0,16" fill={t.accent} transform={`translate(${b[0]} ${b[1]}) rotate(${angle})`} opacity={p >= 1 ? 1 : 0} />
    </g>
  );
};
