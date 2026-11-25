# Export formats

Plain text, built by pure functions in `src/export/`, with snapshot tests. The Claude Coach project (`coach/PROJECT_INSTRUCTIONS.md`) is written against these exact formats, so **don't change the labels** without updating that file too.

Rules for both formats:
- Evals are from **White's** point of view, with one decimal and a sign (`+0.8`, `-3.2`), or `M3` / `-M2` for mate.
- Every flagged move includes its **FEN** (the position before the move). That's the part that keeps Claude from misreading the board.
- Lines are SAN with move numbers (`14. Nd5 Nxd5 15. Bxd5 Na5 16. Qc2`, or `14... Rb8 15. Qa6` when the line starts on Black's move).

## 1. Coach export (one game)

```
WALNUT GAME EXPORT v1
GAME: 2026-11-24 | Me (White) vs Bot Medium (~1200) | Result: 0-1 (checkmate, move 31)
OPENING: C53 Italian Game: Giuoco Pianissimo
MY ACCURACY: 71% | Blunders 1 | Mistakes 2 | Inaccuracies 3
TAKEBACKS: 0
PGN: 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O ... 31. Kg1 Qg2# 0-1

TURNING POINT: Move 14 (White) Qxb7 | BLUNDER | +0.8 -> -3.2

MY FLAGGED MOVES:
Move 9 (White) | Played: Re1 | INACCURACY | Eval: +0.9 -> +0.4 | Phase: Opening
  FEN: <full FEN of the position before 9. Re1>
  Best: d4 | Line: <PV in SAN, up to 6 plies>
Move 14 (White) | Played: Qxb7 | BLUNDER | Eval: +0.8 -> -3.2 | Phase: Middlegame
  FEN: r4rk1/pppbqppp/2np1n2/2b1p3/2B1P3/1QPPNN2/PP3PPP/R1B2RK1 w - - 0 14
  Best: Nd5 | Line: 14. Nd5 Nxd5 15. Bxd5 Na5 16. Qc2
(...one block per flagged move, in move order)

BOT MISTAKES:
Move 20 (Black) | Played: Rfe8 | MISTAKE | Eval: -3.4 -> -1.9 | My reply: Nh4 (MISSED, best was Bxf7+)
(...or "None")

SUMMARY: Lost as White vs Medium. Biggest swing at move 14 (middlegame).
```

(The FENs and lines above show the format only. The real ones come from the game.)

Notes:
- The PGN line is the full move list, no headers, on one line.
- If there are no flagged moves: `MY FLAGGED MOVES: None`, and the TURNING POINT line becomes `WHERE I WON IT: Move 20 (Black) Rfe8 | MISTAKE | -3.4 -> -1.9 | My reply: PUNISHED` (or `TURNING POINT: None`).
- The SUMMARY line is a plain template, not generated prose.

## 2. Progress report (History → Copy progress report)

Covers the last 20 finished, analyzed games (honoring the takebacks switch).

```
WALNUT PROGRESS REPORT v1
RANGE: 20 games, 2026-11-02 to 2026-11-24
RECORD: 9W 9L 2D
BY LEVEL: Easy 6W 0D 1L | Medium 3W 2D 6L | Hard 0W 0D 2L | Chessmaster not played
ACCURACY: last 10 avg 75% | previous 10 avg 72% | change +3
BLUNDERS PER GAME: last 10 0.9 | previous 10 1.2
PLAYING STRENGTH (rough): ~1150
MISTAKES BY PHASE: Opening 18% | Middlegame 57% | Endgame 25%
OPENINGS:
  Italian Game as White: 7 games, score 64%
  Sicilian Defense as Black: 6 games, score 42%
  (top 6)

RECENT BLUNDERS (last 10 games, max 15):
2026-11-24 | Move 14 (White) Qxb7 | Best: Nd5 | Phase: Middlegame
  FEN: r4rk1/pppbqppp/2np1n2/2b1p3/2B1P3/1QPPNN2/PP3PPP/R1B2RK1 w - - 0 14
(...)
```

`RANGE` uses the dates of the oldest and newest games in the set. When there are fewer than 20 games, use what exists and say so: `RANGE: 7 games (fewer than 20 played)`.
