import { describe, expect, it } from 'vitest';
import { allowsMateIn1, pickMultiPvMove } from '../src/engine/pick';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// After 1. f3 e5, White to move: 2. g4?? allows Qh4#.
const FOOL = 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2';

const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('allowsMateIn1', () => {
  it('spots a move that hangs mate', () => {
    expect(allowsMateIn1(FOOL, 'g2g4')).toBe(true);
    expect(allowsMateIn1(FOOL, 'e2e4')).toBe(false);
  });
});

describe('pickMultiPvMove', () => {
  const cands = [
    { move: 'e2e4', score: 30 },
    { move: 'd2d4', score: 25 },
    { move: 'a2a3', score: -200 },
  ];
  const cfg = { temperature: 0.8, blunderChance: 0.05 };

  it('picks by weight: a low roll takes the best move', () => {
    expect(pickMultiPvMove(START, cands, cfg, seq(0.5, 0.0))).toBe('e2e4');
  });

  it('a roll in the middle lands on the second candidate (near-equal weights)', () => {
    // weights ≈ 1, exp(-5/80)=0.939, exp(-230/80)=0.056 → total ≈ 1.995; 0.6 × total ≈ 1.2 → second
    expect(pickMultiPvMove(START, cands, cfg, seq(0.5, 0.6))).toBe('d2d4');
  });

  it('a bad candidate is rarely picked', () => {
    let bad = 0;
    let s = 1;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) if (pickMultiPvMove(START, cands, { ...cfg, blunderChance: 0 }, rng) === 'a2a3') bad++;
    expect(bad / 2000).toBeLessThan(0.05);
  });

  it('the blunder roll picks any legal move, but never one that hangs mate in 1', () => {
    const fcands = [{ move: 'e2e4', score: 0 }];
    for (let i = 0; i < 40; i++) {
      const m = pickMultiPvMove(FOOL, fcands, { temperature: 2, blunderChance: 1 }, seq(0, i / 40));
      expect(m).not.toBe('g2g4');
    }
  });

  it('ignores candidates that are not legal', () => {
    expect(pickMultiPvMove(START, [{ move: 'e7e5', score: 0 }, { move: 'g1f3', score: 0 }], cfg, seq(0.5, 0.0))).toBe('g1f3');
  });
});
