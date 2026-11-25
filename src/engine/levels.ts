import type { Level } from '../db/types';

// Bot levels (docs/ENGINE.md §2).
//
// STARTING VALUES. Tune these during Phase 1 calibration (3 games per level) and
// record the final values and the reasoning here.
// Target: Easy = Teewill wins most games; Medium = a real fight;
//         Hard = he mostly loses; Chessmaster = he never wins.
//
// Calibration log:
//   2026-11-25, round 1. ENGINE.md starting values: Easy depth 6 / MultiPV 5 / temp 2.0 /
//     blunder 0.15; Medium depth 8 / MultiPV 4 / temp 0.8 / blunder 0.05.
//     Teewill (1 game each): won Easy but it took a long grind; lost badly to Medium; Hard
//     felt easier than Medium. Bot-vs-bot (npm run calibrate): Medium beat Hard 4.5–1.5 in
//     6 games. Medium was stronger than Hard, so both MultiPV levels were weakened:
//     Easy → depth 4 / MultiPV 5 / temp 2.5 / blunder 0.20
//     Medium → depth 5 / MultiPV 5 / temp 1.5 / blunder 0.08
//     Bot-vs-bot with the new values (6 games each): Medium beat Easy 5–1, Hard beat
//     Medium 5.5–0.5. Order is now Easy < Medium < Hard. Next: Teewill's own games.

export type BotMethod =
  | { kind: 'multipv'; depth: number; multiPv: number; temperature: number; blunderChance: number }
  | { kind: 'limit'; elo: number; movetimeMs: number }
  | { kind: 'full'; movetimeMs: number };

export interface LevelConfig {
  id: Level;
  label: string;
  nominalElo: number; // for stats (performance rating)
  eloLabel: string; // shown in the UI
  method: BotMethod;
}

export const LEVELS: Record<Level, LevelConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    nominalElo: 800,
    eloLabel: '~800 Elo',
    method: { kind: 'multipv', depth: 4, multiPv: 5, temperature: 2.5, blunderChance: 0.2 },
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    nominalElo: 1200,
    eloLabel: '~1200 Elo',
    method: { kind: 'multipv', depth: 5, multiPv: 5, temperature: 1.5, blunderChance: 0.08 },
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    nominalElo: 1700,
    eloLabel: '~1700 Elo',
    method: { kind: 'limit', elo: 1700, movetimeMs: 800 },
  },
  chessmaster: {
    id: 'chessmaster',
    label: 'Chessmaster',
    nominalElo: 3000,
    eloLabel: 'Full strength',
    method: { kind: 'full', movetimeMs: 1500 },
  },
};

export const LEVEL_ORDER: Level[] = ['easy', 'medium', 'hard', 'chessmaster'];

// The bot never moves faster than this, even on Easy, so moves don't snap in instantly.
export const MIN_BOT_THINK_MS = 400;
