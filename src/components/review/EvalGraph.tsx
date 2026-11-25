import { useRef } from 'react';
import { positionWinWhite } from '../../analysis/winPercent';
import type { PositionEval } from '../../db/types';
import { moveNumber, sideToMoveAt } from '../../export/format';

const W = 560;
const H = 140;

interface Props {
  positions: PositionEval[];
  turningPly: number | null;
  turningKind: 'loss' | 'win' | null;
  /** Position index the board's eval bar is showing. */
  current: number;
  /** Jump to the move that led to position j. */
  onPick: (positionIndex: number) => void;
}

/** White's win% over the game (light area = White ahead), saturating instead of spiking. */
export function EvalGraph({ positions, turningPly, turningKind, current, onPick }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const n = Math.max(1, positions.length - 1);
  const X = (i: number) => +((i * W) / n).toFixed(1);
  const Y = (win: number) => +(H / 2 - ((win - 50) / 50) * 62).toFixed(1);
  const wins = positions.map((p, i) => positionWinWhite(p, sideToMoveAt(i)));
  const area = `M0,${H} ${wins.map((w, i) => `L${X(i)},${Y(w)}`).join(' ')} L${W},${H} Z`;
  const tp = turningPly !== null ? turningPly + 1 : null;

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    onPick(Math.round(((clientX - r.left) / r.width) * n));
  };

  const trend = wins.length
    ? `Evaluation over ${n} moves. Starts ${describe(wins[0])}, ends ${describe(wins[wins.length - 1])}.`
    : 'Evaluation graph';

  const lastMove = moveNumber(Math.max(0, positions.length - 2));

  return (
    <>
      <svg
        ref={ref}
        className="evalgraph"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={trend}
        onClick={(e) => pick(e.clientX)}
      >
        <path d={area} fill="#E6D8BF" fillOpacity={0.88} />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#C9A45C" strokeOpacity={0.6} strokeDasharray="4 4" />
        <line x1={X(current)} y1={0} x2={X(current)} y2={H} stroke="#C9A45C" strokeWidth={1.5} strokeOpacity={0.9} />
        {tp !== null && tp < wins.length && (
          <>
            <line x1={X(tp)} y1={0} x2={X(tp)} y2={H} stroke={turningKind === 'win' ? '#62A05A' : '#D9604E'} strokeWidth={1.5} />
            <circle
              cx={X(tp)}
              cy={Y(wins[tp])}
              r={6}
              fill={turningKind === 'win' ? '#62A05A' : '#D9604E'}
              stroke="#14110F"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      <div className="graph-caption">
        <span>Move 1</span>
        {turningPly !== null && (
          <span className={turningKind === 'win' ? 'good-text' : 'blunder-text'}>
            Move {moveNumber(turningPly)} · {turningKind === 'win' ? 'where you won it' : 'turning point'}
          </span>
        )}
        <span>Move {lastMove}</span>
      </div>
    </>
  );
}

function describe(win: number) {
  if (win > 60) return 'with White ahead';
  if (win < 40) return 'with Black ahead';
  return 'roughly even';
}
