// Copies the Stockfish lite single-threaded build (GPL-3.0) from node_modules into
// public/engine/, so it ships with the app and is precached for offline use.
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/stockfish');
const dest = join(root, 'public/engine');
mkdirSync(dest, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(join(src, 'bin', f), join(dest, f));
}
copyFileSync(join(src, 'Copying.txt'), join(dest, 'COPYING.txt'));
console.log('Copied Stockfish into public/engine/');
