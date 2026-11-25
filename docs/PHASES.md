# Build phases

Do them in order. At the end of each phase, stop, give Teewill the exact test steps, and wait for his OK. "Done when" items are tested **on his phone from the home screen** unless they say desktop.

## Phase 0: Skeleton you can install

- Vite + React + TS, the tokens from DESIGN.md, the fonts self-hosted.
- The tab shell: Play, Review and History as empty screens, plus Settings. Bottom tab bar under 1024px, top nav above.
- vite-plugin-pwa: manifest, icons, service worker, and the update toast.
- Dexie schema v1, with `navigator.storage.persist()` on first launch.
- A GitHub repo, connected to Vercel (Hobby). The README has the deploy steps.

**Done when**
- [ ] The Vercel URL loads on desktop and phone.
- [ ] Added to the home screen, it opens full screen (no browser bar), with the walnut background behind the status bar and nothing hidden under the notch or home indicator.
- [ ] With airplane mode on, it still opens from the home screen.
- [ ] Tabs switch on phone and desktop, with the layout matching the breakpoints table.

## Phase 1: Play the bots

- The engine manager plus the Stockfish worker. `levels.ts` with the starting values from ENGINE.md.
- The Play screen per SPEC.md §1 and the mockups: drag and tap-to-move, legal dots, promotion picker, last-move and check highlights, auto-orientation, Flip, Take back, Resign with confirm.
- The New game sheet / Opponent card. Game-end detection and the Game over panel (the analysis part comes in Phase 2; show "Analysis comes in the next update" for now).
- Opening name lookup (`scripts/build-openings.ts` → `public/openings.json`), shown in the Moves card.
- Autosave every ply and resume on launch. Finished games saved per DATA_MODEL.md.
- The board uses the procedural wood squares from DESIGN.md now. Pieces can be react-chessboard's defaults until Phase 4.

**Done when**
- [ ] A full game can be played on the phone and on desktop at each level, with no illegal moves allowed and no UI freezes while the bot thinks.
- [ ] Promotion works (the picker shows all 4 pieces), and castling and en passant work.
- [ ] Mid-game, swiping the app closed and reopening it puts the game back exactly where it was.
- [ ] The whole Play screen fits without scrolling on the phone, in portrait.
- [ ] **Calibration:** Teewill plays 3 games at each level and reports how they felt. Target: Easy = he wins most games; Medium = a real fight; Hard = he mostly loses; Chessmaster = he never wins. Tune `levels.ts` until that's true, and record the final values in its comments.

## Phase 2: Analysis, Review and the Coach export

- The analysis pipeline (ENGINE.md §3–4), resumable, with progress in the Game over panel.
- `src/analysis/` pure functions plus every unit test in ENGINE.md §7. The fixture integration test behind `npm run test:engine`.
- The Review screen per SPEC.md §2: board at the turning point, tints, best-move arrow, eval bar, stepping (buttons, arrow keys, swipe), summary row, eval graph (tap to jump), turning point card, flagged moves, the "Bot's mistakes" section.
- The Coach export (EXPORT.md §1), Copy / Share…, Copy PGN, Download .pgn.
- `coach/PROJECT_INSTRUCTIONS.md` stays in sync with the export labels.

**Done when**
- [ ] `npm test` and `npm run test:engine` pass.
- [ ] After a game on the phone, the analysis finishes in under 3 minutes for a 40-move game, and the app stays usable meanwhile.
- [ ] Closing the app mid-analysis and reopening it continues the analysis instead of restarting.
- [ ] The Review board, eval bar, graph and flagged list agree with each other at every ply when stepping through.
- [ ] Teewill pastes one real export into his Coach project, and the coach's explanation matches the board (spot-check 3 flagged moves on the real position).

## Phase 3: History and progress

- The History screen per SPEC.md §3: tiles, the accuracy and blunder charts, by level, openings, mistakes by phase, the games list with filters, Re-analyze and Delete.
- The takebacks switch and "Takebacks" tags.
- The progress report (EXPORT.md §2).
- Backup and restore (DATA_MODEL.md), the backup reminder banner, Settings → Data.

**Done when**
- [ ] Each metric unit-tested against a hand-made set of 25 fake games (`tests/fixtures/history-games.json`), checked against numbers worked out by hand in the test file's comments.
- [ ] Tapping a chart dot or games-list row opens the right game in Review.
- [ ] A backup made on the phone restores on desktop (and the reverse), with no duplicates after restoring twice.
- [ ] The History screen is readable on the phone without zooming, with the tiles 2×2 and the charts full width.

## Phase 4: Wood and polish

- Wood pieces: build 2–3 candidate piece styles per DESIGN.md and show them side by side on the real board. Teewill picks one, and the others can stay as a Settings → Piece style option if he wants.
- The optional CC0 photo wood texture test against the procedural squares (keep whichever he prefers).
- Synthesized move, capture and check sounds plus the Sound setting.
- Bot-move animation, a short-landscape layout, the rest of Settings, the About screen with credits.
- An accessibility pass (DESIGN.md), contrast checked, the keyboard paths on desktop.

**Done when**
- [ ] Teewill has chosen the pieces and board finish on his phone and says it looks like a real wood set.
- [ ] Sounds play on move, capture and check, and Sound off silences them all.
- [ ] Every control is reachable by keyboard on desktop, and every icon-only button has a label.
- [ ] One week of normal use without a bug he has to report.

## Later (not now)

- **Mistake drills:** turn your saved blunders into puzzles ("find the better move" from the FEN) on a spaced-repetition schedule.
- A **custom Elo slider** between Hard and Chessmaster.
- **Time controls** (5+3, 10+0, 15+10) with clocks, plus time-trouble stats.
- **Human-like bots** (Maia) if the weakened Stockfish feels too robotic.
- An opening explorer on your own games.
- A 3D board.
- An in-app coach through the Claude API (paid, so only if he decides it's worth it).
