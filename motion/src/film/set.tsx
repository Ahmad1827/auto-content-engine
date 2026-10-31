import {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {softDisc} from './rig';

// The look of every film: soft rounded shapes in matte colours, like modelling clay under warm light. Build new things from these same parts, and they'll belong in the same world.
type V3 = [number, number, number];
type Placed = {at?: V3; turn?: number; size?: number};

const rounded = new Map<string, THREE.BufferGeometry>();

const Clay: React.FC<{c: string; rough?: number}> = ({c, rough = 0.82}) => <meshStandardMaterial color={c} roughness={rough} metalness={0} />;

// A box with soft edges. `s` is its full size, `r` how rounded.
export const Block: React.FC<{p?: V3; s: V3; c: string; r?: number; rot?: V3}> = ({p, s, c, r = 0.02, rot}) => {
  const key = `${s.join()}/${r}`;
  if (!rounded.has(key)) rounded.set(key, new RoundedBoxGeometry(s[0], s[1], s[2], 4, Math.min(r, Math.min(...s) / 2 - 0.0005)));
  return <mesh geometry={rounded.get(key)} position={p} rotation={rot} castShadow receiveShadow><Clay c={c} /></mesh>;
};
export const Ball: React.FC<{p?: V3; s?: V3 | number; c: string; rot?: V3}> = ({p, s = 1, c, rot}) => <mesh position={p} rotation={rot} scale={s} castShadow receiveShadow><sphereGeometry args={[1, 28, 20]} /><Clay c={c} /></mesh>;
export const Tube: React.FC<{p?: V3; r?: number; r2?: number; h: number; c: string; rot?: V3}> = ({p, r = 0.03, r2, h, c, rot}) => <mesh position={p} rotation={rot} castShadow receiveShadow><cylinderGeometry args={[r2 ?? r, r, h, 24]} /><Clay c={c} /></mesh>;

const Placed: React.FC<Placed & {children: React.ReactNode}> = ({at, turn = 0, size = 1, children}) => <group position={at} rotation={[0, (turn * Math.PI) / 180, 0]} scale={size}>{children}</group>;

// A soft dark patch on a surface: where things meet the floor, it makes them sit there rather than float. Use one under anything without a clear shadow.
export const Soft: React.FC<{at?: V3; s?: [number, number]; strength?: number}> = ({at = [0, 0.012, 0], s = [1, 1], strength = 0.45}) => (
  <mesh position={at} rotation={[-Math.PI / 2, 0, 0]} scale={[s[0], s[1], 1]}><planeGeometry /><meshBasicMaterial map={softDisc()} color="#150f26" transparent opacity={strength} depthWrite={false} /></mesh>
);

// A plane with soft dark edges where it meets its neighbours, the shading a real room has in its corners.
const Shaded: React.FC<{w: number; h: number; c: string; p: V3; rot: V3; dark?: [number, number, number, number]; pattern?: THREE.Texture}> = ({w, h, c, p, rot, dark = [0.3, 0.3, 0.3, 0.3], pattern}) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 32, 32);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const shade = (d: number, amount: number) => 1 - amount * Math.exp(-d / 0.32);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const v = shade(x + w / 2, dark[0]) * shade(w / 2 - x, dark[1]) * shade(y + h / 2, dark[2]) * shade(h / 2 - y, dark[3]);
      colors.set([v, v, v], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [w, h, dark.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} position={p} rotation={rot} receiveShadow><meshStandardMaterial color={c} vertexColors roughness={0.95} map={pattern} /></mesh>;
};

function planks(w: number, d: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(30,15,5,${0.03 + ((i * 37) % 10) * 0.012})`;
    ctx.fillRect(i * 64, 0, 64, 512);
    ctx.fillStyle = 'rgba(20,10,0,0.35)';
    ctx.fillRect(i * 64, 0, 2, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 1.6, d / 1.6);
  return tex;
}

// An open-fronted room with its floor centred on `at`: the camera looks in from +z. Soft shading in the corners, skirting along the walls.
export const Room: React.FC<{size?: [number, number]; height?: number; at?: V3; wall?: string; floor?: string; trim?: string; wood?: boolean; side?: boolean}> = ({size = [7, 6], height = 3, at = [0, 0, 0], wall = '#6d81b8', floor = '#a39fc2', trim = '#e8e4dd', wood = false, side = true}) => {
  const [w, d] = size;
  const pattern = useMemo(() => (wood ? planks(w, d) : undefined), [wood, w, d]);
  const spare = 12;
  return (
    <group position={at}>
      <Shaded w={w + spare} h={d + spare} c={floor} p={[0, 0, spare / 2]} rot={[-Math.PI / 2, 0, 0]} dark={[0, 0, 0, 0.42]} pattern={pattern} />
      <Shaded w={w} h={height} c={wall} p={[0, height / 2, -d / 2]} rot={[0, 0, 0]} dark={side ? [0.3, 0.3, 0.38, 0.18] : [0, 0, 0.38, 0.18]} />
      {side && <Shaded w={d + spare} h={height} c={wall} p={[-w / 2, height / 2, spare / 2]} rot={[0, Math.PI / 2, 0]} dark={[0.3, 0, 0.38, 0.18]} />}
      {side && <Shaded w={d + spare} h={height} c={wall} p={[w / 2, height / 2, spare / 2]} rot={[0, -Math.PI / 2, 0]} dark={[0, 0.3, 0.38, 0.18]} />}
      <Block p={[0, 0.07, -d / 2 + 0.02]} s={[w, 0.14, 0.04]} c={trim} r={0.012} />
      {side && <Block p={[-w / 2 + 0.02, 0.07, spare / 2]} s={[0.04, 0.14, d + spare]} c={trim} r={0.012} />}
      {side && <Block p={[w / 2 - 0.02, 0.07, spare / 2]} s={[0.04, 0.14, d + spare]} c={trim} r={0.012} />}
    </group>
  );
};

// A cushion shape: fat in the middle, pinched corners.
function pillowShape() {
  const g = new THREE.SphereGeometry(1, 32, 22);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const e = (a: number) => Math.sign(a) * Math.abs(a) ** 0.5;
    p.setXYZ(i, e(v.x), v.y, e(v.z));
  }
  g.computeVertexNormals();
  return g;
}
let pillow: THREE.BufferGeometry | null = null;
export const Pillow: React.FC<{p?: V3; s?: V3; c?: string; rot?: V3}> = ({p, s = [0.37, 0.1, 0.25], c = '#e8e5ef', rot}) => {
  if (!pillow) pillow = pillowShape();
  return <mesh geometry={pillow} position={p} scale={s} rotation={rot} castShadow receiveShadow><Clay c={c} rough={0.9} /></mesh>;
};

// A thick quilt lying over something: wide soft folds, a rounded edge, and a hump over each body beneath it. `w` across, `d` long. Bumps are {x, z, r: width, l: length, h: height} from its centre.
export const Quilt: React.FC<{at?: V3; w?: number; d?: number; c?: string; height?: number; bumps?: {x: number; z: number; r?: number; l?: number; h?: number}[]; seed?: number}> = ({at, w = 1.9, d = 1.7, c = '#3a5196', height = 0.17, bumps = [], seed = 1}) => {
  const key = JSON.stringify(bumps);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d, 120, 120);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = -p.getY(i);
      const edge = Math.min(1, Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z)) / 0.13);
      const round = Math.sqrt(Math.max(0, 1 - (1 - edge) ** 2));
      // Puffy lobes with creases between them: the look of a thick duvet.
      const warp = Math.sin(x * 1.9 + seed) * 0.6 + Math.cos(z * 1.5 + seed * 2) * 0.6;
      const lobes = Math.abs(Math.sin((x * 1.1 + z * 2.1 + warp) * 2.5)) ** 0.5 * 0.1 + Math.abs(Math.sin((x * 2.2 - z * 0.9 - warp * 0.7) * 2)) ** 0.5 * 0.085;
      const folds = lobes - 0.11;
      let hump = 0;
      for (const b of bumps) hump += (b.h ?? 0.13) * Math.exp(-(((x - b.x) / (b.r ?? 0.26)) ** 2) - (((z - b.z) / (b.l ?? 0.75)) ** 4));
      p.setZ(i, (height + hump + folds) * round);
    }
    g.computeVertexNormals();
    return g;
  }, [w, d, height, key, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} position={at} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow><meshStandardMaterial color={c} roughness={0.92} side={THREE.DoubleSide} /></mesh>;
};

// The top of the mattress is 0.6 m up. It's 2 m wide and 2.3 m long, with the headboard towards -z. Lay people on it with y = 0.6.
export const Bed: React.FC<Placed & {wood?: string; sheet?: string; pillows?: string}> = ({at, turn, size, wood = '#c08a52', sheet = '#dedbe8', pillows = '#ebe8f1'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0.05]} s={[3.5, 3.8]} strength={0.55} />
    <Block p={[0, 0.26, 1.2]} s={[2.18, 0.34, 0.09]} c={wood} r={0.022} />
    <Block p={[0, 0.2, -1.15]} s={[2.1, 0.2, 0.1]} c={wood} />
    {[-1, 1].map((x) => <Block key={x} p={[x * 1.05, 0.26, 0]} s={[0.09, 0.22, 2.4]} c={wood} r={0.022} />)}
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Block key={`${x}/${z}`} p={[x * 1.05, 0.12, z * 1.2]} s={[0.1, 0.24, 0.1]} c={wood} r={0.02} />))}
    <Block p={[0, 0.48, 0]} s={[2, 0.24, 2.3]} c={sheet} r={0.08} />
    <Block p={[0, 0.72, -1.17]} s={[2.22, 0.98, 0.09]} c={wood} r={0.03} />
    <Block p={[0, 1.2, -1.17]} s={[2.3, 0.07, 0.13]} c={wood} r={0.025} />
    <Pillow p={[-0.5, 0.69, -0.87]} rot={[0.14, 0, 0]} c={pillows} />
    <Pillow p={[0.5, 0.69, -0.87]} rot={[0.14, 0, 0]} c={pillows} />
  </Placed>
);

export const Cabinet: React.FC<Placed & {c?: string; w?: number; h?: number; d?: number; drawers?: number}> = ({at, turn, size, c = '#c08a52', w = 0.6, h = 0.6, d = 0.45, drawers = 2}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0]} s={[w * 1.8, d * 2]} />
    <Block p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.024} />
    {Array.from({length: drawers}, (_, i) => {
      const y = (h * (i + 0.5)) / drawers;
      return (
        <group key={i}>
          <Block p={[0, y, d / 2 + 0.006]} s={[w * 0.86, h / drawers - 0.04, 0.016]} c={new THREE.Color(c).multiplyScalar(1.13).getStyle()} r={0.006} />
          <Ball p={[0, y, d / 2 + 0.026]} s={0.017} c="#5a4632" />
        </group>
      );
    })}
  </Placed>
);

// Gives off light: it brings its own warm pool on whatever's nearby. Stands on whatever `at` is, usually a table top.
export const Lamp: React.FC<Placed & {on?: boolean; shade?: string; stand?: string; strength?: number; tall?: boolean}> = ({at, turn, size, on = true, shade = '#ffdf9c', stand = '#a06f3b', strength = 7, tall = false}) => {
  const h = tall ? 1.45 : 0.2;
  return (
    <Placed at={at} turn={turn} size={size}>
      <Tube p={[0, 0.012, 0]} r={tall ? 0.15 : 0.08} h={0.024} c={stand} />
      <Tube p={[0, h / 2, 0]} r={tall ? 0.022 : 0.055} r2={tall ? 0.018 : 0.03} h={h} c={stand} />
      <mesh position={[0, h + 0.1, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 0.22, 28, 1, true]} />
        {on ? <meshBasicMaterial color={shade} side={THREE.DoubleSide} /> : <meshStandardMaterial color={shade} side={THREE.DoubleSide} />}
      </mesh>
      {on && <pointLight position={[0, h + 0.12, 0.05]} intensity={strength} distance={7} decay={1.7} color="#ffb565" />}
      {on && <sprite position={[0, h + 0.1, 0.02]} scale={[1.1, 1.1, 1]}><spriteMaterial map={softDisc()} color="#ffb35c" opacity={0.42} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>}
    </Placed>
  );
};

const SKY = {night: ['#121c49', '#35407f'], dusk: ['#39488f', '#f4a06b'], day: ['#7ab8ee', '#d4ecfa'], grey: ['#9aa6b2', '#d0d4d7']};
function gradient(top: string, bottom: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const fade = ctx.createLinearGradient(0, 0, 0, 128);
  fade.addColorStop(0, top);
  fade.addColorStop(1, bottom);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A hanging curtain whose folds run down it.
const Curtain: React.FC<{p: V3; w: number; h: number; c: string}> = ({p, w, h, c}) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 40, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * 7) * 0.028);
    g.computeVertexNormals();
    return g;
  }, [w, h]);
  return <mesh geometry={geo} position={p} castShadow receiveShadow><meshStandardMaterial color={c} side={THREE.DoubleSide} roughness={0.9} /></mesh>;
};

// A window set on a wall that faces +z, centred on `at`. `view` is the sky outside.
export const Window: React.FC<Placed & {w?: number; h?: number; view?: keyof typeof SKY; frame?: string; curtains?: string | null}> = ({at, turn, size, w = 1.1, h = 1.3, view = 'night', frame = '#e8e4dd', curtains = '#b56a55'}) => {
  const sky = useMemo(() => gradient(SKY[view][0], SKY[view][1]), [view]);
  return (
    <Placed at={at} turn={turn} size={size}>
      <mesh position={[0, 0, 0.012]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={sky} /></mesh>
      {view === 'night' && <mesh position={[w * 0.2, h * 0.24, 0.016]}><circleGeometry args={[0.075, 28]} /><meshBasicMaterial color="#f7efcb" /></mesh>}
      {([[0, h / 2, w + 0.12, 0.07], [0, -h / 2, w + 0.2, 0.08], [0, 0, 0.04, h]] as const).map(([x, y, a, b], i) => <Block key={i} p={[x, y, 0.03]} s={[a, b, 0.07]} c={frame} r={0.012} />)}
      {[-1, 1].map((x) => <Block key={x} p={[(x * w) / 2, 0, 0.03]} s={[0.07, h, 0.07]} c={frame} r={0.012} />)}
      {curtains && [-1, 1].map((x) => <Curtain key={x} p={[x * (w / 2 + 0.05), -0.06, 0.1]} w={0.42} h={h + 0.35} c={curtains} />)}
      {curtains && <Tube p={[0, h / 2 + 0.14, 0.1]} r={0.014} h={w + 0.9} c="#54402f" rot={[0, 0, Math.PI / 2]} />}
    </Placed>
  );
};

// Hung on a wall facing +z.
export const Picture: React.FC<Placed & {w?: number; h?: number; frame?: string; art?: string[]}> = ({at, turn, size, w = 0.55, h = 0.42, frame = '#7a5a3a', art = ['#e6d7b9', '#d8805a', '#55709f']}) => (
  <Placed at={at} turn={turn} size={size}>
    <Block p={[0, 0, 0.012]} s={[w, h, 0.03]} c={frame} r={0.008} />
    <mesh position={[0, 0, 0.028]}><planeGeometry args={[w * 0.84, h * 0.84]} /><meshStandardMaterial color={art[0]} /></mesh>
    <mesh position={[-w * 0.09, -h * 0.03, 0.031]}><circleGeometry args={[h * 0.2, 24]} /><meshStandardMaterial color={art[1]} /></mesh>
    <mesh position={[w * 0.12, -h * 0.17, 0.033]}><planeGeometry args={[w * 0.5, h * 0.24]} /><meshStandardMaterial color={art[2]} /></mesh>
  </Placed>
);

// On a wall facing +z, its shelf at `at`. Books in muted colours, the same every time for a given `seed`.
export const Shelf: React.FC<Placed & {w?: number; c?: string; seed?: number}> = ({at, turn, size, w = 1.1, c = '#a97a4a', seed = 2}) => {
  const COLORS = ['#b45a4a', '#d4a44f', '#4f7a8c', '#7a5a8c', '#ddd2bb', '#5d8a64'];
  let x = -w / 2 + 0.06;
  const books: React.ReactNode[] = [];
  for (let i = 0; x < w * 0.2; i++) {
    const n = (i * 5 + seed * 3) % 6;
    const thick = 0.035 + ((i + seed) % 3) * 0.012;
    const tall = 0.17 + ((i * 3 + seed) % 4) * 0.022;
    books.push(<Block key={i} p={[x + thick / 2, 0.022 + tall / 2, 0.11]} s={[thick, tall, 0.14]} c={COLORS[n]} r={0.005} />);
    x += thick + 0.004;
  }
  return (
    <Placed at={at} turn={turn} size={size}>
      <Block p={[0, 0, 0.11]} s={[w, 0.04, 0.22]} c={c} r={0.01} />
      {books}
      <Tube p={[w * 0.31, 0.055, 0.11]} r={0.04} r2={0.055} h={0.09} c="#c9754f" />
      <Ball p={[w * 0.31, 0.15, 0.11]} s={[0.075, 0.075, 0.075]} c="#6a9a5e" />
    </Placed>
  );
};

export const Plant: React.FC<Placed & {pot?: string; leaf?: string}> = ({at, turn, size, pot = '#c9754f', leaf = '#5f9a5c'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0]} s={[0.8, 0.8]} />
    <Tube p={[0, 0.17, 0]} r={0.12} r2={0.17} h={0.34} c={pot} />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = i * 2.4;
      const lean = 0.25 + (i % 3) * 0.2;
      return <Ball key={i} p={[Math.sin(a) * lean * 0.5, 0.62 + (i % 3) * 0.13, Math.cos(a) * lean * 0.5]} s={[0.1, 0.3, 0.05]} rot={[Math.cos(a) * lean, a, -Math.sin(a) * lean * 0.3]} c={i % 2 ? leaf : new THREE.Color(leaf).multiplyScalar(0.82).getStyle()} />;
    })}
  </Placed>
);

export const Rug: React.FC<Placed & {w?: number; d?: number; c?: string; edge?: string; round?: boolean}> = ({at, turn, size, w = 2, d = 1.4, c = '#b7664f', edge = '#e6d7b9', round = false}) => (
  <Placed at={at} turn={turn} size={size}>
    {round ? (
      <>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w / 2, d / 2, 1]} receiveShadow><circleGeometry args={[1, 48]} /><Clay c={edge} /></mesh>
        <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w / 2 - 0.08, d / 2 - 0.08, 1]} receiveShadow><circleGeometry args={[1, 48]} /><Clay c={c} /></mesh>
      </>
    ) : (
      <>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w, d]} /><Clay c={edge} /></mesh>
        <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w - 0.16, d - 0.16]} /><Clay c={c} /></mesh>
      </>
    )}
  </Placed>
);

// Against a wall facing +z, its base at `at`.
export const Door: React.FC<Placed & {c?: string; frame?: string; open?: number}> = ({at, turn, size, c = '#b58c62', frame = '#e8e4dd', open = 0}) => (
  <Placed at={at} turn={turn} size={size}>
    {[-1, 1].map((x) => <Block key={x} p={[x * 0.5, 1.05, 0.02]} s={[0.08, 2.1, 0.06]} c={frame} r={0.012} />)}
    <Block p={[0, 2.1, 0.02]} s={[1.08, 0.08, 0.06]} c={frame} r={0.012} />
    {open > 0 && <mesh position={[0, 1.03, 0.004]}><planeGeometry args={[0.92, 2.06]} /><meshBasicMaterial color="#1d1a2b" /></mesh>}
    <group position={[-0.46, 0, 0.02]} rotation={[0, -open * 1.5, 0]}>
      <Block p={[0.46, 1.03, 0]} s={[0.92, 2.06, 0.05]} c={c} r={0.012} />
      <Block p={[0.46, 1.48, 0.028]} s={[0.66, 0.74, 0.012]} c={new THREE.Color(c).multiplyScalar(0.9).getStyle()} r={0.005} />
      <Block p={[0.46, 0.52, 0.028]} s={[0.66, 0.68, 0.012]} c={new THREE.Color(c).multiplyScalar(0.9).getStyle()} r={0.005} />
      <Ball p={[0.82, 1.03, 0.055]} s={0.035} c="#d9b45a" />
    </group>
  </Placed>
);

// Seats are 0.48 m up. Put a sitting actor 0.36 m in front of the middle of the seat, facing the same way (+z).
export const Chair: React.FC<Placed & {c?: string; seat?: string}> = ({at, turn, size, c = '#a97a4a', seat = '#c95f4c'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0]} s={[0.9, 0.9]} />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Block key={`${x}/${z}`} p={[x * 0.2, 0.21, z * 0.2]} s={[0.05, 0.42, 0.05]} c={c} r={0.012} />))}
    <Block p={[0, 0.44, 0]} s={[0.5, 0.07, 0.5]} c={seat} r={0.03} />
    {[-1, 1].map((x) => <Block key={x} p={[x * 0.2, 0.72, -0.22]} s={[0.05, 0.55, 0.05]} c={c} r={0.012} />)}
    <Block p={[0, 0.92, -0.22]} s={[0.5, 0.2, 0.05]} c={c} r={0.02} />
  </Placed>
);

// Facing +z. Seat 0.48 m up: for a sitting actor, x along it and z = 0.38 in front of the sofa's middle.
export const Sofa: React.FC<Placed & {c?: string; w?: number}> = ({at, turn, size, c = '#5f8a7c', w = 2}) => {
  const dark = new THREE.Color(c).multiplyScalar(0.88).getStyle();
  return (
    <Placed at={at} turn={turn} size={size}>
      <Soft at={[0, 0.012, 0]} s={[w * 1.55, 1.9]} strength={0.5} />
      <Block p={[0, 0.2, 0]} s={[w, 0.3, 0.86]} c={dark} r={0.06} />
      <Block p={[0, 0.6, -0.35]} s={[w, 0.8, 0.22]} c={dark} r={0.09} />
      {[-1, 1].map((x) => <Block key={x} p={[(x * w) / 2, 0.38, 0.02]} s={[0.24, 0.5, 0.88]} c={c} r={0.1} />)}
      {[-1, 1].map((x) => <Block key={x} p={[(x * (w - 0.3)) / 4, 0.41, 0.08]} s={[(w - 0.32) / 2, 0.14, 0.7]} c={c} r={0.06} />)}
      {[-1, 1].map((x) => <Block key={x} p={[(x * (w - 0.3)) / 4, 0.68, -0.18]} s={[(w - 0.36) / 2, 0.42, 0.17]} c={c} r={0.08} />)}
    </Placed>
  );
};

// Top surface `h` up, whatever's on it goes at that height.
export const Table: React.FC<Placed & {w?: number; d?: number; h?: number; c?: string; legs?: string}> = ({at, turn, size, w = 1.3, d = 0.75, h = 0.75, c = '#c79a63', legs}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0]} s={[w * 1.6, d * 1.9]} />
    <Block p={[0, h - 0.025, 0]} s={[w, 0.05, d]} c={c} r={0.018} />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Block key={`${x}/${z}`} p={[x * (w / 2 - 0.07), (h - 0.05) / 2, z * (d / 2 - 0.07)]} s={[0.055, h - 0.05, 0.055]} c={legs ?? c} r={0.014} />))}
  </Placed>
);

export const Laptop: React.FC<Placed & {c?: string; open?: number; screen?: string}> = ({at, turn, size, c = '#b9bcc6', open = 1, screen = '#cfe3ff'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Block p={[0, 0.009, 0]} s={[0.34, 0.018, 0.23]} c={c} r={0.007} />
    <group position={[0, 0.016, -0.11]} rotation={[-(1 - open) * 1.8 - 0.25, 0, 0]}>
      <Block p={[0, 0.115, 0]} s={[0.34, 0.23, 0.012]} c={c} r={0.005} />
      <mesh position={[0, 0.115, 0.0075]}><planeGeometry args={[0.31, 0.2]} /><meshBasicMaterial color={screen} /></mesh>
    </group>
  </Placed>
);

export const Screen: React.FC<Placed & {w?: number; h?: number; c?: string; on?: string}> = ({at, turn, size, w = 1.3, h = 0.75, c = '#23242c', on = '#6fa7e6'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Block s={[w, h, 0.05]} c={c} r={0.012} />
    <mesh position={[0, 0, 0.027]}><planeGeometry args={[w - 0.05, h - 0.05]} /><meshBasicMaterial color={on} /></mesh>
  </Placed>
);

// Worktop 0.9 m up, facing +z.
export const Counter: React.FC<Placed & {w?: number; c?: string; top?: string}> = ({at, turn, size, w = 2.4, c = '#6a8ca0', top = '#e8e4dd'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0.1]} s={[w * 1.3, 1.2]} />
    <Block p={[0, 0.44, 0]} s={[w, 0.84, 0.6]} c={c} r={0.018} />
    <Block p={[0, 0.88, 0.01]} s={[w + 0.05, 0.05, 0.65]} c={top} r={0.014} />
    {Array.from({length: Math.round(w / 0.6)}, (_, i) => {
      const doors = Math.round(w / 0.6);
      const x = ((i + 0.5) / doors - 0.5) * w;
      return (
        <group key={i}>
          <Block p={[x, 0.45, 0.305]} s={[w / doors - 0.04, 0.74, 0.014]} c={new THREE.Color(c).multiplyScalar(1.1).getStyle()} r={0.006} />
          <Block p={[x, 0.73, 0.322]} s={[0.15, 0.018, 0.018]} c="#e8e4dd" r={0.006} />
        </group>
      );
    })}
  </Placed>
);

export const Fridge: React.FC<Placed & {c?: string}> = ({at, turn, size, c = '#dfe4e8'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.012, 0.05]} s={[1.3, 1.3]} />
    <Block p={[0, 0.92, 0]} s={[0.75, 1.84, 0.7]} c={c} r={0.05} />
    <Block p={[0, 1.3, 0.355]} s={[0.7, 0.012, 0.012]} c="#a9b0b6" r={0.004} />
    {[0.9, 1.55].map((y) => <Block key={y} p={[-0.28, y, 0.37]} s={[0.03, 0.3, 0.03]} c="#a9b0b6" r={0.012} />)}
  </Placed>
);

export const Mug: React.FC<Placed & {c?: string}> = ({at, turn, size, c = '#e8e4dd'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Tube p={[0, 0.05, 0]} r={0.045} h={0.1} c={c} />
    <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.038, 20]} /><meshStandardMaterial color="#3b2517" /></mesh>
    <mesh position={[0.058, 0.05, 0]} castShadow><torusGeometry args={[0.024, 0.008, 8, 18]} /><Clay c={c} /></mesh>
  </Placed>
);

// Lies flat by default. In a hand, try hold={{hand_r: <Phone turn... />}}.
export const Phone: React.FC<Placed & {c?: string; glow?: string; rot?: V3}> = ({at, turn, size, c = '#23242c', glow = '#a8cdfa', rot}) => (
  <Placed at={at} turn={turn} size={size}>
    <group rotation={rot}>
      <Block s={[0.075, 0.15, 0.01]} c={c} r={0.004} />
      <mesh position={[0, 0, 0.0056]}><planeGeometry args={[0.067, 0.14]} /><meshBasicMaterial color={glow} /></mesh>
    </group>
  </Placed>
);

// Outdoors.

// A big sky behind everything, fading to the horizon.
export const Sky: React.FC<{top?: string; bottom?: string; view?: keyof typeof SKY}> = ({top, bottom, view = 'day'}) => {
  const tex = useMemo(() => gradient(top ?? SKY[view][0], bottom ?? SKY[view][1]), [top, bottom, view]);
  return <mesh scale={[400, 400, 400]}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} /></mesh>;
};

export const Ground: React.FC<{c?: string; size?: number; y?: number}> = ({c = '#8fb174', size = 300, y = 0}) => <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow><planeGeometry args={[size, size]} /><meshStandardMaterial color={c} roughness={0.95} /></mesh>;

// Runs along z, `length` long, with pavements each side.
export const Road: React.FC<Placed & {w?: number; length?: number; c?: string; path?: string}> = ({at, turn, size, w = 5, length = 120, c = '#5a5d6b', path = '#b5b1a8'}) => (
  <Placed at={at} turn={turn} size={size}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow><planeGeometry args={[w, length]} /><meshStandardMaterial color={c} roughness={0.95} /></mesh>
    {[-1, 1].map((x) => <Block key={x} p={[x * (w / 2 + 0.9), 0.06, 0]} s={[1.8, 0.12, length]} c={path} r={0.02} />)}
    {Array.from({length: Math.floor(length / 4)}, (_, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, i * 4 - length / 2]}><planeGeometry args={[0.13, 1.8]} /><meshBasicMaterial color="#eee9dc" /></mesh>)}
  </Placed>
);

export const Tree: React.FC<Placed & {leaf?: string; trunk?: string}> = ({at, turn, size, leaf = '#5f9a5c', trunk = '#6e5238'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.02, 0]} s={[3, 3]} />
    <Tube p={[0, 1, 0]} r={0.17} r2={0.11} h={2} c={trunk} />
    <Ball p={[0, 2.6, 0]} s={[1.05, 1.1, 1.05]} c={leaf} />
    <Ball p={[0.62, 2.15, 0.2]} s={[0.68, 0.62, 0.68]} c={new THREE.Color(leaf).multiplyScalar(0.9).getStyle()} />
    <Ball p={[-0.55, 2.25, -0.2]} s={[0.72, 0.66, 0.72]} c={new THREE.Color(leaf).multiplyScalar(1.08).getStyle()} />
  </Placed>
);

export const Building: React.FC<Placed & {w?: number; h?: number; d?: number; c?: string; glass?: string; lit?: boolean}> = ({at, turn, size, w = 6, h = 9, d = 6, c = '#c98d6c', glass = '#7aa2c4', lit = false}) => {
  const columns = Math.max(1, Math.floor(w / 1.5));
  const rows = Math.max(1, Math.floor(h / 2.8));
  return (
    <Placed at={at} turn={turn} size={size}>
      <Block p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.06} />
      <Block p={[0, h + 0.1, 0]} s={[w + 0.2, 0.2, d + 0.2]} c={new THREE.Color(c).multiplyScalar(0.8).getStyle()} r={0.03} />
      {Array.from({length: columns * rows}, (_, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = ((col + 0.5) / columns - 0.5) * w;
        const y = ((row + 0.6) / rows) * h;
        return <group key={i} position={[x, y, d / 2 + 0.01]}><mesh><planeGeometry args={[0.85, 1.25]} />{lit && (i * 7) % 3 ? <meshBasicMaterial color="#ffd98a" /> : <meshStandardMaterial color={glass} roughness={0.35} />}</mesh><Block p={[0, -0.66, 0.02]} s={[1, 0.07, 0.07]} c="#e8e4dd" r={0.012} /></group>;
      })}
    </Placed>
  );
};

// Pointing along +z. Wheels on the ground.
export const Car: React.FC<Placed & {c?: string; glass?: string}> = ({at, turn, size, c = '#c8483c', glass = '#28303f'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.02, 0]} s={[3, 5.2]} strength={0.55} />
    <Block p={[0, 0.55, 0]} s={[1.8, 0.56, 4]} c={c} r={0.2} />
    <Block p={[0, 1.08, -0.2]} s={[1.56, 0.58, 2]} c={c} r={0.22} />
    <Block p={[0, 1.08, -0.2]} s={[1.6, 0.42, 1.76]} c={glass} r={0.12} />
    {[-1, 1].flatMap((x) => [-1.25, 1.25].map((z) => <Tube key={`${x}/${z}`} p={[x * 0.88, 0.34, z]} r={0.34} h={0.26} c="#25262c" rot={[0, 0, Math.PI / 2]} />))}
    {[-1, 1].map((x) => <Ball key={x} p={[x * 0.62, 0.62, 1.98]} s={[0.17, 0.1, 0.05]} c="#fff2c4" />)}
  </Placed>
);

export const StreetLamp: React.FC<Placed & {on?: boolean; c?: string}> = ({at, turn, size, on = false, c = '#3b3f4b'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Tube p={[0, 2.1, 0]} r={0.07} r2={0.05} h={4.2} c={c} />
    <Block p={[0, 4.25, 0.26]} s={[0.17, 0.09, 0.66]} c={c} r={0.03} />
    <Ball p={[0, 4.18, 0.45]} s={[0.15, 0.07, 0.15]} c={on ? '#ffe3a1' : '#e5e3da'} />
    {on && <pointLight position={[0, 3.9, 0.45]} intensity={7} distance={9} decay={1.6} color="#ffc680" />}
  </Placed>
);

export const Bench: React.FC<Placed & {c?: string}> = ({at, turn, size, c = '#a97a4a'}) => (
  <Placed at={at} turn={turn} size={size}>
    <Soft at={[0, 0.02, 0]} s={[2.4, 1]} />
    <Block p={[0, 0.45, 0]} s={[1.8, 0.06, 0.45]} c={c} r={0.022} />
    <Block p={[0, 0.85, -0.21]} s={[1.8, 0.28, 0.05]} c={c} r={0.02} />
    {[-0.75, 0.75].map((x) => <Block key={x} p={[x, 0.22, 0]} s={[0.07, 0.44, 0.42]} c="#3b3f4b" r={0.015} />)}
    {[-0.75, 0.75].map((x) => <Block key={x} p={[x, 0.63, -0.21]} s={[0.05, 0.42, 0.05]} c="#3b3f4b" r={0.012} />)}
  </Placed>
);

export const Cloud: React.FC<Placed & {c?: string}> = ({at, turn, size, c = '#f6f6f4'}) => (
  <Placed at={at} turn={turn} size={size}>
    {([[0, 0, 1.6], [1.5, -0.25, 1.1], [-1.5, -0.3, 1], [0.5, 0.65, 0.95]] as const).map(([x, y, r], i) => <mesh key={i} position={[x, y, 0]} scale={[r, r * 0.68, r]}><sphereGeometry args={[1, 20, 14]} /><meshBasicMaterial color={c} /></mesh>)}
  </Placed>
);

// Lights.

type Rig = {sky: string; floor: string; ambient: number; key: string; keyPower: number; keyFrom: V3; fill: string; fillPower: number; rim: string; rimPower: number};

const LOOKS: Record<string, Rig> = {
  // A room at night. Bring in a Lamp or two for the warm pool.
  cosy: {sky: '#c9d0ff', floor: '#8a78a8', ambient: 1.35, key: '#ffdcb8', keyPower: 1.25, keyFrom: [1.5, 6, 3.5], fill: '#aab8ff', fillPower: 0.3, rim: '#a4b8ff', rimPower: 0.65},
  // A bright room in the daytime.
  room: {sky: '#fff5e8', floor: '#b5a89a', ambient: 1.6, key: '#fff0d9', keyPower: 1.5, keyFrom: [2.5, 5, 3], fill: '#d7e4ff', fillPower: 0.35, rim: '#fff5e1', rimPower: 0.45},
  // Clear midday outdoors.
  day: {sky: '#cfe6ff', floor: '#a8a585', ambient: 1.35, key: '#fff1da', keyPower: 2.1, keyFrom: [5, 8, 4], fill: '#dbe9ff', fillPower: 0.3, rim: '#fffbe8', rimPower: 0.5},
  // Low warm sun, long shadows.
  golden: {sky: '#b8c7f0', floor: '#a88a78', ambient: 1.05, key: '#ffba77', keyPower: 2.5, keyFrom: [7, 3.2, 3], fill: '#a8b7f5', fillPower: 0.4, rim: '#ffd59c', rimPower: 0.8},
  // Soft, shadowless grey.
  overcast: {sky: '#e3e8ee', floor: '#a4a59e', ambient: 1.9, key: '#f4f4f0', keyPower: 0.6, keyFrom: [2, 8, 3], fill: '#dfe5ec', fillPower: 0.2, rim: '#eef2f6', rimPower: 0.2},
  // Outdoors in the dark: blue moonlight with a clear edge round people.
  night: {sky: '#5c6cae', floor: '#2f2b4b', ambient: 1, key: '#a9bcff', keyPower: 1, keyFrom: [-4, 7, 3], fill: '#6a78c4', fillPower: 0.25, rim: '#c5d0ff', rimPower: 0.9},
  // Cold and tense, for offices, hospitals and bad news.
  cold: {sky: '#d8e4f0', floor: '#8c97a8', ambient: 1.4, key: '#eaf2ff', keyPower: 1.5, keyFrom: [1.5, 6, 3], fill: '#bcd0ec', fillPower: 0.3, rim: '#d8e8ff', rimPower: 0.45},
};

export type LightLook = 'cosy' | 'room' | 'day' | 'golden' | 'overcast' | 'night' | 'cold';

// Every film's lighting, in one line: a soft sky, a main light with soft shadows, a fill so shadows stay coloured, and a light from behind that lifts people off the background.
// `size` is how many metres around `centre` the shadows have to cover. Keep it close to the action, for sharper shadows.
export const Lights: React.FC<{look?: LightLook; centre?: V3; size?: number; power?: number}> = ({look = 'cosy', centre = [0, 0, 0], size = 6, power = 1}) => {
  const r = LOOKS[look];
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(...centre);
  const scale = size / 4;
  const from = r.keyFrom.map((v, i) => centre[i] + v * scale) as V3;
  return (
    <>
      <hemisphereLight args={[r.sky, r.floor, r.ambient * power]} />
      <primitive object={target} />
      <directionalLight position={from} target={target} intensity={r.keyPower * power} color={r.key} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.025} shadow-radius={7}
        shadow-camera-left={-size} shadow-camera-right={size} shadow-camera-top={size} shadow-camera-bottom={-size} shadow-camera-near={0.5} shadow-camera-far={size * 7} />
      <directionalLight position={[centre[0] - 3, centre[1] + 2, centre[2] + 4]} target={target} intensity={r.fillPower * power} color={r.fill} />
      <directionalLight position={[centre[0] + 3.5, centre[1] + 2.5, centre[2] - 4]} target={target} intensity={r.rimPower * power} color={r.rim} />
    </>
  );
};
