import { useSyncExternalStore } from 'react';

// A tiny path router: three tabs plus Settings don't need a library.

export type TabPath = '/' | '/review' | '/history';
export const SETTINGS_PATH = '/settings';

interface NavState {
  // The tab that was showing when Settings opened (shown behind the desktop modal).
  behind?: TabPath;
  // True when we pushed this entry ourselves, so "back" stays inside the app.
  inApp?: boolean;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const getPath = () => window.location.pathname;

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/');
}

export function navState(): NavState {
  return (window.history.state as NavState | null) ?? {};
}

export function navigate(path: string, opts: { replace?: boolean; state?: NavState } = {}) {
  if (path === getPath() && !opts.state) return;
  const state: NavState = { inApp: true, ...opts.state };
  if (opts.replace) window.history.replaceState(state, '', path);
  else window.history.pushState(state, '', path);
  notify();
}

export function tabFor(path: string): TabPath {
  if (path.startsWith('/review')) return '/review';
  if (path.startsWith('/history')) return '/history';
  return '/';
}

export function openSettings(from: string) {
  if (from === SETTINGS_PATH) return;
  navigate(SETTINGS_PATH, { state: { behind: tabFor(from) } });
}

export function closeSettings() {
  const { inApp, behind } = navState();
  if (inApp) window.history.back();
  else navigate(behind ?? '/', { replace: true });
}
