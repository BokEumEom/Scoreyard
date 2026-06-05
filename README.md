# Scoreyard

A static Sites game with browser-persistent player profiles, avatar uploads, and saved scores.

## What is included

- A playable canvas game in `index.html`, `styles.css`, and `app.js`.
- Player profile fields for workspace name and email.
- Avatar uploads compressed to a square image before storage.
- Persistent score history in IndexedDB.
- Browser Storage API persistence request when supported.
- Leaderboard filters for all scores, current player scores, today, and text search.
- Animated arena graphics with stars, scan lines, crystal pickups, spinning hazards, shields, and particles.
- Combo scoring, stronger pickup effects, seven power-up types, progressive hazard pacing, boss phase, and drag-to-move controls.
- Generated image assets in `assets/`: arena backdrop, player drone, transparent sprite sheet, and preserved chroma-key source sheets.

## Assets

- `assets/arena-backdrop.png`: generated sci-fi arena background.
- `assets/boss-core.png`: generated transparent Core Warden boss sprite.
- `assets/boss-core-source-magenta.png`: preserved chroma-key boss source.
- `assets/enemies.png`: generated transparent enemy sprite sheet for chasers, dashers, orbiters, and sentinel-style enemies.
- `assets/enemies-source-magenta.png`: preserved chroma-key enemy sheet source.
- `assets/player-drone.png`: generated transparent player drone used as the in-game user asset.
- `assets/player-drone-source-magenta.png`: preserved chroma-key source used to create the transparent player drone.
- `assets/powerups.png`: generated transparent 4x2 power-up sprite sheet with no text labels.
- `assets/powerups-source-magenta.png`: preserved chroma-key power-up sheet source.
- `assets/retro-home-frame.png`: generated retro arcade home screen frame.
- `assets/sprites.png`: generated transparent 2x2 sprite sheet used for crystals, shields, hazards, and sparkle bursts.
- `assets/sprites-source-magenta.png`: preserved chroma-key source used to create the transparent sprite sheet.

## Gameplay

- Power-ups: shield, magnet, time shard, repair, pulse bomb, score boost, and phase.
- Enemies: basic mines, chasers, dashers with warning lines, orbiters, and boss laser sweeps.
- Boss phase: the Core Warden appears late in the run; collecting crystals damages it for a large score bonus.

## Run locally

From this folder:

```powershell
python -m http.server 51873 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:51873/
```

## Deploy

This is a static site. Deploy the repository root as the publish directory, with `index.html` as the entry point.
