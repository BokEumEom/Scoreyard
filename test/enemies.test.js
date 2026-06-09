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
