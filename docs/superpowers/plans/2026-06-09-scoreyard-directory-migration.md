# Scoreyard Directory Migration (Option C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the flat root-level JS modules into a domain-based `src/` tree (Option C from the spec) without changing any behavior.

**Architecture:** Pure mechanical relocation + relative-import path fixes. No build step exists, so correctness depends entirely on correct relative ES import paths. The only inter-module import edges are `app.js`→11 modules and `db.js`→`config.js`; everything else has no imports. Tests stay flat in `test/` (lowest risk; `node --test test/*.test.js` keeps working). This is Phase 1 — combat/UI/profile plans come later and land new files directly into this structure.

**Tech Stack:** Vanilla ES modules, no bundler, Node built-in test runner, static hosting.

---

## File Structure (move map)

| From (root) | To | Imports to fix |
|-------------|----|----|
| `app.js` | `src/main.js` | 11 import paths |
| `config.js` | `src/core/config.js` | none |
| `rng.js` | `src/core/rng.js` | none |
| `seed.js` | `src/core/seed.js` | none |
| `db.js` | `src/store/db.js` | 1 (`config`) |
| `store.js` | `src/store/store.js` | none |
| `sprites.js` | `src/data/sprites.js` | none |
| `mathx.js` | `src/util/mathx.js` | none |
| `pace.js` | `src/util/pace.js` | none |
| `avatar.js` | `src/ui/avatar.js` | none |
| `share.js` | `src/ui/share.js` | none |
| `audio.js` | `src/audio/audio.js` | none |

Also touched: `index.html` (1 line), 5 test files (1 import each), `CLAUDE.md` (path docs).
Unchanged: `package.json` test glob, `.claude/hooks/*` (path-agnostic), `styles.css`, `assets/`.

> **Deviation from spec note:** the spec's src-tree listed `pace.js` under `ui/`, but its test-tree listed `pace.test.js` under `util/`. Resolved here: `pace.js` → `util/` (it is pure tested logic, alongside `mathx`). Tests are kept flat in `test/` for Phase 1 (mirroring deferred — YAGNI).

> **Atomicity:** the working tree is broken mid-migration (moved files, unfixed paths). Do NOT commit until Task 7 verification passes. This whole plan is ONE commit.

> **Pre-existing WIP:** `index.html`, `styles.css`, `README.md`, and several `assets/*.png` are modified/untracked by prior work and are NOT part of this migration. Leave them unstaged. Only stage the files this plan touches.

---

## Task 1: Scaffold directories and relocate files

**Files:** creates `src/{core,store,data,util,ui,audio}/`, moves 12 JS files via `git mv`.

- [ ] **Step 1: Create the directory tree**

Run from repo root:
```bash
mkdir -p src/core src/store src/data src/util src/ui src/audio
```

- [ ] **Step 2: Move every module with git mv (preserves history)**

```bash
git mv config.js  src/core/config.js
git mv rng.js     src/core/rng.js
git mv seed.js    src/core/seed.js
git mv db.js      src/store/db.js
git mv store.js   src/store/store.js
git mv sprites.js src/data/sprites.js
git mv mathx.js   src/util/mathx.js
git mv pace.js    src/util/pace.js
git mv avatar.js  src/ui/avatar.js
git mv share.js   src/ui/share.js
git mv audio.js   src/audio/audio.js
git mv app.js     src/main.js
```

- [ ] **Step 3: Confirm the root is clear of moved modules**

Run:
```bash
ls *.js 2>/dev/null; echo "exit:$?"
```
Expected: `exit:2` (no `.js` files left in root — only `index.html`, `styles.css`, etc. remain).

---

## Task 2: Fix the import inside db.js

**Files:** Modify `src/store/db.js:4`

- [ ] **Step 1: Rewrite the config import (store/ → core/)**

In `src/store/db.js`, change line 4:
```js
import { DB_NAME, DB_VERSION } from "./config.js";
```
to:
```js
import { DB_NAME, DB_VERSION } from "../core/config.js";
```

- [ ] **Step 2: Syntax-check**

Run:
```bash
node --check src/store/db.js && echo OK
```
Expected: `OK`

---

## Task 3: Fix the 11 imports inside main.js

**Files:** Modify `src/main.js` (import block, lines ~6-25)

- [ ] **Step 1: Rewrite all import paths to the new folders**

In `src/main.js`, change the import block exactly as follows (left = current, right = new):

```js
import * as rng from "./core/rng.js";                                  // was ./rng.js
import { hashSeed, utcDateKey } from "./core/seed.js";                 // was ./seed.js
import { normalizeProfile, recordRun, todayBest, playedToday } from "./store/store.js"; // was ./store.js
import * as audio from "./audio/audio.js";                             // was ./audio.js
import { buildShareString } from "./ui/share.js";                      // was ./share.js
import { paceDelta } from "./util/pace.js";                            // was ./pace.js
import { PROFILE_ID, RUN_SECONDS, BOSS_START_SECONDS, MAX_HEALTH } from "./core/config.js"; // was ./config.js
import { openDb, getStore, makeId } from "./store/db.js";              // was ./db.js
import {
  spriteFrames,
  powerUpFrames,
  enemyFrames,
  varietyFrames,
  powerUpConfig,
  varietyPowerUpFrame
} from "./data/sprites.js";                                            // was ./sprites.js
import { clamp, distance, distanceToSegment, formatDate } from "./util/mathx.js"; // was ./mathx.js
import { makeAvatarDataUrl, compressAvatar } from "./ui/avatar.js";    // was ./avatar.js
```

> Keep the trailing `// was ...` comments OUT of the actual file — they are guidance only. Only the import statements go in.

- [ ] **Step 2: Verify no stale root-relative imports remain**

Run:
```bash
grep -nE 'from "\./[a-z]+\.js"' src/main.js; echo "matches above should be NONE"
```
Expected: no output (every import now points into a subfolder).

- [ ] **Step 3: Syntax-check**

Run:
```bash
node --check src/main.js && echo OK
```
Expected: `OK`

---

## Task 4: Point index.html at the new entry

**Files:** Modify `index.html:174`

- [ ] **Step 1: Update the module script src**

Change:
```html
<script type="module" src="app.js"></script>
```
to:
```html
<script type="module" src="src/main.js"></script>
```

- [ ] **Step 2: Confirm**

Run:
```bash
grep -n 'src="src/main.js"' index.html && echo OK
```
Expected: prints the line and `OK`.

---

## Task 5: Fix the 5 test import paths (tests stay flat in test/)

**Files:** Modify `test/rng.test.js:4`, `test/seed.test.js:4`, `test/store.test.js:4`, `test/share.test.js:4`, `test/pace.test.js:4`

- [ ] **Step 1: Rewrite each test's import to the new src path**

```
test/rng.test.js   :  "../rng.js"   →  "../src/core/rng.js"
test/seed.test.js  :  "../seed.js"  →  "../src/core/seed.js"
test/store.test.js :  "../store.js" →  "../src/store/store.js"
test/share.test.js :  "../share.js" →  "../src/ui/share.js"
test/pace.test.js  :  "../pace.js"  →  "../src/util/pace.js"
```

Concretely, the resulting line 4 in each file:
```js
// test/rng.test.js
import * as rng from "../src/core/rng.js";
// test/seed.test.js
import { utcDateKey, hashSeed, dailySeed } from "../src/core/seed.js";
// test/store.test.js
import { normalizeProfile, recordRun, todayBest, playedToday } from "../src/store/store.js";
// test/share.test.js
import { buildShareString } from "../src/ui/share.js";
// test/pace.test.js
import { paceDelta } from "../src/util/pace.js";
```

- [ ] **Step 2: Run the full suite**

Run:
```bash
node --test test/*.test.js 2>&1 | grep -E "# (tests|pass|fail)"
```
Expected:
```
# tests 37
# pass 37
# fail 0
```

---

## Task 6: Update CLAUDE.md module paths

**Files:** Modify `CLAUDE.md` (the "Pure / leaf modules" list)

- [ ] **Step 1: Prefix each module path with its new folder**

Update the module bullets so paths read `src/core/config.js`, `src/store/db.js`, `src/data/sprites.js`, `src/util/mathx.js`, `src/util/pace.js`, `src/ui/avatar.js`, `src/ui/share.js`, `src/core/rng.js`, `src/core/seed.js`, `src/store/store.js`, `src/audio/audio.js`, and the entry as `src/main.js` (was `app.js`). Add a one-line note: "Layout: `src/{core,store,data,game,ui,audio,util}/`; entry is `src/main.js`."

- [ ] **Step 2: Sanity-check it mentions the new entry**

Run:
```bash
grep -q "src/main.js" CLAUDE.md && echo OK
```
Expected: `OK`

---

## Task 7: Full verification (regression gate before commit)

- [ ] **Step 1: Syntax-check every moved module**

Run:
```bash
for f in src/main.js src/core/*.js src/store/*.js src/data/*.js src/util/*.js src/ui/*.js src/audio/*.js; do node --check "$f" && echo "ok: $f"; done
```
Expected: `ok:` for all 12 files, no errors.

- [ ] **Step 2: Run unit tests**

Run:
```bash
node --test test/*.test.js 2>&1 | grep -E "# (tests|pass|fail)"
```
Expected: `# tests 37`, `# pass 37`, `# fail 0`.

- [ ] **Step 3: Browser smoke test (the only gate that catches main.js import errors)**

Run:
```bash
(python3 -m http.server 51899 >/tmp/sy.log 2>&1 &) && sleep 1
B="$HOME/.claude/skills/gstack/browse/dist/browse"
"$B" goto http://127.0.0.1:51899/index.html >/dev/null 2>&1; sleep 1
echo "URL: $("$B" url)"
echo "CONSOLE:"; "$B" console --errors
"$B" js "document.getElementById('storageStatus').textContent"
pkill -f "http.server 51899"
```
Expected: URL is index.html, `(no console errors)`, and storageStatus prints `IndexedDB storage ready` (proves `main.js`→`store/db.js`→`core/config.js` chain resolved at runtime).

> If console shows `Failed to resolve module specifier` or a 404 for a `src/...` path, a relative import is wrong — re-check Tasks 2/3 against the move map. Do not commit until clean.

---

## Task 8: Commit (atomic)

- [ ] **Step 1: Stage only the migration files**

Run:
```bash
git add src/ test/rng.test.js test/seed.test.js test/store.test.js test/share.test.js test/pace.test.js index.html CLAUDE.md
git status --short
```
Expected: renames (`R`) for the 12 modules, modifications (`M`) for the 5 tests + index.html + CLAUDE.md. `README.md`, `styles.css`, and `assets/*.png` remain unstaged.

- [ ] **Step 2: Commit**

Run:
```bash
git -c core.hooksPath=/dev/null commit -q -m "refactor: migrate modules into domain-based src/ tree (Option C)

Move flat root modules into src/{core,store,data,util,ui,audio}/ and
app.js -> src/main.js. Fix relative imports (main.js x11, db.js x1),
index.html entry, and test import paths. Tests stay flat in test/.
Behavior-preserving: 37 tests pass, browser smoke clean, no console
errors. Phase 1 of the combat-evolution spec; combat/UI files land in
this structure next."
git log --oneline -1
```
Expected: commit succeeds, prints the new commit line.

---

## Self-Review

- **Spec coverage:** Implements the spec's "Directory structure (Option C)" Step 1 (structure migration as an independent commit; app.js moved not split). Combat/UI/profile sections are intentionally out of scope for this plan (later phases).
- **Placeholder scan:** No TBD/TODO; every import path and command is explicit.
- **Type consistency:** No new symbols introduced; all exports/imports are unchanged in name, only paths move. Verified import names match current code (`rng`, `hashSeed/utcDateKey`, `normalizeProfile/recordRun/todayBest/playedToday`, `audio`, `buildShareString`, `paceDelta`, `PROFILE_ID/RUN_SECONDS/BOSS_START_SECONDS/MAX_HEALTH`, `openDb/getStore/makeId`, `spriteFrames/powerUpFrames/enemyFrames/varietyFrames/powerUpConfig/varietyPowerUpFrame`, `clamp/distance/distanceToSegment/formatDate`, `makeAvatarDataUrl/compressAvatar`, and test imports incl. `dailySeed`).
