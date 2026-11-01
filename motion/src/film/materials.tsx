import * as THREE from 'three';

// Real-looking surfaces with no image files: each is painted once per tab from seeded noise, with a matching bump map so light catches its relief.
// Painted in natural colours; `tint` multiplies them. Lengthwise grain runs along V, which is the long axis of a cylinder or a Log.
export type MaterialKind = 'bark' | 'wood' | 'endgrain' | 'planks' | 'shingles' | 'soil' | 'forestFloor' | 'grass' | 'sand' | 'snow' | 'rock' | 'stone' | 'ashlar' | 'brick' | 'plaster' | 'concrete' | 'metal' | 'rust' | 'water';

const SIZE = 512;
type RGB = [number, number, number];

const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number, seed: number) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);
const smooth = (p: number) => p * p * (3 - 2 * p);
const clamp = (x: number) => Math.min(1, Math.max(0, x));

// Value noise that wraps every `period` cells, so textures tile without a seam.
function noise(x: number, y: number, px: number, py: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const at = (a: number, b: number) => hash(((a % px) + px) % px, ((b % py) + py) % py, seed);
  return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
}

function fbm(u: number, v: number, fx: number, fy: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    const m = 1 << i;
    sum += noise(u * fx * m, v * fy * m, fx * m, fy * m, seed + i) * amp;
    total += amp;
    amp /= 2;
  }
  return sum / total;
}

// Distance to the nearest wrapped cell centre and that cell's id: cobbles, gravel, pebbles.
function cells(u: number, v: number, n: number, seed: number) {
  const x = u * n;
  const y = v * n;
  let best = 9;
  let second = 9;
  let id = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const a = Math.floor(x) + i;
      const b = Math.floor(y) + j;
      const wa = ((a % n) + n) % n;
      const wb = ((b % n) + n) % n;
      const d = Math.hypot(a + hash(wa, wb, seed) - x, b + hash(wb, wa, seed + 1) - y);
      if (d < best) {
        second = best;
        best = d;
        id = hash(wa, wb, seed + 2);
      } else if (d < second) second = d;
    }
  }
  return {best, edge: second - best, id};
}

const ramp = (stops: RGB[], k: number): RGB => {
  const x = clamp(k) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((c) => stops[i][c] + (stops[i + 1][c] - stops[i][c]) * f) as RGB;
};

// Each painter gives a height (0..1, for the bump map) and a colour, per texel.
const PAINT: Record<MaterialKind, {rough: number; bump: number; metal?: number; at: (u: number, v: number) => {h: number; c: RGB}}> = {
  bark: {rough: 0.95, bump: 3.2, at: (u, v) => {
    const warp = fbm(u, v, 4, 4, 3) * 0.14;
    const ridge = 1 - Math.abs(fbm(u + warp, v, 18, 3, 1, 3) * 2 - 1);
    const fine = fbm(u, v, 40, 8, 2, 2);
    const h = ridge ** 1.6 * 0.8 + fine * 0.2;
    return {h, c: ramp([[34, 22, 14], [74, 48, 30], [118, 82, 54], [150, 112, 78]], h * 0.85 + fbm(u, v, 3, 3, 5) * 0.2)};
  }},
  wood: {rough: 0.72, bump: 0.9, at: (u, v) => {
    const warp = fbm(u, v, 3, 2, 8);
    const grain = Math.sin((u * 26 + warp * 9) * Math.PI) * 0.5 + 0.5;
    const fine = fbm(u, v, 60, 6, 9, 2);
    const h = grain * 0.5 + fine * 0.5;
    return {h, c: ramp([[96, 58, 30], [146, 96, 54], [186, 136, 86]], h)};
  }},
  endgrain: {rough: 0.8, bump: 1.4, at: (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2 + (fbm(u, v, 5, 5, 11, 3) - 0.5) * 0.09;
    const ring = Math.sin(d * 44) * 0.5 + 0.5;
    const crack = Math.abs(Math.sin(Math.atan2(v - 0.5, u - 0.5) * 3 + 1)) < 0.012 ? 0.5 : 1;
    const c = ramp([[226, 170, 96], [196, 134, 70], [150, 96, 50]], d * 0.55 + ring * 0.28);
    return {h: ring * crack, c: c.map((x) => x * crack) as RGB};
  }},
  planks: {rough: 0.8, bump: 1.6, at: (u, v) => {
    const row = Math.floor(u * 5);
    const seam = fract(u * 5);
    const edge = Math.min(seam, 1 - seam) < 0.025 ? 0.15 : 1;
    const grain = fbm(u, v + row * 0.37, 50, 4, 21, 3);
    const h = grain * edge;
    const shade = 0.82 + hash(row, 0, 22) * 0.28;
    return {h, c: ramp([[84, 52, 30], [136, 92, 56], [172, 124, 80]], grain).map((x) => x * shade * edge) as RGB};
  }},
  shingles: {rough: 0.88, bump: 2.6, at: (u, v) => {
    const row = Math.floor(v * 10);
    const across = u * 7 + (row % 2) * 0.5;
    const cell = Math.floor(across);
    const fy = fract(v * 10);
    const fx = fract(across);
    const gap = fx < 0.04 || fx > 0.96 ? 0.35 : 1;
    const slope = 0.55 + fy * 0.45;
    const grain = fbm(u, v, 30, 6, 31, 3);
    const shade = 0.78 + hash(cell, row, 32) * 0.34;
    return {h: slope * gap, c: ramp([[78, 52, 34], [132, 92, 62], [168, 124, 88]], grain).map((x) => x * shade * gap * (0.72 + fy * 0.28)) as RGB};
  }},
  soil: {rough: 0.98, bump: 3, at: (u, v) => {
    const layer = fbm(u, v, 3, 2, 41);
    const gouge = 1 - Math.abs(fbm(u, v, 16, 3, 42, 3) * 2 - 1);
    const h = gouge * 0.7 + fbm(u, v, 30, 30, 43, 2) * 0.3;
    return {h, c: ramp([[58, 28, 14], [112, 56, 24], [156, 84, 38]], h * 0.7 + layer * 0.35)};
  }},
  forestFloor: {rough: 0.97, bump: 2.6, at: (u, v) => {
    const big = fbm(u, v, 5, 5, 51);
    const leaf = cells(u, v, 34, 52);
    const twig = Math.abs(fbm(u, v, 9, 9, 53, 3) - 0.5) < 0.006 ? 0.4 : 1;
    const moss = clamp((fbm(u, v, 8, 8, 54) - 0.53) * 7);
    const h = (leaf.edge * 0.9 + big * 0.4) * twig;
    const c = ramp([[70, 44, 22], [132, 88, 40], [186, 136, 62], [204, 160, 84]], leaf.id * 0.65 + big * 0.35);
    return {h, c: [0, 1, 2].map((i) => (c[i] * (1 - moss) + [82, 94, 40][i] * moss) * twig * (0.65 + clamp(leaf.edge * 3) * 0.35)) as RGB};
  }},
  grass: {rough: 0.96, bump: 1.8, at: (u, v) => {
    const blade = fbm(u, v, 70, 18, 61, 2);
    const patch = fbm(u, v, 5, 5, 62);
    const h = blade;
    return {h, c: ramp([[46, 82, 30], [88, 128, 46], [142, 168, 70]], blade * 0.6 + patch * 0.45)};
  }},
  sand: {rough: 0.95, bump: 1.1, at: (u, v) => {
    const warp = fbm(u, v, 3, 3, 71);
    const ripple = Math.sin((v * 22 + warp * 8) * Math.PI) * 0.5 + 0.5;
    const grit = hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 72);
    const h = ripple * 0.8 + grit * 0.2;
    return {h, c: ramp([[176, 138, 88], [216, 180, 126], [238, 212, 164]], h * 0.7 + warp * 0.25)};
  }},
  snow: {rough: 0.9, bump: 0.7, at: (u, v) => {
    const h = fbm(u, v, 6, 6, 81);
    return {h, c: ramp([[176, 188, 212], [222, 230, 244], [250, 252, 255]], h + hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 82) * 0.05)};
  }},
  rock: {rough: 0.96, bump: 3.4, at: (u, v) => {
    const big = fbm(u, v, 5, 5, 91, 5);
    const crack = 1 - clamp(Math.abs(fbm(u, v, 11, 11, 92, 5) - 0.5) * 34);
    const fleck = fbm(u, v, 48, 48, 93, 2);
    const h = big * 0.65 + fleck * 0.35 - crack * 0.25;
    return {h, c: ramp([[28, 32, 30], [58, 62, 58], [92, 96, 88], [128, 128, 118]], big * 0.75 + fleck * 0.4 - crack * 0.12)};
  }},
  stone: {rough: 0.9, bump: 3, at: (u, v) => {
    const s = cells(u, v, 9, 101);
    const face = clamp(s.edge * 7);
    const grit = fbm(u, v, 30, 30, 102, 2);
    const shade = 0.72 + s.id * 0.42;
    return {h: face * 0.8 + grit * 0.2, c: ramp([[70, 66, 60], [122, 116, 106], [164, 158, 146]], grit * 0.6 + s.id * 0.4).map((x) => x * shade * (0.32 + face * 0.68)) as RGB};
  }},
  ashlar: {rough: 0.88, bump: 1.5, at: (u, v) => {
    const big = fbm(u, v, 4, 4, 171);
    const pit = clamp((fbm(u, v, 34, 34, 172, 3) - 0.62) * 9);
    const h = big * 0.5 + fbm(u, v, 22, 22, 173, 3) * 0.5 - pit * 0.35;
    return {h, c: ramp([[138, 124, 100], [178, 164, 136], [208, 196, 170]], big * 0.8 + h * 0.3).map((x) => x * (1 - pit * 0.3)) as RGB};
  }},
  brick: {rough: 0.9, bump: 2.4, at: (u, v) => {
    const row = Math.floor(v * 12);
    const across = u * 6 + (row % 2) * 0.5;
    const fx = fract(across);
    const fy = fract(v * 12);
    const mortar = fx < 0.04 || fx > 0.96 || fy < 0.07 || fy > 0.93;
    if (mortar) return {h: 0.1, c: [150, 142, 130]};
    const shade = 0.76 + hash(Math.floor(across), row, 111) * 0.36;
    return {h: 0.7 + fbm(u, v, 30, 30, 112, 2) * 0.3, c: ramp([[112, 48, 34], [156, 72, 48], [186, 98, 68]], fbm(u, v, 20, 20, 113, 2)).map((x) => x * shade) as RGB};
  }},
  plaster: {rough: 0.92, bump: 0.9, at: (u, v) => {
    const h = fbm(u, v, 10, 10, 121, 4);
    return {h, c: ramp([[196, 182, 158], [226, 214, 192], [240, 232, 214]], h)};
  }},
  concrete: {rough: 0.9, bump: 1.1, at: (u, v) => {
    const h = fbm(u, v, 12, 12, 131, 4);
    const pit = hash(Math.floor(u * 170), Math.floor(v * 170), 132) > 0.985 ? 0.55 : 1;
    return {h: h * pit, c: ramp([[112, 114, 116], [152, 154, 154], [182, 182, 178]], h).map((x) => x * pit) as RGB};
  }},
  metal: {rough: 0.42, bump: 0.35, metal: 0.8, at: (u, v) => {
    const h = fbm(u, v, 90, 3, 141, 2);
    return {h, c: ramp([[124, 128, 134], [172, 176, 182], [210, 214, 220]], h)};
  }},
  rust: {rough: 0.86, bump: 1.8, metal: 0.25, at: (u, v) => {
    const big = fbm(u, v, 7, 7, 151, 5);
    const flake = clamp((big - 0.45) * 6);
    return {h: big, c: [0, 1, 2].map((i) => [96, 98, 100][i] * (1 - flake) + ramp([[86, 38, 18], [150, 72, 30], [190, 106, 48]], fbm(u, v, 24, 24, 152, 3))[i] * flake) as RGB};
  }},
  water: {rough: 0.16, bump: 0.8, at: (u, v) => {
    const warp = fbm(u, v, 4, 4, 161, 3);
    const lines = 1 - Math.abs(fbm(u + warp * 0.08, v, 9, 9, 162, 3) * 2 - 1);
    const h = lines ** 7;
    return {h, c: ramp([[32, 128, 156], [64, 164, 184], [150, 222, 226]], warp * 0.55 + h * 0.5)};
  }},
};

const painted = new Map<MaterialKind, {map: THREE.CanvasTexture; bump: THREE.CanvasTexture}>();

function paint(kind: MaterialKind) {
  const done = painted.get(kind);
  if (done) return done;
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    return {canvas, ctx: canvas.getContext('2d') as CanvasRenderingContext2D};
  };
  const color = make();
  const height = make();
  const cImg = color.ctx.createImageData(SIZE, SIZE);
  const hImg = height.ctx.createImageData(SIZE, SIZE);
  const painter = PAINT[kind].at;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const {h, c} = painter(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      cImg.data.set([c[0], c[1], c[2], 255], i);
      const g = clamp(h) * 255;
      hImg.data.set([g, g, g, 255], i);
    }
  }
  color.ctx.putImageData(cImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  const map = new THREE.CanvasTexture(color.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(height.canvas);
  const set = {map, bump};
  painted.set(kind, set);
  return set;
}

const tiled = new Map<string, {map: THREE.Texture; bump: THREE.Texture}>();

// The textures of a surface, tiled `repeat` times across a mesh's UVs. Shared between meshes with the same settings.
export function surfaceMaps(kind: MaterialKind, repeat: [number, number] = [1, 1], offset: [number, number] = [0, 0]) {
  const key = `${kind}/${repeat.join()}`;
  let set = tiled.get(key);
  if (!set) {
    const base = paint(kind);
    const tune = (t: THREE.Texture) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(repeat[0], repeat[1]);
      c.needsUpdate = true;
      return c;
    };
    set = {map: tune(base.map), bump: tune(base.bump)};
    tiled.set(key, set);
  }
  set.map.offset.set(offset[0], offset[1]);
  set.bump.offset.set(offset[0], offset[1]);
  return set;
}

// Use it as a mesh's material: <mesh><planeGeometry /><Surface kind="soil" repeat={[4, 2]} /></mesh>. `offset` slides the pattern, for flowing water.
export const Surface: React.FC<{kind: MaterialKind; repeat?: [number, number]; offset?: [number, number]; tint?: string; rough?: number; bump?: number; opacity?: number; attach?: string; side?: THREE.Side}> = ({kind, repeat = [1, 1], offset = [0, 0], tint = '#ffffff', rough, bump, opacity = 1, attach, side}) => {
  const {map, bump: bumpMap} = surfaceMaps(kind, repeat, offset);
  const p = PAINT[kind];
  return <meshStandardMaterial attach={attach} map={map} bumpMap={bumpMap} bumpScale={bump ?? p.bump} color={tint} roughness={rough ?? p.rough} metalness={p.metal ?? 0} transparent={opacity < 1} opacity={opacity} side={side} depthWrite={opacity >= 1} />;
};
