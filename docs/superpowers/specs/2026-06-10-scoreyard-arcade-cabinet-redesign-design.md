# Scoreyard — Arcade Cabinet Redesign

**Date:** 2026-06-10
**Status:** Approved design, ready for implementation planning
**Scope:** Visual + structural redesign of the home/play screen and leaderboard. No gameplay logic changes.

## Goal

Redesign the Scoreyard screen to fix structural/hierarchy problems while elevating
the visual into a vivid retro-arcade aesthetic. The current screen scores ~6/10:
good cyberpunk mood, but duplicate titles, scattered start buttons, a broken-looking
profile popover, flat information hierarchy, and wasted space.

Two outcomes, together:
1. **Structure cleanup** — single title, consolidated CTAs, fixed profile editing.
2. **Visual elevation** — vivid retro arcade (CRT, pixel fonts, saturated neon).

## Decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Visual direction | Retro arcade enhanced — CRT scanlines, pixel fonts front-and-center, vivid color |
| Layout | Arcade cabinet — marquee title (once), center play area, bottom coin/start panel |
| Leaderboard | Separate section below cabinet, redesigned in same vivid retro tone |
| Profile editing | Tidied inline popover (not modal) — proper alignment, spacing, input sizing |

## Visual Direction — Vivid Retro Arcade

- **Palette:** deep dark base (`#0a0612`); vivid neon accents — cyan `#00f0ff`,
  magenta `#ff2d95`, yellow `#ffd400`, lime `#39ff14`. Higher saturation than the
  current toned-down teal.
- **CRT effects:** subtle full-screen scanline overlay + vignette; faint marquee
  flicker. All motion gated by `prefers-reduced-motion` (flicker/scanline animation
  disabled when reduced motion is requested).
- **Typography:** pixel display font (Press Start 2P style) for title, marquee,
  buttons, HUD labels. Body/copy stays monospace for readability.
- **Buttons:** solid color with a thick bottom shadow (physical arcade-button feel);
  press-down motion on hover/active.

## Layout — Arcade Cabinet

```
┌─────────────── MARQUEE ───────────────┐
│  ▸ SCOREYARD ◂      [👤 lex · EDIT]    │   title once + player chip
├────────────────────────────────────────┤
│  ┌── in-game HUD bar (during play) ──┐  │
│  │ SCORE ORBS HP TIME COMBO …       │  │
│  ├──────────────────────────────────┤  │
│  │         GAME SCREEN / canvas      │  │   center pure play area
│  │   (home: daily/freeplay overlay)  │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  COIN PANEL: [▶ PLAY TODAY]  [FREE PLAY]│   consolidated controls
└────────────────────────────────────────┘

────────── HIGH SCORES (separate section) ──────────
[filter] [search]
ranked table …
```

### Key structural changes
- **Title once** — in the marquee. Remove the duplicate large "SCOREYARD" inside the arena.
- **Consolidated start** — bottom coin panel `▶ PLAY TODAY` is the primary action.
  Remove the duplicate `START RUN / END RUN`. `END` shows only during play, small.
- **Side decoration** — reinterpret the existing SF frame artwork as cabinet side
  panels (reuse current assets, no new large binaries).

## Components

### Marquee (topbar)
- Single "SCOREYARD" wordmark with pixel font + neon glow + optional flicker.
- Player chip on the right: avatar + name + `EDIT` button.

### Home overlay (pre-run)
- Semi-transparent overlay on the canvas.
- Status badge `✓ PLAYED TODAY · BEST 348`; two stat cells `TODAY BEST` / `ALL-TIME`.
- Primary CTA `▶ PLAY TODAY` / `↻ REPLAY TODAY`; secondary `FREE PLAY`.
- On start: overlay hides, HUD bar appears.

### In-game HUD
- Canvas **top bar** (DOM HUD): SCORE · ORBS · HP (segmented) · TIME · COMBO ·
  SHIELD · PACE. Pixel-font labels + vivid values. HP rendered as segment blocks.
- **Confirmed:** migrate HUD from in-canvas rendering (added in the combat phase)
  to this DOM top bar. The DOM HUD becomes the single source of truth; the
  in-canvas HUD draw is removed and `main.js` updates the DOM elements each frame.

### Profile editing (tidied inline popover)
- `EDIT` on the player chip opens an aligned popover below the chip.
- Vertical stack: `Display name` (full-width) → `Avatar upload` → `Save profile`.
- Adequate input padding, no clipping, clear shadow for layer hierarchy.

### Leaderboard (separate section)
- "HIGH SCORES" board in the same vivid retro tone.
- Pixel header + filter/search; rows = rank chip + avatar + emphasized score.

## Constraints (project invariants)

- **No build step, no runtime deps.** Static files only. Pixel font must load via
  self-hosted/`@font-face` or a `<link>` that degrades gracefully (no bundler).
- **No new large binaries** in git (guarded by the >1 MB pre-commit hook). Reuse
  existing sprite/frame assets for cabinet decoration.
- **No gameplay/logic changes** — this is presentation only. `src/main.js` render
  loop, spawning, scoring untouched except where DOM HUD wiring is required.
- **Accessibility** — all CRT motion/flicker respects `prefers-reduced-motion`;
  maintain contrast on vivid-on-dark text.
- **No PII** — unchanged; no names/emails in persisted/shared data.

## Out of scope (YAGNI)

- New gameplay mechanics, scoring changes, new game modes.
- Leaderboard backend/network features (stays IndexedDB-local).
- Sound redesign (mute toggle stays as-is, restyled only).
- New large image assets.

## Testing

- Existing unit suite (`node --test test/*.test.js`) must stay green — redesign is
  presentation-only and should not touch tested pure modules.
- `node --check` on any edited JS (enforced by PostToolUse hook).
- Manual visual verification served via `python3 -m http.server`:
  home overlay, in-play HUD, profile popover, leaderboard, reduced-motion mode.
