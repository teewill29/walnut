import { describe, expect, it } from 'vitest';
import { analyzeGame } from '../src/analysis/analyzeGame';
import type { Game, PositionEval } from '../src/db/types';
import { buildCoachExport } from '../src/export/coachExport';
import { formatEval, sanLine } from '../src/export/format';

const ev = (cp: number | null, mate: number | null, best: string | null, pv: string[] = best ? [best] : []): PositionEval => ({
  cp,
  mate,
  best,
  pv,
});

const base: Omit<Game, 'moves' | 'analysis' | 'result' | 'termination' | 'playerColor'> = {
  id: 'g1',
  createdAt: new Date(2026, 10, 24, 12).getTime(),
  endedAt: null,
  status: 'finished',
  level: 'medium',
  botElo: 1200,
  pgn: '',
  takebacks: 0,
  opening: null,
  analysisProgress: null,
};

describe('formatting', () => {
  it('formats evals from White’s view', () => {
    expect(formatEval(ev(80, null, null), 'w')).toBe('+0.8');
    expect(formatEval(ev(-320, null, null), 'w')).toBe('-3.2');
    expect(formatEval(ev(null, 3, null), 'w')).toBe('M3');
    expect(formatEval(ev(null, -2, null), 'b')).toBe('-M2');
    expect(formatEval(ev(null, 0, null), 'w')).toBe('-M0');
  });
  it('numbers lines that start on Black’s move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(sanLine(fen, 1, ['e7e5', 'g1f3', 'b8c6'])).toBe('1... e5 2. Nf3 Nc6');
  });
});

describe('Coach export', () => {
  it("matches EXPORT.md §1 for fool's mate", () => {
    const moves = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
    const positions = [
      ev(20, null, 'e2e4'),
      ev(-60, null, 'e7e5', ['e7e5', 'g1f3']),
      ev(-50, null, 'e2e4', ['e2e4', 'b8c6', 'b1c3']),
      ev(null, -1, 'd8h4', ['d8h4']),
      ev(null, 0, null),
    ];
    const game: Game = {
      ...base,
      moves,
      playerColor: 'w',
      result: '0-1',
      termination: 'checkmate',
      opening: { eco: 'A00', name: 'Barnes Opening: Fool’s Mate', family: 'Barnes Opening' },
      analysis: analyzeGame({ moves, positions, playerColor: 'w', result: '0-1', inBook: () => false, version: 1, depth: 14, now: 0 }),
    };
    expect(buildCoachExport(game)).toBe(
      [
        'WALNUT GAME EXPORT v1',
        'GAME: 2026-11-24 | Me (White) vs Bot Medium (~1200) | Result: 0-1 (checkmate, move 2)',
        'OPENING: A00 Barnes Opening: Fool’s Mate',
        // f3: drop 7.3 → 71.8; g4: drop 42.9 → 12.8; mean 42.3 → 42%
        'MY ACCURACY: 42% | Blunders 1 | Mistakes 0 | Inaccuracies 0',
        'TAKEBACKS: 0',
        'PGN: 1. f3 e5 2. g4 Qh4# 0-1',
        '',
        'TURNING POINT: Move 2 (White) g4 | BLUNDER | -0.5 -> -M1',
        '',
        'MY FLAGGED MOVES:',
        'Move 2 (White) | Played: g4 | BLUNDER | Eval: -0.5 -> -M1 | Phase: Opening',
        '  FEN: rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
        '  Best: e4 | Line: 2. e4 Nc6 3. Nc3',
        '',
        'BOT MISTAKES: None',
        '',
        'SUMMARY: Lost as White vs Medium. Biggest swing at move 2 (opening).',
      ].join('\n'),
    );
  });

  it('shows "Where I won it" with the bot’s punished mistake', () => {
    const moves = ['e2e4', 'g7g5', 'd2d4'];
    const positions = [ev(20, null, 'e2e4'), ev(30, null, 'e7e5'), ev(450, null, 'd2d4'), ev(460, null, 'f8g7')];
    const game: Game = {
      ...base,
      moves,
      playerColor: 'w',
      result: '1-0',
      termination: 'resign',
      analysis: analyzeGame({ moves, positions, playerColor: 'w', result: '1-0', inBook: () => false, version: 1, depth: 14, now: 0 }),
    };
    const text = buildCoachExport(game);
    expect(text).toContain('Result: 1-0 (resignation, move 2)');
    expect(text).toContain('WHERE I WON IT: Move 1 (Black) g5 | BLUNDER | +0.3 -> +4.5 | My reply: PUNISHED');
    expect(text).toContain('MY FLAGGED MOVES: None');
    expect(text).toContain('Move 1 (Black) | Played: g5 | BLUNDER | Eval: +0.3 -> +4.5 | My reply: d4 (PUNISHED)');
    expect(text).toContain('SUMMARY: Won as White vs Medium. Biggest swing at move 1 (opening).');
  });
});
