import { useEffect } from 'react';
import { DesktopHeader, TabBar, TopBar } from './components/Shell';
import { UpdateToast } from './components/UpdateToast';
import { controller } from './chess/controller';
import { db } from './db/schema';
import { requestPersistentStorage } from './db/persist';
import { navState, SETTINGS_PATH, tabFor, usePath, type TabPath } from './lib/router';
import { HistoryScreen } from './screens/History';
import { PlayScreen } from './screens/Play';
import { ReviewScreen } from './screens/Review';
import { SettingsPanel } from './screens/Settings';

const SCREENS: Record<TabPath, () => React.JSX.Element> = {
  '/': PlayScreen,
  '/review': ReviewScreen,
  '/history': HistoryScreen,
};

export function App() {
  const path = usePath();
  const settingsOpen = path === SETTINGS_PATH;
  // With Settings open, keep showing the tab it was opened from (behind the desktop modal).
  const tab = settingsOpen ? (navState().behind ?? '/') : tabFor(path);
  const Screen = SCREENS[tab];

  useEffect(() => {
    db.open().catch((err) => console.error('Could not open the database', err));
    requestPersistentStorage();
    // Resume or start the game at launch, so the bot moves even if the app opens on another tab.
    controller.start();
  }, []);

  return (
    <div className="app">
      <DesktopHeader path={path} tab={tab} settingsOpen={settingsOpen} />
      <TopBar path={path} tab={tab} settingsOpen={settingsOpen} />
      <main className="screen" inert={settingsOpen}>
        <Screen />
      </main>
      <TabBar tab={tab} settingsOpen={settingsOpen} />
      {settingsOpen && <SettingsPanel />}
      <UpdateToast />
    </div>
  );
}
