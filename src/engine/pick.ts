import { Chess } from 'chess.js';
import { parseUci, toUci } from '../chess/game';

// The MultiPV pick for Easy and Medium (docs/ENGINE.md §2). Pure, tested in tests/pick.test.ts.

export interface Candidate {
  move: string; // UCI
  score: number; // cp from the bot's side, mate → ±10000 minus moves to mate
}

export interface PickConfig {
  temperature: number;
  blunderChance: number;
}

/** True if, after `move`, the opponent has a mate in 1. */
export function allowsMateIn1(fen: string, move: string): boolean {
  const chess = new Chess(fen);
  try {
    chess.move(parseUci(move));
  } catch {
    return false;
  }
  for (const reply of chess.moves({ verbose: true })) {
    chess.move(reply);
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return true;
  }
  return false;
}

export function pickMultiPvMove(
  fen: string,
  candidates: Candidate[],
  cfg: PickConfig,
  rng: () => number = Math.random,
): string {
  const legal = new Chess(fen).moves({ verbose: true }).map(toUci);
  if (legal.length === 0) throw new Error('No legal moves');

  // 2. Sometimes a uniformly random legal move: believable beginner blunders.
  //    4. ...but never one that hangs mate in 1 when a candidate avoids it.
  if (candidates.length === 0 || rng() < cfg.blunderChance) {
    const candidateAvoids = candidates.some((c) => !allowsMateIn1(fen, c.move));
    const pool = candidateAvoids ? legal.filter((m) => !allowsMateIn1(fen, m)) : legal;
    const from = pool.length ? pool : legal;
    return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
  }

  // 3. Weight each candidate by how much it loses: w = exp(−Δ / (temperature × 100)).
  const valid = candidates.filter((c) => legal.includes(c.move));
  if (valid.length === 0) return legal[Math.floor(rng() * legal.length)];
  const best = Math.max(...valid.map((c) => c.score));
  const weights = valid.map((c) => Math.exp(-(best - c.score) / (cfg.temperature * 100)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < valid.length; i++) {
    r -= weights[i];
    if (r <= 0) return valid[i].move;
  }
  return valid[valid.length - 1].move;
}
