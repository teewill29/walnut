# Walnut: screens and behavior

Mockups live in `design/mockups/`:

| Mockup | Screen |
|---|---|
| `Main.dc.html` | Play, desktop |
| `Phone.dc.html` | Play, phone |
| `Review.dc.html` | Post-game review, desktop |
| `History.dc.html` | History and progress, desktop (stacks on phone, see DESIGN.md) |

The sample data in the mockups (games, numbers, openings) is illustrative. The real app computes everything from saved games.

## Navigation

- **Phone and tablet (under 1024px wide):** a bottom tab bar with Play, Review and History, plus a gear icon in the top bar for Settings.
- **Desktop (1024px and up):** top nav with Play, Last game review and History, plus the gear icon.
- Review opens the most recent finished game by default. Any game opens in Review from History.

## 1. Play

### Layout
Opponent strip, board, player strip, move list, actions. Desktop puts the Opponent card and the Moves card in a right column. Phone stacks them, and the opponent picker moves into the **New game sheet**.

### Opponent strip
Avatar initial, "Bot · {Level}", its nominal Elo and color, and a status line: "Thinking…" while the engine works, "Waiting on you" on the player's turn.

### Player strip
"You", your color, and "Your move" in brass on your turn.

### Board
- Drag-and-drop **and** tap-to-move: tap a piece to show legal-move dots (capture rings on occupied squares), then tap a target. Tap the piece again, or an empty illegal square, to deselect.
- **Promotion:** a picker with queen, rook, bishop and knight over the promotion square. No auto-queen.
- Highlight the last move (both squares) and the king in check.
- The board orients to your color automatically. **Flip** rotates it for the current game only.
- During the game: **no eval bar, no engine hints, no move classifications.** That would be cheating yourself.
- The bot waits at least 400ms before moving (even on Easy) so moves don't snap in instantly.

### Move list
- Desktop: a numbered table (number, White, Black). The latest move is highlighted, and the list auto-scrolls to it. The opening name shows in the card header and updates as moves are played (see Openings in ENGINE.md).
- Phone: a horizontal strip of move chips, newest first, the newest highlighted.

### Actions
- **Take back:** undoes your last move and the bot's reply (2 plies), or 1 ply if the bot hasn't replied yet. Only available when "Allow takebacks" is on in Settings (default on). Every takeback increments `takebacks` on the game, which tags it in History.
- **Flip board.**
- **Resign:** confirm step ("Resign this game?"), then the game ends 1-0 or 0-1 with termination `resign`.

### Opponent card (desktop) / New game sheet (phone)
- Level: Easy (~800), Medium (~1200), Hard (~1700), Chessmaster (full strength). 2×2 grid, the selected one gets a brass border.
- Play as: White, Random, Black.
- **Start new game.** If a game is in progress, confirm first: "Abandon the current game? It will be saved as unfinished." Abandoned games are saved with result `*` and kept out of all stats.
- On desktop, the card's note says "Changes apply to your next game."

### Game end
chess.js detects checkmate, stalemate, threefold repetition, the 50-move rule and insufficient material. Draws end the game automatically.

When the game ends, show a **Game over panel** (a modal on desktop, a bottom sheet on phone):
- The result in words ("You won by checkmate", "Draw by repetition", "You resigned").
- "Analyzing your game…" with a progress bar (positions done / total).
- **View review** (enabled once analysis finishes) and **New game**.
- Analysis runs in the background. If the app is closed mid-analysis, it resumes next launch (see DATA_MODEL.md).

### Resume
The in-progress game autosaves after every ply. Opening the app with a game in progress resumes it on the Play screen, the same position and side to move. If it's the bot's turn, the bot moves.

## 2. Review

Loads one finished game with its analysis. If analysis is missing or outdated (older `ANALYSIS_VERSION`), show the progress bar and run it.

### Header
"Game review", plus a line: "You ({color}) vs Bot · {Level} · {date} · {result in words} on move {n}".

### Board panel
- The board starts at the **turning point** (ENGINE.md), showing the position **before** that move.
- Square tints: the played move's from/to in red, the engine's best move's from/to in green. Also draw a green **arrow** for the best move (react-chessboard arrows). When the played move equals the best, show only green.
- **Eval bar:** vertical, left of the board on desktop; horizontal, 8px tall, above the board on phone. It shows White's share from win% (ENGINE.md), with the number (+0.8, −3.2, M3) printed inside the leading side's section.
- Legend chips under the board: "Played {SAN}" (red) and "Best {SAN}" (green).
- **Step controls:** first, previous, the current move label ("14. Qxb7??"), next, last. Arrow keys work on desktop, and swiping left and right works on the board on phone. The tints, arrow, eval bar and legend follow the current ply.
- Annotation marks on the label: `??` blunder, `?` mistake, `?!` inaccuracy.

### Summary row
Result, Accuracy (yours), Blunders, Mistakes, Inaccuracies. Counts are your moves only.

### Evaluation graph
An SVG area chart of the eval over the whole game from White's point of view (light area = White ahead), using win% so it saturates instead of spiking. Dashed midline. Red marker on the turning point. Tap or click a point to jump the board there. Caption under it: "Move 1", "Move {turning point} · turning point", "Move {last}".

### Turning point card
- Your move with the biggest win% drop. Shows "Turning point", "+0.8 → −3.2", the move with marks, its classification, "Engine best", and "Best line" (the PV in SAN with move numbers, up to 6 plies).
- If you **won** and never dropped 10%+, the card becomes **"Where you won it"**: the bot's biggest mistake, plus whether your reply punished it (ENGINE.md: Punished / Missed).
- Footer line: "Want the why? Copy this game below and paste it into your Coach project."

### Flagged moves
Every move of yours tagged Inaccuracy, Mistake or Blunder, in move order: move label, a classification chip, the eval swing, "Best {SAN}". The turning point row is highlighted. Tap a row to jump the board there.

Below it, a collapsed **"Bot's mistakes"** section listing the bot's flagged moves, each tagged Punished or Missed for your reply. This is what "what won me the game" means.

### Coach export
- **Copy for Coach:** copies the text in EXPORT.md §1, and the button label changes to "Copied to clipboard" for 2 seconds.
- On phone, when `navigator.share` exists, add a **Share…** button that shares the same text (so it can go straight into the Claude app).
- **Copy PGN** and **Download .pgn**: standard PGN with headers (Event "Walnut vs Bot", Site "Walnut", Date, White, Black, Result, plus custom `[BotLevel]`, `[Opening]`, `[ECO]`).
- A preview of the export text, monospace, scrolls past 240px.

## 3. History

### Top
"History and progress", the game count, **Copy progress report** (EXPORT.md §2) and **Back up games** (DATA_MODEL.md).

A switch: **"Include games with takebacks"**, off by default. When off, games with `takebacks > 0` are left out of every stat and chart (they still show in the list with a "Takebacks" tag).

### Stat tiles
- **Record:** W–L–D for finished games.
- **Accuracy, last 10:** average, with "Up 3 from the 10 before" / "Down 2 from the 10 before" / "Same as the 10 before". Under 20 analyzed games: "Need 20 games to compare".
- **Blunders per game:** the average over the last 10, with the same comparison.
- **Playing strength:** a rough performance rating from the last 20 games (ENGINE.md). Under 5 games: "Play 5 games to see this".

### Charts
- **Accuracy:** a dot per game plus a 5-game rolling average line, with a dashed 70% reference line.
- **Blunders per game:** a bar per game.
- On phone each chart is full width, and tapping a dot or bar opens that game in Review.
- With fewer than 3 analyzed games, show an empty state: "Play a few games and your trend shows up here."

### By bot level
Per level: a W/D/L stacked bar plus "9W 0D 1L", or "Not played yet". The legend uses words, not just color.

### Openings
The top 6 by games played, grouped by opening family and your color: name, "as White/Black", games, and score % ((W + ½D) / N). Green at 50% and up, orange below.

### Where mistakes happen
The share of your Mistakes + Blunders by phase (Opening, Middlegame, Endgame; definitions in ENGINE.md) over the last 20 games.

### Games list
- Filter chips: All, Wins, Losses, Draws, plus a level dropdown and a color dropdown.
- Each row: date, a result chip, level, "as {color}", the opening (muted), accuracy, and a chevron. Tapping a row opens it in Review. A long press (phone) or ••• menu (desktop) offers **Re-analyze** and **Delete** (with confirm).
- Unfinished/abandoned games show a muted "Unfinished" chip and have no Review.
- Newest first, loading 30 at a time.

## 4. Settings

Opened from the gear icon. A full page on phone, a modal on desktop.

- **Sound** (on/off). **Show legal-move dots** (on). **Show coordinates** (on). **Confirm before resigning** (on). **Allow takebacks** (on).
- **Piece style** (added in Phase 4 once the options exist).
- **Data:** Back up games (download JSON), Restore from backup (file picker, merges), "Last backup: {date}". **Re-analyze all** (only shown when games exist with an older `ANALYSIS_VERSION`; runs in the background with progress). **Delete all games** behind a double confirm (type DELETE).
- **About:** version, `ANALYSIS_VERSION`, and credits and licenses (Stockfish GPL-3.0, chess.js, react-chessboard, the piece set, the opening names from lichess-org/chess-openings CC0, and the fonts).

## 5. Backup reminder

If the last backup is over 14 days old **and** there are 5+ games since then, show a dismissible banner on History: "Your games only live on this device. Back them up?" with a **Back up** button. Dismissing it hides the banner for 7 days.
