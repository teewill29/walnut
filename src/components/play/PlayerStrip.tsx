import { PLAYER_INITIAL } from '../../config';
import type { Color, Level } from '../../db/types';
import { LEVELS } from '../../engine/levels';

const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');

interface BotProps {
  level: Level;
  color: Color;
  status: 'thinking' | 'waiting' | 'over' | 'error';
  variant: 'phone' | 'desktop';
}

const STATUS_TEXT = { thinking: 'Thinking…', waiting: 'Waiting on you', over: 'Game over', error: 'Engine problem' };

export function BotStrip({ level, color, status, variant }: BotProps) {
  const cfg = LEVELS[level];
  return (
    <div className={`strip strip-${variant}`}>
      <div className="avatar avatar-bot" aria-hidden="true">
        {cfg.label[0]}
      </div>
      <div className="strip-text">
        <div className="strip-name">Bot · {cfg.label}</div>
        <div className="strip-sub">
          {cfg.eloLabel}
          {variant === 'desktop' && ` · ${colorName(color)}`}
        </div>
      </div>
      <div className={`strip-status status-${status}`} aria-live="polite">
        {variant === 'desktop' && <span className="status-dot" aria-hidden="true" />}
        {STATUS_TEXT[status]}
      </div>
    </div>
  );
}

export function YouStrip({ color, yourMove, variant }: { color: Color; yourMove: boolean; variant: 'phone' | 'desktop' }) {
  return (
    <div className={`strip strip-${variant}`}>
      <div className="avatar avatar-you" aria-hidden="true">
        {PLAYER_INITIAL}
      </div>
      <div className="strip-text">
        <div className="strip-name">You</div>
        <div className="strip-sub">{colorName(color)}</div>
      </div>
      {yourMove && <div className="strip-your-move">Your move</div>}
    </div>
  );
}
