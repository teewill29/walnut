import { parseBestMove, parseInfo, type InfoLine } from './uci';

// One Stockfish Web Worker, owned here (CLAUDE.md rule 3). Requests are queued and run one
// at a time. Bot moves go before analysis: analysis finishes the position it's on, then waits.

export interface WorkerLike {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent | Event) => void) | null;
}

export type Priority = 'bot' | 'analysis';

export interface SearchRequest {
  fen: string;
  go: string; // e.g. "depth 8" or "movetime 800"
  multiPv: number;
  limitElo?: number; // sets UCI_LimitStrength + UCI_Elo
  priority: Priority;
  signal?: AbortSignal;
}

export interface SearchResult {
  bestmove: string | null;
  lines: InfoLine[]; // final line per MultiPV slot, best first
}

export class EngineAbortedError extends Error {
  constructor() {
    super('Engine request cancelled');
    this.name = 'AbortError';
  }
}

interface Job {
  priority: Priority;
  run: () => void;
  reject: (e: unknown) => void;
  signal?: AbortSignal;
}

export class EngineManager {
  private worker: WorkerLike | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private running: Job | null = null;
  private lineHandler: ((line: string) => void) | null = null;
  private failure: Error | null = null;

  constructor(private createWorker: () => WorkerLike) {}

  /** Starts the worker early so the first bot move doesn't wait for the download. */
  warmUp(): Promise<void> {
    return this.init();
  }

  search(req: SearchRequest): Promise<SearchResult> {
    return this.enqueue<SearchResult>(req.priority, req.signal, (resolve, reject) => {
      const lines = new Map<number, InfoLine>();
      let aborted = false;
      const onAbort = () => {
        aborted = true;
        this.send('stop'); // the engine still answers with bestmove; wait for it before the next job
      };
      req.signal?.addEventListener('abort', onAbort, { once: true });

      this.lineHandler = (line) => {
        const info = parseInfo(line);
        if (info) {
          lines.set(info.multipv, info);
          return;
        }
        const best = parseBestMove(line);
        if (best === undefined) return;
        req.signal?.removeEventListener('abort', onAbort);
        if (aborted) reject(new EngineAbortedError());
        else resolve({ bestmove: best, lines: [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l) });
      };

      // Options stick between requests, so every request sets all of them.
      this.send(`setoption name MultiPV value ${req.multiPv}`);
      this.send('setoption name Skill Level value 20');
      if (req.limitElo) {
        this.send('setoption name UCI_LimitStrength value true');
        this.send(`setoption name UCI_Elo value ${req.limitElo}`);
      } else {
        this.send('setoption name UCI_LimitStrength value false');
      }
      this.send(`position fen ${req.fen}`);
      this.send(`go ${req.go}`);
    });
  }

  /** Sends `ucinewgame` (between games), queued ahead of analysis. */
  newGame(): Promise<void> {
    return this.enqueue<void>('bot', undefined, (resolve) => {
      this.lineHandler = (line) => {
        if (line === 'readyok') resolve();
      };
      this.send('ucinewgame');
      this.send('isready');
    });
  }

  /** After a failure: drop the dead worker so the next request starts a fresh one. */
  reset() {
    this.terminate();
    this.failure = null;
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    const err = new EngineAbortedError();
    this.running?.reject(err);
    this.queue.forEach((j) => j.reject(err));
    this.queue = [];
    this.running = null;
  }

  private init(): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let worker: WorkerLike;
      try {
        worker = this.createWorker();
      } catch (e) {
        reject(this.fail(e));
        return;
      }
      this.worker = worker;
      let stage: 'uci' | 'ready' | 'done' = 'uci';
      worker.onerror = (e) => {
        const err = this.fail((e as ErrorEvent).message || 'The chess engine failed to load');
        if (stage !== 'done') reject(err);
      };
      worker.onmessage = (e) => {
        const line = String(e.data);
        if (stage === 'uci' && line === 'uciok') {
          stage = 'ready';
          this.send('setoption name Hash value 32');
          this.send('setoption name Threads value 1');
          this.send('isready');
        } else if (stage === 'ready' && line === 'readyok') {
          stage = 'done';
          resolve();
        } else if (stage === 'done') {
          this.lineHandler?.(line);
        }
      };
      this.send('uci');
    });
    return this.ready;
  }

  private fail(e: unknown): Error {
    this.failure = e instanceof Error ? e : new Error(String(e));
    const err = this.failure;
    this.running?.reject(err);
    this.queue.forEach((j) => j.reject(err));
    this.queue = [];
    this.running = null;
    return err;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private enqueue<T>(
    priority: Priority,
    signal: AbortSignal | undefined,
    start: (resolve: (v: T) => void, reject: (e: unknown) => void) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new EngineAbortedError());
        return;
      }
      const job: Job = {
        priority,
        signal,
        reject,
        run: () =>
          start(
            (v) => this.finish(job, () => resolve(v)),
            (e) => this.finish(job, () => reject(e)),
          ),
      };
      signal?.addEventListener(
        'abort',
        () => {
          const i = this.queue.indexOf(job);
          if (i >= 0) {
            this.queue.splice(i, 1);
            reject(new EngineAbortedError());
          }
        },
        { once: true },
      );
      this.queue.push(job);
      this.init().then(
        () => this.pump(),
        (e) => reject(e),
      );
    });
  }

  private finish(job: Job, settle: () => void) {
    if (this.running !== job) return;
    this.running = null;
    this.lineHandler = null;
    settle();
    this.pump();
  }

  private pump() {
    if (this.running || !this.worker) return;
    const i = this.queue.findIndex((j) => j.priority === 'bot');
    const next = i >= 0 ? this.queue.splice(i, 1)[0] : this.queue.shift();
    if (!next) return;
    this.running = next;
    next.run();
  }
}

let shared: EngineManager | null = null;

/** The app's one engine. */
export function getEngine(url: string): EngineManager {
  if (!shared) shared = new EngineManager(() => new Worker(url) as unknown as WorkerLike);
  return shared;
}
