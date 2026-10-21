// Utilidades de prueba de colisión: distancia con signo de un punto a cada sólido del mapa
// (positiva = afuera, negativa = adentro) y detector de «incrustados».
import { clamp } from '../src/sim/math.js';

/** Distancia con signo del centro `p` a la superficie del sólido `s`. */
export function sd(s, p) {
  if (s.type === 'box') {
    const qx = Math.abs(p.x - s.c.x) - s.h.x, qy = Math.abs(p.y - s.c.y) - s.h.y, qz = Math.abs(p.z - s.c.z) - s.h.z;
    const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
    return out + Math.min(Math.max(qx, qy, qz), 0);
  }
  if (s.type === 'cyl') {
    const dx = Math.hypot(p.x - s.c.x, p.z - s.c.z) - s.r, dy = Math.max(s.y0 - p.y, p.y - s.y1);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
  }
  if (s.type === 'sph') return Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z) - s.r;
  if (s.type === 'inner') return s.R - Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z);
  return Infinity;
}
/** Mayor hundimiento (r − distancia) del centro dentro de cualquier sólido del mapa. > 0 = la esfera de radio r toca la materia. */
export function hundimiento(map, p, r) {
  let worst = -Infinity, which = null;
  for (const s of map.solids) { const d = r - sd(s, p); if (d > worst) { worst = d; which = s; } }
  return { depth: worst, solid: which };
}
export { clamp };
