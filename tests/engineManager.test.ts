import { describe, expect, it } from 'vitest';
import { EngineManager, type WorkerLike } from '../src/engine/EngineManager';

// A fake Stockfish: answers the handshake, and answers each `go` with a bestmove
// when the test says so (or immediately on `stop`).
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sent: string[] = [];
  pendingGo: string | null = null;
  postMessage(cmd: string) {
    this.sent.push(cmd);
    const reply = (s: string) => queueMicrotask(() => this.onmessage?.({ data: s } as MessageEvent));
    if (cmd === 'uci') reply('uciok');
    else if (cmd === 'isready') reply('readyok');
    else if (cmd.startsWith('go')) this.pendingGo = cmd;
    else if (cmd === 'stop' && this.pendingGo) this.answer('a1a1');
  }
  answer(move: string, info = 'info depth 1 multipv 1 score cp 10 pv ' + move) {
    this.pendingGo = null;
    queueMicrotask(() => {
      this.onmessage?.({ data: info } as MessageEvent);
      this.onmessage?.({ data: `bestmove ${move}` } as MessageEvent);
    });
  }
  terminate() {}
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('EngineManager', () => {
  it('sets every option on each request and returns the lines', async () => {
    const w = new FakeWorker();
    const em = new EngineManager(() => w);
    const p = em.search({ fen: FEN, go: 'movetime 800', multiPv: 1, limitElo: 1700, priority: 'bot' });
    await tick();
    expect(w.sent).toContain('setoption name UCI_LimitStrength value true');
    expect(w.sent).toContain('setoption name UCI_Elo value 1700');
    expect(w.sent).toContain('setoption name MultiPV value 1');
    expect(w.sent).toContain('setoption name Hash value 32');
    w.answer('e2e4');
    const res = await p;
    expect(res.bestmove).toBe('e2e4');
    expect(res.lines[0].cp).toBe(10);
  });

  it('runs a queued bot move before queued analysis', async () => {
    const w = new FakeWorker();
    const em = new EngineManager(() => w);
    const order: string[] = [];
    const a1 = em.search({ fen: FEN, go: 'depth 14', multiPv: 1, priority: 'analysis' }).then(() => order.push('a1'));
    await tick();
    const a2 = em.search({ fen: FEN, go: 'depth 14', multiPv: 1, priority: 'analysis' }).then(() => order.push('a2'));
    const bot = em.search({ fen: FEN, go: 'depth 8', multiPv: 4, priority: 'bot' }).then(() => order.push('bot'));
    await tick();
    w.answer('e2e4'); // finishes a1 (already running)
    await tick();
    w.answer('d2d4'); // bot
    await tick();
    w.answer('c2c4'); // a2
    await Promise.all([a1, a2, bot]);
    expect(order).toEqual(['a1', 'bot', 'a2']);
  });

  it('cancels a running search with stop and waits for its bestmove before the next job', async () => {
    const w = new FakeWorker();
    const em = new EngineManager(() => w);
    const ctrl = new AbortController();
    const p = em.search({ fen: FEN, go: 'depth 8', multiPv: 1, priority: 'bot', signal: ctrl.signal });
    await tick();
    ctrl.abort();
    await expect(p).rejects.toThrow('cancelled');
    expect(w.sent).toContain('stop');
    const next = em.search({ fen: FEN, go: 'depth 8', multiPv: 1, priority: 'bot' });
    await tick();
    w.answer('g1f3');
    expect((await next).bestmove).toBe('g1f3');
  });

  it('drops a queued search that is cancelled before it starts', async () => {
    const w = new FakeWorker();
    const em = new EngineManager(() => w);
    const first = em.search({ fen: FEN, go: 'depth 8', multiPv: 1, priority: 'bot' });
    const ctrl = new AbortController();
    const second = em.search({ fen: FEN, go: 'depth 8', multiPv: 1, priority: 'bot', signal: ctrl.signal });
    ctrl.abort();
    await expect(second).rejects.toThrow('cancelled');
    await tick();
    w.answer('e2e4');
    expect((await first).bestmove).toBe('e2e4');
    expect(w.sent.filter((s) => s.startsWith('go')).length).toBe(1);
  });
});
