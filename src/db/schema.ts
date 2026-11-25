import Dexie, { type EntityTable } from 'dexie';
import type { Game, SettingRow } from './types';

export const DB_NAME = 'walnut';

// Every schema change needs a new db.version(n) block below, with an
// .upgrade() if existing rows must change. Never edit an old version in place:
// that's how saved games get lost.
export const DB_VERSION = 1;

export type WalnutDB = Dexie & {
  games: EntityTable<Game, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

export function createDb(name = DB_NAME): WalnutDB {
  const db = new Dexie(name) as WalnutDB;

  db.version(1).stores({
    games: 'id, createdAt, status, level, playerColor, result, [status+createdAt]',
    settings: 'key',
  });

  return db;
}

export const db = createDb();
