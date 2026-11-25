import { useEffect, useState } from 'react';
import { BackIcon, CloseIcon } from '../components/Icons';
import { APP_NAME } from '../config';
import { getPersistState, type PersistState } from '../db/persist';
import { closeSettings } from '../lib/router';
import { isStandalone } from '../lib/display';

const STORAGE_TEXT: Record<PersistState, string> = {
  persisted: "Protected. The browser won't clear your games to free up space.",
  'not-persisted':
    'Not protected yet. The browser could clear data if the device runs low on space, so back up your games once that option arrives.',
  unsupported: "This browser can't protect storage, so back up your games once that option arrives.",
};

const buildDate = new Date(__BUILD_TIME__).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// A full page on phone and tablet, a modal on desktop (SPEC.md §4). The CSS decides which.
export function SettingsPanel() {
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    getPersistState().then(setPersist);
  }, []);

  useEffect(() => {
    // Focus the visible close control, restore focus to the gear on close.
    const firstVisible = (sel: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(sel)).find((el) => el.offsetParent !== null);
    firstVisible('[data-settings-close]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      firstVisible('[data-settings-trigger]')?.focus();
    };
  }, []);

  return (
    <div className="settings-layer">
      <div className="settings-backdrop" onClick={closeSettings} aria-hidden="true" />
      <div className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-head">
          <button
            type="button"
            className="icon-btn settings-back"
            aria-label="Back"
            data-settings-close
            onClick={closeSettings}
          >
            <BackIcon />
          </button>
          <h1 id="settings-title" className="settings-title">
            Settings
          </h1>
          <button
            type="button"
            className="icon-btn settings-close"
            aria-label="Close settings"
            data-settings-close
            onClick={closeSettings}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="settings-body">
          <section className="card">
            <h2 className="card-title">Game</h2>
            <p className="muted">Sound, board and takeback options arrive with the features they control.</p>
          </section>

          <section className="card">
            <h2 className="card-title">About</h2>
            <dl className="about-list">
              <dt>Version</dt>
              <dd>
                {APP_NAME} {__APP_VERSION__} · built {buildDate}
              </dd>
              <dt>Running as</dt>
              <dd>{isStandalone() ? 'Home screen app' : 'Browser tab'}</dd>
              <dt>Storage</dt>
              <dd>{persist ? STORAGE_TEXT[persist] : 'Checking…'}</dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
