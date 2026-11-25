# Walnut

A personal chess trainer. You play bots at Easy, Medium, Hard and Chessmaster on a wood board. Every game gets logged and analyzed by Stockfish, and you can copy a coach-ready export into Claude. History tracks whether you're getting better.

It runs in any browser and installs to your phone's home screen. It's free: no server, no accounts, no paid APIs. Your games stay on your device, so use **Back up games** now and then.

## Getting started

1. The code lives in the GitHub repo `teewill29/walnut`.
2. Open Claude Code in that folder and paste:
   > Read CLAUDE.md and everything in docs/ and design/mockups/, then do Phase 0. Stop at the "Done when" list and tell me exactly what to test.
3. After each phase, test the checklist and tell Claude Code what you found before it moves on.

## Running it on your computer

Claude Code will set this up in Phase 0. The usual commands:

```
npm install
npm run dev        # opens at http://localhost:5173
npm test
npm run build      # production build into dist/
npm run preview    # serves the build at http://localhost:4173 (the offline mode only works here, not in dev)
```

## Putting it online (Vercel, free)

1. Sign in at vercel.com with GitHub.
2. **Add New → Project**, pick `walnut`, keep the defaults (it detects Vite from `vercel.json`), and hit **Deploy**.
3. You get a URL like `walnut-xyz.vercel.app`. Every push to the `main` branch redeploys it automatically. Pushes to other branches get their own preview URLs, which ask you to log in to Vercel, so test on the main URL.

## Adding it to your phone

- **iPhone:** open the URL in **Safari**, tap Share, then **Add to Home Screen**.
- **Android:** open it in **Chrome**, tap the ⋮ menu, then **Install app** (or **Add to Home screen**).

It opens full screen like a normal app and works offline after the first load.

## Setting up the Coach

1. In Claude, create a project called **Chess Coach**.
2. Paste the instructions from `coach/PROJECT_INSTRUCTIONS.md` into the project's instructions.
3. Upload `coach/RECURRING_MISTAKES.md` as a project file.
4. After a game: Review, then **Copy for Coach** (or **Share…** on your phone), and paste it into a new chat in the project.
5. Every 10 games or so: History, then **Copy progress report**, paste it in, and update `RECURRING_MISTAKES.md` with what the coach suggests.

## What's in this folder

- `CLAUDE.md`: the rules and stack for Claude Code
- `docs/`: the full spec (screens, engine and analysis, export formats, data, design, build phases)
- `design/mockups/`: the approved screen mockups
- `coach/`: the Claude project instructions and the recurring-mistakes file
