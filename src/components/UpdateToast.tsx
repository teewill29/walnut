import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60 * 1000;

// "Update ready · Reload" when a new version has been deployed (DESIGN.md → PWA).
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // We reload ourselves (see reload below), so the plugin's own reload is turned off.
    onNeedReload: () => {},
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // A home-screen app can stay open for days, so check for new versions now and then.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNeedRefresh(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [needRefresh, setNeedRefresh]);

  if (!needRefresh) return null;

  // The plugin only reloads if this page was already controlled by the service worker
  // when it opened, which isn't true on the very first visit. So: activate the new
  // version, reload once it takes over, and reload anyway if that takes too long.
  const reload = () => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', go, { once: true });
    setTimeout(go, 3000);
    updateServiceWorker(true);
  };

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>Update ready</span>
      <span className="toast-dot" aria-hidden="true">
        ·
      </span>
      <button type="button" className="toast-action" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
