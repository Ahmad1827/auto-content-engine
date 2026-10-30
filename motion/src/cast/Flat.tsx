import type {Theme} from '../theme';
import type {Cast, Person, Prop, Setting} from '../types';
import {type Colors, colorsFor, SET_COLORS, shade, toner} from './palette';
import {type Rig, rig, stagePositions} from './poses';

// Flat cartoon people and sets, drawn as plain SVG from props only (no hooks), so the pixel renderer can
// serialise the same markup and rasterise it at low resolution.

// Body measurements in world units; the origin is between the feet and y grows downward.
const B = {thigh: 80, shin: 76, legW: 34, hipX: 21, hipY: -156, shoulderY: -282, shoulderX: 52, upper: 64, fore: 58, armW: 26, hand: 14, neck: -298, headY: -348, headRx: 46, headRy: 50};
export const FIGURE_HEIGHT = 400;

type Held = 'phone' | 'book' | 'sword';

export type Layout = {k: number; feetY: number; spread: number};
export type CastMode = 'stage' | 'low' | 'panel';

// Where the stage sits inside a W x H box: full-frame scenes vs. small panels.
export function layoutFor(W: number, H: number, mode: CastMode): Layout {
  // `low` is a full-frame scene with the people further down and smaller, under a headline.
  if (mode === 'low') return {k: (0.3 * H) / FIGURE_HEIGHT, feetY: 0.83 * H, spread: 0.3 * W};
  return mode === 'stage'
    ? {k: (0.34 * H) / FIGURE_HEIGHT, feetY: 0.72 * H, spread: 0.3 * W}
    : {k: (0.7 * H) / FIGURE_HEIGHT, feetY: 0.88 * H, spread: 0.34 * W};
}

// Gives handheld props to whoever's pose suits them best.
function holders(people: Person[], props: Prop[] = []): (Held | undefined)[] {
  const held: (Held | undefined)[] = people.map(() => undefined);
  const give = (item: Held, poses: string[]) => {
    if (!props.includes(item)) return;
    const i = Math.max(0, people.findIndex((p, j) => poses.includes(p.pose) && !held[j]));
    if (people[i]) held[i] = item;
  };
  give('phone', ['phone']);
  give('sword', ['fight', 'point', 'cheer']);
  give('book', ['sit', 'stand', 'think', 'pray']);
  return held;
}

export const FlatScene: React.FC<{cast: Cast; t: Theme; time: number; W: number; H: number; mode: CastMode; enter: number[]; crisp?: boolean}> = ({cast, t, time, W, H, mode, enter, crisp}) => {
  const L = layoutFor(W, H, mode);
  const xs = stagePositions(cast.people);
  const held = holders(cast.people, cast.props);
  const view = {halfW: W / 2 / L.k, top: -L.feetY / L.k, bottom: (H - L.feetY) / L.k};
  const sleepers = cast.people.map((p, i) => (p.pose === 'sleep' ? (xs[i] * L.spread) / L.k : null)).filter((x): x is number => x !== null);
  const outline = t.castOutline ?? t.line;
  const personTone = toner(t.bg, t.setTone * 0.3, t.setMono);
  const tint = (c: Colors): Colors => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, personTone(v)])) as Colors;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" shapeRendering={crisp ? 'crispEdges' : undefined}>
      {/* Pixel art: hard one-pixel outlines whatever the zoom, and no anti-aliasing. */}
      {crisp && <style>{'* { vector-effect: non-scaling-stroke; stroke-width: 1px; }'}</style>}
      <g transform={`translate(${W / 2} ${L.feetY}) scale(${L.k})`} strokeLinejoin="round" strokeLinecap="round">
        <FlatSet setting={cast.setting} props={cast.props ?? []} t={t} time={time} view={view} sleepers={sleepers} people={cast.people} xs={xs.map((x) => (x * L.spread) / L.k)} />
        {cast.people.map((p, i) => {
          const e = enter[i] ?? 1;
          return (
            <g key={i} transform={`translate(${(xs[i] * L.spread) / L.k} ${(1 - e) * 60}) scale(${0.85 + 0.15 * e})`} opacity={Math.min(1, e * 1.4)}>
              <Figure person={p} colors={tint(colorsFor(p, i))} pose={rig(p.pose, time, i * 0.83, xs[i])} outline={outline} held={held[i]} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

// ---------- People ----------

const Limb: React.FC<{len: number; w: number; fill: string; outline: string}> = ({len, w, fill, outline}) => (
  <rect x={-w / 2} y={-w / 2} width={w} height={len + w} rx={w / 2} fill={fill} stroke={outline} strokeWidth={5} />
);

const Figure: React.FC<{person: Person; colors: Colors; pose: Rig; outline: string; held?: Held}> = ({person, colors: c, pose, outline, held}) => {
  const outfit = person.outfit ?? 'casual';
  const longSleeve = outfit !== 'casual' && outfit !== 'dress';
  const sleeve = outfit === 'armor' ? shade(c.metal, -0.35) : c.top;
  const lift = pose.bob * FIGURE_HEIGHT;
  const seated = pose.mode === 'sit' || pose.mode === 'kneel';
  const drop = seated ? 56 : 0;
  const long = outfit === 'robe' || outfit === 'dress';

  const arm = (side: 1 | -1, [upper, lower]: [number, number], hand?: Held) => (
    <g transform={`translate(${side * B.shoulderX} ${B.shoulderY + 8}) rotate(${-side * upper})`}>
      <Limb len={B.upper} w={B.armW + (outfit === 'robe' ? 6 : 0)} fill={sleeve} outline={outline} />
      <g transform={`translate(0 ${B.upper}) rotate(${side * lower})`}>
        <Limb len={B.fore} w={B.armW - 2} fill={longSleeve ? sleeve : c.skin} outline={outline} />
        {hand && <HeldItem item={hand} />}
        <circle cx={0} cy={B.fore + 4} r={B.hand} fill={c.skin} stroke={outline} strokeWidth={5} />
      </g>
      {outfit === 'armor' && <circle cx={0} cy={4} r={20} fill={c.metal} stroke={outline} strokeWidth={5} />}
    </g>
  );

  const leg = (side: 1 | -1, [upper, lower]: [number, number]) => {
    const thigh = pose.mode === 'sit' ? 26 : B.thigh;
    const shin = pose.mode === 'kneel' ? 18 : B.shin * Math.cos((lower * Math.PI) / 180);
    return (
      <g transform={`translate(${side * B.hipX} ${B.hipY + drop}) rotate(${-side * upper})`}>
        <Limb len={thigh} w={B.legW + (pose.mode === 'sit' ? 8 : 0)} fill={c.bottom} outline={outline} />
        <g transform={`translate(0 ${thigh})`}>
          <Limb len={shin} w={B.legW - 2} fill={c.bottom} outline={outline} />
          {pose.mode !== 'kneel' && <ellipse cx={side * 6} cy={shin + 14} rx={24} ry={13} fill={c.shoe} stroke={outline} strokeWidth={5} />}
        </g>
      </g>
    );
  };

  const body = (
    <g>
      {pose.mode === 'lie' ? null : <ellipse cx={0} cy={6} rx={78} ry={13} fill="#000" opacity={0.28} stroke="none" />}
      {!long || outfit === 'dress' ? (
        <>
          {leg(1, pose.legA)}
          {leg(-1, pose.legB)}
        </>
      ) : (
        <>
          <ellipse cx={-20} cy={-6} rx={24} ry={13} fill={c.shoe} stroke={outline} strokeWidth={5} />
          <ellipse cx={20} cy={-6} rx={24} ry={13} fill={c.shoe} stroke={outline} strokeWidth={5} />
        </>
      )}
      <g transform={`translate(0 ${drop - lift}) rotate(${pose.tilt} 0 ${B.hipY})`}>
        <Torso outfit={outfit} c={c} outline={outline} seated={seated} />
        <g transform={`rotate(${pose.head * 0.5} 0 ${B.neck})`}>
          <Head person={person} c={c} outline={outline} asleep={pose.mode === 'lie'} />
        </g>
        {arm(1, pose.a, held === 'book' ? 'book' : undefined)}
        {arm(-1, pose.b, held && held !== 'book' ? held : undefined)}
      </g>
    </g>
  );

  // Sleepers lie on their back across the bed, head to the left.
  if (pose.mode === 'lie') return <g transform="translate(170 -112) rotate(-90)">{body}</g>;
  return body;
};

const Torso: React.FC<{outfit: string; c: Colors; outline: string; seated: boolean}> = ({outfit, c, outline, seated}) => {
  const top = B.shoulderY;
  const waist = B.hipY + 8;
  const shirt = `M${-B.shoulderX - 6},${top + 18} Q${-B.shoulderX},${top} ${-30},${top - 4} L30,${top - 4} Q${B.shoulderX},${top} ${B.shoulderX + 6},${top + 18} L48,${waist} Q0,${waist + 10} -48,${waist} Z`;
  const fill = outfit === 'armor' ? c.metal : c.top;
  const hem = seated ? -70 : -14;
  return (
    <g stroke={outline} strokeWidth={5}>
      {outfit === 'robe' && <path d={`M-48,${waist - 6} L-74,${hem} Q0,${hem + 16} 74,${hem} L48,${waist - 6} Z`} fill={c.top} />}
      {outfit === 'dress' && <path d={`M-46,${waist - 6} L-82,${seated ? -64 : -66} Q0,${seated ? -48 : -50} 82,${seated ? -64 : -66} L46,${waist - 6} Z`} fill={c.top} />}
      <path d={shirt} fill={fill} />
      {outfit === 'suit' && (
        <>
          <path d={`M-22,${top - 2} L0,${top + 62} L22,${top - 2} Z`} fill="#f1ede4" />
          <path d={`M-6,${top + 8} L6,${top + 8} L4,${top + 70} L0,${top + 78} L-4,${top + 70} Z`} fill="#a83a32" />
          <path d={`M-30,${top - 2} L-8,${top + 70} M30,${top - 2} L8,${top + 70}`} fill="none" />
        </>
      )}
      {outfit === 'armor' && (
        <>
          <path d={`M-40,${top + 50} Q0,${top + 64} 40,${top + 50} M-42,${top + 84} Q0,${top + 98} 42,${top + 84}`} fill="none" />
          <path d={`M-48,${waist - 4} L48,${waist - 4}`} strokeWidth={9} stroke={shade(c.metal, -0.4)} />
        </>
      )}
      {outfit === 'uniform' && (
        <>
          <rect x={-48} y={waist - 22} width={96} height={14} fill="#3a2e22" />
          {[30, 60, 90].map((y) => <circle key={y} cx={0} cy={top + y} r={4} fill={c.gold} strokeWidth={2} />)}
        </>
      )}
      {outfit === 'robe' && <rect x={-48} y={waist - 18} width={96} height={12} fill={shade(c.top, -0.3)} />}
      {outfit === 'casual' && <path d={`M-16,${top - 4} Q0,${top + 14} 16,${top - 4}`} fill="none" strokeWidth={4} />}
    </g>
  );
};

const Head: React.FC<{person: Person; c: Colors; outline: string; asleep: boolean}> = ({person, c, outline, asleep}) => {
  const y = B.headY;
  const hair = person.hair ?? 'short';
  const mood = person.mood ?? 'happy';
  const hairC = c.hair;
  const eyeY = y + 2;
  return (
    <g stroke={outline} strokeWidth={5}>
      <rect x={-12} y={B.neck - 6} width={24} height={22} fill={shade(c.skin, -0.12)} />
      <HairBack hair={hair} color={hairC} y={y} />
      <circle cx={-B.headRx + 2} cy={y + 6} r={10} fill={c.skin} />
      <circle cx={B.headRx - 2} cy={y + 6} r={10} fill={c.skin} />
      <ellipse cx={0} cy={y} rx={B.headRx} ry={B.headRy} fill={c.skin} />
      {person.beard && <path d={`M${-B.headRx + 4},${y + 4} Q${-B.headRx + 6},${y + 58} 0,${y + 60} Q${B.headRx - 6},${y + 58} ${B.headRx - 4},${y + 4} Q20,${y + 30} 0,${y + 28} Q-20,${y + 30} ${-B.headRx + 4},${y + 4} Z`} fill={hairC} />}
      <g stroke="none">
        {asleep ? (
          <path d={`M-24,${eyeY} q8,7 16,0 M8,${eyeY} q8,7 16,0`} fill="none" stroke="#2a1c14" strokeWidth={4} />
        ) : mood === 'surprised' ? (
          <>
            <circle cx={-16} cy={eyeY} r={8} fill="#2a1c14" />
            <circle cx={16} cy={eyeY} r={8} fill="#2a1c14" />
          </>
        ) : (
          <>
            <ellipse cx={-16} cy={eyeY} rx={5.5} ry={7} fill="#2a1c14" />
            <ellipse cx={16} cy={eyeY} rx={5.5} ry={7} fill="#2a1c14" />
            <circle cx={-14} cy={eyeY - 3} r={2} fill="#fff" />
            <circle cx={18} cy={eyeY - 3} r={2} fill="#fff" />
          </>
        )}
        {mood === 'angry' && <path d={`M-28,${y - 16} L-8,${y - 10} M28,${y - 16} L8,${y - 10}`} stroke="#2a1c14" strokeWidth={5} />}
        {mood === 'sad' && <path d={`M-26,${y - 10} L-8,${y - 16} M26,${y - 10} L8,${y - 16}`} stroke="#2a1c14" strokeWidth={4} />}
        <circle cx={-27} cy={y + 18} r={8} fill="#e0707a" opacity={0.35} />
        <circle cx={27} cy={y + 18} r={8} fill="#e0707a" opacity={0.35} />
        <path d={`M-3,${y + 12} q3,5 7,0`} fill="none" stroke={shade(c.skin, -0.35)} strokeWidth={3} />
        {mood === 'happy' && !asleep && <path d={`M-13,${y + 26} Q0,${y + 38} 13,${y + 26}`} fill="none" stroke="#2a1c14" strokeWidth={4} />}
        {(mood === 'neutral' || asleep) && <path d={`M-9,${y + 30} L9,${y + 30}`} stroke="#2a1c14" strokeWidth={4} />}
        {(mood === 'sad' || mood === 'angry') && !asleep && <path d={`M-12,${y + 34} Q0,${y + 24} 12,${y + 34}`} fill="none" stroke="#2a1c14" strokeWidth={4} />}
        {mood === 'surprised' && !asleep && <ellipse cx={0} cy={y + 31} rx={7} ry={9} fill="#2a1c14" />}
      </g>
      <HairFront hair={hair} color={hairC} y={y} c={c} />
    </g>
  );
};

const HairBack: React.FC<{hair: string; color: string; y: number}> = ({hair, color, y}) => {
  if (hair === 'long') return <path d={`M-52,${y - 10} Q-58,${y + 70} -44,${y + 92} L44,${y + 92} Q58,${y + 70} 52,${y - 10} Z`} fill={color} />;
  if (hair === 'hijab') return <path d={`M-60,${y} Q-66,${y + 80} -62,${y + 110} L62,${y + 110} Q66,${y + 80} 60,${y} Q60,${y - 66} 0,${y - 66} Q-60,${y - 66} -60,${y} Z`} fill={color === '#e8e4dc' ? '#d8d2c6' : '#3d4a6b'} />;
  if (hair === 'curly') return <g fill={color}>{[-44, -22, 0, 22, 44].map((x, i) => <circle key={i} cx={x} cy={y - 38 + Math.abs(x) * 0.5} r={24} />)}</g>;
  return null;
};

const HairFront: React.FC<{hair: string; color: string; y: number; c: Colors}> = ({hair, color, y, c}) => {
  const cap = `M${-B.headRx - 2},${y - 2} Q${-B.headRx - 4},${y - B.headRy - 10} 0,${y - B.headRy - 8} Q${B.headRx + 4},${y - B.headRy - 10} ${B.headRx + 2},${y - 2}`;
  switch (hair) {
    case 'short':
      return <path d={`${cap} Q30,${y - 30} 4,${y - 26} Q-20,${y - 38} ${-B.headRx - 2},${y - 2} Z`} fill={color} />;
    case 'long':
      return <path d={`${cap} Q${B.headRx - 4},${y - 22} 10,${y - 30} Q-14,${y - 18} ${-B.headRx + 4},${y + 14} Z`} fill={color} />;
    case 'bun':
      return (
        <>
          <circle cx={0} cy={y - B.headRy - 14} r={22} fill={color} />
          <path d={`${cap} Q20,${y - 34} 0,${y - 34} Q-20,${y - 34} ${-B.headRx - 2},${y - 2} Z`} fill={color} />
        </>
      );
    case 'curly':
      return <g fill={color}>{[-34, -12, 12, 34].map((x, i) => <circle key={i} cx={x} cy={y - 42 + Math.abs(x) * 0.3} r={18} />)}</g>;
    case 'bald':
      return <path d={`M${-B.headRx},${y + 4} Q${-B.headRx - 2},${y - 14} ${-B.headRx + 10},${y - 20} M${B.headRx},${y + 4} Q${B.headRx + 2},${y - 14} ${B.headRx - 10},${y - 20}`} fill="none" stroke={color} strokeWidth={9} />;
    case 'hijab':
      return <path d={`M-60,${y + 4} Q-60,${y - 66} 0,${y - 66} Q60,${y - 66} 60,${y + 4} L${B.headRx - 6},${y + 4} Q${B.headRx - 6},${y - 44} 0,${y - 44} Q${-B.headRx + 6},${y - 44} ${-B.headRx + 6},${y + 4} Z`} fill={color === '#e8e4dc' ? '#d8d2c6' : '#3d4a6b'} />;
    case 'turban':
      return (
        <g fill="#efe8da">
          <path d={`M${-B.headRx - 8},${y - 12} Q${-B.headRx - 10},${y - 82} 0,${y - 84} Q${B.headRx + 10},${y - 82} ${B.headRx + 8},${y - 12} Q0,${y - 28} ${-B.headRx - 8},${y - 12} Z`} />
          <path d={`M-40,${y - 34} Q0,${y - 60} 44,${y - 52} M-44,${y - 54} Q0,${y - 78} 36,${y - 74}`} fill="none" strokeWidth={4} />
        </g>
      );
    case 'cap':
      return (
        <g fill={c.top}>
          <path d={`${cap} Q0,${y - 26} ${-B.headRx - 2},${y - 2} Z`} />
          <path d={`M-10,${y - 22} Q40,${y - 30} 78,${y - 16} Q40,${y - 4} -10,${y - 12} Z`} />
        </g>
      );
    case 'helmet':
      return (
        <g fill={c.metal}>
          <path d={`M${-B.headRx - 8},${y + 2} Q${-B.headRx - 10},${y - 78} 0,${y - 80} Q${B.headRx + 10},${y - 78} ${B.headRx + 8},${y + 2} L${B.headRx - 6},${y + 2} Q${B.headRx - 10},${y - 30} 0,${y - 32} Q${-B.headRx + 10},${y - 30} ${-B.headRx + 6},${y + 2} Z`} />
          <rect x={-5} y={y - 32} width={10} height={44} />
        </g>
      );
    case 'crown':
      return (
        <>
          <path d={`${cap} Q30,${y - 30} 4,${y - 26} Q-20,${y - 38} ${-B.headRx - 2},${y - 2} Z`} fill={color} />
          <path d={`M-36,${y - 56} L-36,${y - 92} L-18,${y - 72} L0,${y - 100} L18,${y - 72} L36,${y - 92} L36,${y - 56} Z`} fill={c.gold} />
        </>
      );
    default:
      return null;
  }
};

// Drawn in the forearm's frame, so it follows the hand.
const HeldItem: React.FC<{item: Held}> = ({item}) => {
  if (item === 'phone') return <rect x={-12} y={B.fore - 14} width={24} height={42} rx={5} fill="#22252c" />;
  if (item === 'book') return <rect x={-26} y={B.fore - 6} width={52} height={36} rx={3} fill="#8a3b2e" />;
  return (
    <g>
      <rect x={-5} y={B.fore + 4} width={10} height={130} fill="#cfd4dc" />
      <rect x={-20} y={B.fore + 2} width={40} height={9} fill="#7a5a2a" />
    </g>
  );
};

// ---------- Sets ----------

type View = {halfW: number; top: number; bottom: number};
const HORIZON = -130;

// Pseudo-random but stable numbers, so stars and grass stay put between frames.
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const FlatSet: React.FC<{setting: Setting; props: Prop[]; t: Theme; time: number; view: View; sleepers: number[]; people: Person[]; xs: number[]}> = ({setting, props, t, time, view, sleepers, people, xs}) => {
  const {halfW, top, bottom} = view;
  const tone = toner(t.bg, t.setTone, t.setMono);
  const raw = SET_COLORS[setting] ?? SET_COLORS.empty;
  const C = {sky: tone(raw.sky), ground: tone(raw.ground), a: tone(raw.a), b: tone(raw.b), glass: tone(raw.glass), trim: tone(raw.trim)};
  const line = {stroke: t.castOutline ?? t.line, strokeWidth: 4, strokeOpacity: t.castOutline ? 0.9 : 0.5};
  const glow = 0.85 + Math.sin(time * 2) * 0.15;
  const W = halfW * 2;
  const sun = setting === 'night' ? C.b : t.accent;

  const scenery = (() => {
    switch (setting) {
      case 'bedroom':
        return (
          <g {...line}>
            <rect x={-halfW} y={HORIZON - 30} width={W} height={30} fill={C.trim} />
            <Window x={-halfW * 0.55} y={-560} w={190} h={230} glass={C.glass} trim={C.trim} />
            <circle cx={-halfW * 0.55 + 40} cy={-600} r={22} fill="#fff3c4" opacity={glow} stroke="none" />
            <rect x={halfW * 0.4} y={-600} width={130} height={96} fill={C.b} />
            <rect x={halfW * 0.4 + 14} y={-586} width={102} height={68} fill={tone('#e8d2a0')} stroke="none" />
            <ellipse cx={0} cy={60} rx={halfW * 0.7} ry={70} fill={C.b} fillOpacity={0.55} />
          </g>
        );
      case 'house':
        return (
          <g {...line}>
            {Array.from({length: Math.ceil((HORIZON - top) / 46)}, (_, i) => <path key={i} d={`M${-halfW},${HORIZON - 40 - i * 46} H${halfW}`} fill="none" stroke={shade(C.sky, -0.25)} strokeOpacity={1} strokeWidth={5} />)}
            <Window x={0} y={-520} w={320} h={260} glass={C.glass} trim={C.trim} />
            <Bushes y={HORIZON} halfW={halfW} green={C.a} accent={C.b} />
          </g>
        );
      case 'street':
        return (
          <g {...line}>
            {Array.from({length: 7}, (_, i) => {
              const w = 130 + rand(i) * 80;
              const h = 300 + rand(i + 9) * 380;
              const x = -halfW + (i * W) / 6 - w / 2;
              const fill = [C.a, C.b, tone('#8e9aa6'), tone('#a6705c'), tone('#d0c4ac')][i % 5];
              return (
                <g key={i}>
                  <rect x={x} y={HORIZON - h} width={w} height={h} fill={fill} />
                  {Array.from({length: Math.floor(h / 70)}, (_, r) => <rect key={r} x={x + 22} y={HORIZON - h + 24 + r * 70} width={w - 44} height={28} fill={rand(i * 9 + r) > 0.55 ? C.glass : shade(fill, -0.35)} stroke="none" opacity={rand(i * 9 + r) > 0.55 ? glow : 1} />)}
                </g>
              );
            })}
            <rect x={-halfW} y={HORIZON} width={W} height={34} fill={C.trim} />
            <path d={`M${-halfW},${(HORIZON + bottom) / 2 + 30} H${halfW}`} fill="none" stroke={tone('#e8e2d0')} strokeOpacity={1} strokeWidth={8} strokeDasharray="60 50" />
          </g>
        );
      case 'desert':
        return (
          <g {...line}>
            <circle cx={halfW * 0.45} cy={-640} r={90} fill={sun} opacity={glow} stroke="none" style={{filter: `drop-shadow(0 0 30px ${sun})`}} />
            <path d={`M${-halfW},${HORIZON - 40} Q${-halfW * 0.4},${HORIZON - 170} 0,${HORIZON - 60} T${halfW},${HORIZON - 90} V${HORIZON} H${-halfW} Z`} fill={C.a} />
            <path d={`M${-halfW},${HORIZON - 10} Q${halfW * 0.2},${HORIZON - 90} ${halfW},${HORIZON - 20} V${HORIZON} H${-halfW} Z`} fill={shade(C.ground, -0.08)} />
            <Palm x={-halfW * 0.72} y={HORIZON + 20} trunk={C.trim} leaf={C.b} line={line} />
          </g>
        );
      case 'mosque':
        return (
          <g {...line}>
            <circle cx={halfW * 0.62} cy={-720} r={36} fill={sun} opacity={glow} stroke="none" />
            <g fill={C.a}>
              <rect x={-200} y={HORIZON - 230} width={400} height={230} />
              <path d={`M-150,${HORIZON - 230} Q-150,${HORIZON - 430} 0,${HORIZON - 450} Q150,${HORIZON - 430} 150,${HORIZON - 230} Z`} fill={C.b} />
              {[-1, 1].map((s) => (
                <g key={s}>
                  <rect x={s * 280 - 22} y={HORIZON - 580} width={44} height={580} />
                  <rect x={s * 280 - 30} y={HORIZON - 420} width={60} height={16} />
                  <path d={`M${s * 280 - 30},${HORIZON - 580} L${s * 280},${HORIZON - 670} L${s * 280 + 30},${HORIZON - 580} Z`} fill={C.b} />
                </g>
              ))}
              {[-115, 0, 115].map((x) => <path key={x} d={`M${x - 36},${HORIZON} V${HORIZON - 110} Q${x},${HORIZON - 175} ${x + 36},${HORIZON - 110} V${HORIZON} Z`} fill={C.glass} />)}
            </g>
            <path d={`M0,${HORIZON - 450} V${HORIZON - 500}`} fill="none" stroke={tone('#d9b45a')} strokeOpacity={1} strokeWidth={6} />
            <rect x={-halfW * 0.8} y={10} width={halfW * 1.6} height={90} fill={C.trim} fillOpacity={0.8} />
          </g>
        );
      case 'battlefield':
        return (
          <g {...line}>
            <rect x={-halfW} y={HORIZON - 300} width={W} height={300} fill={t.accent} fillOpacity={0.1} stroke="none" />
            <path d={`M${-halfW},${HORIZON - 60} Q${-halfW * 0.3},${HORIZON - 190} ${halfW * 0.2},${HORIZON - 90} T${halfW},${HORIZON - 120} V${HORIZON} H${-halfW} Z`} fill={shade(C.ground, -0.15)} />
            {[-0.65, 0.55].map((f, i) => (
              <g key={i} transform={`translate(${halfW * f} ${HORIZON - 40})`}>
                <path d="M-80,0 L0,-120 L80,0 Z" fill={C.a} />
                <path d="M0,-120 L-20,0 M0,-120 L20,0" fill="none" />
                <path d="M0,-120 V-210" fill="none" />
                <path d={`M0,-210 L${64 + Math.sin(time * 4 + i) * 6},-194 L0,-178 Z`} fill={i ? tone('#2f4f8a') : C.b} stroke="none" />
              </g>
            ))}
            {[0, 1, 2].map((i) => <circle key={i} cx={-halfW * 0.2 + i * 60 + Math.sin(time + i) * 10} cy={HORIZON - 280 - i * 50 - ((time * 20) % 60)} r={46 + i * 14} fill={C.glass} fillOpacity={0.25} stroke="none" />)}
          </g>
        );
      case 'office':
        return (
          <g {...line}>
            <Window x={-halfW * 0.6} y={-520} w={240} h={280} glass={C.glass} trim={C.trim} />
            {Array.from({length: 8}, (_, i) => <path key={i} d={`M${-halfW * 0.6 - 120},${-640 + i * 34} h240`} fill="none" stroke={C.trim} strokeOpacity={0.9} strokeWidth={6} />)}
            <g transform={`translate(${halfW * 0.62} -590)`}>
              <circle r={52} fill={C.trim} />
              <path d={`M0,0 v-34 M0,0 l${Math.cos(time) * 24},${Math.sin(time) * 24}`} fill="none" stroke={t.line === '#111111' ? '#111' : '#2a221c'} strokeOpacity={1} />
            </g>
          </g>
        );
      case 'classroom':
        return (
          <g {...line}>
            <rect x={-halfW * 0.82} y={-720} width={halfW * 1.64} height={340} fill={tone('#6b4a32')} />
            <rect x={-halfW * 0.78} y={-704} width={halfW * 1.56} height={308} fill={C.a} />
            <path d={`M${-halfW * 0.6},-640 q60,-30 120,0 t120,0 M${-halfW * 0.6},-560 h${halfW * 0.7} M${-halfW * 0.6},-500 h${halfW * 0.4}`} fill="none" stroke="#f2efe8" strokeOpacity={0.8} />
          </g>
        );
      case 'night':
        return (
          <g {...line}>
            {Array.from({length: 46}, (_, i) => <circle key={i} cx={-halfW + rand(i) * W} cy={top + rand(i + 50) * (HORIZON - top - 120)} r={2 + rand(i + 99) * 3} fill="#ffffff" opacity={0.35 + 0.5 * Math.abs(Math.sin(time * 1.5 + i))} stroke="none" />)}
            <path d={`M${halfW * 0.5 - 50},-760 a60,60 0 1 0 50,90 a48,48 0 1 1 -50,-90 Z`} fill={C.b} stroke="none" style={{filter: `drop-shadow(0 0 24px ${C.b})`}} />
            <path d={`M${-halfW},${HORIZON - 40} Q${-halfW * 0.5},${HORIZON - 150} 0,${HORIZON - 60} T${halfW},${HORIZON - 100} V${HORIZON} H${-halfW} Z`} fill={C.a} />
          </g>
        );
      case 'field':
        return (
          <g {...line}>
            <circle cx={halfW * 0.5} cy={-680} r={72} fill={sun} opacity={glow} stroke="none" />
            {[0, 1].map((i) => {
              const x = ((time * 14 + i * 400) % (W + 300)) - halfW - 150;
              return <g key={i} fill={C.b}>{[0, 50, 100].map((dx, j) => <circle key={j} cx={x + dx} cy={-760 + i * 120 - (j === 1 ? 26 : 0)} r={j === 1 ? 50 : 38} />)}</g>;
            })}
            <path d={`M${-halfW},${HORIZON - 30} Q0,${HORIZON - 130} ${halfW},${HORIZON - 30} V${HORIZON} H${-halfW} Z`} fill={shade(C.ground, 0.12)} />
            <Tree x={-halfW * 0.72} y={HORIZON} crown={C.a} trunk={C.trim} line={line} />
            {Array.from({length: 18}, (_, i) => <circle key={i} cx={-halfW + rand(i + 30) * W} cy={-60 + rand(i + 60) * 160} r={7} fill={[tone('#e8d24a'), tone('#e86a6a'), '#ffffff'][i % 3]} stroke="none" />)}
          </g>
        );
      default:
        return <ellipse cx={0} cy={0} rx={halfW * 0.9} ry={110} fill={t.accent} fillOpacity={0.12} stroke="none" />;
    }
  })();

  // Free spots for extra props, away from where people stand.
  const slots = [-0.78, 0.78, -0.5, 0.5].map((f) => f * halfW).filter((x) => xs.every((px) => Math.abs(px - x) > 110));
  let slot = 0;
  const next = () => slots[slot++ % Math.max(1, slots.length)] ?? halfW * 0.7;
  const P = {...C, t, line, tone};

  return (
    <g>
      <rect x={-halfW} y={top} width={W} height={HORIZON - top} fill={setting === 'empty' ? t.land : C.sky} />
      <rect x={-halfW} y={HORIZON} width={W} height={bottom - HORIZON} fill={setting === 'empty' ? t.landFocus : C.ground} />
      <rect x={-halfW} y={HORIZON} width={W} height={bottom - HORIZON} fill="url(#floor-shade)" />
      <defs>
        <linearGradient id="floor-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0.18} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M${-halfW},${HORIZON} H${halfW}`} stroke={t.line} strokeOpacity={0.4} strokeWidth={4} />
      {scenery}
      {sleepers.map((x, i) => <Bed key={`bed${i}`} x={x} P={P} />)}
      {people.map((p, i) => (props.includes('mat') && (p.pose === 'pray' || p.pose === 'kneel') ? <rect key={`mat${i}`} x={xs[i] - 72} y={-16} width={144} height={36} rx={4} fill={tone('#2f6b5a')} {...line} /> : null))}
      {props.map((prop, i) => <PropItem key={i} prop={prop} x={next()} P={P} time={time} skip={prop === 'bed' && sleepers.length > 0} />)}
    </g>
  );
};

type Line = {stroke: string; strokeWidth: number; strokeOpacity: number};
type Paint = SetColorsToned & {t: Theme; line: Line; tone: (hex: string) => string};
type SetColorsToned = {sky: string; ground: string; a: string; b: string; glass: string; trim: string};

const Window: React.FC<{x: number; y: number; w: number; h: number; glass: string; trim: string}> = ({x, y, w, h, glass, trim}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-w / 2 - 14} y={-h / 2 - 14} width={w + 28} height={h + 28} fill={trim} />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={glass} />
    <path d={`M${-w / 2 + 16},${h / 2 - 20} L${-w / 2 + 70},${-h / 2 + 16}`} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={14} />
    <path d={`M0,${-h / 2} V${h / 2} M${-w / 2},0 H${w / 2}`} fill="none" stroke={trim} strokeOpacity={1} strokeWidth={12} />
    <rect x={-w / 2 - 26} y={h / 2 + 10} width={w + 52} height={16} fill={trim} />
  </g>
);

const Bushes: React.FC<{y: number; halfW: number; green: string; accent: string}> = ({y, halfW, green, accent}) => (
  <g strokeWidth={4} strokeOpacity={0.5}>
    {Array.from({length: 8}, (_, i) => {
      const fill = i === 0 || i === 6 ? accent : i % 2 ? green : shade(green, 0.12);
      const cx = -halfW + (i + 0.5) * (halfW / 4);
      const cy = y - 40 - rand(i + 3) * 30;
      const r = 70 + rand(i) * 30;
      return (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={fill} />
          <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.35} fill="#ffffff" fillOpacity={0.08} stroke="none" />
        </g>
      );
    })}
  </g>
);

const Palm: React.FC<{x: number; y: number; trunk: string; leaf: string; line: Line}> = ({x, y, trunk, leaf, line}) => (
  <g transform={`translate(${x} ${y})`} {...line}>
    <path d="M0,0 Q-10,-160 14,-300" fill="none" strokeWidth={20} stroke={trunk} strokeOpacity={1} />
    {[-60, -20, 20, 60, 100, 140].map((a, i) => <path key={i} d={`M14,-300 q${Math.cos((a * Math.PI) / 180) * 70},${-40 + Math.sin((a * Math.PI) / 180) * 30} ${Math.cos((a * Math.PI) / 180) * 150},24`} fill="none" strokeWidth={14} stroke={leaf} strokeOpacity={1} />)}
  </g>
);

const Tree: React.FC<{x: number; y: number; crown: string; trunk: string; line: Line}> = ({x, y, crown, trunk, line}) => (
  <g transform={`translate(${x} ${y})`} {...line}>
    <rect x={-18} y={-230} width={36} height={230} fill={trunk} />
    <circle cx={-70} cy={-240} r={74} fill={shade(crown, -0.1)} />
    <circle cx={70} cy={-250} r={78} fill={shade(crown, -0.05)} />
    <circle cx={0} cy={-300} r={112} fill={crown} />
    <circle cx={-30} cy={-340} r={40} fill="#ffffff" fillOpacity={0.08} stroke="none" />
  </g>
);

const Bed: React.FC<{x: number; P: Paint}> = ({x, P}) => (
  <g transform={`translate(${x} 0)`} {...P.line}>
    <rect x={-262} y={-170} width={26} height={170} rx={6} fill={P.tone('#5a3c28')} />
    <rect x={-250} y={-92} width={490} height={74} rx={12} fill={P.tone('#6b4a32')} />
    <rect x={-244} y={-112} width={478} height={30} rx={10} fill={P.tone('#efe9df')} />
    <rect x={-236} y={-150} width={110} height={46} rx={20} fill={P.tone('#ffffff')} />
    <rect x={-110} y={-118} width={344} height={40} rx={10} fill={P.tone('#c0623f')} />
  </g>
);

const PropItem: React.FC<{prop: Prop; x: number; P: Paint; time: number; skip?: boolean}> = ({prop, x, P, time, skip}) => {
  if (skip || prop === 'phone' || prop === 'book' || prop === 'sword' || prop === 'mat') return null;
  const {t, line: ln, tone} = P;
  const flick = Math.sin(time * 18) * 0.15 + Math.sin(time * 7) * 0.1;
  const wood = tone('#8a6a4a');
  switch (prop) {
    case 'bed': return <Bed x={x} P={P} />;
    case 'table': return <g {...ln} transform={`translate(${x} 0)`}><path d="M-70,-102 V0 M70,-102 V0" stroke={shade(wood, -0.2)} strokeWidth={14} strokeOpacity={1} /><rect x={-96} y={-124} width={192} height={22} rx={4} fill={wood} /></g>;
    case 'chair': return <g {...ln} transform={`translate(${x} 0)`}><path d="M-34,-180 V0 M34,-84 V0" stroke={shade(wood, -0.2)} strokeWidth={12} strokeOpacity={1} /><rect x={-44} y={-96} width={88} height={16} fill={wood} /><rect x={-40} y={-180} width={18} height={90} fill={wood} /></g>;
    case 'clock': return <g {...ln} transform={`translate(${x} -620)`}><circle r={48} fill={tone('#f2efe8')} /><path d={`M0,0 V-30 M0,0 L${Math.cos(time) * 22},${Math.sin(time) * 22}`} fill="none" stroke="#2a221c" strokeOpacity={1} /></g>;
    case 'lamp': return <g {...ln} transform={`translate(${x} 0)`}><ellipse cx={0} cy={-170} rx={110} ry={90} fill={t.accent} opacity={0.12} stroke="none" /><path d="M0,0 V-220" fill="none" stroke={tone('#3a3530')} strokeWidth={8} strokeOpacity={1} /><path d="M-50,-220 L-32,-290 L32,-290 L50,-220 Z" fill={tone('#f0c87a')} /></g>;
    case 'tree': return <Tree x={x} y={0} crown={tone('#3f6e34')} trunk={tone('#6b4a2e')} line={ln} />;
    case 'door': return <g {...ln} transform={`translate(${x} 0)`}><rect x={-76} y={-340} width={152} height={340} fill={tone('#7a4f33')} /><rect x={-56} y={-310} width={112} height={130} fill="none" /><circle cx={50} cy={-160} r={8} fill={tone('#e0b44a')} /></g>;
    case 'window': return <Window x={x} y={-560} w={160} h={200} glass={P.glass} trim={P.trim} />;
    case 'moon': return <path transform={`translate(${x} -720)`} d="M-20,-50 a56,56 0 1 0 46,84 a44,44 0 1 1 -46,-84 Z" fill={tone('#fff6d8')} />;
    case 'sun': return <circle cx={x} cy={-700} r={70} fill={t.accent} />;
    case 'fire':
      return (
        <g transform={`translate(${x} 0)`}>
          <ellipse cx={0} cy={-60} rx={140} ry={110} fill={t.accent} opacity={0.15 + flick * 0.1} />
          <path d="M-64,-6 L64,-26 M-64,-26 L64,-6" stroke={tone('#5a3c28')} strokeWidth={18} />
          <path d={`M-42,-20 Q-52,${-90 - flick * 60} 0,${-155 - flick * 80} Q52,${-90 + flick * 40} 42,-20 Z`} fill={tone('#ff8a3a')} />
          <path d={`M-18,-20 Q-22,${-60 - flick * 30} 0,${-92 - flick * 40} Q22,-60 18,-20 Z`} fill={tone('#ffd27a')} />
        </g>
      );
    case 'tent': return <g {...ln} transform={`translate(${x} 0)`}><path d="M-130,0 L0,-200 L130,0 Z" fill={tone('#c9b48a')} /><path d="M0,-200 L-34,0 L34,0 Z" fill={tone('#3a3128')} /></g>;
    case 'car':
      return (
        <g {...ln} transform={`translate(${x} 0)`}>
          <path d="M-160,-40 V-104 L-96,-108 L-62,-170 L66,-170 L106,-108 L160,-100 V-40 Z" fill={tone('#b8433a')} />
          <path d="M-50,-160 L-80,-110 L0,-110 L0,-160 Z M14,-160 L14,-110 L90,-110 L60,-160 Z" fill={P.glass} />
          <circle cx={-92} cy={-36} r={32} fill={tone('#1e1e22')} />
          <circle cx={92} cy={-36} r={32} fill={tone('#1e1e22')} />
        </g>
      );
    default: return null;
  }
};
