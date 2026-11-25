import { describe, expect, it } from 'vitest';
import { buildPgn, describeMove, detectEnd, replay, resultText, tryMove } from '../src/chess/game';
import { findOpening, openingFamily, type OpeningTable } from '../src/chess/openings';
import type { Game } from '../src/db/types';

const game = (over: Partial<Game>): Game => ({
  id: 'x',
  createdAt: new Date(2026, 10, 24).getTime(),
  endedAt: null,
  status: 'finished',
  playerColor: 'w',
  level: 'medium',
  botElo: 1200,
  result: '*',
  termination: null,
  moves: [],
  pgn: '',
  takebacks: 0,
  opening: null,
  analysis: null,
  analysisProgress: null,
  ...over,
});

describe('game end', () => {
  it("detects fool's mate", () => {
    expect(detectEnd(replay(['f2f3', 'e7e5', 'g2g4', 'd8h4']))).toEqual({ result: '0-1', termination: 'checkmate' });
  });
  it('detects stalemate', () => {
    const c = replay([]);
    c.load('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(detectEnd(c)).toEqual({ result: '1/2-1/2', termination: 'stalemate' });
  });
  it('detects threefold repetition', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    expect(detectEnd(replay([...shuffle, ...shuffle]))?.termination).toBe('repetition');
  });
  it('detects insufficient material', () => {
    const c = replay([]);
    c.load('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
    expect(detectEnd(c)?.termination).toBe('insufficient');
  });
  it('goes on otherwise', () => {
    expect(detectEnd(replay(['e2e4']))).toBeNull();
  });
  it('rejects illegal moves', () => {
    expect(tryMove(replay([]), 'e2e5')).toBeNull();
  });
});

describe('result text', () => {
  it('reads from the player side', () => {
    expect(resultText('1-0', 'checkmate', 'w')).toBe('You won by checkmate');
    expect(resultText('1-0', 'checkmate', 'b')).toBe('You lost by checkmate');
    expect(resultText('0-1', 'resign', 'w')).toBe('You resigned');
    expect(resultText('1/2-1/2', 'repetition', 'w')).toBe('Draw by repetition');
  });
});

describe('PGN', () => {
  it('has the headers from SPEC.md', () => {
    const pgn = buildPgn(
      game({
        moves: ['e2e4', 'e7e5'],
        result: '0-1',
        termination: 'resign',
        opening: { eco: 'C20', name: "King's Pawn Game", family: "King's Pawn Game" },
      }),
    );
    expect(pgn).toContain('[Event "Walnut vs Bot"]');
    expect(pgn).toContain('[Site "Walnut"]');
    expect(pgn).toContain('[Date "2026.11.24"]');
    expect(pgn).toContain('[White "You"]');
    expect(pgn).toContain('[Black "Bot Medium"]');
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toContain('[BotLevel "Medium"]');
    expect(pgn).toContain('[ECO "C20"]');
    expect(pgn.trim().endsWith('1. e4 e5 0-1')).toBe(true);
  });
});

describe('openings', () => {
  const table: OpeningTable = {
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -': { eco: 'B00', name: "King's Pawn Game" },
    'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -': { eco: 'C50', name: 'Italian Game' },
  };
  it('finds the deepest named position', () => {
    const c = replay(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3']);
    const fens = c.history({ verbose: true }).map((m) => m.after);
    expect(findOpening(table, fens)?.name).toBe('Italian Game');
    expect(findOpening(table, fens.slice(0, 2))?.eco).toBe('B00');
    expect(findOpening(table, [])).toBeNull();
  });
  it('takes the family before the colon', () => {
    expect(openingFamily('Italian Game: Giuoco Pianissimo')).toBe('Italian Game');
  });
});

describe('move announcements', () => {
  it('reads naturally', () => {
    const c = replay(['e2e4', 'g8f6']);
    expect(describeMove('Bot', c.history({ verbose: true })[1])).toBe('Bot played knight to f6');
  });
});
