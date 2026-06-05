// node --test test/share.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareString } from "../share.js";

test("includes date, score, combo, orbs", () => {
  const s = buildShareString({ dateKey: "2026-06-05", score: 8440, maxCombo: 12, orbs: 24 });
  assert.match(s, /Scoreyard · 2026-06-05/);
  assert.match(s, /8,440 pts/);
  assert.match(s, /x12 combo/);
  assert.match(s, /24 orbs/);
});

test("NEVER leaks PII — no '@', and a passed-in name is not reflected", () => {
  // Even if a caller mistakenly spreads a profile in, only known keys are read.
  const s = buildShareString({
    dateKey: "2026-06-05", score: 100, maxCombo: 1, orbs: 0,
    name: "Ana Rivera", email: "ana@company.com",
  });
  assert.ok(!s.includes("@"), "share string must not contain an email");
  assert.ok(!s.includes("Ana"), "share string must not contain the player name");
  assert.ok(!s.toLowerCase().includes("rivera"));
});

test("trophy only when beatBest", () => {
  const withBest = buildShareString({ dateKey: "x", score: 1, beatBest: true });
  const without = buildShareString({ dateKey: "x", score: 1, beatBest: false });
  assert.ok(withBest.includes("\u{1F3C6}"));
  assert.ok(!without.includes("\u{1F3C6}"));
});

test("emoji bar scales with orbs and is always 10 cells", () => {
  const none = buildShareString({ dateKey: "x", score: 0, orbs: 0 });
  const some = buildShareString({ dateKey: "x", score: 0, orbs: 15 });
  const lots = buildShareString({ dateKey: "x", score: 0, orbs: 999 });
  const barOf = (s) => s.split("\n")[2];
  // 10 cells regardless (each cell is one code point)
  assert.equal([...barOf(none)].length, 10);
  assert.equal([...barOf(some)].length, 10);
  assert.equal([...barOf(lots)].length, 10);
  assert.ok([...barOf(none)].every((c) => c === "⬛"), "zero orbs => all empty");
  assert.ok(barOf(lots).includes("\u{1F7E9}"), "many orbs => filled cells");
});

test("clamps negative / NaN score to 0", () => {
  assert.match(buildShareString({ dateKey: "x", score: -50 }), /0 pts/);
  assert.match(buildShareString({ dateKey: "x", score: NaN }), /0 pts/);
});
