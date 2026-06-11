// src/game/boss.js — the Core Warden boss: spawn, movement, attacks (laser
// sweep + adds), two phases, and damage/defeat. Reads shared game state; uses
// the spawn + effects + audio modules. Bolt collision (direct damage) is wired
// in main.js's updateWeapons; the HP bar is drawn by src/render/draw.js.
import { game } from "./state.js";
import { canvas } from "../core/dom.js";
import * as audio from "../audio/audio.js";
import { makeHazard, weightedPick } from "./spawn.js";
import { spawnBurst, spawnShockwave, addFloatingText, triggerHitstop } from "./effects.js";
import { bossVariantFrames } from "../data/sprites.js";

export function spawnBoss() {
  audio.sfx.boss();
  game.bossSpawned = true;
  game.boss = {
    x: canvas.width / 2,
    y: 88,
    r: 48,
    health: 36,
    maxHealth: 36,
    phase: 1,
    angle: 0,
    laserTimer: 2.1,
    summonTimer: 2.8
  };
  game.flash = 0.8;
  game.shake = 12;
  addFloatingText("Core Warden", canvas.width / 2, 92, "#e2b93b", 1.4);
  spawnShockwave(canvas.width / 2, 92, "#e2b93b", 180, 0.9);
}

export function updateBoss(dt) {
  if (!game.boss) {
    return;
  }

  const boss = game.boss;
  boss.angle += dt * 0.8;
  boss.x = canvas.width / 2 + Math.sin(game.worldTime * 0.9) * 150;
  boss.y = 92 + Math.sin(game.worldTime * 1.4) * 18;

  // Phase 2 at half health: angrier cadence, a fresh add, and a new look.
  if (boss.phase === 1 && boss.health <= boss.maxHealth * 0.5) {
    boss.phase = 2;
    game.bossVariant = (game.bossVariant + 1) % bossVariantFrames.length;
    game.flash = 0.7;
    game.shake = 14;
    addFloatingText("Phase 2 — Overdrive", canvas.width / 2, 92, "#ff7a45", 1.3);
    spawnShockwave(canvas.width / 2, 92, "#ff7a45", 200, 0.8);
    game.hazards.push(makeHazard(weightedPick([["dasher", 2], ["chaser", 1]])));
  }

  const laserCadence = boss.phase === 2 ? 2.1 : 3.3;
  const summonCadence = boss.phase === 2 ? 2.8 : 4.2;

  boss.laserTimer -= dt;
  boss.summonTimer -= dt;

  if (boss.laserTimer <= 0) {
    spawnLaser();
    boss.laserTimer = laserCadence;
  }

  if (boss.summonTimer <= 0) {
    game.hazards.push(makeHazard(weightedPick([
      ["chaser", 2],
      ["dasher", 2],
      ["orbiter", 1]
    ])));
    boss.summonTimer = summonCadence;
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

export function updateLasers(dt) {
  game.lasers = game.lasers.filter(laser => {
    laser.warmup -= dt;
    laser.life -= dt;
    return laser.life > 0;
  });
}

export function damageBoss(amount) {
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
    game.bossDefeated = true;
    game.lasers = [];
    game.flash = 1;
    game.shake = 20;
  }
}
