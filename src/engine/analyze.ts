import { Chess } from 'chess.js';
import { analyzeGame } from '../analysis/analyzeGame';
import { parseUci } from '../chess/game';
import type { Analysis, Game, PositionEval } from '../db/types';
import { ANALYSIS_DEPTH, ANALYSIS_MULTIPV, ANALYSIS_VERSION, PV_PLIES } from './analysisConfig';
import type { EngineManager } from './EngineManager';

// Post-game analysis (docs/ENGINE.md §3). Engine-agnostic so the same code runs in the app
// and in the Node integration test.

const DRAW_ENDINGS = new Set(['stalemate', 'repetition', 'fifty_move', 'insufficient']);

/** One position, stored from White's point of view. */
export async function evaluatePosition(
  engine: EngineManager,
  fen: string,
  opts: { finalDraw?: boolean; signal?: AbortSignal } = {},
): Promise<PositionEval> {
  const chess = new Chess(fen);
  // Terminal positions skip the engine: mate = mate 0 (side to move is mated), draws = 0.
  if (chess.isCheckmate()) return { cp: null, mate: 0, best: null, pv: [] };
  if (chess.isStalemate() || opts.finalDraw) return { cp: 0, mate: null, best: null, pv: [] };

  const res = await engine.search({
    fen,
    go: `depth ${ANALYSIS_DEPTH}`,
    multiPv: ANALYSIS_MULTIPV,
    // Each position from a clean slate: the same game gets the same analysis on every device,
    // after a resume, and on re-analysis.
    fresh: true,
    priority: 'analysis',
    signal: opts.signal,
  });
  const line = res.lines[0];
  const sign = chess.turn() === 'w' ? 1 : -1;
  return {
    cp: line && line.cp !== null ? sign * line.cp : line ? null : 0,
    mate: line && line.mate !== null ? sign * line.mate : null,
    best: res.bestmove,
    pv: line ? line.pv.slice(0, PV_PLIES) : [],
  };
}

export interface RunOptions {
  /** Positions already done (from analysisProgress), resumed from. */
  done?: PositionEval[];
  inBook: (fen: string) => boolean;
  onProgress?: (positions: PositionEval[]) => Promise<void> | void;
  signal?: AbortSignal;
}

/** Analyzes a finished game, resuming from `done`. */
export async function runAnalysis(
  engine: EngineManager,
  game: Pick<Game, 'moves' | 'playerColor' | 'result' | 'termination'>,
  opts: RunOptions,
): Promise<Analysis> {
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const m of game.moves) {
    chess.move(parseUci(m));
    fens.push(chess.fen());
  }
  const positions = (opts.done ?? []).slice(0, fens.length);
  for (let i = positions.length; i < fens.length; i++) {
    const finalDraw = i === fens.length - 1 && !!game.termination && DRAW_ENDINGS.has(game.termination);
    positions.push(await evaluatePosition(engine, fens[i], { finalDraw, signal: opts.signal }));
    await opts.onProgress?.(positions);
  }
  return analyzeGame({
    moves: game.moves,
    positions,
    playerColor: game.playerColor,
    result: game.result,
    inBook: opts.inBook,
    version: ANALYSIS_VERSION,
    depth: ANALYSIS_DEPTH,
  });
}
