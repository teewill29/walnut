import { createRequire } from 'node:module';
import { EngineManager, type WorkerLike } from '../../src/engine/EngineManager';

const require = createRequire(import.meta.url);

/** The same Stockfish build the app ships (lite, single-threaded), running in Node. */
export function nodeEngine(): EngineManager {
  return new EngineManager(() => {
    const init = require('stockfish');
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      // Asynchronous like a real Web Worker: calling processCommand while the engine is
      // still printing its previous answer garbles the output.
      postMessage: (cmd: string) => void setImmediate(() => engine.processCommand(cmd)),
      // The Node build's terminate() exits the whole process; the test runner ends it instead.
      terminate: () => {},
    };
    const engine = init('lite-single', (line: string) => w.onmessage?.({ data: line } as MessageEvent));
    return w;
  });
}
