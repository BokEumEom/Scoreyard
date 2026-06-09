// node --test test/weapons.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { acquireTarget, fireInterval, boltDamage, createBolt } from "../src/game/weapons.js";

test("acquireTarget picks the nearest enemy within range", () => {
  const player = { x: 0, y: 0 };
  const enemies = [{ x: 100, y: 0, id: "far" }, { x: 30, y: 0, id: "near" }];
  assert.equal(acquireTarget(player, enemies, 200).id, "near");
});

test("acquireTarget returns null when nothing is in range", () => {
  assert.equal(acquireTarget({ x: 0, y: 0 }, [{ x: 500, y: 0 }], 100), null);
  assert.equal(acquireTarget({ x: 0, y: 0 }, [], 100), null);
});

test("fireInterval shortens with combo and clamps both ends", () => {
  assert.ok(Math.abs(fireInterval(1) - 0.46) < 1e-9);
  assert.equal(fireInterval(0), 0.5);   // clamp high
  assert.equal(fireInterval(20), 0.14); // clamp low
});

test("boltDamage is 1 + floor(combo/3)", () => {
  assert.equal(boltDamage(1), 1);
  assert.equal(boltDamage(3), 2);
  assert.equal(boltDamage(9), 4);
});

test("createBolt heads from player toward target with given damage", () => {
  const bolt = createBolt({ x: 0, y: 0 }, { x: 10, y: 0 }, 100, 3);
  assert.equal(bolt.damage, 3);
  assert.ok(Math.abs(bolt.vx - 100) < 1e-9);
  assert.ok(Math.abs(bolt.vy) < 1e-9);
});
