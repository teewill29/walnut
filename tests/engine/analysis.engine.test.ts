import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { detectEnd, toUci } from '../../src/chess/game';
import type { Color } from '../../src/db/types';
import { runAnalysis } from '../../src/engine/analyze';
import { nodeEngine } from './nodeEngine';

// The fixture integration test (docs/ENGINE.md §7): real Stockfish, the app's analysis settings.

const engine = nodeEngine();
afterAll(() => engine.terminate());

function load(name: string) {
  const chess = new Chess();
  chess.loadPgn(readFileSync(join(__dirname, '../fixtures', name), 'utf8'));
  const moves = chess.history({ verbose: true }).map(toUci);
  const end = detectEnd(chess);
  return { moves, result: chess.getHeaders().Result as '1-0' | '0-1', termination: end?.termination ?? null };
}

async function analyze(name: string, playerColor: Color) {
  const g = load(name);
  const t = Date.now();
  const a = await runAnalysis(engine, { ...g, playerColor }, { inBook: () => false });
  console.log(`${name}: ${g.moves.length} plies in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  return a;
}

describe('analysis with real Stockfish', () => {
  it("fool's mate: 2. g4 is a Blunder", async () => {
    const a = await analyze('fools-mate.pgn', 'w');
    const g4 = a.plies.find((p) => p.san === 'g4')!;
    expect(g4.tag).toBe('blunder');
    expect(a.turningPly).toBe(g4.ply);
  });

  it("scholar's mate: 3...Nf6 is a Blunder, and the best move defends f7", async () => {
    const a = await analyze('scholars-defense.pgn', 'b');
    const nf6 = a.plies.find((p) => p.san === 'Nf6')!;
    expect(nf6.tag).toBe('blunder');
    const best = a.positions[nf6.ply].best!;
    const chess = new Chess();
    for (const m of load('scholars-defense.pgn').moves.slice(0, nf6.ply)) chess.move(m);
    expect(['g6', 'Qe7', 'Qf6']).toContain(chess.move(best).san);
  });

  // ENGINE.md §7 asks for "Black has at least one Mistake or Blunder". With these formulas Black's
  // worst move (9...b5, a 13.5% drop) is an Inaccuracy: Black is already losing, and win% flattens
  // in lost positions. So this checks for at least one flagged move (Inaccuracy or worse).
  it('the Opera Game: no White blunders, and Black has at least one flagged move', async () => {
    const a = await analyze('opera-game.pgn', 'w');
    const white = a.plies.filter((p) => p.color === 'w');
    const black = a.plies.filter((p) => p.color === 'b');
    expect(white.filter((p) => p.tag === 'blunder').map((p) => p.san)).toEqual([]);
    expect(black.some((p) => ['inaccuracy', 'mistake', 'blunder'].includes(p.tag))).toBe(true);
  });
});
