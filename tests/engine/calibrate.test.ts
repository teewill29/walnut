import { Chess } from 'chess.js';
import { it } from 'vitest';
import { detectEnd, tryMove } from '../../src/chess/game';
import type { Level } from '../../src/db/types';
import { chooseBotMove } from '../../src/engine/botMove';
import { nodeEngine } from './nodeEngine';

// Bot-vs-bot matches to check the levels are in the right order. Not a real Elo
// measurement, just a sanity check before Teewill's own calibration games.
// Run: MATCH=medium-hard GAMES=6 npm run calibrate

const match = process.env.MATCH;

it.runIf(!!match)(`match ${match}`, async () => {
  const [a, b] = match!.split('-') as [Level, Level];
  const games = Number(process.env.GAMES ?? 6);
  const score = { [a]: 0, [b]: 0 } as Record<string, number>;
  // One engine for both bots: the Node build supports one Stockfish per process, and every
  // request sets all its options anyway.
  const ea = nodeEngine();
  const eb = ea;
  for (let g = 0; g < games; g++) {
    const white = g % 2 === 0 ? a : b;
    const chess = new Chess();
    await ea.newGame();
    let end = null;
    while (!end && chess.history().length < 200) {
      const side: Level = chess.turn() === 'w' ? white : white === a ? b : a;
      const uci = await chooseBotMove(side === a ? ea : eb, chess.fen(), side);
      tryMove(chess, uci);
      end = detectEnd(chess);
    }
    const result = end?.result ?? '1/2-1/2';
    const black = white === a ? b : a;
    if (result === '1-0') score[white] += 1;
    else if (result === '0-1') score[black] += 1;
    else {
      score[white] += 0.5;
      score[black] += 0.5;
    }
    console.log(`game ${g + 1}: ${white} (W) vs ${black} (B) → ${result} ${end?.termination ?? 'move limit'} in ${chess.history().length} plies`);
  }
  console.log(`RESULT ${a} ${score[a]} – ${score[b]} ${b}`);
  ea.terminate();
});
