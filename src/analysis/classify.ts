import { Chess } from 'chess.js';
import type { GamePhase, MoveTag } from '../db/types';

// Classification and game phase (docs/ENGINE.md §4).

export const BOOK_MAX_PLY = 20;

/** Checked in order: Book, Best, then the drop thresholds. `ply` is 0-based. */
export function classify(opts: { inBook: boolean; ply: number; isBest: boolean; drop: number }): MoveTag {
  if (opts.inBook && opts.ply <= BOOK_MAX_PLY) return 'book';
  if (opts.isBest) return 'best';
  if (opts.drop >= 30) return 'blunder';
  if (opts.drop >= 20) return 'mistake';
  if (opts.drop >= 10) return 'inaccuracy';
  return 'good';
}

export const isFlagged = (tag: MoveTag) => tag === 'inaccuracy' || tag === 'mistake' || tag === 'blunder';

const VALUES: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };

/** Non-pawn material on the board, both sides combined. */
export function nonPawnMaterial(fen: string): number {
  let total = 0;
  for (const row of new Chess(fen).board()) for (const sq of row) if (sq) total += VALUES[sq.type] ?? 0;
  return total;
}

/** Phase of a ply, judged on the position before the move. */
export function gamePhase(fenBefore: string, ply: number): GamePhase {
  if (ply < 24) return 'opening';
  if (nonPawnMaterial(fenBefore) <= 26) return 'endgame';
  return 'middlegame';
}
