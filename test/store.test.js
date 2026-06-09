// node --test test/store.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProfile, recordRun, todayBest, playedToday } from "../src/store/store.js";

test("normalizeProfile defaults all v2 fields for a v1 record (migration)", () => {
  const v1 = { id: "workspace-player", name: "Ana", email: "a@x.com", avatar: "data:..." };
  const p = normalizeProfile(v1);
  assert.equal(p.name, "Ana");
  assert.equal(p.allTimeBest, 0);
  assert.deepEqual(p.dailyBests, {});
  assert.equal(p.dailyCompletions, 0);
  assert.deepEqual(p.unlocks, {});
  assert.equal(p.muted, false);
});

test("normalizeProfile tolerates null/undefined", () => {
  assert.equal(normalizeProfile(null).allTimeBest, 0);
  assert.equal(normalizeProfile(undefined).muted, false);
});

test("normalizeProfile does not mutate input", () => {
  const v1 = { dailyBests: { "2026-06-05": 10 } };
  const p = normalizeProfile(v1);
  p.dailyBests["2026-06-06"] = 99;
  assert.deepEqual(v1.dailyBests, { "2026-06-05": 10 }, "input was mutated");
});

test("recordRun sets a new all-time best", () => {
  const { profile, newAllTimeBest } = recordRun({ allTimeBest: 100 }, {
    mode: "free", dateKey: "2026-06-05", score: 250,
  });
  assert.equal(profile.allTimeBest, 250);
  assert.equal(newAllTimeBest, true);
});

test("recordRun does not lower the all-time best", () => {
  const { profile, newAllTimeBest } = recordRun({ allTimeBest: 500 }, {
    mode: "free", dateKey: "2026-06-05", score: 250,
  });
  assert.equal(profile.allTimeBest, 500);
  assert.equal(newAllTimeBest, false);
});

test("daily run records today's best keyed by date", () => {
  const { profile, newDailyBest } = recordRun({}, {
    mode: "daily", dateKey: "2026-06-05", score: 300,
  });
  assert.equal(profile.dailyBests["2026-06-05"], 300);
  assert.equal(newDailyBest, true);
  assert.equal(profile.dailyCompletions, 1);
});

test("replaying a daily updates today's best only if higher", () => {
  const first = recordRun({}, { mode: "daily", dateKey: "2026-06-05", score: 300 }).profile;
  const lower = recordRun(first, { mode: "daily", dateKey: "2026-06-05", score: 200 });
  assert.equal(lower.profile.dailyBests["2026-06-05"], 300, "best should not drop");
  assert.equal(lower.newDailyBest, false);
  assert.equal(lower.profile.dailyCompletions, 1, "replaying the same day does not re-count completion");

  const higher = recordRun(first, { mode: "daily", dateKey: "2026-06-05", score: 450 });
  assert.equal(higher.profile.dailyBests["2026-06-05"], 450);
  assert.equal(higher.newDailyBest, true);
  assert.equal(higher.profile.dailyCompletions, 1);
});

test("daily completions count distinct days only", () => {
  let p = recordRun({}, { mode: "daily", dateKey: "2026-06-05", score: 100 }).profile;
  p = recordRun(p, { mode: "daily", dateKey: "2026-06-06", score: 100 }).profile;
  p = recordRun(p, { mode: "daily", dateKey: "2026-06-06", score: 100 }).profile;
  assert.equal(p.dailyCompletions, 2);
});

test("free play does not touch daily bests or completions", () => {
  const { profile } = recordRun({}, { mode: "free", dateKey: "2026-06-05", score: 999 });
  assert.deepEqual(profile.dailyBests, {});
  assert.equal(profile.dailyCompletions, 0);
});

test("todayBest and playedToday reflect state", () => {
  assert.equal(playedToday({}, "2026-06-05"), false);
  assert.equal(todayBest({}, "2026-06-05"), 0);
  const p = recordRun({}, { mode: "daily", dateKey: "2026-06-05", score: 120 }).profile;
  assert.equal(playedToday(p, "2026-06-05"), true);
  assert.equal(todayBest(p, "2026-06-05"), 120);
  assert.equal(playedToday(p, "2026-06-06"), false);
});

test("negative or NaN scores clamp to 0", () => {
  const { profile } = recordRun({}, { mode: "daily", dateKey: "2026-06-05", score: -5 });
  assert.equal(profile.dailyBests["2026-06-05"], 0);
  const { profile: p2 } = recordRun({}, { mode: "free", dateKey: "x", score: NaN });
  assert.equal(p2.allTimeBest, 0);
});
