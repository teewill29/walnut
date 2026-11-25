import { useSyncExternalStore } from 'react';
import { epd } from '../chess/game';
import { loadOpenings, type OpeningTable } from '../chess/openings';
import { db } from '../db/schema';
import type { Game } from '../db/types';
import { ANALYSIS_VERSION } from './analysisConfig';
import { runAnalysis } from './analyze';
import { getEngine } from './EngineManager';
import { ENGINE_URL } from './files';

// Runs analysis in the background, one game at a time (DATA_MODEL.md → Analysis queue).
// Progress is saved after every position, so a closed app resumes where it stopped.

export interface AnalysisStatus {
  gameId: string;
  done: number;
  total: number;
}

class AnalysisQueue {
  private queue: string[] = [];
  private running = false;
  private listeners = new Set<() => void>();
  status: AnalysisStatus | null = null;
  error: string | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Analyze this game next (ahead of others waiting). */
  enqueue(gameId: string, front = false) {
    if (this.status?.gameId === gameId) return;
    this.queue = this.queue.filter((id) => id !== gameId);
    if (front) this.queue.unshift(gameId);
    else this.queue.push(gameId);
    this.pump();
  }

  /** On launch: finish any analysis that was interrupted. */
  async resumeAll() {
    try {
      const partial = await db.games
        .where('status')
        .equals('finished')
        .filter((g) => g.analysisProgress !== null)
        .sortBy('createdAt');
      partial.reverse().forEach((g) => this.enqueue(g.id));
    } catch (e) {
      console.error('Could not look for unfinished analysis', e);
    }
  }

  private async pump() {
    if (this.running) return;
    const id = this.queue.shift();
    if (!id) return;
    this.running = true;
    try {
      await this.analyze(id);
      this.error = null;
    } catch (e) {
      console.error('Analysis failed', e);
      this.error = "Analysis stopped. It will pick up again next time you open the app.";
    } finally {
      this.status = null;
      this.running = false;
      this.emit();
      this.pump();
    }
  }

  private async analyze(id: string) {
    const game: Game | undefined = await db.games.get(id);
    if (!game || game.status !== 'finished') return;
    if (game.analysis?.version === ANALYSIS_VERSION && !game.analysisProgress) return;

    let table: OpeningTable = {};
    try {
      table = await loadOpenings();
    } catch {
      // Without the opening table no move is tagged Book; everything else still works.
    }
    const progress = game.analysisProgress?.version === ANALYSIS_VERSION ? game.analysisProgress.positions : [];
    const total = game.moves.length + 1;
    this.status = { gameId: id, done: progress.length, total };
    this.emit();

    const analysis = await runAnalysis(getEngine(ENGINE_URL), game, {
      done: progress,
      inBook: (fen) => !!table[epd(fen)],
      onProgress: async (positions) => {
        await db.games.update(id, { analysisProgress: { version: ANALYSIS_VERSION, positions: [...positions] } });
        this.status = { gameId: id, done: positions.length, total };
        this.emit();
      },
    });
    await db.games.update(id, { analysis, analysisProgress: null });
  }
}

export const analysisQueue = new AnalysisQueue();

export function useAnalysisStatus(): AnalysisStatus | null {
  return useSyncExternalStore(analysisQueue.subscribe, () => analysisQueue.status);
}
