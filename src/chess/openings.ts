import type { Opening } from '../db/types';
import { epd } from './game';

// Opening names from lichess-org/chess-openings (CC0), built into public/openings.json
// by scripts/build-openings.ts and keyed by EPD.

export type OpeningTable = Record<string, { eco: string; name: string }>;

/** "Italian Game: Giuoco Pianissimo" → "Italian Game". */
export const openingFamily = (name: string) => name.split(':')[0].trim();

/** The deepest position in the game that has a name. `fens` = positions after each ply. */
export function findOpening(table: OpeningTable, fens: string[]): Opening | null {
  for (let i = fens.length - 1; i >= 0; i--) {
    const hit = table[epd(fens[i])];
    if (hit) return { eco: hit.eco, name: hit.name, family: openingFamily(hit.name) };
  }
  return null;
}

let loading: Promise<OpeningTable> | null = null;

export function loadOpenings(): Promise<OpeningTable> {
  if (!loading) {
    loading = fetch('/openings.json')
      .then((r) => {
        if (!r.ok) throw new Error(`openings.json: ${r.status}`);
        return r.json() as Promise<OpeningTable>;
      })
      .catch((e) => {
        loading = null; // try again next time
        throw e;
      });
  }
  return loading;
}

/** "Italian Game: Giuoco Pianissimo" → "Italian Game · Giuoco Pianissimo" (as in the mockup). */
export const openingLabel = (name: string) => name.replace(': ', ' · ');
