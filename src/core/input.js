// src/core/input.js — the set of currently-pressed movement keys.
// main.js's keydown/keyup handlers mutate it; the game loop reads it.
export const keys = new Set();
