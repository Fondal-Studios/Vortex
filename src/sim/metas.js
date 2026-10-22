// Mini-misiones secundarias (opcionales, 1 por oleada) y punto de destino del objetivo. Datos puros y deterministas: sin azar, sin DOM.
// La misión nace al empezar cada oleada (no en la del jefe), se cuenta en la simulación y paga núcleos (y a veces esencias) al cumplirse.
import { ESSENCE_OF } from './data.js';
import { dist } from './math.js';
import { dropsMision } from './drops.js';   // misión cumplida → objeto (docs/INVENTARIO.md)
import { faunaForzarRara } from './fauna.js';   // misión «Alimentación»: asegura una especie rara cerca (docs/FAUNA.md)

/** Textos y recompensas. `n(oleada)` = cuánto hay que lograr; `cores(oleada)` = núcleos de premio; `ess` = [tipo, cantidad] extra. */
export const MISIONES = {
  asalto: { nombre: 'Primer contacto', n: () => 3, cores: (w) => 10 + 3 * w, ess: ['carne', 2] },
  melee:   { nombre: 'Golpe a golpe',  n: (w) => 3 + Math.floor(w / 2), cores: (w) => 10 + 3 * w, ess: ['carne', 2] },
  intacto: { nombre: 'Intocable',      n: () => 1,                       cores: (w) => 14 + 4 * w, ess: ['cristal', 1] },
  elite:   { nombre: 'Caza mayor',     n: () => 1,                       cores: (w) => 18 + 5 * w, ess: null /* el élite da su propia esencia: se premia con la de su tipo */ },
  alimento: { nombre: 'Alimentación',  n: () => 1,                       cores: (w) => 16 + 4 * w, ess: ['carne', 3] },   // comer una especie RARA de la fauna (no entra en el ciclo: reemplaza a «Golpe a golpe» en las oleadas 4 y 7)
};
export const OLEADAS_ALIMENTO = [4, 7];
const CICLO = ['melee', 'intacto', 'elite'];

/** Qué misión toca en la oleada `n` (1..). El élite sólo desde la 3 (antes no hay élites). Determinista, sin azar. */
export function misionDe(n) {
  if (n === 1) return 'asalto';
  const k = CICLO[(n - 1) % CICLO.length];
  return k === 'elite' && n < 3 ? 'melee' : k;
}

/** Crea la misión de la oleada `n` en la partida `g` (null en la del jefe y en el campo de pruebas). */
export function iniciarMision(g, n, esJefe) {
  g.forceElite = false;
  if (esJefe || g.practice) { g.mision = null; return; }
  const k = g.fa && OLEADAS_ALIMENTO.includes(n) ? 'alimento' : misionDe(n), M = MISIONES[k];
  g.mision = { k, n: M.n(n), p: 0, st: 'active', rc: Math.round(M.cores(n)), re: M.ess ? M.ess[1] : 0, ek: M.ess ? M.ess[0] : null, w: n };
  if (k === 'elite') g.forceElite = true; // el primer bicho que pueda ser élite lo será: la misión siempre se puede cumplir
  if (k === 'alimento') faunaForzarRara(g);   // la rara nace ya, cerca de alguien, y no se va hasta que termine la oleada
}
/** Se comió un bicho: si la misión es «Alimentación» y era una especie rara, se cumple. */
export function misionAlimento(g, sp) {
  const mi = g.mision; if (!mi || mi.st !== 'active' || mi.k !== 'alimento' || !sp || !sp.rara) return;
  mi.p = 1; pagar(g, null);
}

function pagar(g, m) {
  const mi = g.mision;
  mi.st = 'done';
  for (const p of g.alivePlayers()) {
    p.cores += Math.round(mi.rc * (p.bn ? p.bn.cores : 1));
    const k = mi.k === 'elite' && m ? ESSENCE_OF[m.kind] : mi.ek;
    if (k && p.ess) p.ess[k] += mi.k === 'elite' ? 3 : mi.re;
  }
  g.emit({ t: 'mision', ph: 'done', k: mi.k, rc: mi.rc });
  dropsMision(g);
}

/** Una criatura murió (`by` = jugador que la mató, o null). */
export function misionKill(g, m, by) {
  const mi = g.mision; if (!mi || mi.st !== 'active' || m.def.boss) return;
  if (mi.k === 'asalto') { if (by) { mi.p++; if (mi.p >= mi.n) pagar(g, m); } }
  else if (mi.k === 'melee') { if (by && by.inMelee) { mi.p++; if (mi.p >= mi.n) pagar(g, m); } }
  else if (mi.k === 'elite') { if (m.elite) { mi.p = 1; pagar(g, m); } }
}
/** Un jugador recibió daño. */
export function misionHurt(g) {
  const mi = g.mision; if (!mi || mi.st !== 'active' || mi.k !== 'intacto') return;
  mi.st = 'failed'; g.emit({ t: 'mision', ph: 'failed', k: mi.k });
}
/** Se superó la oleada: lo que siga activo se resuelve ('intacto' se cumple; las demás se pierden). */
export function misionFin(g) {
  const mi = g.mision; if (!mi || mi.st !== 'active') return;
  if (mi.k === 'intacto') { mi.p = 1; pagar(g, null); }
  else { mi.st = 'failed'; g.emit({ t: 'mision', ph: 'failed', k: mi.k }); }
}
export const misionSnap = (g) => (g.mision ? { k: g.mision.k, n: g.mision.n, p: g.mision.p, st: g.mision.st, rc: g.mision.rc, targets: g.mision.st !== 'active' ? [] : (g.mision.k === 'alimento' ? (g.fa?.list || []).filter(f => f.sp.rara && f.vida > 0) : g.monsters.filter(m => !m.dead && (g.mision.k === 'elite' ? m.elite : g.mision.k === 'melee'))).map(m => [m.pos.x, m.pos.y, m.pos.z]) } : null);

/** Punto del mundo al que apunta el objetivo activo (para la flecha del HUD), o null si no hay un lugar concreto. */
export function puntoObjetivo(g) {
  const o = g.objective; if (!o || o.state !== 'active') return null;
  const objs = o.ids.map((id) => g.objects.find((x) => x.id === id)).filter(Boolean);
  let t = null;
  if (o.type === 'secuencia') t = objs[o.stage];
  else if (o.type === 'caza') t = g.monsters.find((m) => m.id === o.target && !m.dead);
  else if (o.type === 'ancla') t = objs[0];
  else if (o.type === 'sintonia') t = objs.find((x) => !x.on) || objs[0];
  else if (o.type === 'nucleo') { const [core, altar] = objs; t = core && core.carrier ? altar : core; }
  else if (o.type === 'cultivo') { const ref = g.alivePlayers()[0]; t = objs.filter((x) => !x.on).sort((a, b) => (ref ? dist(a.pos, ref.pos) - dist(b.pos, ref.pos) : 0))[0]; }
  return t ? [Math.round(t.pos.x * 100) / 100, Math.round(t.pos.y * 100) / 100, Math.round(t.pos.z * 100) / 100] : null;
}
