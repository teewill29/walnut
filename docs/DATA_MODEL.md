# Data model

Everything lives in IndexedDB on the device, through Dexie. There's no server.

On first launch, call `navigator.storage.persist()` so the browser is less likely to clear the data. iOS home-screen apps keep their own storage, separate from Safari, so **backups matter**.

## Tables (Dexie version 1)

### `games`
One row per game, finished or not.

```ts
interface Game {
  id: string;                 // uuid
  createdAt: number;          // ms epoch
  endedAt: number | null;
  status: 'in_progress' | 'finished' | 'abandoned';
  playerColor: 'w' | 'b';
  level: 'easy' | 'medium' | 'hard' | 'chessmaster';
  botElo: number;             // nominal Elo at the time of play (from levels.ts)
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  termination: 'checkmate' | 'resign' | 'stalemate' | 'repetition'
             | 'fifty_move' | 'insufficient' | 'abandoned' | null;
  moves: string[];            // UCI, e.g. ["e2e4","e7e5"], the source of truth
  pgn: string;                // generated from moves + headers on save
  takebacks: number;
  opening: { eco: string; name: string; family: string } | null;
  analysis: Analysis | null;
  analysisProgress: AnalysisProgress | null;   // non-null while analysis is partial
}
```

Indexes: `id, createdAt, status, level, playerColor, result, [status+createdAt]`.

### `Analysis` (embedded)

```ts
interface Analysis {
  version: number;            // ANALYSIS_VERSION used
  depth: number;
  analyzedAt: number;
  positions: PositionEval[];  // length = moves.length + 1
  plies: PlyResult[];         // length = moves.length
  accuracy: { w: number; b: number };
  counts: {                   // the player's moves only
    inaccuracy: number; mistake: number; blunder: number;
  };
  turningPly: number | null;
  turningKind: 'loss' | 'win' | null;   // 'win' = "Where you won it"
}

interface PositionEval {
  cp: number | null;          // White's view
  mate: number | null;        // White's view (+ = White mates)
  best: string | null;        // UCI
  pv: string[];               // UCI, up to PV_PLIES
}

interface PlyResult {
  ply: number;                // 0-based
  san: string;
  color: 'w' | 'b';
  winBefore: number;          // the mover's win%
  winAfter: number;
  drop: number;
  accuracy: number;
  tag: 'book' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  phase: 'opening' | 'middlegame' | 'endgame';
  replyVerdict: 'punished' | 'missed' | null;   // set on the bot's flagged moves
}

interface AnalysisProgress {
  version: number;
  positions: PositionEval[];  // done so far
}
```

### `settings`
Key–value: `{ key: string; value: unknown }`.

Keys: `sound`, `legalDots`, `coordinates`, `confirmResign`, `allowTakebacks`, `pieceStyle`, `lastLevel`, `lastSide`, `includeTakebackGames`, `lastBackupAt`, `backupBannerDismissedAt`, `gamesAtLastBackup`.

## Autosave and resume

- After every ply, write the in-progress game's `moves` (and `takebacks`). A single `status: 'in_progress'` row exists at most.
- On launch: if an in-progress row exists, rebuild the chess.js game from `moves` and resume.
- Starting a new game over it → `status: 'abandoned'`, `result: '*'`. Abandoned games never count in stats.

## Analysis queue

- On finish, set `analysisProgress = { version, positions: [] }` and start analyzing.
- After each position, append to `analysisProgress.positions` and save.
- On launch, resume any finished game whose `analysisProgress` is non-null, or whose `analysis.version < ANALYSIS_VERSION` (but those only after Teewill taps "Re-analyze all" in Settings, since a full re-analysis is slow on a phone).

## Backup

**Back up games** downloads `walnut-backup-YYYY-MM-DD.json`:

```json
{ "app": "walnut", "backupVersion": 1, "exportedAt": 1764000000000,
  "dbVersion": 1, "games": [ ... ], "settings": [ ... ] }
```

On phone, use `navigator.share({ files })` when it's available (so it can go to Files or iCloud Drive), and a download link otherwise.

**Restore from backup:** pick the file, validate it (`app === "walnut"`), then **merge by `id`**. An existing game is kept unless the backup's copy has analysis and the existing one doesn't. Show "Added 12 games, kept 30 existing." Settings in a backup are ignored except `lastBackupAt`.

After a successful backup, set `lastBackupAt` and `gamesAtLastBackup` (the count of finished games).
