import { useEffect, useRef } from 'react';

/** Desktop: numbered table, latest move highlighted, auto-scrolls to it. */
export function MoveTable({ sans }: { sans: string[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const rows: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < sans.length; i += 2) rows.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1] });
  const lastIdx = sans.length - 1;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sans.length]);

  if (sans.length === 0) return <p className="muted moves-empty">No moves yet.</p>;

  return (
    <ol ref={listRef} className="move-table" aria-label="Moves">
      {rows.map((r, i) => {
        const latestRow = i === rows.length - 1;
        return (
          <li key={r.n} className={latestRow ? 'move-row latest' : 'move-row'}>
            <span className="move-n">{r.n}.</span>
            <span className={lastIdx === i * 2 ? 'move-latest' : undefined}>{r.w}</span>
            <span className={lastIdx === i * 2 + 1 ? 'move-latest' : undefined}>{r.b ?? ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Phone: a horizontal strip of chips, newest first, the newest highlighted. */
export function MoveChips({ sans }: { sans: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
  }, [sans.length]);
  const chips = sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).reverse();
  return (
    <ol ref={ref} className="move-chips" aria-label="Moves, newest first">
      {chips.length === 0 && <li className="move-chip move-chip-empty">No moves yet</li>}
      {chips.map((c, i) => (
        <li key={chips.length - i} className={i === 0 ? 'move-chip latest' : 'move-chip'}>
          {c}
        </li>
      ))}
    </ol>
  );
}
