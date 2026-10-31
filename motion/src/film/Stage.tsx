import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {createContext, useContext} from 'react';
import {getInputProps, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {loadActorAssets} from './Actor';
import {type Shot, viewAt, type View} from './camera';
import {Grade} from './Film';
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

const MIN_SHOT = 2;
const MIN_AVERAGE = 3.5;

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
}> = ({shots, children, background = '#9fd0ef', fog, shadows = true, grade = {}}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const view = viewAt(shots, frame / fps, durationInFrames / fps);
  if (getInputProps().filmCheck) checkPacing(shots, durationInFrames / fps);
  const ready = useLoaded(loadActorAssets, 'characters');
  if (!ready) return null;
  return (
    <>
    <ThreeCanvas width={width} height={height} shadows={shadows} gl={{preserveDrawingBuffer: true}} camera={{fov: view.fov, near: 0.05, far: 2000, position: view.pos.toArray()}}>
      <Rig view={view} />
      <color attach="background" args={[background]} />
      {fog && <fog attach="fog" args={fog} />}
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </ThreeCanvas>
    {grade && <Grade {...grade} />}
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
