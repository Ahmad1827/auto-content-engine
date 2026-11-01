# Film toolkit

Your film lives in this folder. `Film.tsx` is yours: build the whole film there and split it into more `.tsx` files as you like.
`film.json` holds the narration with exact timings. `index.ts` and `tsconfig.json` are wiring; leave them.
You import from `../../src/film`. Read the source in `../../src/film/` if you need more detail.

Everything is React (Remotion) and Three.js (react-three-fiber JSX). Frames render out of order in separate tabs, so the picture must be a pure function of time:
never use `Math.random()`, `Date.now()`, `useFrame`, or state that accumulates. Use `random('seed')` from `remotion` for variety. Frame is 1080x1920, 30 fps. 1 unit = 1 metre.

## Skeleton

```tsx
import {Actor, cam, Captions, ease, Stage, Sun, Transitions, useFilm, useTime, useWordAt} from '../../src/film';

export const Film: React.FC = () => {
  const {beats} = useFilm();      // beats[i].start, .duration, .narration in seconds
  const wordAt = useWordAt();     // wordAt('skeleton') = when that word is said. Cut on these.
  return (
    <>
      <Transitions marks={[{at: beats[3].start, kind: 'whip'}]}>
        <Stage shots={[
          {at: 0, shot: cam.move([0, 1.2, 6], [0, 1.4, 3.5], [0, 1, 0])},
          {at: beats[1].start, shot: cam.fixed([1, 0.2, 2], [0, 0.7, 0], 28), handheld: 1},
        ]}>
          <Sun />
          <World />
          <Actor look={{shirt: '#5b8fd0'}} act={[{at: 0, clip: 'Walk_Loop'}, {at: 4, clip: 'Idle_Loop'}]} path={[{at: 0, pos: [0, 0, -3]}, {at: 4, pos: [0, 0, 1]}]} />
        </Stage>
      </Transitions>
      <Captions />
    </>
  );
};
```

Draw your own DOM on top of the Stage for clocks, gauges, labels and titles. Audio is added for you. You must include `<Captions />` yourself when `film.json` has `captions: true`, and may pass `top` to keep it off a face.

## Stage and cameras

`<Stage shots background fog={[color, near, far]} shadows grade={{warmth, vignette}}>`: one Stage, one world, cut by listing cameras. Keep the world consistent across shots so a viewer learns the place. Every Stage already has a soft warm finish with darker corners: warmth 0 to 0.25, vignette 0 to 0.6, `grade={false}` for none.
Other Stage props: `notes` (labels pinned to the world, below), `bumps` (times the camera feels a heavy landing: `[t, strength]`), `drift` (a locked-off camera breathes very slightly, 0 turns it off), `pixels` and `colors` (below).
A shot is `{at, shot, ease?, handheld?}`. `check` fails if a shot lasts under 1.2 seconds or if shots average under 2.8 seconds. `handheld` is shake strength (0.5 subtle, 1 tense, 2 panic). `ease` is one of `ease.linear/inOut/out/in/crash` and shapes the move.

- `cam.fixed(pos, look, fov=40)`: locked off.
- `cam.move(from, to, lookFrom, lookTo=lookFrom, fov=40, fovTo=fov)`: push-ins, pull-backs, tracks, pans, tilts, dolly zooms.
- `cam.orbit(centre, radius, height, deg0, deg1, fov=40)`: circles a point; 0° is the +Z side.
- `cam.follow(t => pos, offset, aim=[0,1.2,0], fov=45)`: rides along. Use `markAt(path, t).pos` for an actor's place.
- `cam.pov(t => eye, t => look, bob=0, fov=62)`: first person; bob 1 for walking, 2 for running.
- `cam.top(centre, h0, h1=h0, fov=40)`: straight down.
- Or write your own: `(p, t) => ({pos, look, fov, roll})`, p is 0..1 over the shot, t is film seconds. Long lenses (fov 20-30) for close-ups, wide (55-75) for scale and panic.

`toScreen(view, point)` turns a world point into frame pixels, and `viewAt(shots, t, end)` gives the view at any time, so DOM labels can stick to things.
`<AtCamera offset={[x,y,z]}>` hangs children in front of the lens; `<PovHand side grip point skin sleeve />` is a first-person forearm reaching along -Z. Animate them with offset and rotation.

`<Transitions marks={[{at, kind: 'flash'|'black'|'whip', length?}]}>` wraps the Stage. Most cuts need nothing.

`Stage notes={[...]}` pins labels to the world, and they stay on it as the camera moves. `{at, until, to: [x,y,z], text}` is a callout on a point; add `from: [x,y,z]` for a measured span between two points. `lift` moves the label, `color` and `size` restyle it.

## Things that arrive on the words

Most of what makes these films satisfying is watching a thing come together. Give every part the moment it lands:

```tsx
const wordsIn = useWordsIn();                                   // start of every spoken word between two times
const lands = wordsIn(beats[1].start, beats[2].start);          // one part per word. Or spread(12, 4, 9) for evenly spaced
{lands.map((at, i) => (
  <Arrive key={i} at={at} seed={i} p={[0, 0.2 + i * 0.3, 0]}>   {/* `at` is when it LANDS, so it hits exactly on the word */}
    <Log len={4} seed={i} />
  </Arrive>
))}
```

- `<Arrive at p rot from take arc spin dust dustColor seed leave={{at, to, take?, spin?}}>`: not there before it starts, then swings in from `from` (by default above and in front of it, past the lens) for `take` seconds, lands with a small settle and a puff of dust. `dust={false}` for clean things or anything in the air. `leave` sends it away again: a beam pulled out, a wave carrying a thing off. What has arrived stays, so the world keeps growing.
- `<Grow at take p rot axis>`: rises or spreads into place along `x`, `y`, `z` or `all`, with a little overshoot, from the group's origin: pillars, plaster, water filling, plants.
- `<Puff p at size color count life rise>`: dust, smoke or sparks at a moment. `bumps` on the Stage for the biggest landings.
- `<Rain centre size height count wind>` and `<Snow centre size height count flake rise color>`. Snow also makes ash, embers, spores, or rising bubbles with `rise`. Weather can start on a word and change what the place means.

Use them for anything: bricks, planets, organs, cars, armies, words, furniture.

## Real materials

Use these for how things work and true stories. They mix with the rest of the kit, and people stay plain whichever you choose.

- `<Surface kind repeat tint rough bump opacity offset side attach />` as a mesh's material: `bark wood endgrain planks shingles soil forestFloor grass sand snow rock stone ashlar brick plaster concrete metal rust water`. `repeat` is tiles across the mesh's UVs: keep it near metres / 1.5 so the pattern is the right size. `tint` colours it, and is how you tell neighbouring parts apart. `offset` slides it, for flow.
- `<Slabbed p s kind rot tint scale />`: a box with a real surface: blocks, beams, walls. Leave a hair's gap between parts and vary the `tint` so they read as separate pieces.
- `<Log p rot len r r2 axis kind ends seed />`: a round length with different cut ends: logs, pipes, pillars, barrels. Lies along x; set `kind="metal" ends="metal"` for a pipe.
- `<Sheet p s kind rot tint opacity />`: a thin panel. `<WaterSurface p s rot opacity flow scale />`: moving water.
- `<Slab w d depth top side at />`: a block of ground cut out of the world with its earth showing, top at y = 0. It frames a story like a model on a table; aim the camera to catch its edge. `<Scatter kind="tufts|stones|leaves" area count seed avoid={[x0, z0, x1, z1]} />` ties things to the ground.
- `<Scenery kind="forest|hills|mountains|desert|city|sea|night" />`: a painted world all the way round, instead of a plain sky.

## Cutaways

To show what's hidden (caves, mines, pipes, bodies, ships, burrows), slice the world open. Solid material fills the frame and a passage is cut through it:

```tsx
const P = [{x: -10, y: 4, w: 1.4}, {x: -3, y: 1, w: 1.4}, {x: 2, y: 1, w: 5}, {x: 8, y: 0, w: 1.4}]; // the middle of the passage, and its width at each point. A wide point is a chamber
const c = along(P, s);                         // s runs 0..1: c.pos is the place, c.angle the heading in degrees, c.width. along(P, s, 0.5) is halfway to a wall
<Cutaway points={P} solid="rock" edge="#6f9f3a" water={level} />   // `water`: floods all below that height. Animate it. `back`, `backTint`, `thick`, `waterOpacity`
```

Stand things at z = 0 and look from +Z: follow them with a custom shot that reads `along`, for one long unbroken move. To swim, put an Actor with `cues={[{at: 0, pose: 'swim'}]}`, `pose={flutterKick()}` and `face: 90` in a group at `c.pos`, rotated about z by `c.angle` in radians.

## Lighting

Start every 3D scene with `<Lights look size centre power />`, one line that gives a soft sky, a main light with soft shadows, a fill and a light from behind that lifts people off the background. Looks: `cosy` (a room at night, add a `Lamp`), `room` (bright daytime room), `day`, `golden` (low warm sun), `overcast`, `night`, `cold` (offices, hospitals, bad news). `size` is the metres the shadows must cover around `centre`: keep it close to the action. `<Lamp>`, `<StreetLamp on>`, windows and screens add light from inside the scene, and `<Glow position size color strength />` puts a halo round anything else that shines. Only write your own lights when none of the looks fit.

## The set

These are soft rounded matte shapes, like modelling clay, which suit a warm everyday story. Use them first for those, then build what's missing from `<Block p s c r rot />` (a rounded box), `<Ball p s c />` and `<Tube p r r2 h c rot />`, so that what you make belongs in the same world. Keep the set simple but lived in: a room has a window or door, something on the wall, a rug. Backgrounds are quieter than the people.

Each takes `at`, `turn` (degrees), `size`, plus colours; see `set.tsx` for the rest. All face +z unless noted.

- Room: `<Room size={[w, d]} height wall floor trim wood side />` is open at the front, with the camera looking in from +z. `Window` (`view`: night, dusk, day, grey; `curtains`), `Door` (`open`), `Picture`, `Shelf` go on its back wall, at z = -d/2 + 0.02.
- Bedroom: `Bed` (mattress top 0.6 m up, headboard towards -z), `Quilt` (`w d height bumps`: a hump for each body under it, and tall enough to clear their feet), `Pillow`, `Cabinet`, `Lamp`, `Rug`.
- Living, working: `Sofa`, `Chair`, `Table`, `Laptop`, `Screen`, `Plant`, `Mug`, `Phone`.
- Kitchen: `Counter` (top 0.9 m up), `Fridge`.
- Outdoors: `Sky`, `Ground`, `Road`, `Tree`, `Building`, `Car`, `StreetLamp`, `Bench`, `Cloud`.
- `<Soft at s strength />` is a soft dark patch on a surface. Put one under anything you build, so that it sits there rather than floats.

## Actor

People act. Don't just place them: every line should have them doing something you could understand with the sound off.

```tsx
<Actor
  look={{body: 'm'|'f', skin, shirt, pants, shoes, sole, sleeves: 'long'|'short'|'none', shorts, vest, tie, gloves, hair: 'parted'|'long'|'buns'|'buzzed'|'none', hairColor, eyeColor, beard, barefoot, muscle: 0..1}}
  path={[{at, pos: [x,y,z], face?, move?}]}           // where they are. They walk there by themselves
  cues={[{at, pose, take=0.7}]}                       // what pose they move into, and how many seconds it takes
  gestures={[{at, kind, take?}]}                      // quick acting on top of the pose
  lookAt={[{at, to: [x,y,z] | (t) => [x,y,z] | null}]} // head and eyes follow it; null looks ahead
  mood="neutral"|"happy"|"sad"|"angry"|"scared"|"shocked"  // or [{at, mood}]; faces change smoothly
  talk={[[start, end]]}                               // mouth moves
  eyes={(t) => t < 3 ? 0 : 1}                         // openness, 0 is asleep; they also blink by themselves
  hold={{hand_r: <Mug />}}                            // sticks to a bone, axes in actor space
  phase={0.4}  scale={1}  visible={(t) => t > 3}  still
/>
```

Actors breathe, sway a little and blink by themselves, so that a held pose stays alive. Pass `still` for someone unconscious. Give each actor a different `phase`.

**Moving around.** Give `path` two marks and they walk between them at the speed that takes: they speed up, slow down and swing round to face the way they're going, and their feet never slide. Fast enough and they jog (over 2.3 m/s) or sprint (over 4.6 m/s). `face` is degrees, 0 looks along +Z. A mark's `move` says how they get there from the mark before: `walk`, `glide` (no steps: shuffling across a bed, being pushed, riding), `drop` (falling, use with a `thud` gesture on landing) or `hop`. A mark with the same `pos` as the one before holds them there. Put `y` at the height of whatever they stand on.

**Poses.** `cues` is how an actor performs. A pose takes a moment to arrive: the hips lead, then the back, hands and head, with a small dip first and a settle after. Names: `stand`, `hipsHands`, `armsCrossed`, `facepalm`, `thinking`, `handsOnHead`, `armsUp`, `slump`, `phone`, `carry`, `reach`, `point`, `sit`, `sitSlumped`, `sitWork`, `crouch`, `sitLegsOut`, `lieBack`, `lieBackHandsOnChest`, `lieSideLeft`, `lieSideRight`, `swim`. A list combines them, later ones on top: `pose: ['sit', 'facepalm']`.

Any pose can be written by hand, and this is how you make whatever the story needs. Hands land exactly where you say, and the elbows work themselves out:

```tsx
// Picks up the mug on the counter, then lifts it to the mouth
cues={[
  {at: 4, pose: {hand_r: {on: 'world', at: [-0.75, 1, -2.03], fingers: [0, 0, -1], palm: [1, 0, 0]}, bend: [8, 0, 0], grip_r: 0.45}},
  {at: 6, pose: {hand_r: {on: 'Head', at: [-0.04, -0.08, 0.2]}, head: [-10, 0, 0], grip_r: 0.45}, take: 0.9},
]}
```

Fields, all optional: `hips` (metres from where they are when standing), `body` (rotates everyone at the pelvis, degrees), `bend` (the back), `head`, `plant: false` (feet leave the ground spot), `hand_l hand_r foot_l foot_r` (`{on, at, elbow?, toes?, fingers?, palm?}`), `grip_l grip_r` (0 open, 1 fist), `point_l point_r`. Angles: x forward, y to their left, z to their right. `on` is a bone, `world` or `root`: `at` is metres from it, x to the actor's left, y up, z forward, and moves with that part of the body, so a hand on the head stays on the head. The wrist is the point that lands, and the fingers extend about 0.17 m beyond it. `fingers` is the way they point and `palm` the way the palm faces, in the same axes: set both whenever a hand touches something. A hand flat on a table is `fingers: [0, 0, 1], palm: [0, -1, 0]`. Their left is +x when they face +z.

Where to put the actor:
- Standing poses and `sit`, `sitSlumped`, `sitWork`, `crouch`: their position is the floor under their feet. A sitter's seat is 0.36 m behind that and 0.48 m up, facing the same way.
- `sitLegsOut` and the `lie` poses: their position is on the surface, under the pelvis, so y is its height. Lying on the back, the head is 0.75 m towards -z and the feet 0.95 m towards +z. On a `Bed` at the origin, put the two sides at x = ±0.5, y = 0.6, z = -0.12.

The `lookAt` head turns with whatever's anchored to it, so clear it (`to: null`) before a hand goes to the face. A person lying on their back looks best seen from above, facing the camera: keep `lookAt` off them, or only slight.

**Gestures.** `nod`, `shake`, `flinch`, `gasp`, `sigh`, `laugh`, `tremble`, `shrug`, `wave`, `clap`, `jump`, `thud`, `stomp`. Use them on the words: `{at: wordAt('no'), kind: 'shake'}`. A reaction is a mood plus a gesture, a moment after the thing that caused it.

**Motion capture.** `act={[{at, clip, fade=0.22, speed=1, offset=0}]}` plays a clip when no pose will do: sword fights, climbing, swimming, chopping. Passing `act` turns off walking by itself, so the stride is yours to match: `Walk_Loop` covers about 1.5 m/s, `Jog_Fwd_Loop` 3.2, `Sprint_Loop` 6, tune with `speed`. Hold a still with `speed: 0` and an `offset`. Cues still work on top. `pose={(t) => ({upperarm_r: [x, y, z]})}` adds rotation to a bone, in degrees, with the same axes.

People are plain cartoon figures: a big round head, two dots for eyes, thick brows, a small mouth, smooth limbs and chunky fingers. Their faces read from any distance, and mood is the way to make them act. Skin tones are any colour. Dress people for their time and place; add helmets, hats and backpacks with `hold={{Head: ...}}`, `{spine_03: ...}`. The head is about 0.37 m across and centred about 0.135 m above the Head bone. Keep what you add just as simple; don't add realism to a face or body.
Bones: `root pelvis spine_01 spine_02 spine_03 neck_01 Head clavicle_l/r upperarm_l/r lowerarm_l/r hand_l/r thigh_l/r calf_l/r foot_l/r ball_l/r`.

Clips (`_Loop` repeats, others play once and hold the last frame):
- Stand: Idle_Loop, Idle_Talking_Loop, Idle_TalkingPhone_Loop, Idle_FoldArms_Loop, Idle_No_Loop, Yes, Idle_Rail_Loop, Idle_Rail_Call, Idle_Lantern_Loop, Idle_Torch_Loop, Dance_Loop, Consume
- Move: Walk_Loop, Walk_Formal_Loop, Walk_Carry_Loop, Jog_Fwd_Loop, Sprint_Loop, Crouch_Idle_Loop, Crouch_Fwd_Loop, Push_Loop, Swim_Idle_Loop, Swim_Fwd_Loop, Driving_Loop, ClimbUp_1m_RM, Slide_Start, Slide_Loop, Slide_Exit, Roll, Jump_Start, Jump_Loop, Jump_Land, NinjaJump_Start, NinjaJump_Idle_Loop, NinjaJump_Land
- Sit and floor: Sitting_Enter, Sitting_Idle_Loop, Sitting_Talking_Loop, Sitting_Exit, LayToIdle
- Hands: Interact, PickUp_Table, Chest_Open, Fixing_Kneeling, Farm_Harvest, Farm_PlantSeed, Farm_Watering, TreeChopping_Loop, OverhandThrow, Spell_Simple_Enter, Spell_Simple_Idle_Loop, Spell_Simple_Shoot, Spell_Simple_Exit
- Fight: Punch_Enter, Punch_Jab, Punch_Cross, Melee_Hook, Melee_Hook_Rec, Sword_Idle, Sword_Attack, Sword_Regular_A, Sword_Regular_B, Sword_Regular_C, Sword_Regular_Combo, Sword_Block, Idle_Shield_Loop, Shield_OneShot, Idle_Shield_Break, Pistol_Idle_Loop, Pistol_Aim_Neutral, Pistol_Aim_Up, Pistol_Aim_Down, Pistol_Shoot, Pistol_Reload
- Hurt: Hit_Chest, Hit_Head, Hit_Knockback, Death01, Zombie_Idle_Loop, Zombie_Walk_Fwd_Loop, Zombie_Scratch

For several extras, map over a seeded list and give each its own `phase` and `look`. Every Actor costs render time: stay under about 30 at once, and use simple shapes for far-off crowds.

**Things that move.** `acted(p)` from the kit is the same curve poses use, with a dip and a settle: `interpolate(acted((t - 4) / 0.7), [0, 1], [a, b])`, for a door swinging or a mug sliding along a table.

## 2D worlds

For pixel art, ink, paper and diagrams. Draw with ordinary DOM and SVG inside these. A 2D film is still one continuous world with a moving camera, not a series of cards.

- `<World2D stops={[{at, x, y, zoom}]} snap>` is a camera over a world as large as you like; `{x, y}` is what's centred. `<Layer depth>` inside it is a plane for parallax: 1 moves with the world, 0.3 is far away, 0 is stuck to the screen.
- `<Sprite art={['.aa.', 'abba']} colors={{a: '#334', b: '#f80'}} px x y flip />`, or `frames={[...]} rate` for animation. Use the same `px` for every sprite in a film, and `snap` the World2D to it.
- `<Stage pixels={6} colors={7}>` renders the whole 3D kit, including people, mocap and lights, as chunky pixels. It's usually the richest route to pixel art, because the characters can really act. Keep the set bold and simple, and don't use `grade`.
- `<Draw d at take stroke width dash />` is an SVG path that draws itself. `<Boil strength rate>` makes everything inside it wobble as if inked by hand. `<Grain opacity size blend />` is paper or film grain: put it after the picture, before the Captions.
- `THEMES.<style>` holds the colours and fonts of each style: `bg land accent text ... fonts.display fonts.body`.
- `<Meter label value x y w color low font />` is a level, 0 to 1, that turns `low` under a quarter: air, money, heat.
- `<Captions mode="punch|word|line" font color accent upper italic top size />`: `word` is one big word at a time, best when something lands on every word; `line` is a calm sentence, best with long unbroken shots; `punch` highlights the word being said. Match `font` to your style.

## Maps

`<GeoMap stops={[{at, lon, lat, span}]} look={{sea, land, border, borderWidth, glow, grid}} paint={(t) => ({TUR: '#c33'})}>{(project) => ...}</GeoMap>` is a world map with real countries and one continuous camera. `span` is the degrees of longitude across the frame: 120 for a continent, 8 for a region. `paint` colours whole countries by ISO code and may change with time, so power can visibly shift. Inside, `<Route points={[project(lon, lat), ...]} at take color width dash head>` draws a journey with its marker exactly on the end of the line; pass a function as children to draw your own marker from `(x, y, angle)`: an army, a ship, a sprite. `onLine(points, k)` gives a place and heading along any line. A flag is `<img src={staticFile('flags/tr.svg')} />`.

For terrain:

`node ../../scripts/film.mjs terrain <west> <south> <east> <north>` downloads real elevation for a box up to continent size, and prints the metadata for:

```tsx
<ReliefMap meta={{west, south, east, north, width, height}} stops={[{at, lon, lat, zoom}]}>
  {(project) => <svg width={1080} height={1920}>{/* project(lon, lat) gives pixels: draw routes, ships, labels */}</svg>}
</ReliefMap>
```

`zoom` is screen pixels per image pixel, usually 1.5 to 5. Use accurate coordinates, and route ships over water, not across land. No Stage is needed for a map film, or composite one over a Stage.

## Checking your work

Run from this folder, and nothing else is available in the shell:

- `node ../../scripts/film.mjs check`: type-checks, renders stills at the start and middle of every beat, writes `.check/sheet.jpg`. Read that image.
- `node ../../scripts/film.mjs check --at 3.2,7.5`: stills at exact seconds.
- `node ../../scripts/film.mjs check --strip 10,12,8`: 8 stills from 10s to 12s, to judge movement.
- `node ../../scripts/film.mjs motion`: renders one frame a second and reports any dead air, where the picture barely changes. Run it once, near the end. `--every 2` is quicker on a long film.

Each check costs time, so check after real progress rather than after every edit. Stills are low resolution by design; zoom a shot with `--at` when something looks off.
