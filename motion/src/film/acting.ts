import * as THREE from 'three';
import type {BoneMap} from './rig';

// Hand-animation for the characters: poses held and moved between with anticipation and settle, limbs that reach exact points, and small signs of life.
// Everything is computed from the time alone, so any frame renders the same on its own.
type V3 = [number, number, number];
const RAD = Math.PI / 180;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

// The curve of a deliberate move: dips back a little first, then overshoots and settles.
export const acted = (p: number) => {
  const x = clamp01(p);
  return smooth(x) - 0.05 * Math.sin(x * Math.PI * 2);
};

// A point for a limb to reach, `at` metres from the bone `on`, in the axes of that bone's part of the body (x to the actor's left, y up, z forward).
// `on` also takes 'root' (the actor's feet) and 'world' (a place in the scene). `elbow` says which way the elbow or knee points, `toes` tips a foot up in degrees.
// For a hand, `fingers` is the way the fingers point and `palm` the way the palm faces, in those same axes, so that a hand can rest on, hold or cover something.
export type Reach = {on?: string; at: V3; elbow?: V3; toes?: number; fingers?: V3; palm?: V3};

export type BodyPose = {
  // Moves the pelvis from where it is when standing, in metres.
  hips?: V3;
  // Rotates the whole body at the pelvis, in degrees: x tips forward, y turns to the left, z leans to the right.
  body?: V3;
  // Bends the back, same axes.
  bend?: V3;
  head?: V3;
  // Feet stay on the spot unless this is false, or unless they have their own target.
  plant?: boolean;
  hand_l?: Reach;
  hand_r?: Reach;
  foot_l?: Reach;
  foot_r?: Reach;
  // How closed each hand is, 0 to 1.
  grip_l?: number;
  grip_r?: number;
  // The index finger stays straight.
  point_l?: boolean;
  point_r?: boolean;
};

// Each side mirrored: everything is given for the actor's left.
const mirror = (v?: V3) => v && ([-v[0], v[1], v[2]] as V3);
const hands = (on: string, at: V3, elbow?: V3, fingers?: V3, palm?: V3) => ({hand_l: {on, at, elbow, fingers, palm}, hand_r: {on, at: mirror(at) as V3, elbow: mirror(elbow), fingers: mirror(fingers), palm: mirror(palm)}});

const LYING = {hips: [0, -0.8, 0] as V3, plant: false};
// Flat out, toes falling gently outward.
const LEGS_OUT = {foot_l: {at: [0.14, 0.13, 0.88] as V3, toes: 62}, foot_r: {at: [-0.14, 0.13, 0.88] as V3, toes: 62}};

export const POSES = {
  stand: {},
  // Standing, and feeling something about it.
  hipsHands: {...hands('pelvis', [0.3, 0.21, -0.02], [1, 0.05, -0.55], [-0.6, -0.75, 0.25], [-1, 0, 0]), bend: [-2, 0, 0], grip_l: 0.3, grip_r: 0.3},
  armsCrossed: {hand_l: {on: 'spine_03', at: [-0.13, -0.05, 0.25], elbow: [1, -0.6, 0.1], fingers: [-1, -0.1, -0.15], palm: [0, 0, -1]}, hand_r: {on: 'spine_03', at: [0.13, -0.11, 0.25], elbow: [-1, -0.6, 0.1], fingers: [1, -0.1, -0.15], palm: [0, 0, -1]}, bend: [-3, 0, 0], head: [-3, 0, 0], grip_l: 0.55, grip_r: 0.55},
  facepalm: {hand_r: {on: 'Head', at: [-0.03, -0.03, 0.2], elbow: [-0.25, -1, 0.1], fingers: [0.05, 1, 0.12], palm: [0, -0.1, -1]}, bend: [14, 0, 0], head: [18, 0, 0], grip_r: 0.08},
  thinking: {hand_r: {on: 'Head', at: [-0.05, -0.12, 0.2], elbow: [-0.2, -1, 0.1], fingers: [0.15, 0.9, 0.1], palm: [0, 0, -1]}, hand_l: {on: 'spine_02', at: [-0.05, -0.02, 0.21], elbow: [1, -0.7, 0], fingers: [-1, 0.05, 0], palm: [0, 0.2, -1]}, head: [-5, 12, 6], grip_r: 0.65, grip_l: 0.45},
  handsOnHead: {...hands('Head', [0.28, 0.24, -0.02], [1, 0.2, -0.1], [-0.75, 0.35, 0], [-0.25, -1, 0]), head: [6, 0, 0], grip_l: 0.2, grip_r: 0.2},
  armsUp: {...hands('spine_03', [0.33, 0.68, 0.14], [1, -0.2, 0], [0.1, 1, 0], [0, 0, 1]), bend: [-6, 0, 0], head: [-10, 0, 0], grip_l: 0.05, grip_r: 0.05},
  slump: {bend: [24, 0, 0], head: [22, 0, 0], hips: [0, -0.015, -0.02]},
  // Using something with the hands.
  phone: {hand_r: {on: 'spine_03', at: [-0.1, 0.03, 0.38], elbow: [-0.6, -1, -0.2], fingers: [0.35, 0.8, 0.2], palm: [0.15, 0.3, -1]}, head: [20, 0, 0], grip_r: 0.6},
  carry: {...hands('spine_03', [0.17, -0.2, 0.42], [0.7, -1, -0.3], [-0.2, 0, 1], [0, 1, 0]), bend: [-3, 0, 0], grip_l: 0.5, grip_r: 0.5},
  reach: {hand_r: {on: 'spine_03', at: [-0.2, 0.1, 0.56], elbow: [-0.5, -1, -0.2], fingers: [0, 0, 1], palm: [0.5, -1, 0]}, bend: [8, 0, 0], grip_r: 0.3},
  point: {hand_r: {on: 'spine_03', at: [-0.24, 0.14, 0.55], elbow: [-0.5, -1, -0.2], fingers: [-0.1, 0.05, 1], palm: [0.5, -1, 0]}, grip_r: 0.8, point_r: true},
  // Lower down. The sitting poses take the actor's position as the spot under their feet: put the seat 0.36 m behind it and 0.48 m up.
  sit: {hips: [0, -0.47, -0.36], bend: [4, 0, 0], ...hands('pelvis', [0.16, 0.13, 0.25], [0.8, -0.2, -0.7], [-0.08, -0.12, 1], [0, -1, 0]), grip_l: 0.2, grip_r: 0.2},
  sitSlumped: {hips: [0, -0.47, -0.36], bend: [20, 0, 0], head: [20, 0, 0], ...hands('pelvis', [0.13, 0.14, 0.3], [0.8, -0.2, -0.7], [-0.25, -0.15, 1], [0, -1, 0]), grip_l: 0.25, grip_r: 0.25},
  sitWork: {hips: [0, -0.47, -0.36], bend: [10, 0, 0], head: [8, 0, 0], ...hands('spine_03', [0.16, -0.2, 0.32], [0.6, -1, -0.3], [-0.15, -0.1, 1], [0, -1, 0]), grip_l: 0.15, grip_r: 0.15},
  crouch: {hips: [0, -0.42, -0.16], bend: [30, 0, 0], head: [-16, 0, 0], ...hands('pelvis', [0.17, 0.2, 0.3], [0.8, -0.2, -0.3], [0, -0.4, 1], [0, -1, 0]), grip_l: 0.25, grip_r: 0.25},
  // Feet straight out in front on whatever they're sat on, with the actor's position at the pelvis: for the floor or a mattress.
  sitLegsOut: {...LYING, bend: [6, 0, 0], foot_l: {at: [0.13, 0.1, 0.88], toes: 75}, foot_r: {at: [-0.13, 0.1, 0.88], toes: 75}, ...hands('pelvis', [0.2, 0.08, 0.2], [0.8, -0.1, -0.7], [0, -0.1, 1], [0, -1, 0])},
  // Flat on whatever they lie on, with the actor's position under the pelvis. The head is towards -z and the feet towards +z.
  lieBack: {...LYING, ...LEGS_OUT, body: [-90, 0, 0]},
  lieBackHandsOnChest: {...LYING, ...LEGS_OUT, body: [-90, 0, 0], ...hands('spine_02', [0.19, 0.04, 0.19], [1, 0.1, -0.3], [-1, 0.15, 0], [0, 0, -1]), grip_l: 0.15, grip_r: 0.15},
  lieSideLeft: {...LYING, hips: [0, -0.74, 0], body: [-90, 90, 0], foot_l: {on: 'pelvis', at: [0.1, -0.76, 0.1]}, foot_r: {on: 'pelvis', at: [-0.1, -0.76, 0.28]}},
  lieSideRight: {...LYING, hips: [0, -0.74, 0], body: [-90, -90, 0], foot_l: {on: 'pelvis', at: [0.1, -0.76, 0.28]}, foot_r: {on: 'pelvis', at: [-0.1, -0.76, 0.1]}},
} satisfies Record<string, BodyPose>;

export type PoseName = keyof typeof POSES;
// From `at`, the actor takes `take` seconds to arrive in this pose, then holds it until the next one.
// Several poses in a list combine, later ones on top: ['sit', 'facepalm'] sits with a hand on the face.
export type Cue = {at: number; pose: PoseName | BodyPose | (PoseName | BodyPose)[]; take?: number};

// A quick piece of acting over the top of whatever the pose is. Seconds default to something sensible for each kind.
export type GestureName = 'nod' | 'shake' | 'flinch' | 'gasp' | 'sigh' | 'laugh' | 'tremble' | 'shrug' | 'wave' | 'clap' | 'jump' | 'thud' | 'stomp';
export type Gesture = {at: number; kind: GestureName; take?: number};

type Effect = {head?: V3; bend?: V3; hips?: V3; lift?: number; squash?: number; arms?: Partial<BodyPose>; armsWeight?: number};

const swell = (p: number) => Math.sin(Math.PI * clamp01(p));
const SECONDS: Record<GestureName, number> = {nod: 0.9, shake: 1.1, flinch: 0.7, gasp: 1, sigh: 1.8, laugh: 1.6, tremble: 1.6, shrug: 1.2, wave: 1.6, clap: 1.4, jump: 1, thud: 0.6, stomp: 0.7};

const GESTURES: Record<GestureName, (p: number) => Effect> = {
  nod: (p) => ({head: [13 * swell(p) * Math.sin(p * Math.PI * 4), 0, 0]}),
  shake: (p) => ({head: [0, 22 * swell(p) * Math.sin(p * Math.PI * 6), 0]}),
  flinch: (p) => {
    const e = p < 0.18 ? p / 0.18 : 1 - (p - 0.18) / 0.82;
    return {bend: [-9 * e, 0, 0], head: [-14 * e, 0, 0], hips: [0, -0.03 * e, -0.05 * e], arms: hands('spine_03', [0.2, 0.0, 0.24], [1, -0.7, -0.2], [0, 1, 0.1], [0, 0, 1]), armsWeight: e};
  },
  gasp: (p) => {
    const e = swell(Math.min(1, p * 1.5));
    return {bend: [-7 * e, 0, 0], head: [-9 * e, 0, 0], hips: [0, 0.015 * e, 0], arms: {hand_r: {on: 'spine_03', at: [-0.03, 0.2, 0.26], elbow: [-0.7, -1, 0], fingers: [0.1, 1, 0.05], palm: [0, 0, -1]}}, armsWeight: e};
  },
  sigh: (p) => {
    const e = p < 0.3 ? -0.4 * swell(p / 0.3) : swell((p - 0.3) / 0.7);
    return {bend: [9 * e, 0, 0], head: [10 * e, 0, 0]};
  },
  laugh: (p) => {
    const e = swell(p);
    const shake = Math.sin(p * Math.PI * 14);
    return {bend: [(8 + 4 * shake) * e, 0, 0], head: [(-12 + 5 * shake) * e, 0, 0], hips: [0, 0.008 * shake * e, 0]};
  },
  tremble: (p) => ({hips: [0.009 * Math.sin(p * 90) * swell(p), 0, 0], head: [0, 2.6 * Math.sin(p * 118) * swell(p), 0], arms: {}}),
  shrug: (p) => {
    const e = swell(p);
    return {head: [-3 * e, 0, 9 * e], bend: [-3 * e, 0, 0], arms: hands('spine_02', [0.42, 0.04, 0.26], [1, -0.8, -0.3], [0.5, 0, 1], [0, 1, 0]), armsWeight: e};
  },
  wave: (p) => {
    const e = Math.min(swell(p) * 3, 1);
    return {head: [0, 0, 5 * e], arms: {hand_r: {on: 'spine_03', at: [-0.36 + 0.09 * Math.sin(p * Math.PI * 8), 0.56, 0.1], elbow: [-1, -0.8, -0.1], fingers: [-0.25 * Math.sin(p * Math.PI * 8), 1, 0], palm: [0, 0, 1]}, grip_r: 0}, armsWeight: e};
  },
  clap: (p) => {
    const e = Math.min(swell(p) * 3, 1);
    const gap = 0.05 + 0.11 * Math.abs(Math.sin(p * Math.PI * 5));
    return {arms: hands('spine_03', [gap + 0.05, -0.05, 0.36], [0.8, -1, -0.2], [-0.25, 0.3, 1], [-1, 0, 0]), armsWeight: e};
  },
  // Crouches, leaves the ground, lands with a squash.
  jump: (p) => {
    const crouch = p < 0.28 ? swell(p / 0.56) : p > 0.72 ? swell((p - 0.72) / 0.28) : 0;
    const air = p >= 0.28 && p <= 0.72 ? (p - 0.28) / 0.44 : -1;
    return {hips: [0, -0.2 * crouch, -0.05 * crouch], bend: [14 * crouch, 0, 0], lift: air >= 0 ? 0.4 * swell(air) : 0, squash: crouch * 0.06 - (air >= 0 ? swell(air) * 0.04 : 0), arms: air >= 0 ? hands('spine_03', [0.52, 0.42, 0.1], [1, -0.6, 0], [0.4, 1, 0], [0, 0, 1]) : {}, armsWeight: air >= 0 ? swell(air) : 0};
  },
  // Hits something: a soft squash that bounces back.
  thud: (p) => ({squash: 0.14 * Math.exp(-5 * p) * Math.cos(p * Math.PI * 3.5)}),
  stomp: (p) => {
    const up = p < 0.4 ? swell(p / 0.8) : 0;
    const down = p >= 0.4 ? Math.exp(-7 * (p - 0.4)) : 0;
    return {arms: {foot_r: {at: [-0.114, 0.086 + up * 0.2, -0.04 + up * 0.08]}}, armsWeight: up > 0 ? 1 : 0, bend: [-3 * up + 8 * down, 0, 0], squash: down * 0.05};
  },
};

export type Rig = {root: THREE.Object3D; bones: BoneMap; restWorld: Map<string, THREE.Quaternion>; restPos: Map<string, THREE.Vector3>};

const local = new THREE.Matrix4();
const unit = new THREE.Vector3(1, 1, 1);

// A bone's transform in actor space. The actor's own place in the scene is applied afterwards, by the group it's in.
function actorSpace(bone: THREE.Object3D, root: THREE.Object3D) {
  const m = new THREE.Matrix4();
  for (let o: THREE.Object3D | null = bone; o; o = o === root ? null : o.parent) m.premultiply(local.compose(o.position, o.quaternion, unit));
  return m;
}
const posOf = (bone: THREE.Object3D, root: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(actorSpace(bone, root));
const rotOf = (bone: THREE.Object3D, root: THREE.Object3D) => new THREE.Quaternion().setFromRotationMatrix(actorSpace(bone, root));

const euler = (v: readonly number[], order: THREE.EulerOrder = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(v[0] * RAD, v[1] * RAD, v[2] * RAD, order));

// Rotates a bone in the axes the whole body has when standing, relative to wherever its parents have taken it: x forward, y to the left, z to the right.
export function turn(rig: Rig, name: string, angles: readonly number[], amount = 1, order: THREE.EulerOrder = 'XYZ') {
  const bone = rig.bones.get(name);
  const rest = rig.restWorld.get(name);
  if (!bone || !rest) return;
  const d = euler([angles[0] * amount, angles[1] * amount, angles[2] * amount], order);
  bone.quaternion.multiply(rest.clone().invert().multiply(d).multiply(rest));
}

function setActorRotation(bone: THREE.Object3D, root: THREE.Object3D, q: THREE.Quaternion, weight: number) {
  const parent = bone.parent === root || !bone.parent ? new THREE.Quaternion() : rotOf(bone.parent, root);
  bone.quaternion.slerp(parent.invert().multiply(q), weight);
}

function aim(bone: THREE.Object3D, root: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  const d = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  const parent = bone.parent === root || !bone.parent ? new THREE.Quaternion() : rotOf(bone.parent, root);
  const self = rotOf(bone, root);
  bone.quaternion.copy(parent.invert().multiply(d).multiply(self));
}

// Bends a limb so that its end lands on the target, with the middle joint swinging towards `pole`.
function reachFor(rig: Rig, upper: string, lower: string, end: string, target: THREE.Vector3, pole: THREE.Vector3) {
  const {root, bones} = rig;
  const a = bones.get(upper) as THREE.Bone;
  const b = bones.get(lower) as THREE.Bone;
  const c = bones.get(end) as THREE.Bone;
  const pa = posOf(a, root);
  const pb = posOf(b, root);
  const pc = posOf(c, root);
  const l1 = pa.distanceTo(pb);
  const l2 = pb.distanceTo(pc);
  const towards = target.clone().sub(pa);
  const reach = Math.min(l1 + l2 - 0.002, Math.max(Math.abs(l1 - l2) + 0.002, towards.length()));
  const dir = towards.normalize();
  const along = (l1 * l1 + reach * reach - l2 * l2) / (2 * reach);
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
  side.normalize();
  const joint = pa.clone().addScaledVector(dir, along).addScaledVector(side, out);
  aim(a, root, pb.clone().sub(pa), joint.clone().sub(pa));
  const nb = posOf(b, root);
  const nc = posOf(c, root);
  aim(b, root, nc.sub(nb), pa.clone().addScaledVector(dir, reach).sub(nb));
}

const mix3 = (a: V3 | undefined, b: V3 | undefined, k: number): V3 => {
  const x = a ?? [0, 0, 0];
  const y = b ?? [0, 0, 0];
  return [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
};
const add3 = (a: V3, b?: V3): V3 => (b ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : a);

const toPose = (p: Cue['pose']): BodyPose => {
  if (Array.isArray(p)) {
    // Only what's added is on top: a hand on the face doesn't undo sitting. Angles and offsets add together.
    return p.map(toPose).reduce((a, b) => ({...a, ...b, hips: b.hips && a.hips ? add3(a.hips, b.hips) : b.hips ?? a.hips, bend: b.bend && a.bend ? add3(a.bend, b.bend) : b.bend ?? a.bend, head: b.head && a.head ? add3(a.head, b.head) : b.head ?? a.head}), {} as BodyPose);
  }
  return typeof p === 'string' ? POSES[p] : p;
};

// Where the two poses being moved between are, and how far along.
function cueAt(cues: Cue[], t: number) {
  const sorted = [...cues].sort((a, b) => a.at - b.at);
  let i = -1;
  sorted.forEach((c, n) => {
    if (c.at <= t) i = n;
  });
  if (i <= 0) {
    const first = toPose(sorted[0]?.pose ?? 'stand');
    return {from: first, to: first, at: -1e6, take: 1};
  }
  return {from: toPose(sorted[i - 1].pose), to: toPose(sorted[i].pose), at: sorted[i].at, take: sorted[i].take ?? 0.7};
}

export type Staging = {
  cues?: Cue[];
  gestures?: Gesture[];
  t: number;
  phase: number;
  // 0 to 1: how much the actor is walking, which frees the legs and arms to follow the gait.
  walking: number;
  // Turns a point in the scene into actor space.
  fromWorld: (p: THREE.Vector3) => THREE.Vector3;
  lookAt?: {at: number; to: V3 | ((t: number) => V3) | null}[];
  still?: boolean;
};

export type Acted = {lift: number; squash: number; grounded: number; eyeX: number; eyeY: number};

function lookWeights(s: Staging) {
  const list = [...(s.lookAt ?? [])].sort((a, b) => a.at - b.at);
  let i = -1;
  list.forEach((l, n) => {
    if (l.at <= s.t) i = n;
  });
  if (i < 0) return null;
  const resolve = (l: (typeof list)[number]) => (typeof l.to === 'function' ? l.to(s.t) : l.to);
  const k = smooth(clamp01((s.t - list[i].at) / 0.45));
  return {from: i > 0 ? resolve(list[i - 1]) : null, to: resolve(list[i]), k};
}

// The whole performance for this moment: writes the bones, over the top of any clip already on them.
export function stage(rig: Rig, s: Staging): Acted {
  const {root, bones} = rig;
  const {t, phase} = s;
  const {from, to, at, take} = cueAt(s.cues ?? [], t);
  // Parts arrive one after another: the hips lead, the head and hands trail, which is most of what makes a move feel alive.
  const part = (delay: number) => acted((t - at - take * delay) / take);
  const kBody = part(0);
  const kBack = part(0.08);
  const kHead = part(0.16);
  const kArm = part(0.12);

  let hips = mix3(from.hips, to.hips, kBody);
  let body = mix3(from.body, to.body, kBody);
  let bend = mix3(from.bend, to.bend, kBack);
  let head = mix3(from.head, to.head, kHead);
  let lift = 0;
  let squash = 0;
  const overlays: {pose: Partial<BodyPose>; weight: number}[] = [];
  for (const g of s.gestures ?? []) {
    const p = (t - g.at) / (g.take ?? SECONDS[g.kind]);
    if (p < 0 || p > 1) continue;
    const e = GESTURES[g.kind](p);
    hips = add3(hips, e.hips);
    bend = add3(bend, e.bend);
    head = add3(head, e.head);
    lift += e.lift ?? 0;
    squash += e.squash ?? 0;
    if (e.arms && e.armsWeight) overlays.push({pose: e.arms, weight: e.armsWeight});
  }

  const plantFrom = from.plant === false ? 0 : 1;
  const plantTo = to.plant === false ? 0 : 1;
  const plant = (plantFrom + (plantTo - plantFrom) * kBody) * (1 - s.walking);

  // Small signs of life, so that a held pose never looks frozen. They shrink when the actor is lying down.
  if (!s.still) {
    const breath = Math.sin(t * 1.55 + phase * 9);
    bend = add3(bend, [breath * 0.9, 0, 0]);
    head = add3(head, [Math.sin(t * 0.83 + phase * 5) * 1.2 * plant, Math.sin(t * 0.41 + phase * 3) * 2 * plant, 0]);
    hips = add3(hips, [Math.sin(t * 0.52 + phase * 4) * 0.009 * plant, breath * 0.0025 * plant, 0]);
    bend = add3(bend, [0, 0, Math.sin(t * 0.52 + phase * 4 + 0.5) * 0.7 * plant]);
    turn(rig, 'clavicle_l', [0, 0, breath * 0.7]);
    turn(rig, 'clavicle_r', [0, 0, -breath * 0.7]);
  }

  const pelvis = bones.get('pelvis') as THREE.Bone;
  const parentQ = pelvis.parent === root || !pelvis.parent ? new THREE.Quaternion() : rotOf(pelvis.parent, root);
  pelvis.position.add(new THREE.Vector3(...hips).applyQuaternion(parentQ.invert()));
  turn(rig, 'pelvis', body);
  for (const name of ['spine_01', 'spine_02', 'spine_03']) turn(rig, name, bend, 1 / 3);

  // Where the eyes go.
  let eyeX = 0;
  let eyeY = 0;
  const look = lookWeights(s);
  if (look) {
    const headBone = bones.get('Head') as THREE.Bone;
    const headAt = posOf(headBone, root);
    const chest = rotOf(bones.get('spine_03') as THREE.Bone, root).multiply((rig.restWorld.get('spine_03') as THREE.Quaternion).clone().invert()).invert();
    const angles = (p: V3 | null): [number, number] => {
      if (!p) return [0, 0];
      const d = s.fromWorld(new THREE.Vector3(...p)).sub(headAt).applyQuaternion(chest);
      return [Math.atan2(d.x, d.z) / RAD, -Math.atan2(d.y, Math.hypot(d.x, d.z)) / RAD];
    };
    const [y0, x0] = angles(look.from);
    const [y1, x1] = angles(look.to);
    const yaw = y0 + (y1 - y0) * look.k;
    const pitch = x0 + (x1 - x0) * look.k;
    head = add3(head, [Math.max(-32, Math.min(32, pitch)) * 0.85, Math.max(-68, Math.min(68, yaw)) * 0.85, 0]);
    eyeX = Math.max(-1, Math.min(1, (y1 - y0) * (1 - look.k) / 30 + yaw / 80));
    eyeY = Math.max(-1, Math.min(1, -pitch / 45));
  }
  // A big head on a short neck: looking down eases off early, or the chin disappears into the chest. It turns first and then nods, as a head does.
  const nod: V3 = [head[0] > 0 ? 26 * Math.tanh(head[0] / 26) : head[0], head[1], head[2]];
  turn(rig, 'neck_01', nod, 0.4, 'YXZ');
  turn(rig, 'Head', nod, 0.6, 'YXZ');

  const anchor = (r: Reach, fallback: THREE.Vector3) => {
    if (r.on === 'world') return s.fromWorld(new THREE.Vector3(...r.at));
    if (!r.on || r.on === 'root') return new THREE.Vector3(...r.at);
    const bone = bones.get(r.on);
    if (!bone) return fallback;
    const q = rotOf(bone, root).multiply((rig.restWorld.get(r.on) as THREE.Quaternion).clone().invert());
    return posOf(bone, root).add(new THREE.Vector3(...r.at).applyQuaternion(q));
  };

  // The rotation a hand needs for its fingers and palm to face the way this Reach says, or null if it doesn't say.
  const wristFor = (side: 'l' | 'r', r?: Reach) => {
    if (!r?.fingers && !r?.palm) return null;
    const key = `hand_${side}`;
    const hand = bones.get(key) as THREE.Bone;
    const rest = rig.restWorld.get(key) as THREE.Quaternion;
    const frame = r.on && r.on !== 'root' && r.on !== 'world' && bones.get(r.on) ? rotOf(bones.get(r.on) as THREE.Bone, root).multiply((rig.restWorld.get(r.on) as THREE.Quaternion).clone().invert()) : new THREE.Quaternion();
    const relative = rotOf(hand, root).multiply(rest.clone().invert());
    const out = new THREE.Vector3(side === 'l' ? 1 : -1, 0, 0);
    const finger = r.fingers ? new THREE.Vector3(...r.fingers).applyQuaternion(frame).normalize() : out.clone().applyQuaternion(relative);
    const palm = (r.palm ? new THREE.Vector3(...r.palm).applyQuaternion(frame) : new THREE.Vector3(0, -1, 0).applyQuaternion(relative)).addScaledVector(finger, -(r.palm ? new THREE.Vector3(...r.palm).applyQuaternion(frame) : new THREE.Vector3(0, -1, 0).applyQuaternion(relative)).dot(finger));
    if (palm.lengthSq() < 1e-6) return null;
    palm.normalize();
    const basis = (f: THREE.Vector3, n: THREE.Vector3) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, n, f.clone().cross(n)));
    return basis(finger, palm).multiply(basis(out, new THREE.Vector3(0, -1, 0)).invert()).multiply(rest);
  };

  const chestQ = rotOf(bones.get('spine_03') as THREE.Bone, root).multiply((rig.restWorld.get('spine_03') as THREE.Quaternion).clone().invert());
  const hipQ = rotOf(pelvis, root).multiply((rig.restWorld.get('pelvis') as THREE.Quaternion).clone().invert());

  // Legs first, then arms, since a hand may be resting on a thigh.
  for (const side of ['l', 'r'] as const) {
    const key = `foot_${side}` as const;
    const foot = bones.get(key) as THREE.Bone;
    const here = posOf(foot, root);
    const rest = rig.restPos.get(key) as THREE.Vector3;
    const target = (p: BodyPose): [THREE.Vector3, number] => (p[key] ? [anchor(p[key] as Reach, here), 1] : p.plant === false ? [here, 0] : [rest.clone(), 1]);
    const [a, wa] = target(from);
    const [b, wb] = target(to);
    const kl = kBody;
    let weight = wa * (1 - kl) + wb * kl;
    let aimAt = a.clone().multiplyScalar(wa * (1 - kl)).addScaledVector(b, wb * kl).divideScalar(Math.max(1e-5, weight));
    let toes = (from[key]?.toes ?? 0) * wa * (1 - kl) + (to[key]?.toes ?? 0) * wb * kl;
    if (!(from[key] || to[key])) weight *= 1 - s.walking;
    for (const o of overlays) {
      const r = o.pose[key];
      if (!r) continue;
      aimAt = aimAt.lerp(anchor(r, here), o.weight);
      weight = Math.max(weight, o.weight);
      toes = 0;
    }
    if (weight < 0.002) continue;
    const goal = here.clone().lerp(aimAt, Math.min(1, weight));
    const knee = (from[key]?.elbow || to[key]?.elbow) ? new THREE.Vector3(...mix3(from[key]?.elbow, to[key]?.elbow, kl)) : new THREE.Vector3(side === 'l' ? 0.12 : -0.12, 0, 1).applyQuaternion(hipQ);
    reachFor(rig, `thigh_${side}`, `calf_${side}`, key, goal, knee);
    // A planted foot stays flat, whatever the leg above it is doing.
    const flat = euler([-toes, side === 'l' ? 11 : -11, 0]).multiply(rig.restWorld.get(key) as THREE.Quaternion);
    setActorRotation(foot, root, flat, Math.min(1, weight));
  }

  for (const side of ['l', 'r'] as const) {
    const key = `hand_${side}` as const;
    const hand = bones.get(key) as THREE.Bone;
    const here = posOf(hand, root);
    const sign = side === 'l' ? 1 : -1;
    const a = from[key];
    const b = to[key];
    let aimAt = here.clone();
    let weight = 0;
    if (a || b) {
      const wa = a ? 1 - kArm : 0;
      const wb = b ? kArm : 0;
      weight = Math.max(0, Math.min(1, wa + wb));
      const pa = a ? anchor(a, here) : here;
      const pb = b ? anchor(b, here) : here;
      aimAt = pa.clone().lerp(pb, a && b ? kArm : b ? 1 : 0);
      // On the way between two targets the hand swings out in front, rather than through the body.
      if (a && b) {
        const between = swell(clamp01(kArm));
        aimAt.add(new THREE.Vector3(sign * 0.1, 0, 0.14).applyQuaternion(chestQ).multiplyScalar(between * Math.min(1, pa.distanceTo(pb) * 2.5)));
      }
    }
    let elbow = new THREE.Vector3(...mix3(a?.elbow ?? b?.elbow ?? [sign, -1, -0.4], b?.elbow ?? a?.elbow ?? [sign, -1, -0.4], kArm));
    // A hand at rest hangs softly half-closed.
    let grip = (from[`grip_${side}`] ?? 0.3) + ((to[`grip_${side}`] ?? 0.3) - (from[`grip_${side}`] ?? 0.3)) * kArm;
    let pointing = kArm < 0.5 ? from[`point_${side}`] : to[`point_${side}`];
    for (const o of overlays) {
      const r = o.pose[key];
      if (!r) continue;
      aimAt = (weight > 0 ? aimAt : here.clone()).lerp(anchor(r, here), o.weight);
      weight = Math.max(weight, o.weight);
      if (r.elbow) elbow = elbow.lerp(new THREE.Vector3(...r.elbow), o.weight);
      const g = o.pose[`grip_${side}`];
      if (g !== undefined) grip += (g - grip) * o.weight;
      pointing = pointing || o.pose[`point_${side}`];
    }
    if (weight > 0.002) reachFor(rig, `upperarm_${side}`, `lowerarm_${side}`, key, here.clone().lerp(aimAt, weight), elbow.applyQuaternion(chestQ));
    // The wrist turns to its pose a little behind the arm, and the hand trails the move, instead of being carried along stiffly at the end of it.
    const kWrist = part(0.2);
    const qa = wristFor(side, a);
    const qb = wristFor(side, b);
    const wrist = qa && qb ? qa.slerp(qb, clamp01(kWrist)) : qb ?? qa;
    const wristWeight = qa && qb ? 1 : qb ? clamp01(kWrist) : qa ? 1 - clamp01(kWrist) : 0;
    if (wrist && wristWeight > 0.002) setActorRotation(hand, root, wrist, wristWeight);
    for (const o of overlays) {
      const q = wristFor(side, o.pose[key]);
      if (q) setActorRotation(hand, root, q, o.weight);
    }
    const inMotion = t > at && t < at + take * 1.2 ? swell((t - at) / (take * 1.2)) : 0;
    if (inMotion && (a !== b)) turn(rig, key, [0, 0, -sign * 16 * inMotion]);
    curlFingers(rig, side, grip, !!pointing);
  }

  const grounded = plant * clamp01(1 - lift * 3);
  return {lift, squash, grounded, eyeX, eyeY};
}

function curlFingers(rig: Rig, side: 'l' | 'r', grip: number, point: boolean) {
  const sign = side === 'l' ? -1 : 1;
  for (const finger of ['index', 'middle', 'ring', 'pinky']) {
    const curl = finger === 'index' && point ? 0 : grip;
    // Fingers lie together rather than splayed out.
    const spread = {index: 5, middle: 1.5, ring: -2, pinky: -6}[finger] as number;
    turn(rig, `${finger}_01_${side}`, [0, spread * sign, sign * 62 * curl]);
    turn(rig, `${finger}_02_${side}`, [0, 0, sign * 74 * curl]);
    turn(rig, `${finger}_03_${side}`, [0, 0, sign * 42 * curl]);
  }
  turn(rig, `thumb_01_${side}`, [0, sign * -24 * grip, sign * 12 * grip]);
  turn(rig, `thumb_02_${side}`, [0, 0, sign * 30 * grip]);
}

// Where someone is, and how they got there. `move` says how they travel to this mark from the one before.
export type Mark = {at: number; pos: V3; face?: number; move?: 'walk' | 'glide' | 'drop' | 'hop'};

const flat = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[2] - a[2]);

function heading(path: Mark[], i: number): number {
  const m = path[i];
  if (m.face !== undefined) return m.face;
  const n = path[i + 1];
  if (n && (n.move ?? 'walk') === 'walk' && flat(m.pos, n.pos) > 0.001) return Math.atan2(n.pos[0] - m.pos[0], n.pos[2] - m.pos[2]) / RAD;
  return i > 0 ? heading(path, i - 1) : 0;
}

const moved = (a?: Mark, b?: Mark) => !!a && !!b && flat(a.pos, b.pos) + Math.abs(a.pos[1] - b.pos[1]) > 0.001;

export type Place = {pos: THREE.Vector3; face: number; speed: number; travelled: number; walking: boolean};

// Pure function of time. People speed up from a standstill and slow down into one, and swing round to face where they're going rather than snapping.
export function markAt(path: Mark[], t: number): Place {
  let i = 0;
  while (i < path.length - 1 && path[i + 1].at <= t) i++;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  const span = b.at - a.at;
  const length = flat(a.pos, b.pos);
  const style = b.move ?? 'walk';
  let k = 0;
  let speed = 0;
  if (span > 0 && t >= a.at && moved(a, b)) {
    const inside = Math.min(span, t - a.at);
    if (style === 'drop') {
      k = (inside / span) ** 2;
    } else {
      // Speed ramps up from a stop and down into one, and carries through when one move runs on into the next.
      const rampIn = moved(path[i - 1], a) ? 0 : Math.min(0.35, span / 2);
      const rampOut = moved(b, path[i + 2]) ? 0 : Math.min(0.35, span / 2);
      const top = 1 / (span - rampIn / 2 - rampOut / 2);
      if (rampIn && inside < rampIn) {
        k = (top * inside * inside) / (2 * rampIn);
        speed = (top * inside) / rampIn;
      } else if (rampOut && inside > span - rampOut) {
        const left = span - inside;
        k = 1 - (top * left * left) / (2 * rampOut);
        speed = (top * left) / rampOut;
      } else {
        k = top * (inside - rampIn / 2);
        speed = top;
      }
      speed *= length;
    }
  }
  const pos = new THREE.Vector3(...a.pos).lerp(new THREE.Vector3(...b.pos), k);
  if (style === 'hop' && k > 0 && k < 1) pos.y += Math.sin(k * Math.PI) * Math.max(0.2, length * 0.3);
  let travelled = 0;
  for (let n = 0; n < i; n++) if ((path[n + 1].move ?? 'walk') === 'walk') travelled += flat(path[n].pos, path[n + 1].pos);
  if (style === 'walk') travelled += length * k;
  const now = heading(path, i);
  let face = now;
  if (i > 0) {
    const before = heading(path, i - 1);
    const change = ((now - before + 540) % 360) - 180;
    const p = clamp01((t - a.at) / 0.45);
    face = before + change * (p * p * (3 - 2 * p));
  }
  return {pos, face, speed: style === 'walk' ? speed : 0, travelled, walking: style === 'walk' && speed > 0};
}
