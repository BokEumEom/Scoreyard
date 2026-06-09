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
