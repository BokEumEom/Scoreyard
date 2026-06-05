// seed.js — turn a calendar day into a deterministic seed for the Daily Challenge.
//
// Boundary decision (design doc): the daily seed is the UTC date string
// `YYYY-MM-DD`. UTC (not local time) so the seed is unambiguous and stays
// comparable if scores ever become cross-user. The date key is also what
// today's-best is stored under.
//
//   Date ──utcDateKey──▶ "2026-06-05" ──hashSeed──▶ uint32 ──rng.seed──▶ run
//
// A run started at 23:59Z and a run started at 00:01Z (next day) get DIFFERENT
// seeds; callers must lock the key at run start, not at save time.

// UTC `YYYY-MM-DD` for a given Date (defaults to now).
export function utcDateKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// FNV-1a 32-bit hash → uint32. Deterministic across browsers (integer ops only).
export function hashSeed(str) {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0;
}

// Seed for a given calendar day (defaults to today, UTC).
export function dailySeed(date = new Date()) {
  return hashSeed(utcDateKey(date));
}

export default { utcDateKey, hashSeed, dailySeed };
