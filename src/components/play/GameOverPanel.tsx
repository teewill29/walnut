import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAnalysisStatus } from '../../engine/analysisQueue';
import { navigate } from '../../lib/router';
import { ProgressBar } from '../ProgressBar';
import { Sheet } from '../Sheet';

interface Props {
  gameId: string;
  /** Moves in the game; positions to analyze = moves + 1. */
  moveCount: number;
  text: string;
  onNewGame: () => void;
  onClose: () => void;
}

/** A modal on desktop, a bottom sheet on phone (SPEC.md §1 → Game end). */
export function GameOverPanel({ gameId, moveCount, text, onNewGame, onClose }: Props) {
  const status = useAnalysisStatus();
  const row = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const ready = !!row?.analysis && !row.analysisProgress;
  const total = moveCount + 1;
  const done = status?.gameId === gameId ? status.done : (row?.analysisProgress?.positions.length ?? 0);

  return (
    <Sheet title="Game over" hideTitle onClose={onClose} className="sheet-gameover">
      <p className="gameover-eyebrow" aria-hidden="true">
        Game over
      </p>
      <p className="gameover-result">{text}</p>
      {ready ? (
        <p className="muted">Analysis done. Your review is ready.</p>
      ) : (
        <>
          <p className="muted">Analyzing your game…</p>
          <ProgressBar done={done} total={total} />
        </>
      )}
      <div className="sheet-actions">
        <button
          type="button"
          className={ready ? 'btn btn-primary' : 'btn btn-secondary'}
          disabled={!ready}
          onClick={() => {
            onClose();
            navigate(`/review/${gameId}`);
          }}
        >
          View review
        </button>
        <button type="button" className={ready ? 'btn btn-secondary' : 'btn btn-primary'} onClick={onNewGame} data-autofocus>
          New game
        </button>
      </div>
      <button type="button" className="btn-link" onClick={onClose}>
        Look at the final position
      </button>
    </Sheet>
  );
}
