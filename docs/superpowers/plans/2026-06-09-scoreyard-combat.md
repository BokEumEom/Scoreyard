# Scoreyard Combat (Auto-Fire + Enemy HP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add combo-linked auto-aim auto-fire so the drone destroys enemies, and give enemies hit points — without abandoning the collection identity or breaking Daily determinism.

**Architecture:** Two new pure, unit-tested modules (`src/data/enemies.js` for HP/reward config, `src/game/weapons.js` for targeting + bolt math) plus integration into the closure-coupled `src/main.js` game loop. Combat consumes **no seeded `rng`** — `acquireTarget`/`createBolt`/`fireInterval`/`boltDamage` are pure, and impact/kill effects use `Math.random` (cosmetic, already the codebase pattern). The seeded spawn *schedule* is therefore unchanged, so the same seed still produces the same arena.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Node built-in test runner, no build.

---

## Determinism contract (read first)

Daily runs must reproduce the same arena from a seed. Rule for ALL combat code:
- **Never call `rng.*`** in fire/bolt/kill paths. Use pure math; use `Math.random` only for cosmetic particles (as `spawnBurst` already does).
- Do not add orb drops in this plan (would perturb the seeded 6-orb refill pool). Sentinel's `dropsOrb` config exists for a later plan but is NOT acted on here.
- Killing enemies reduces `game.hazards.length`; the spawn gate is time-based (`game.elapsed >= game.nextHazardAt`), so spawn *timing* and the `rng` draw order are preserved. The only theoretical difference is the rarely-hit `< 12` safety cap — accepted (v2 intentionally changes arena dynamics; old daily best curves become stale, which is expected).

## File Structure

- Create: `src/data/enemies.js` — enemy HP + kill-reward config table (pure data + lookup).
- Create: `test/enemies.test.js`
- Create: `src/game/weapons.js` — `acquireTarget`, `fireInterval`, `boltDamage`, `createBolt` (pure).
- Create: `test/weapons.test.js`
- Modify: `src/main.js` — imports, two tuning consts, `game.bolts`/`game.fireTimer` state, `resetGame`, `makeHazard` (enemy hp), new `updateWeapons`/`killEnemy`, a call in `updateGame`, new `drawBolts`, a call in `drawScene`.

## Out of scope (later plans)

Boss direct-damage + HP bar + phases (Plan 3). HP/firepower HUD gauges (Plan 4). Email removal + profile card (Plan 5). New `sentinel` enemy *spawning* and orb drops (later).

---

## Task 1: Enemy config module

**Files:**
- Create: `src/data/enemies.js`
- Test: `test/enemies.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/enemies.test.js`:
```js
// node --test test/enemies.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { enemyConfig, ENEMY_CONFIG } from "../src/data/enemies.js";

test("enemyConfig returns hp and reward per known type", () => {
  assert.equal(enemyConfig("mine").hp, 1);
  assert.equal(enemyConfig("dasher").hp, 3);
  assert.equal(enemyConfig("chaser").reward, 25);
});

test("enemyConfig falls back to a default for unknown types", () => {
  const cfg = enemyConfig("nope");
  assert.equal(cfg.hp, 2);
  assert.equal(cfg.reward, 20);
});

test("sentinel config carries an orb-drop flag for a future plan", () => {
  assert.equal(ENEMY_CONFIG.sentinel.dropsOrb, true);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/enemies.test.js`
Expected: FAIL — cannot resolve `../src/data/enemies.js`.

- [ ] **Step 3: Implement the module**

Create `src/data/enemies.js`:
```js
// src/data/enemies.js — enemy combat config: hit points + kill reward by type.
// Pure data + lookup. No rng, no game state. dropsOrb is reserved for a later plan.

export const ENEMY_CONFIG = {
  mine:     { hp: 1, reward: 15 },
  chaser:   { hp: 2, reward: 25 },
  orbiter:  { hp: 2, reward: 25 },
  dasher:   { hp: 3, reward: 40 },
  sentinel: { hp: 4, reward: 60, dropsOrb: true },
};

const DEFAULT_CONFIG = { hp: 2, reward: 20 };

export function enemyConfig(type) {
  return ENEMY_CONFIG[type] || DEFAULT_CONFIG;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test test/enemies.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/enemies.js test/enemies.test.js
git -c core.hooksPath=/dev/null commit -m "feat: enemy HP + kill-reward config (src/data/enemies.js)"
```

---

## Task 2: Weapons math module

**Files:**
- Create: `src/game/weapons.js`
- Test: `test/weapons.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/weapons.test.js`:
```js
// node --test test/weapons.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { acquireTarget, fireInterval, boltDamage, createBolt } from "../src/game/weapons.js";

test("acquireTarget picks the nearest enemy within range", () => {
  const player = { x: 0, y: 0 };
  const enemies = [{ x: 100, y: 0, id: "far" }, { x: 30, y: 0, id: "near" }];
  assert.equal(acquireTarget(player, enemies, 200).id, "near");
});

test("acquireTarget returns null when nothing is in range", () => {
  assert.equal(acquireTarget({ x: 0, y: 0 }, [{ x: 500, y: 0 }], 100), null);
  assert.equal(acquireTarget({ x: 0, y: 0 }, [], 100), null);
});

test("fireInterval shortens with combo and clamps both ends", () => {
  assert.ok(Math.abs(fireInterval(1) - 0.46) < 1e-9);
  assert.equal(fireInterval(0), 0.5);   // clamp high
  assert.equal(fireInterval(20), 0.14); // clamp low
});

test("boltDamage is 1 + floor(combo/3)", () => {
  assert.equal(boltDamage(1), 1);
  assert.equal(boltDamage(3), 2);
  assert.equal(boltDamage(9), 4);
});

test("createBolt heads from player toward target with given damage", () => {
  const bolt = createBolt({ x: 0, y: 0 }, { x: 10, y: 0 }, 100, 3);
  assert.equal(bolt.damage, 3);
  assert.ok(Math.abs(bolt.vx - 100) < 1e-9);
  assert.ok(Math.abs(bolt.vy) < 1e-9);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/weapons.test.js`
Expected: FAIL — cannot resolve `../src/game/weapons.js`.

- [ ] **Step 3: Implement the module**

Create `src/game/weapons.js`:
```js
// src/game/weapons.js — auto-aim combat math. Pure; no rng, no game state.
// Loop integration (firing cadence, bolt motion, collision) lives in main.js.

// Nearest enemy within range, or null. player/enemies entries need {x, y}.
export function acquireTarget(player, enemies, range) {
  let best = null;
  let bestDist = range;
  for (const enemy of enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d <= bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

// Seconds between shots; faster as combo rises. Clamped to [0.14, 0.5].
export function fireInterval(combo) {
  return Math.min(0.5, Math.max(0.14, 0.5 - combo * 0.04));
}

// Damage per bolt; scales with combo (reuses the orb->boss damage shape).
export function boltDamage(combo) {
  return 1 + Math.floor(combo / 3);
}

// A new bolt traveling from the player straight toward the target.
export function createBolt(player, target, speed, damage) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: player.x,
    y: player.y,
    vx: dx / len * speed,
    vy: dy / len * speed,
    r: 5,
    life: 1.4,
    damage,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test test/weapons.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/weapons.js test/weapons.test.js
git -c core.hooksPath=/dev/null commit -m "feat: auto-aim weapon math (src/game/weapons.js)"
```

---

## Task 3: Integrate combat into the game loop

**Files:** Modify `src/main.js`

> No unit test here — this is canvas game-loop wiring, verified by load smoke + the Task 2/3 pure tests + code review. All edits are exact-anchor replacements.

- [ ] **Step 1: Add imports**

In `src/main.js`, find:
```js
import { makeAvatarDataUrl, compressAvatar } from "./ui/avatar.js";
```
Add immediately AFTER it:
```js
import { enemyConfig } from "./data/enemies.js";
import { acquireTarget, fireInterval, boltDamage, createBolt } from "./game/weapons.js";
```

- [ ] **Step 2: Add tuning constants**

Find:
```js
  const canvas = document.getElementById("gameCanvas");
```
Replace with:
```js
  const FIRE_RANGE = 320; // px: auto-aim acquisition radius
  const BOLT_SPEED = 560; // px/s: bolt travel speed
  const canvas = document.getElementById("gameCanvas");
```

- [ ] **Step 3: Add combat state to the game object**

Find:
```js
    lasers: [],
    particles: [],
```
Replace with:
```js
    lasers: [],
    bolts: [],
    fireTimer: 0,
    particles: [],
```

- [ ] **Step 4: Reset combat state in resetGame**

Find:
```js
    game.lasers = [];
    game.particles = [];
```
Replace with:
```js
    game.lasers = [];
    game.bolts = [];
    game.fireTimer = 0;
    game.particles = [];
```

- [ ] **Step 5: Give spawned enemies hit points**

Find:
```js
      variant: chooseEnemyVariant(enemyType)
    };
```
Replace with:
```js
      variant: chooseEnemyVariant(enemyType),
      hp: enemyConfig(enemyType).hp
    };
```

- [ ] **Step 6: Add updateWeapons + killEnemy functions**

Find:
```js
  function triggerHitstop(seconds) {
    game.hitstop = Math.max(game.hitstop, seconds);
  }
```
Add immediately AFTER it:
```js

  // Auto-aim combat. Consumes NO seeded rng (determinism): targeting/bolt math is
  // pure; impact particles use Math.random (cosmetic). See the determinism contract.
  function updateWeapons(dt) {
    game.fireTimer = Math.max(0, game.fireTimer - dt);

    const target = acquireTarget(game.player, game.hazards, FIRE_RANGE);
    if (target && game.fireTimer <= 0) {
      game.bolts.push(createBolt(game.player, target, BOLT_SPEED, boltDamage(game.combo)));
      game.fireTimer = fireInterval(game.combo);
    }

    game.bolts = game.bolts.filter(bolt => {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;

      if (bolt.life <= 0 ||
          bolt.x < -20 || bolt.x > canvas.width + 20 ||
          bolt.y < -20 || bolt.y > canvas.height + 20) {
        return false;
      }

      const hazard = game.hazards.find(
        h => Math.hypot(h.x - bolt.x, h.y - bolt.y) < h.r + bolt.r
      );
      if (hazard) {
        hazard.hp -= bolt.damage;
        spawnBurst(bolt.x, bolt.y, "#8ad7ff", 6);
        if (hazard.hp <= 0) {
          killEnemy(hazard);
        }
        return false;
      }

      return true;
    });

    game.hazards = game.hazards.filter(h => h.hp > 0);
  }

  function killEnemy(hazard) {
    const reward = enemyConfig(hazard.type).reward;
    game.score += reward;
    spawnBurst(hazard.x, hazard.y, "#ffd166", 16);
    spawnShockwave(hazard.x, hazard.y, "#ef5a5f", 70, 0.4);
    addFloatingText(`+${reward}`, hazard.x, hazard.y - 18, "#ffd166", 0.9);
  }
```

- [ ] **Step 7: Call updateWeapons in the game loop**

Find:
```js
    if (!game.bossSpawned && game.elapsed >= BOSS_START_SECONDS) {
      spawnBoss();
    }
```
Replace with:
```js
    updateWeapons(dt);

    if (!game.bossSpawned && game.elapsed >= BOSS_START_SECONDS) {
      spawnBoss();
    }
```

- [ ] **Step 8: Add drawBolts and render it**

Find:
```js
    game.hazards.forEach(drawHazard);
    drawBoss();
```
Replace with:
```js
    game.hazards.forEach(drawHazard);
    drawBolts();
    drawBoss();
```

Then find:
```js
  function drawBoss() {
```
Add immediately BEFORE it:
```js
  function drawBolts() {
    if (game.bolts.length === 0) {
      return;
    }
    ctx.save();
    ctx.fillStyle = "#8ad7ff";
    ctx.shadowColor = "#8ad7ff";
    ctx.shadowBlur = 8;
    game.bolts.forEach(bolt => {
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

```

- [ ] **Step 9: Syntax check**

Run: `node --check src/main.js && echo OK`
Expected: `OK`

- [ ] **Step 10: Commit**

```bash
git add src/main.js
git -c core.hooksPath=/dev/null commit -m "feat: wire combo auto-fire combat + enemy HP into game loop"
```

---

## Task 4: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `node --test test/*.test.js 2>&1 | grep -E "# (tests|pass|fail)"`
Expected: `# tests 45`, `# pass 45`, `# fail 0` (37 existing + 3 enemies + 5 weapons).

- [ ] **Step 2: Load smoke (no console errors after the combat wiring)**

Run:
```bash
(python3 -m http.server 51899 >/tmp/sy.log 2>&1 &) && sleep 1
B="$HOME/.claude/skills/gstack/browse/dist/browse"
"$B" goto http://127.0.0.1:51899/index.html >/dev/null 2>&1; sleep 1
"$B" console --errors
"$B" js "document.getElementById('storageStatus').textContent"
pkill -f "http.server 51899"
```
Expected: `(no console errors)` and `IndexedDB storage ready`.

> Note: the run does not start under headless automation (a pre-existing issue unrelated to this plan), so live bolt-firing cannot be auto-driven. The automated gates are the unit tests (combat math) + the load smoke (no init/module/syntax errors). **Recommend a real-browser playtest** after this lands: start a run, confirm bolts fire at the nearest enemy, enemies take multiple hits and pop with a `+reward`, and fire rate visibly increases as combo climbs.

---

## Self-Review

- **Spec coverage:** Implements the spec's "Combat: combo-linked auto-fire" (fireInterval/boltDamage curves, auto-aim) and "Enemies (now destroyable, with HP)" (per-type HP + kill reward, contact damage retained via untouched `findCollision`). Boss/HUD/profile are explicitly out of scope (later plans).
- **Determinism:** No `rng.*` in any combat path; verified the four weapons functions and `killEnemy` use only pure math + `Math.random` cosmetics. Documented contract at top.
- **Placeholder scan:** No TBD/TODO; every step has exact code and exact anchors.
- **Type consistency:** `enemyConfig(type)` returns `{hp, reward, dropsOrb?}`; `hazard.hp` set in `makeHazard`, read/decremented in `updateWeapons`, filtered on `> 0`. `createBolt` returns `{x,y,vx,vy,r,life,damage}`; consumed field-for-field in `updateWeapons`/`drawBolts`. `game.bolts`/`game.fireTimer` added to state, reset in `resetGame`, used in `updateWeapons`. Names consistent across all tasks.
