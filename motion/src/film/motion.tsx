import {useMemo} from 'react';
import * as THREE from 'three';
import {useFilm, useTime} from './Film';
import {softDisc} from './rig';

// Things that come into being on the narration: the movement that makes a process film feel alive. All of it is a pure function of film time.
type V3 = [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const rnd = (i: number, seed: number) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Fast away, then decelerating into place: objects that have somewhere to be.
const flight = (p: number) => 1 - (1 - p) ** 2.4;

// The start time of every spoken word between two moments: map parts onto these so that each lands on a word.
export function useWordsIn() {
  const {words} = useFilm();
  return (from: number, to: number) => words.filter((w) => w.start >= from && w.start < to).map((w) => w.start);
}

// `n` moments evenly spread from `from` to `to`, for when parts shouldn't follow words.
export const spread = (n: number, from: number, to: number) => Array.from({length: n}, (_, i) => from + ((to - from) * i) / Math.max(1, n - 1));

// A burst of dust or sparks at `at` seconds, gone after `life`. Every Arrive with `dust` makes one.
export const Puff: React.FC<{p: V3; at: number; life?: number; size?: number; color?: string; count?: number; opacity?: number; seed?: number; rise?: number}> = ({p, at, life = 0.9, size = 1, color = '#cdbb9d', count = 9, opacity = 0.42, seed = 1, rise = 0.5}) => {
  const t = useTime();
  const k = (t - at) / life;
  if (k < 0 || k >= 1) return null;
  const out = 1 - (1 - k) ** 2;
  return (
    <group position={p}>
      {Array.from({length: count}, (_, i) => {
        const a = rnd(i, seed) * Math.PI * 2;
        const reach = (0.35 + rnd(i, seed + 1) * 0.65) * size * out;
        const scale = (0.25 + rnd(i, seed + 2) * 0.4 + out * 0.7) * size;
        return (
          <sprite key={i} position={[Math.cos(a) * reach, (0.06 + rnd(i, seed + 3) * rise) * size * out, Math.sin(a) * reach]} scale={[scale, scale, 1]}>
            <spriteMaterial map={softDisc()} color={color} opacity={opacity * (1 - k) ** 1.5} transparent depthWrite={false} />
          </sprite>
        );
      })}
    </group>
  );
};

export type Leave = {at: number; to: V3; take?: number; spin?: V3};

// A part that flies in and lands at `at` seconds, exactly on the beat you give it: it starts `take` seconds earlier, swings in on an arc, seats itself with a small settle, and throws up dust.
// Put its finished position in `p` and its angle in `rot` (radians). Before it starts it isn't there, so a thing can assemble itself part by part.
export const Arrive: React.FC<{at: number; p?: V3; rot?: V3; from?: V3; take?: number; arc?: number; spin?: V3; dust?: number | false; dustColor?: string; leave?: Leave; seed?: number; children: React.ReactNode}> = ({at, p = [0, 0, 0], rot = [0, 0, 0], from, take = 0.5, arc = 0.8, spin = [0.5, 0.9, 0.35], dust = 0.7, dustColor, leave, seed = 1, children}) => {
  const t = useTime();
  const start = at - take;
  if (t < start) return null;
  if (leave && t >= leave.at + (leave.take ?? 0.6)) return null;
  const origin = from ?? ([p[0] + (rnd(1, seed) - 0.5) * 3, p[1] + 5, p[2] + 5] as V3);
  const e = flight(clamp01((t - start) / take));
  const left = 1 - e;
  const pos: V3 = [origin[0] + (p[0] - origin[0]) * e, origin[1] + (p[1] - origin[1]) * e + arc * Math.sin(Math.PI * e), origin[2] + (p[2] - origin[2]) * e];
  const angle: V3 = [rot[0] + spin[0] * left, rot[1] + spin[1] * left, rot[2] + spin[2] * left];
  // On landing it presses down and springs back.
  const since = t - at;
  const press = since >= 0 && since < 0.32 ? Math.exp(-since * 11) * Math.cos(since * 28) : 0;
  pos[1] -= press * 0.03;
  if (leave && t >= leave.at) {
    const out = clamp01((t - leave.at) / (leave.take ?? 0.6)) ** 2;
    const s = leave.spin ?? [0.6, 0.3, 0.9];
    pos[0] += (leave.to[0] - p[0]) * out;
    pos[1] += (leave.to[1] - p[1]) * out;
    pos[2] += (leave.to[2] - p[2]) * out;
    angle[0] += s[0] * out;
    angle[1] += s[1] * out;
    angle[2] += s[2] * out;
  }
  return (
    <>
      <group position={pos} rotation={angle}>{children}</group>
      {dust !== false && <Puff p={p} at={at} size={dust} color={dustColor} seed={seed} />}
    </>
  );
};

// Something that grows into place along one axis, with a small overshoot: walls rising, plaster spreading, a pillar being poured, water filling. Pivot it by placing the group's origin where it starts from.
export const Grow: React.FC<{at: number; take?: number; p?: V3; rot?: V3; axis?: 'x' | 'y' | 'z' | 'all'; children: React.ReactNode}> = ({at, take = 0.9, p, rot, axis = 'y', children}) => {
  const t = useTime();
  const k = clamp01((t - at) / take);
  if (k <= 0) return null;
  const c = 1.3;
  const s = Math.max(0.0001, 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2);
  const scale: V3 = axis === 'all' ? [s, s, s] : [axis === 'x' ? s : 1, axis === 'y' ? s : 1, axis === 'z' ? s : 1];
  return <group position={p} rotation={rot} scale={scale}>{children}</group>;
};

// Falling rain around `centre`, in a box `size` metres wide and `height` tall.
export const Rain: React.FC<{centre?: V3; size?: number; height?: number; count?: number; color?: string; speed?: number; opacity?: number; wind?: number; streak?: number}> = ({centre = [0, 0, 0], size = 14, height = 9, count = 420, color = '#dfe9f2', speed = 11, opacity = 0.5, wind = 0.6, streak = 0.34}) => {
  const t = useTime();
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const array = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const y = height - (((rnd(i, 3) * height + t * speed * (0.85 + rnd(i, 4) * 0.3)) % height));
    const x = (rnd(i, 1) - 0.5) * size + wind * (height - y) * 0.1;
    const z = (rnd(i, 2) - 0.5) * size;
    array.set([centre[0] + x, centre[1] + y, centre[2] + z, centre[0] + x + wind * streak * 0.1, centre[1] + y + streak, centre[2] + z], i * 6);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
  return <lineSegments geometry={geometry} frustumCulled={false}><lineBasicMaterial color={color} transparent opacity={opacity} /></lineSegments>;
};

// Slowly falling soft flakes. The same thing with other colours and sizes makes ash, embers, spores, bubbles (use `rise`) or drifting dust.
export const Snow: React.FC<{centre?: V3; size?: number; height?: number; count?: number; color?: string; speed?: number; flake?: number; opacity?: number; rise?: boolean}> = ({centre = [0, 0, 0], size = 14, height = 9, count = 260, color = '#ffffff', speed = 0.8, flake = 0.08, opacity = 0.95, rise = false}) => {
  const t = useTime();
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const array = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const fallen = (rnd(i, 7) * height + t * speed * (0.7 + rnd(i, 8) * 0.6)) % height;
    const y = rise ? fallen : height - fallen;
    const sway = Math.sin(t * (0.4 + rnd(i, 9)) + i) * 0.28;
    array.set([centre[0] + (rnd(i, 5) - 0.5) * size + sway, centre[1] + y, centre[2] + (rnd(i, 6) - 0.5) * size + sway * 0.6], i * 3);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
  return <points geometry={geometry} frustumCulled={false}><pointsMaterial map={softDisc()} color={color} size={flake} sizeAttenuation transparent opacity={opacity} depthWrite={false} /></points>;
};
