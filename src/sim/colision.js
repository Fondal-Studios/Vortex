// COLISIÓN DE CRIATURAS CON EL MUNDO (paredes, muros, coberturas, islas, techos).
// Una sola fuente de verdad para que NINGUNA criatura atraviese un sólido del mapa (`map.solids`: los mismos que frenan al jugador
// y a las balas, y los mismos que dibuja el cliente):
//   · radioCol(m): radio de colisión = radio visual del modelo (r) × 0,9 (suelo) o × 0,8 (aire) × 1,15 si es élite.
//   · barrer(): mueve en sub-pasos según la velocidad (nunca más de ~0,45 radios por sub-paso) → no «tunelea» ni a 30 m/s.
//   · empujar(): desplazamiento directo (esquiva del Pombero, arrastre de la niebla cian…) también con barrido.
//   · resolverTodas(): red de seguridad al final de cada tick: si algo (separación entre criaturas, un empujón) dejó a una criatura
//     dentro de un sólido, la saca por la cara más cercana.
//   · desvio(): «antenas» de dirección: mira adelante y rodea muros/columnas en vez de empujar contra ellos (deslizando).
import { len, cross } from './math.js';
import { collide } from './physics.js';

export const COL = { suelo: 0.9, vuelo: 0.8, elite: 1.15, paso: 0.45 };   // (0,9 / 0,8 = los factores de siempre: el piso y el equilibrio de juego no cambian; lo nuevo es que ahora valen contra TODOS los sólidos)

/** Radio de colisión de una criatura (m). */
export const radioCol = (m) => m.r * (m.def.fly ? COL.vuelo : COL.suelo) * (m.elite && !m.def.boss ? COL.elite : 1);

/** Distancia con signo del punto `p` a la superficie del sólido `s` (+ afuera, − adentro). */
export function sd(s, p) {
  if (s.type === 'box') {
    const qx = Math.abs(p.x - s.c.x) - s.h.x, qy = Math.abs(p.y - s.c.y) - s.h.y, qz = Math.abs(p.z - s.c.z) - s.h.z;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
  }
  if (s.type === 'cyl') {
    const dx = Math.hypot(p.x - s.c.x, p.z - s.c.z) - s.r, dy = Math.max(s.y0 - p.y, p.y - s.y1);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
  }
  if (s.type === 'sph') return Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z) - s.r;
  if (s.type === 'inner') return s.R - Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z);
  return Infinity;
}
/** Espacio libre alrededor del punto: la menor distancia a cualquier sólido. */
export function holgura(map, p) {
  let best = Infinity; const sl = map.solids;
  for (let i = 0; i < sl.length; i++) { const d = sd(sl[i], p); if (d < best) best = d; }
  return best;
}

/** Mueve a la criatura con su velocidad en sub-pasos con colisión. Devuelve la mejor normal de contacto (o null). */
export function barrer(game, m, dt, up = null) {
  const cr = radioCol(m), map = game.map, vel = m.vel;
  const steps = Math.max(m.def.fly ? 1 : 2, Math.min(8, Math.ceil((len(vel) * dt) / (cr * COL.paso))));
  const h = dt / steps; let best = null;
  for (let s = 0; s < steps; s++) {
    m.pos.x += vel.x * h; m.pos.y += vel.y * h; m.pos.z += vel.z * h;
    const c = collide(map, m.pos, vel, cr, up);
    if (c && (!best || c.d > best.d)) best = c;
  }
  return best;
}

/** Desplazamiento directo `delta` (m) con barrido: la criatura se desliza hasta donde puede, no «salta» a través de un muro. */
export function empujar(game, m, delta) {
  const cr = radioCol(m), l = len(delta);
  if (l < 1e-6) return;
  const steps = Math.max(1, Math.min(12, Math.ceil(l / (cr * COL.paso))));
  for (let s = 0; s < steps; s++) {
    m.pos.x += delta.x / steps; m.pos.y += delta.y / steps; m.pos.z += delta.z / steps;
    collide(game.map, m.pos, null, cr, null);
  }
}

/** Coloca a una criatura invocada `m` junto a su invocadora `par`: si entre las dos hay un muro, aparece pegada a la invocadora (no del otro lado). */
export function colocarCerca(game, m, par) {
  const cr = radioCol(m), a = par.pos, b = m.pos, l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  let libre = true;
  for (let t = 1; t < l; t += 1) { const k = t / l; if (holgura(game.map, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }) < cr * 0.8) { libre = false; break; } }
  if (!libre) { m.pos.x = a.x; m.pos.y = a.y; m.pos.z = a.z; }
  collide(game.map, m.pos, null, cr, null);
}

/** Último recurso para una criatura metida en un rincón de varios sólidos (collide() sale por la cara más cercana, que puede dar a otro sólido):
 *  busca por anillos crecientes el punto libre más cercano (prefiere moverse en horizontal). Devuelve true si la movió. */
const DIRS = (() => { const o = []; for (let y = 0; y <= 1; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) { if (!x && !y && !z) continue; const l = Math.hypot(x, y, z); o.push([x / l, y / l, z / l]); } return o; })();
export function liberar(game, m) {
  const cr = radioCol(m), map = game.map;
  if (holgura(map, m.pos) >= cr * 0.6) return false;
  for (const R of [1, 2, 3, 4.5, 6, 8, 12]) for (const d of DIRS) {
    const q = { x: m.pos.x + d[0] * R, y: m.pos.y + d[1] * R, z: m.pos.z + d[2] * R };
    if (holgura(map, q) >= cr * 0.98) { m.pos.x = q.x; m.pos.y = q.y; m.pos.z = q.z; return true; }
  }
  return false;
}

/** Red de seguridad: saca de los sólidos a toda criatura que haya quedado adentro (separación, empujones, nacimientos). */
export function resolverTodas(game) {
  const ms = game.monsters, map = game.map;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i]; if (m.dead || m.kind === 'madre') continue;
    collide(map, m.pos, m.vel, radioCol(m), null);
    if (((game.tick + m.id) & 15) === 0) liberar(game, m);   // (de vez en cuando) ¿quedó metida en un rincón de varios sólidos?
  }
}

/**
 * Antenas: si hay un sólido delante de la marcha deseada, prueba otros rumbos (±35°, ±70°, ±110°; los voladores también hacia
 * arriba) y devuelve el primero libre. Mantiene el lado elegido (m.fs) para no oscilar. `wish` y el resultado son vectores de marcha.
 * En el suelo la sonda va un poco elevada sobre el centro, para que el piso no cuente como obstáculo.
 */
const ANG = [0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
export function desvio(game, m, wish, up, vuela) {
  const l = len(wish); if (l < 1e-6) return wish;
  const map = game.map, cr = radioCol(m), look = cr + Math.max(2.2, Math.min(7, len(m.vel) * 0.45));
  const ux = wish.x / l, uy = wish.y / l, uz = wish.z / l;
  const lift = vuela ? 0 : cr * 0.55, base = { x: m.pos.x + up.x * lift, y: m.pos.y + up.y * lift, z: m.pos.z + up.z * lift };
  const need = cr * 0.92;
  const libre = (dx, dy, dz) => holgura(map, { x: base.x + dx * look, y: base.y + dy * look, z: base.z + dz * look }) >= need
    && holgura(map, { x: base.x + dx * look * 0.5, y: base.y + dy * look * 0.5, z: base.z + dz * look * 0.5 }) >= need;
  if (libre(ux, uy, uz)) { m.fs = 0; return wish; }
  const w = { x: ux, y: uy, z: uz }, side = cross(up, w), sl = len(side);
  if (sl < 1e-6) return wish;
  const sx = side.x / sl, sy = side.y / sl, sz = side.z / sl, pref = m.fs || (((m.id & 1) ? 1 : -1));
  const order = pref > 0 ? ANG : [-0.6, 0.6, -1.2, 1.2, -1.9, 1.9];
  for (const a of order) {
    const c = Math.cos(a), s = Math.sin(a);
    const dx = ux * c + sx * s, dy = uy * c + sy * s, dz = uz * c + sz * s;
    if (libre(dx, dy, dz)) { m.fs = a > 0 ? 1 : -1; return { x: dx * l, y: dy * l, z: dz * l }; }
  }
  if (vuela) { // sin salida lateral: subir
    const dx = ux * 0.5 + up.x * 0.85, dy = uy * 0.5 + up.y * 0.85, dz = uz * 0.5 + up.z * 0.85, k = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / k * l, y: dy / k * l, z: dz / k * l };
  }
  return wish;
}

/**
 * DESATASCADOR: si una criatura terrestre quiere avanzar pero casi no se mueve durante ~1 s (rincón entre dos obstáculos, hueco más angosto
 * que ella), prueba otros rumbos con holgura y sale por ahí durante ~1,2 s. Devuelve el rumbo a usar (el deseado, o el de escape).
 */
const NO_ATASCA = new Set(['charge', 'stun', 'wind', 'open', 'cast', 'aim', 'blink', 'pull']);
export function desatascar(game, m, wish, speed, dt, up) {
  let st = m.stk; if (!st) st = m.stk = { x: m.pos.x, y: m.pos.y, z: m.pos.z, acc: 0, hasta: 0, dir: null };
  if (game.time < st.hasta && st.dir) return st.dir;
  if (speed < 2 || len(wish) < 1e-6 || NO_ATASCA.has(m.state) || !m.grounded) { st.x = m.pos.x; st.y = m.pos.y; st.z = m.pos.z; st.acc = 0; return wish; }
  st.acc += dt;
  if (st.acc < 0.9) return wish;
  const moved = Math.hypot(m.pos.x - st.x, m.pos.y - st.y, m.pos.z - st.z), esperado = speed * st.acc;
  st.x = m.pos.x; st.y = m.pos.y; st.z = m.pos.z; st.acc = 0;
  if (moved > esperado * 0.22) return wish;
  // ¿lo frena la GEOMETRÍA (muro, cobertura, rincón) y no otra criatura o el jugador? Sonda corta hacia donde quiere ir.
  { const cr0 = radioCol(m), ux = wish.x / len(wish), uy = wish.y / len(wish), uz = wish.z / len(wish), k = cr0 * 1.5;
    if (holgura(game.map, { x: m.pos.x + up.x * cr0 * 0.55 + ux * k, y: m.pos.y + up.y * cr0 * 0.55 + uy * k, z: m.pos.z + up.z * cr0 * 0.55 + uz * k }) > cr0 * 1.05) return wish; }
  // atascada: elegir el rumbo libre (no el deseado), alternando el lado
  const cr = radioCol(m), l = len(wish), base = { x: wish.x / l, y: wish.y / l, z: wish.z / l }, side = cross(up, base), sl = len(side) || 1;
  const lado = (m.esc = -(m.esc || (m.id & 1 ? 1 : -1)));
  let mejor = null, mejorH = -Infinity;
  for (const a of [1.57, 2.35, 0.8, 3.14, 1.2, 2.8]) {
    const c = Math.cos(a), s = Math.sin(a) * lado;
    const d = { x: base.x * c + side.x / sl * s, y: base.y * c + side.y / sl * s, z: base.z * c + side.z / sl * s };
    const h = Math.min(holgura(game.map, { x: m.pos.x + up.x * cr * 0.55 + d.x * cr * 2.2, y: m.pos.y + up.y * cr * 0.55 + d.y * cr * 2.2, z: m.pos.z + up.z * cr * 0.55 + d.z * cr * 2.2 }),
      holgura(game.map, { x: m.pos.x + up.x * cr * 0.55 + d.x * cr * 4, y: m.pos.y + up.y * cr * 0.55 + d.y * cr * 4, z: m.pos.z + up.z * cr * 0.55 + d.z * cr * 4 }));
    if (h > mejorH) { mejorH = h; mejor = d; }
    if (h >= cr * 1.1) break;
  }
  if (!mejor) return wish;
  st.dir = { x: mejor.x * l, y: mejor.y * l, z: mejor.z * l }; st.hasta = game.time + 1.2;
  return st.dir;
}
