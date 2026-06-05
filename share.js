// share.js — build the shareable Daily result string. Pure + node-testable.
//
// SECURITY: this function takes ONLY run stats (date/score/combo/orbs). It is
// deliberately NOT given the player's name or email, so the pasted string can
// never leak PII into a chat. The unit test asserts the output has no '@' and
// no caller-supplied name. (CEO/eng review §3 — sharpest landmine.)
//
//   { dateKey, score, maxCombo, orbs, beatBest } ──▶
//     "Scoreyard · 2026-06-05 🏆\n8,440 pts · x12 combo · 24 orbs\n🟩🟩🟩🟩🟩🟩🟩🟩⬛⬛"

export function buildShareString({ dateKey, score, maxCombo = 1, orbs = 0, beatBest = false }) {
  const cells = 10;
  const filled = Math.max(0, Math.min(cells, Math.round((orbs || 0) / 3)));
  const bar = "\u{1F7E9}".repeat(filled) + "⬛".repeat(cells - filled);
  const trophy = beatBest ? " \u{1F3C6}" : "";
  const pts = Math.max(0, Math.round(score || 0));
  return [
    `Scoreyard · ${dateKey}${trophy}`,
    `${pts.toLocaleString("en-US")} pts · x${maxCombo} combo · ${orbs} orbs`,
    bar,
  ].join("\n");
}

export default { buildShareString };
