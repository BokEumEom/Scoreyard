// node --test test/rng.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rng from "../src/core/rng.js";

test("same seed produces the same ordered sequence (determinism)", () => {
  rng.seed(123456);
  const a = Array.from({ length: 50 }, () => rng.next());
  rng.seed(123456);
  const b = Array.from({ length: 50 }, () => rng.next());
  assert.deepEqual(a, b);
});

test("different seeds produce different sequences", () => {
  rng.seed(1);
  const a = Array.from({ length: 20 }, () => rng.next());
  rng.seed(2);
  const b = Array.from({ length: 20 }, () => rng.next());
  assert.notDeepEqual(a, b);
});

test("next() stays in [0, 1)", () => {
  rng.seed(42);
  for (let i = 0; i < 5000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("range(min,max) stays in [min, max)", () => {
  rng.seed(7);
  for (let i = 0; i < 5000; i++) {
    const v = rng.range(10, 20);
    assert.ok(v >= 10 && v < 20, `out of range: ${v}`);
  }
});

test("int(min,max) is inclusive on both ends and hits both", () => {
  rng.seed(99);
  let sawMin = false;
  let sawMax = false;
  for (let i = 0; i < 5000; i++) {
    const v = rng.int(1, 3);
    assert.ok(v >= 1 && v <= 3, `out of range: ${v}`);
    assert.equal(v, Math.floor(v), "not an integer");
    if (v === 1) sawMin = true;
    if (v === 3) sawMax = true;
  }
  assert.ok(sawMin && sawMax, "int() never reached an endpoint");
});

test("arenaPoint stays inside the margin on every edge", () => {
  rng.seed(5);
  const W = 720;
  const H = 460;
  const margin = 28;
  for (let i = 0; i < 5000; i++) {
    const p = rng.arenaPoint(margin, W, H);
    assert.ok(p.x >= margin && p.x < W - margin, `x out: ${p.x}`);
    assert.ok(p.y >= margin && p.y < H - margin, `y out: ${p.y}`);
  }
});

test("pick returns an element from the array", () => {
  rng.seed(11);
  const list = ["chaser", "dasher", "orbiter"];
  for (let i = 0; i < 1000; i++) {
    assert.ok(list.includes(rng.pick(list)));
  }
});

test("isSeeded reflects seed/reset", () => {
  rng.reset();
  assert.equal(rng.isSeeded(), false);
  rng.seed(1);
  assert.equal(rng.isSeeded(), true);
  rng.reset();
  assert.equal(rng.isSeeded(), false);
});
