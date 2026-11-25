import { defineConfig } from 'vitest/config';

// Tests that run real Stockfish in Node (npm run test:engine). Kept out of `npm test`
// so the normal run stays fast.
export default defineConfig({
  test: {
    include: ['tests/engine/**/*.test.ts'],
    environment: 'node',
    // Separate processes, not worker threads: inside a worker thread the Stockfish build
    // thinks it's a browser Web Worker and never answers.
    pool: 'forks',
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 60 * 1000,
  },
});
