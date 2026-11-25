import { APP_NAME, APP_TAGLINE } from '../config';
import { openSettings, type TabPath } from '../lib/router';
import { GearIcon, HistoryIcon, PlayIcon, ReviewIcon } from './Icons';
import { NavLink } from './NavLink';

const TABS: { path: TabPath; short: string; long: string; Icon: typeof PlayIcon }[] = [
  { path: '/', short: 'Play', long: 'Play', Icon: PlayIcon },
  { path: '/review', short: 'Review', long: 'Last game review', Icon: ReviewIcon },
  { path: '/history', short: 'History', long: 'History', Icon: HistoryIcon },
];

interface Props {
  path: string;
  tab: TabPath;
  settingsOpen: boolean;
}

function GearButton({ path, settingsOpen }: { path: string; settingsOpen: boolean }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Settings"
      aria-haspopup="dialog"
      aria-expanded={settingsOpen}
      data-settings-trigger
      onClick={() => openSettings(path)}
    >
      <GearIcon />
    </button>
  );
}

// Desktop (1024px and up): wordmark, top nav, gear.
export function DesktopHeader({ path, tab, settingsOpen }: Props) {
  return (
    <header className="desk-header">
      <div className="desk-brand">
        <span className="wordmark">{APP_NAME}</span>
        <span className="tagline">{APP_TAGLINE}</span>
      </div>
      <div className="desk-right">
        <nav className="desk-nav" aria-label="Main">
          {TABS.map((t) => (
            <NavLink key={t.path} to={t.path} active={tab === t.path && !settingsOpen} className="desk-nav-item">
              {t.long}
            </NavLink>
          ))}
        </nav>
        <GearButton path={path} settingsOpen={settingsOpen} />
      </div>
    </header>
  );
}

// Phone and tablet (under 1024px): top bar with wordmark and gear.
export function TopBar({ path, settingsOpen }: Omit<Props, 'tab'>) {
  return (
    <header className="top-bar">
      <span className="wordmark wordmark-sm">{APP_NAME}</span>
      <div className="top-bar-actions">
        <GearButton path={path} settingsOpen={settingsOpen} />
      </div>
    </header>
  );
}

// Phone and tablet: bottom tab bar.
export function TabBar({ tab, settingsOpen }: Omit<Props, 'path'>) {
  return (
    <nav className="tab-bar" aria-label="Main">
      <div className="tab-bar-inner">
        {TABS.map(({ path, short, Icon }) => (
          <NavLink key={path} to={path} active={tab === path && !settingsOpen} className="tab-item">
            <Icon />
            {short}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
