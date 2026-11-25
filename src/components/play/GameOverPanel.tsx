import { Sheet } from '../Sheet';

interface Props {
  text: string;
  onNewGame: () => void;
  onClose: () => void;
}

/** A modal on desktop, a bottom sheet on phone (SPEC.md §1 → Game end). */
export function GameOverPanel({ text, onNewGame, onClose }: Props) {
  return (
    <Sheet title="Game over" hideTitle onClose={onClose} className="sheet-gameover">
      <p className="gameover-eyebrow">Game over</p>
      <p className="gameover-result">{text}</p>
      <p className="muted">Analysis comes in the next update. This game is saved and will be analyzed then.</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-secondary" disabled aria-disabled="true">
          View review
        </button>
        <button type="button" className="btn btn-primary" onClick={onNewGame} data-autofocus>
          New game
        </button>
      </div>
      <button type="button" className="btn-link" onClick={onClose}>
        Look at the final position
      </button>
    </Sheet>
  );
}
