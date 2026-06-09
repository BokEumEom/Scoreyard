// src/game/effects.js -- visual feedback: particle bursts, shockwaves, floating
// text, combat-fx sprites, and hitstop. Mutates game state + Math.random only
// (cosmetic; no seeded rng). Updated each frame; drawn by src/render/draw.js.
import { game } from "./state.js";

export function triggerHitstop(seconds) {
  game.hitstop = Math.max(game.hitstop, seconds);
}

export function spawnFx(frame, x, y, size, life) {
  game.fx.push({ frame, x, y, size, life, maxLife: life, rot: Math.random() * Math.PI * 2 });
}

export function updateFx(dt) {
  game.fx = game.fx.filter(f => {
    f.life -= dt;
    return f.life > 0;
  });
}

export function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    const life = 0.42 + Math.random() * 0.38;

    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 4,
      color,
      life,
      maxLife: life
    });
  }
}

export function spawnShockwave(x, y, color, maxRadius, life) {
  game.shockwaves.push({
    x,
    y,
    color,
    radius: 4,
    maxRadius,
    life,
    maxLife: life
  });
}

export function addFloatingText(text, x, y, color, life) {
  game.floatingTexts.push({
    text,
    x,
    y,
    color,
    life: life || 0.95,
    maxLife: life || 0.95
  });
}

export function updateEffects(dt) {
  game.particles = game.particles.filter(particle => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life > 0;
  });

  game.shockwaves = game.shockwaves.filter(wave => {
    wave.life -= dt;
    const progress = 1 - wave.life / wave.maxLife;
    wave.radius = wave.maxRadius * progress;
    return wave.life > 0;
  });

  game.floatingTexts = game.floatingTexts.filter(text => {
    text.life -= dt;
    text.y -= 28 * dt;
    return text.life > 0;
  });
}
