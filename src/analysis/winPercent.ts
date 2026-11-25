import type { Color, PositionEval } from '../db/types';

// Win% and accuracy (docs/ENGINE.md §4). Lichess's formulas.

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** White's win% from centipawns (White's view). */
export function winWhite(cp: number): number {
  const c = clamp(cp, -1000, 1000);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/**
 * A position's eval as clamped centipawns for White. Mate for White → +1000, for Black → −1000.
 * `mate: 0` is a finished game: the side to move has been checkmated.
 */
export function evalCp(e: PositionEval, sideToMove: Color): number {
  if (e.mate !== null) {
    if (e.mate > 0) return 1000;
    if (e.mate < 0) return -1000;
    return sideToMove === 'w' ? -1000 : 1000;
  }
  return e.cp ?? 0;
}

/** White's win% at a position. */
export const positionWinWhite = (e: PositionEval, sideToMove: Color) => winWhite(evalCp(e, sideToMove));

/** The mover's win% given White's. */
export const forMover = (winW: number, mover: Color) => (mover === 'w' ? winW : 100 - winW);

/** Move accuracy from the win% drop. */
export function moveAccuracy(drop: number): number {
  return clamp(103.1668 * Math.exp(-0.04354 * drop) - 3.1669, 0, 100);
}

/** Game accuracy: mean of move accuracies, rounded to a whole percent. 0 moves → 0. */
export function gameAccuracy(moveAccuracies: number[]): number {
  if (moveAccuracies.length === 0) return 0;
  return Math.round(moveAccuracies.reduce((a, b) => a + b, 0) / moveAccuracies.length);
}
