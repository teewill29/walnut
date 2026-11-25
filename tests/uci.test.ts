import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo, scoreCp } from '../src/engine/uci';

describe('UCI parsing', () => {
  it('reads depth, multipv, cp and pv', () => {
    const l = parseInfo('info depth 8 seldepth 10 multipv 2 score cp -35 nodes 1234 nps 1000 time 12 pv e7e5 g1f3 b8c6');
    expect(l).toEqual({ depth: 8, multipv: 2, cp: -35, mate: null, pv: ['e7e5', 'g1f3', 'b8c6'] });
  });
  it('reads mate scores', () => {
    expect(parseInfo('info depth 5 score mate -2 pv h5f7')?.mate).toBe(-2);
  });
  it('skips bound scores and lines without a pv', () => {
    expect(parseInfo('info depth 8 score cp 20 lowerbound pv e2e4')).toBeNull();
    expect(parseInfo('info string NNUE evaluation enabled')).toBeNull();
    expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull();
  });
  it('reads bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('readyok')).toBeUndefined();
  });
  it('turns mate into ±10000 minus the moves to mate', () => {
    expect(scoreCp({ cp: null, mate: 3 })).toBe(9997);
    expect(scoreCp({ cp: null, mate: -3 })).toBe(-9997);
    expect(scoreCp({ cp: 42, mate: null })).toBe(42);
  });
});
