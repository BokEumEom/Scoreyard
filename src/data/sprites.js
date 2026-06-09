// sprites.js — sprite-atlas frame layouts (pure data) and frame lookups.
// Coordinates are (col,row) cells within each atlas; the actual drawing lives
// in app.js, which reads these tables.

export const spriteFrames = {
  crystal: { col: 0, row: 0 },
  shield: { col: 1, row: 0 },
  hazard: { col: 0, row: 1 },
  sparkle: { col: 1, row: 1 }
};

export const powerUpFrames = {
  shield: { col: 0, row: 0 },
  magnet: { col: 1, row: 0 },
  time: { col: 2, row: 0 },
  repair: { col: 3, row: 0 },
  bomb: { col: 0, row: 1 },
  boost: { col: 1, row: 1 },
  phase: { col: 2, row: 1 },
  overdrive: { col: 3, row: 1 }
};

export const enemyFrames = {
  chaser: { col: 1, row: 0 },
  dasher: { col: 2, row: 0 },
  orbiter: { col: 0, row: 1 },
  laser: { col: 1, row: 1 },
  sentinel: { col: 2, row: 1 }
};

export const varietyFrames = {
  players: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
  ],
  // Row 2, col 2 is intentionally skipped: the magenta crystal loses detail
  // during chroma-key removal, so the safe variants are teal, blue, and gold.
  orbs: [
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 3, row: 1 },
  ],
  enemies: [
    { col: 0, row: 2 },
    { col: 1, row: 2 },
    { col: 2, row: 2 },
    { col: 3, row: 2 },
  ],
  powerups: [
    { col: 0, row: 3 },
    { col: 2, row: 3 },
    { col: 3, row: 3 },
  ]
};

export const bossVariantFrames = [
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: 1, row: 1 }
];

export const arenaPropFrames = [
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 3, row: 1 },
  { col: 0, row: 2 },
  { col: 1, row: 2 },
  { col: 2, row: 2 },
  { col: 3, row: 2 }
];

export const powerUpConfig = {
  shield: { label: "SHIELD", color: "#49b6ff", text: "+Shield" },
  magnet: { label: "MAGNET", color: "#b76cff", text: "Magnet 6s" },
  time: { label: "TIME", color: "#e2b93b", text: "+5s" },
  repair: { label: "REPAIR", color: "#2cf28f", text: "+Health" },
  bomb: { label: "PULSE", color: "#ff7a45", text: "Pulse bomb" },
  boost: { label: "BOOST", color: "#f7d64a", text: "Score boost" },
  phase: { label: "PHASE", color: "#8ad7ff", text: "Phase 4s" }
};

export function varietyPowerUpFrame(type) {
  const indexByType = {
    shield: 0,
    time: 1,
    repair: 2,
    boost: 2,
    phase: 2,
  };
  const index = indexByType[type];
  return Number.isInteger(index) ? varietyFrames.powerups[index] : null;
}
