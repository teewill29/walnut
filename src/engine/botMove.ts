import { Chess } from 'chess.js';
import { toUci } from '../chess/game';
import type { Level } from '../db/types';
import type { EngineManager } from './EngineManager';
import { LEVELS } from './levels';
import { pickMultiPvMove } from './pick';
import { scoreCp } from './uci';

/** Asks Stockfish for the bot's move at a level. Returns a UCI move. */
export async function chooseBotMove(
  engine: EngineManager,
  fen: string,
  level: Level,
  signal?: AbortSignal,
  rng: () => number = Math.random,
): Promise<string> {
  const method = LEVELS[level].method;
  const legal = new Chess(fen).moves({ verbose: true }).map(toUci);

  if (method.kind === 'multipv') {
    const res = await engine.search({
      fen,
      go: `depth ${method.depth}`,
      multiPv: method.multiPv,
      priority: 'bot',
      signal,
    });
    const candidates = res.lines.map((l) => ({ move: l.pv[0], score: scoreCp(l) }));
    return pickMultiPvMove(fen, candidates, method, rng);
  }

  const res = await engine.search({
    fen,
    go: `movetime ${method.movetimeMs}`,
    multiPv: 1,
    limitElo: method.kind === 'limit' ? method.elo : undefined,
    priority: 'bot',
    signal,
  });
  if (res.bestmove && legal.includes(res.bestmove)) return res.bestmove;
  return legal[Math.floor(rng() * legal.length)];
}
