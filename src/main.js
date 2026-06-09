// app.js — Scoreyard game (ES module).
// Gameplay randomness routes through the seeded rng (rng.js) so the Daily
// Challenge can be deterministic; cosmetic randomness (stars, death particles,
// screen-shake) and makeId stay on Math.random. seed.js (UTC daily seed) is
// wired in when the Daily Challenge UI lands.
import * as rng from "./core/rng.js";
import { hashSeed, utcDateKey } from "./core/seed.js";
import { normalizeProfile, recordRun, todayBest, playedToday } from "./store/store.js";
import * as audio from "./audio/audio.js";
import { buildShareString } from "./ui/share.js";
import { paceDelta } from "./util/pace.js";
import { PROFILE_ID, RUN_SECONDS, BOSS_START_SECONDS, MAX_HEALTH } from "./core/config.js";
import { openDb, getStore, makeId } from "./store/db.js";
import {
  spriteFrames,
  powerUpFrames,
  enemyFrames,
  varietyFrames,
  bossVariantFrames,
  arenaPropFrames,
  powerUpConfig,
  varietyPowerUpFrame
} from "./data/sprites.js";
import { clamp, distance, distanceToSegment, formatDate } from "./util/mathx.js";
import { makeAvatarDataUrl, compressAvatar } from "./ui/avatar.js";
import { enemyConfig } from "./data/enemies.js";
import { acquireTarget, fireInterval, boltDamage, createBolt } from "./game/weapons.js";

const FIRE_RANGE = 320; // px: auto-aim acquisition radius
const BOLT_SPEED = 560; // px/s: bolt travel speed
const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const profileForm = document.getElementById("profileForm");
  const playerNameInput = document.getElementById("playerName");
  const playerEmailInput = document.getElementById("playerEmail");
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
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
  let keys = new Set();
  let assets;
  const stars = Array.from({ length: 86 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 0.6 + Math.random() * 1.9,
    speed: 8 + Math.random() * 24,
    alpha: 0.2 + Math.random() * 0.58
  }));

  const game = {
    status: "idle",
    player: { x: 360, y: 230, r: 16, speed: 270 },
    playerVariant: 0,
    backdropVariant: 0,
    bossVariant: 0,
    arenaProps: [],
    hazards: [],
    orbs: [],
    powerUps: [],
    lasers: [],
    bolts: [],
    fireTimer: 0,
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    boss: null,
    bossSpawned: false,
    score: 0,
    orbCount: 0,
    health: 3,
    shield: 0,
    magnetTimer: 0,
    scoreBoostTimer: 0,
    phaseTimer: 0,
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    elapsed: 0,
    invulnerable: 0,
    nextPowerUpAt: 5,
    nextHazardAt: 10,
    inputX: 0,
    inputY: 0,
    pointerActive: false,
    pointerX: 360,
    pointerY: 230,
    shake: 0,
    flash: 0,
    worldTime: 0,
    hitstop: 0, // seconds of frame-freeze remaining (E3)
    paceSamples: [] // score at end of each whole second this run (E2)
  };

  assets = {
    backdrop: loadImage("assets/arena-backdrop.png"),
    backdrops: [
      loadImage("assets/arena-backdrop.png"),
      loadImage("assets/arena-backdrop-nebula.png"),
      loadImage("assets/arena-backdrop-station.png"),
      loadImage("assets/arena-backdrop-solar.png"),
    ],
    boss: loadImage("assets/boss-core.png"),
    bossVariants: loadImage("assets/boss-variants.png"),
    arenaProps: loadImage("assets/arena-props.png"),
    enemies: loadImage("assets/enemies.png"),
    player: loadImage("assets/player-drone.png"),
    powerups: loadImage("assets/powerups.png"),
    sprites: loadImage("assets/sprites.png"),
    variety: loadImage("assets/variety-atlas.png")
  };

  function loadImage(src) {
    const image = new Image();
    image.onload = () => drawScene();
    image.src = src;
    return image;
  }

  function imageReady(image) {
    return image.complete && image.naturalWidth > 0;
  }

  function drawImageCover(image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function drawSprite(frameName, x, y, size, rotation, alpha) {
    if (!imageReady(assets.sprites)) {
      return false;
    }

    const frame = spriteFrames[frameName];
    const frameWidth = assets.sprites.naturalWidth / 2;
    const frameHeight = assets.sprites.naturalHeight / 2;
    const sourceX = frame.col * frameWidth;
    const sourceY = frame.row * frameHeight;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(
      assets.sprites,
      sourceX,
      sourceY,
      frameWidth,
      frameHeight,
      -size / 2,
      -size / 2,
      size,
      size
    );
    ctx.restore();
    return true;
  }

  function drawSheetSprite(image, frame, columns, rows, x, y, size, rotation, alpha) {
    if (!imageReady(image) || !frame) {
      return false;
    }

    const frameWidth = image.naturalWidth / columns;
    const frameHeight = image.naturalHeight / rows;
    const sourceX = frame.col * frameWidth;
    const sourceY = frame.row * frameHeight;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      frameWidth,
      frameHeight,
      -size / 2,
      -size / 2,
      size,
      size
    );
    ctx.restore();
    return true;
  }

  function drawVarietySprite(group, variant, x, y, size, rotation, alpha) {
    const frames = varietyFrames[group];
    if (!frames || frames.length === 0) {
      return false;
    }

    const index = Math.abs(Math.round(variant || 0)) % frames.length;
    return drawSheetSprite(assets.variety, frames[index], 4, 4, x, y, size, rotation, alpha);
  }

  function currentBackdrop() {
    const backdrops = assets.backdrops || [assets.backdrop];
    const index = Math.abs(Math.round(game.backdropVariant || 0)) % backdrops.length;
    return backdrops[index] || assets.backdrop;
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
    playerEmailInput.value = profile.email || "";
    updateProfileUi();
  }

  // Final score for a run (leaderboard record AND best-tracking use this).
  function runScore() {
    return Math.max(0, Math.round(game.score + game.health * 100));
  }

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
    const cleanEmail = playerEmailInput.value.trim().toLowerCase();

    profile = {
      ...profile,
      id: PROFILE_ID,
      name: cleanName,
      email: cleanEmail,
      updatedAt: new Date().toISOString()
    };

    await getStore("profile", "readwrite", store => store.put(profile));
    updateProfileUi();
    renderScores();
  }

  async function loadScores() {
    scores = await getStore("scores", "readonly", store => store.getAll());
    scores.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    renderScores();
  }

  async function saveScore() {
    if (!profile.name || !profile.email) {
      return;
    }

    const record = {
      id: makeId(),
      playerName: profile.name,
      playerEmail: profile.email,
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
    const email = profile.email || "Add your workspace account";
    const avatar = profile.avatar || makeAvatarDataUrl(name);

    profileName.textContent = name;
    profileEmail.textContent = email;
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

  function makeOrb() {
    return {
      x: rng.range(28, canvas.width - 28),
      y: rng.range(28, canvas.height - 28),
      r: rng.range(10, 14),
      phase: rng.range(0, Math.PI * 2),
      rotSpeed: rng.range(1.8, 3.6),
      variant: rng.int(0, varietyFrames.orbs.length - 1)
    };
  }

  function chooseEnemyType() {
    if (game.elapsed < 16) {
      return "mine";
    }

    if (game.elapsed < 30) {
      return rng.next() < 0.48 ? "chaser" : "mine";
    }

    if (game.elapsed < BOSS_START_SECONDS) {
      return weightedPick([
        ["mine", 3],
        ["chaser", 3],
        ["dasher", 2],
        ["orbiter", 1]
      ]);
    }

    return weightedPick([
      ["mine", 2],
      ["chaser", 3],
      ["dasher", 3],
      ["orbiter", 2]
    ]);
  }

  function chooseEnemyVariant(enemyType) {
    const pools = {
      mine: [3],
      chaser: [0, 1],
      dasher: [2],
      orbiter: [1, 3],
    };
    return rng.pick(pools[enemyType] || [0, 1, 2, 3]);
  }

  function makeHazard(type) {
    const enemyType = type || chooseEnemyType();
    const speed = enemyType === "chaser" ? rng.range(80, 125) : rng.range(95, 190);
    const angle = rng.range(0, Math.PI * 2);
    const hazard = {
      type: enemyType,
      x: rng.range(32, canvas.width - 32),
      y: rng.range(32, canvas.height - 32),
      r: enemyType === "dasher" ? 18 : rng.range(14, 22),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (rng.next() > 0.5 ? 1 : -1) * rng.range(1.4, 3.2),
      angle: rng.range(0, Math.PI * 2),
      timer: enemyType === "dasher" ? rng.range(0.8, 1.5) : 0,
      mode: enemyType === "dasher" ? "windup" : "move",
      orbitAngle: rng.range(0, Math.PI * 2),
      orbitRadius: rng.range(110, 240),
      orbitSpeed: (rng.next() > 0.5 ? 1 : -1) * rng.range(0.72, 1.27),
      centerX: canvas.width / 2,
      centerY: canvas.height / 2,
      variant: chooseEnemyVariant(enemyType),
      hp: enemyConfig(enemyType).hp
    };

    if (enemyType === "orbiter") {
      hazard.x = hazard.centerX + Math.cos(hazard.orbitAngle) * hazard.orbitRadius;
      hazard.y = hazard.centerY + Math.sin(hazard.orbitAngle) * hazard.orbitRadius * 0.55;
    }

    return hazard;
  }

  function makePowerUp(type) {
    const powerType = type || choosePowerUpType();

    return {
      type: powerType,
      x: rng.range(38, canvas.width - 38),
      y: rng.range(38, canvas.height - 38),
      r: powerType === "bomb" ? 17 : 15,
      phase: rng.range(0, Math.PI * 2),
      variant: rng.int(0, varietyFrames.powerups.length - 1)
    };
  }

  function choosePowerUpType() {
    return weightedPick([
      ["shield", 3],
      ["magnet", 2],
      ["time", 2],
      ["repair", game.health < 3 ? 3 : 1],
      ["bomb", 1.2],
      ["boost", 2],
      ["phase", 1.2]
    ]);
  }

  function weightedPick(entries) {
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let roll = rng.next() * total;

    for (const [value, weight] of entries) {
      roll -= weight;

      if (roll <= 0) {
        return value;
      }
    }

    return entries[entries.length - 1][0];
  }

  // Hitstop (E3): briefly freeze game advancement for impact, keep rendering.
  // Accumulated-time gate, never a busy-wait. Pausing also stops game.elapsed,
  // so it doesn't shift the seeded spawn schedule.
  function triggerHitstop(seconds) {
    game.hitstop = Math.max(game.hitstop, seconds);
  }

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

  function updateGame(dt) {
    game.elapsed += dt;
    game.worldTime += dt;

    // E2: record this run's score at each whole second (becomes the best-run
    // curve if this run sets a new daily best). Keyed by elapsed second, so it
    // is frame-rate independent.
    const sec = Math.floor(game.elapsed);
    if (game.paceSamples[sec] === undefined) {
      game.paceSamples[sec] = runScore();
    }
    const scoreMultiplier = game.scoreBoostTimer > 0 ? 2 : 1;
    game.score += dt * (12 + game.combo * 1.5) * scoreMultiplier;
    game.invulnerable = Math.max(0, game.invulnerable - dt);
    game.shake = Math.max(0, game.shake - dt * 18);
    game.flash = Math.max(0, game.flash - dt * 2.8);
    game.magnetTimer = Math.max(0, game.magnetTimer - dt);
    game.scoreBoostTimer = Math.max(0, game.scoreBoostTimer - dt);
    game.phaseTimer = Math.max(0, game.phaseTimer - dt);
    game.comboTimer = Math.max(0, game.comboTimer - dt);

    if (game.comboTimer <= 0) {
      game.combo = 1;
    }

    let inputX = (keys.has("arrowright") || keys.has("d") ? 1 : 0)
      - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    let inputY = (keys.has("arrowdown") || keys.has("s") ? 1 : 0)
      - (keys.has("arrowup") || keys.has("w") ? 1 : 0);

    if (game.pointerActive) {
      const pointerDx = game.pointerX - game.player.x;
      const pointerDy = game.pointerY - game.player.y;
      const pointerDistance = Math.hypot(pointerDx, pointerDy);

      if (pointerDistance > 8) {
        inputX = pointerDx / pointerDistance;
        inputY = pointerDy / pointerDistance;
      }
    }

    const length = Math.hypot(inputX, inputY) || 1;
    game.inputX = inputX / length;
    game.inputY = inputY / length;

    game.player.x = clamp(
      game.player.x + game.inputX * game.player.speed * dt,
      game.player.r,
      canvas.width - game.player.r
    );
    game.player.y = clamp(
      game.player.y + game.inputY * game.player.speed * dt,
      game.player.r,
      canvas.height - game.player.r
    );

    const hazardPace = 1 + game.elapsed / RUN_SECONDS * 0.55;

    game.hazards.forEach(hazard => updateHazard(hazard, dt, hazardPace));

    if (game.elapsed >= game.nextHazardAt && game.hazards.length < 12) {
      game.hazards.push(makeHazard());
      game.nextHazardAt += game.elapsed < BOSS_START_SECONDS ? 7 : 4.8;
      addFloatingText("New enemy", canvas.width / 2, 64, "#ef5a5f");
    }

    updateWeapons(dt);

    if (!game.bossSpawned && game.elapsed >= BOSS_START_SECONDS) {
      spawnBoss();
    }

    updateBoss(dt);
    updateLasers(dt);

    game.orbs = game.orbs.filter(orb => {
      updateOrbMagnet(orb, dt);

      if (distance(game.player, orb) < game.player.r + orb.r) {
        collectOrb(orb);
        return false;
      }

      return true;
    });

    while (game.orbs.length < 6) {
      game.orbs.push(makeOrb());
    }

    if (game.elapsed >= game.nextPowerUpAt && game.powerUps.length < 3) {
      game.powerUps.push(makePowerUp());
      game.nextPowerUpAt += rng.range(6, 10);
    }

    game.powerUps = game.powerUps.filter(powerUp => {
      if (distance(game.player, powerUp) < game.player.r + powerUp.r) {
        collectPowerUp(powerUp);
        return false;
      }

      return true;
    });

    if (game.invulnerable <= 0 && game.phaseTimer <= 0) {
      const hit = findCollision();

      if (hit) {
        takeHit(hit);
      }
    }

    updateEffects(dt);
    updateHud();

    if (game.elapsed >= RUN_SECONDS) {
      endRun();
    }
  }

  function updateHazard(hazard, dt, hazardPace) {
    hazard.angle += hazard.spin * dt;

    if (hazard.type === "chaser") {
      const dx = game.player.x - hazard.x;
      const dy = game.player.y - hazard.y;
      const length = Math.hypot(dx, dy) || 1;
      const targetSpeed = (92 + game.elapsed * 1.1) * hazardPace;
      hazard.vx += (dx / length * targetSpeed - hazard.vx) * 0.032;
      hazard.vy += (dy / length * targetSpeed - hazard.vy) * 0.032;
      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;
      bounceHazard(hazard);
      return;
    }

    if (hazard.type === "dasher") {
      updateDasher(hazard, dt, hazardPace);
      return;
    }

    if (hazard.type === "orbiter") {
      hazard.orbitAngle += hazard.orbitSpeed * dt * hazardPace;
      hazard.centerX = canvas.width / 2 + Math.sin(game.worldTime * 0.35) * 42;
      hazard.centerY = canvas.height / 2 + Math.cos(game.worldTime * 0.42) * 28;
      hazard.x = hazard.centerX + Math.cos(hazard.orbitAngle) * hazard.orbitRadius;
      hazard.y = hazard.centerY + Math.sin(hazard.orbitAngle) * hazard.orbitRadius * 0.56;
      return;
    }

    hazard.x += hazard.vx * dt * hazardPace;
    hazard.y += hazard.vy * dt * hazardPace;
    bounceHazard(hazard);
  }

  function updateDasher(hazard, dt, hazardPace) {
    hazard.timer -= dt;

    if (hazard.mode === "windup") {
      hazard.vx *= 0.94;
      hazard.vy *= 0.94;

      if (hazard.timer <= 0) {
        const dx = game.player.x - hazard.x;
        const dy = game.player.y - hazard.y;
        const length = Math.hypot(dx, dy) || 1;
        const speed = (330 + game.elapsed * 2.5) * hazardPace;
        hazard.vx = dx / length * speed;
        hazard.vy = dy / length * speed;
        hazard.mode = "dash";
        hazard.timer = 0.72;
      }
    } else if (hazard.mode === "dash") {
      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;

      if (hazard.timer <= 0) {
        hazard.mode = "cooldown";
        hazard.timer = 1.05;
      }
    } else if (hazard.timer <= 0) {
      hazard.mode = "windup";
      // Intentionally Math.random, NOT seeded rng: this reset fires per-frame
      // (timer-driven), so seeding it would couple the seed stream to frame
      // rate and desync every other spawn's determinism. Behavior timer, not
      // spawn sequence — must stay non-deterministic. (Eng review Decision §4.)
      hazard.timer = 0.82 + Math.random() * 0.45;
    }

    hazard.x += hazard.vx * dt * 0.12;
    hazard.y += hazard.vy * dt * 0.12;
    bounceHazard(hazard);
  }

  function bounceHazard(hazard) {
    if (hazard.x < hazard.r || hazard.x > canvas.width - hazard.r) {
      hazard.vx *= -1;
    }

    if (hazard.y < hazard.r || hazard.y > canvas.height - hazard.r) {
      hazard.vy *= -1;
    }

    hazard.x = clamp(hazard.x, hazard.r, canvas.width - hazard.r);
    hazard.y = clamp(hazard.y, hazard.r, canvas.height - hazard.r);
  }

  function updateOrbMagnet(orb, dt) {
    if (game.magnetTimer <= 0) {
      return;
    }

    const dx = game.player.x - orb.x;
    const dy = game.player.y - orb.y;
    const pullDistance = Math.hypot(dx, dy);

    if (pullDistance > 1 && pullDistance < 230) {
      const pull = (1 - pullDistance / 230) * 420 * dt;
      orb.x += dx / pullDistance * pull;
      orb.y += dy / pullDistance * pull;
    }
  }

  function spawnBoss() {
    audio.sfx.boss();
    game.bossSpawned = true;
    game.boss = {
      x: canvas.width / 2,
      y: 88,
      r: 48,
      health: 36,
      maxHealth: 36,
      angle: 0,
      laserTimer: 2.1,
      summonTimer: 2.8
    };
    game.flash = 0.8;
    game.shake = 12;
    addFloatingText("Core Warden", canvas.width / 2, 92, "#e2b93b", 1.4);
    spawnShockwave(canvas.width / 2, 92, "#e2b93b", 180, 0.9);
  }

  function updateBoss(dt) {
    if (!game.boss) {
      return;
    }

    const boss = game.boss;
    boss.angle += dt * 0.8;
    boss.x = canvas.width / 2 + Math.sin(game.worldTime * 0.9) * 150;
    boss.y = 92 + Math.sin(game.worldTime * 1.4) * 18;
    boss.laserTimer -= dt;
    boss.summonTimer -= dt;

    if (boss.laserTimer <= 0) {
      spawnLaser();
      boss.laserTimer = 3.3;
    }

    if (boss.summonTimer <= 0) {
      game.hazards.push(makeHazard(weightedPick([
        ["chaser", 2],
        ["dasher", 2],
        ["orbiter", 1]
      ])));
      boss.summonTimer = 4.2;
    }
  }

  function spawnLaser() {
    const angle = Math.atan2(game.player.y - game.boss.y, game.player.x - game.boss.x);
    const length = canvas.width * 1.25;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    game.lasers.push({
      x1: cx - Math.cos(angle) * length,
      y1: cy - Math.sin(angle) * length,
      x2: cx + Math.cos(angle) * length,
      y2: cy + Math.sin(angle) * length,
      warmup: 0.78,
      life: 1.18,
      width: 13
    });
    addFloatingText("Laser sweep", canvas.width / 2, 46, "#ff7a45", 0.82);
  }

  function updateLasers(dt) {
    game.lasers = game.lasers.filter(laser => {
      laser.warmup -= dt;
      laser.life -= dt;
      return laser.life > 0;
    });
  }

  function findCollision() {
    const hazard = game.hazards.find(item => distance(game.player, item) < game.player.r + item.r);

    if (hazard) {
      return { type: "enemy", source: hazard };
    }

    if (game.boss && distance(game.player, game.boss) < game.player.r + game.boss.r * 0.8) {
      return { type: "boss", source: game.boss };
    }

    const laser = game.lasers.find(item => item.warmup <= 0 && distanceToSegment(game.player, item) < game.player.r + item.width);

    if (laser) {
      return { type: "laser", source: laser };
    }

    return null;
  }

  function takeHit(hit) {
    audio.sfx.hit();
    triggerHitstop(0.08); // E3: impact freeze on damage
    if (game.shield > 0) {
      game.shield -= 1;
      game.score += 35;
      addFloatingText("Shield block", game.player.x, game.player.y - 32, "#49b6ff");
      spawnBurst(game.player.x, game.player.y, "#49b6ff", 18);
      spawnShockwave(game.player.x, game.player.y, "#49b6ff", 92, 0.45);
    } else {
      game.health -= hit.type === "laser" ? 2 : 1;
      game.score = Math.max(0, game.score - 80);
      game.combo = 1;
      game.comboTimer = 0;
      addFloatingText(hit.type === "laser" ? "-Laser" : "-80", game.player.x, game.player.y - 32, "#ef5a5f");
      spawnBurst(game.player.x, game.player.y, "#ef5a5f", 24);
      spawnShockwave(game.player.x, game.player.y, "#ef5a5f", 105, 0.45);
    }

    game.invulnerable = 1.15;
    game.shake = 12;
    game.flash = 0.55;

    if (game.health <= 0) {
      endRun();
    }
  }

  function collectOrb(orb) {
    game.orbCount += 1;
    game.combo = Math.min(9, game.combo + 1);
    audio.sfx.collect(game.combo);
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.comboTimer = 3.2;
    const gain = (45 + game.combo * 28) * (game.scoreBoostTimer > 0 ? 2 : 1);
    game.score += gain;
    spawnBurst(orb.x, orb.y, "#2cf28f", 20);
    spawnShockwave(orb.x, orb.y, "#2cf28f", 74, 0.42);
    pulseHud(scoreValue);
    pulseHud(orbValue);
    pulseHud(comboValue);

    if (game.combo >= 4) {
      spawnBurst(orb.x, orb.y, "#e2b93b", 7);
    }

    if (game.boss) {
      damageBoss(1 + Math.floor(game.combo / 3));
    }

    addFloatingText(`+${Math.round(gain)}`, orb.x, orb.y - 20, "#2cf28f", 1.08);
  }

  function collectPowerUp(powerUp) {
    audio.sfx.powerup();
    const config = powerUpConfig[powerUp.type];
    const color = config.color;

    if (powerUp.type === "shield") {
      game.shield = Math.min(3, game.shield + 1);
      pulseHud(shieldValue);
    } else if (powerUp.type === "magnet") {
      game.magnetTimer = 6;
    } else if (powerUp.type === "time") {
      game.elapsed = Math.max(0, game.elapsed - 5);
      pulseHud(timeValue);
    } else if (powerUp.type === "repair") {
      game.health = Math.min(MAX_HEALTH, game.health + 1);
      pulseHud(healthValue);
    } else if (powerUp.type === "bomb") {
      pulseBomb(powerUp.x, powerUp.y);
    } else if (powerUp.type === "boost") {
      game.scoreBoostTimer = 7;
      pulseHud(scoreValue);
    } else if (powerUp.type === "phase") {
      game.phaseTimer = 4;
    }

    game.score += 120;
    game.comboTimer = Math.max(game.comboTimer, 2.2);
    game.flash = Math.max(game.flash, 0.35);
    spawnBurst(powerUp.x, powerUp.y, color, 28);
    spawnShockwave(powerUp.x, powerUp.y, color, 116, 0.55);
    addFloatingText(config.text, powerUp.x, powerUp.y - 28, color, 1.25);
  }

  function pulseBomb(x, y) {
    const removed = game.hazards.length;
    game.hazards = [];
    game.lasers = [];

    if (game.boss) {
      damageBoss(6);
    }

    game.score += removed * 65;
    game.shake = 16;
    game.flash = 0.85;
    addFloatingText(`Cleared ${removed}`, x, y - 36, "#ff7a45", 1.1);
  }

  function damageBoss(amount) {
    if (!game.boss) {
      return;
    }

    game.boss.health -= amount;
    triggerHitstop(0.05); // E3: punchy freeze on each boss hit
    addFloatingText(`Boss -${amount}`, game.boss.x, game.boss.y - 42, "#e2b93b", 0.82);

    if (game.boss.health <= 0) {
      game.score += 1800;
      triggerHitstop(0.2); // E3: big freeze on the kill
      addFloatingText("Boss broken +1800", canvas.width / 2, 92, "#e2b93b", 1.45);
      spawnBurst(game.boss.x, game.boss.y, "#e2b93b", 58);
      spawnShockwave(game.boss.x, game.boss.y, "#e2b93b", 240, 0.9);
      game.boss = null;
      game.lasers = [];
      game.flash = 1;
      game.shake = 20;
    }
  }

  function spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      const life = 0.42 + Math.random() * 0.38;

      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 4,
        color,
        life,
        maxLife: life
      });
    }
  }

  function spawnShockwave(x, y, color, maxRadius, life) {
    game.shockwaves.push({
      x,
      y,
      color,
      radius: 4,
      maxRadius,
      life,
      maxLife: life
    });
  }

  function addFloatingText(text, x, y, color, life) {
    game.floatingTexts.push({
      text,
      x,
      y,
      color,
      life: life || 0.95,
      maxLife: life || 0.95
    });
  }

  function updateEffects(dt) {
    game.particles = game.particles.filter(particle => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      return particle.life > 0;
    });

    game.shockwaves = game.shockwaves.filter(wave => {
      wave.life -= dt;
      const progress = 1 - wave.life / wave.maxLife;
      wave.radius = wave.maxRadius * progress;
      return wave.life > 0;
    });

    game.floatingTexts = game.floatingTexts.filter(text => {
      text.life -= dt;
      text.y -= 28 * dt;
      return text.life > 0;
    });
  }

  function updateHud() {
    scoreValue.textContent = String(Math.max(0, Math.round(game.score + game.health * 100)));
    orbValue.textContent = String(game.orbCount);
    healthValue.textContent = String(Math.max(0, game.health));
    timeValue.textContent = String(Math.max(0, Math.ceil(RUN_SECONDS - game.elapsed)));
    comboValue.textContent = `x${Math.max(1, Math.floor(game.combo))}`;
    shieldValue.textContent = String(game.shield);

    if (paceValue) {
      const delta =
        currentMode === "daily"
          ? paceDelta(currentBestCurve, game.elapsed, runScore())
          : null;
      if (delta === null) {
        paceValue.textContent = "—";
        paceValue.classList.remove("pace-ahead", "pace-behind");
      } else {
        // +/- sign carries the meaning (colorblind-safe); color reinforces.
        paceValue.textContent = `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}`;
        paceValue.classList.toggle("pace-ahead", delta >= 0);
        paceValue.classList.toggle("pace-behind", delta < 0);
      }
    }
  }

  function pulseHud(element) {
    element.classList.remove("hud-pop");
    void element.offsetWidth;
    element.classList.add("hud-pop");
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

    if (game.status !== "playing") {
      const prompt = profile.name && profile.email
        ? "Start a run when ready"
        : "Save a profile, then start a run";
      drawOverlay(message || prompt);
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

  function drawBackground() {
    const backdrop = currentBackdrop();

    if (imageReady(backdrop)) {
      drawImageCover(backdrop, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(5, 20, 19, 0.26)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#071817");
      gradient.addColorStop(0.48, "#0d302c");
      gradient.addColorStop(1, "#11201f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const glow = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.45,
      20,
      canvas.width * 0.5,
      canvas.height * 0.45,
      canvas.width * 0.62
    );
    glow.addColorStop(0, "rgba(44, 242, 143, 0.08)");
    glow.addColorStop(1, "rgba(44, 242, 143, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawArenaProps();

    stars.forEach(star => {
      const y = (star.y + game.worldTime * star.speed) % canvas.height;
      ctx.globalAlpha = (star.alpha + Math.sin(game.worldTime * 2 + star.x) * 0.12) * 0.6;
      ctx.beginPath();
      ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = "#d9fff0";
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(199, 244, 223, 0.055)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(226, 185, 59, 0.24)";
    ctx.lineWidth = 2;
    const scanY = (game.worldTime * 58) % canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(canvas.width, scanY + 16);
    ctx.stroke();
  }

  function drawArenaProps() {
    if (!game.arenaProps.length || !imageReady(assets.arenaProps)) {
      return;
    }

    game.arenaProps.forEach(prop => {
      const frame = arenaPropFrames[prop.frame % arenaPropFrames.length];
      const bob = Math.sin(game.worldTime * prop.drift + prop.phase) * prop.bob;
      const rotation = prop.rotation + Math.sin(game.worldTime * 0.2 + prop.phase) * 0.035;

      ctx.save();
      ctx.shadowColor = "rgba(44, 242, 143, 0.42)";
      ctx.shadowBlur = 10;
      drawSheetSprite(
        assets.arenaProps,
        frame,
        4,
        3,
        prop.x,
        prop.y + bob,
        prop.size,
        rotation,
        prop.alpha
      );
      ctx.restore();
    });
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

  function drawOrb(orb) {
    const pulse = 1 + Math.sin(game.worldTime * 5 + orb.phase) * 0.08;

    if (drawVarietySprite("orbs", orb.variant, orb.x, orb.y, orb.r * 5.9 * pulse, game.worldTime * 0.28 + orb.phase * 0.08, 1)) {
      return;
    }

    if (drawSprite("crystal", orb.x, orb.y, orb.r * 5.7 * pulse, game.worldTime * 0.28 + orb.phase * 0.08, 1)) {
      return;
    }

    ctx.save();
    ctx.translate(orb.x, orb.y);
    ctx.rotate(game.worldTime * orb.rotSpeed + orb.phase);
    ctx.shadowColor = "rgba(44, 242, 143, 0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#2cf28f";
    ctx.strokeStyle = "#baffdd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -orb.r * 1.35 * pulse);
    ctx.lineTo(orb.r * 0.95 * pulse, 0);
    ctx.lineTo(0, orb.r * 1.35 * pulse);
    ctx.lineTo(-orb.r * 0.95 * pulse, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -orb.r * 0.86);
    ctx.lineTo(orb.r * 0.38, 0);
    ctx.lineTo(0, orb.r * 0.72);
    ctx.lineTo(-orb.r * 0.18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHazard(hazard) {
    if (hazard.type === "dasher" && hazard.mode === "windup") {
      drawDasherWarning(hazard);
    }

    const size = hazard.type === "chaser" ? hazard.r * 4.9 : hazard.r * 5.25;

    const drewEnemySprite = drawVarietySprite("enemies", hazard.variant, hazard.x, hazard.y, size, hazard.angle, 1)
      || (hazard.type === "mine"
        ? drawSprite("hazard", hazard.x, hazard.y, size, hazard.angle, 1)
        : drawSheetSprite(assets.enemies, enemyFrames[hazard.type] || enemyFrames.sentinel, 3, 2, hazard.x, hazard.y, size, hazard.angle, 1));

    if (drewEnemySprite) {
      drawEnemyTypeRing(hazard);
      return;
    }

    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(hazard.angle);
    ctx.shadowColor = "rgba(239, 90, 95, 0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ef5a5f";
    ctx.strokeStyle = "#ffd1d3";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < 16; i += 1) {
      const angle = i / 16 * Math.PI * 2;
      const radius = i % 2 === 0 ? hazard.r * 1.25 : hazard.r * 0.74;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8d2328";
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDasherWarning(hazard) {
    const dx = game.player.x - hazard.x;
    const dy = game.player.y - hazard.y;
    const length = Math.hypot(dx, dy) || 1;

    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(game.worldTime * 18) * 0.22;
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(hazard.x, hazard.y);
    ctx.lineTo(hazard.x + dx / length * 260, hazard.y + dy / length * 260);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemyTypeRing(hazard) {
    const color = hazard.type === "chaser"
      ? "#ff7a45"
      : hazard.type === "dasher"
        ? "#f7d64a"
        : hazard.type === "orbiter"
          ? "#b76cff"
          : "#ef5a5f";

    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(hazard.angle * 0.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = hazard.type === "mine" ? 0.65 : 0.95;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r * 1.75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawPowerUp(powerUp) {
    const pulse = 1 + Math.sin(game.worldTime * 4 + powerUp.phase) * 0.12;
    const config = powerUpConfig[powerUp.type];

    if (drawSheetSprite(assets.variety, varietyPowerUpFrame(powerUp.type), 4, 4, powerUp.x, powerUp.y, powerUp.r * 5.15 * pulse, game.worldTime * 0.45 + powerUp.phase * 0.08, 1)) {
      return;
    }

    if (drawSheetSprite(assets.powerups, powerUpFrames[powerUp.type], 4, 2, powerUp.x, powerUp.y, powerUp.r * 5.25 * pulse, game.worldTime * 0.45 + powerUp.phase * 0.08, 1)) {
      return;
    }

    ctx.save();
    ctx.translate(powerUp.x, powerUp.y);
    ctx.rotate(game.worldTime * 1.8 + powerUp.phase);
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = config.color;
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, powerUp.r * 1.18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.rotate(-game.worldTime * 1.8 - powerUp.phase);
    drawFallbackPowerUpIcon(powerUp.type, config.color);
    ctx.restore();
  }

  function drawFallbackPowerUpIcon(type, color) {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = color;
    ctx.lineWidth = 3;

    if (type === "repair") {
      ctx.fillRect(-3, -10, 6, 20);
      ctx.fillRect(-10, -3, 20, 6);
      return;
    }

    if (type === "time") {
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(7, -9);
      ctx.lineTo(0, 0);
      ctx.lineTo(7, 9);
      ctx.lineTo(-7, 9);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.stroke();
      return;
    }

    if (type === "magnet") {
      ctx.beginPath();
      ctx.arc(0, 0, 10, Math.PI * 0.18, Math.PI * 0.82);
      ctx.stroke();
      return;
    }

    if (type === "phase") {
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawLasers() {
    game.lasers.forEach(laser => {
      const active = laser.warmup <= 0;
      const alpha = active ? Math.min(1, laser.life * 2.3) : 0.32 + Math.sin(game.worldTime * 24) * 0.18;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = active ? "#ef5a5f" : "#ffcf66";
      ctx.lineWidth = active ? laser.width * 2 : 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = active ? 22 : 10;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();

      if (active) {
        ctx.globalAlpha = alpha * 0.9;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff7d6";
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

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

  function drawBoss() {
    if (!game.boss) {
      return;
    }

    const boss = game.boss;
    const healthRatio = Math.max(0, boss.health / boss.maxHealth);
    const bossSize = boss.r * 3.05;

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.angle);

    const bossFrame = bossVariantFrames[game.bossVariant % bossVariantFrames.length];

    ctx.shadowColor = "rgba(226, 185, 59, 0.8)";
    ctx.shadowBlur = 24;
    if (drawSheetSprite(assets.bossVariants, bossFrame, 2, 2, 0, 0, bossSize, 0, 1)) {
      ctx.shadowBlur = 0;
    } else if (imageReady(assets.boss)) {
      ctx.drawImage(assets.boss, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = "rgba(226, 185, 59, 0.8)";
      ctx.shadowBlur = 24;
      ctx.strokeStyle = "#e2b93b";
      ctx.fillStyle = "rgba(13, 93, 86, 0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, boss.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = "#2cf28f";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, boss.r + 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * healthRatio);
    ctx.stroke();

    ctx.restore();
  }

  function drawShockwaves() {
    game.shockwaves.forEach(wave => {
      const alpha = clamp(wave.life / wave.maxLife, 0, 1);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 5 * alpha;
      ctx.shadowColor = wave.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawParticles() {
    game.particles.forEach(particle => {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);

      if (particle.color === "#e2b93b" && drawSprite("sparkle", particle.x, particle.y, particle.r * 12, game.worldTime * 2, alpha)) {
        return;
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r * (0.6 + alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawFloatingTexts() {
    game.floatingTexts.forEach(text => {
      const alpha = clamp(text.life / text.maxLife, 0, 1);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = text.color;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      ctx.lineWidth = 3;
      ctx.font = "800 17px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.strokeText(text.text, text.x, text.y);
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });
  }

  function drawOverlay(message) {
    ctx.save();
    ctx.fillStyle = "rgba(7, 24, 23, 0.68)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafeff";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "500 16px system-ui, sans-serif";
    ctx.fillStyle = "#c7f4df";
    ctx.fillText("Collect orbit crystals, grab shields, dodge coral hazards.", canvas.width / 2, canvas.height / 2 + 25);
    ctx.restore();
  }

  function renderScores() {
    const query = scoreSearch.value.trim().toLowerCase();
    const filter = scoreFilter.value;
    const today = new Date().toDateString();
    const myEmail = profile.email || "";

    const visibleScores = scores
      .filter(score => {
        const matchesQuery = !query
          || score.playerName.toLowerCase().includes(query)
          || score.playerEmail.toLowerCase().includes(query);
        const matchesMine = filter !== "mine" || score.playerEmail === myEmail;
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
      email.textContent = score.playerEmail;
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
