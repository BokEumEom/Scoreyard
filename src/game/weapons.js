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
