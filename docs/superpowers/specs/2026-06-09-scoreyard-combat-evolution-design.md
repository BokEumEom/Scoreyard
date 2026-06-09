# Scoreyard — Combat Evolution (v2 Direction)

**Date:** 2026-06-09
**Status:** Design approved, pending spec review → implementation plan
**Author:** brainstorming session (bokeum.eom)

## Vision

Scoreyard today is a 75-second collect-and-avoid time-attack: gather crystals
(orbs) for score+combo, dodge undestroyable hazards. It has **no active combat**
— the player cannot fight enemies, and the boss is damaged only indirectly.

v2 adds **active combat without abandoning the collection identity**, via one
unifying idea: **collection IS your weapon.** Collecting orbs raises combo;
combo drives an auto-aim weapon's fire rate and damage. Stop collecting → combo
decays (existing `comboTimer`) → firepower drops. The player is mechanically
pushed to keep collecting *in order to* keep killing.

This is an **evolution, not a genre change**. The 75s time-attack, the seeded
Daily Challenge (deterministic + shareable), and local best-tracking all stay.

## Locked decisions (from brainstorming Q&A)

1. **Core direction:** Hybrid — collection = weapon (not a pure twin-stick, not pure refine).
2. **Attack model:** Combo-linked auto-aim auto-fire (mobile-friendly; no manual aim).
3. **Run structure:** Keep 75s time-attack + boss climax. Daily seed determinism preserved.
4. **Profile/identity:** Remove email entirely. Name + avatar only, shown as a compact card.
5. **Meta progression:** None. Pure skill. No run-to-run upgrades or unlocks.
6. **HP visualization:** Segmented HP gauge (not decreasing hearts) + separate continuous fire gauge.
7. **Directory structure:** Option C — domain-based `src/` tree, migrated in 2 safe steps.

## Core loop

```
move + collect orbs ──> combo ↑ ──> firepower ↑ ──> auto-fire kills enemies
      ▲                                                        │
      └────────── stop collecting → combo decays → firepower ↓ ┘
```

- 75 seconds. Boss (Core Warden) enters at `BOSS_START_SECONDS` (52s) as the climax.
- Final score = collection (high-combo) dominant, kills secondary, boss/survival minor.
- Hard constraint: **gameplay randomness stays on seeded `rng`** so Daily runs reproduce.
  Cosmetic randomness (particles, shake, stars, `makeId`) stays on `Math.random`.

## Combat: combo-linked auto-fire

- The drone auto-targets the **nearest enemy within range** and fires a bolt every `fireInterval`.
- `fireInterval = clamp(0.5 − combo × 0.04, 0.14, 0.5)` seconds (combo 1 → 0.46s, combo 9 → 0.14s).
- Bolt damage = `1 + floor(combo / 3)` (reuses the existing orb→boss damage formula; combo 9 → 4).
- Targeting is pure math (testable): given player pos + enemy list → nearest in range.
- Bolts are simple traveling projectiles (pos + velocity), collide with enemies/boss, expire off-arena.
- No manual aim, no fire button → preserves the existing move+collect control scheme and mobile play.

## Enemies (now destroyable, with HP)

Contact damage is **retained** — having a weapon does not remove the need to dodge.

| Type | HP | Behavior | Kill reward |
|------|----|----------|-------------|
| mine | 1 | slow drift | +15 |
| chaser | 2 | pursues player | +25 |
| orbiter | 2 | orbits arena center | +25 |
| dasher | 3 | wind-up then dash | +40 |
| sentinel | 4 | NEW — durable anchor | +60 + drops a mini-orb |

- Kill score is the *secondary* income; big score still comes from high-combo collection.
- Enemy HP/behavior config lives in a data module (`src/data/enemies.js`), separate from sprite
  frame tables (`src/data/sprites.js`).
- Spawn cadence/weights (`chooseEnemyType`) stay seeded; tune so the arena stays survivable now
  that enemies persist until killed (avoid pile-ups).

## Boss fight (direct damage + phases + HP bar)

- Auto-fire bolts deal **direct** damage to the boss. Today damage only comes from collecting orbs
  while the boss is up; that indirect path is **removed and replaced** by direct fire damage.
- A **boss HP bar** renders across the top while the boss is active (currently invisible).
- **Two phases:**
  - Phase 1 (100%–50%): current laser-sweep + summon cadence.
  - Phase 2 (<50%): shorter laser interval, extra summons. Optional visual swap using the
    existing `boss-variants.png` atlas (`bossVariantFrames` already exported in sprites.js).
- Boss kill keeps a large score payout (current +1800, retune as needed).

## Player survivability & HUD

### HP / shield / firepower (gauges, visually distinct)

| Stat | Form | Side / color | Rationale |
|------|------|--------------|-----------|
| HP | Segmented gauge `[▰▰▰▱]` (4 cells) | left · red→green | Reads "hits left" at a glance; cell shatters on hit |
| Shield | Blue overlay on the HP gauge | atop HP bar | Bundled with HP, no separate pips |
| Firepower (combo) | Continuous gauge `▰▰▰▰▱▱` + ×multiplier | right · amber | Smooth fill contrasts with HP's segments → instantly distinguishable |

- Internal HP model unchanged (4 units; normal hit −1, laser −2). Only the **render** becomes a
  segmented gauge → balance untouched, but partial states (e.g. repair = +½ cell) become possible.
- HP and firepower are opposite stats (one protected, one built) → two distinct gauges is correct.

### HUD layout (ASCII mock)

```
┌─────────────────────────────────────────────┐
│ [BOSS ███████████░░░░░  Core Warden]         │ ← only while boss active
│                                               │
│  SCORE 12,480              ⏱ 0:38   ★Daily   │ ← score prominent, countdown
│                                               │
│              (game arena / canvas)            │
│                                               │
│  [▰▰▰▱]+◆◆        FIRE ▰▰▰▰▰▱ ×7            │ ← HP gauge · shield · fire gauge · combo
│  [🅰 Nadia]                          ♪on  ⧉  │ ← compact profile card · mute · share
└─────────────────────────────────────────────┘
```

- Replaces the current flat 7-column label/value grid (Score·Orbs·Health·Time·Combo·Shield·Pace).
- Reorganized by meaning: top = score/time, bottom = survival/firepower state. Orbs and Pace
  demoted to secondary readouts.
- Mobile: bottom status row collapses to a single line; HUD grid already responsive in `styles.css`.

## Profile (email removed)

- **Delete email** end-to-end: input field, stored field usage, and any UI references.
  `normalizeProfile` migration ignores the legacy `email` on old records (no data loss, no crash).
- Keep **name + avatar** only. Replace the large profile form with a **compact card**
  (`[🅰 Nadia]` in the mock); clicking opens a small edit popover.
- `share.js` PII guard stays as-is (already never leaks name/email; `share.test.js` enforces it).

## Scoring rebalance

Target income mix (exact constants set during implementation, validated by playtest):

- Collection (high-combo orbs): ~70%
- Enemy kills: ~20%
- Boss + survival bonus (health × 100 at end): ~10%

Preserves "collection = weapon": you must keep collecting to keep firepower AND score.

## Directory structure (Option C)

### Constraint: no build step
The game runs with **no bundler** — `<script type="module">` + relative ES imports
(`import ... from "./rng.js"`). Moving files changes: (1) inter-module import paths,
(2) `index.html` script `src`, (3) `test/*.test.js` import paths. Vercel static serving
handles subfolders fine as long as paths are correct.

### Target tree

```
/
├── index.html
├── styles.css
├── package.json
├── README.md  CLAUDE.md  TODOS.md
├── assets/                       (PNG sprite atlases)
├── docs/superpowers/specs/       (this spec, plans)
├── test/
│   ├── core/   rng.test.js  seed.test.js
│   ├── store/  store.test.js
│   ├── ui/     share.test.js
│   └── util/   pace.test.js
└── src/
    ├── main.js                   ← entry (current app.js; shrinks over time)
    ├── core/    config.js  rng.js  seed.js          (pure foundations)
    ├── store/   db.js  store.js                       (persistence)
    ├── data/    sprites.js  enemies.js                (static data tables; enemies.js NEW)
    ├── game/    weapons.js  boss.js  spawn.js  …      (combat/game systems; NEW + migrated from app.js)
    ├── ui/      hud.js  home.js  scores.js  profile.js  avatar.js  share.js  pace.js  (hud/home/scores/profile NEW or migrated)
    ├── audio/   audio.js
    └── util/    mathx.js
```

### Migration approach (2 steps, each its own commit)

1. **Structure migration (low risk, do first, independent commit):** create `src/` + folders,
   move the 11 already-modular files + `app.js`→`src/main.js`, update all import paths,
   `index.html` src, and test imports. **Do NOT split app.js internals here** — it only
   *moves* and gets path edits. Verify: `node --check` all files, 37 unit tests pass,
   browser smoke (no console errors).
2. **Combat build (on top of the new structure):** new modules (`weapons.js`, `enemies.js`,
   `boss.js`, `hud.js`, …) land directly in the right folders. app.js/main.js internals
   migrate into `game/` and a render module **incrementally**, each step browser-verified.
   The risky closure-coupled split happens gradually, never as one big bang.

Rationale: establish folders before piling on combat files; keep the untested-app.js move
isolated so any breakage has a single obvious cause.

## Out of scope (YAGNI)

- Run-to-run progression, unlocks, permanent upgrades (meta = none).
- Online leaderboard, accounts, email, cloud sync.
- Genre change (wave/endless/boss-rush).
- Multiplayer.
- Big-bang rewrite of app.js's render/update core (only incremental extraction).

## Success criteria

- Enemies take and show damage; can be destroyed by auto-fire scaled by combo.
- Boss has a visible HP bar, takes direct fire damage, and shifts behavior at 50%.
- HP renders as a segmented gauge; firepower as a distinct continuous gauge.
- Email is gone from UI, storage usage, and code paths; old profiles still load.
- A Daily run with a fixed seed reproduces identically (determinism intact).
- `node --test test/*.test.js` stays green; new pure logic (targeting, enemy config,
  scoring) gets unit tests (project rule: 80%+ on testable units).
- Game loads with no console errors and plays in a browser smoke test.

## Open items for spec review

- HP gauge: confirmed segmented (4 cells) + shield overlay. Change to fully-continuous if preferred.
- Exact tuning constants (fire interval curve, enemy HP, kill rewards, boss HP, score weights)
  are starting proposals — final values set during implementation + playtest.
```
