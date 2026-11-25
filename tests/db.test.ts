import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb, DB_VERSION, type WalnutDB } from '../src/db/schema';
import type { Game } from '../src/db/types';

let db: WalnutDB | undefined;

afterEach(async () => {
  if (db) await db.delete();
  db = undefined;
});

const sampleGame = (over: Partial<Game> = {}): Game => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  endedAt: null,
  status: 'in_progress',
  playerColor: 'w',
  level: 'medium',
  botElo: 1200,
  result: '*',
  termination: null,
  moves: ['e2e4', 'e7e5'],
  pgn: '1. e4 e5 *',
  takebacks: 0,
  opening: null,
  analysis: null,
  analysisProgress: null,
  ...over,
});

describe('Dexie schema v1', () => {
  it('opens at the current version with both tables and the documented indexes', async () => {
    db = createDb('walnut-test-schema');
    await db.open();
    expect(db.verno).toBe(DB_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['games', 'settings']);

    const games = db.table('games').schema;
    expect(games.primKey.name).toBe('id');
    expect(games.indexes.map((i) => i.name).sort()).toEqual(
      ['[status+createdAt]', 'createdAt', 'level', 'playerColor', 'result', 'status'].sort(),
    );
    expect(db.table('settings').schema.primKey.name).toBe('key');
  });

  it('stores a game and finds it by status and creation time', async () => {
    db = createDb('walnut-test-roundtrip');
    const older = sampleGame({ status: 'finished', createdAt: 1000, result: '1-0' });
    const newer = sampleGame({ status: 'finished', createdAt: 2000, result: '0-1' });
    const live = sampleGame({ status: 'in_progress', createdAt: 3000 });
    await db.games.bulkAdd([older, newer, live]);

    const finished = await db.games
      .where('[status+createdAt]')
      .between(['finished', 0], ['finished', Infinity])
      .reverse()
      .toArray();
    expect(finished.map((g) => g.id)).toEqual([newer.id, older.id]);
    expect(await db.games.get(live.id)).toEqual(live);
  });

  it('stores settings by key', async () => {
    db = createDb('walnut-test-settings');
    await db.settings.put({ key: 'sound', value: false });
    expect((await db.settings.get('sound'))?.value).toBe(false);
  });
});
