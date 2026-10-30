import {useCurrentFrame} from 'remotion';
import {CastView} from '../cast/CastView';
import {stagePositions} from '../cast/poses';
import {Fit} from '../components/Fit';
import {ramp, rnd} from '../fx';
import {STAGE, useTheme} from '../theme';
import type {Person, Setting, Visual} from '../types';

// Where the top of a person's head reaches, so tags float above it instead of across the face.
const HEAD_TOP: Record<string, {flat: number; depth: number; flatLow: number; depthLow: number}> = {
  default: {flat: 672, depth: 610, flatLow: 968, depthLow: 853},
  low: {flat: 790, depth: 745, flatLow: 1072, depthLow: 977},
  lying: {flat: 1020, depth: 930, flatLow: 1275, depthLow: 1146},
};
const headTop = (pose: string, depth: boolean, low: boolean) => {
  const key = pose === 'sit' || pose === 'kneel' ? 'low' : pose === 'sleep' ? 'lying' : 'default';
  const row = HEAD_TOP[key];
  return depth ? (low ? row.depthLow : row.depth) : low ? row.flatLow : row.flat;
};
const TAG_HEIGHT = 56;
const TAG_WIDTH = 300;

// Where each person's name tag goes. Neighbours whose tags would touch alternate between two rows.
export function placeTags(people: Person[], depth: boolean, low: boolean) {
  const xs = stagePositions(people);
  const place = people.map((p, i) => ({x: 540 + xs[i] * (depth ? 400 : 324), top: headTop(p.pose, depth, low) - TAG_HEIGHT - 16, label: p.label, i}));
  const sorted = place.filter((p) => p.label).sort((a, b) => a.x - b.x);
  sorted.forEach((p, k) => {
    const prev = sorted[k - 1];
    if (prev && p.x - prev.x < TAG_WIDTH && Math.abs(p.top - prev.top) < TAG_HEIGHT) p.top = prev.top - TAG_HEIGHT - 8;
  });
  return sorted;
}

// What drifts through the air of each set, drawn over the people for depth.
const AIR: Partial<Record<Setting, {color: string; count: number; rise: number; wind: number; size: number}>> = {
  desert: {color: '#f6d9a0', count: 34, rise: 0.05, wind: 3.4, size: 3},
  night: {color: '#fff2a0', count: 18, rise: 0.25, wind: 0.2, size: 4},
  battlefield: {color: '#ff9a4a', count: 34, rise: 1.5, wind: 0.8, size: 4},
  field: {color: '#fff7c8', count: 22, rise: 0.3, wind: 0.5, size: 3},
  mosque: {color: '#fff0c8', count: 20, rise: 0.25, wind: 0.1, size: 3},
  bedroom: {color: '#fff0c8', count: 14, rise: 0.15, wind: 0.1, size: 3},
  street: {color: '#ffffff', count: 14, rise: 0.1, wind: 1.1, size: 2.5},
  house: {color: '#fff0c8', count: 12, rise: 0.15, wind: 0.1, size: 3},
  office: {color: '#ffffff', count: 10, rise: 0.12, wind: 0.1, size: 2.5},
  classroom: {color: '#fff0c8', count: 12, rise: 0.15, wind: 0.1, size: 3},
};

const Air: React.FC<{setting: Setting}> = ({setting}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const air = AIR[setting];
  if (!air) return null;
  const crisp = t.render === 'pixel';
  const span = 1400;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} shapeRendering={crisp ? 'crispEdges' : undefined}>
      <g fill={air.color}>
        {Array.from({length: air.count}, (_, i) => {
          const y = 240 + (span - (frame * air.rise * (0.5 + rnd(i, 1)) + rnd(i, 2) * span) % span);
          const x = ((rnd(i, 3) * 1180 + frame * air.wind * (0.5 + rnd(i, 4))) % 1180) - 50 + Math.sin(frame / 25 + i) * 10;
          const size = air.size * (0.6 + rnd(i, 5));
          const o = 0.2 + Math.abs(Math.sin(frame / 18 + i)) * 0.55;
          return crisp ? <rect key={i} x={Math.floor(x / 6) * 6} y={Math.floor(y / 6) * 6} width={6} height={6} opacity={o} /> : <circle key={i} cx={x} cy={y} r={size} opacity={o} />;
        })}
      </g>
    </svg>
  );
};

// Full-frame scene with people in a set; the headline (if any) sits at the top instead of the bottom.
export const CastScene: React.FC<{visual: Extract<Visual, {type: 'cast'}>; labelTop: number; low?: boolean}> = ({visual, labelTop, low = false}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const people = visual.people.slice(0, 4);
  const sorted = placeTags(people, t.render === '3d', low);
  return (
    <>
      <div style={{position: 'absolute', inset: 0}}>
        <CastView cast={visual} W={1080} H={1920} mode={low ? 'low' : 'stage'} />
      </div>
      <Air setting={visual.setting} />
      {/* Darkens the top of bright sets so the kicker and headline stay readable. */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: low ? 1000 : 700, background: `linear-gradient(180deg, ${t.bg}d0 0%, ${t.bg}80 45%, transparent 100%)`}} />
      {sorted.map((p) => {
        const s = ramp(frame, 14 + p.i * 5, 22 + p.i * 5);
        return (
          <div key={p.i} style={{position: 'absolute', top: p.top + (1 - s) * 16 + Math.sin(frame / 16 + p.i) * 3, left: Math.max(STAGE.left, Math.min(1008 - TAG_WIDTH, p.x - TAG_WIDTH / 2)), width: TAG_WIDTH, display: 'flex', justifyContent: 'center', opacity: s}}>
            <div style={{padding: '6px 16px', fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 4, lineHeight: 1.3, textTransform: 'uppercase', color: t.text, background: t.decor === 'ornate' || t.decor === 'press' ? t.bg : 'rgba(0,0,0,0.72)', border: `2px solid ${t.accent}`, borderRadius: t.render === 'pixel' ? 0 : 6}}>
              <Fit size={26} max={TAG_WIDTH - 40}>{p.label}</Fit>
            </div>
          </div>
        );
      })}
      {visual.label && (
        <div style={{position: 'absolute', top: labelTop, left: STAGE.left, right: STAGE.right, display: 'flex', justifyContent: t.align === 'center' ? 'center' : 'flex-start', opacity: ramp(frame, 6, 14)}}>
          <div style={{padding: '6px 14px', background: t.decor === 'ornate' || t.decor === 'press' ? t.bg : 'rgba(0,0,0,0.6)', fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 5, lineHeight: 1.3, color: t.text, textTransform: 'uppercase'}}>
            <Fit size={26} max={860}>{visual.label}</Fit>
          </div>
        </div>
      )}
    </>
  );
};
