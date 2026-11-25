import type { Level } from '../db/types';

// Bot levels (docs/ENGINE.md §2).
//
// STARTING VALUES. Tune these during Phase 1 calibration (3 games per level) and
// record the final values and the reasoning here.
// Target: Easy = Teewill wins most games; Medium = a real fight;
//         Hard = he mostly loses; Chessmaster = he never wins.
//
// Calibration log:
//   (none yet)

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
    method: { kind: 'multipv', depth: 6, multiPv: 5, temperature: 2.0, blunderChance: 0.15 },
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    nominalElo: 1200,
    eloLabel: '~1200 Elo',
    method: { kind: 'multipv', depth: 8, multiPv: 4, temperature: 0.8, blunderChance: 0.05 },
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
