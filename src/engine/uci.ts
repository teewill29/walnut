// Parsing Stockfish's UCI output. Pure functions, tested in tests/uci.test.ts.

export interface InfoLine {
  depth: number;
  multipv: number; // 1-based
  cp: number | null; // from the side to move
  mate: number | null; // from the side to move (+ = side to move mates)
  pv: string[]; // UCI moves
}

// Parses an `info ... score ... pv ...` line. Returns null for other info lines and for
// lowerbound/upperbound scores (those are provisional).
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ')) return null;
  const t = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let cp: number | null = null;
  let mate: number | null = null;
  let pv: string[] | null = null;
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i]);
        break;
      case 'multipv':
        multipv = Number(t[++i]);
        break;
      case 'score': {
        const kind = t[++i];
        const value = Number(t[++i]);
        if (kind === 'cp') cp = value;
        else if (kind === 'mate') mate = value;
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
        break;
      }
      case 'pv':
        pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  if ((cp === null && mate === null) || !pv || pv.length === 0) return null;
  return { depth, multipv, cp, mate, pv };
}

// `bestmove e2e4 ponder e7e5` → "e2e4"; `bestmove (none)` → null. Not a bestmove line → undefined.
export function parseBestMove(line: string): string | null | undefined {
  if (!line.startsWith('bestmove')) return undefined;
  const move = line.split(/\s+/)[1];
  return !move || move === '(none)' ? null : move;
}

// A score in centipawns from the side to move; mate → ±10000 minus the moves to mate.
export function scoreCp(line: Pick<InfoLine, 'cp' | 'mate'>): number {
  if (line.mate !== null) return line.mate > 0 ? 10000 - line.mate : -10000 - line.mate;
  return line.cp ?? 0;
}
