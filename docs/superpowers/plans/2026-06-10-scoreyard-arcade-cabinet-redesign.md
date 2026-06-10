# Scoreyard Arcade Cabinet Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Scoreyard home/play screen into a single "arcade cabinet" (one marquee title, center play area, bottom coin panel), migrate the HUD from canvas rendering to a styled DOM bar, redesign the leaderboard, and apply a vivid retro-arcade look (CRT, pixel font, saturated neon).

**Architecture:** Presentation-only. `index.html` is restructured into a cabinet shell + separate leaderboard section. `styles.css` is reorganized around design tokens and component blocks. `src/main.js` gains an `updateHud()` DOM updater that reads live `game` state each frame; `src/render/draw.js` `drawHud()` becomes a no-op (DOM is the single source of truth). No gameplay logic, scoring, spawning, or persistence changes.

**Tech Stack:** Static ES modules, vanilla CSS, Canvas 2D. No build step, no runtime deps. Pixel font via self-hosted `@font-face` with a system fallback.

---

## File Structure

- **`index.html`** (modify) — replace `.app-shell` markup: marquee topbar (title once + player chip), cabinet body (DOM HUD bar + game-stage), coin panel (consolidated controls), and a redesigned leaderboard section. Template row updated for new leaderboard markup.
- **`styles.css`** (modify) — add `:root` design tokens + pixel `@font-face`; rewrite cabinet/marquee/HUD/coin-panel/home-overlay/profile-popover/leaderboard blocks; add CRT overlay + `prefers-reduced-motion` guards.
- **`src/main.js`** (modify) — add `updateHud()`; call it from the render path; stop hiding the DOM `.hud`; remove the reset-time placeholder writes that conflict.
- **`src/render/draw.js`** (modify) — make `drawHud()` a no-op (keep export to avoid breaking the import).
- **`assets/fonts/`** (create) — self-hosted pixel font `PressStart2P-Regular.woff2` (small, well under 1 MB).

No test files change. The unit suite covers pure modules only and must stay green.

---

## Verification model

This is presentation work; the repo has no UI unit tests. Each task verifies with:
- `node --check <file>` for any edited JS (also auto-run by the PostToolUse hook).
- `node --test test/*.test.js` — full suite stays green (must never regress).
- Manual visual check via `python3 -m http.server 8000` against the acceptance notes in each task.

---

## Task 1: Design tokens + pixel font foundation

**Files:**
- Create: `assets/fonts/PressStart2P-Regular.woff2`
- Modify: `styles.css:1` (top of file, before existing rules)

- [ ] **Step 1: Add the pixel font file**

Download the Press Start 2P woff2 (OFL-licensed, ~15 KB) into `assets/fonts/`:

```bash
mkdir -p assets/fonts
curl -L -o assets/fonts/PressStart2P-Regular.woff2 \
  "https://cdn.jsdelivr.net/fontsource/fonts/press-start-2p@latest/latin-400-normal.woff2"
ls -la assets/fonts/PressStart2P-Regular.woff2
```

Expected: file exists, size < 50 KB (safe under the 1 MB pre-commit guard).

- [ ] **Step 2: Declare the font + design tokens at the top of `styles.css`**

Insert at the very top of `styles.css` (line 1), before all existing rules:

```css
@font-face {
  font-family: "Press Start 2P";
  src: url("assets/fonts/PressStart2P-Regular.woff2") format("woff2");
  font-display: swap;
  font-weight: 400;
}

:root {
  /* Vivid retro arcade palette */
  --bg: #0a0612;
  --bg-2: #120a22;
  --panel: #160d28;
  --ink: #eafff9;
  --ink-dim: rgba(234, 255, 249, 0.6);
  --cyan: #00f0ff;
  --magenta: #ff2d95;
  --yellow: #ffd400;
  --lime: #39ff14;
  --danger: #ff4d4d;

  --pixel: "Press Start 2P", "Courier New", monospace;
  --mono: "Courier New", ui-monospace, monospace;

  --glow-cyan: 0 0 8px rgba(0, 240, 255, 0.7), 0 0 18px rgba(0, 240, 255, 0.4);
  --glow-magenta: 0 0 8px rgba(255, 45, 149, 0.7), 0 0 18px rgba(255, 45, 149, 0.4);
}
```

- [ ] **Step 3: Verify font loads and suite is green**

Run: `node --test test/*.test.js`
Expected: all tests pass (CSS/font change does not affect JS).

Serve and confirm the font file 200s:
Run: `python3 -m http.server 8000` then in another shell `curl -sI http://localhost:8000/assets/fonts/PressStart2P-Regular.woff2 | head -1`
Expected: `HTTP/1.0 200 OK`

- [ ] **Step 4: Commit**

```bash
git add assets/fonts/PressStart2P-Regular.woff2 styles.css
git commit -m "feat: add pixel font + retro design tokens"
```

---

## Task 2: Restructure index.html into cabinet + leaderboard

**Files:**
- Modify: `index.html:10-145` (the `<main class="app-shell">` block)

- [ ] **Step 1: Replace the app-shell markup**

Replace lines 10–146 (`<main class="app-shell">` … `</main>`) with this structure. It keeps every existing `id` the JS depends on (`storageStatus`, `avatarPreview`, `profileName`, `editProfile`, `profileForm`, `playerName`, `avatarInput`, `scoreValue`, `orbValue`, `healthValue`, `timeValue`, `comboValue`, `shieldValue`, `paceValue`, `muteToggle`, `gameCanvas`, `homeScreen`, `dailyTag`, `dailySeedLabel`, `dailySub`, `todayBestValue`, `allTimeBestValue`, `homeStartGame`, `shareResult`, `freeStartGame`, `startGame`, `endGame`, `scoreSearch`, `scoreFilter`, `scoreRows`, `emptyState`):

```html
    <main class="app-shell">
      <section class="cabinet" aria-labelledby="game-title">
        <!-- MARQUEE: title once + player chip -->
        <header class="marquee">
          <h1 id="game-title" class="marquee-title">Scoreyard</h1>
          <div class="player-badge">
            <div class="profile-summary">
              <img id="avatarPreview" alt="Current player avatar">
              <strong id="profileName">Guest player</strong>
              <button type="button" id="editProfile" class="edit-profile" aria-expanded="false">Edit</button>
            </div>
            <form id="profileForm" class="profile-form profile-popover" style="display: none">
              <label>
                Display name
                <input id="playerName" name="playerName" autocomplete="name" maxlength="40" placeholder="Alex Rivera">
              </label>
              <label class="avatar-picker">
                Avatar upload
                <input id="avatarInput" name="avatarInput" type="file" accept="image/*">
              </label>
              <button type="submit">Save profile</button>
            </form>
          </div>
          <div class="storage-status" id="storageStatus">Checking storage...</div>
        </header>

        <!-- DOM HUD bar (visible during play) -->
        <div class="hud" id="hudBar" aria-live="off">
          <div><span class="hud-label">Score</span><strong id="scoreValue">0</strong></div>
          <div><span class="hud-label">Orbs</span><strong id="orbValue">0</strong></div>
          <div><span class="hud-label">Hull</span><strong id="healthValue">3</strong></div>
          <div><span class="hud-label">Time</span><strong id="timeValue">75</strong></div>
          <div><span class="hud-label">Combo</span><strong id="comboValue">x1</strong></div>
          <div><span class="hud-label">Shield</span><strong id="shieldValue">0</strong></div>
          <div><span class="hud-label">Pace</span><strong id="paceValue">—</strong></div>
        </div>

        <!-- CENTER: pure play area -->
        <div class="game-stage">
          <button type="button" class="mute-toggle" id="muteToggle" aria-label="Toggle sound" aria-pressed="false">♪ on</button>
          <canvas id="gameCanvas" width="720" height="460" aria-label="Collect orbit crystals, grab shields, and dodge coral hazards"></canvas>
          <div class="home-screen" id="homeScreen">
            <div class="home-content">
              <div class="daily-card">
                <p class="daily-tag" id="dailyTag">★ Today's Challenge · <span id="dailySeedLabel">—</span></p>
                <p class="daily-sub" id="dailySub">Everyone plays the same arena today.</p>
                <div class="daily-stats">
                  <div class="stat-chip"><span class="stat-label">Today best</span><strong id="todayBestValue">—</strong></div>
                  <div class="stat-chip"><span class="stat-label">All-time</span><strong id="allTimeBestValue">0</strong></div>
                </div>
                <button type="button" class="primary-btn arcade-start" id="homeStartGame">▶ Play today</button>
                <button type="button" class="ghost-btn share-btn" id="shareResult" hidden>⧉ Copy result</button>
              </div>
              <div class="freeplay-row">
                <div class="freeplay-copy">
                  <strong>Free Play</strong>
                  <span>unlimited practice · random arena</span>
                </div>
                <button type="button" class="ghost-btn" id="freeStartGame">Start</button>
              </div>
            </div>
          </div>
        </div>

        <!-- BOTTOM: coin panel (consolidated controls) -->
        <div class="coin-panel">
          <button type="button" class="primary-btn coin-start" id="startGame">▶ Insert coin</button>
          <button type="button" class="coin-end" id="endGame">End run</button>
          <span class="hint">Move with WASD, arrows, or drag. Collect crystals, power-ups, and survive the Core Warden boss phase.</span>
        </div>
      </section>

      <section class="leaderboard-panel" aria-labelledby="leaderboard-title">
        <div class="section-head">
          <h2 id="leaderboard-title" class="board-title">High Scores</h2>
          <div class="filters" aria-label="Leaderboard filters">
            <input id="scoreSearch" type="search" placeholder="Filter players">
            <select id="scoreFilter" aria-label="Score filter">
              <option value="all">All scores</option>
              <option value="mine">My scores</option>
              <option value="today">Today</option>
            </select>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player</th>
                <th scope="col">Score</th>
                <th scope="col">Orbs</th>
                <th scope="col">Length</th>
                <th scope="col">Saved</th>
              </tr>
            </thead>
            <tbody id="scoreRows"></tbody>
          </table>
        </div>
        <p class="empty-state" id="emptyState">No scores yet. Start a run to seed the board.</p>
      </section>
    </main>
```

- [ ] **Step 2: Update the leaderboard row template**

The new table has a leading rank column. Replace the `<template id="scoreRowTemplate">` block (index.html:148-164) with:

```html
    <template id="scoreRowTemplate">
      <tr>
        <td class="rank-cell"></td>
        <td>
          <div class="player-cell">
            <img alt="">
            <div>
              <strong></strong>
              <span></span>
            </div>
          </div>
        </td>
        <td class="score-cell"></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </template>
```

- [ ] **Step 3: Check the leaderboard renderer for column assumptions**

Run: `grep -n "querySelectorAll(\"td\")\|children\[\|rank\|cells\[" src/main.js`
Expected: review how rows are filled. If the renderer indexes `td` cells positionally (e.g. `cells[1]`), it must be updated for the new leading rank cell in Task 9. Note the line numbers for Task 9.

- [ ] **Step 4: Verify nothing JS-referenced is missing**

Run: `for id in storageStatus avatarPreview profileName editProfile profileForm playerName avatarInput scoreValue orbValue healthValue timeValue comboValue shieldValue paceValue muteToggle gameCanvas homeScreen dailyTag dailySeedLabel dailySub todayBestValue allTimeBestValue homeStartGame shareResult freeStartGame startGame endGame scoreSearch scoreFilter scoreRows emptyState scoreRowTemplate; do grep -q "id=\"$id\"" index.html || echo "MISSING: $id"; done`
Expected: no output (every id still present).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "refactor: restructure markup into arcade cabinet + leaderboard"
```

---

## Task 3: Cabinet shell + marquee styling

**Files:**
- Modify: `styles.css` (replace the `.app-shell`, `.game-panel`/cabinet, `.topbar`/marquee blocks)

- [ ] **Step 1: Replace shell + marquee CSS**

Find the existing `.app-shell` rule (around `styles.css:120`) and the `.topbar` blocks. Replace the shell/panel/topbar rules with these cabinet rules (delete the old `.game-panel`, `.topbar`, `.topbar-right`, `.eyebrow` rules they supersede):

```css
body {
  min-height: 100dvh;
  margin: 0;
  background: radial-gradient(circle at 50% 0%, var(--bg-2), var(--bg) 70%);
  color: var(--ink);
  font-family: var(--mono);
}

.app-shell {
  max-width: 980px;
  margin: 0 auto;
  padding: 28px 18px 64px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.cabinet {
  position: relative;
  border: 3px solid rgba(0, 240, 255, 0.35);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(0, 240, 255, 0.05), transparent 30%),
    var(--panel);
  box-shadow:
    0 0 0 1px rgba(255, 45, 149, 0.25),
    0 30px 80px rgba(0, 0, 0, 0.6),
    inset 0 0 60px rgba(0, 240, 255, 0.06);
  padding: 0 0 18px;
  overflow: hidden;
}

.marquee {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  background: linear-gradient(180deg, rgba(255, 45, 149, 0.18), rgba(0, 240, 255, 0.06));
  border-bottom: 2px solid rgba(0, 240, 255, 0.3);
  flex-wrap: wrap;
}

.marquee-title {
  margin: 0;
  font-family: var(--pixel);
  font-size: clamp(20px, 4.5vw, 34px);
  letter-spacing: 2px;
  color: var(--ink);
  text-transform: uppercase;
  text-shadow: var(--glow-cyan);
  animation: marquee-flicker 4.5s infinite steps(1);
}

@keyframes marquee-flicker {
  0%, 92%, 100% { opacity: 1; }
  93% { opacity: 0.78; }
  95% { opacity: 1; }
  96% { opacity: 0.85; }
}

.storage-status {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--lime);
  width: 100%;
  text-align: center;
  opacity: 0.8;
}
```

- [ ] **Step 2: Verify suite + visual**

Run: `node --test test/*.test.js`
Expected: all pass.

Serve (`python3 -m http.server 8000`) and confirm: single neon "SCOREYARD" in the marquee, player chip on the right, cabinet frame around everything, no duplicate title.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: style arcade cabinet shell + marquee"
```

---

## Task 4: DOM HUD bar styling

**Files:**
- Modify: `styles.css` (replace `.hud`, `.hud > div`, `.hud-label`, `.hud strong` blocks around `styles.css:275-313`)

- [ ] **Step 1: Replace HUD CSS**

```css
.hud {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 12px 18px;
  background: rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(0, 240, 255, 0.2);
}

.hud.is-hidden { display: none; }

.hud > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hud-label {
  font-family: var(--pixel);
  font-size: 7px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink-dim);
}

.hud strong {
  font-family: var(--pixel);
  font-size: 13px;
  color: var(--cyan);
  text-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
}

.hud strong.is-low { color: var(--danger); text-shadow: 0 0 6px rgba(255, 77, 77, 0.6); }
.hud strong.is-hot { color: var(--yellow); text-shadow: 0 0 6px rgba(255, 212, 0, 0.6); }

@media (max-width: 720px) {
  .hud { grid-template-columns: repeat(4, 1fr); }
}
```

- [ ] **Step 2: Verify**

Run: `node --test test/*.test.js`
Expected: all pass. Visual: HUD bar renders below the marquee (values are static defaults until Task 5 wires live updates).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: style DOM HUD bar"
```

---

## Task 5: Migrate HUD from canvas to DOM

**Files:**
- Modify: `src/main.js` (lines ~90-93 legacy-hide block; ~355-362 reset block; render path ~554; add `updateHud`)
- Modify: `src/render/draw.js` (`drawHud` around line 626)

- [ ] **Step 1: Stop hiding the DOM HUD and grab the bar element**

In `src/main.js`, replace the legacy-HUD hide block (currently around lines 90-93):

```js
  // The player HUD is now drawn on the canvas (drawHud); hide the legacy DOM grid.
  const legacyHud = document.querySelector(".hud");
  if (legacyHud) {
    legacyHud.style.display = "none";
  }
```

with:

```js
  // The player HUD lives in the DOM bar (#hudBar); shown only while playing.
  const hudBar = document.getElementById("hudBar");
```

- [ ] **Step 2: Add the `updateHud` function**

Add this function inside the same module scope (place it directly above the `syncHomeScreen` function, around line 561). It mirrors exactly what the old canvas `drawHud` computed:

```js
  function updateHud() {
    const playing = game.status === "playing";
    if (hudBar) {
      hudBar.classList.toggle("is-hidden", !playing);
    }
    if (!playing) {
      return;
    }
    const displayScore = Math.max(0, Math.round(game.score + game.health * 100));
    const remain = Math.max(0, Math.ceil(RUN_SECONDS - game.elapsed));
    const time = `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}`;

    scoreValue.textContent = String(displayScore);
    orbValue.textContent = String(game.orbCount);
    healthValue.textContent = String(game.health);
    timeValue.textContent = time;
    comboValue.textContent = `×${game.combo}`;
    shieldValue.textContent = String(game.shield);

    healthValue.classList.toggle("is-low", game.health <= 1);
    timeValue.classList.toggle("is-low", remain <= 10);
    comboValue.classList.toggle("is-hot", game.combo > 1);

    if (currentBestCurve) {
      const delta = paceDelta(displayScore, game.elapsed, currentBestCurve);
      paceValue.textContent = delta > 0 ? `+${delta}` : String(delta);
      paceValue.classList.toggle("is-low", delta < 0);
      paceValue.classList.toggle("is-hot", delta >= 0);
    } else {
      paceValue.textContent = "—";
      paceValue.classList.remove("is-low", "is-hot");
    }
  }
```

- [ ] **Step 3: Confirm `paceDelta` is imported**

Run: `grep -n "paceDelta" src/main.js`
Expected: an existing `import { paceDelta }` line. If absent, add `import { paceDelta } from "./util/pace.js";` near the other imports.

- [ ] **Step 4: Call `updateHud` from the render path and drop the canvas HUD call**

In `src/main.js`, find the render block (around line 554) that calls `drawBossBar(); drawHud();`. Replace `drawHud();` with `updateHud();`:

```js
    drawBossBar();
    updateHud();
```

- [ ] **Step 5: Remove the now-redundant `drawHud` import usage and neutralize the canvas drawHud**

In `src/render/draw.js`, replace the body of `drawHud` (line 626 onward) so it no longer paints over the canvas, keeping the export so any remaining import does not break:

```js
export function drawHud() {
  // HUD now lives in the DOM bar (#hudBar), updated by main.js updateHud().
  // Kept as a no-op export for backward-compatible imports.
}
```

Remove the unused `drawHud` import from `src/main.js` if it is no longer referenced there:

Run: `grep -n "drawHud" src/main.js`
Expected: no references remain (we replaced the call with `updateHud`). If `drawHud` still appears only in the import list, delete it from the import braces.

- [ ] **Step 6: Syntax-check and run suite**

Run: `node --check src/main.js && node --check src/render/draw.js && node --test test/*.test.js`
Expected: no syntax errors; all tests pass.

- [ ] **Step 7: Manual play verification**

Serve and start a run. Confirm: HUD bar values update live (Score, Orbs, Hull, Time counting down, Combo, Shield, Pace), the canvas no longer draws the old corner HUD text, HUD bar hides on the home screen and reappears during play.

- [ ] **Step 8: Commit**

```bash
git add src/main.js src/render/draw.js
git commit -m "feat: migrate HUD from canvas to DOM bar"
```

---

## Task 6: Home overlay (daily card + freeplay) styling

**Files:**
- Modify: `styles.css` (replace `.home-screen`, `.home-content`, `.daily-card`, `.daily-tag`, `.daily-stats`, `.stat-chip`, `.freeplay-row` blocks; remove `.home-kicker`/duplicate `h2` rules)

- [ ] **Step 1: Replace home overlay CSS**

```css
.game-stage { position: relative; }

.home-screen {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(8, 4, 16, 0.82);
  backdrop-filter: blur(2px);
}

.home-screen.is-hidden { display: none; }

.home-content {
  width: min(420px, 90%);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.daily-card {
  border: 2px solid rgba(255, 45, 149, 0.4);
  border-radius: 14px;
  background: rgba(22, 13, 40, 0.92);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--glow-magenta);
}

.daily-tag {
  margin: 0;
  font-family: var(--pixel);
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--yellow);
  text-transform: uppercase;
}

.daily-sub { margin: 0; font-size: 12px; color: var(--ink-dim); }

.daily-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.stat-chip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
}

.stat-label {
  font-family: var(--pixel);
  font-size: 7px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink-dim);
}

.stat-chip strong { font-family: var(--pixel); font-size: 16px; color: var(--cyan); }

.freeplay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid rgba(0, 240, 255, 0.2);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
}

.freeplay-copy { display: flex; flex-direction: column; gap: 2px; }
.freeplay-copy strong { font-size: 13px; color: var(--ink); }
.freeplay-copy span { font-size: 10px; color: var(--ink-dim); }
```

- [ ] **Step 2: Verify**

Run: `node --test test/*.test.js`
Expected: all pass. Visual: daily card centered over the canvas, two stat chips, vivid CTA, freeplay row below; overlay disappears when a run starts.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: style home overlay daily card + freeplay"
```

---

## Task 7: Coin panel + arcade buttons

**Files:**
- Modify: `styles.css` (replace `.controls-row` block ~455 with `.coin-panel`; add `.primary-btn`, `.ghost-btn`, `.coin-start`, `.coin-end`, `.arcade-start` button styles)

- [ ] **Step 1: Replace controls CSS with coin-panel + arcade buttons**

```css
.coin-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 22px 4px;
  flex-wrap: wrap;
}

.coin-panel .hint {
  flex: 1 1 240px;
  min-width: 200px;
  font-size: 11px;
  color: var(--ink-dim);
  line-height: 1.5;
}

.primary-btn,
.ghost-btn,
.coin-end {
  font-family: var(--pixel);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  border: none;
  border-radius: 10px;
  padding: 14px 18px;
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}

.primary-btn {
  color: #061018;
  background: linear-gradient(180deg, var(--cyan), #00b8cc);
  box-shadow: 0 5px 0 #007a8a, var(--glow-cyan);
}

.primary-btn:hover { transform: translateY(2px); box-shadow: 0 3px 0 #007a8a, var(--glow-cyan); }
.primary-btn:active { transform: translateY(5px); box-shadow: 0 0 0 #007a8a, var(--glow-cyan); }

.arcade-start {
  background: linear-gradient(180deg, var(--lime), #1fbf0a);
  box-shadow: 0 5px 0 #128000, 0 0 14px rgba(57, 255, 20, 0.5);
}

.ghost-btn,
.coin-end {
  color: var(--ink);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 240, 255, 0.35);
  box-shadow: 0 4px 0 rgba(0, 240, 255, 0.2);
}

.ghost-btn:hover,
.coin-end:hover { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0, 240, 255, 0.2); }

.coin-end { border-color: rgba(255, 45, 149, 0.45); box-shadow: 0 4px 0 rgba(255, 45, 149, 0.25); }
```

- [ ] **Step 2: Verify the duplicate-control intent**

The bottom `#startGame` ("Insert coin") and `#endGame` remain wired by existing JS; the home overlay `#homeStartGame` / `#freeStartGame` are the primary entry points. This matches the spec (consolidated start; END only relevant during play). No JS change needed — confirm both still trigger runs:

Run: `grep -n "startGame\b\|endGame\b\|homeStartGame\|freeStartGame" src/main.js | head`
Expected: existing click handlers present for each id.

- [ ] **Step 3: Verify suite + visual**

Run: `node --test test/*.test.js`
Expected: all pass. Visual: chunky arcade buttons with bottom shadow that "press down" on click.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "feat: style coin panel + physical arcade buttons"
```

---

## Task 8: Tidy profile popover

**Files:**
- Modify: `styles.css` (replace `.player-badge` blocks ~1081-1128)

- [ ] **Step 1: Replace player-badge + popover CSS**

```css
.player-badge { position: relative; }

.player-badge .profile-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
}

.player-badge .profile-summary img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.1);
}

.player-badge .profile-summary strong { font-size: 12px; color: var(--ink); }

.player-badge .edit-profile {
  font-family: var(--pixel);
  font-size: 7px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--cyan);
  background: none;
  border: 1px solid rgba(0, 240, 255, 0.4);
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
}

.player-badge .profile-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 2px solid rgba(0, 240, 255, 0.4);
  border-radius: 12px;
  background: var(--panel);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), var(--glow-cyan);
}

.player-badge .profile-popover label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: var(--pixel);
  font-size: 7px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink-dim);
}

.player-badge .profile-popover input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 8px;
}

.player-badge .profile-popover button[type="submit"] {
  font-family: var(--pixel);
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #061018;
  background: linear-gradient(180deg, var(--cyan), #00b8cc);
  border: none;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
}

@media (max-width: 720px) {
  .player-badge .profile-popover { right: auto; left: 0; }
}
```

- [ ] **Step 2: Verify**

Run: `node --test test/*.test.js`
Expected: all pass. Visual: click `EDIT` → popover opens below the chip, inputs full-width with padding (no clipping), clear shadow/elevation, "Save profile" button styled.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: tidy profile editing popover"
```

---

## Task 9: Leaderboard redesign

**Files:**
- Modify: `styles.css` (replace `.leaderboard-panel`, `.section-head`, `.filters`, table, `.player-cell`, `.score-cell`, `.empty-state` blocks; add `.rank-cell`, `.board-title`)
- Modify: `src/main.js` (leaderboard row fill — add rank cell, per the line numbers noted in Task 2 Step 3)

- [ ] **Step 1: Wire the rank cell in the row renderer**

Using the renderer location found in Task 2 Step 3, populate the new `.rank-cell`. Locate the function that clones `scoreRowTemplate` and fills cells (search `scoreRowTemplate.content` in `src/main.js`). Inside the per-row loop, set the rank from the row index (1-based). Add, right after the row clone is created:

```js
      row.querySelector(".rank-cell").textContent = String(index + 1);
```

Ensure the surrounding `.forEach`/loop exposes `index` (use `entries.forEach((entry, index) => { … })`). If the existing loop has no index, convert it to include one. Do not change any score/orb/length/saved cell assignments — they still target the same `.player-cell`, `.score-cell`, and the trailing `<td>`s, whose order is unchanged after the leading rank cell.

- [ ] **Step 2: Replace leaderboard CSS**

```css
.leaderboard-panel {
  border: 2px solid rgba(0, 240, 255, 0.25);
  border-radius: 16px;
  background: var(--panel);
  padding: 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.board-title {
  margin: 0;
  font-family: var(--pixel);
  font-size: 16px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--magenta);
  text-shadow: var(--glow-magenta);
}

.filters { display: flex; gap: 8px; }

.filters input,
.filters select {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 8px;
  padding: 8px 10px;
}

.table-wrap { overflow-x: auto; }

table { width: 100%; border-collapse: collapse; }

thead th {
  font-family: var(--pixel);
  font-size: 7px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink-dim);
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 240, 255, 0.2);
}

tbody td {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  color: var(--ink);
}

.rank-cell {
  font-family: var(--pixel);
  font-size: 12px;
  color: var(--yellow);
  width: 36px;
}

.player-cell { display: flex; align-items: center; gap: 10px; }
.player-cell img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,0.1); }
.player-cell strong { display: block; font-size: 13px; }
.player-cell span { font-size: 10px; color: var(--ink-dim); }

.score-cell { font-family: var(--pixel); font-size: 13px; color: var(--cyan); }

.empty-state { text-align: center; color: var(--ink-dim); font-size: 12px; padding: 18px; }
```

- [ ] **Step 3: Syntax-check + suite + visual**

Run: `node --check src/main.js && node --test test/*.test.js`
Expected: no errors; all pass. Serve, complete a run so a score saves, and confirm: ranked rows (1, 2, 3 …), avatar + name, cyan score, magenta "HIGH SCORES" header, filter/search work.

- [ ] **Step 4: Commit**

```bash
git add styles.css src/main.js
git commit -m "feat: redesign leaderboard with rank column + retro styling"
```

---

## Task 10: CRT overlay, reduced-motion, final polish

**Files:**
- Modify: `styles.css` (append CRT overlay + reduced-motion block; remove any now-dead old rules)

- [ ] **Step 1: Add CRT scanline overlay + vignette**

Append to `styles.css`:

```css
.cabinet::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 18px;
  background:
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0,
      rgba(0, 0, 0, 0) 2px,
      rgba(0, 0, 0, 0.12) 3px
    ),
    radial-gradient(circle at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.4));
  z-index: 5;
}

.cabinet > * { position: relative; z-index: 6; }
```

- [ ] **Step 2: Add reduced-motion guard**

Append to `styles.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .marquee-title { animation: none; }
  .primary-btn,
  .ghost-btn,
  .coin-end { transition: none; }
}
```

- [ ] **Step 3: Remove dead CSS**

Search for rules orphaned by the restructure and delete them if present (old `.eyebrow`, `.home-kicker`, `.topbar-right`, `.hud-pop`, old `.game-panel::before`, duplicate `h2` in `.home-content`):

Run: `grep -n "\.eyebrow\|\.home-kicker\|\.topbar-right\|\.hud-pop\|\.game-panel" styles.css`
Expected: review each hit; delete rules that no longer match any element in `index.html`. Verify nothing referenced by remaining markup is removed:

Run: `grep -o 'class="[^"]*"' index.html | tr ' ' '\n' | grep -oE '[a-z-]+' | sort -u > /tmp/used-classes.txt && wc -l /tmp/used-classes.txt`
Expected: spot-check that each class still has a styling rule.

- [ ] **Step 4: Full verification pass**

Run: `node --check src/main.js && node --check src/render/draw.js && node --test test/*.test.js`
Expected: no errors; all tests pass.

Serve and walk the full acceptance checklist:
- Single marquee title; no duplicate "SCOREYARD".
- Home overlay: daily card + stats + freeplay; CTAs start runs.
- During play: DOM HUD bar updates live; canvas has no corner HUD text.
- Profile `EDIT` popover is aligned, no clipping.
- Leaderboard: ranked, styled, filters work.
- CRT scanlines/vignette visible; with OS "reduce motion" on, marquee flicker stops.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat: CRT overlay, reduced-motion guard, remove dead CSS"
```

---

## Self-Review Notes (author)

- **Spec coverage:** vivid palette + pixel font (T1), CRT/reduced-motion (T10), cabinet layout + single title (T2/T3), consolidated controls (T2/T7), DOM HUD migration (T4/T5), tidied popover (T8), redesigned leaderboard separate section (T2/T9). All spec sections mapped.
- **Out-of-scope respected:** no gameplay/scoring/persistence changes; no new large binaries (font < 50 KB); no network leaderboard.
- **Type/selector consistency:** ids preserved (T2 Step 4 guard); `updateHud` reads the same `game` fields the old `drawHud` used; `.is-hidden`/`.is-low`/`.is-hot` classes defined in CSS (T4) and toggled in JS (T5); `.rank-cell` defined in template (T2), filled in JS (T9), styled in CSS (T9).
- **Risk flagged:** Task 9 Step 1 depends on the actual leaderboard renderer shape — Task 2 Step 3 captures the exact line numbers/loop form before editing.
