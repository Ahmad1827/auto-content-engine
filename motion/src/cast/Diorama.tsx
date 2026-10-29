import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import type {Cast, Person, Prop, Setting} from '../types';
import {type Colors, colorsFor, shade} from './palette';
import {type Rig, rig, stagePositions} from './poses';

// Low-poly 3D people in small sets, posed with the same rig as the flat renderer.
// Figures are modelled in body units (1 = the flat renderer's 100) and scaled to ~1.8 world units tall.

const RAD = Math.PI / 180;
const SCALE = 0.45;

type Look = {sky: string; ground: string; fog: [number, number]; sun: string; sunPos: [number, number, number]; ambient: number};

const LOOKS: Record<Setting, Look> = {
  house: {sky: '#a9c8d8', ground: '#4f7a3a', fog: [10, 26], sun: '#fff1d6', sunPos: [4, 7, 6], ambient: 1.0},
  bedroom: {sky: '#2a2230', ground: '#8a6646', fog: [12, 30], sun: '#ffe2b8', sunPos: [-3, 6, 5], ambient: 0.85},
  street: {sky: '#c9b8a6', ground: '#55585e', fog: [9, 26], sun: '#ffe6c4', sunPos: [5, 7, 5], ambient: 0.95},
  desert: {sky: '#f0c88e', ground: '#d6ad74', fog: [10, 30], sun: '#fff0d0', sunPos: [5, 6, 4], ambient: 1.05},
  mosque: {sky: '#e8b78c', ground: '#d6ccb8', fog: [12, 32], sun: '#ffe2b0', sunPos: [-5, 6, 5], ambient: 1.0},
  battlefield: {sky: '#b99a78', ground: '#6b6646', fog: [7, 22], sun: '#ffd9a8', sunPos: [4, 5, 5], ambient: 0.9},
  office: {sky: '#cfd6dc', ground: '#6f7782', fog: [12, 30], sun: '#ffffff', sunPos: [3, 7, 6], ambient: 1.0},
  night: {sky: '#0f1630', ground: '#1f2a26', fog: [8, 26], sun: '#9fb4ff', sunPos: [-4, 6, 4], ambient: 0.55},
  field: {sky: '#9fd0ee', ground: '#5e8f45', fog: [12, 34], sun: '#fff4dc', sunPos: [4, 8, 5], ambient: 1.05},
  classroom: {sky: '#e6dcc8', ground: '#8a6646', fog: [12, 30], sun: '#fff4dc', sunPos: [3, 7, 6], ambient: 1.0},
  empty: {sky: '#1c1712', ground: '#2b2520', fog: [8, 22], sun: '#ffe6c4', sunPos: [2, 7, 5], ambient: 0.8},
};

// Walls only make sense indoors and in front of a house.
const WALL: Partial<Record<Setting, string>> = {bedroom: '#d8c8b0', house: '#bcb6ac', office: '#cfd6dc', classroom: '#e6dcc8'};

const M: React.FC<{color: string; emissive?: string; opacity?: number}> = ({color, emissive, opacity}) => (
  <meshStandardMaterial color={color} flatShading roughness={0.85} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1 : 0}
    transparent={opacity !== undefined} opacity={opacity ?? 1} />
);

const Box: React.FC<{size: [number, number, number]; pos?: [number, number, number]; color: string; rot?: [number, number, number]}> = ({size, pos, color, rot}) => (
  <mesh position={pos} rotation={rot} castShadow receiveShadow>
    <boxGeometry args={size} />
    <M color={color} />
  </mesh>
);

const Ball: React.FC<{r: number; pos?: [number, number, number]; color: string; detail?: number; scale?: [number, number, number]; emissive?: string}> = ({r, pos, color, detail = 1, scale, emissive}) => (
  <mesh position={pos} scale={scale} castShadow receiveShadow>
    <icosahedronGeometry args={[r, detail]} />
    <M color={color} emissive={emissive} />
  </mesh>
);

const Cyl: React.FC<{r: [number, number]; h: number; pos?: [number, number, number]; color: string; seg?: number; rot?: [number, number, number]; emissive?: string}> = ({r, h, pos, color, seg = 8, rot, emissive}) => (
  <mesh position={pos} rotation={rot} castShadow receiveShadow>
    <cylinderGeometry args={[r[0], r[1], h, seg]} />
    <M color={color} emissive={emissive} />
  </mesh>
);

export const DioramaScene: React.FC<{cast: Cast; W: number; H: number; mode: 'stage' | 'panel'; enter: number[]}> = ({cast, W, H, mode, enter}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const time = frame / fps;
  const look = LOOKS[cast.setting] ?? LOOKS.empty;
  const stage = mode === 'stage';
  const dist = stage ? 7.4 : 4.6;
  const dolly = 1 + 0.07 * (1 - Math.min(1, frame / Math.max(1, durationInFrames)));
  const camY = stage ? 1.75 : 1.5;
  const target = new THREE.Vector3(0, stage ? 1.06 : 0.95, 0);
  const orbit = Math.sin(time * 0.35) * 0.35;
  const xs = stagePositions(cast.people).map((x) => x * (stage ? 0.95 : 1.4));

  return (
    <ThreeCanvas width={W} height={H} shadows camera={{fov: 34, position: [orbit, camY, dist * dolly], near: 0.1, far: 80}}>
      <CameraAim target={target} pos={[orbit, camY, dist * dolly]} />
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, look.fog[0], look.fog[1]]} />
      <hemisphereLight args={[look.sky, look.ground, look.ambient]} />
      <directionalLight position={look.sunPos} intensity={2.1} color={look.sun} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0005} />
      {/* Soft fill from the camera side so faces aren't left in the sun's shadow. */}
      <directionalLight position={[0, 2.5, 9]} intensity={0.85} color="#fff4e6" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <M color={look.ground} />
      </mesh>
      <SetPieces setting={cast.setting} time={time} />
      {cast.people.map((p, i) =>
        p.pose === 'sleep' ? <Bed3D key={`bed${i}`} x={xs[i]} /> : p.pose === 'sit' && !(cast.props ?? []).includes('chair') ? <Box key={`seat${i}`} size={[0.6, 0.4, 0.5]} pos={[xs[i], 0.2, -0.12]} color="#7a5a3c" /> : null,
      )}
      <Props3D props={cast.props ?? []} xs={xs} people={cast.people} time={time} />
      {cast.people.map((p, i) => {
        const e = enter[i] ?? 1;
        return (
          <group key={i} position={[xs[i], (1 - e) * -0.4, 0]} scale={SCALE * (0.85 + 0.15 * e)}>
            <Figure3D person={p} colors={colorsFor(p, i)} pose={rig(p.pose, time, i * 0.83, xs[i])} held={heldFor(p, i, cast)} />
          </group>
        );
      })}
    </ThreeCanvas>
  );
};

// ThreeCanvas creates the camera once; this moves and re-aims it on every frame.
const CameraAim: React.FC<{target: THREE.Vector3; pos: [number, number, number]}> = ({target, pos}) => {
  const camera = useThree((state) => state.camera);
  camera.position.set(...pos);
  camera.lookAt(target);
  return null;
};

function heldFor(p: Person, i: number, cast: Cast): 'phone' | 'book' | 'sword' | undefined {
  const props = cast.props ?? [];
  const first = (poses: string[]) => {
    const j = cast.people.findIndex((q) => poses.includes(q.pose));
    return j === -1 ? 0 : j;
  };
  if (props.includes('phone') && first(['phone']) === i) return 'phone';
  if (props.includes('sword') && first(['fight', 'point', 'cheer']) === i) return 'sword';
  if (props.includes('book') && first(['sit', 'stand', 'think', 'pray']) === i) return 'book';
  return undefined;
}

// ---------- Figure ----------

const Figure3D: React.FC<{person: Person; colors: Colors; pose: Rig; held?: 'phone' | 'book' | 'sword'}> = ({person, colors: c, pose, held}) => {
  const outfit = person.outfit ?? 'casual';
  const longSleeve = outfit !== 'casual' && outfit !== 'dress';
  const sleeve = outfit === 'armor' ? shade(c.metal, -0.3) : c.top;
  const torsoColor = outfit === 'armor' ? c.metal : c.top;
  const drop = pose.mode === 'sit' ? 0.62 : pose.mode === 'kneel' ? 0.6 : 0;
  const lift = pose.bob * 4;
  const long = outfit === 'robe';

  const arm = (side: 1 | -1, [upper, lower]: [number, number], fwd: number, hand?: 'phone' | 'book' | 'sword') => {
    const forward = fwd > 0 || lower > 90;
    return (
      <group position={[side * 0.56, 2.74, 0]} rotation={[-fwd * RAD, 0, side * upper * RAD]}>
        <mesh position={[0, -0.32, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.13, 0.66, 7]} />
          <M color={sleeve} />
        </mesh>
        <group position={[0, -0.64, 0]} rotation={[-(forward ? lower * 0.85 : lower * 0.15) * RAD, 0, -side * (forward ? lower * 0.3 : lower * 0.85) * RAD]}>
          <mesh position={[0, -0.29, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.12, 0.58, 7]} />
            <M color={longSleeve ? sleeve : c.skin} />
          </mesh>
          <Ball r={0.15} pos={[0, -0.64, 0]} color={c.skin} />
          {hand === 'phone' && <Box size={[0.2, 0.36, 0.06]} pos={[0, -0.62, 0.14]} color="#202329" />}
          {hand === 'book' && <Box size={[0.46, 0.06, 0.34]} pos={[0, -0.7, 0.16]} color="#8a3b2e" />}
          {hand === 'sword' && (
            <group position={[0, -0.66, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <Box size={[0.08, 1.4, 0.03]} pos={[0, -0.75, 0]} color="#cfd4dc" />
              <Box size={[0.4, 0.08, 0.08]} pos={[0, -0.04, 0]} color="#7a5a2a" />
            </group>
          )}
        </group>
        {outfit === 'armor' && <Ball r={0.22} pos={[0, -0.02, 0]} color={c.metal} />}
      </group>
    );
  };

  const leg = (side: 1 | -1, [upper, lower]: [number, number], step: number) => {
    const hip = pose.mode === 'sit' ? -90 : -step;
    const knee = pose.mode === 'sit' ? 90 : pose.mode === 'kneel' ? 90 : lower;
    return (
      <group position={[side * 0.21, 1.56 - drop, 0]} rotation={[hip * RAD, 0, side * upper * RAD]}>
        <mesh position={[0, -0.4, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.17, 0.82, 7]} />
          <M color={c.bottom} />
        </mesh>
        <group position={[0, -0.8, 0]} rotation={[knee * RAD, 0, 0]}>
          <mesh position={[0, -0.38, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.15, 0.76, 7]} />
            <M color={c.bottom} />
          </mesh>
          <Box size={[0.3, 0.18, 0.46]} pos={[0, -0.8, 0.08]} color={c.shoe} />
        </group>
      </group>
    );
  };

  const body = (
    <group>
      {!long && leg(1, pose.legA, pose.stepA)}
      {!long && leg(-1, pose.legB, pose.stepB)}
      <group position={[0, -drop + lift, 0]} rotation={[0, 0, pose.tilt * RAD * 0.5]}>
        {long && (
          <>
            <Cyl r={[0.46, 0.78]} h={pose.mode === 'stand' ? 1.5 : 0.9} pos={[0, pose.mode === 'stand' ? 0.86 : 1.1, 0]} color={c.top} seg={9} />
            <Box size={[0.3, 0.16, 0.44]} pos={[-0.22, 0.08 + drop, 0.12]} color={c.shoe} />
            <Box size={[0.3, 0.16, 0.44]} pos={[0.22, 0.08 + drop, 0.12]} color={c.shoe} />
          </>
        )}
        {outfit === 'dress' && <Cyl r={[0.44, 0.74]} h={0.86} pos={[0, 1.2, 0]} color={c.top} seg={9} />}
        <mesh position={[0, 2.2, 0]} scale={[1, 1, 0.62]} castShadow>
          <cylinderGeometry args={[0.56, 0.46, 1.3, 8]} />
          <M color={torsoColor} />
        </mesh>
        {outfit === 'suit' && (
          <>
            <Box size={[0.24, 0.6, 0.05]} pos={[0, 2.5, 0.34]} color="#f1ede4" rot={[0.12, 0, 0]} />
            <Box size={[0.09, 0.5, 0.05]} pos={[0, 2.46, 0.37]} color="#a83a32" rot={[0.12, 0, 0]} />
          </>
        )}
        {(outfit === 'robe' || outfit === 'uniform') && <Box size={[0.98, 0.12, 0.66]} pos={[0, 1.64, 0]} color={outfit === 'robe' ? shade(c.top, -0.3) : '#3a2e22'} />}
        {outfit === 'uniform' && [2.5, 2.25, 2.0].map((y) => <Ball key={y} r={0.04} pos={[0, y, 0.33]} color={c.gold} detail={0} />)}
        <Cyl r={[0.13, 0.15]} h={0.22} pos={[0, 2.92, 0]} color={shade(c.skin, -0.1)} />
        <group position={[0, 3.46, 0]} rotation={[pose.head < -10 ? 0.35 : 0, 0, pose.head * RAD * 0.5]}>
          <Head3D person={person} c={c} asleep={pose.mode === 'lie'} />
        </group>
        {/* Same sides as the flat rig: `a` is the screen-right arm, `b` the screen-left. */}
        {arm(1, pose.a, pose.fwdA, held === 'book' ? 'book' : undefined)}
        {arm(-1, pose.b, pose.fwdB, held && held !== 'book' ? held : undefined)}
      </group>
    </group>
  );

  // Lying on the bed: head to the left, tipped toward the camera so the face shows.
  if (pose.mode === 'lie') {
    return (
      <group position={[0.95 / SCALE, 0.98 / SCALE, BED_Z / SCALE]} rotation={[-(Math.PI / 2 - 0.55), 0, 0]}>
        <group rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>{body}</group>
      </group>
    );
  }
  return body;
};

const Head3D: React.FC<{person: Person; c: Colors; asleep: boolean}> = ({person, c, asleep}) => {
  const hair = person.hair ?? 'short';
  const mood = person.mood ?? 'happy';
  const cloth = c.hair === '#e8e4dc' ? '#d8d2c6' : '#3d4a6b';
  const dark = '#2a1c14';
  return (
    <group>
      <mesh scale={[0.95, 1.04, 0.92]} castShadow>
        <sphereGeometry args={[0.5, 12, 10]} />
        <M color={c.skin} />
      </mesh>
      <Ball r={0.06} pos={[0, -0.02, 0.48]} color={shade(c.skin, -0.08)} detail={0} />
      {asleep ? (
        <>
          <Box size={[0.12, 0.025, 0.02]} pos={[-0.16, 0.06, 0.45]} color={dark} />
          <Box size={[0.12, 0.025, 0.02]} pos={[0.16, 0.06, 0.45]} color={dark} />
        </>
      ) : (
        <>
          <Ball r={mood === 'surprised' ? 0.065 : 0.05} pos={[-0.16, 0.06, 0.44]} color={dark} detail={1} scale={[1, 1.25, 0.6]} />
          <Ball r={mood === 'surprised' ? 0.065 : 0.05} pos={[0.16, 0.06, 0.44]} color={dark} detail={1} scale={[1, 1.25, 0.6]} />
        </>
      )}
      {(mood === 'angry' || mood === 'sad') && (
        <>
          <Box size={[0.16, 0.03, 0.03]} pos={[-0.16, 0.2, 0.44]} rot={[0, 0, mood === 'angry' ? -0.4 : 0.4]} color={dark} />
          <Box size={[0.16, 0.03, 0.03]} pos={[0.16, 0.2, 0.44]} rot={[0, 0, mood === 'angry' ? 0.4 : -0.4]} color={dark} />
        </>
      )}
      {mood === 'happy' && !asleep ? (
        <mesh position={[0, -0.16, 0.43]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.1, 0.022, 5, 10, Math.PI]} />
          <M color={dark} />
        </mesh>
      ) : mood === 'surprised' && !asleep ? (
        <Ball r={0.06} pos={[0, -0.2, 0.43]} color={dark} detail={1} scale={[1, 1.3, 0.5]} />
      ) : (mood === 'sad' || mood === 'angry') && !asleep ? (
        <mesh position={[0, -0.24, 0.43]}>
          <torusGeometry args={[0.09, 0.02, 5, 10, Math.PI]} />
          <M color={dark} />
        </mesh>
      ) : (
        <Box size={[0.16, 0.03, 0.02]} pos={[0, -0.2, 0.45]} color={dark} />
      )}
      {person.beard && (
        <mesh position={[0, -0.12, 0.06]} scale={[0.98, 0.9, 0.95]}>
          <sphereGeometry args={[0.5, 10, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.4]} />
          <M color={c.hair} />
        </mesh>
      )}
      {(hair === 'short' || hair === 'long' || hair === 'bun' || hair === 'crown') && (
        <mesh position={[0, 0.06, -0.04]} rotation={[-0.45, 0, 0]} scale={[1.02, 1.04, 1.02]}>
          <sphereGeometry args={[0.52, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <M color={c.hair} />
        </mesh>
      )}
      {hair === 'long' && <Box size={[0.92, 0.9, 0.36]} pos={[0, -0.3, -0.26]} color={c.hair} />}
      {hair === 'bun' && <Ball r={0.2} pos={[0, 0.48, -0.22]} color={c.hair} />}
      {hair === 'curly' && [[-0.3, 0.3], [0, 0.42], [0.3, 0.3], [-0.18, 0.4], [0.18, 0.4], [-0.38, 0.05], [0.38, 0.05]].map(([x, y], i) => <Ball key={i} r={0.2} pos={[x, y, -0.1]} color={c.hair} />)}
      {hair === 'bald' && <Ball r={0.16} pos={[0, -0.02, -0.4]} color={c.hair} scale={[2.4, 0.8, 0.6]} />}
      {hair === 'hijab' && (
        <>
          <mesh position={[0, 0.02, -0.08]} scale={[1.12, 1.16, 1.05]}>
            <sphereGeometry args={[0.52, 12, 10, Math.PI * 0.68, Math.PI * 1.64]} />
            <M color={cloth} />
          </mesh>
          <Cyl r={[0.42, 0.62]} h={0.55} pos={[0, -0.6, -0.05]} color={cloth} seg={9} />
        </>
      )}
      {hair === 'turban' && (
        <>
          <Ball r={0.55} pos={[0, 0.26, -0.04]} color="#efe8da" scale={[1, 0.72, 1]} detail={1} />
          <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.47, 0.09, 6, 12]} />
            <M color="#e2d8c4" />
          </mesh>
        </>
      )}
      {hair === 'cap' && (
        <>
          <mesh position={[0, 0.08, 0]} rotation={[-0.2, 0, 0]}>
            <sphereGeometry args={[0.53, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <M color={c.top} />
          </mesh>
          <Box size={[0.6, 0.04, 0.36]} pos={[0, 0.24, 0.5]} color={c.top} rot={[0.15, 0, 0]} />
        </>
      )}
      {hair === 'helmet' && (
        <>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.57, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
            <M color={c.metal} />
          </mesh>
          <Box size={[0.07, 0.36, 0.06]} pos={[0, 0.06, 0.55]} color={c.metal} />
        </>
      )}
      {hair === 'crown' && (
        <group position={[0, 0.5, -0.02]}>
          <Cyl r={[0.34, 0.32]} h={0.2} color={c.gold} seg={8} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh key={i} position={[Math.sin((i / 8) * Math.PI * 2) * 0.32, 0.18, Math.cos((i / 8) * Math.PI * 2) * 0.32]}>
              <coneGeometry args={[0.06, 0.18, 4]} />
              <M color={c.gold} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

// ---------- Sets ----------

const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const Bush: React.FC<{pos: [number, number, number]; r: number; color: string}> = ({pos, r, color}) => <Ball r={r} pos={pos} color={color} detail={1} scale={[1.15, 0.9, 1]} />;

const Tree3D: React.FC<{pos: [number, number, number]; s?: number}> = ({pos, s = 1}) => (
  <group position={pos} scale={s}>
    <Cyl r={[0.12, 0.16]} h={1.4} pos={[0, 0.7, 0]} color="#6b4a2e" seg={6} />
    <Ball r={0.8} pos={[0, 1.9, 0]} color="#3f6e34" />
    <Ball r={0.55} pos={[0.5, 1.5, 0.1]} color="#467a3a" />
    <Ball r={0.5} pos={[-0.5, 1.6, 0]} color="#3a6630" />
  </group>
);

const Palm3D: React.FC<{pos: [number, number, number]}> = ({pos}) => (
  <group position={pos}>
    {[0, 1, 2, 3, 4].map((i) => <Cyl key={i} r={[0.11 - i * 0.01, 0.13 - i * 0.01]} h={0.55} pos={[i * 0.06, 0.28 + i * 0.52, 0]} color="#8a6a44" seg={6} rot={[0, 0, -0.08]} />)}
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <mesh key={i} position={[0.3, 2.7, 0]} rotation={[0, (i / 6) * Math.PI * 2, 1.0]}>
        <coneGeometry args={[0.2, 1.6, 4]} />
        <M color="#4f7a36" />
      </mesh>
    ))}
  </group>
);

const Window3D: React.FC<{pos: [number, number, number]; w: number; h: number; glass: string}> = ({pos, w, h, glass}) => (
  <group position={pos}>
    <Box size={[w + 0.2, h + 0.2, 0.08]} color="#f2efe8" />
    <Box size={[w, h, 0.1]} pos={[0, 0, 0.01]} color={glass} />
    <Box size={[0.06, h, 0.14]} color="#f2efe8" />
    <Box size={[w, 0.06, 0.14]} color="#f2efe8" />
  </group>
);

const SetPieces: React.FC<{setting: Setting; time: number}> = ({setting, time}) => {
  const wall = WALL[setting];
  const stars = useMemo(() => Array.from({length: 60}, (_, i) => [(rand(i) - 0.5) * 30, 3 + rand(i + 7) * 10, -14 - rand(i + 3) * 4] as [number, number, number]), []);
  switch (setting) {
    case 'house':
      return (
        <group>
          <Box size={[16, 6, 0.3]} pos={[0, 3, -2.2]} color={wall!} />
          {Array.from({length: 12}, (_, i) => <Box key={i} size={[16, 0.04, 0.05]} pos={[0, 0.3 + i * 0.45, -2.03]} color={shade(wall!, -0.12)} />)}
          <Window3D pos={[0, 2.6, -2.0]} w={1.7} h={1.5} glass="#7fa7c4" />
          {[-2.2, -1.2, 0.1, 1.3, 2.4].map((x, i) => <Bush key={i} pos={[x, 0.45, -1.5 + rand(i) * 0.2]} r={0.55 + rand(i + 4) * 0.2} color={i === 0 ? '#9a3e52' : '#2f5a2c'} />)}
        </group>
      );
    case 'bedroom':
      return (
        <group>
          <Box size={[16, 6, 0.3]} pos={[0, 3, -2.2]} color={wall!} />
          <Box size={[16, 0.2, 0.08]} pos={[0, 0.1, -2.02]} color="#f2efe8" />
          <Window3D pos={[-1.1, 2.5, -2.0]} w={1.0} h={1.2} glass="#24345e" />
          <Ball r={0.12} pos={[-0.9, 2.75, -1.92]} color="#fff3c4" emissive="#ffe9a8" />
          <Box size={[0.9, 0.6, 0.04]} pos={[1.2, 2.6, -2.03]} color="#c98a4a" />
          <mesh position={[0, 0.01, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.6, 10]} />
            <M color="#9c5546" />
          </mesh>
        </group>
      );
    case 'street':
      return (
        <group>
          <Box size={[20, 0.12, 1.6]} pos={[0, 0.06, -1.8]} color="#8b8a86" />
          {Array.from({length: 9}, (_, i) => {
            const h = 2.5 + rand(i) * 4;
            return <Box key={i} size={[1.8, h, 1.6]} pos={[-8 + i * 2, h / 2, -4 - rand(i + 5)]} color={['#b5826a', '#c9b48e', '#8e9aa6', '#a6705c', '#d0c4ac'][i % 5]} />;
          })}
          {[-1.8, 1.8].map((x) => (
            <group key={x} position={[x, 0, -1.4]}>
              <Cyl r={[0.04, 0.05]} h={2.6} pos={[0, 1.3, 0]} color="#2f3238" />
              <Ball r={0.13} pos={[0, 2.65, 0]} color="#fff0c4" emissive="#ffd98a" />
            </group>
          ))}
          {Array.from({length: 6}, (_, i) => <Box key={i} size={[0.6, 0.01, 0.08]} pos={[-5 + i * 2, 0.005, 1.5]} color="#e8e2d0" />)}
        </group>
      );
    case 'desert':
      return (
        <group>
          {[[-6, -9, 4], [3, -11, 5], [9, -8, 3.5], [-2, -14, 6]].map(([x, z, r], i) => <Ball key={i} r={r} pos={[x, -r * 0.62, z]} color={i % 2 ? '#cfa36a' : '#dcb47c'} scale={[1.6, 1, 1]} />)}
          <Ball r={1.1} pos={[3.5, 6.2, -20]} color="#fff2c8" emissive="#ffd88a" detail={2} />
          <Palm3D pos={[-3.4, 0, -4.5]} />
          {[[1.8, -1.6], [2.4, -2.4]].map(([x, z], i) => <Ball key={i} r={0.2} pos={[x, 0.1, z]} color="#a88a5e" detail={0} />)}
        </group>
      );
    case 'mosque':
      return (
        <group position={[0, 0, -7]}>
          <Box size={[5, 2.6, 2.4]} pos={[0, 1.3, 0]} color="#efe6d4" />
          <mesh position={[0, 2.6, 0]}>
            <sphereGeometry args={[1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <M color="#4f8a7a" />
          </mesh>
          <Cyl r={[0.03, 0.03]} h={0.6} pos={[0, 4.3, 0]} color="#d9b45a" />
          {[-3.1, 3.1].map((x) => (
            <group key={x}>
              <Cyl r={[0.26, 0.3]} h={5.4} pos={[x, 2.7, 0]} color="#efe6d4" seg={8} />
              <Cyl r={[0.36, 0.36]} h={0.18} pos={[x, 4.4, 0]} color="#d8ccb4" seg={8} />
              <mesh position={[x, 5.8, 0]}>
                <coneGeometry args={[0.3, 0.9, 8]} />
                <M color="#4f8a7a" />
              </mesh>
            </group>
          ))}
          {[-1.4, 0, 1.4].map((x) => <Box key={x} size={[0.8, 1.4, 0.1]} pos={[x, 0.7, 1.21]} color="#6b4f3a" />)}
          <mesh position={[0, 0.01, 7.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[3.4, 2.2]} />
            <M color="#8c2f2f" />
          </mesh>
        </group>
      );
    case 'battlefield':
      return (
        <group>
          {[[-3, -5], [2.5, -6], [5, -4.5], [-5.5, -7]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.8, 0]} castShadow>
                <coneGeometry args={[1.1, 1.6, 4]} />
                <M color={i % 2 ? '#c9b48a' : '#b39c74'} />
              </mesh>
              <Cyl r={[0.03, 0.03]} h={2.6} pos={[0, 1.3, 0]} color="#4a3a2a" />
              <Box size={[0.7, 0.42, 0.02]} pos={[0.36 + Math.sin(time * 4 + i) * 0.03, 2.35, 0]} color={i % 2 ? '#a8322a' : '#2f4f8a'} rot={[0, Math.sin(time * 3 + i) * 0.3, 0]} />
            </group>
          ))}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-4 + i * 0.5, 1.5 + ((time * 0.4 + i * 0.9) % 3), -12]}>
              <icosahedronGeometry args={[0.5 + i * 0.2, 1]} />
              <M color="#9a9488" opacity={0.55} />
            </mesh>
          ))}
          {[[-2, -1.4], [2.2, -1.1]].map(([x, z], i) => <Ball key={i} r={0.35} pos={[x, 0.15, z]} color="#5e5a48" detail={0} />)}
        </group>
      );
    case 'office':
      return (
        <group>
          <Box size={[16, 6, 0.3]} pos={[0, 3, -2.2]} color={wall!} />
          <Window3D pos={[-1.3, 2.5, -2.0]} w={1.2} h={1.3} glass="#a9c8de" />
          <group position={[1.4, 0, -1.4]}>
            <Box size={[1.6, 0.08, 0.8]} pos={[0, 0.9, 0]} color="#8a6a4a" />
            {[-0.7, 0.7].map((x) => <Box key={x} size={[0.08, 0.9, 0.7]} pos={[x, 0.45, 0]} color="#6f5238" />)}
            <Box size={[0.7, 0.45, 0.05]} pos={[0, 1.28, -0.1]} color="#1e2228" />
            <Box size={[0.64, 0.38, 0.02]} pos={[0, 1.28, -0.07]} color="#5d8fc4" />
          </group>
        </group>
      );
    case 'classroom':
      return (
        <group>
          <Box size={[16, 6, 0.3]} pos={[0, 3, -2.2]} color={wall!} />
          <Box size={[3.2, 1.4, 0.08]} pos={[0, 2.5, -2.0]} color="#2f4a3a" />
          <Box size={[3.4, 0.08, 0.2]} pos={[0, 1.76, -1.95]} color="#8a6a4a" />
        </group>
      );
    case 'night':
      return (
        <group>
          {stars.map((p, i) => <Ball key={i} r={0.05 + rand(i) * 0.05} pos={p} color="#ffffff" emissive="#ffffff" detail={0} />)}
          <Ball r={0.9} pos={[-3, 7, -18]} color="#fff6d8" emissive="#fff0c4" detail={2} />
          {[[-6, -10, 4], [4, -12, 5]].map(([x, z, r], i) => <Ball key={i} r={r} pos={[x, -r * 0.6, z]} color="#18221e" scale={[1.8, 1, 1]} />)}
        </group>
      );
    case 'field':
      return (
        <group>
          <Tree3D pos={[-2.6, 0, -2.5]} />
          <Tree3D pos={[3.2, 0, -4]} s={1.2} />
          {[0, 1].map((i) => (
            <group key={i} position={[((time * 0.2 + i * 6) % 14) - 7, 6 + i, -14]}>
              {[[-0.8, 0, 0.9], [0, 0.3, 1.2], [0.9, 0, 0.8]].map(([x, y, r], j) => <Ball key={j} r={r} pos={[x, y, 0]} color="#ffffff" />)}
            </group>
          ))}
          {Array.from({length: 14}, (_, i) => <Ball key={i} r={0.1} pos={[(rand(i) - 0.5) * 7, 0.05, -0.5 - rand(i + 2) * 3]} color={['#e8d24a', '#e86a6a', '#ffffff'][i % 3]} detail={0} />)}
        </group>
      );
    default:
      return (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.2, 24]} />
          <M color="#4a3f34" />
        </mesh>
      );
  }
};

const BED_Z = -0.75;

const Bed3D: React.FC<{x: number}> = ({x}) => (
  <group position={[x, 0, BED_Z]}>
    <Box size={[2.3, 0.45, 1.1]} pos={[0, 0.3, 0]} color="#6b4a32" />
    <Box size={[2.2, 0.2, 1.05]} pos={[0, 0.62, 0]} color="#efe9df" />
    <Box size={[1.5, 0.12, 1.08]} pos={[0.32, 0.76, 0.01]} color="#c0623f" />
    <Box size={[0.5, 0.16, 0.6]} pos={[-0.8, 0.8, 0]} color="#ffffff" />
    <Box size={[0.12, 1.1, 1.1]} pos={[-1.15, 0.6, 0]} color="#5a3c28" />
  </group>
);

const Props3D: React.FC<{props: Prop[]; xs: number[]; people: Person[]; time: number}> = ({props, xs, people, time}) => {
  const slots = [-1.5, 1.5, -2.2, 2.2].filter((x) => xs.every((px) => Math.abs(px - x) > 0.6));
  let k = 0;
  const next = () => slots[k++ % Math.max(1, slots.length)] ?? 1.8;
  const sleepers = people.some((p) => p.pose === 'sleep');
  const flick = Math.sin(time * 17) * 0.1 + Math.sin(time * 6) * 0.08;
  return (
    <group>
      {people.map((p, i) => (props.includes('mat') && (p.pose === 'pray' || p.pose === 'kneel') ? <Box key={`m${i}`} size={[0.7, 0.02, 1.2]} pos={[xs[i], 0.01, 0.1]} color="#2f6b5a" /> : null))}
      {props.map((prop, i) => {
        if (['phone', 'book', 'sword', 'mat'].includes(prop) || (prop === 'bed' && sleepers)) return null;
        const x = next();
        switch (prop) {
          case 'bed': return <Bed3D key={i} x={x} />;
          case 'table': return <group key={i} position={[x, 0, -0.6]}><Box size={[1, 0.07, 0.6]} pos={[0, 0.75, 0]} color="#8a6a4a" />{[-0.42, 0.42].map((dx) => <Box key={dx} size={[0.07, 0.75, 0.5]} pos={[dx, 0.37, 0]} color="#6f5238" />)}</group>;
          case 'chair': return <group key={i} position={[x, 0, -0.4]}><Box size={[0.5, 0.06, 0.5]} pos={[0, 0.45, 0]} color="#7a5a3c" /><Box size={[0.5, 0.6, 0.06]} pos={[0, 0.75, -0.22]} color="#7a5a3c" /></group>;
          case 'lamp': return <group key={i} position={[x, 0, -0.8]}><Cyl r={[0.03, 0.03]} h={1.5} pos={[0, 0.75, 0]} color="#2f3238" /><Cyl r={[0.16, 0.26]} h={0.3} pos={[0, 1.55, 0]} color="#f0c87a" emissive="#c08a3a" /><pointLight position={[0, 1.3, 0.2]} intensity={2} distance={3} color="#ffc878" /></group>;
          case 'tree': return <Tree3D key={i} pos={[x, 0, -1.2]} s={0.8} />;
          case 'door': return <group key={i} position={[x, 0, -2.0]}><Box size={[0.9, 2, 0.08]} pos={[0, 1, 0]} color="#7a4f33" /><Ball r={0.05} pos={[0.3, 1, 0.06]} color="#e0b44a" detail={0} /></group>;
          case 'window': return <Window3D key={i} pos={[x, 2.4, -2.0]} w={0.9} h={1.1} glass="#7fa7c4" />;
          case 'moon': return <Ball key={i} r={0.6} pos={[x * 2, 6, -16]} color="#fff6d8" emissive="#fff0c4" detail={2} />;
          case 'sun': return <Ball key={i} r={0.9} pos={[x * 2, 6, -18]} color="#fff2c8" emissive="#ffd88a" detail={2} />;
          case 'clock': return <group key={i} position={[x, 2.8, -2.0]}><Cyl r={[0.3, 0.3]} h={0.06} rot={[Math.PI / 2, 0, 0]} color="#f2efe8" seg={16} /><Box size={[0.03, 0.22, 0.02]} pos={[0, 0.1, 0.05]} color="#222" /></group>;
          case 'fire':
            return (
              <group key={i} position={[x, 0, 0.4]}>
                {[0, 1, 2].map((j) => <Box key={j} size={[0.9, 0.1, 0.1]} pos={[0, 0.06, 0]} rot={[0, (j * Math.PI) / 3, 0]} color="#5a3c28" />)}
                <mesh position={[0, 0.4 + flick, 0]} scale={[1, 1 + flick * 2, 1]}><coneGeometry args={[0.28, 0.8, 6]} /><M color="#ff8a3a" emissive="#ff6a1a" /></mesh>
                <mesh position={[0, 0.3, 0]}><coneGeometry args={[0.15, 0.45, 6]} /><M color="#ffd27a" emissive="#ffc04a" /></mesh>
                <pointLight position={[0, 0.7, 0]} intensity={3 + flick * 6} distance={5} color="#ff9a4a" />
              </group>
            );
          case 'tent': return <mesh key={i} position={[x, 0.8, -1.8]} castShadow><coneGeometry args={[1, 1.6, 4]} /><M color="#c9b48a" /></mesh>;
          case 'car': return <group key={i} position={[x, 0, -1.4]}><Box size={[2, 0.55, 0.9]} pos={[0, 0.5, 0]} color="#b8433a" /><Box size={[1.1, 0.45, 0.85]} pos={[-0.1, 0.98, 0]} color="#a83a32" />{[-0.65, 0.65].map((dx) => <Cyl key={dx} r={[0.22, 0.22]} h={0.95} pos={[dx, 0.22, 0]} rot={[Math.PI / 2, 0, 0]} color="#1e1e22" seg={10} />)}</group>;
          default: return null;
        }
      })}
    </group>
  );
};
