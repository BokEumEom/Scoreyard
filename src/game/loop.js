// src/game/loop.js -- the per-frame simulation: input, movement, spawn cadence,
// auto-fire, collisions, pickups, effects. Driven by main.js tick(); calls the
// registered onRunEnd() when the run ends (time up or hull gone).
import { game } from "./state.js";
import { canvas } from "../core/dom.js";
import { keys } from "../core/input.js";
import { clamp, distance, distanceToSegment } from "../util/mathx.js";
import { RUN_SECONDS, BOSS_START_SECONDS, MAX_HEALTH } from "../core/config.js";
import { makeHazard, makeOrb, makePowerUp, weightedPick } from "./spawn.js";
import {
  spawnBurst,
  spawnShockwave,
  addFloatingText,
  spawnFx,
  updateEffects,
  updateFx,
  triggerHitstop
} from "./effects.js";
import { spawnBoss, updateBoss, updateLasers, damageBoss } from "./boss.js";
import { acquireTarget, fireInterval, boltDamage, createBolt } from "./weapons.js";
import { enemyConfig } from "../data/enemies.js";
import { powerUpConfig } from "../data/sprites.js";
import * as audio from "../audio/audio.js";

const FIRE_RANGE = 320; // px: auto-aim acquisition radius
const BOLT_SPEED = 560; // px/s: bolt travel speed

let onRunEnd = () => {};
export function setOnRunEnd(fn) {
  onRunEnd = fn;
}

export function runScore() {
  return Math.max(0, Math.round(game.score + game.health * 100));
}

export function updateGame(dt) {
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
  updateFx(dt);

  if (game.elapsed >= RUN_SECONDS) {
    onRunEnd("time");
  }
}

export function updateHazard(hazard, dt, hazardPace) {
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

export function updateDasher(hazard, dt, hazardPace) {
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

export function bounceHazard(hazard) {
  if (hazard.x < hazard.r || hazard.x > canvas.width - hazard.r) {
    hazard.vx *= -1;
  }

  if (hazard.y < hazard.r || hazard.y > canvas.height - hazard.r) {
    hazard.vy *= -1;
  }

  hazard.x = clamp(hazard.x, hazard.r, canvas.width - hazard.r);
  hazard.y = clamp(hazard.y, hazard.r, canvas.height - hazard.r);
}

export function updateOrbMagnet(orb, dt) {
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

export function updateWeapons(dt) {
  game.fireTimer = Math.max(0, game.fireTimer - dt);

  // Auto-aim considers enemies and the boss, so bolts engage the boss directly.
  const targets = game.boss ? game.hazards.concat(game.boss) : game.hazards;
  const target = acquireTarget(game.player, targets, FIRE_RANGE);
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
      spawnFx("enemyHitSpark", bolt.x, bolt.y, 24, 0.2);
      if (hazard.hp <= 0) {
        killEnemy(hazard);
      }
      return false;
    }

    if (game.boss && Math.hypot(game.boss.x - bolt.x, game.boss.y - bolt.y) < game.boss.r + bolt.r) {
      damageBoss(bolt.damage);
      spawnFx("bossImpact", bolt.x, bolt.y, 30, 0.22);
      return false;
    }

    return true;
  });

  game.hazards = game.hazards.filter(h => h.hp > 0);
}

export function killEnemy(hazard) {
  const reward = enemyConfig(hazard.type).reward;
  game.score += reward;
  spawnBurst(hazard.x, hazard.y, "#ffd166", 16);
  spawnShockwave(hazard.x, hazard.y, "#ef5a5f", 70, 0.4);
  spawnFx("enemyKillBurst", hazard.x, hazard.y, 60, 0.4);
  addFloatingText(`+${reward}`, hazard.x, hazard.y - 18, "#ffd166", 0.9);
}

export function findCollision() {
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

export function takeHit(hit) {
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
    onRunEnd("down");
  }
}

export function collectOrb(orb) {
  game.orbCount += 1;
  game.combo = Math.min(9, game.combo + 1);
  audio.sfx.collect(game.combo);
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.comboTimer = 3.2;
  const gain = (45 + game.combo * 28) * (game.scoreBoostTimer > 0 ? 2 : 1);
  game.score += gain;
  spawnBurst(orb.x, orb.y, "#2cf28f", 20);
  spawnShockwave(orb.x, orb.y, "#2cf28f", 74, 0.42);

  if (game.combo >= 4) {
    spawnBurst(orb.x, orb.y, "#e2b93b", 7);
  }

  // Boss damage now comes from auto-fire bolts (updateWeapons), not orb pickups.
  addFloatingText(`+${Math.round(gain)}`, orb.x, orb.y - 20, "#2cf28f", 1.08);
}

export function collectPowerUp(powerUp) {
  audio.sfx.powerup();
  const config = powerUpConfig[powerUp.type];
  const color = config.color;

  if (powerUp.type === "shield") {
    game.shield = Math.min(3, game.shield + 1);
  } else if (powerUp.type === "magnet") {
    game.magnetTimer = 6;
  } else if (powerUp.type === "time") {
    game.elapsed = Math.max(0, game.elapsed - 5);
  } else if (powerUp.type === "repair") {
    game.health = Math.min(MAX_HEALTH, game.health + 1);
  } else if (powerUp.type === "bomb") {
    pulseBomb(powerUp.x, powerUp.y);
  } else if (powerUp.type === "boost") {
    game.scoreBoostTimer = 7;
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

export function pulseBomb(x, y) {
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
