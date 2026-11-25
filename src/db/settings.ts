import { useSyncExternalStore } from 'react';
import type { Level } from './types';
import { db } from './schema';

// Key–value settings (DATA_MODEL.md), cached in memory so screens read them synchronously.

export type SideChoice = 'w' | 'random' | 'b';

export interface Settings {
  sound: boolean;
  legalDots: boolean;
  coordinates: boolean;
  confirmResign: boolean;
  allowTakebacks: boolean;
  pieceStyle: string;
  lastLevel: Level;
  lastSide: SideChoice;
  includeTakebackGames: boolean;
  lastBackupAt: number | null;
  backupBannerDismissedAt: number | null;
  gamesAtLastBackup: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  legalDots: true,
  coordinates: true,
  confirmResign: true,
  allowTakebacks: true,
  pieceStyle: 'default',
  lastLevel: 'medium',
  lastSide: 'w',
  includeTakebackGames: false,
  lastBackupAt: null,
  backupBannerDismissedAt: null,
  gamesAtLastBackup: 0,
};

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

export async function loadSettings(): Promise<Settings> {
  try {
    const rows = await db.settings.toArray();
    const next = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const r of rows) if (r.key in next) next[r.key] = r.value;
    current = next as unknown as Settings;
    listeners.forEach((l) => l());
  } catch (e) {
    console.error('Could not load settings', e);
  }
  return current;
}

export const getSettings = () => current;

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current = { ...current, [key]: value };
  listeners.forEach((l) => l());
  await db.settings.put({ key, value });
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
