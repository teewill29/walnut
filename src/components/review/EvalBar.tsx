import { positionWinWhite } from '../../analysis/winPercent';
import type { Color, PositionEval } from '../../db/types';
import { displayEval } from '../../export/format';

interface Props {
  ev: PositionEval;
  sideToMove: Color;
  /** White at the bottom (vertical) / left (horizontal) when 'white'. */
  orientation: 'white' | 'black';
  direction: 'vertical' | 'horizontal';
}

/** White's share from win% (ENGINE.md), the number in the leading side's section. */
export function EvalBar({ ev, sideToMove, orientation, direction }: Props) {
  const white = positionWinWhite(ev, sideToMove);
  const text = displayEval(ev, sideToMove);
  const whiteLeads = white >= 50;
  const label = `Evaluation: ${text === '0.0' ? 'level' : `${whiteLeads ? 'White' : 'Black'} ahead, ${text}`}`;
  const whiteFirst = (direction === 'vertical') === (orientation === 'black'); // top/left section
  const sections = [
    { key: 'w', share: white, cls: 'evalbar-white', leads: whiteLeads },
    { key: 'b', share: 100 - white, cls: 'evalbar-black', leads: !whiteLeads },
  ];
  if (!whiteFirst) sections.reverse();

  if (direction === 'horizontal') {
    return (
      <div className="evalbar-h-row" role="img" aria-label={label}>
        <div className="evalbar evalbar-h">
          {sections.map((s) => (
            <div key={s.key} className={s.cls} style={{ flexGrow: s.share }} />
          ))}
        </div>
        <span className="evalbar-h-num">{text}</span>
      </div>
    );
  }
  return (
    <div className="evalbar evalbar-v" role="img" aria-label={label}>
      {sections.map((s, i) => (
        <div key={s.key} className={`${s.cls} ${i === 0 ? 'num-start' : 'num-end'}`} style={{ flexGrow: s.share }}>
          {s.leads && s.share >= 12 && <span className="evalbar-num">{text}</span>}
        </div>
      ))}
    </div>
  );
}
