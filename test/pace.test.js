// node --test test/pace.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { paceDelta } from "../src/util/pace.js";

test("returns null when there is no best curve (first run)", () => {
  assert.equal(paceDelta(null, 5, 100), null);
  assert.equal(paceDelta([], 5, 100), null);
  assert.equal(paceDelta(undefined, 5, 100), null);
});

test("ahead of best is positive, behind is negative", () => {
  const curve = [0, 100, 200, 300];
  assert.equal(paceDelta(curve, 1, 150), 50); // ahead by 50 at second 1
  assert.equal(paceDelta(curve, 2, 180), -20); // behind by 20 at second 2
  assert.equal(paceDelta(curve, 3, 300), 0); // dead even
});

test("past the end of the curve compares against the last sample", () => {
  const curve = [0, 100, 200];
  assert.equal(paceDelta(curve, 9, 250), 50); // best ended at 200
});

test("sparse curve walks back to the last known sample", () => {
  const curve = [];
  curve[0] = 0;
  curve[3] = 300; // seconds 1,2 missing
  assert.equal(paceDelta(curve, 2, 120), 120); // walks back to second 0 (=0)
  assert.equal(paceDelta(curve, 3, 280), -20);
});

test("rounds the current score", () => {
  assert.equal(paceDelta([0, 100], 1, 150.7), 51);
});
