import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// Motion-capture clips and character files, loaded once per tab and sampled by absolute time, so any frame renders the same on its own.
type Track = {b: string; p: 'p' | 'q'; t: number[]; v: number[]};
export type Clip = {d: number; tracks: Track[]};
export type Clips = Record<string, Clip>;

const cache = new Map<string, Promise<unknown>>();

let disc: THREE.CanvasTexture | null = null;

// A round fade from solid to clear, for soft shadows on the ground and glows.
export function softDisc() {
  if (!disc) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const fade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    fade.addColorStop(0, 'rgba(255,255,255,1)');
    fade.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 128, 128);
    disc = new THREE.CanvasTexture(canvas);
  }
  return disc;
}

function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as Promise<T>;
}

export const loadClips = () => once('clips', () => fetch(staticFile('film/clips.json')).then((r) => r.json() as Promise<Clips>));

export const loadModel = (file: string) =>
  once(file, () => new GLTFLoader().loadAsync(staticFile(`film/${file}.glb`)).then((g) => g.scene));

// Holds the render until a promise resolves, and fails the render loudly if it rejects.
export function useLoaded<T>(load: () => Promise<T>, label: string): T | null {
  const [value, setValue] = useState<T | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${label}`, {timeoutInMilliseconds: 120000}));
  useEffect(() => {
    load().then((v) => {
      setValue(v);
      continueRender(handle);
    }, (e) => {
      throw e;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();

function sample(track: Track, time: number, out: THREE.Quaternion | THREE.Vector3) {
  const {t, v, p} = track;
  const size = p === 'q' ? 4 : 3;
  let hi = t.findIndex((x) => x >= time);
  if (hi === -1) hi = t.length - 1;
  const lo = Math.max(0, hi - 1);
  const k = t[hi] === t[lo] ? 0 : Math.min(1, Math.max(0, (time - t[lo]) / (t[hi] - t[lo])));
  if (p === 'q') {
    q0.fromArray(v, lo * size);
    q1.fromArray(v, hi * size);
    (out as THREE.Quaternion).copy(q0).slerp(q1, k);
  } else {
    const o = out as THREE.Vector3;
    o.set(v[lo * 3] + (v[hi * 3] - v[lo * 3]) * k, v[lo * 3 + 1] + (v[hi * 3 + 1] - v[lo * 3 + 1]) * k, v[lo * 3 + 2] + (v[hi * 3 + 2] - v[lo * 3 + 2]) * k);
  }
}

// A clip name ending in _Loop repeats; anything else plays once and holds its last frame.
export const clipTime = (name: string, clip: Clip, elapsed: number) => (name.endsWith('_Loop') ? ((elapsed % clip.d) + clip.d) % clip.d : Math.min(clip.d, Math.max(0, elapsed)));

export type Rest = Map<string, {q: THREE.Quaternion; p: THREE.Vector3}>;

export type BoneMap = Map<string, THREE.Bone>;

const qa = new THREE.Quaternion();
const va = new THREE.Vector3();

// Writes one clip, blended over what's already on the bones by `weight` (1 replaces it).
export function applyClip(bones: BoneMap, rest: Rest, clip: Clip, time: number, weight: number, keepRoot = false) {
  for (const track of clip.tracks) {
    const bone = bones.get(track.b);
    if (!bone || !rest.has(track.b)) continue;
    // The root only ever carries travel; the kits disagree on its rotation.
    if (track.b === 'root' && track.p === 'q') continue;
    if (track.p === 'q') {
      sample(track, time, qa);
      bone.quaternion.slerp(qa, weight);
    } else if (track.b !== 'root' || keepRoot) {
      sample(track, time, va);
      bone.position.lerp(va, weight);
    }
  }
}
