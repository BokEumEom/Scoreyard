// src/render/draw.js -- canvas rendering layer: primitives + entity/effect draws.
// Reads shared ctx/canvas/game/assets + sprite data; no game logic and no
// profile/avatar (drawScene/drawPlayer/drawAvatarCore stay in main.js).
import { canvas, ctx } from "../core/dom.js";
import { game } from "../game/state.js";
import { assets } from "./assets.js";
import { clamp } from "../util/mathx.js";
import { RUN_SECONDS, MAX_HEALTH } from "../core/config.js";
import {
  spriteFrames,
  powerUpFrames,
  enemyFrames,
  varietyFrames,
  powerUpConfig,
  varietyPowerUpFrame,
  bossVariantFrames,
  arenaPropFrames,
  combatFxFrames
} from "../data/sprites.js";

const stars = Array.from({ length: 86 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: 0.6 + Math.random() * 1.9,
  speed: 8 + Math.random() * 24,
  alpha: 0.2 + Math.random() * 0.58
}));

export function imageReady(image) {
  return image.complete && image.naturalWidth > 0;
}

export function drawImageCover(image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

export function drawSprite(frameName, x, y, size, rotation, alpha) {
  if (!imageReady(assets.sprites)) {
    return false;
  }

  const frame = spriteFrames[frameName];
  const frameWidth = assets.sprites.naturalWidth / 2;
  const frameHeight = assets.sprites.naturalHeight / 2;
  const sourceX = frame.col * frameWidth;
  const sourceY = frame.row * frameHeight;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(
    assets.sprites,
    sourceX,
    sourceY,
    frameWidth,
    frameHeight,
    -size / 2,
    -size / 2,
    size,
    size
  );
  ctx.restore();
  return true;
}

export function drawSheetSprite(image, frame, columns, rows, x, y, size, rotation, alpha) {
  if (!imageReady(image) || !frame) {
    return false;
  }

  const frameWidth = image.naturalWidth / columns;
  const frameHeight = image.naturalHeight / rows;
  const sourceX = frame.col * frameWidth;
  const sourceY = frame.row * frameHeight;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    frameWidth,
    frameHeight,
    -size / 2,
    -size / 2,
    size,
    size
  );
  ctx.restore();
  return true;
}

export function drawVarietySprite(group, variant, x, y, size, rotation, alpha) {
  const frames = varietyFrames[group];
  if (!frames || frames.length === 0) {
    return false;
  }

  const index = Math.abs(Math.round(variant || 0)) % frames.length;
  return drawSheetSprite(assets.variety, frames[index], 4, 4, x, y, size, rotation, alpha);
}

export function currentBackdrop() {
  const backdrops = assets.backdrops || [assets.backdrop];
  const index = Math.abs(Math.round(game.backdropVariant || 0)) % backdrops.length;
  return backdrops[index] || assets.backdrop;
}

export function drawBackground() {
  const backdrop = currentBackdrop();

  if (imageReady(backdrop)) {
    drawImageCover(backdrop, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(5, 20, 19, 0.26)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#071817");
    gradient.addColorStop(0.48, "#0d302c");
    gradient.addColorStop(1, "#11201f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const glow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.45,
    20,
    canvas.width * 0.5,
    canvas.height * 0.45,
    canvas.width * 0.62
  );
  glow.addColorStop(0, "rgba(44, 242, 143, 0.08)");
  glow.addColorStop(1, "rgba(44, 242, 143, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawArenaProps();

  stars.forEach(star => {
    const y = (star.y + game.worldTime * star.speed) % canvas.height;
    ctx.globalAlpha = (star.alpha + Math.sin(game.worldTime * 2 + star.x) * 0.12) * 0.6;
    ctx.beginPath();
    ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = "#d9fff0";
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(199, 244, 223, 0.055)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(226, 185, 59, 0.24)";
  ctx.lineWidth = 2;
  const scanY = (game.worldTime * 58) % canvas.height;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(canvas.width, scanY + 16);
  ctx.stroke();
}

export function drawOrb(orb) {
  const pulse = 1 + Math.sin(game.worldTime * 5 + orb.phase) * 0.08;

  if (drawVarietySprite("orbs", orb.variant, orb.x, orb.y, orb.r * 5.9 * pulse, game.worldTime * 0.28 + orb.phase * 0.08, 1)) {
    return;
  }

  if (drawSprite("crystal", orb.x, orb.y, orb.r * 5.7 * pulse, game.worldTime * 0.28 + orb.phase * 0.08, 1)) {
    return;
  }

  ctx.save();
  ctx.translate(orb.x, orb.y);
  ctx.rotate(game.worldTime * orb.rotSpeed + orb.phase);
  ctx.shadowColor = "rgba(44, 242, 143, 0.8)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#2cf28f";
  ctx.strokeStyle = "#baffdd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -orb.r * 1.35 * pulse);
  ctx.lineTo(orb.r * 0.95 * pulse, 0);
  ctx.lineTo(0, orb.r * 1.35 * pulse);
  ctx.lineTo(-orb.r * 0.95 * pulse, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -orb.r * 0.86);
  ctx.lineTo(orb.r * 0.38, 0);
  ctx.lineTo(0, orb.r * 0.72);
  ctx.lineTo(-orb.r * 0.18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHazard(hazard) {
  if (hazard.type === "dasher" && hazard.mode === "windup") {
    drawDasherWarning(hazard);
  }

  const size = hazard.type === "chaser" ? hazard.r * 4.9 : hazard.r * 5.25;

  const drewEnemySprite = drawVarietySprite("enemies", hazard.variant, hazard.x, hazard.y, size, hazard.angle, 1)
    || (hazard.type === "mine"
      ? drawSprite("hazard", hazard.x, hazard.y, size, hazard.angle, 1)
      : drawSheetSprite(assets.enemies, enemyFrames[hazard.type] || enemyFrames.sentinel, 3, 2, hazard.x, hazard.y, size, hazard.angle, 1));

  if (drewEnemySprite) {
    drawEnemyTypeRing(hazard);
    return;
  }

  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.rotate(hazard.angle);
  ctx.shadowColor = "rgba(239, 90, 95, 0.8)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ef5a5f";
  ctx.strokeStyle = "#ffd1d3";
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < 16; i += 1) {
    const angle = i / 16 * Math.PI * 2;
    const radius = i % 2 === 0 ? hazard.r * 1.25 : hazard.r * 0.74;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#8d2328";
  ctx.beginPath();
  ctx.arc(0, 0, hazard.r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDasherWarning(hazard) {
  const dx = game.player.x - hazard.x;
  const dy = game.player.y - hazard.y;
  const length = Math.hypot(dx, dy) || 1;

  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(game.worldTime * 18) * 0.22;
  ctx.strokeStyle = "#ff7a45";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(hazard.x, hazard.y);
  ctx.lineTo(hazard.x + dx / length * 260, hazard.y + dy / length * 260);
  ctx.stroke();
  ctx.restore();
}

export function drawEnemyTypeRing(hazard) {
  const color = hazard.type === "chaser"
    ? "#ff7a45"
    : hazard.type === "dasher"
      ? "#f7d64a"
      : hazard.type === "orbiter"
        ? "#b76cff"
        : "#ef5a5f";

  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.rotate(hazard.angle * 0.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = hazard.type === "mine" ? 0.65 : 0.95;
  ctx.beginPath();
  ctx.arc(0, 0, hazard.r * 1.75, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawPowerUp(powerUp) {
  const pulse = 1 + Math.sin(game.worldTime * 4 + powerUp.phase) * 0.12;
  const config = powerUpConfig[powerUp.type];

  if (drawSheetSprite(assets.variety, varietyPowerUpFrame(powerUp.type), 4, 4, powerUp.x, powerUp.y, powerUp.r * 5.15 * pulse, game.worldTime * 0.45 + powerUp.phase * 0.08, 1)) {
    return;
  }

  if (drawSheetSprite(assets.powerups, powerUpFrames[powerUp.type], 4, 2, powerUp.x, powerUp.y, powerUp.r * 5.25 * pulse, game.worldTime * 0.45 + powerUp.phase * 0.08, 1)) {
    return;
  }

  ctx.save();
  ctx.translate(powerUp.x, powerUp.y);
  ctx.rotate(game.worldTime * 1.8 + powerUp.phase);
  ctx.shadowColor = config.color;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = config.color;
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, powerUp.r * 1.18 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.rotate(-game.worldTime * 1.8 - powerUp.phase);
  drawFallbackPowerUpIcon(powerUp.type, config.color);
  ctx.restore();
}

export function drawFallbackPowerUpIcon(type, color) {
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  if (type === "repair") {
    ctx.fillRect(-3, -10, 6, 20);
    ctx.fillRect(-10, -3, 20, 6);
    return;
  }

  if (type === "time") {
    ctx.beginPath();
    ctx.moveTo(-7, -9);
    ctx.lineTo(7, -9);
    ctx.lineTo(0, 0);
    ctx.lineTo(7, 9);
    ctx.lineTo(-7, 9);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.stroke();
    return;
  }

  if (type === "magnet") {
    ctx.beginPath();
    ctx.arc(0, 0, 10, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    return;
  }

  if (type === "phase") {
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawLasers() {
  game.lasers.forEach(laser => {
    const active = laser.warmup <= 0;
    const alpha = active ? Math.min(1, laser.life * 2.3) : 0.32 + Math.sin(game.worldTime * 24) * 0.18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = active ? "#ef5a5f" : "#ffcf66";
    ctx.lineWidth = active ? laser.width * 2 : 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = active ? 22 : 10;
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();

    if (active) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff7d6";
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
    }

    ctx.restore();
  });
}

export function drawFx(frameName, x, y, size, rotation, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const drawn = drawSheetSprite(assets.combatFx, combatFxFrames[frameName], 4, 3, x, y, size, rotation, alpha);
  ctx.restore();
  return drawn;
}

export function drawFxLayer() {
  game.fx.forEach(f => {
    const t = Math.max(0, f.life / f.maxLife); // 1 -> 0 over its lifetime
    drawFx(f.frame, f.x, f.y, f.size * (1.4 - t * 0.4), f.rot, t);
  });
}

export function drawBolts() {
  if (game.bolts.length === 0) {
    return;
  }
  const frame = game.combo >= 6 ? "chargedBolt" : "bolt";
  game.bolts.forEach(bolt => {
    const angle = Math.atan2(bolt.vy, bolt.vx);
    if (!drawFx(frame, bolt.x, bolt.y, 30, angle, 1)) {
      ctx.save();
      ctx.fillStyle = "#8ad7ff";
      ctx.shadowColor = "#8ad7ff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

export function drawBoss() {
  if (!game.boss) {
    return;
  }

  const boss = game.boss;
  const healthRatio = Math.max(0, boss.health / boss.maxHealth);
  const bossSize = boss.r * 3.05;

  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(boss.angle);

  const bossFrame = bossVariantFrames[game.bossVariant % bossVariantFrames.length];

  ctx.shadowColor = "rgba(226, 185, 59, 0.8)";
  ctx.shadowBlur = 24;
  if (drawSheetSprite(assets.bossVariants, bossFrame, 2, 2, 0, 0, bossSize, 0, 1)) {
    ctx.shadowBlur = 0;
  } else if (imageReady(assets.boss)) {
    ctx.drawImage(assets.boss, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = "rgba(226, 185, 59, 0.8)";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "#e2b93b";
    ctx.fillStyle = "rgba(13, 93, 86, 0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, boss.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = "#2cf28f";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, boss.r + 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * healthRatio);
  ctx.stroke();

  ctx.restore();
}

export function drawShockwaves() {
  game.shockwaves.forEach(wave => {
    const alpha = clamp(wave.life / wave.maxLife, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = wave.color;
    ctx.lineWidth = 5 * alpha;
    ctx.shadowColor = wave.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

export function drawParticles() {
  game.particles.forEach(particle => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);

    if (particle.color === "#e2b93b" && drawSprite("sparkle", particle.x, particle.y, particle.r * 12, game.worldTime * 2, alpha)) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r * (0.6 + alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function drawFloatingTexts() {
  game.floatingTexts.forEach(text => {
    const alpha = clamp(text.life / text.maxLife, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = text.color;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = 3;
    ctx.font = "800 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  });
}

export function drawOverlay(message) {
  ctx.save();
  ctx.fillStyle = "rgba(7, 24, 23, 0.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fafeff";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 8);
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillStyle = "#c7f4df";
  ctx.fillText("Collect orbit crystals, grab shields, dodge coral hazards.", canvas.width / 2, canvas.height / 2 + 25);
  ctx.restore();
}

export function drawArenaProps() {
  if (!game.arenaProps.length || !imageReady(assets.arenaProps)) {
    return;
  }

  game.arenaProps.forEach(prop => {
    const frame = arenaPropFrames[prop.frame % arenaPropFrames.length];
    const bob = Math.sin(game.worldTime * prop.drift + prop.phase) * prop.bob;
    const rotation = prop.rotation + Math.sin(game.worldTime * 0.2 + prop.phase) * 0.035;

    ctx.save();
    ctx.shadowColor = "rgba(44, 242, 143, 0.42)";
    ctx.shadowBlur = 10;
    drawSheetSprite(
      assets.arenaProps,
      frame,
      4,
      3,
      prop.x,
      prop.y + bob,
      prop.size,
      rotation,
      prop.alpha
    );
    ctx.restore();
  });
}

export function drawBossBar() {
  const boss = game.boss;
  if (!boss) {
    return;
  }
  const w = canvas.width * 0.6;
  const x = (canvas.width - w) / 2;
  const y = 16;
  const h = 12;
  const pct = Math.max(0, boss.health / boss.maxHealth);
  ctx.save();
  ctx.fillStyle = "rgba(8, 16, 20, 0.72)";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = boss.phase === 2 ? "#ff7a45" : "#e2b93b";
  ctx.fillRect(x, y, w * pct, h);
  ctx.strokeStyle = "rgba(226, 185, 59, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#e9f6f1";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`CORE WARDEN${boss.phase === 2 ? " — OVERDRIVE" : ""}`, canvas.width / 2, y - 4);
  ctx.restore();
}

// In-canvas player HUD: score/orbs (top-left), countdown (top-right), segmented
// HP gauge + shield pips (bottom-left), continuous combo/fire gauge (bottom-right).
export function drawHud() {
  // HUD now lives in the DOM bar (#hudBar), updated by main.js updateHud().
  // Kept as a no-op export for backward-compatible imports.
}
