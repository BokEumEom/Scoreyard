import * as rng from "./core/rng.js";
import { hashSeed, utcDateKey } from "./core/seed.js";
import { normalizeProfile, recordRun, todayBest, playedToday } from "./store/store.js";
import * as audio from "./audio/audio.js";
import { buildShareString } from "./ui/share.js";
import { PROFILE_ID, RUN_SECONDS } from "./core/config.js";
import { openDb, getStore, makeId } from "./store/db.js";
import { varietyFrames, bossVariantFrames, arenaPropFrames } from "./data/sprites.js";
import { distance, formatDate } from "./util/mathx.js";
import { makeAvatarDataUrl, compressAvatar } from "./ui/avatar.js";
import { canvas, ctx } from "./core/dom.js";
import { keys } from "./core/input.js";
import { game } from "./game/state.js";
import { makeHazard, makeOrb, makePowerUp } from "./game/spawn.js";
import { updateGame, runScore, setOnRunEnd } from "./game/loop.js";
import { assets, setRedraw } from "./render/assets.js";
import {
  imageReady,
  drawVarietySprite,
  drawBackground,
  drawOrb,
  drawHazard,
  drawPowerUp,
  drawLasers,
  drawFxLayer,
  drawBolts,
  drawBoss,
  drawShockwaves,
  drawParticles,
  drawFloatingTexts,
  drawOverlay,
  drawBossBar,
  drawHud
} from "./render/draw.js";

  const profileForm = document.getElementById("profileForm");
  const playerNameInput = document.getElementById("playerName");
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");
  const profileName = document.getElementById("profileName");
  const editProfile = document.getElementById("editProfile");
  const storageStatus = document.getElementById("storageStatus");
  const scoreValue = document.getElementById("scoreValue");
  const orbValue = document.getElementById("orbValue");
  const healthValue = document.getElementById("healthValue");
  const timeValue = document.getElementById("timeValue");
  const comboValue = document.getElementById("comboValue");
  const shieldValue = document.getElementById("shieldValue");
  const paceValue = document.getElementById("paceValue");
  const startGameButton = document.getElementById("startGame");
  const homeScreen = document.getElementById("homeScreen");
  const homeStartGameButton = document.getElementById("homeStartGame");
  const freeStartGameButton = document.getElementById("freeStartGame");
  const endGameButton = document.getElementById("endGame");
  const scoreRows = document.getElementById("scoreRows");
  const scoreSearch = document.getElementById("scoreSearch");
  const scoreFilter = document.getElementById("scoreFilter");
  const emptyState = document.getElementById("emptyState");
  const scoreRowTemplate = document.getElementById("scoreRowTemplate");
  const dailyTag = document.getElementById("dailyTag");
  const dailySeedLabel = document.getElementById("dailySeedLabel");
  const dailySub = document.getElementById("dailySub");
  const todayBestValue = document.getElementById("todayBestValue");
  const allTimeBestValue = document.getElementById("allTimeBestValue");
  const muteToggle = document.getElementById("muteToggle");
  const shareResultButton = document.getElementById("shareResult");

  let profile = {
    id: PROFILE_ID,
    name: "",
    email: "",
    avatar: ""
  };
  let scores = [];
  let currentMode = "free"; // "daily" | "free" — locked at run start
  let currentDateKey = null; // UTC YYYY-MM-DD locked at run start (for daily best)
  let currentVisualKey = "idle"; // cosmetic-only seed key; does not consume gameplay rng
  let lastResult = null; // last finished run's stats (for the share string)
  let currentBestCurve = null; // best-run score-by-second curve for the active daily
  let avatarImage = new Image();
  let lastFrame = 0;
  let rafId = 0;

  // canvas/ctx, the game state object, and image assets now live in
  // ./core/dom.js, ./game/state.js, and ./render/assets.js (imported above).
  // setRedraw lets asset loads repaint without assets.js importing the renderer.
  setRedraw(drawScene);
  setOnRunEnd(endRun); // the loop calls this when a run finishes (time up / hull gone)

  // The player HUD is now drawn on the canvas (drawHud); hide the legacy DOM grid.
  const legacyHud = document.querySelector(".hud");
  if (legacyHud) {
    legacyHud.style.display = "none";
  }

  function visualUnit(key, salt) {
    return hashSeed(`${key}:${salt}`) / 0x100000000;
  }

  function visualInt(key, salt, min, max) {
    return Math.floor(visualUnit(key, salt) * (max - min + 1)) + min;
  }

  function visualRange(key, salt, min, max) {
    return min + visualUnit(key, salt) * (max - min);
  }

  function makeVisualKey() {
    if (currentMode === "daily") {
      return `daily:${currentDateKey}`;
    }

    return `free:${currentDateKey}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }

  function makeArenaProps(key) {
    const count = visualInt(key, "arena-prop-count", 6, 9);
    const margin = 58;

    return Array.from({ length: count }, (_, index) => {
      let x = visualRange(key, `arena-prop-x-${index}`, margin, canvas.width - margin);
      let y = visualRange(key, `arena-prop-y-${index}`, margin, canvas.height - margin);

      if (distance(x, y, canvas.width / 2, canvas.height / 2) < 105) {
        y = y < canvas.height / 2 ? margin : canvas.height - margin;
      }

      return {
        frame: visualInt(key, `arena-prop-frame-${index}`, 0, arenaPropFrames.length - 1),
        x,
        y,
        size: visualRange(key, `arena-prop-size-${index}`, 38, 78),
        rotation: visualRange(key, `arena-prop-rotation-${index}`, -Math.PI, Math.PI),
        alpha: visualRange(key, `arena-prop-alpha-${index}`, 0.16, 0.31),
        drift: visualRange(key, `arena-prop-drift-${index}`, 0.32, 0.9),
        bob: visualRange(key, `arena-prop-bob-${index}`, 1.2, 3.8),
        phase: visualRange(key, `arena-prop-phase-${index}`, 0, Math.PI * 2)
      };
    });
  }

  async function checkStorage() {
    try {
      await openDb();

      if (!navigator.storage || !navigator.storage.persist) {
        storageStatus.textContent = "IndexedDB storage ready";
        return;
      }

      const alreadyPersistent = await navigator.storage.persisted();
      const isPersistent = alreadyPersistent || await navigator.storage.persist();
      storageStatus.textContent = isPersistent
        ? "Persistent Sites storage active"
        : "IndexedDB storage ready";
    } catch (error) {
      storageStatus.textContent = "Storage unavailable";
      console.error(error);
    }
  }

  async function loadProfile() {
    const saved = await getStore("profile", "readonly", store => store.get(PROFILE_ID));
    // normalizeProfile fills v2 fields (best/daily/unlocks) for older records.
    profile = normalizeProfile(saved || profile);
    profile.id = PROFILE_ID;
    audio.setMuted(profile.muted);
    updateMuteButton();
    playerNameInput.value = profile.name || "";
    updateProfileUi();
  }

  // Final score for a run (leaderboard record AND best-tracking use this).

  // Populate the home-screen Daily card from the current profile. textContent
  // only (no innerHTML) — values are a UTC date string and integers, but we
  // keep the DOM API safe regardless.
  function refreshHome() {
    const key = utcDateKey();
    const best = todayBest(profile, key);
    const done = playedToday(profile, key);
    if (dailySeedLabel) {
      dailySeedLabel.textContent = key;
    }
    if (allTimeBestValue) {
      allTimeBestValue.textContent = String(profile.allTimeBest || 0);
    }
    if (todayBestValue) {
      todayBestValue.textContent = done ? String(best) : "—";
    }
    if (dailyTag) {
      dailyTag.textContent = done
        ? `✓ Played today · best ${best}`
        : `★ Today's Challenge · ${key}`;
    }
    if (dailySub) {
      dailySub.textContent = done
        ? "Beat it, or jump into Free Play."
        : "Everyone plays the same arena today.";
    }
    if (homeStartGameButton) {
      homeStartGameButton.textContent = done ? "↻ Replay today" : "▶ Play today";
    }
  }

  function updateMuteButton() {
    if (!muteToggle) return;
    muteToggle.textContent = profile.muted ? "♪ off" : "♪ on";
    muteToggle.setAttribute("aria-pressed", String(!!profile.muted));
  }

  async function toggleMute() {
    audio.unlock(); // this click is a user gesture — also unlocks audio
    profile = { ...profile, muted: !profile.muted };
    audio.setMuted(profile.muted);
    updateMuteButton();
    try {
      await getStore("profile", "readwrite", store => store.put(profile));
    } catch (error) {
      console.error("Failed to save mute:", error);
    }
  }

  // Copy the last daily run's shareable result (no PII — see share.js).
  async function copyShare() {
    if (!lastResult || !shareResultButton) {
      return;
    }
    const text = buildShareString(lastResult);
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (error) {
      ok = false;
    }
    if (!ok) {
      // Fallback for non-secure contexts / older browsers.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (error) {
        ok = false;
      }
    }
    shareResultButton.textContent = ok ? "✓ Copied!" : "⧉ Copy failed";
    setTimeout(() => {
      shareResultButton.textContent = "⧉ Copy result";
    }, 2000);
  }

  async function saveProfile() {
    const cleanName = playerNameInput.value.trim();

    profile = {
      ...profile,
      id: PROFILE_ID,
      name: cleanName,
      email: "", // email removed (Plan 5); kept empty for schema compatibility
      updatedAt: new Date().toISOString()
    };

    await getStore("profile", "readwrite", store => store.put(profile));
    updateProfileUi();
    renderScores();
    profileForm.style.display = "none";
  }

  async function loadScores() {
    scores = await getStore("scores", "readonly", store => store.getAll());
    scores.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    renderScores();
  }

  async function saveScore() {
    const record = {
      id: makeId(),
      playerName: profile.name || "Guest player",
      avatar: profile.avatar || "",
      score: runScore(),
      orbs: game.orbCount,
      maxCombo: game.maxCombo,
      seconds: Math.round(game.elapsed),
      createdAt: new Date().toISOString()
    };

    await getStore("scores", "readwrite", store => store.put(record));
    scores.unshift(record);
    scores.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    renderScores();
  }

  function updateProfileUi() {
    const name = profile.name || "Guest player";
    const avatar = profile.avatar || makeAvatarDataUrl(name);

    profileName.textContent = name;
    avatarPreview.src = avatar;
    avatarImage = new Image();
    avatarImage.src = avatar;
    drawScene();
  }

  function resetGame() {
    game.status = "idle";
    game.player.x = canvas.width / 2;
    game.player.y = canvas.height / 2;
    game.playerVariant = 0;
    game.backdropVariant = 0;
    game.bossVariant = 0;
    game.arenaProps = [];
    game.hazards = [];
    game.orbs = [];
    game.powerUps = [];
    game.lasers = [];
    game.bolts = [];
    game.fireTimer = 0;
    game.fx = [];
    game.particles = [];
    game.shockwaves = [];
    game.floatingTexts = [];
    game.boss = null;
    game.bossSpawned = false;
    game.score = 0;
    game.orbCount = 0;
    game.health = 3;
    game.shield = 0;
    game.magnetTimer = 0;
    game.scoreBoostTimer = 0;
    game.phaseTimer = 0;
    game.combo = 1;
    game.maxCombo = 1;
    game.comboTimer = 0;
    game.elapsed = 0;
    game.invulnerable = 0;
    game.nextPowerUpAt = 5;
    game.nextHazardAt = 10;
    game.inputX = 0;
    game.inputY = 0;
    game.pointerActive = false;
    game.pointerX = game.player.x;
    game.pointerY = game.player.y;
    game.shake = 0;
    game.flash = 0;
    game.worldTime = 0;
    game.hitstop = 0;
    game.paceSamples = [];
    scoreValue.textContent = "0";
    orbValue.textContent = "0";
    healthValue.textContent = "3";
    timeValue.textContent = String(RUN_SECONDS);
    comboValue.textContent = "x1";
    shieldValue.textContent = "0";
    endGameButton.disabled = true;
    drawScene();
  }

  async function startRun(mode) {
    if (!profileForm.reportValidity()) {
      return;
    }

    await saveProfile();
    audio.unlock(); // started by a click — unlock/resume the AudioContext now
    audio.sfx.start();
    if (shareResultButton) {
      shareResultButton.hidden = true;
    }
    currentMode = mode === "daily" ? "daily" : "free";
    currentDateKey = utcDateKey(); // lock at run start (survives midnight rollover mid-run)
    // Pace comparison: load today's best-run curve if one exists for this seed.
    currentBestCurve =
      currentMode === "daily" &&
      profile.dailyBestCurve &&
      profile.dailyBestCurve.dateKey === currentDateKey
        ? profile.dailyBestCurve.curve
        : null;
    // Daily Challenge: seed from the same locked UTC date key saved with the run.
    // Free Play: fresh random seed each run (feels random, like before).
    rng.seed(currentMode === "daily" ? hashSeed(currentDateKey) : (Math.random() * 0xffffffff) >>> 0);
    currentVisualKey = makeVisualKey();
    game.status = "playing";
    game.player.x = canvas.width / 2;
    game.player.y = canvas.height / 2;
    game.playerVariant = rng.int(0, varietyFrames.players.length - 1);
    game.backdropVariant = rng.int(0, assets.backdrops.length - 1);
    game.bossVariant = visualInt(currentVisualKey, "boss-variant", 0, bossVariantFrames.length - 1);
    game.arenaProps = makeArenaProps(currentVisualKey);
    game.hazards = Array.from({ length: 3 }, () => makeHazard("mine"));
    game.orbs = Array.from({ length: 6 }, makeOrb);
    game.powerUps = [makePowerUp("shield"), makePowerUp("magnet")];
    game.lasers = [];
    game.bolts = [];
    game.fireTimer = 0;
    game.fx = [];
    game.particles = [];
    game.shockwaves = [];
    game.floatingTexts = [];
    game.boss = null;
    game.bossSpawned = false;
    game.score = 0;
    game.orbCount = 0;
    game.health = 3;
    game.shield = 0;
    game.magnetTimer = 0;
    game.scoreBoostTimer = 0;
    game.phaseTimer = 0;
    game.combo = 1;
    game.maxCombo = 1;
    game.comboTimer = 0;
    game.elapsed = 0;
    game.invulnerable = 0;
    game.nextPowerUpAt = 7;
    game.nextHazardAt = 9;
    game.pointerActive = false;
    game.pointerX = game.player.x;
    game.pointerY = game.player.y;
    game.shake = 0;
    game.flash = 0;
    game.worldTime = 0;
    game.hitstop = 0;
    game.paceSamples = [];
    lastFrame = performance.now();
    endGameButton.disabled = false;
    startGameButton.textContent = "Restart run";
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  async function endRun() {
    if (game.status !== "playing") {
      return;
    }

    game.status = "done";
    endGameButton.disabled = true;
    cancelAnimationFrame(rafId);

    const finalScore = runScore();
    await saveScore();

    // Update local bests (works even for guest players — best is local-only).
    const result = recordRun(profile, {
      mode: currentMode,
      dateKey: currentDateKey,
      score: finalScore,
    });
    profile = result.profile;
    profile.id = PROFILE_ID;
    // E2: a new daily best becomes the curve future runs chase.
    if (currentMode === "daily" && result.newDailyBest) {
      profile = {
        ...profile,
        dailyBestCurve: { dateKey: currentDateKey, curve: game.paceSamples.slice() },
      };
    }
    try {
      await getStore("profile", "readwrite", store => store.put(profile));
    } catch (error) {
      console.error("Failed to save bests:", error);
    }

    const beatBest =
      currentMode === "daily" ? result.newDailyBest : result.newAllTimeBest;
    if (beatBest) {
      audio.sfx.newBest();
    }

    // Stash this run's stats for the share string (daily runs only; no PII).
    lastResult = {
      dateKey: currentDateKey,
      score: finalScore,
      maxCombo: game.maxCombo,
      orbs: game.orbCount,
      beatBest,
    };
    if (shareResultButton) {
      shareResultButton.hidden = currentMode !== "daily";
      shareResultButton.textContent = "⧉ Copy result";
    }

    refreshHome();
    drawScene(beatBest ? "NEW BEST!" : "Run saved");
  }

  // Hitstop (E3): briefly freeze game advancement for impact, keep rendering.
  // Accumulated-time gate, never a busy-wait. Pausing also stops game.elapsed,
  // so it doesn't shift the seeded spawn schedule.

  // Auto-aim combat. Consumes NO seeded rng (determinism): targeting/bolt math is
  // pure; impact particles use Math.random (cosmetic). See the determinism contract.

  function tick(now) {
    const realDt = (now - lastFrame) / 1000;
    lastFrame = now;

    if (game.hitstop > 0) {
      game.hitstop = Math.max(0, game.hitstop - realDt);
      drawScene(); // hold the frozen frame
      if (game.status === "playing") {
        rafId = requestAnimationFrame(tick);
      }
      return;
    }

    const dt = Math.min(realDt, 0.035);
    updateGame(dt);
    drawScene();

    if (game.status === "playing") {
      rafId = requestAnimationFrame(tick);
    }
  }

  function drawScene(message) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    syncHomeScreen(message);
    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    drawBackground();
    game.orbs.forEach(drawOrb);
    game.powerUps.forEach(drawPowerUp);
    drawLasers();
    game.hazards.forEach(drawHazard);
    drawBolts();
    drawBoss();
    drawShockwaves();
    drawParticles();
    drawFxLayer();
    drawPlayer();
    drawFloatingTexts();
    ctx.restore();

    if (game.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.38, game.flash * 0.38);
      ctx.fillStyle = "#fafeff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    drawBossBar();
    drawHud();

    if (game.status !== "playing") {
      drawOverlay(message || "Start a run when ready");
    }
  }

  function syncHomeScreen(message) {
    if (!homeScreen) {
      return;
    }

    homeScreen.classList.toggle("is-hidden", game.status === "playing");
    homeScreen.dataset.state = game.status;

    if (message) {
      homeScreen.dataset.message = message;
    }
  }

  function drawPlayer() {
    const { x, y, r } = game.player;
    const moving = Math.hypot(game.inputX, game.inputY) > 0.05;
    const alpha = game.invulnerable > 0 && Math.floor(game.invulnerable * 12) % 2 === 0 ? 0.45 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (moving) {
      const tailX = x - game.inputX * (r + 16);
      const tailY = y - game.inputY * (r + 16);
      const tail = ctx.createRadialGradient(tailX, tailY, 2, tailX, tailY, 34);
      tail.addColorStop(0, "rgba(226, 185, 59, 0.76)");
      tail.addColorStop(1, "rgba(226, 185, 59, 0)");
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.arc(tailX, tailY, 34, 0, Math.PI * 2);
      ctx.fill();
    }

    if (game.shield > 0) {
      ctx.strokeStyle = "rgba(73, 182, 255, 0.75)";
      ctx.lineWidth = 4;
      ctx.setLineDash([9, 8]);
      ctx.lineDashOffset = -game.worldTime * 28;
      ctx.beginPath();
      ctx.arc(x, y, r + 13 + Math.sin(game.worldTime * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (game.magnetTimer > 0 || game.scoreBoostTimer > 0 || game.phaseTimer > 0) {
      const auraColor = game.phaseTimer > 0
        ? "rgba(138, 215, 255, 0.42)"
        : game.scoreBoostTimer > 0
          ? "rgba(226, 185, 59, 0.38)"
          : "rgba(183, 108, 255, 0.34)";
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 24 + Math.sin(game.worldTime * 6) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    const shipSize = r * 5.4;
    const tilt = moving ? game.inputX * 0.14 : Math.sin(game.worldTime * 2) * 0.025;

    if (drawVarietySprite("players", game.playerVariant, x, y + 2, shipSize, tilt, alpha)) {
      ctx.restore();
      return;
    }

    if (imageReady(assets.player)) {
      ctx.save();
      ctx.translate(x, y + 2);
      ctx.rotate(tilt);
      ctx.shadowColor = "rgba(44, 242, 143, 0.55)";
      ctx.shadowBlur = 18;
      ctx.drawImage(assets.player, -shipSize / 2, -shipSize / 2, shipSize, shipSize);
      ctx.restore();
      ctx.restore();
      return;
    }

    ctx.shadowColor = "rgba(44, 242, 143, 0.65)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = "#147d73";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(199, 244, 223, 0.88)";
    ctx.beginPath();
    ctx.moveTo(x - r - 14, y + 4);
    ctx.lineTo(x - r - 3, y - 9);
    ctx.lineTo(x - r + 3, y + 11);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + r + 14, y + 4);
    ctx.lineTo(x + r + 3, y - 9);
    ctx.lineTo(x + r - 3, y + 11);
    ctx.closePath();
    ctx.fill();

    drawAvatarCore(x, y, r + 1, alpha);
    ctx.restore();
  }

  function drawAvatarCore(x, y, radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(7, 24, 23, 0.76)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(199, 244, 223, 0.92)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    if (avatarImage.complete && avatarImage.naturalWidth) {
      ctx.drawImage(avatarImage, x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = "#c7f4df";
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }

  // Additive-blended combat-fx atlas (4x3). Black background contributes nothing
  // under "lighter", so the glows pop. Returns false if the atlas isn't loaded yet.

  function renderScores() {
    const query = scoreSearch.value.trim().toLowerCase();
    const filter = scoreFilter.value;
    const today = new Date().toDateString();
    const myName = profile.name || "Guest player";

    const visibleScores = scores
      .filter(score => {
        const matchesQuery = !query
          || score.playerName.toLowerCase().includes(query);
        const matchesMine = filter !== "mine" || score.playerName === myName;
        const matchesToday = filter !== "today" || new Date(score.createdAt).toDateString() === today;
        return matchesQuery && matchesMine && matchesToday;
      })
      .slice(0, 50);

    scoreRows.innerHTML = "";
    visibleScores.forEach(score => {
      const row = scoreRowTemplate.content.firstElementChild.cloneNode(true);
      const avatar = row.querySelector("img");
      const name = row.querySelector(".player-cell strong");
      const email = row.querySelector(".player-cell span");
      const cells = row.querySelectorAll("td");

      avatar.src = score.avatar || makeAvatarDataUrl(score.playerName);
      avatar.alt = `${score.playerName} avatar`;
      name.textContent = score.playerName;
      email.textContent = score.maxCombo ? `×${score.maxCombo} combo` : "";
      cells[1].textContent = String(score.score);
      cells[2].textContent = String(score.orbs);
      cells[3].textContent = `${score.seconds}s`;
      cells[4].textContent = formatDate(score.createdAt);
      scoreRows.appendChild(row);
    });

    emptyState.classList.toggle("is-visible", visibleScores.length === 0);
  }

  profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    await saveProfile();
  });

  if (editProfile) {
    editProfile.addEventListener("click", () => {
      const open = profileForm.style.display !== "none";
      profileForm.style.display = open ? "none" : "grid";
      editProfile.textContent = open ? "Edit" : "Close";
      if (!open) {
        playerNameInput.focus();
      }
    });
  }

  avatarInput.addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      return;
    }

    try {
      profile.avatar = await compressAvatar(file);
      await saveProfile();
    } catch (error) {
      alert(error.message);
      avatarInput.value = "";
    }
  });

  startGameButton.addEventListener("click", () => startRun("free"));
  homeStartGameButton.addEventListener("click", () => startRun("daily"));
  if (freeStartGameButton) {
    freeStartGameButton.addEventListener("click", () => startRun("free"));
  }
  if (muteToggle) {
    muteToggle.addEventListener("click", toggleMute);
  }
  if (shareResultButton) {
    shareResultButton.addEventListener("click", copyShare);
  }
  endGameButton.addEventListener("click", endRun);
  scoreSearch.addEventListener("input", renderScores);
  scoreFilter.addEventListener("change", renderScores);

  canvas.addEventListener("pointerdown", event => {
    canvas.setPointerCapture(event.pointerId);
    game.pointerActive = true;
    updatePointerTarget(event);
  });

  canvas.addEventListener("pointermove", event => {
    if (game.pointerActive) {
      updatePointerTarget(event);
    }
  });

  canvas.addEventListener("pointerup", event => {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    game.pointerActive = false;
  });

  canvas.addEventListener("pointercancel", () => {
    game.pointerActive = false;
  });

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
      keys.add(key);
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", event => {
    keys.delete(event.key.toLowerCase());
  });

  function updatePointerTarget(event) {
    const rect = canvas.getBoundingClientRect();
    game.pointerX = (event.clientX - rect.left) / rect.width * canvas.width;
    game.pointerY = (event.clientY - rect.top) / rect.height * canvas.height;
  }

  async function init() {
    endGameButton.disabled = true;
    await checkStorage();
    await loadProfile();
    await loadScores();
    resetGame();
    refreshHome();
  }

  init().catch(error => {
    storageStatus.textContent = "Unable to start";
    console.error(error);
  });
