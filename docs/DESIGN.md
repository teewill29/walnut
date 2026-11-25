# Design

The look: a dark walnut study, with brass accents and a real wood board. Calm and warm, with no gradients except the wood grain itself.

The mockups in `design/mockups/` are the reference. Every value below was taken from them. Put them in `src/styles/tokens.css` as CSS variables.

## Colors

| Token | Value | Use |
|---|---|---|
| `--bg` | `#1A1613` | App background |
| `--surface` | `#241E19` | Cards, strips |
| `--surface-2` | `#2B241E` | Active nav item |
| `--surface-sel` | `#2F271F` | Selected/latest row |
| `--surface-deep` | `#14110F` | Chart and export-preview backgrounds |
| `--border` | `#3A3028` | Card borders |
| `--border-strong` | `#4A3D31` | Secondary button borders |
| `--divider` | `#332A22` | Header rule, list row rules |
| `--text` | `#EDE4D3` | Primary text |
| `--text-soft` | `#C8BBA6` | Secondary values |
| `--text-muted` | `#A89A86` | Labels, captions (passes 4.5:1 on `--surface`) |
| `--brass` | `#C9A45C` | Primary buttons, selection, accents, coordinates |
| `--brass-hover` | `#E2C27F` | Hover |
| `--on-brass` | `#1A1613` | Text on brass |
| `--danger-text` | `#EFA294` | Resign text |
| `--danger-border` | `#5A3A33` | Resign border |

Classifications (chip = text color on a tinted background):

| Tag | Text | Chip background | Solid (markers, bars) |
|---|---|---|---|
| Blunder | `#F29484` | `rgba(224,97,79,.18)` | `#D9604E` |
| Mistake | `#F0A860` | `rgba(232,145,58,.18)` | `#E8913A` |
| Inaccuracy | `#E2C46A` | `rgba(217,180,74,.16)` | `#D9B44A` |
| Best / Good | `#9BCF96` | `rgba(111,168,107,.16)` | `#62A05A` |

Result chips: Win `#E2C27F` on `rgba(201,164,92,.18)`; Loss `#F29484` on `rgba(224,97,79,.16)`; Draw `#C8BBA6` on `rgba(168,154,134,.18)`.

Never rely on color alone. Chips always carry their word, and annotation marks (`??`, `?`, `?!`) go next to moves.

## Type

- **Fraunces** 500/600: the wordmark, page titles (32px), card titles (20px), big stat numbers (24–26px), the turning-point move (26px).
- **Inter** 400/500/600: everything else. Body 14–15px, labels 12–13px. Use `font-variant-numeric: tabular-nums` on move lists, evals and stats.
- **JetBrains Mono** 400, 12px / 1.55: the export preview.
- Self-host all three with `@fontsource` (offline PWA).

## Shape and spacing

- Radius: cards 12px, buttons 10px, chips and pills 999px, board frame 8px (6px on phone), small squares 2px.
- Card padding: 18–20px. Gaps: 20px between cards, 12–14px inside them.
- Buttons: **primary** = brass fill, `--on-brass` text, weight 600, min-height 48px. **Secondary** = transparent, 1px `--border-strong`, min-height 44px.
- Touch targets ≥ 44×44px everywhere.
- Icons: inline stroke SVG, 1.8–2px stroke, `currentColor`. No emoji, no icon fonts.

## The board

### Squares (procedural wood, no image files)
- Light (maple): `#E2BE8A` with
  `repeating-linear-gradient(Adeg, rgba(130,78,32,.13) 0 1px, transparent 1px 5px, rgba(130,78,32,.07) 5px 7px, transparent 7px 11px)`
- Dark (walnut): `#8E5A33` with
  `repeating-linear-gradient(Adeg, rgba(45,22,8,.25) 0 1px, transparent 1px 4px, rgba(45,22,8,.14) 4px 6px, transparent 6px 10px)`
- `A` varies per square so the grain doesn't look tiled: `A = 86 + ((index × 37) mod 9)`, where index = 0–63 from a8.
- Phase 4 may swap in a CC0 photo wood texture (ambientCG / Poly Haven) if it looks clearly better. Keep the procedural version as the fallback.

### Frame
- `#3A2213` with `repeating-linear-gradient(92deg, rgba(0,0,0,.18) 0 2px, transparent 2px 9px), repeating-linear-gradient(87deg, rgba(255,200,140,.05) 0 1px, transparent 1px 13px)`.
- Shadow: `0 24px 48px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,220,170,.12), inset 0 2px 0 rgba(255,220,170,.10)`.
- Inner edge around the squares: `0 0 0 2px #1E1209, 0 0 0 4px rgba(201,164,92,.35)`.
- Desktop: an 18–26px frame with brass coordinates (12px, weight 600) in the gutter. Phone: a 5px frame, with coordinates **inside** the edge squares (9px, the opposite square color: rank numbers top-left on the a-file, file letters bottom-right on the first rank).

### Overlays (inset box-shadow over the square)
- Last move: `rgba(222,178,72,.40)`
- Played move in Review: `rgba(205,70,52,.48)`
- Best move in Review: `rgba(88,150,80,.52)`, plus a green arrow `#62A05A` at 80% opacity
- Check: a radial red glow on the king's square
- Legal-move dot: `rgba(26,22,19,.35)`, 28% of the square. Capture ring: the same color, a 6px ring.

### Pieces
The mockups use font glyphs as stand-ins. **The real app uses SVG pieces styled as carved wood:**
- **White = boxwood:** fill with an SVG `<pattern>` of grain (an `feTurbulence` base `#F1DDB3`, stretched along one axis) and a `#4A2D16` outline.
- **Black = ebony:** fill `#24150B` with subtle lighter grain and a faint warm highlight along the top edge.
- A soft drop shadow (`0 3px 3px rgba(0,0,0,.45)`) so they sit on the board.
- Start from a free-licensed silhouette set (for example `cburnett` from the lichess-org/lila repo; check the license file there and credit it in About). Phase 4 compares 2–3 candidates side by side on the real board so Teewill can pick.

### Motion and sound
- The bot's move animates over 200ms. Your drag drops instantly.
- Sound (setting, default on): a short wooden "clack" for a move, a heavier one for a capture, and a soft double knock for check, **synthesized with Web Audio** (filtered noise burst plus a resonant body). No audio files to license.

## Breakpoints

| Name | Width | Layout |
|---|---|---|
| Phone | < 640px | `Phone.dc.html`. Single column, bottom tab bar. |
| Tablet | 640–1023px | Single column centered at max 640px, board up to 600px, bottom tab bar. |
| Desktop | ≥ 1024px | `Main` / `Review` / `History` mockups. Two columns, top nav, max content width 1280px. |
| Short landscape | height < 540px and landscape | Board on the left sized to the height; strips, moves and actions scroll on the right; tab bar at the bottom of the right column. |

**Board size:** `min(100vw − 16px, 100dvh − chrome, 600px)` on phone/tablet, where `chrome` = the measured height of everything else on the Play screen (so the whole Play screen fits **without scrolling** on a 390×844 phone). Desktop: 576px on Play and 528px on Review, shrinking if the column is narrower.

### Phone specifics
- **Play:** top bar (wordmark + New game), opponent strip (34px avatar), board, player strip, horizontal move chips, a 3-button action row (Take back / Flip / Resign), tab bar. The opponent picker lives in the **New game** bottom sheet.
- **Review:** horizontal eval bar above the board; the step controls pin above the tab bar; cards stack in this order: Turning point, Flagged moves, Summary row (wraps to 3 + 2), Evaluation graph, Coach export.
- **History:** tiles 2×2, charts full width and stacked, the level/openings/phases cards stacked, the games list full width.
- Bottom sheets: drag handle, `--surface`, 16px top radius, dim backdrop.

### PWA / home screen
- Manifest: name and short_name "Walnut", `display: standalone`, `theme_color` and `background_color` `#1A1613`, `orientation: any`, icons 192, 512 and 512 maskable, plus a 180px `apple-touch-icon`. Icon: a gold (`#C9A45C`) knight silhouette on walnut `#3A2213`.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `apple-mobile-web-app-capable`, status bar style `black-translucent`.
- Pad for `env(safe-area-inset-*)`: the top bar gets the top inset, the tab bar the bottom inset.
- Board: `touch-action: none`. The app: `overscroll-behavior: none` (no pull-to-refresh mid-drag). No text selection on the board or buttons.
- Offline: precache the app shell, fonts, `openings.json` and the Stockfish js and wasm. When a new version is deployed, show a small toast: "Update ready · Reload".

## Accessibility
- Real `<button>`, `<a>` and `<input>` elements. `aria-label` on icon-only buttons. `aria-pressed` on toggles.
- The board has a text alternative: an `aria-live` region announcing each move ("Bot played knight to f6").
- Charts get `role="img"` with an `aria-label` summarizing the trend.
- Keyboard on desktop: the arrow keys step through Review, and Escape closes sheets and modals.
