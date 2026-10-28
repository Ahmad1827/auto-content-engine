// Copies country flag SVGs into public/ so scenes can load them with staticFile().
import {cpSync, existsSync, mkdirSync} from 'node:fs';

const src = 'node_modules/flag-icons/flags/4x3';
const dest = 'public/flags';
if (existsSync(src)) {
  mkdirSync(dest, {recursive: true});
  cpSync(src, dest, {recursive: true});
}
