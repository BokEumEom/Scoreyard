// mathx.js — small pure math/format helpers shared across the game.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(point, segment) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / lengthSq, 0, 1);
  const x = segment.x1 + t * dx;
  const y = segment.y1 + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
