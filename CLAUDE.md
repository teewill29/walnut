# Walnut: chess trainer

A personal chess trainer web app for Teewill. He plays bots at four levels, every game is logged and analyzed by Stockfish, and he copies a structured export into a Claude project that coaches him. History shows whether he's improving.

It runs in a desktop browser and gets saved to his phone's home screen as an installable PWA. **Treat the phone as the main device.**

Teewill is not a developer. Explain problems in plain English, and at each checkpoint tell him exactly what to tap or click to test.

## Source of truth

Read these before writing code. They win over your own assumptions.

| File | What's in it |
|---|---|
| `docs/SPEC.md` | Every screen and what it does |
| `docs/ENGINE.md` | Bot levels, analysis, classification math, history metrics |
| `docs/EXPORT.md` | Exact text formats for the Coach export and the progress report |
| `docs/DATA_MODEL.md` | IndexedDB tables, autosave, backup format |
| `docs/DESIGN.md` | Colors, fonts, wood board, breakpoints, components |
| `docs/PHASES.md` | Build order, with a "Done when" checklist per phase |
| `design/mockups/` | The approved mockups (canvas source files: readable HTML with inline styles) |

If something is unclear or conflicts with how a library actually works, ask. Don't silently change the spec.

## Stack

- **Vite + React + TypeScript**
- **chess.js** for rules, legal moves, game end, SAN, FEN and PGN
- **react-chessboard** for the board (drag, tap-to-move, custom pieces, square styles, arrows). Check the API of the installed major version; v5 moved props into an `options` object.
- **stockfish** (npm, by nmrugg): use the **lite, single-threaded WASM build**, loaded in a **Web Worker**. Copy its `.js` and `.wasm` into `public/engine/` and confirm the real filenames from the package. GPL-3.0, which is fine for a personal app; keep the license notice in the About section.
- **Dexie** for IndexedDB
- **vite-plugin-pwa** for the manifest, service worker and offline precache
- **@fontsource** packages for Fraunces, Inter and JetBrains Mono (self-hosted so the app works offline)
- **Vitest** for tests
- Charts are small hand-written SVG components (see the mockups). No chart library.
- Hosting: **Vercel, free Hobby plan**, deployed from GitHub

## Hard rules

1. **Nothing paid.** No paid APIs, no server, no accounts, no analytics, no tracking. Every dependency is free and open source. Check the license before adding one.
2. **Don't write chess logic or an engine yourself.** Rules come from chess.js, and evaluation and bot moves come from Stockfish. Our code only wires them together and does the math in ENGINE.md.
3. **The engine never blocks the UI.** Stockfish always runs in a Web Worker, and one engine manager owns the worker and queues requests (bot move vs. analysis).
4. **Analysis settings are fixed and versioned** (`ANALYSIS_VERSION` in `src/engine/analysisConfig.ts`). History charts compare games over months, so every game must be analyzed the same way on every device. If the settings change, bump the version and offer a re-analysis.
5. **Mobile first.** Check every screen at 390×844 (phone), 768×1024 (tablet) and 1440×900 (desktop). Touch targets are at least 44px.
6. **Never lose or delete Teewill's games without a confirm step.** Schema changes need a Dexie version migration. The in-progress game autosaves after every move.
7. **Match the mockups.** Don't redesign. If something in them doesn't work in practice, suggest a change instead of making it.
8. **Stop at every phase's "Done when" list.** Tell Teewill what to test, and wait for his OK before starting the next phase.
9. If a bug survives three honest fix attempts, stop and explain the problem and the options.
10. Keep the app name in one place (`src/config.ts` → `APP_NAME = "Walnut"`) plus the manifest, so it's easy to rename.

## Suggested layout

```
src/
  config.ts
  engine/          worker client, engine manager, levels.ts, analysisConfig.ts, analyze.ts
  chess/           game state hook, opening lookup, phase detection
  analysis/        win%, accuracy, classification, turning point, metrics (pure functions, fully tested)
  export/          coach export + progress report builders (pure, tested)
  db/              Dexie schema, migrations, backup import/export
  screens/         Play, Review, History, Settings, NewGameSheet, GameOver
  components/      Board, EvalBar, EvalGraph, MoveList, StatTile, charts, ...
  styles/          tokens.css (from DESIGN.md)
public/
  engine/          stockfish js + wasm
  openings.json    built by scripts/build-openings.ts
scripts/
tests/fixtures/    PGNs used by analysis tests
```

## Open questions (decide with Teewill as they come up)

- Final piece art (Phase 4 compares options).
- Bot strength values in `levels.ts` after he plays the calibration games (Phase 1).
- Whether he wants a phone landscape layout beyond the basic one in DESIGN.md.
