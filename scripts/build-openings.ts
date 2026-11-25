// Builds public/openings.json from the Lichess opening TSVs (CC0) in scripts/data/openings/.
// Each line's moves are replayed with chess.js and keyed by EPD (the FEN without
// the move counters), so lookups during a game are a single map read.
//
// Run: npm run build:openings
// Update the data: re-download a.tsv–e.tsv from github.com/lichess-org/chess-openings.
import { Chess } from 'chess.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out: Record<string, { eco: string; name: string }> = {};
let lines = 0;

for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const rows = readFileSync(join(root, 'scripts/data/openings', `${file}.tsv`), 'utf8').trim().split('\n');
  const header = rows.shift()!.split('\t');
  const col = (n: string) => header.indexOf(n);
  for (const row of rows) {
    const cells = row.split('\t');
    const eco = cells[col('eco')];
    const name = cells[col('name')];
    const pgn = cells[col('pgn')];
    const chess = new Chess();
    chess.loadPgn(pgn);
    const epd = chess.fen().split(' ').slice(0, 4).join(' ');
    // When two lines reach the same position, keep the first one listed (Lichess's choice).
    if (!out[epd]) out[epd] = { eco, name };
    lines++;
  }
}

writeFileSync(join(root, 'public/openings.json'), JSON.stringify(out));
console.log(`openings.json: ${Object.keys(out).length} positions from ${lines} lines`);
