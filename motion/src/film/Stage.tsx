import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {createContext, useContext} from 'react';
import {getInputProps, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {loadActorAssets} from './Actor';
import {type Shot, toScreen, viewAt, type View} from './camera';
import {Grade, useFilm} from './Film';
import {softDisc, useLoaded} from './rig';

const ViewContext = createContext<View | null>(null);

// The current camera, for anything that hangs off it (POV hands, HUD labels pinned to the world).
export const useView = () => useContext(ViewContext) as View;

const Rig: React.FC<{view: View}> = ({view}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.copy(view.pos);
  camera.fov = view.fov;
  camera.up.set(0, 1, 0);
  camera.lookAt(view.look);
  camera.rotateZ((view.roll * Math.PI) / 180);
  camera.updateProjectionMatrix();
  return null;
};

const MIN_SHOT = 1.2;
const MIN_AVERAGE = 2.8;

// Rapid cutting is what makes a film hard to follow, so `film.mjs check` refuses it. Finished films always render.
function checkPacing(shots: Shot[], end: number) {
  const times = shots.map((s) => s.at).filter((at) => at < end).sort((a, b) => a - b);
  const short = times.flatMap((at, i) => {
    const length = (times[i + 1] ?? end) - at;
    return length < MIN_SHOT ? [`${at.toFixed(2)}s (${length.toFixed(2)}s long)`] : [];
  });
  if (short.length) throw new Error(`PACING: every shot must last at least ${MIN_SHOT}s. Too short: ${short.join(', ')}. Merge these shots, or hold them longer.`);
  if (end / times.length < MIN_AVERAGE) throw new Error(`PACING: ${times.length} shots in ${end.toFixed(1)}s averages ${(end / times.length).toFixed(2)}s. Average at least ${MIN_AVERAGE}s: at most ${Math.floor(end / MIN_AVERAGE)} shots.`);
}

// A label pinned to a place in the world, which stays on it while the camera moves. With `from` it's a measured span between two points; without, a callout on one point.
export type Note = {at: number; until: number; to: [number, number, number]; from?: [number, number, number]; text: string; color?: string; size?: number; lift?: number};

const Notes: React.FC<{notes: Note[]; view: View; t: number; width: number; height: number}> = ({notes, view, t, width, height}) => {
  const {font} = useFilm();
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
      {notes.filter((n) => t >= n.at && t < n.until).map((n, i) => {
        const a = Math.min(1, (t - n.at) * 7) * Math.min(1, (n.until - t) * 7);
        const color = n.color ?? '#ffd76a';
        const size = n.size ?? 40;
        const end = toScreen(view, n.to, width, height);
        if (!end) return null;
        const label = (x: number, y: number) => {
          const half = (n.text.length * size * 0.32) + 12;
          const cx = Math.min(width - half - 20, Math.max(half + 20, x));
          return <text x={cx} y={y} textAnchor="middle" fontFamily={font} fontWeight={800} fontSize={size} fill={color} stroke="#0b0b0d" strokeWidth={8} paintOrder="stroke fill">{n.text}</text>;
        };
        if (n.from) {
          const start = toScreen(view, n.from, width, height);
          if (!start) return null;
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const len = Math.hypot(dx, dy) || 1;
          const [nx, ny] = [(-dy / len) * 16, (dx / len) * 16];
          const shown = Math.min(1, (t - n.at) * 3);
          const q = {x: start.x + dx * shown, y: start.y + dy * shown};
          return (
            <g key={i} opacity={a}>
              <path d={`M${start.x + nx} ${start.y + ny}L${start.x - nx} ${start.y - ny}M${start.x} ${start.y}L${q.x} ${q.y}M${q.x + nx} ${q.y + ny}L${q.x - nx} ${q.y - ny}`} stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
              {label((start.x + end.x) / 2, (start.y + end.y) / 2 + (n.lift ?? 52))}
            </g>
          );
        }
        const lift = n.lift ?? 110;
        return (
          <g key={i} opacity={a}>
            <circle cx={end.x} cy={end.y} r={9} fill={color} stroke="#0b0b0d" strokeWidth={3} />
            <path d={`M${end.x} ${end.y}L${end.x} ${end.y - lift * Math.min(1, (t - n.at) * 6)}`} stroke={color} strokeWidth={4} />
            {label(end.x, end.y - lift - 14)}
          </g>
        );
      })}
    </svg>
  );
};

// The whole 3D world of the film. Keep one Stage and one world, and cut between shots by listing cameras, so places stay consistent.
export const Stage: React.FC<{
  shots: Shot[];
  children: React.ReactNode;
  background?: string;
  fog?: [string, number, number];
  // Shadow maps are the slowest thing in a frame on a CPU. Leave on unless the scene is huge.
  shadows?: boolean;
  // The finish over the picture: warmth 0 to about 0.25, darker corners 0 to about 0.6. Pass false to go without.
  grade?: {warmth?: number; vignette?: number} | false;
  // Labels pinned to the world.
  notes?: Note[];
  // Moments the camera feels a heavy landing. Strength 1 is a soft jolt; pass [time, strength] to vary it.
  bumps?: (number | [number, number])[];
  // Even a locked-off camera breathes very slightly, so that no frame is dead. 0 turns this off.
  drift?: number;
  // Renders the 3D at 1/n resolution with hard square pixels: 3D that looks like pixel art. About 5-8 suits a phone. `colors` limits each channel to that many levels, for an 8-bit palette.
  pixels?: number;
  colors?: number;
}> = ({shots, children, background = '#9fd0ef', fog, shadows = true, grade = {}, notes, bumps, drift = 1, pixels, colors}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const t = frame / fps;
  const view = viewAt(shots, t, durationInFrames / fps);
  const reach = view.pos.distanceTo(view.look);
  if (drift) {
    view.pos.x += Math.sin(t * 0.31 + 1) * reach * 0.012 * drift;
    view.pos.y += Math.sin(t * 0.23 + 2) * reach * 0.007 * drift;
    view.pos.z += Math.sin(t * 0.19) * reach * 0.01 * drift;
  }
  for (const b of bumps ?? []) {
    const [at, power] = typeof b === 'number' ? [b, 1] : b;
    const since = t - at;
    if (since >= 0 && since < 0.45) {
      const jolt = Math.exp(-since * 10) * Math.cos(since * 34) * reach * 0.006 * power;
      view.pos.y -= jolt;
      view.look.y -= jolt * 0.7;
    }
  }
  if (getInputProps().filmCheck) checkPacing(shots, durationInFrames / fps);
  const ready = useLoaded(loadActorAssets, 'characters');
  if (!ready) return null;
  const n = pixels && pixels > 1 ? Math.round(pixels) : 1;
  const levels = colors ? Array.from({length: colors}, (_, i) => (i / (colors - 1)).toFixed(3)).join(' ') : '';
  const canvas = (
    <ThreeCanvas width={Math.round(width / n)} height={Math.round(height / n)} shadows={shadows} gl={{preserveDrawingBuffer: true, antialias: n === 1}} camera={{fov: view.fov, near: 0.05, far: 2000, position: view.pos.toArray()}}>
      <Rig view={view} />
      <color attach="background" args={[background]} />
      {fog && <fog attach="fog" args={fog} />}
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </ThreeCanvas>
  );
  return (
    <>
    {n === 1 && !colors ? canvas : (
      <div style={{position: 'absolute', left: 0, top: 0, width: Math.round(width / n), height: Math.round(height / n), transformOrigin: '0 0', transform: `scale(${n})`, imageRendering: 'pixelated', filter: colors ? 'url(#stagePalette)' : undefined}}>
        {colors && <svg width="0" height="0" style={{position: 'absolute'}}><filter id="stagePalette" colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncR type="discrete" tableValues={levels} /><feFuncG type="discrete" tableValues={levels} /><feFuncB type="discrete" tableValues={levels} /></feComponentTransfer></filter></svg>}
        {canvas}
      </div>
    )}
    {grade && <Grade {...grade} />}
    {notes && <Notes notes={notes} view={view} t={t} width={width} height={height} />}
    </>
  );
};

// Hangs its children in front of the camera, for first-person hands and held objects. x right, y up, z forward, metres.
export const AtCamera: React.FC<{offset?: [number, number, number]; children: React.ReactNode}> = ({offset = [0, 0, 0], children}) => {
  const view = useView();
  const m = new THREE.Matrix4().lookAt(view.pos, view.look, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const p = view.pos.clone().add(new THREE.Vector3(offset[0], offset[1], -offset[2]).applyQuaternion(q));
  return <group position={p.toArray()} quaternion={q}>{children}</group>;
};

// A first-person forearm and hand. It reaches forward along -Z from the near edge of the frame. Put it inside AtCamera.
export const PovHand: React.FC<{side?: 'l' | 'r'; skin?: string; sleeve?: string; grip?: number; point?: boolean}> = ({side = 'r', skin = '#e8b48f', sleeve = '#f4f4f2', grip = 0.15, point = false}) => {
  const s = side === 'r' ? 1 : -1;
  const curl = 0.2 + grip * 1.5;
  return (
    <group scale={[s, 1, 1]}>
      <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.042, 0.05, 0.42, 14]} /><meshStandardMaterial color={sleeve} roughness={0.85} /></mesh>
      <mesh position={[0, 0, 0.03]} scale={[0.046, 0.019, 0.05]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
      {[-0.03, -0.01, 0.01, 0.03].map((x, i) => {
        const straight = point && i === 1;
        return (
          <group key={x} position={[x, 0, -0.012]} rotation={[straight ? 0 : -curl, 0, 0]}>
            <mesh position={[0, 0, -0.036]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.0085, 0.06, 4, 8]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
          </group>
        );
      })}
      <mesh position={[-0.052, 0, 0.012]} rotation={[Math.PI / 2, 0, -0.7]}><capsuleGeometry args={[0.01, 0.045, 4, 8]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
    </group>
  );
};

// A soft halo around anything that gives off light: lamps, candles, screens. It always faces the camera.
export const Glow: React.FC<{position: [number, number, number]; size?: number; color?: string; strength?: number}> = ({position, size = 2, color = '#ffa64d', strength = 0.55}) => {
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={softDisc()} color={color} opacity={strength} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
};

// Daylight with soft shadows covering `size` metres around `centre`. Build your own lights when the mood calls for it.
export const Sun: React.FC<{centre?: [number, number, number]; size?: number; intensity?: number; color?: string; sky?: string; ground?: string; ambient?: number; from?: [number, number, number]}> = ({centre = [0, 0, 0], size = 18, intensity = 2.4, color = '#fff2dc', sky = '#cfe6ff', ground = '#8a8778', ambient = 1.15, from = [0.6, 1, 0.45]}) => {
  const target = new THREE.Object3D();
  target.position.set(...centre);
  const d = new THREE.Vector3(...from).normalize().multiplyScalar(size * 2.4);
  return (
    <>
      <hemisphereLight args={[sky, ground, ambient]} />
      <primitive object={target} />
      <directionalLight position={[centre[0] + d.x, centre[1] + d.y, centre[2] + d.z]} target={target} intensity={intensity} color={color} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-size} shadow-camera-right={size} shadow-camera-top={size} shadow-camera-bottom={-size} shadow-camera-near={0.5} shadow-camera-far={size * 6} />
    </>
  );
};
