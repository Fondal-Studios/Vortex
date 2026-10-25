// REZAGADOS: política de «sin teletransportes». Una criatura NUNCA se reubica de golpe (eso hacía imposible rastrear a las últimas
// de la oleada). En su lugar:
//   (a) ACOSO: la criatura rezagada gana velocidad creciente (hasta ×1,6 en 10 s) y va DERECHO al jugador (por la ruta del mapa),
//       con una trayectoria visible: el cliente le pone un faro de luz y una flecha de radar con la distancia (campo `ac` del snapshot).
//   (b) Marcadores: las últimas criaturas (≤ 6, sin cola ni jefe) se marcan siempre, aunque estén camufladas (client/radar.js, render.js).
//   (c) Si queda realmente atascada (casi no se movió en 5 s) o cae fuera del mapa, se DESINTEGRA a la vista (evento `desint`) y cuenta
//       como baja sin botín. No se mueve a ningún otro lugar.
//   (d) Los refuerzos nacen con aviso (`omen`) y nunca «saltan».
import { dist } from './math.js';
import { blocked } from './physics.js';
import { perseguir } from './ai.js';

export const ACOSO = {
  maxMul: 1.6,        // multiplicador de velocidad al máximo
  rampa: 10,          // s hasta el máximo
  soltar: 22,         // m: a esta distancia del jugador vuelve a su comportamiento normal (dispara, muerde…)
  soltarFinal: 12,    // m: en el tramo final de la oleada se las sigue empujando hasta estar al alcance (no se quedan flotando lejos)
  pisoVel: 16,        // m/s mínimos de marcha (antes del ritmo global ×0,7 ⇒ ~11 m/s) para las lentas (Viuda, Silbón…); en el laberinto las rutas son largas
  ventana: 5,         // s sin avanzar al menos `minDesp` ⇒ atascada
  minDesp: 3,         // m
  oculta: 20,         // s cerca del jugador pero SIN línea de vista (escondida detrás de algo inalcanzable) ⇒ se desintegra
  ultimas: 6,         // cuántas criaturas se marcan siempre al final de la oleada
  gracia: 4,          // s después de vaciarse la cola antes de marcar las últimas
  espera: 25,         // s sin bajas con más de `ultimas` criaturas lejos antes de acosarlas
};

/** Pone a la criatura en modo acoso (idempotente). */
export function marcarAcoso(g, m) {
  if (m.acoso || m.def.boss || m.dead) return;
  m.acoso = { t0: g.time, base: m.speedMul, x: m.pos.x, y: m.pos.y, z: m.pos.z, tw: g.time };
  m.cloak = false;
  g.emit({ t: 'acoso', id: m.id, k: m.kind, p: [m.pos.x, m.pos.y, m.pos.z] });
}

/** Desintegración visible: no es una muerte normal (sin botín, sin esencia), pero cuenta como baja para cerrar la oleada. */
export function desintegrar(g, m, why = 'atascada') {
  if (m.dead) return;
  // Si el custodio MARCADO de una Caza se desintegra (atascado o inalcanzable), el bloqueo cae: antes la misión se perdía por algo que el jugador no pudo evitar.
  if (g.objective && g.objective.type === 'caza' && g.objective.state === 'active' && g.objective.target === m.id) g.objective.prog = 1;
  m.dead = true; g.stats.kills++; g.stats.desint = (g.stats.desint || 0) + 1;
  if (m.parent) { const par = g.monsters.find((q) => q.id === m.parent); if (par) par.kids = Math.max(0, par.kids - 1); }
  g.emit({ t: 'desint', id: m.id, k: m.kind, why, p: [m.pos.x, m.pos.y, m.pos.z] });
}

/** ¿Hay línea libre (sin sólidos) entre el ojo del jugador y la criatura? */
function aLaVista(g, p, m) {
  const e = g.eyePos(p), dx = m.pos.x - e.x, dy = m.pos.y - e.y, dz = m.pos.z - e.z, l = Math.hypot(dx, dy, dz);
  for (let t = 1.5; t < l - m.r; t += 1.5) if (blocked(g.map, { x: e.x + dx / l * t, y: e.y + dy / l * t, z: e.z + dz / l * t })) return false;
  return true;
}

/** Un tick de una criatura en acoso. Devuelve true si ESTE tick la mueve el acoso (se salta su IA normal). */
export function tickAcoso(g, m, dt, targets) {
  const a = m.acoso; if (!a) return false;
  const k = Math.min(1, (g.time - a.t0) / ACOSO.rampa);
  m.speedMul = a.base * (1 + (ACOSO.maxMul - 1) * k);
  let d = Infinity, p = targets[0]; for (const q of targets) { const dd = dist(q.pos, m.pos); if (dd < d) { d = dd; p = q; } }
  const rel = g.finalDeOleada() ? ACOSO.soltarFinal : ACOSO.soltar, vista = d <= rel * 1.6 ? aLaVista(g, p, m) : false;
  if (d <= rel && vista) { a.x = m.pos.x; a.y = m.pos.y; a.z = m.pos.z; a.tw = g.time; a.oculta = 0; return false; }   // ya está cerca y a la vista: pelea normal
  if (d <= rel) { a.oculta = (a.oculta || 0) + dt; if (a.oculta > ACOSO.oculta) { desintegrar(g, m, 'inalcanzable'); return true; } }
  if (g.time - a.tw >= ACOSO.ventana) {
    const moved = Math.hypot(m.pos.x - a.x, m.pos.y - a.y, m.pos.z - a.z);
    if (moved < ACOSO.minDesp && (d > rel * 1.6 || !vista)) { desintegrar(g, m, 'atascada'); return true; }
    a.x = m.pos.x; a.y = m.pos.y; a.z = m.pos.z; a.tw = g.time;
  }
  perseguir(g, m, dt, targets, Math.max(m.def.speed * m.speedMul, ACOSO.pisoVel * (0.6 + 0.4 * k)));
  return true;
}

/** Al final de la oleada: marca en acoso a las criaturas lejanas (reemplaza al antiguo «Vórtice las reubica»). */
export function tickRezagados(g, dt) {
  const left = g.monsters.filter((m) => !m.dead && !m.def.boss);
  const sola = !g.queue.length && !g.omens.length && left.length && left.length === g.monsters.filter((m) => !m.dead).length;
  if (!sola) { g.straggleT = 0; return; }
  g.straggleT = (g.straggleT || 0) + dt;
  if (g.straggleT > (left.length <= ACOSO.ultimas ? ACOSO.gracia : ACOSO.espera)) {
    const ref = g.alivePlayers()[0];
    if (ref) for (const m of left) if (!m.acoso && dist(m.pos, ref.pos) > 28) marcarAcoso(g, m);
    g.straggleT = left.length <= ACOSO.ultimas ? ACOSO.gracia : 0;   // con pocas, se vuelve a revisar cada tick (si surge una nueva lejana)
  }
}
