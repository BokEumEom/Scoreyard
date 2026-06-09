// src/render/assets.js — image assets + loader.
// loadImage repaints once an image arrives via a redraw callback that main.js
// registers (setRedraw), so this module never imports the renderer — no cycle.
let redraw = () => {};

export function setRedraw(fn) {
  redraw = fn;
}

function loadImage(src) {
  const image = new Image();
  image.onload = () => redraw();
  image.src = src;
  return image;
}

export const assets = {
  backdrop: loadImage("assets/arena-backdrop.png"),
  backdrops: [
    loadImage("assets/arena-backdrop.png"),
    loadImage("assets/arena-backdrop-nebula.png"),
    loadImage("assets/arena-backdrop-station.png"),
    loadImage("assets/arena-backdrop-solar.png"),
  ],
  boss: loadImage("assets/boss-core.png"),
  bossVariants: loadImage("assets/boss-variants.png"),
  arenaProps: loadImage("assets/arena-props.png"),
  enemies: loadImage("assets/enemies.png"),
  player: loadImage("assets/player-drone.png"),
  powerups: loadImage("assets/powerups.png"),
  sprites: loadImage("assets/sprites.png"),
  variety: loadImage("assets/variety-atlas.png"),
  combatFx: loadImage("assets/combat-fx.png")
};
