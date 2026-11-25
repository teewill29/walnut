import { describe, expect, it } from 'vitest';
import { analyzeGame } from '../src/analysis/analyzeGame';
import { classify, gamePhase } from '../src/analysis/classify';
import { performanceRating } from '../src/analysis/performance';
import { evalCp, moveAccuracy, winWhite } from '../src/analysis/winPercent';
import type { PositionEval } from '../src/db/types';

// The required tests from docs/ENGINE.md §7.

describe('win%', () => {
  it('winWhite(0) = 50', () => expect(winWhite(0)).toBe(50));
  it('winWhite(1000) ≈ 97.5', () => expect(winWhite(1000)).toBeCloseTo(97.5, 1));
  it('clamps at ±1000', () => expect(winWhite(-5000)).toBe(winWhite(-1000)));
  it('treats mate as ±1000, and mate 0 as the side to move being mated', () => {
    expect(evalCp({ cp: null, mate: 3, best: null, pv: [] }, 'w')).toBe(1000);
    expect(evalCp({ cp: null, mate: -2, best: null, pv: [] }, 'w')).toBe(-1000);
    expect(evalCp({ cp: null, mate: 0, best: null, pv: [] }, 'w')).toBe(-1000);
    expect(evalCp({ cp: null, mate: 0, best: null, pv: [] }, 'b')).toBe(1000);
  });
});

describe('accuracy', () => {
  it('acc(0) ≈ 100', () => expect(Math.abs(moveAccuracy(0) - 100)).toBeLessThan(0.01));
  it('acc(30) ≈ 24.8', () => expect(Math.abs(moveAccuracy(30) - 24.8)).toBeLessThan(0.2));
});

describe('classification thresholds', () => {
  const c = (drop: number) => classify({ inBook: false, ply: 30, isBest: false, drop });
  it('9.99 is Good', () => expect(c(9.99)).toBe('good'));
  it('10 is an Inaccuracy', () => expect(c(10)).toBe('inaccuracy'));
  it('20 is a Mistake', () => expect(c(20)).toBe('mistake'));
  it('30 is a Blunder', () => expect(c(30)).toBe('blunder'));
  it('checks Book, then Best, before the thresholds', () => {
    expect(classify({ inBook: true, ply: 20, isBest: false, drop: 40 })).toBe('book');
    expect(classify({ inBook: true, ply: 21, isBest: true, drop: 40 })).toBe('best');
    expect(classify({ inBook: false, ply: 5, isBest: true, drop: 12 })).toBe('best');
  });
});

describe('performance rating', () => {
  const g = (score: 1 | 0.5 | 0) => ({ botElo: 1200, score });
  it('3W 1L 1D vs 1200 → ~1350 (1360 rounded to the nearest 50)', () => {
    expect(performanceRating([g(1), g(1), g(1), g(0), g(0.5)])).toBe('~1350');
  });
  it('all wins vs 1200 → "> 1600"', () => expect(performanceRating([g(1), g(1), g(1)])).toBe('> 1600'));
  it('all losses vs 1200 → "< 800"', () => expect(performanceRating([g(0), g(0)])).toBe('< 800'));
});

describe('game phase', () => {
  it('the starting position is the Opening', () => {
    expect(gamePhase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 0)).toBe('opening');
  });
  it('a king-and-pawn ending is the Endgame', () => {
    expect(gamePhase('8/5k2/4p3/3pP3/3P4/4K3/8/8 w - - 0 40', 78)).toBe('endgame');
  });
  it('ply 30 with all minor pieces and queens on is the Middlegame', () => {
    expect(gamePhase('2bqkb2/1pn2np1/p2pp2p/8/8/P2PP2P/1PN2NP1/2BQKB2 w - - 0 16', 30)).toBe('middlegame');
  });
});

describe('analyzeGame', () => {
  // Fool's mate with hand-made evals: 2. g4 drops White from ~45% to mated.
  const ev = (cp: number | null, mate: number | null, best: string | null): PositionEval => ({ cp, mate, best, pv: best ? [best] : [] });
  const input = {
    moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
    positions: [ev(20, null, 'e2e4'), ev(-60, null, 'e7e5'), ev(-50, null, 'e2e4'), ev(null, -1, 'd8h4'), ev(null, 0, null)],
    playerColor: 'w' as const,
    result: '0-1' as const,
    inBook: () => false,
    version: 1,
    depth: 14,
    now: 0,
  };

  it('flags 2. g4 as the blunder and turning point', () => {
    const a = analyzeGame(input);
    expect(a.plies[2].san).toBe('g4');
    expect(a.plies[2].tag).toBe('blunder');
    expect(a.counts.blunder).toBe(1);
    expect(a.turningPly).toBe(2);
    expect(a.turningKind).toBe('loss');
    expect(a.plies[3].tag).toBe('best'); // Qh4# was the engine's move
  });

  it('marks a bot mistake as Punished or Missed by your reply', () => {
    // Bot (Black) drops from even to −4.5 (White's view +450) with 1...g5, you reply with the best move.
    const a = analyzeGame({
      ...input,
      moves: ['e2e4', 'g7g5', 'd2d4'],
      positions: [ev(20, null, 'e2e4'), ev(30, null, 'e7e5'), ev(450, null, 'd2d4'), ev(460, null, 'f8g7')],
      result: '1-0',
    });
    expect(a.plies[1].tag).toBe('blunder');
    expect(a.plies[1].replyVerdict).toBe('punished');
    expect(a.turningKind).toBe('win');
    expect(a.turningPly).toBe(1);
  });
});
