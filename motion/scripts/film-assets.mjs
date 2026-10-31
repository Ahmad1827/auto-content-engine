// One-off: packs Quaternius's CC0 kits into motion/public/film. The output is committed, so this only reruns to change the bundle.
// Needs the unzipped kits and `npm i --no-save @gltf-transform/core @gltf-transform/functions sharp`:
//   node scripts/film-assets.mjs <AL_Standard.fbx> <UAL2_Standard.glb> <dir of the Superhero_*_FullBody.gltf bodies> [dir with those packages]
globalThis.self = globalThis;
globalThis.window = globalThis;
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [fbxPath, ual2Path, bodyDir, depsDir = process.cwd()] = process.argv.slice(2);
const req = createRequire(path.join(path.resolve(depsDir), 'x.js'));
const load = (name) => import(pathToFileURL(req.resolve(name)).href);
const {NodeIO} = await load('@gltf-transform/core');
const {prune, dedup, textureCompress} = await load('@gltf-transform/functions');
const sharp = req('sharp');
const {FBXLoader} = await import('three/examples/jsm/loaders/FBXLoader.js');
const {GLTFLoader} = await import('three/examples/jsm/loaders/GLTFLoader.js');

const OUT = path.resolve('public/film');
mkdirSync(OUT, {recursive: true});
const ab = (file) => {
  const b = readFileSync(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};
const fix = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// Clips: keep only what the rig uses (rotations, plus pelvis/root movement), rounded so the file stays small.
const fbx = new FBXLoader().parse(ab(fbxPath), '');
const gltf = await new Promise((ok, no) => new GLTFLoader().parse(ab(ual2Path), '', ok, no));
const clips = {};
for (const clip of [...fbx.animations, ...gltf.animations]) {
  const name = clip.name.replace(/^.*\|/, '');
  if (name === 'A_TPose' || clips[name]) continue;
  const tracks = [];
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split('.');
    if (prop === 'scale' || (prop === 'position' && bone !== 'pelvis' && bone !== 'root')) continue;
    tracks.push({b: bone, p: prop === 'position' ? 'p' : 'q', t: [...t.times].map((v) => fix(v, 3)),
      v: [...t.values].map((v) => fix(v, 4))});
  }
  clips[name] = {d: fix(clip.duration, 3), tracks};
}
writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify(clips));

// Bodies: the Actor takes only the skeleton from these and builds the figure itself.
const io = new NodeIO();
const baseColorOnly = (doc) => {
  doc.getRoot().listAnimations().forEach((a) => a.dispose());
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null);
    m.setMetallicRoughnessTexture(null);
  }
};
for (const [file, out] of [['Superhero_Male_FullBody.gltf', 'body_m.glb'], ['Superhero_Female_FullBody.gltf', 'body_f.glb']]) {
  const doc = await io.read(path.join(bodyDir, file));
  baseColorOnly(doc);
  await doc.transform(prune(), dedup(), textureCompress({encoder: sharp, targetFormat: 'webp', resize: [1024, 1024]}));
  await io.write(path.join(OUT, out), doc);
}
