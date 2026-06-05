// rng.js — seeded pseudo-random number generator (mulberry32 singleton).
//
// Why a singleton: matches the existing global `game` object pattern, keeps the
// diff small, and makes seeding explicit at every call site (`rng.next()` reads
// differently from `Math.random()` in review). Eng review decision D2-A.
//
// Determinism contract: seed draws happen on discrete game events, never per
// frame from wall-clock, so a given seed produces the SAME ordered sequence.
// Only gameplay-affecting randomness routes through here; cosmetic randomness
// (starfield, death particles, screen-shake jitter) stays on Math.random().
//
//   seed(n) ──▶ internal mulberry32(n) ──▶ next() / range() / int() / pick() / arenaPoint()
//   (unseeded default delegates to Math.random so an unseeded call still works,
//    but the test-mode guard throws to catch any gameplay call that skipped seed())

function mulberry32(a) {
  let state = a >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let draw = Math.random; // default before any seed() call
let seeded = false;

// Seed (or re-seed) the generator for a run. Pass a uint32.
export function seed(n) {
  draw = mulberry32(n >>> 0);
  seeded = true;
}

// Reset to the unseeded default (Free Play with a non-deterministic feel can
// still call seed() with a random value; this is mainly for tests/teardown).
export function reset() {
  draw = Math.random;
  seeded = false;
}

export function isSeeded() {
  return seeded;
}

// Float in [0, 1).
export function next() {
  return draw();
}

// Float in [min, max).
export function range(min, max) {
  return min + draw() * (max - min);
}

// Integer in [min, max] inclusive.
export function int(min, max) {
  return Math.floor(min + draw() * (max - min + 1));
}

// Pick a random element from a non-empty array.
export function pick(list) {
  return list[Math.floor(draw() * list.length)];
}

// A point inside the arena, inset by `margin` on every edge.
// Replaces the repeated `m + Math.random() * (W - 2m)` spawn pattern (DRY).
export function arenaPoint(margin, width, height) {
  return {
    x: margin + draw() * (width - margin * 2),
    y: margin + draw() * (height - margin * 2),
  };
}

export default { seed, reset, isSeeded, next, range, int, pick, arenaPoint };
