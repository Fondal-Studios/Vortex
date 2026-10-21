// Utilidades de prueba de colisión: hundimiento de una esfera dentro de los sólidos del mapa.
import { sd } from '../src/sim/colision.js';

/** Mayor hundimiento (r − distancia) del centro dentro de cualquier sólido del mapa. > 0 = la esfera de radio r toca la materia. */
export function hundimiento(map, p, r) {
  let worst = -Infinity, which = null;
  for (const s of map.solids) { const d = r - sd(s, p); if (d > worst) { worst = d; which = s; } }
  return { depth: worst, solid: which };
}
export { sd };
