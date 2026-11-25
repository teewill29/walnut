# Engine, analysis and metrics

Everything here except the Stockfish calls is **pure functions with unit tests** (`src/analysis/`, `src/export/`).

## 1. Engine manager

- One Web Worker running Stockfish (lite, single-threaded WASM), owned by `EngineManager`.
- A request queue: a bot move has priority over analysis. Analysis pauses (finishes the current position, then waits) while the bot is thinking.
- Speak UCI: `uci` → `uciok`, `isready` → `readyok`, `ucinewgame` between games, `setoption` per request, `position fen …`, `go …`, then parse `info … score cp|mate … pv …` and `bestmove`.
- Every request sets **all** the options it cares about (MultiPV, Skill Level, UCI_LimitStrength, UCI_Elo), because the options stick between requests.
- Hash 32 MB, Threads 1.

## 2. Bot levels

Config lives in `src/engine/levels.ts`. **These are starting values.** Tune them in Phase 1 calibration and record the final values in the file's comments.

| Level | Label | Nominal Elo (for stats) | Method |
|---|---|---|---|
| `easy` | Easy | 800 | MultiPV pick: depth 6, MultiPV 5, temperature 2.0, blunder chance 0.15 |
| `medium` | Medium | 1200 | MultiPV pick: depth 8, MultiPV 4, temperature 0.8, blunder chance 0.05 |
| `hard` | Hard | 1700 | `UCI_LimitStrength true`, `UCI_Elo 1700`, `go movetime 800` |
| `chessmaster` | Chessmaster | 3000 | Full strength: `go movetime 1500`, no limits |

Why not the built-in limiter for everything: Stockfish's `UCI_Elo` floor is about 1320, so Easy and Medium need another way to play weaker.

**MultiPV pick** (Easy and Medium):
1. Run `go depth {depth}` with `MultiPV {n}`. Collect each line's first move and score (cp from the bot's side; mate converts to ±10000 minus the moves to mate).
2. With probability `blunderChance`, pick a uniformly random legal move (this produces believable beginner blunders).
3. Otherwise compute each candidate's loss `Δ = bestScore − score` (in cp) and weight it by `w = exp(−Δ / (temperature × 100))`, then pick by weight.
4. Never pick a random move that allows mate in 1 when a candidate avoids it. Even Easy shouldn't hang mate every game.

Minimum bot think time is 400ms (pad with a delay).

## 3. Post-game analysis

Settings, fixed and versioned in `src/engine/analysisConfig.ts`:

```ts
export const ANALYSIS_VERSION = 1;
export const ANALYSIS_DEPTH = 14;   // same on every device so history compares
export const ANALYSIS_MULTIPV = 1;
export const PV_PLIES = 6;          // best-line length kept per position
```

Process:
1. For each position from the start through the final position (n plies → n + 1 positions), run `go depth 14`. Store `{ cp | mate, best (UCI), pv (UCI[]) }` as **White's point of view** (flip the sign when Black is to move).
2. Terminal positions (mate or stalemate) skip the engine: mate = ±mate 0, stalemate = 0.
3. Save progress after each position (`analysisProgress`), so a closed app resumes where it stopped.
4. Then compute everything below and save it on the game.

## 4. Win%, accuracy, classification

**Win% for White** from centipawns (Lichess's formula):

```
cpClamped = clamp(cp, −1000, 1000)      // mate for White → +1000, mate for Black → −1000
winWhite  = 50 + 50 × (2 / (1 + exp(−0.00368208 × cpClamped)) − 1)
```

For the side that moved: `win = mover is White ? winWhite : 100 − winWhite`.

For each ply `i` (the move played from position `i` to `i + 1`):
- `winBefore` = the mover's win% at position `i`
- `winAfter` = the mover's win% at position `i + 1`
- `drop = max(0, winBefore − winAfter)`

**Move accuracy** (Lichess's formula): `acc = clamp(103.1668 × exp(−0.04354 × drop) − 3.1669, 0, 100)`

**Game accuracy** for a side = the mean of that side's move accuracies, rounded to a whole percent. (Lichess uses a weighted/harmonic blend, so the numbers won't match Lichess exactly. That's fine; it's consistent with itself.)

**Classification** of each move:

| Tag | Rule |
|---|---|
| Book | The position after the move is in the opening table **and** ply ≤ 20 |
| Best | The played move equals the engine's best at position `i` |
| Blunder | drop ≥ 30 |
| Mistake | drop ≥ 20 |
| Inaccuracy | drop ≥ 10 |
| Good | everything else |

Check them in that order: Book first, then Best, then the drop thresholds. **Flagged** = Inaccuracy, Mistake or Blunder.

**Punished / Missed** (for the bot's flagged moves): look at your reply (ply `i + 1`). It's **Punished** if your reply is Best or its drop is < 5, and **Missed** otherwise.

**Turning point:**
- If you have any flagged move: the one with the largest drop (ties go to the earlier move).
- Else if you won: "Where you won it" = the bot's flagged move with the largest drop.
- Else: no turning point card; show "Clean game. No moves of yours lost 10% or more."

**Game phase** of a ply, judged on the position **before** the move:
- **Opening:** ply < 24 (your first 12 moves).
- **Endgame:** total non-pawn material on the board ≤ 26 (N = 3, B = 3, R = 5, Q = 9, both sides combined).
- **Middlegame:** everything else.

## 5. Openings

- Data: `lichess-org/chess-openings` on GitHub (CC0), five TSV files (`a.tsv`–`e.tsv`) with `eco`, `name` and `pgn` columns.
- `scripts/build-openings.ts` replays each line with chess.js and writes `public/openings.json` keyed by EPD (the FEN without the move counters) → `{ eco, name }`.
- The game's opening = the **deepest** position in the game that matches. During play, the Moves card header shows the current match.
- **Opening family** (for History grouping) = the name before the first colon ("Italian Game: Giuoco Pianissimo" → "Italian Game").

## 6. History metrics

All from finished, analyzed games, honoring the "Include games with takebacks" switch.

- **Rolling average:** a 5-game window, ending at each game (shorter at the start).
- **Last 10 vs previous 10:** the means of the 10 most recent and the 10 before them. The difference is rounded to a whole number and printed as Up/Down/Same.
- **Performance rating** (the "Playing strength" tile), over the last 20 finished games:
  ```
  avgOpp = mean(nominal Elo of each game's level)
  perf   = avgOpp + 400 × (W − L) / N
  ```
  Clamp to `[avgOpp − 800, avgOpp + 800]`. If every game is a win, show "> {avgOpp + 400}"; if every game is a loss, show "< {avgOpp − 400}". Round to the nearest 50 and prefix "~". It's labeled "Rough, from last 20 vs bots" because bot Elo is approximate.
- **Openings score:** (W + 0.5 × D) / N, as a whole percent.
- **Mistakes by phase:** your Mistake + Blunder counts per phase over the last 20 games, as a share of the total.

## 7. Required tests

`tests/analysis.test.ts`:
- `winWhite(0) = 50`; `winWhite(1000) ≈ 97.5` (±0.1); `winWhite(−5000) = winWhite(−1000)`.
- `acc(0) ≈ 100` (±0.01); `acc(30) ≈ 24.8` (±0.2).
- Classification thresholds at the exact boundaries (drops of 9.99, 10, 20, 30).
- Performance rating: 3W 1L 1D, all vs 1200 → 1350 (1360 rounded to the nearest 50); all wins vs 1200 → "> 1600".
- Phase detection on the starting position (Opening), a king-and-pawn ending (Endgame), and a position at ply 30 with all minor pieces and queens on (Middlegame).

`tests/fixtures/` + an analysis integration test (runs real Stockfish in Node, behind `npm run test:engine`, so the normal test run stays fast):
- `fools-mate.pgn`, player = White: `1. f3 e5 2. g4 Qh4#`. Expect 2. g4 = Blunder.
- `scholars-defense.pgn`, player = Black: `1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#`. Expect 3…Nf6 = Blunder, with best ∈ {g6, Qe7, Qf6}.
- `opera-game.pgn`, player = White (Morphy, 1858): `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`. Expect 0 White blunders, and Black with at least one Mistake or Blunder.
