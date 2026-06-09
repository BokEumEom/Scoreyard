// node --test test/seed.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { utcDateKey, hashSeed, dailySeed } from "../src/core/seed.js";

test("utcDateKey formats UTC YYYY-MM-DD", () => {
  assert.equal(utcDateKey(new Date("2026-06-05T12:00:00Z")), "2026-06-05");
  assert.equal(utcDateKey(new Date("2026-01-09T00:00:00Z")), "2026-01-09");
});

test("same UTC calendar day → same key regardless of time of day", () => {
  const early = new Date("2026-06-05T00:30:00Z");
  const late = new Date("2026-06-05T23:30:00Z");
  assert.equal(utcDateKey(early), utcDateKey(late));
});

test("UTC midnight rollover → different key", () => {
  const before = new Date("2026-06-05T23:59:59Z");
  const after = new Date("2026-06-06T00:00:01Z");
  assert.notEqual(utcDateKey(before), utcDateKey(after));
});

test("uses UTC, not local time (no off-by-one near midnight)", () => {
  // 2026-06-05 23:30 in UTC is still the 5th in UTC even though some local
  // zones would call it the 6th. We always key by UTC.
  assert.equal(utcDateKey(new Date("2026-06-05T23:30:00Z")), "2026-06-05");
});

test("hashSeed is deterministic for the same string", () => {
  assert.equal(hashSeed("2026-06-05"), hashSeed("2026-06-05"));
});

test("hashSeed returns a uint32", () => {
  const h = hashSeed("2026-06-05");
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
});

test("different days produce different seeds", () => {
  assert.notEqual(dailySeed(new Date("2026-06-05T12:00:00Z")),
                  dailySeed(new Date("2026-06-06T12:00:00Z")));
});

test("dailySeed is stable across the same UTC day", () => {
  assert.equal(dailySeed(new Date("2026-06-05T01:00:00Z")),
               dailySeed(new Date("2026-06-05T22:00:00Z")));
});
