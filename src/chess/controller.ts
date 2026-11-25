import { Chess, type Move, type Square } from 'chess.js';
import { useSyncExternalStore } from 'react';
import { db } from '../db/schema';
import { getSettings, loadSettings, setSetting, type SideChoice } from '../db/settings';
import type { Color, Game, Level, Opening, Termination, GameResult } from '../db/types';
import { ANALYSIS_VERSION } from '../engine/analysisConfig';
import { chooseBotMove } from '../engine/botMove';
import { EngineAbortedError, getEngine } from '../engine/EngineManager';
import { ENGINE_URL } from '../engine/files';
import { LEVELS, MIN_BOT_THINK_MS } from '../engine/levels';
import { buildPgn, describeMove, detectEnd, replay, resignResult, resultText, tryMove } from './game';
import { findOpening, loadOpenings, type OpeningTable } from './openings';

// The game being played: one chess.js instance rebuilt from the saved UCI moves.
// Lives outside React so the bot keeps thinking while you're on another tab.

export interface PlayState {
  loading: boolean;
  game: Game | null;
  fen: string;
  sans: string[];
  lastMove: { from: Square; to: Square } | null;
  checkSquare: Square | null;
  turn: Color;
  botThinking: boolean;
  flipped: boolean;
  opening: Opening | null;
  /** Set when the game has ended. */
  over: { text: string } | null;
  overPanelOpen: boolean;
  engineError: string | null;
  /** Latest move, for the screen-reader announcement. */
  announcement: string;
}

const START_FEN = new Chess().fen();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const engine = () => getEngine(ENGINE_URL);

class GameController {
  private chess = new Chess();
  private openings: OpeningTable | null = null;
  private botAbort: AbortController | null = null;
  private saving: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private started = false;

  state: PlayState = {
    loading: true,
    game: null,
    fen: START_FEN,
    sans: [],
    lastMove: null,
    checkSquare: null,
    turn: 'w',
    botThinking: false,
    flipped: false,
    opening: null,
    over: null,
    overPanelOpen: false,
    engineError: null,
    announcement: '',
  };

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(patch: Partial<PlayState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Resume the in-progress game, or start one. Safe to call more than once. */
  async start() {
    if (this.started) return;
    this.started = true;
    await loadSettings();
    engine()
      .warmUp()
      .catch((e) => this.set({ engineError: friendlyEngineError(e) }));
    loadOpenings()
      .then((t) => {
        this.openings = t;
        this.refresh();
      })
      .catch((e) => console.warn('Opening names unavailable', e));

    let game: Game | undefined;
    try {
      game = await db.games.where('status').equals('in_progress').first();
    } catch (e) {
      console.error('Could not read saved games', e);
    }
    if (game) {
      try {
        this.chess = replay(game.moves);
      } catch (e) {
        // A saved move that chess.js rejects shouldn't happen; keep the row, start fresh.
        console.error('Could not rebuild the saved game', e);
        game = undefined;
      }
    }
    if (game) {
      this.state = { ...this.state, game };
      this.refresh({ loading: false });
      this.maybeBotMove();
    } else {
      await this.createGame(getSettings().lastLevel, getSettings().lastSide);
    }
  }

  get player(): Color {
    return this.state.game?.playerColor ?? 'w';
  }

  /** True when starting a new game would abandon one with moves in it. */
  get hasGameInProgress(): boolean {
    const g = this.state.game;
    return !!g && g.status === 'in_progress' && g.moves.length > 0;
  }

  get canTakeBack(): boolean {
    const g = this.state.game;
    if (!g || g.status !== 'in_progress' || !getSettings().allowTakebacks) return false;
    // There must be a move of yours to undo.
    const yourMoves = this.chess.history({ verbose: true }).filter((m) => m.color === g.playerColor);
    return yourMoves.length > 0;
  }

  /** Your move from the board. Returns false if it isn't legal or it isn't your turn. */
  playerMove(uci: string): boolean {
    const g = this.state.game;
    if (!g || g.status !== 'in_progress' || this.state.botThinking) return false;
    if (this.chess.turn() !== g.playerColor) return false;
    const m = tryMove(this.chess, uci);
    if (!m) return false;
    this.afterPly(m, 'You');
    return true;
  }

  takeBack() {
    if (!this.canTakeBack) return;
    const g = this.state.game!;
    if (this.state.botThinking || this.chess.turn() !== g.playerColor) {
      this.cancelBot();
      this.chess.undo(); // your move; the bot hadn't replied
    } else {
      this.chess.undo(); // the bot's reply
      this.chess.undo(); // your move
    }
    const moves = g.moves.slice(0, this.chess.history().length);
    this.state = { ...this.state, game: { ...g, moves, takebacks: g.takebacks + 1 } };
    this.refresh({ announcement: 'Move taken back' });
    this.save();
    this.maybeBotMove();
  }

  resign() {
    const g = this.state.game;
    if (!g || g.status !== 'in_progress') return;
    this.cancelBot();
    this.finish(resignResult(g.playerColor), 'resign');
  }

  async newGame(level: Level, side: SideChoice) {
    this.cancelBot();
    await setSetting('lastLevel', level);
    await setSetting('lastSide', side);
    await this.createGame(level, side);
  }

  flip() {
    this.set({ flipped: !this.state.flipped });
  }

  setOverPanelOpen(open: boolean) {
    this.set({ overPanelOpen: open });
  }

  private async createGame(level: Level, side: SideChoice) {
    const old = this.state.game;
    const playerColor: Color = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
    const now = Date.now();
    let game: Game = {
      id: crypto.randomUUID(),
      createdAt: now,
      endedAt: null,
      status: 'in_progress',
      playerColor,
      level,
      botElo: LEVELS[level].nominalElo,
      result: '*',
      termination: null,
      moves: [],
      pgn: '',
      takebacks: 0,
      opening: null,
      analysis: null,
      analysisProgress: null,
    };
    if (old && old.status === 'in_progress') {
      if (old.moves.length > 0) {
        // Abandoned games are kept, with result * and out of all stats (SPEC.md §1).
        const abandoned: Game = {
          ...old,
          status: 'abandoned',
          result: '*',
          termination: 'abandoned',
          endedAt: now,
          opening: this.state.opening,
        };
        abandoned.pgn = buildPgn(abandoned);
        this.save(abandoned);
      } else {
        // A game with no moves isn't a game yet: reuse its row.
        game = { ...game, id: old.id };
      }
    }
    this.chess = new Chess();
    this.state = { ...this.state, game, flipped: false, over: null, overPanelOpen: false };
    this.refresh({ loading: false, announcement: `New game. You play ${playerColor === 'w' ? 'White' : 'Black'}.` });
    this.save();
    engine()
      .newGame()
      .catch(() => {});
    this.maybeBotMove();
  }

  private afterPly(m: Move, who: 'You' | 'Bot') {
    const g = this.state.game!;
    const uci = m.from + m.to + (m.promotion ?? '');
    this.state = { ...this.state, game: { ...g, moves: [...g.moves, uci] } };
    this.refresh({ announcement: describeMove(who, m) });
    const end = detectEnd(this.chess);
    if (end) {
      this.finish(end.result, end.termination);
      return;
    }
    this.save();
    this.maybeBotMove();
  }

  private finish(result: GameResult, termination: Termination) {
    const g = this.state.game!;
    const done: Game = {
      ...g,
      status: 'finished',
      result,
      termination,
      endedAt: Date.now(),
      opening: this.state.opening,
      // Analysis (Phase 2) picks this up and resumes it on launch.
      analysisProgress: { version: ANALYSIS_VERSION, positions: [] },
    };
    done.pgn = buildPgn(done);
    const text = resultText(result, termination, g.playerColor);
    this.state = { ...this.state, game: done, botThinking: false };
    this.refresh({ over: { text }, overPanelOpen: true, announcement: text });
    this.save();
  }

  private async maybeBotMove() {
    const g = this.state.game;
    if (!g || g.status !== 'in_progress' || this.chess.turn() === g.playerColor || this.state.botThinking) return;
    const ctrl = new AbortController();
    this.botAbort = ctrl;
    const gameId = g.id;
    const ply = this.chess.history().length;
    const fen = this.chess.fen();
    const startedAt = performance.now();
    this.set({ botThinking: true });
    try {
      const uci = await chooseBotMove(engine(), fen, g.level, ctrl.signal);
      const wait = MIN_BOT_THINK_MS - (performance.now() - startedAt);
      if (wait > 0) await sleep(wait);
      if (ctrl.signal.aborted || this.state.game?.id !== gameId || this.chess.history().length !== ply) return;
      this.botAbort = null;
      this.state = { ...this.state, botThinking: false, engineError: null };
      const m = tryMove(this.chess, uci);
      if (m) this.afterPly(m, 'Bot');
      else this.refresh();
    } catch (e) {
      if (e instanceof EngineAbortedError || ctrl.signal.aborted) return;
      console.error('Bot move failed', e);
      this.botAbort = null;
      this.set({ botThinking: false, engineError: friendlyEngineError(e) });
    }
  }

  /** After an engine error: try the bot's move again. */
  retryBot() {
    this.set({ engineError: null });
    engine().reset();
    this.maybeBotMove();
  }

  private cancelBot() {
    this.botAbort?.abort();
    this.botAbort = null;
    if (this.state.botThinking) this.state = { ...this.state, botThinking: false };
  }

  /** Recompute everything derived from the chess.js position. */
  private refresh(patch: Partial<PlayState> = {}) {
    const history = this.chess.history({ verbose: true });
    const last = history[history.length - 1];
    let checkSquare: Square | null = null;
    if (this.chess.inCheck()) {
      checkSquare = this.chess.findPiece({ type: 'k', color: this.chess.turn() })[0] ?? null;
    }
    const opening = this.openings
      ? findOpening(
          this.openings,
          history.map((m) => m.after),
        )
      : this.state.opening;
    this.set({
      fen: this.chess.fen(),
      sans: history.map((m) => m.san),
      lastMove: last ? { from: last.from, to: last.to } : null,
      checkSquare,
      turn: this.chess.turn(),
      opening,
      ...patch,
    });
  }

  /** Writes the game (or another row) to IndexedDB, in order, without blocking the UI. */
  private save(row?: Game) {
    const g = row ?? this.state.game;
    if (!g) return;
    const copy = structuredClone(g);
    this.saving = this.saving
      .then(() => db.games.put(copy))
      .catch((e) => console.error('Could not save the game', e));
  }
}

function friendlyEngineError(e: unknown): string {
  console.error(e);
  return "The chess engine didn't start. Check your connection and try again.";
}

export const controller = new GameController();

export function usePlay(): PlayState {
  return useSyncExternalStore(controller.subscribe, () => controller.state);
}
