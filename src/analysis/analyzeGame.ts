import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import type { Analysis, Color, GameResult, PlyResult, PositionEval } from '../db/types';
import { classify, gamePhase, isFlagged } from './classify';
import { forMover, gameAccuracy, moveAccuracy, positionWinWhite } from './winPercent';

// Turns the engine's per-position evals into the saved Analysis. Pure.

export interface AnalyzeInput {
  moves: string[]; // UCI
  positions: PositionEval[]; // moves.length + 1, White's view
  playerColor: Color;
  result: GameResult;
  /** True if the position (FEN) is in the opening table. */
  inBook: (fen: string) => boolean;
  version: number;
  depth: number;
  now?: number;
}

export function analyzeGame(input: AnalyzeInput): Analysis {
  const { moves, positions, playerColor } = input;
  if (positions.length !== moves.length + 1) throw new Error('Need one eval per position');

  const chess = new Chess();
  const fens = [chess.fen()];
  const sans: string[] = [];
  for (const m of moves) {
    sans.push(chess.move(parseUci(m)).san);
    fens.push(chess.fen());
  }
  const sideToMove = (i: number): Color => (i % 2 === 0 ? 'w' : 'b');
  const winW = positions.map((p, i) => positionWinWhite(p, sideToMove(i)));

  const plies: PlyResult[] = moves.map((uci, i) => {
    const color = sideToMove(i);
    const winBefore = forMover(winW[i], color);
    const winAfter = forMover(winW[i + 1], color);
    const drop = Math.max(0, winBefore - winAfter);
    return {
      ply: i,
      san: sans[i],
      color,
      winBefore,
      winAfter,
      drop,
      accuracy: moveAccuracy(drop),
      tag: classify({ inBook: input.inBook(fens[i + 1]), ply: i, isBest: positions[i].best === uci, drop }),
      phase: gamePhase(fens[i], i),
      replyVerdict: null,
    };
  });

  // Punished / Missed: your reply to each of the bot's flagged moves.
  for (const p of plies) {
    if (p.color === playerColor || !isFlagged(p.tag)) continue;
    const reply = plies[p.ply + 1];
    if (reply) p.replyVerdict = reply.tag === 'best' || reply.drop < 5 ? 'punished' : 'missed';
  }

  const mine = plies.filter((p) => p.color === playerColor);
  const counts = {
    inaccuracy: mine.filter((p) => p.tag === 'inaccuracy').length,
    mistake: mine.filter((p) => p.tag === 'mistake').length,
    blunder: mine.filter((p) => p.tag === 'blunder').length,
  };

  const biggest = (list: PlyResult[]) =>
    list.reduce<PlyResult | null>((best, p) => (!best || p.drop > best.drop ? p : best), null);

  let turningPly: number | null = null;
  let turningKind: Analysis['turningKind'] = null;
  const myFlagged = mine.filter((p) => isFlagged(p.tag));
  const won = (input.result === '1-0' && playerColor === 'w') || (input.result === '0-1' && playerColor === 'b');
  if (myFlagged.length) {
    turningPly = biggest(myFlagged)!.ply;
    turningKind = 'loss';
  } else if (won) {
    const botFlagged = plies.filter((p) => p.color !== playerColor && isFlagged(p.tag));
    if (botFlagged.length) {
      turningPly = biggest(botFlagged)!.ply;
      turningKind = 'win';
    }
  }

  return {
    version: input.version,
    depth: input.depth,
    analyzedAt: input.now ?? Date.now(),
    positions,
    plies,
    accuracy: {
      w: gameAccuracy(plies.filter((p) => p.color === 'w').map((p) => p.accuracy)),
      b: gameAccuracy(plies.filter((p) => p.color === 'b').map((p) => p.accuracy)),
    },
    counts,
    turningPly,
    turningKind,
  };
}
