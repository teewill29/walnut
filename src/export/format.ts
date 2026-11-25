import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import type { Color, MoveTag, PositionEval } from '../db/types';

// Shared formatting for the export text and the Review screen. Pure.

export const sideToMoveAt = (positionIndex: number): Color => (positionIndex % 2 === 0 ? 'w' : 'b');
export const moveNumber = (ply: number) => Math.floor(ply / 2) + 1;
export const colorWord = (c: Color) => (c === 'w' ? 'White' : 'Black');

/** White's-view eval: "+0.8", "-3.2", "M3", "-M2". `mate: 0` = the side to move is mated. */
export function formatEval(e: PositionEval, sideToMove: Color): string {
  if (e.mate !== null) {
    if (e.mate === 0) return sideToMove === 'w' ? '-M0' : 'M0';
    return e.mate > 0 ? `M${e.mate}` : `-M${-e.mate}`;
  }
  const cp = e.cp ?? 0;
  if (cp === 0) return '0.0';
  return `${cp > 0 ? '+' : '-'}${(Math.abs(cp) / 100).toFixed(1)}`;
}

/** The same with a real minus sign, for the screen. */
export const displayEval = (e: PositionEval, sideToMove: Color) => formatEval(e, sideToMove).replace('-', '−');

/** "14. Qxb7" or "14... Rb8". */
export const moveLabel = (ply: number, san: string) => `${moveNumber(ply)}${ply % 2 === 0 ? '.' : '...'} ${san}`;

export const MARKS: Partial<Record<MoveTag, string>> = { blunder: '??', mistake: '?', inaccuracy: '?!' };
export const TAG_WORDS: Record<MoveTag, string> = {
  book: 'Book',
  best: 'Best',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

/** A UCI move as SAN from a position, or null if it isn't legal there. */
export function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move(parseUci(uci)).san;
  } catch {
    return null;
  }
}

/** A line of UCI moves as SAN with move numbers: "14. Nd5 Nxd5 15. Bxd5", "14... Rb8 15. Qa6". */
export function sanLine(fen: string, ply: number, pv: string[]): string {
  const chess = new Chess(fen);
  const parts: string[] = [];
  pv.forEach((uci, i) => {
    let san: string;
    try {
      san = chess.move(parseUci(uci)).san;
    } catch {
      return;
    }
    const p = ply + i;
    if (p % 2 === 0) parts.push(`${moveNumber(p)}. ${san}`);
    else parts.push(i === 0 ? `${moveNumber(p)}... ${san}` : san);
  });
  return parts.join(' ');
}

/** "1. e4 e5 2. Nf3 ..." */
export function movetext(sans: string[]): string {
  return sans.map((s, i) => (i % 2 === 0 ? `${moveNumber(i)}. ${s}` : s)).join(' ');
}

export function isoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
