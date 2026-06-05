# TODOS

## P1 — Operational

### Baseline commit before starting the retention-loop work
- **What:** Initialize git history with a baseline commit of the current working game (index.html, app.js, styles.css, assets, README).
- **Why:** The repo has **zero commits** today, so there is no rollback point. The upcoming seeded-RNG refactor touches the hot game loop; if it breaks game feel, there must be a known-good version to revert to.
- **Context:** Untracked files only; no remote configured. A single `git add -A && git commit` captures the working baseline. Consider adding a remote afterward so the work is versioned off-machine.
- **Effort:** S (CC: S) · **Priority:** P1 · **Blocks:** the Approach-B implementation should not start until this exists.

---

> Deferred items from the 2026-06-05 CEO review (streak counter, responsive/mobile canvas,
> online leaderboard) are recorded in the CEO plan, not here, per the owner's choice:
> `~/.gstack/projects/Sites/ceo-plans/2026-06-05-scoreyard-retention-loop.md`
