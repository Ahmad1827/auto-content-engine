// Renders still frames of a storyboard with one bundle: node scripts/stills.mjs props.json outDir 30 120 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

const [propsPath, outDir, ...frames] = process.argv.slice(2);
const inputProps = JSON.parse(readFileSync(propsPath, 'utf8'));
mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'Story', inputProps});
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `frame_${String(f).padStart(5, '0')}.png`);
  await renderStill({composition, serveUrl, inputProps, frame: f, output});
  console.log(output);
}
