import type { CSSProperties } from 'react';

// Procedural wood squares (DESIGN.md → The board). The grain angle varies per square
// so it doesn't look tiled: A = 86 + ((index × 37) mod 9), index 0–63 from a8.

const FILES = 'abcdefgh';

export function squareIndex(square: string): number {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (8 - rank) * 8 + file;
}

export function isLight(square: string): boolean {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (file + rank) % 2 === 1;
}

export function woodStyle(square: string): CSSProperties {
  const a = 86 + ((squareIndex(square) * 37) % 9);
  return isLight(square)
    ? {
        backgroundColor: '#E2BE8A',
        backgroundImage: `repeating-linear-gradient(${a}deg, rgba(130,78,32,.13) 0 1px, transparent 1px 5px, rgba(130,78,32,.07) 5px 7px, transparent 7px 11px)`,
      }
    : {
        backgroundColor: '#8E5A33',
        backgroundImage: `repeating-linear-gradient(${a}deg, rgba(45,22,8,.25) 0 1px, transparent 1px 4px, rgba(45,22,8,.14) 4px 6px, transparent 6px 10px)`,
      };
}

/** Where a square sits on screen (0,0 = top-left) for an orientation. */
export function viewPos(square: string, orientation: 'white' | 'black') {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return orientation === 'white' ? { col: file, row: 8 - rank } : { col: 7 - file, row: rank - 1 };
}
