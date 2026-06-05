// pace.js — best-run pace comparison (pure, node-testable).
//
// A "curve" is an array indexed by elapsed whole-second: curve[s] = the best
// run's score at the end of second s. paceDelta compares the current score at
// the current second against that curve so the HUD can show "+320" (ahead) or
// "-150" (behind) your best run. Returns null when there's no curve to compare
// against (first-ever daily, or before any sample exists).

export function paceDelta(bestCurve, elapsedSeconds, score) {
  if (!Array.isArray(bestCurve) || bestCurve.length === 0) return null;
  const s = Math.max(0, Math.floor(elapsedSeconds || 0));
  const idx = Math.min(s, bestCurve.length - 1);
  let best = bestCurve[idx];
  // Sparse curves: walk back to the most recent recorded sample.
  for (let i = idx; i >= 0 && typeof best !== "number"; i--) {
    best = bestCurve[i];
  }
  if (typeof best !== "number") return null;
  return Math.round(score || 0) - best;
}

export default { paceDelta };
