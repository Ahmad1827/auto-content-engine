import {createPortal} from '@react-three/fiber';
import {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {type Cue, type Gesture, type Mark, markAt, stage, turn} from './acting';
import {applyClip, type BoneMap, type Clip, clipTime, type Clips, loadClips, loadModel, type Rest, softDisc} from './rig';

export {markAt, type Mark} from './acting';

const RAD = Math.PI / 180;

export type Mood = 'neutral' | 'happy' | 'sad' | 'angry' | 'scared' | 'shocked';
export type HairStyle = 'parted' | 'long' | 'buns' | 'buzzed' | 'none';

export type Look = {
  body?: 'm' | 'f';
  skin?: string;
  shirt?: string;
  pants?: string;
  shoes?: string;
  sole?: string;
  sleeves?: 'long' | 'short' | 'none';
  // Bare legs from just above the knee down, for shorts.
  shorts?: boolean;
  // A sleeveless layer over the shirt: waistcoat, flak vest, apron, jacket front.
  vest?: string;
  tie?: string;
  gloves?: string;
  // Bare feet with toes, in place of shoes.
  barefoot?: boolean;
  hair?: HairStyle;
  hairColor?: string;
  eyeColor?: string;
  beard?: boolean;
  // 0 is an everyday build, 1 is big and bulky.
  muscle?: number;
};

// One step of what the actor is doing. `clip` is a name from clips.json, `at` is in seconds of film time.
export type Act = {at: number; clip: string; fade?: number; speed?: number; offset?: number; keepRoot?: boolean};
export type Pose = Record<string, [number, number, number]>;

export type ActorProps = {
  look?: Look;
  // Motion capture to play. Leave it out and the actor stands relaxed and walks by themselves whenever `path` moves them.
  act?: Act[];
  path?: Mark[];
  // The poses they strike over time. See POSES in acting.ts.
  cues?: Cue[];
  // Quick pieces of acting on top of the pose.
  gestures?: Gesture[];
  // Who or what they're looking at: a point in the scene, a function of time for something moving, or null to look ahead.
  lookAt?: {at: number; to: [number, number, number] | ((t: number) => [number, number, number]) | null}[];
  mood?: Mood | {at: number; mood: Mood}[];
  // [start, end] seconds when the mouth moves.
  talk?: [number, number][];
  // Extra rotation in degrees per bone, x forward, y to their left, z to their right, as if standing in a T. Bones: root pelvis spine_01..03 neck_01 Head
  // clavicle_l/r upperarm_l/r lowerarm_l/r hand_l/r thigh_l/r calf_l/r foot_l/r.
  pose?: (t: number) => Pose;
  // Anything in here sticks to that bone, e.g. {hand_r: <Mug />}. Each child sits at the bone's origin with its axes aligned to the actor.
  hold?: Record<string, React.ReactNode>;
  scale?: number;
  // How open the eyes are, 0 (shut, for sleeping) to 1. They also blink on their own while above 0.
  eyes?: number | ((t: number) => number);
  // Delays every clip loop and blink so that crowds don't step in time.
  phase?: number;
  // No breathing or swaying: for someone unconscious, or a statue.
  still?: boolean;
  visible?: boolean | ((t: number) => boolean);
};

// Characters are toys on purpose: rounded parts on a motion-capture skeleton, with a drawn-on face. Realistic faces on simplified bodies look creepy.
// Parts are placed in the skeleton's T-pose, where height is y, the arms lie along x and the actor faces +z.
const BUILD = {
  m: {chest: 0.222, waist: 0.2, hips: 0.214, depth: 0.142, head: 1.36, arm: 0.078, leg: 0.112, finger: 0.0185},
  f: {chest: 0.186, waist: 0.164, hips: 0.208, depth: 0.122, head: 1.28, arm: 0.066, leg: 0.102, finger: 0.0165},
};
// The head is an oversized ball, centred this far from the Head bone.
const HEAD_AT = [0, 0.135, 0.012] as const;
const HEAD = {x: 0.135, y: 0.145, z: 0.135};
const EYE = {x: 0.0125, y: 0.0155};
const MOUTH = 0.024;

// Heel to toe along the foot: how far along, half width and height. Heights are measured up from the sole.
const FOOT = [[-0.002, 0.0005, 0.0005], [0, 0.02, 0.03], [0.04, 0.046, 0.085], [0.16, 0.058, 0.122], [0.36, 0.06, 0.122], [0.54, 0.062, 0.08], [0.74, 0.068, 0.058], [0.92, 0.062, 0.05], [0.985, 0.04, 0.036], [1, 0.012, 0.016], [1.002, 0.0005, 0.0005]];

const geometries = new Map<string, THREE.BufferGeometry>();
const shared = (key: string, make: () => THREE.BufferGeometry) => {
  if (!geometries.has(key)) geometries.set(key, make());
  return geometries.get(key) as THREE.BufferGeometry;
};

// A tapered capsule standing on the origin, `length` tall between the centres of its two round ends.
function limb(r0: number, r1: number, length: number) {
  return shared(`limb${r0}/${r1}/${length}`, () => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
      points.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a)));
    }
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      points.push(new THREE.Vector2(r1 * Math.cos(a), length + r1 * Math.sin(a)));
    }
    return new THREE.LatheGeometry(points, 14);
  });
}
const ball = () => shared('ball', () => new THREE.SphereGeometry(1, 24, 16));
// The top of a ball, down to `angle` radians from its pole.
const cap = (angle: number) => shared(`cap${angle}`, () => new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, angle));
const block = (x: number, y: number, z: number, r: number) => shared(`block${x}/${y}/${z}/${r}`, () => new RoundedBoxGeometry(x, y, z, 4, r));
const trs = (p: readonly number[], s: readonly number[] = [1, 1, 1], q = new THREE.Quaternion()) => new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(s[0], s[1], s[2]));
const UP = new THREE.Vector3(0, 1, 0);
const hex = (c: string) => new THREE.Color(c);

function matte(color: string, cache: Map<string, THREE.Material>, side: THREE.Side = THREE.FrontSide) {
  const key = `${color}/${side}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({color, roughness: 0.78, metalness: 0, side}));
  return cache.get(key) as THREE.Material;
}

type Face = {eyes: THREE.Object3D[]; brows: {mesh: THREE.Object3D; side: number; y: number}[]; line: THREE.Object3D; open: THREE.Object3D};

const MOODS: Record<Mood, {curve: number; brow: number; tilt: number; jaw: number; eye: number}> = {
  neutral: {curve: 0.12, brow: 0, tilt: 0, jaw: 0, eye: 1},
  happy: {curve: 1, brow: 0.006, tilt: -0.08, jaw: 0, eye: 1},
  sad: {curve: -0.65, brow: 0.004, tilt: -0.38, jaw: 0, eye: 0.82},
  angry: {curve: -0.5, brow: -0.012, tilt: 0.45, jaw: 0, eye: 0.85},
  scared: {curve: -0.4, brow: 0.014, tilt: -0.3, jaw: 0.45, eye: 1.25},
  shocked: {curve: 0, brow: 0.02, tilt: -0.1, jaw: 1, eye: 1.35},
};

function addHair(head: THREE.Object3D, style: HairStyle, beard: boolean, color: string, skin: string, materials: Map<string, THREE.Material>) {
  const add = (geo: THREE.BufferGeometry, m: THREE.Matrix4, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.applyMatrix4(m);
    mesh.castShadow = true;
    head.add(mesh);
  };
  const paint = matte(color, materials, THREE.DoubleSide);
  // Tipped back so that the hairline clears the brows in front and comes low behind.
  const tip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6);
  // Round rather than head-shaped: tipped, a head-shaped cap would let the skull poke through its crown.
  const round = (r: number) => [HEAD.y * r, HEAD.y * r, HEAD.y * r];
  if (style === 'buzzed') add(cap(1.46), trs([0, 0, 0], round(1.015), tip), matte(`#${hex(color).lerp(hex(skin), 0.3).getHexString()}`, materials, THREE.DoubleSide));
  else if (style !== 'none') add(cap(1.46), trs([0, 0, 0], round(1.05), tip), paint);
  if (style === 'parted') add(ball(), trs([0.052, 0.098, 0.062], [0.095, 0.05, 0.078], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.32)), paint);
  if (style === 'long') {
    // Falls behind the head and frames the face, ending above the chin so it never looks like a beard from the front.
    add(ball(), trs([0, -0.012, -0.045], [0.164, 0.136, 0.128]), paint);
  }
  if (style === 'buns') for (const side of [-1, 1]) add(ball(), trs([side * 0.105, 0.125, -0.02], [0.062, 0.062, 0.062]), paint);
  if (beard) add(ball(), trs([0, -0.098, 0.052], [0.088, 0.052, 0.078]), matte(color, materials));
}

function addFace(head: THREE.Object3D, look: Look, skin: string, materials: Map<string, THREE.Material>): Face {
  const ink = look.eyeColor ?? '#1c1a1f';
  const inkMat = new THREE.MeshBasicMaterial({color: ink});
  const add = (geo: THREE.BufferGeometry, p: readonly number[], s: readonly number[], mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.scale.set(s[0], s[1], s[2]);
    head.add(mesh);
    return mesh;
  };
  const browMat = new THREE.MeshBasicMaterial({color: `#${hex(look.hairColor ?? '#2a1d14').multiplyScalar(0.55).getHexString()}`});
  const eyes: THREE.Object3D[] = [];
  const brows: Face['brows'] = [];
  for (const side of [-1, 1]) {
    eyes.push(add(ball(), [side * 0.05, 0.008, 0.122], [EYE.x, EYE.y, 0.008], inkMat));
    const brow = add(block(1, 1, 1, 0.45), [side * 0.052, 0.05, 0.124], [0.042, 0.0115, 0.012], browMat);
    brows.push({mesh: brow, side, y: 0.05});
  }
  // A curved line for the mouth when it's shut, a dark oval when it's open.
  const line = add(shared('smile', () => new THREE.TorusGeometry(MOUTH, 0.0052, 8, 22, Math.PI * 0.7).rotateZ(Math.PI * 1.15)), [0, -0.06, 0.128], [1, 1, 0.8], inkMat);
  const open = add(ball(), [0, -0.062, 0.122], [0.018, 0.016, 0.008], new THREE.MeshBasicMaterial({color: '#4a1a1e'}));
  return {eyes, brows, line, open};
}

// The trunk is one smooth skin bent by the spine bones, so that it has no seams however the actor leans. Clothes change colour at the belt.
function buildTorso(root: THREE.Object3D, bones: BoneMap, b: (typeof BUILD)['m'], bulk: number, top: string, bottom: string) {
  const at = (name: string) => (bones.get(name) as THREE.Bone).getWorldPosition(new THREE.Vector3());
  const chain = ['pelvis', 'spine_01', 'spine_02', 'spine_03'];
  const spine = chain.map(at);
  const shoulderY = at('upperarm_l').y;
  const lean = (y: number) => {
    let i = 0;
    while (i < spine.length - 2 && spine[i + 1].y < y) i++;
    return {i, k: Math.min(1, Math.max(0, (y - spine[i].y) / (spine[i + 1].y - spine[i].y)))};
  };
  const chestX = b.chest * bulk;
  const d = b.depth * bulk;
  // Half width, height and half depth, from the crotch to the base of the neck.
  const keys = [
    [0.001, spine[0].y - 0.085, 0.001],
    [b.hips * 0.7, spine[0].y - 0.07, b.depth * 0.72],
    [b.hips * 0.98, spine[0].y - 0.03, b.depth * 0.98],
    [b.hips, spine[0].y + 0.02, b.depth * 1.02],
    [b.waist * (1 + (bulk - 1) / 2) * 1.03, spine[1].y + 0.02, d * 0.92],
    [chestX * 0.96, spine[2].y + 0.06, d * 0.96],
    [chestX, spine[3].y + 0.06, d],
    [chestX * 1.16, shoulderY - 0.01, d * 0.84],
    [chestX * 0.9, shoulderY + b.arm * 0.82, d * 0.56],
    [0.001, shoulderY + b.arm * 1.15, 0.001],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(keys, false, 'centripetal');
  const belt = spine[1].y - 0.012;
  const rings = 22;
  const around = 20;
  const levels = Array.from({length: rings + 1}, (_, i) => ({p: curve.getPoint(i / rings), slope: curve.getTangent(i / rings)}));
  // Two rings in the same place at the belt: the one below is trousers, the one above is shirt.
  const crossing = levels.findIndex((l) => l.p.y >= belt);
  levels.splice(crossing, 0, {...levels[crossing], p: levels[crossing].p.clone().setY(belt)}, {...levels[crossing], p: levels[crossing].p.clone().setY(belt)});
  const trouser = hex(bottom);
  const shirt = hex(top);
  const position: number[] = [];
  const normal: number[] = [];
  const color: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const index: number[] = [];
  levels.forEach(({p, slope}, level) => {
    const {i, k} = lean(p.y);
    const z = spine[i].z + (spine[i + 1].z - spine[i].z) * k - 0.006;
    const c = level <= crossing ? trouser : shirt;
    for (let n = 0; n < around; n++) {
      const a = (n / around) * Math.PI * 2;
      position.push(Math.sin(a) * p.x, p.y, z + Math.cos(a) * p.z);
      // Worked out from the profile rather than from the faces, so that the doubled rings at the belt leave no dark crease.
      const rise = Math.max(-3, Math.min(3, -slope.x / Math.max(0.05, Math.abs(slope.y))));
      const out = new THREE.Vector3(Math.sin(a) * p.z, rise * Math.min(p.x, p.z), Math.cos(a) * p.x).normalize();
      normal.push(out.x, out.y, out.z);
      color.push(c.r, c.g, c.b);
      skinIndex.push(i, i + 1, 0, 0);
      skinWeight.push(1 - k, k, 0, 0);
      if (level < levels.length - 1) {
        const m = (n + 1) % around;
        index.push(level * around + n, level * around + m, (level + 1) * around + n, level * around + m, (level + 1) * around + m, (level + 1) * around + n);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.78, metalness: 0}));
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(chain.map((n) => bones.get(n) as THREE.Bone)));
}

// An arm or leg: one smooth skin with no joints showing, bent by its bones. `covered` is how much of its length, from the top, wears `cloth`.
function buildLimb(root: THREE.Object3D, bones: BoneMap, chain: [string, number][], covered: number, cloth: string, skin: string) {
  const points = chain.map(([name]) => (bones.get(name) as THREE.Bone).getWorldPosition(new THREE.Vector3()));
  const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const levels: {at: number; shrink: number}[] = [];
  const CAP = 4;
  for (let i = 0; i < CAP; i++) levels.push({at: 0, shrink: Math.sin(((i + 0.3) / CAP) * (Math.PI / 2))});
  const STEPS = 26;
  for (let i = 0; i <= STEPS; i++) levels.push({at: (i / STEPS) * total, shrink: 1});
  // Clothes end cleanly: two rings in one place, one in each colour.
  const edge = covered * total;
  if (covered < 1) {
    const after = levels.findIndex((l) => l.at >= edge && l.shrink === 1);
    levels.splice(after, 0, {at: edge, shrink: 1}, {at: edge, shrink: 1});
  }
  for (let i = CAP - 1; i >= 0; i--) levels.push({at: total, shrink: Math.sin(((i + 0.3) / CAP) * (Math.PI / 2))});
  const clothColor = hex(cloth);
  const skinColor = hex(skin);
  const around = 16;
  const position: number[] = [];
  const color: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const index: number[] = [];
  const BLEND = 0.055;
  let split = -1;
  levels.forEach((l, level) => {
    if (split === -1 && covered < 1 && l.at === edge) split = level;
    let seg = 0;
    let start = 0;
    while (seg < lengths.length - 1 && l.at > start + lengths[seg]) start += lengths[seg++];
    const k = Math.min(1, (l.at - start) / lengths[seg]);
    const centre = points[seg].clone().lerp(points[seg + 1], k);
    // The end of the last segment caps off in a round tip rather than a flat one.
    const capped = l.shrink < 1 ? (l.at === 0 ? -1 : 1) * Math.sqrt(1 - l.shrink * l.shrink) * chain[l.at === 0 ? 0 : chain.length - 1][1] : 0;
    const dir = points[seg + 1].clone().sub(points[seg]).normalize();
    centre.addScaledVector(dir, capped);
    // Cloth stands a little proud of the skin where it ends, so that a sleeve or a trouser leg reads as a garment.
    const hem = covered < 1 && l.at <= edge && l.at > edge - 0.05 ? 1 + 0.14 * (1 - (edge - l.at) / 0.05) : 1;
    const radius = (chain[seg][1] + (chain[seg + 1][1] - chain[seg][1]) * k) * l.shrink * hem;
    const turn = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    // Near a joint the skin is shared between the two bones, so that it bends instead of creasing.
    const toJoint = start + lengths[seg] - l.at;
    const fromJoint = l.at - start;
    let bone = seg;
    let other = seg;
    let share = 0;
    if (seg < lengths.length - 1 && toJoint < BLEND) {
      other = seg + 1;
      share = 0.5 * (1 - toJoint / BLEND);
    } else if (seg > 0 && fromJoint < BLEND) {
      other = seg - 1;
      share = 0.5 * (1 - fromJoint / BLEND);
    }
    // The last point only ends the limb; its bone (a hand or foot) doesn't bend it.
    if (other === lengths.length) other = bone;
    const c = covered >= 1 || (split === -1 ? l.at < edge : level === split) ? clothColor : skinColor;
    for (let n = 0; n < around; n++) {
      const a = (n / around) * Math.PI * 2;
      const v = new THREE.Vector3(Math.sin(a) * radius, 0, Math.cos(a) * radius).applyQuaternion(turn).add(centre);
      position.push(v.x, v.y, v.z);
      color.push(c.r, c.g, c.b);
      skinIndex.push(bone, other, 0, 0);
      skinWeight.push(1 - share, share, 0, 0);
      if (level < levels.length - 1) {
        const m = (n + 1) % around;
        const here = level * around;
        const next = (level + 1) * around;
        index.push(here + n, here + m, next + n, here + m, next + m, next + n);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.78, metalness: 0}));
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(chain.map(([name]) => bones.get(name) as THREE.Bone)));
}

// A foot or shoe: one smooth shape with a flat sole, that bends where the toes meet the foot. A shoe has a sole in its own colour.
function buildFoot(root: THREE.Object3D, bones: BoneMap, s: 'l' | 'r', size: number, upper: string, sole: string | null) {
  const foot = (bones.get(`foot_${s}`) as THREE.Bone).getWorldPosition(new THREE.Vector3());
  const ballOf = (bones.get(`ball_${s}`) as THREE.Bone).getWorldPosition(new THREE.Vector3());
  const puff = sole ? 1.12 : 1;
  const heel = foot.z - 0.09 * size;
  const length = (sole ? 0.34 : 0.325) * size;
  const profile = new THREE.CatmullRomCurve3(FOOT.map(([u, w, h]) => new THREE.Vector3(w * size * puff, h * size * (sole ? 1.14 : 1), heel + u * length)), false, 'centripetal');
  const rings = 34;
  const around = 28;
  const SOLE = 0.024;
  const position: number[] = [];
  const color: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const index: number[] = [];
  const top = hex(upper);
  const bottom = hex(sole ?? upper);
  for (let i = 0; i <= rings; i++) {
    const p = profile.getPoint(i / rings);
    const bendAt = (p.z - ballOf.z + 0.02) / 0.05;
    const k = Math.min(1, Math.max(0, bendAt));
    for (let n = 0; n < around; n++) {
      const a = (n / around) * Math.PI * 2;
      // Rounder on top, nearly flat underneath.
      const sx = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.75;
      const c = Math.cos(a);
      const y = c >= 0 ? p.y * (0.32 + 0.68 * c ** 0.8) : p.y * 0.32 * (1 - Math.abs(c) ** 3);
      position.push(foot.x + sx * p.x, y, p.z);
      const col = y < SOLE ? bottom : top;
      color.push(col.r, col.g, col.b);
      skinIndex.push(0, 1, 0, 0);
      skinWeight.push(1 - k, k, 0, 0);
      if (i < rings) {
        const m = (n + 1) % around;
        const here = i * around;
        const next = (i + 1) * around;
        index.push(here + n, next + n, here + m, here + m, next + n, next + m);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.78, metalness: 0}));
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  root.add(mesh);
  mesh.bind(new THREE.Skeleton([bones.get(`foot_${s}`) as THREE.Bone, bones.get(`ball_${s}`) as THREE.Bone]));
}

type Built = {root: THREE.Object3D; bones: BoneMap; rest: Rest; restWorld: Map<string, THREE.Quaternion>; restPos: Map<string, THREE.Vector3>; face: Face; straight: Clip};

// Not motion capture: standing or lying perfectly straight, legs together and arms at the sides. Made per actor, since it depends on how their bones point.
function straightClip(bones: BoneMap): Clip {
  const tracks: Clip['tracks'] = ([['upperarm_l', -1], ['upperarm_r', 1]] as const).map(([name, side]) => {
    const bone = bones.get(name) as THREE.Bone;
    const world = bone.getWorldQuaternion(new THREE.Quaternion());
    const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * 1.36);
    const q = bone.quaternion.clone().multiply(world.clone().invert().multiply(down).multiply(world));
    return {b: name, p: 'q' as const, t: [0], v: [q.x, q.y, q.z, q.w]};
  });
  // Elbows soft, feet turned out a little: a person at ease rather than a soldier.
  for (const [name, angle] of [['lowerarm_l', -0.3], ['lowerarm_r', 0.3], ['foot_l', 0.2], ['foot_r', -0.2]] as const) {
    const bone = bones.get(name) as THREE.Bone;
    const world = bone.getWorldQuaternion(new THREE.Quaternion());
    const d = new THREE.Quaternion().setFromAxisAngle(UP, angle);
    const q = bone.quaternion.clone().multiply(world.clone().invert().multiply(d).multiply(world));
    tracks.push({b: name, p: 'q' as const, t: [0], v: [q.x, q.y, q.z, q.w]});
  }
  return {d: 1, tracks};
}

function buildActor(models: Record<string, THREE.Object3D>, look: Look): Built {
  const female = look.body === 'f';
  const root = cloneSkinned(models[female ? 'body_f' : 'body_m']);
  const bones: BoneMap = new Map();
  const rest: Rest = new Map();
  const b = female ? BUILD.f : BUILD.m;
  const skeletonMeshes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      bones.set(o.name, o as THREE.Bone);
      rest.set(o.name, {q: o.quaternion.clone(), p: o.position.clone()});
    } else if ((o as THREE.Mesh).isMesh) skeletonMeshes.push(o);
  });
  // The file only supplies the skeleton.
  skeletonMeshes.forEach((m) => m.removeFromParent());
  root.updateWorldMatrix(true, true);
  const restWorld = new Map<string, THREE.Quaternion>();
  const restPos = new Map<string, THREE.Vector3>();
  for (const [name, bone] of bones) {
    restWorld.set(name, bone.getWorldQuaternion(new THREE.Quaternion()));
    restPos.set(name, bone.getWorldPosition(new THREE.Vector3()));
  }

  const materials = new Map<string, THREE.Material>();
  const skin = look.skin ?? '#e6b48c';
  const shirt = look.shirt ?? '#5b8fd0';
  const pants = look.pants ?? '#2c3140';
  const shoes = look.shoes ?? '#2a2b31';
  const sleeves = look.sleeves ?? 'long';
  const bulk = 1 + (look.muscle ?? 0) * 0.32;
  const at = (name: string) => (bones.get(name) as THREE.Bone).getWorldPosition(new THREE.Vector3());
  const part = (bone: string, geo: THREE.BufferGeometry, m: THREE.Matrix4, color: string) => {
    const mesh = new THREE.Mesh(geo, matte(color, materials));
    const owner = bones.get(bone) as THREE.Bone;
    mesh.applyMatrix4(owner.matrixWorld.clone().invert().multiply(m));
    mesh.castShadow = true;
    owner.add(mesh);
  };
  const between = (bone: string, from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number, color: string) => {
    const d = to.clone().sub(from);
    const len = Math.round(d.length() * 1000) / 1000;
    part(bone, limb(r0, r1, len), trs(from.toArray(), [1, 1, 1], new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())), color);
  };

  const depth = b.depth * bulk;
  const arm = b.arm * bulk;
  const shoulders = at('upperarm_l').y;
  const chestFront = at('spine_03').z - 0.012 + depth;
  buildTorso(root, bones, b, bulk, look.vest ?? shirt, pants);
  // A collar, so that the top reads as a shirt.
  part('spine_03', shared('collar', () => new THREE.TorusGeometry(0.085, 0.016, 8, 20).rotateX(Math.PI / 2)), trs([0, shoulders + arm * 0.72, chestFront - depth - 0.012]), `#${hex(shirt).multiplyScalar(0.82).getHexString()}`);
  between('neck_01', at('neck_01'), at('Head').add(new THREE.Vector3(0, 0.03, 0)), 0.068, 0.068, skin);
  if (look.tie) {
    part('spine_03', block(0.042, 0.27, 0.014, 0.006), trs([0, shoulders - 0.13, chestFront - 0.004]), look.tie);
    part('spine_03', block(0.05, 0.036, 0.018, 0.008), trs([0, shoulders - 0.005, chestFront - 0.012]), look.tie);
  }
  if (look.vest) part('spine_03', block(0.05, 0.3, 0.012, 0.005), trs([0, shoulders - 0.11, chestFront - 0.005]), shirt);

  for (const [s, sign] of [['l', 1], ['r', -1]] as const) {
    const sleeve = sleeves === 'long' ? 1 : sleeves === 'short' ? 0.42 : 0.02;
    buildLimb(root, bones, [[`upperarm_${s}`, arm], [`lowerarm_${s}`, arm * 0.86], [`hand_${s}`, arm * 0.68]], sleeve, shirt, skin);
    const hand = at(`hand_${s}`);
    const knuckle = at(`middle_01_${s}`);
    const glove = look.gloves ?? skin;
    part(`hand_${s}`, ball(), trs(hand.clone().lerp(knuckle, 0.5).toArray(), [knuckle.distanceTo(hand) * 0.68, 0.024, b.finger * 3.1]), glove);
    // Fingers ride the skeleton's finger bones, so hands really grip, point and open with the motion capture.
    for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const size = b.finger * (finger === 'thumb' ? 1.2 : finger === 'pinky' ? 0.86 : 1);
      between(`${finger}_01_${s}`, at(`${finger}_01_${s}`), at(`${finger}_02_${s}`), size, size * 0.94, glove);
      between(`${finger}_02_${s}`, at(`${finger}_02_${s}`), at(`${finger}_04_leaf_${s}`), size * 0.94, size * 0.84, glove);
    }

    const leg = b.leg;
    buildLimb(root, bones, [[`thigh_${s}`, leg], [`calf_${s}`, leg * 0.78], [`foot_${s}`, leg * 0.46]], look.shorts ? 0.42 : look.barefoot ? 0.92 : 0.97, pants, skin);
    const footSize = female ? 0.92 : 1;
    buildFoot(root, bones, s, footSize, look.barefoot ? skin : shoes, look.barefoot ? null : look.sole ?? '#e8e4dc');
    if (look.barefoot) {
      // Toes are soft bumps along the front edge, biggest on the inside.
      const tip = at(`ball_${s}`);
      [0, 1, 2, 3, 4].forEach((toe) => {
        const r = (toe === 0 ? 0.0215 : 0.0155 - toe * 0.001) * footSize;
        const x = at(`foot_${s}`).x - sign * (0.04 - toe * 0.0215) * footSize;
        const z = tip.z + (0.093 - toe * 0.009 - (toe === 0 ? 0 : 0.004)) * footSize;
        part(`ball_${s}`, ball(), trs([x, r * 0.92, z], [r, r * 0.92, r * 1.3]), skin);
      });
    }
  }

  // Everything on the head is placed from its centre.
  const head = new THREE.Group();
  const headBone = bones.get('Head') as THREE.Bone;
  const c = at('Head').add(new THREE.Vector3(...HEAD_AT));
  head.applyMatrix4(headBone.matrixWorld.clone().invert().multiply(trs(c.toArray(), [b.head, b.head, b.head])));
  headBone.add(head);
  const skull = new THREE.Mesh(shared('skull', () => new THREE.SphereGeometry(1, 40, 28)), matte(skin, materials));
  skull.scale.set(HEAD.x, HEAD.y, HEAD.z);
  skull.castShadow = true;
  head.add(skull);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(ball(), matte(skin, materials));
    ear.position.set(side * 0.133, -0.008, 0.002);
    ear.scale.set(0.017, 0.034, 0.023);
    ear.castShadow = true;
    head.add(ear);
  }
  addHair(head, look.hair ?? (female ? 'long' : 'parted'), !!look.beard, look.hairColor ?? '#2a1d14', skin, materials);
  return {root, bones, rest, restWorld, restPos, face: addFace(head, look, skin, materials), straight: straightClip(bones)};
}

const ALL_MODELS = ['body_m', 'body_f'];

type Assets = {clips: Clips; models: Record<string, THREE.Object3D>};

let assets: Assets | null = null;

// The Stage waits on this before it mounts, so an Actor always has its files on the very first render of a frame.
export const loadActorAssets = () =>
  Promise.all([loadClips(), ...ALL_MODELS.map(loadModel)]).then(([clips, ...scenes]) => {
    assets = {clips: clips as Clips, models: Object.fromEntries(ALL_MODELS.map((name, i) => [name, scenes[i] as THREE.Object3D]))};
    return assets;
  });

const smooth = (x: number) => x * x * (3 - 2 * x);

// How to move over the ground at a given speed, and how fast each clip covers ground.
const GAITS = [{clip: 'Walk_Loop', pace: 1.5, from: 0}, {clip: 'Jog_Fwd_Loop', pace: 3.2, from: 2.3}, {clip: 'Sprint_Loop', pace: 6, from: 4.6}];

type MoodFace = (typeof MOODS)[Mood];

function moodAt(mood: ActorProps['mood'], t: number): MoodFace {
  if (typeof mood === 'string' || !mood) return MOODS[(mood as Mood) ?? 'neutral'];
  const list = [...mood].sort((a, b) => a.at - b.at);
  let i = 0;
  list.forEach((m, n) => {
    if (m.at <= t) i = n;
  });
  const b = MOODS[list[i].mood];
  if (i === 0) return b;
  const a = MOODS[list[i - 1].mood];
  const k = smooth(Math.min(1, Math.max(0, (t - list[i].at) / 0.22)));
  return {curve: a.curve + (b.curve - a.curve) * k, brow: a.brow + (b.brow - a.brow) * k, tilt: a.tilt + (b.tilt - a.tilt) * k, jaw: a.jaw + (b.jaw - a.jaw) * k, eye: a.eye + (b.eye - a.eye) * k};
}

// A rigged person. Everything is a pure function of the frame, so any frame can be rendered alone.
export const Actor: React.FC<ActorProps> = ({look = {}, act, path, cues, gestures, lookAt, mood = 'neutral', talk = [], pose, hold, eyes = 1, scale = 1, phase = 0, still = false, visible = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!assets) throw new Error('Actor must be inside a Stage');
  const {clips} = assets;
  const {models} = assets;
  const key = JSON.stringify(look);
  const built = useMemo(() => buildActor(models, look), [models, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = frame / fps;
  const shown = typeof visible === 'function' ? visible(t) : visible;
  if (!shown) return null;

  const {bones, rest, face} = built;
  for (const [name, r] of rest) {
    const bone = bones.get(name) as THREE.Bone;
    bone.quaternion.copy(r.q);
    bone.position.copy(r.p);
  }
  const place = path?.length ? markAt(path, t) : null;
  const steps = [...(act ?? [{at: 0, clip: 'Straight'}])].sort((a, b) => a.at - b.at);
  let cur = -1;
  steps.forEach((s, i) => {
    if (s.at <= t) cur = i;
  });
  const play = (s: (typeof steps)[number], weight: number) => {
    const clip = s.clip === 'Straight' ? built.straight : clips[s.clip];
    if (!clip) throw new Error(`Unknown clip "${s.clip}"`);
    applyClip(bones, rest, clip, clipTime(s.clip, clip, (t - s.at) * (s.speed ?? 1) + (s.offset ?? 0) + phase), weight, s.keepRoot);
  };
  if (cur === -1 && steps[0]) play(steps[0], 1);
  if (cur > 0) play(steps[cur - 1], 1);
  if (cur >= 0) play(steps[cur], cur === 0 ? 1 : smooth(Math.min(1, (t - steps[cur].at) / (steps[cur].fade ?? 0.22))));

  // Left to themselves, people walk when they're moved. The stride comes from the ground covered, so feet can't slide.
  let walking = 0;
  if (!act && place?.walking) {
    walking = smooth(Math.min(1, place.speed / (0.5 * scale)));
    const gait = [...GAITS].reverse().find((g) => place.speed / scale >= g.from) ?? GAITS[0];
    applyClip(bones, rest, clips[gait.clip], clipTime(gait.clip, clips[gait.clip], place.travelled / scale / gait.pace + phase), walking);
  }

  const here = place?.pos ?? new THREE.Vector3();
  const facing = new THREE.Quaternion().setFromAxisAngle(UP, (place?.face ?? 0) * RAD);
  const acted = stage({root: built.root, bones, restWorld: built.restWorld, restPos: built.restPos}, {
    cues: cues ?? (act ? undefined : [{at: 0, pose: 'stand'}]),
    gestures,
    lookAt,
    t,
    phase,
    still,
    walking,
    fromWorld: (p) => p.clone().sub(here).applyQuaternion(facing.clone().invert()).divideScalar(scale),
  });

  if (pose) {
    const rig = {root: built.root, bones, restWorld: built.restWorld, restPos: built.restPos};
    for (const [name, angles] of Object.entries(pose(t))) turn(rig, name, angles);
  }

  const m = moodAt(mood, t);
  const speaking = talk.some(([a, b]) => t >= a && t <= b);
  const chatter = speaking ? 0.2 + 0.8 * Math.abs(Math.sin(t * 11 + 1.3 * Math.sin(t * 4.3))) : 0;
  const jaw = Math.max(m.jaw, chatter);
  const lidOpen = typeof eyes === 'function' ? eyes(t) : eyes;
  const beat = (t + phase * 7.3) % 3.4;
  const blinking = beat < 0.14 ? Math.abs(beat - 0.07) / 0.07 : 1;
  const open = Math.max(0, Math.min(1.4, lidOpen * m.eye)) * blinking;
  face.eyes.forEach((eye, i) => {
    eye.scale.set(EYE.x * (1 + 0.5 * (1 - Math.min(1, open))), EYE.y * Math.max(0.14, open), 0.008);
    eye.position.x = (i === 0 ? -0.05 : 0.05) + acted.eyeX * 0.012;
    eye.position.y = 0.008 + acted.eyeY * 0.008;
  });
  for (const brow of face.brows) {
    brow.mesh.position.y = brow.y + m.brow + (lidOpen < 0.3 ? -0.006 : 0);
    brow.mesh.rotation.z = brow.side * m.tilt;
  }
  face.line.visible = jaw < 0.12;
  face.line.scale.y = m.curve;
  face.line.position.y = -0.062 + MOUTH * m.curve;
  face.open.visible = !face.line.visible;
  face.open.scale.set(0.018 - jaw * 0.004, 0.005 + jaw * 0.016, 0.008);

  const widen = 1 + acted.squash;
  return (
    <group position={[here.x, here.y + acted.lift, here.z]} rotation={[0, (place?.face ?? 0) * RAD, 0]} scale={[scale * widen, scale * (1 - acted.squash * 1.6), scale * widen]}>
      <primitive object={built.root} />
      {hold && Object.entries(hold).map(([bone, node]) => <Held key={bone} bone={bones.get(bone)} root={built.root}>{node}</Held>)}
      <mesh position={[0, 0.008 - acted.lift, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={0.95 * (1 - acted.lift * 0.8)} visible={acted.grounded + walking > 0.15}>
        <planeGeometry />
        <meshBasicMaterial map={softDisc()} color="#160f28" transparent opacity={0.5 * Math.min(1, acted.grounded + walking)} depthWrite={false} />
      </mesh>
    </group>
  );
};

// Keeps a prop on a bone's position while the prop's axes stay in actor space, which is far easier to reason about than bone axes.
const Held: React.FC<{bone?: THREE.Bone; root: THREE.Object3D; children: React.ReactNode}> = ({bone, root, children}) => {
  if (!bone) return null;
  const toActor = new THREE.Quaternion();
  for (let o: THREE.Object3D | null = bone; o && o !== root; o = o.parent) toActor.premultiply(o.quaternion);
  return createPortal(<group quaternion={toActor.invert()}>{children}</group>, bone);
};
