// Offscreen markers avoid the health panel and four combat controls.
export function hudSafePoint(x, y, width, height) {
  if (x > width - 230 && y > height - 255) x = width - 245;
  if (x < 260 && y > height - 125) y = height - 145;
  return [Math.max(24, Math.min(width - 24, x)), Math.max(24, Math.min(height - 24, y))];
}
