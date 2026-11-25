import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { toUci } from '../../src/chess/game';
import { runAnalysis } from '../../src/engine/analyze';
import { nodeEngine } from './nodeEngine';

// The same game must get the same analysis every time: on another device, after a resume,
// or after the engine has been busy with bot moves (CLAUDE.md rule 4).
// (One engine: the Node build of Stockfish supports one instance per process.)
const engine = nodeEngine();
afterAll(() => engine.terminate());

it('analysis is repeatable, including after bot searches and when resumed halfway', async () => {
  const c = new Chess();
  c.loadPgn(readFileSync(join(__dirname, '../fixtures/opera-game.pgn'), 'utf8'));
  const game = {
    moves: c.history({ verbose: true }).map(toUci),
    playerColor: 'w' as const,
    result: '1-0' as const,
    termination: 'checkmate' as const,
  };
  const opts = { inBook: () => false };
  // A bot-style search on another position, to fill the engine's hash with something else.
  const dirty = () =>
    engine.search({ fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', go: 'depth 12', multiPv: 4, priority: 'bot' });

  const full = await runAnalysis(engine, game, opts);
  await dirty();
  const resumed = await runAnalysis(engine, game, { ...opts, done: full.positions.slice(0, 15) });
  await dirty();
  const again = await runAnalysis(engine, game, opts);

  expect(again.positions).toEqual(full.positions);
  expect(resumed.positions).toEqual(full.positions);
  expect(again.plies.map((p) => p.tag)).toEqual(full.plies.map((p) => p.tag));
});
