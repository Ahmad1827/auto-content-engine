import * as THREE from 'three';

// A camera at one moment. `roll` tilts the horizon in degrees; `fov` is vertical, in degrees.
export type View = {pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number};
type V3 = [number, number, number];

// A shot is a function from its progress and film time to a view: p runs 0..1 over the shot, t is film seconds.
export type ShotFn = (p: number, t: number) => Partial<Omit<View, 'pos' | 'look'>> & {pos: V3 | THREE.Vector3; look: V3 | THREE.Vector3};
export type Shot = {at: number; shot: ShotFn; ease?: (p: number) => number; handheld?: number};

const vec = (v: V3 | THREE.Vector3) => (v instanceof THREE.Vector3 ? v.clone() : new THREE.Vector3(...v));
const mix = (a: V3, b: V3, p: number): V3 => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];

export const ease = {
  linear: (p: number) => p,
  inOut: (p: number) => p * p * (3 - 2 * p),
  out: (p: number) => 1 - Math.pow(1 - p, 3),
  in: (p: number) => p * p * p,
  // Fast start, long settle: the crash zoom.
  crash: (p: number) => 1 - Math.pow(1 - p, 5),
};

export const cam = {
  // Locked off.
  fixed: (pos: V3, look: V3, fov = 40): ShotFn => () => ({pos, look, fov}),
  // Moves in a line while aiming from one point to another. Covers push-ins, pull-backs, tracking and pans.
  move: (from: V3, to: V3, lookFrom: V3, lookTo: V3 = lookFrom, fov = 40, fovTo = fov): ShotFn => (p) => ({pos: mix(from, to, p), look: mix(lookFrom, lookTo, p), fov: fov + (fovTo - fov) * p}),
  // Circles a point. Angles in degrees, 0 is on the +Z side.
  orbit: (centre: V3, radius: number, height: number, a0: number, a1: number, fov = 40): ShotFn => (p) => {
    const a = (a0 + (a1 - a0) * p) * (Math.PI / 180);
    return {pos: [centre[0] + Math.sin(a) * radius, centre[1] + height, centre[2] + Math.cos(a) * radius], look: centre, fov};
  },
  // Rides behind or beside something moving. `target(t)` gives its place at film time t; `offset` is camera minus target, `aim` is added to the target to aim above the feet.
  follow: (target: (t: number) => THREE.Vector3 | V3, offset: V3, aim: V3 = [0, 1.2, 0], fov = 45): ShotFn => (_, t) => {
    const at = vec(target(t));
    return {pos: at.clone().add(vec(offset)), look: at.add(vec(aim)), fov};
  },
  // First person: eye height at `at(t)`, looking toward `look(t)`, with a walking bob when `bob` > 0.
  pov: (at: (t: number) => THREE.Vector3 | V3, look: (t: number) => THREE.Vector3 | V3, bob = 0, fov = 62): ShotFn => (_, t) => ({pos: vec(at(t)).add(new THREE.Vector3(0, Math.sin(t * 9) * 0.018 * bob, 0)), look: look(t), fov, roll: Math.sin(t * 4.5) * 0.5 * bob}),
  // Straight down from above, for maps of the world and scale reveals.
  top: (centre: V3, h0: number, h1 = h0, fov = 40): ShotFn => (p) => ({pos: [centre[0], centre[1] + h0 + (h1 - h0) * p, centre[2] + 0.001], look: centre, fov}),
};

// Smooth noise that repeats nothing visible; frame-pure so frames can render out of order.
const wander = (t: number, seed: number) => Math.sin(t * 1.3 + seed) * 0.5 + Math.sin(t * 2.9 + seed * 2.1) * 0.3 + Math.sin(t * 6.1 + seed * 3.7) * 0.2;

export function shotIndex(shots: Shot[], t: number) {
  let i = 0;
  while (i < shots.length - 1 && shots[i + 1].at <= t) i++;
  return i;
}

// The view for film time t: the last shot that has started, at its progress.
export function viewAt(shots: Shot[], t: number, end: number): View {
  const i = shotIndex(shots, t);
  const s = shots[i];
  const until = shots[i + 1]?.at ?? end;
  const raw = until > s.at ? Math.min(1, Math.max(0, (t - s.at) / (until - s.at))) : 0;
  const v = s.shot((s.ease ?? ease.inOut)(raw), t);
  const pos = vec(v.pos);
  const look = vec(v.look);
  const shake = s.handheld ?? 0;
  if (shake) {
    pos.add(new THREE.Vector3(wander(t, 1), wander(t, 2), wander(t, 3)).multiplyScalar(0.02 * shake));
    look.add(new THREE.Vector3(wander(t, 4), wander(t, 5), wander(t, 6)).multiplyScalar(0.02 * shake));
  }
  return {pos, look, fov: v.fov ?? 40, roll: (v.roll ?? 0) + (shake ? wander(t, 7) * 0.5 * shake : 0)};
}

// Where a world point lands on a 1080x1920 frame, for labels that stick to things. null when it's behind the camera.
export function toScreen(view: View, point: V3, width = 1080, height = 1920): {x: number; y: number} | null {
  const c = new THREE.PerspectiveCamera(view.fov, width / height, 0.05, 2000);
  c.position.copy(view.pos);
  c.lookAt(view.look);
  c.rotateZ((view.roll * Math.PI) / 180);
  c.updateMatrixWorld();
  const local = new THREE.Vector3(...point).applyMatrix4(c.matrixWorldInverse);
  if (local.z > 0) return null;
  const n = new THREE.Vector3(...point).project(c);
  return {x: ((n.x + 1) / 2) * width, y: ((1 - n.y) / 2) * height};
}
