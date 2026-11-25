// The "Playing strength" tile (docs/ENGINE.md §6). Pure.

export interface PerfGame {
  botElo: number;
  score: 1 | 0.5 | 0; // from your side
}

/** "~1350", "> 1600" or "< 800". null with no games. */
export function performanceRating(games: PerfGame[]): string | null {
  const n = games.length;
  if (n === 0) return null;
  const avgOpp = games.reduce((s, g) => s + g.botElo, 0) / n;
  const w = games.filter((g) => g.score === 1).length;
  const l = games.filter((g) => g.score === 0).length;
  if (w === n) return `> ${Math.round(avgOpp + 400)}`;
  if (l === n) return `< ${Math.round(avgOpp - 400)}`;
  const raw = avgOpp + (400 * (w - l)) / n;
  const clamped = Math.min(avgOpp + 800, Math.max(avgOpp - 800, raw));
  return `~${Math.round(clamped / 50) * 50}`;
}
