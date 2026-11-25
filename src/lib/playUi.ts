import { useSyncExternalStore } from 'react';

// Small UI state shared between the top bar's "New game" button and the Play screen.

let newGameOpen = false;
const listeners = new Set<() => void>();

export function setNewGameOpen(open: boolean) {
  newGameOpen = open;
  listeners.forEach((l) => l());
}

export function useNewGameOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => newGameOpen,
  );
}
