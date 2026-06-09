# Scoreyard

Static browser arcade shooter. **No build step, no runtime dependencies.** Ships as plain static files; scores/profiles persist in the browser (IndexedDB).

## Architecture

- **`index.html`** — single entry; loads `app.js` as `<script type="module">`.
- **`app.js`** (~1,970 lines) — the Canvas game: render loop, input, spawning, HUD, scene/state. Still the largest file; not unit-tested. Imports every module below. (Closure-coupled: render/update functions share module-level `ctx`/`game`/`assets`, so they stay here by design.)
- **Pure / leaf modules** (small, no shared game state):
  - `config.js` — tuning constants + storage IDs (`DB_NAME`, `PROFILE_ID`, `RUN_SECONDS`, `BOSS_START_SECONDS`, `MAX_HEALTH`).
  - `db.js` — IndexedDB layer (`openDb`, `getStore`, `makeId`); memoized connection.
  - `sprites.js` — sprite-atlas frame layout tables + `varietyPowerUpFrame`.
  - `mathx.js` — pure helpers (`clamp`, `distance`, `distanceToSegment`, `formatDate`).
  - `avatar.js` — `makeAvatarDataUrl`, `compressAvatar` (own offscreen canvas).
  - `rng.js` — seeded PRNG (`next`/`range`/`int`/`arenaPoint`/`pick`, `isSeeded`). *(unit-tested)*
  - `seed.js` — `hashSeed`, `utcDateKey`, daily seed (UTC-based). *(unit-tested)*
  - `store.js` — profile schema + migration (`normalizeProfile`), `recordRun`, `todayBest`, `playedToday`. *(unit-tested)*
  - `share.js` — `buildShareString` (emoji result; **must never leak PII**). *(unit-tested)*
  - `pace.js` — `paceDelta` (vs. best-pace curve). *(unit-tested)*
  - `audio.js` — synthesized WebAudio SFX + mute.
- **`assets/`** — large PNG sprite atlases (already in git history; avoid adding more large binaries).

## Conventions

- **ES modules only.** `package.json` exists solely so `node --test` runs the modules as ESM — it is not a dependency manifest.
- **Immutability** — never mutate inputs (`normalizeProfile` has a test asserting this). Return new objects.
- **Determinism** — gameplay randomness flows through seeded `rng`; daily challenges must reproduce from the UTC date seed.
- **No PII** — share strings and persisted data must not contain names/emails. `share.test.js` guards this.
- **Small files** — keep new logic in focused modules, not piled into `app.js`.

## Commands

```bash
node --test test/*.test.js      # run the unit suite (fast, pure modules)
node --check <file>.js          # syntax-check a module
python3 -m http.server 8000     # serve locally (any static server works)
```

## Automation (this repo)

`.claude/settings.json` wires two project hooks:
- **PostToolUse** on JS edits → `node --check` + full unit suite (`.claude/hooks/check-js.sh`).
- **PreToolUse** on `git commit` → blocks newly-staged files >1 MB (`.claude/hooks/guard-large-assets.sh`).

> `.claude/` is gitignored — these hooks are local-only and not committed.
