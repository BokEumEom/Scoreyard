// config.js — Scoreyard tuning constants and storage identifiers.
// Pure values, no dependencies. Imported by app.js (gameplay) and db.js (storage).

export const DB_NAME = "scoreyard-sites-storage";
// v2: profile gains best-score/daily/unlock fields (migration via normalizeProfile on read).
export const DB_VERSION = 2;
export const PROFILE_ID = "workspace-player";
export const RUN_SECONDS = 75;
export const BOSS_START_SECONDS = 52;
export const MAX_HEALTH = 4;
