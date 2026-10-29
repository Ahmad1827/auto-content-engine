import type {Person, Pose} from '../types';

// Joint angles in degrees for a front-facing figure; every renderer (flat, pixel, 3D) reads the same rig.
// Arms and legs are [upper, lower]: upper is how far the limb swings out from hanging straight down,
// lower is how far the elbow/knee folds back toward the body. `a` is the screen-right side, `b` the left.
export type Rig = {
  a: [number, number];
  b: [number, number];
  legA: [number, number];
  legB: [number, number];
  // Forward raise of each arm and leg (only the 3D renderer can show depth; flat ones ignore it).
  fwdA: number;
  fwdB: number;
  stepA: number;
  stepB: number;
  tilt: number;
  head: number;
  // Vertical bounce in body units (1 = full figure height).
  bob: number;
  mode: 'stand' | 'sit' | 'kneel' | 'lie';
};

const base: Rig = {a: [8, 6], b: [8, 6], legA: [3, 0], legB: [3, 0], fwdA: 0, fwdB: 0, stepA: 0, stepB: 0, tilt: 0, head: 0, bob: 0, mode: 'stand'};

// `t` is seconds into the scene; `phase` desynchronises people so a crowd never moves in lockstep;
// `x` is their place on stage, so one-armed poses use the arm on the open side.
export function rig(pose: Pose, t: number, phase = 0, x = 0): Rig {
  const r = rawRig(pose, t, phase);
  const flip = pose === 'point' ? x < -0.05 : x > 0.05;
  return flip ? {...r, a: r.b, b: r.a, fwdA: r.fwdB, fwdB: r.fwdA} : r;
}

function rawRig(pose: Pose, t: number, phase: number): Rig {
  const s = (speed: number, offset = 0) => Math.sin((t + phase) * speed + offset);
  const breathe = s(2.2) * 0.004;
  switch (pose) {
    case 'wave':
      return {...base, b: [140 + s(9) * 8, 30 + s(9, 1) * 25], a: [10, 8], head: s(2) * 3, bob: breathe};
    case 'walk':
    case 'run': {
      const fast = pose === 'run';
      const k = fast ? 13 : 7.5;
      const swing = fast ? 38 : 22;
      return {
        ...base, a: [10, fast ? 70 : 18], b: [10, fast ? 70 : 18], fwdA: s(k) * swing, fwdB: -s(k) * swing,
        stepA: -s(k) * swing, stepB: s(k) * swing, legA: [4, Math.max(0, s(k)) * (fast ? 50 : 18)], legB: [4, Math.max(0, -s(k)) * (fast ? 50 : 18)],
        bob: Math.abs(s(k)) * (fast ? 0.025 : 0.012), tilt: fast ? 6 : 0,
      };
    }
    case 'sit':
      return {...base, a: [12, 40], b: [12, 40], fwdA: 30, fwdB: 30, mode: 'sit', head: s(1.5) * 3, bob: breathe};
    case 'sleep':
      return {...base, a: [6, 10], b: [6, 10], mode: 'lie', bob: s(1.6) * 0.004};
    case 'pray':
      // Hands raised in front of the chest, palms up (du'a).
      return {...base, a: [22, 115], b: [22, 115], fwdA: 35, fwdB: 35, head: -6, bob: breathe};
    case 'kneel':
      return {...base, a: [14, 70], b: [14, 70], fwdA: 20, fwdB: 20, mode: 'kneel', head: -8, bob: breathe};
    case 'point':
      return {...base, b: [92, 4], fwdB: 20, a: [8, 8], head: 6, bob: breathe};
    case 'think':
      return {...base, b: [24, 150], fwdB: 25, a: [30, 100], fwdA: 15, head: 8 + s(1.2) * 3, bob: breathe};
    case 'cheer':
      return {...base, a: [155 + s(10) * 10, 15], b: [155 - s(10) * 10, 15], bob: Math.abs(s(5)) * 0.03};
    case 'phone':
      return {...base, b: [28, 155], fwdB: 10, a: [8, 8], head: 10, bob: breathe};
    case 'sad':
      return {...base, a: [4, 4], b: [4, 4], head: -18, tilt: 2, bob: breathe};
    case 'fight':
      return {...base, a: [40, 125 + s(8) * 10], b: [40, 125 - s(8) * 10], fwdA: 30, fwdB: 30, legA: [14, 6], legB: [14, 6], bob: Math.abs(s(4)) * 0.01};
    default:
      return {...base, a: [8 + s(2.2) * 2, 6], b: [8 - s(2.2) * 2, 6], head: s(1.1) * 2, bob: breathe};
  }
}

// Default horizontal places (-1..1) for a group, used when the AI gives no `x`.
export function stagePositions(people: Person[]): number[] {
  const n = people.length;
  const spread = n === 1 ? [0] : n === 2 ? [-0.42, 0.42] : n === 3 ? [-0.72, 0, 0.72] : [-0.8, -0.27, 0.27, 0.8];
  return people.map((p, i) => (typeof p.x === 'number' ? Math.max(-1, Math.min(1, p.x)) : spread[i] ?? 0));
}
