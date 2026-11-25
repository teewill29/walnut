import type { SideChoice } from '../../db/settings';
import type { Level } from '../../db/types';
import { LEVEL_ORDER, LEVELS } from '../../engine/levels';

const SIDES: { id: SideChoice; label: string }[] = [
  { id: 'w', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'b', label: 'Black' },
];

interface Props {
  level: Level;
  side: SideChoice;
  onLevel: (l: Level) => void;
  onSide: (s: SideChoice) => void;
}

/** Level 2×2 grid + Play as (shared by the desktop Opponent card and the phone New game sheet). */
export function LevelPicker({ level, side, onLevel, onSide }: Props) {
  return (
    <>
      <div className="level-grid" role="group" aria-label="Level">
        {LEVEL_ORDER.map((id) => {
          const on = id === level;
          return (
            <button key={id} type="button" className="level-btn" aria-pressed={on} onClick={() => onLevel(id)}>
              <span className="level-name">{LEVELS[id].label}</span>
              <span className="level-elo">{LEVELS[id].eloLabel}</span>
            </button>
          );
        })}
      </div>
      <div className="side-row">
        <span className="side-label" id="play-as-label">
          Play as
        </span>
        <div className="segmented" role="group" aria-labelledby="play-as-label">
          {SIDES.map((s) => (
            <button key={s.id} type="button" className="seg-btn" aria-pressed={s.id === side} onClick={() => onSide(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
