import {useMemo} from 'react';
import * as THREE from 'three';
import {useTime} from './Film';
import {Surface, type MaterialKind} from './materials';

// Pieces for a world that looks like a real place: a cut block of ground, things with real surfaces, painted surroundings, and cross-sections that show what's hidden.
type V3 = [number, number, number];

const rnd = (i: number, seed: number) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// A block of ground sliced out of the world, top at y = 0, with its cut earth showing on the sides. The whole story can sit on it like a model on a plinth.
export const Slab: React.FC<{w?: number; d?: number; depth?: number; top?: MaterialKind; side?: MaterialKind; at?: V3; topTint?: string; sideTint?: string}> = ({w = 12, d = 12, depth = 3, top = 'forestFloor', side = 'soil', at = [0, 0, 0], topTint, sideTint}) => (
  <mesh position={[at[0], at[1] - depth / 2, at[2]]} receiveShadow>
    <boxGeometry args={[w, depth, d]} />
    <Surface attach="material-0" kind={side} repeat={[d / 4, depth / 4]} tint={sideTint} />
    <Surface attach="material-1" kind={side} repeat={[d / 4, depth / 4]} tint={sideTint} />
    <Surface attach="material-2" kind={top} repeat={[w / 5, d / 5]} tint={topTint} />
    <Surface attach="material-3" kind={side} repeat={[w / 4, d / 4]} tint={sideTint} />
    <Surface attach="material-4" kind={side} repeat={[w / 4, depth / 4]} tint={sideTint} />
    <Surface attach="material-5" kind={side} repeat={[w / 4, depth / 4]} tint={sideTint} />
  </mesh>
);

// A box with a real surface. For anything flat, stacked or built. `s` is its full size.
export const Slabbed: React.FC<{p?: V3; s: V3; kind: MaterialKind; rot?: V3; tint?: string; scale?: number}> = ({p, s, kind, rot, tint, scale = 1.5}) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow>
    <boxGeometry args={s} />
    <Surface kind={kind} repeat={[Math.max(s[0], s[2]) / scale, s[1] / scale]} tint={tint} />
  </mesh>
);

// A round length with a surface along it and a different one on the cut ends. Lying along X unless `axis` says otherwise: a log, pipe, pillar, barrel, tank.
export const Log: React.FC<{p?: V3; rot?: V3; len?: number; r?: number; r2?: number; axis?: 'x' | 'y' | 'z'; kind?: MaterialKind; ends?: MaterialKind; tint?: string; seed?: number}> = ({p, rot, len = 4, r = 0.16, r2, axis = 'x', kind = 'bark', ends = 'endgrain', tint, seed = 1}) => {
  const lean: V3 = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const shade = 0.82 + rnd(seed, 1) * 0.3;
  const color = tint ?? new THREE.Color(shade, shade, shade).getStyle();
  return (
    <group position={p} rotation={rot}>
      <mesh rotation={lean} castShadow receiveShadow>
        <cylinderGeometry args={[r2 ?? r, r, len, 20, 1]} />
        <Surface attach="material-0" kind={kind} repeat={[Math.max(1, Math.round(r * 6.28)), len / 1.6]} offset={[rnd(seed, 2), rnd(seed, 3)]} tint={color} />
        <Surface attach="material-1" kind={ends} />
        <Surface attach="material-2" kind={ends} />
      </mesh>
    </group>
  );
};

// A thin, flat shape in the air, for a sign, roof panel or wall skin that needs a real surface.
export const Sheet: React.FC<{p?: V3; s: [number, number]; kind: MaterialKind; rot?: V3; tint?: string; scale?: number; opacity?: number}> = ({p, s, kind, rot, tint, scale = 1.5, opacity}) => (
  <mesh position={p} rotation={rot} castShadow={opacity === undefined} receiveShadow>
    <planeGeometry args={s} />
    <Surface kind={kind} repeat={[s[0] / scale, s[1] / scale]} tint={tint} side={THREE.DoubleSide} opacity={opacity} />
  </mesh>
);

// Small things strewn over the ground: grass tufts, stones, leaves. They tie an object to the ground and stop a surface looking empty.
export const Scatter: React.FC<{kind?: 'tufts' | 'stones' | 'leaves'; area?: [number, number]; at?: V3; count?: number; seed?: number; c?: string; size?: number; avoid?: [number, number, number, number]}> = ({kind = 'tufts', area = [10, 10], at = [0, 0, 0], count = 120, seed = 1, c, size = 1, avoid}) => {
  const items = useMemo(() => Array.from({length: count}, (_, i) => {
    const x = (rnd(i, seed) - 0.5) * area[0];
    const z = (rnd(i, seed + 1) - 0.5) * area[1];
    return {x, z, turn: rnd(i, seed + 2) * 6.28, s: (0.6 + rnd(i, seed + 3) * 0.8) * size, tone: 0.8 + rnd(i, seed + 4) * 0.35};
  }).filter((o) => !avoid || o.x < avoid[0] || o.x > avoid[2] || o.z < avoid[1] || o.z > avoid[3]), [area[0], area[1], count, seed, size, avoid?.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const color = c ?? (kind === 'stones' ? '#79756c' : kind === 'leaves' ? '#a9742f' : '#5d7c33');
  return (
    <group position={at}>
      {items.map((o, i) => {
        const tone = new THREE.Color(color).multiplyScalar(o.tone);
        if (kind === 'stones') return <mesh key={i} position={[o.x, 0.02 * o.s, o.z]} rotation={[o.turn, o.turn * 2, 0]} scale={[0.07 * o.s, 0.04 * o.s, 0.055 * o.s]} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={tone} roughness={0.95} /></mesh>;
        if (kind === 'leaves') return <mesh key={i} position={[o.x, 0.012, o.z]} rotation={[-Math.PI / 2, 0, o.turn]} scale={[0.07 * o.s, 0.04 * o.s, 1]}><circleGeometry args={[1, 6]} /><meshStandardMaterial color={tone} roughness={0.95} side={THREE.DoubleSide} /></mesh>;
        return (
          <group key={i} position={[o.x, 0, o.z]} rotation={[0, o.turn, 0]} scale={o.s}>
            {[-0.4, 0, 0.45].map((lean, j) => <mesh key={j} position={[lean * 0.09, 0.07, 0]} rotation={[0, j * 1.7, lean * 0.5]} scale={[0.018, 0.075, 0.018]}><coneGeometry args={[1, 2, 4]} /><meshStandardMaterial color={tone} roughness={0.95} /></mesh>)}
          </group>
        );
      })}
    </group>
  );
};

export type SceneryKind = 'forest' | 'hills' | 'mountains' | 'desert' | 'city' | 'sea' | 'night';

const SKIES: Record<SceneryKind, [string, string]> = {
  forest: ['#b9d7e8', '#eef1dc'], hills: ['#8fc3ea', '#e6f0ef'], mountains: ['#7fb1e0', '#dfe8f0'], desert: ['#9cc7e6', '#f6e3c0'],
  city: ['#a9c4dc', '#efe3d4'], sea: ['#86bbe6', '#eaf2f2'], night: ['#090f2a', '#2a2c56'],
};

function paintScenery(kind: SceneryKind, seed: number) {
  const canvas = document.createElement('canvas');
  // Painted in 2048 x 768 units on a sharper canvas. It repeats round the world, so that a long lens never sees it stretched.
  canvas.width = 4096;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  const W = 2048;
  const H = 768;
  const [sky, low] = SKIES[kind];
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  g.addColorStop(0, sky);
  g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  let n = 0;
  const r = () => rnd(n++, seed);
  // A ridge that closes up where the picture wraps round the cylinder. Returns its height at any x, so that things can stand on it. `sharp` makes peaks rather than rolling hills.
  const ridge = (base: number, amp: number, color: string, f = 1, sharp = false) => {
    const a = r() * 6;
    const b = r() * 6;
    const wave = (v: number) => (sharp ? 1 - Math.abs(Math.sin(v)) * 2 : Math.sin(v));
    const at = (x: number) => {
      const u = (x / W) * Math.PI * 2;
      return base - (wave(u * 3 * f + a) * 0.5 + wave(u * 7 * f + b) * 0.3 + wave(u * 17 * f + a * 2) * 0.2) * amp;
    };
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, at(x));
    ctx.lineTo(W, H);
    ctx.fill();
    return at;
  };
  const dot = (x: number, y: number, s: number, c: string) => {
    ctx.fillStyle = c;
    for (const shift of [0, -W, W]) {
      ctx.beginPath();
      ctx.arc(x + shift, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  // The ground at the bottom of the picture, broken up so that it's never a flat band.
  const floor = (c: string, from: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, from, W, H - from);
    for (let i = 0; i < 1400; i++) dot(r() * W, from - 8 + r() * (H - from + 8), 3 + r() * 9, shade(c, 0.72 + r() * 0.62));
  };
  const shade = (c: string, k: number) => {
    const m = new THREE.Color(c).convertLinearToSRGB().multiplyScalar(k);
    return `rgb(${Math.min(255, m.r * 255)},${Math.min(255, m.g * 255)},${Math.min(255, m.b * 255)})`;
  };
  // A tree crown with volume: shaded below, lit from above, and broken up with small clusters of leaves.
  const blob = (x: number, y: number, s: number, c: string) => {
    if (c.startsWith('rgba')) {
      dot(x, y, s, c);
      return;
    }
    dot(x, y + s * 0.18, s, shade(c, 0.68));
    dot(x - s * 0.14, y - s * 0.1, s * 0.8, c);
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28;
      const d = r() * s * 0.85;
      dot(x + Math.cos(a) * d, y + Math.sin(a) * d - s * 0.08, s * (0.12 + r() * 0.17), shade(c, 0.82 + r() * 0.5));
    }
  };
  if (kind === 'forest') {
    const rows: [number, number, number, string[]][] = [
      [430, 420, 12, ['#7b9c74', '#88a97c', '#6f9069']],
      [500, 480, 18, ['#4c6c3a', '#5c7d3f', '#6c8a3c', '#a4a53f']],
      [580, 460, 26, ['#2c4526', '#3a5a2a', '#537a2e', '#bfa636', '#8a9a30']],
    ];
    for (const [base, count, size, colors] of rows) {
      const top = ridge(base, 34, colors[0], 2);
      for (let i = 0; i < count / 30; i++) {
        ctx.fillStyle = '#1f1a14';
        ctx.fillRect(r() * W, top(0) - size * 2, size * 0.28, H);
      }
      for (let i = 0; i < count; i++) {
        const x = r() * W;
        blob(x, top(x) - r() * size * 2.4 + size * 0.5, size * (0.5 + r() * 0.8), colors[Math.floor(r() * colors.length)]);
      }
    }
    floor('#2e2a18', 625);
  } else if (kind === 'hills') {
    const rows: [number, number, number, number, string, string[]][] = [
      [450, 44, 0, 6, '#a4bfaa', ['#8fae98']],
      [510, 54, 150, 11, '#7fa772', ['#55803f', '#688f46', '#4a7238']],
      [580, 46, 180, 19, '#5e8c4c', ['#3e6a2e', '#4f7c36', '#6f8f3e', '#35592a']],
    ];
    for (const [base, amp, count, size, color, trees] of rows) {
      const top = ridge(base, amp, color);
      for (let i = 0; i < count; i++) {
        const x = r() * W;
        // Trees grow in clusters along the ridge, standing on it and on the slope below.
        if (Math.sin((x / W) * 40 + base) < -0.1) continue;
        blob(x, top(x) + r() * 26 - size * 0.4, size * (0.6 + r() * 0.7), trees[Math.floor(r() * trees.length)]);
      }
    }
    floor('#3d5a2a', 620);
  } else if (kind === 'mountains') {
    const far = ridge(380, 170, '#a3b3cc', 1.2, true);
    for (let x = 0; x < W; x += 3) if (far(x) < 330) {
      ctx.fillStyle = '#f2f5fa';
      ctx.fillRect(x, far(x), 3, (330 - far(x)) * 0.55);
    }
    ridge(470, 120, '#71849e', 1.5, true);
    const near = ridge(585, 60, '#3f5a4c', 2);
    for (let i = 0; i < 500; i++) {
      const x = r() * W;
      blob(x, near(x) + r() * 40, 6 + r() * 7, ['#2f4b3c', '#3a5a45'][Math.floor(r() * 2)]);
    }
    floor('#33493c', 630);
  } else if (kind === 'desert') {
    ridge(480, 60, '#e2c08a');
    ridge(530, 46, '#d5a968');
    ridge(600, 36, '#c1924f');
    floor('#b98a49', 620);
  } else if (kind === 'sea') {
    ctx.fillStyle = '#2f7fa8';
    ctx.fillRect(0, 470, W, H);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.2})`;
      ctx.fillRect(r() * W, 470 + r() ** 2 * 280, 8 + r() * 50, 2);
    }
  } else {
    const night = kind === 'night';
    if (night) for (let i = 0; i < 500; i++) dot(r() * W, r() * 460, 0.5 + r() * 1.4, `rgba(255,255,240,${0.3 + r() * 0.7})`);
    const layers: [number, string][] = night ? [[520, '#1a1d3e'], [600, '#101230']] : [[500, '#a9b4bf'], [590, '#6e7a86']];
    for (const [base, color] of layers) {
      for (let x = 0; x < W;) {
        const w = 34 + r() * 90;
        const h = 70 + r() * 210;
        ctx.fillStyle = color;
        ctx.fillRect(x, base - h, w, H);
        ctx.fillStyle = night ? 'rgba(255,210,120,0.75)' : 'rgba(255,255,255,0.28)';
        for (let wy = base - h + 10; wy < base; wy += 20) {
          for (let wx = x + 6; wx < x + w - 8; wx += 15) if (r() > 0.55) ctx.fillRect(wx, wy, 7, 10);
        }
        x += w + r() * 6;
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = 8;
  return tex;
}

const scenery = new Map<string, THREE.CanvasTexture>();

// A painted world all the way round, so that no camera angle shows an empty void. It sits far outside the set; fog doesn't touch it. Put the base at or below your ground level.
export const Scenery: React.FC<{kind?: SceneryKind; centre?: V3; radius?: number; height?: number; seed?: number}> = ({kind = 'forest', centre = [0, 0, 0], radius = 42, height = 42, seed = 1}) => {
  const key = `${kind}/${seed}`;
  if (!scenery.has(key)) scenery.set(key, paintScenery(kind, seed));
  const tex = scenery.get(key) as THREE.CanvasTexture;
  const y = centre[1] + height * 0.28;
  const tall = height * 3;
  return (
    <>
      <mesh position={[centre[0], y, centre[2]]}>
        <cylinderGeometry args={[radius, radius, height, 48, 1, true]} />
        <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} />
      </mesh>
      {/* The sky carries on above the painting, whatever the camera does. */}
      <mesh position={[centre[0], y + height / 2 + tall / 2 - 0.01, centre[2]]}>
        <cylinderGeometry args={[radius, radius, tall, 48, 1, true]} />
        <meshBasicMaterial color={SKIES[kind][0]} side={THREE.BackSide} fog={false} />
      </mesh>
    </>
  );
};

// A flat body of water with a moving surface, seen from above or from the side. `flow` is its drift per second.
export const WaterSurface: React.FC<{p?: V3; s: [number, number]; rot?: V3; opacity?: number; tint?: string; flow?: [number, number]; scale?: number}> = ({p, s, rot = [-Math.PI / 2, 0, 0], opacity = 0.82, tint, flow = [0.012, 0.022], scale = 3}) => {
  const t = useTime();
  return (
    <mesh position={p} rotation={rot} receiveShadow>
      <planeGeometry args={s} />
      <Surface kind="water" repeat={[s[0] / scale, s[1] / scale]} offset={[t * flow[0], t * flow[1]]} opacity={opacity} tint={tint} />
    </mesh>
  );
};

export type CutPoint = {x: number; y: number; w: number};

// A smooth run through the points of a cutaway. `s` runs 0..1 along it.
function spineOf(points: CutPoint[]) {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(q.x, q.y, 0)), false, 'centripetal');
  // Width follows the same parameter as the curve's control points.
  const widthAt = (u: number) => {
    const x = u * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(x));
    const f = x - i;
    const k = f * f * (3 - 2 * f);
    return points[i].w + (points[i + 1].w - points[i].w) * k;
  };
  return {curve, widthAt};
}

// A place along a cutaway at `s` (0..1): its centre, the direction of travel in degrees, and its width. `side` shifts across it, -1 to 1 from wall to wall. Stand things and aim cameras with it.
export function along(points: CutPoint[], s: number, side = 0): {pos: V3; angle: number; width: number} {
  const {curve, widthAt} = spineOf(points);
  const u = Math.min(1, Math.max(0, s));
  const c = curve.getPoint(u);
  const d = curve.getTangent(u);
  const w = widthAt(u);
  return {pos: [c.x - d.y * side * w * 0.5, c.y + d.x * side * w * 0.5, 0], angle: (Math.atan2(d.y, d.x) * 180) / Math.PI, width: w};
}

// A cross-section: solid material fills the frame, with a passage cut through it so the camera sees inside. Tunnels, caves, pipes, mines, veins, the hull of a ship, a burrow.
// `points` run through the middle of the passage in the XY plane, each with its width `w` (widen one for a chamber). Things inside live at z = 0; look from +Z.
// `edge` lines the cut in a colour, so the shape reads even at thumbnail size. `water` floods everything below that height (omit for dry).
export const Cutaway: React.FC<{points: CutPoint[]; solid?: MaterialKind; solidTint?: string; back?: MaterialKind; backTint?: string; edge?: string; edgeWidth?: number; water?: number; waterOpacity?: number; thick?: number; extent?: number}> = ({points, solid = 'rock', solidTint, back = 'rock', backTint = '#e6d5b4', edge = '#6f9f3a', edgeWidth = 0.16, water, waterOpacity = 0.55, thick = 0.9, extent = 80}) => {
  const key = JSON.stringify(points);
  const {cutGeo, rimGeo, box} = useMemo(() => {
    const {curve, widthAt} = spineOf(points);
    const N = 220;
    const left: THREE.Vector2[] = [];
    const right: THREE.Vector2[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const c = curve.getPoint(u);
      const d = curve.getTangent(u);
      const w = widthAt(u) / 2;
      left.push(new THREE.Vector2(c.x - d.y * w, c.y + d.x * w));
      right.push(new THREE.Vector2(c.x + d.y * w, c.y - d.x * w));
    }
    const outline = [...left, ...right.reverse()];
    const xs = outline.map((v) => v.x);
    const ys = outline.map((v) => v.y);
    const mid: [number, number] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const shape = new THREE.Shape([new THREE.Vector2(mid[0] - extent, mid[1] - extent), new THREE.Vector2(mid[0] + extent, mid[1] - extent), new THREE.Vector2(mid[0] + extent, mid[1] + extent), new THREE.Vector2(mid[0] - extent, mid[1] + extent)]);
    shape.holes.push(new THREE.Path(outline));
    const cut = new THREE.ExtrudeGeometry(shape, {depth: thick * 2, bevelEnabled: false, steps: 1, curveSegments: 1});
    cut.translate(0, 0, -thick);
    // The coloured lining, drawn as a ribbon just proud of the cut face.
    const positions: number[] = [];
    const index: number[] = [];
    outline.forEach((v, i) => {
      const a = outline[(i - 1 + outline.length) % outline.length];
      const b = outline[(i + 1) % outline.length];
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      // The outline runs counter-clockwise round the hole's far side, so its outward direction is to the side of travel.
      const o: [number, number] = [(nx / len) * edgeWidth, (ny / len) * edgeWidth];
      positions.push(v.x, v.y, thick + 0.01, v.x - o[0], v.y - o[1], thick + 0.01);
      const n = outline.length;
      const j = (i + 1) % n;
      index.push(i * 2, i * 2 + 1, j * 2, j * 2, i * 2 + 1, j * 2 + 1);
    });
    const rim = new THREE.BufferGeometry();
    rim.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rim.setIndex(index);
    rim.computeVertexNormals();
    return {cutGeo: cut, rimGeo: rim, box: {mid, w: Math.max(...xs) - Math.min(...xs) + 4, h: Math.max(...ys) - Math.min(...ys) + 4, low: Math.min(...ys) - 2}};
  }, [key, thick, extent, edgeWidth]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <mesh geometry={cutGeo}><Surface kind={solid} repeat={[0.3, 0.3]} tint={solidTint} /></mesh>
      <mesh geometry={rimGeo}><meshStandardMaterial color={edge} roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <mesh position={[box.mid[0], box.mid[1], -thick + 0.02]} receiveShadow><planeGeometry args={[box.w, box.h]} /><Surface kind={back} repeat={[box.w / 7, box.h / 7]} tint={backTint} /></mesh>
      {water !== undefined && <WaterSurface p={[box.mid[0], (water + box.low) / 2, thick - 0.03]} s={[box.w, water - box.low]} rot={[0, 0, 0]} opacity={waterOpacity} scale={4} />}
    </group>
  );
};
