// src/game/spawn.js -- entity/hazard/power-up factories + enemy selection.
// Seeded via rng so the Daily arena is deterministic. Reads shared game state +
// canvas bounds; no rendering. weightedPick is also used by the boss summoner.
import * as rng from "../core/rng.js";
import { game } from "./state.js";
import { canvas } from "../core/dom.js";
import { BOSS_START_SECONDS } from "../core/config.js";
import { enemyConfig } from "../data/enemies.js";
import { varietyFrames } from "../data/sprites.js";

export function makeOrb() {
  return {
    x: rng.range(28, canvas.width - 28),
    y: rng.range(28, canvas.height - 28),
    r: rng.range(10, 14),
    phase: rng.range(0, Math.PI * 2),
    rotSpeed: rng.range(1.8, 3.6),
    variant: rng.int(0, varietyFrames.orbs.length - 1)
  };
}

export function chooseEnemyType() {
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

export function chooseEnemyVariant(enemyType) {
  const pools = {
    mine: [3],
    chaser: [0, 1],
    dasher: [2],
    orbiter: [1, 3],
  };
  return rng.pick(pools[enemyType] || [0, 1, 2, 3]);
}

export function makeHazard(type) {
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

export function makePowerUp(type) {
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

export function choosePowerUpType() {
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

export function weightedPick(entries) {
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
