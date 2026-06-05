// store.js — pure profile/best-score transforms (node-testable; NO IndexedDB here).
//
// The IndexedDB read/write lives in app.js; this module holds the pure logic so
// the migration (default-on-read) and best-score updates can be unit-tested in
// node without a browser (eng review decision D3-B: zero deps, no fake-indexeddb).
//
//   raw profile record ──normalizeProfile──▶ profile with all v2 fields defaulted
//   (profile, runResult) ──recordRun──▶ { profile', newAllTimeBest, newDailyBest }

// Fill in every v2 field so reads of a pre-migration (v1) record never hit
// `undefined`. This IS the migration: tolerate missing keys, default them.
export function normalizeProfile(raw) {
  const p = raw || {};
  return {
    ...p,
    name: p.name || "",
    email: p.email || "",
    avatar: p.avatar || "",
    allTimeBest: Number.isFinite(p.allTimeBest) ? p.allTimeBest : 0,
    dailyBests: { ...(p.dailyBests || {}) },
    dailyCompletions: Number.isFinite(p.dailyCompletions) ? p.dailyCompletions : 0,
    unlocks: { ...(p.unlocks || {}) },
    muted: p.muted === true,
  };
}

// Apply a finished run to the profile. Returns a NEW profile (no mutation) plus
// flags for which celebration to fire. `mode` is "daily" or "free"; `dateKey`
// is the UTC YYYY-MM-DD locked at run start; `score` is the run's final score.
export function recordRun(rawProfile, { mode, dateKey, score }) {
  const p = normalizeProfile(rawProfile);
  const finalScore = Math.max(0, Math.round(score || 0));

  const out = {
    ...p,
    dailyBests: { ...p.dailyBests },
    unlocks: { ...p.unlocks },
  };

  let newAllTimeBest = false;
  if (finalScore > p.allTimeBest) {
    out.allTimeBest = finalScore;
    newAllTimeBest = true;
  }

  let newDailyBest = false;
  if (mode === "daily" && dateKey) {
    const playedBefore = Object.prototype.hasOwnProperty.call(p.dailyBests, dateKey);
    const prev = p.dailyBests[dateKey] || 0;
    out.dailyBests[dateKey] = Math.max(prev, finalScore);
    if (finalScore > prev || !playedBefore) {
      // first play of the day, or a higher daily score
      newDailyBest = finalScore > prev;
    }
    if (!playedBefore) {
      out.dailyCompletions = p.dailyCompletions + 1;
    }
  }

  return { profile: out, newAllTimeBest, newDailyBest };
}

// Today's best for a daily seed (0 if never played that day).
export function todayBest(rawProfile, dateKey) {
  const p = normalizeProfile(rawProfile);
  return p.dailyBests[dateKey] || 0;
}

// Has the player completed today's daily challenge yet?
export function playedToday(rawProfile, dateKey) {
  const p = normalizeProfile(rawProfile);
  return Object.prototype.hasOwnProperty.call(p.dailyBests, dateKey);
}

export default { normalizeProfile, recordRun, todayBest, playedToday };
