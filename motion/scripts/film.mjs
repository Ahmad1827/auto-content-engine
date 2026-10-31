// The film-maker's two tools, run from inside a film's folder:
//   node ../../scripts/film.mjs check [--at 1.2,3.4] [--strip 10,12,8]   Type-checks, renders stills at those seconds (default: start and middle
//                                                                         of each beat) and writes one contact sheet to .check/sheet.jpg
//   node ../../scripts/film.mjs terrain <west> <south> <east> <north>     Relief map of that box, for <ReliefMap>
import {bundle} from '@remotion/bundler';
import {makeCancelSignal, openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// A failed still can leave the browser closing one of its tabs. That must not hide the real error, which is reported below.
process.on('unhandledRejection', (e) => {
  if (!/Target closed/.test(String(e?.message))) throw e;
});

const MOTION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILM = process.cwd();
const FILMS = path.join(MOTION, 'films');
if (path.dirname(FILM) !== FILMS || !existsSync(path.join(FILM, 'film.json'))) {
  console.error('Run this from inside a film folder (motion/films/<id>).');
  process.exit(2);
}
const data = JSON.parse(readFileSync(path.join(FILM, 'film.json'), 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);

function option(name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? null : rest[i + 1];
}

function typecheck() {
  const out = spawnSync(path.join(MOTION, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', path.join(FILM, 'tsconfig.json')], {cwd: FILM, encoding: 'utf8'});
  const text = `${out.stdout}${out.stderr}`.trim();
  if (out.status !== 0) {
    console.error(`TYPE ERRORS\n${text.split('\n').slice(0, 40).join('\n')}`);
    process.exit(1);
  }
  console.log('Types OK');
}

async function check() {
  typecheck();
  const end = data.beats.at(-1).start + data.beats.at(-1).duration;
  let times = data.beats.flatMap((b) => [b.start + 0.05, b.start + b.duration / 2]);
  if (option('at')) times = option('at').split(',').map(Number);
  if (option('strip')) {
    const [a, b, n] = option('strip').split(',').map(Number);
    times = Array.from({length: n}, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));
  }
  times = [...new Set(times.map((t) => Math.max(0, Math.min(end - 0.05, t))))].sort((a, b) => a - b).slice(0, 40);

  const out = path.join(FILM, '.check');
  rmSync(out, {recursive: true, force: true});
  mkdirSync(out, {recursive: true});
  const serveUrl = await bundle({entryPoint: path.join(FILM, 'index.ts'), publicDir: path.join(MOTION, 'public')});
  const inputProps = {filmCheck: true};
  const composition = await selectComposition({serveUrl, id: 'Film', inputProps});
  const browser = await openBrowser('chrome');
  const failures = [];
  const started = Date.now();
  try {
    for (const [i, t] of times.entries()) {
      const frame = Math.round(t * data.fps);
      const output = path.join(out, `f${String(i).padStart(3, '0')}.jpg`);
      const {cancelSignal} = makeCancelSignal();
      try {
        await renderStill({composition, serveUrl, inputProps, frame, output, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.4, puppeteerInstance: browser, cancelSignal, timeoutInMilliseconds: 120000, logLevel: 'error'});
      } catch (e) {
        failures.push(`t=${t.toFixed(2)}s: ${String(e.message ?? e).split('\n').slice(0, 6).join(' | ')}`);
      }
    }
  } finally {
    await browser.close({silent: true});
  }
  const perFrame = (Date.now() - started) / Math.max(1, times.length) / 1000;
  if (failures.length) {
    console.error(`RENDER ERRORS\n${[...new Set(failures)].slice(0, 8).join('\n')}`);
    process.exit(1);
  }
  const columns = Math.min(8, times.length);
  const rows = Math.ceil(times.length / columns);
  const label = times.map((t) => t.toFixed(2)).join(' ');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(out, 'f%03d.jpg'), '-vf', `scale=240:-1,tile=${columns}x${rows}`, '-frames:v', '1', path.join(out, 'sheet.jpg')]);
  console.log(`Sheet: .check/sheet.jpg (${columns} across, left to right, then down)\nTimes: ${label}\n${perFrame.toFixed(1)}s per frame at 40% size`);
}

function terrain() {
  const box = rest.slice(0, 4);
  if (box.length !== 4 || box.some((v) => Number.isNaN(Number(v)))) {
    console.error('Usage: terrain <west> <south> <east> <north>');
    process.exit(2);
  }
  const python = process.env.ACE_PYTHON || 'python3';
  const dest = path.join(MOTION, 'public', 'films', path.basename(FILM));
  const out = spawnSync(python, [path.join(MOTION, '..', 'src', 'motion_gen', 'terrain.py'), ...box, dest], {encoding: 'utf8'});
  process.stdout.write(out.stdout);
  process.stderr.write(out.stderr);
  process.exit(out.status ?? 1);
}

if (cmd === 'check') await check();
else if (cmd === 'terrain') terrain();
else {
  console.error('Commands: check, terrain');
  process.exit(2);
}
process.exit(0);
