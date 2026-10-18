// ENJAMBRE — la lógica de Colmena (sexto Huésped, invocador). Todo determinista y sin DOM; NO usa g.rng ni Math.random.
// Contrato y números: docs/HUESPEDES.md → «Colmena». Datos (stats, caminos, golpes): src/sim/colmena-data.js.
//
// Tres tipos de «unidades» (objetos del mundo, `g.objects`), todas con dueño (`owner` = id del jugador) y límite:
//   · 'zangano'  — hasta LIMITS.units por jugador (4 base; Criador +2, Plaga +4, Marabunta +4) y LIMITS.unitsTotal en toda la partida. Orbita al jugador, VUELA
//                  hacia la criatura más cercana (a ≤ 26 m del dueño) y la pica solo. Es inmune (las criaturas sólo persiguen a jugadores) y caduca (20 s; 30 s los de la pasiva).
//   · 'nido'     — torreta orgánica quieta (14 s), hasta LIMITS.nests por jugador; la pone la habilidad 3 y el camino «Nidos vivos».
//   · 'reina'    — la Reina (camino final «La Reina»): una por jugador, sigue al dueño y dispara fuerte mientras viva él.
// El daño de las unidades lo hace el DUEÑO (g.damageMonster(m, dmg, p)) con fuente 'skill': así cuenta para sus estilos, bendiciones, maestría y carga de la definitiva,
// y las bajas le dan núcleos y esencias. En modo Combo, los golpes con fx 'orden' mandan atacar a todo el enjambre (ordenar()) y cuentan como parte del combo.
import { sub, mul, madd, dot, cross, len, dist, norm, clone } from './math.js';
import { LIMITS } from './data.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const has = (p, id) => !!(p.path && p.path.includes(id));
export const isColmena = (p) => !!p && p.char === 'colmena';
export const UNIT_TYPES = ['zangano', 'nido', 'reina'];
/** Constantes de balance (todas en un lugar). */
export const ENJ = { maraCap: 4, dmg: 6.5, cd: 0.9, life: 20, lifePasiva: 30, range: 26, sting: 6, nidoDmg: 4.5, nidoCd: 0.4, nidoLife: 14, nidoRange: 30, reinaDmg: 30, reinaCd: 1.0, passiveCap: 2, criaT: 6, ordenK: 0.2, ordenMax: 8, frenzyT: 6 };

export const unitsOf = (g, p) => g.objects.filter((o) => o.type === 'zangano' && o.owner === p.id);
const nestsOf = (g, p) => g.objects.filter((o) => o.type === 'nido' && o.owner === p.id);
export const unitCap = (p) => Math.min(LIMITS.units, 4 + (has(p, 'criador') ? 2 : 0) + (has(p, 'plaga') ? 4 : 0) + (p.ultId === 'marabunta' ? (ENJ.maraCap ?? 4) : 0));
const evoK = (p) => 1 + 0.06 * (p.evo || 0);
const unitDmg = (p) => ENJ.dmg * evoK(p) * (has(p, 'aguijon') ? 1.4 : 1) * (has(p, 'reina') ? 1.25 : 1);
const frenzy = (g, p) => g.time < (p.swarmUntil || 0) || p.ultId === 'marabunta';
const hot = (p) => !!(p.cb && p.cb.win > 0);   // en Combo: mientras la cadena sigue viva, el enjambre ataca un poco más rápido

/** Crea un zángano junto al dueño. Devuelve el objeto o null (límite). `renew`: si está lleno, renueva el tiempo del más viejo. */
export function spawnUnit(g, p, { life = ENJ.life, renew = false } = {}) {
  const mine = unitsOf(g, p), cap = unitCap(p);
  if (mine.length >= cap || g.objects.filter((o) => o.type === 'zangano').length >= LIMITS.unitsTotal || g.objects.length >= 38) {   // 38: g.addObject recicla objetos desde 40 y no debe llevarse los de otros sistemas
    if (renew && mine.length) { const old = mine.reduce((a, b) => (b.life < a.life ? b : a)); old.life = Math.max(old.life, old.max || life); }
    return null;
  }
  const used = new Set(mine.map((o) => o.slot)); let slot = 0; while (used.has(slot)) slot++;
  const n = mine.length, right = cross(p.heading, p.up), a = n * 2.399 + (g.tick || 0) * 0.01;   // reparto angular determinista (ángulo áureo)
  const pos = madd(madd(madd(p.pos, p.up, 1.8), p.heading, Math.cos(a) * 1.2), right, Math.sin(a) * 1.2);
  return g.addObject('zangano', pos, { owner: p.id, life, max: life, r: 0.5, cd: 0.3 + 0.05 * (n % 6), slot });
}
/** Brotan `n` zánganos (los que quepan). Devuelve cuántos nacieron. */
export function spawnUnits(g, p, n, o = {}) { let k = 0; for (let i = 0; i < n; i++) if (spawnUnit(g, p, i === 0 ? { ...o, renew: true } : o)) k++; return k; }

/** Nido-torreta orgánico en `pos`. Máx. LIMITS.nests por jugador (se recicla el más viejo). */
export function plantNest(g, p, pos, life = ENJ.nidoLife) {
  const mine = nestsOf(g, p); if (mine.length >= LIMITS.nests) g.removeObject(mine[0]);
  return g.addObject('nido', pos, { owner: p.id, life, max: life, r: 1.1, cd: 0.4 });
}

/** Criatura viva más cercana a `pos` dentro de `r` (+ su radio); empata por orden del arreglo (determinista). */
function nearest(g, pos, r, skip = null, home = null, homeR = 0) {
  let best = null, bd = Infinity;
  for (const m of g.monsters) { if (m.dead || m === skip) continue; if (home && dist(m.pos, home) - m.r > homeR) continue; const d = dist(m.pos, pos) - m.r; if (d < r && d < bd) { bd = d; best = m; } }
  return best;
}
function poison(g, p, m) { if (m.dead) return; m.dotUntil = g.time + 4; m.dotDps = Math.max(m.dotDps || 0, 7); m.dotKind = 'poison'; m.dotBy = p.id; }
/** Una picadura de zángano (o de la Reina/nido con k propio). Aplica veneno (Aguijón) y área (Nube). */
function sting(g, p, from, m, dmg) {
  g.enjDmg = true;   // el daño de las unidades NO carga la definitiva (si no, la Marabunta se realimentaría sola)
  try {
    g.damageMonster(m, dmg, p, m.pos); g.emit({ t: 'tshot', o: a3(from), to: a3(m.pos) });
    if (m.dead) return;
    if (has(p, 'aguijon')) poison(g, p, m);
    if (has(p, 'nube')) {
      let n = 0; m.slowUntil = Math.max(m.slowUntil || 0, g.time + 1);
      for (const q of g.monsters) { if (q.dead || q === m || n >= 5 || dist(q.pos, m.pos) > 2.8 + q.r) continue; n++; g.damageMonster(q, dmg * 0.5, p, q.pos); if (!q.dead) q.slowUntil = Math.max(q.slowUntil || 0, g.time + 1); }
    }
  } finally { g.enjDmg = false; }
}
function boom(g, p, pos) {
  const s0 = g.dmgSrc; g.dmgSrc = 'skill';
  try { g.explode(pos, 4, 0, 55 * evoK(p), p, false); for (const m of g.monsters) if (!m.dead && !m.def.boss && dist(m.pos, pos) < 4 + m.r) m.vel = madd(m.vel, norm(sub(m.pos, pos)), 8); } finally { g.dmgSrc = s0; }
}

/** El enjambre ataca junto con un golpe de combo: cada zángano (hasta ENJ.ordenMax) pica a la criatura más cercana a `aim`. Devuelve cuántas picaduras. */
export function ordenar(g, p, dmg, aim) {
  const us = unitsOf(g, p).slice(0, ENJ.ordenMax), s0 = g.dmgSrc; g.dmgSrc = 'skill'; let n = 0;
  try { for (const o of us) { const m = nearest(g, aim, 16); if (!m) break; sting(g, p, o.pos, m, Math.max(1, dmg * ENJ.ordenK)); n++; o.cd = Math.max(o.cd, 0.25); } } finally { g.dmgSrc = s0; }
  return n;
}

/* ───────── paso por tick del jugador (lo llama huespedes.js → updateHost) ───────── */
export function enjambreTick(g, p, dt) {
  if (p.dead) return;
  const us = unitsOf(g, p); p.nUnits = us.length;
  // Cría viva (pasiva): un zángano gratis cada 6 s mientras haya menos de 2 (3 con Cohabitación)
  p.criaT = (p.criaT ?? 2) - dt;
  if (p.criaT <= 0) { p.criaT = ENJ.criaT * (has(p, 'criador') ? 0.6 : 1); if (us.length < Math.min(unitCap(p), ENJ.passiveCap + (has(p, 'cohabita') ? 1 : 0))) spawnUnit(g, p, { life: ENJ.lifePasiva }); }
  // Marabunta: un zángano por segundo mientras dura
  if (p.ultId === 'marabunta') { p.maraT = (p.maraT || 0) - dt; if (p.maraT <= 0) { p.maraT = 1; spawnUnit(g, p, { life: ENJ.life }); } }
  // Nidos vivos: cada 12 s brota un nido-torreta delante del jugador
  if (has(p, 'nidos')) { p.nidoT = (p.nidoT ?? 4) - dt; if (p.nidoT <= 0) { p.nidoT = 12; plantNest(g, p, madd(madd(p.pos, p.heading, 3.5), p.up, 0.3), ENJ.nidoLife); } }
  // La Reina: una por jugador mientras tenga el camino
  if (has(p, 'reina') && !g.objects.some((o) => o.type === 'reina' && o.owner === p.id)) g.addObject('reina', madd(p.pos, p.up, 3), { owner: p.id, life: 1e9, r: 1.0, cd: 0.8 });
}
/** Se llama al cambiar de Huésped: no deja unidades huérfanas. */
export function limpiarUnidades(g, p) { for (const o of [...g.objects]) if (UNIT_TYPES.includes(o.type) && o.owner === p.id) g.removeObject(o); }

/* ───────── objetos (los llama huespedes.js → hostObject0) ───────── */
export function enjambreObject(g, o, dt) {
  const p = g.players.find((q) => q.id === o.owner);
  if (!p || p.dead || p.char !== 'colmena') { g.removeObject(o); return true; }
  o.life -= dt; o.cd -= dt;
  const right = cross(p.heading, p.up);
  if (o.type === 'zangano') {
    if (o.life <= 0) { if (has(p, 'detonador')) boom(g, p, o.pos); g.removeObject(o); return true; }
    const far = nearest(g, o.pos, 60, null, p.pos, ENJ.range);   // la criatura más cercana al zángano que esté a ≤ 26 m del dueño
    const a = o.slot * (Math.PI * 2 / Math.max(4, unitCap(p))) + g.time * 0.9, rad = 2.4 + 0.25 * (o.slot % 3), h = 1.9 + 0.4 * Math.sin(g.time * 2 + o.slot);
    let want = madd(madd(madd(p.pos, p.up, h), p.heading, Math.cos(a) * rad), right, Math.sin(a) * rad);
    if (has(p, 'cohabita')) want = madd(madd(madd(p.pos, p.up, 1.5), right, (o.slot % 2 ? 1 : -1) * 0.55), p.heading, -0.1 - 0.12 * (o.slot >> 1));   // posados en los hombros
    if (far) want = madd(madd(far.pos, p.up, far.r + 1.1), norm(sub(p.pos, far.pos)), far.r + 2.2);
    const d = sub(want, o.pos), l = len(d), sp = Math.min(30, 4 + l * 4); o.pos = madd(o.pos, d, l > 1e-6 ? Math.min(l, sp * dt) / l : 0);
    if (far && o.cd <= 0 && dist(o.pos, far.pos) < far.r + ENJ.sting) {
      o.cd = ENJ.cd * (frenzy(g, p) ? 0.5 : 1) * (hot(p) ? 0.85 : 1);
      sting(g, p, o.pos, far, unitDmg(p));
    }
    return true;
  }
  if (o.type === 'nido') {
    if (o.life <= 0) { g.removeObject(o); return true; }
    if (o.cd <= 0) {
      const m = nearest(g, o.pos, ENJ.nidoRange, null);
      if (m) { o.cd = ENJ.nidoCd * (frenzy(g, p) ? 0.6 : 1); sting(g, p, madd(o.pos, p.up, 0.8), m, ENJ.nidoDmg * evoK(p) * (has(p, 'aguijon') ? 1.4 : 1)); } else o.cd = 0.3;
    }
    return true;
  }
  if (o.type === 'reina') {   // la Reina: flota detrás del hombro y dispara dos ráfagas por segundo
    const want = madd(madd(madd(p.pos, p.up, 3.0), right, 1.8), p.heading, -1.2 + Math.sin(g.time * 1.3) * 0.4);
    o.pos = madd(o.pos, sub(want, o.pos), Math.min(1, 5 * dt));
    if (o.cd <= 0) {
      const m = nearest(g, o.pos, 36, null);
      if (m) { o.cd = ENJ.reinaCd * (frenzy(g, p) ? 0.6 : 1); const m2 = nearest(g, o.pos, 36, m); sting(g, p, o.pos, m, ENJ.reinaDmg * evoK(p)); if (m2) sting(g, p, o.pos, m2, ENJ.reinaDmg * evoK(p) * 0.7); } else o.cd = 0.3;
    }
    return true;
  }
  return false;
}

/* ───────── multiplicadores y ganchos ───────── */
/** Daño que hace el jugador (hostOut): Cría viva +3 % por zángano (máx. 5) y Cohabitación +3 % por zángano (máx. 6). */
export function enjambreOut(p) { const n = p.nUnits || 0; return 1 + 0.03 * Math.min(5, n) + (has(p, 'cohabita') ? 0.03 * Math.min(6, n) : 0); }
/** Daño que recibe el jugador (hostDamageIn): Marabunta −20 %, Cohabitación −3 % por zángano (máx. 6). */
export function enjambreIn(p) { return (p.ultId === 'marabunta' ? 0.8 : 1) * (has(p, 'cohabita') ? 1 - 0.03 * Math.min(6, p.nUnits || 0) : 1); }
/** Plaga: cada baja cría un zángano gratis. */
export function enjambreKill(g, p) { if (has(p, 'plaga') && !p.dead) spawnUnit(g, p, { life: ENJ.life }); }
/** Habilidades del modo Shooter. */
export function enjambreSkill(g, p, id) {
  if (id === 'zumbido') {
    const h = norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading);
    p.ext = madd(p.ext, h, 36); p.invulUntil = Math.max(p.invulUntil, g.time + 0.3); spawnUnit(g, p, { life: ENJ.life, renew: true }); return true;
  }
  if (id === 'cria') { spawnUnits(g, p, 3, { life: ENJ.life }); return true; }
  if (id === 'nido') { const d = norm(sub(g.aimDir(p), mul(p.up, dot(g.aimDir(p), p.up))), p.heading); plantNest(g, p, madd(madd(p.pos, d, 7), p.up, 0.3)); return true; }
  return false;
}
/** Llamado del enjambre (habilidad principal del modo Combo): brotan zánganos y todo el enjambre entra en frenesí. */
export function llamado(g, p) { spawnUnits(g, p, 3 + ((p.evo || 0) >= 2 ? 1 : 0), { life: ENJ.life }); p.swarmUntil = g.time + ENJ.frenzyT; }
/** Estados para el snapshot: cantidad de zánganos vivos (`un`) y si el enjambre está en frenesí (`fz`). */
export function enjambreSnap(g, p) { if (!isColmena(p)) return {}; return { un: unitsOf(g, p).length, uc: unitCap(p), fz: frenzy(g, p) ? 1 : 0 }; }
void clone;

/** Nube de aguijones (fx 'nube' del Combo): daña y ralentiza en un óvalo delante del jugador. Devuelve cuántas criaturas pegó (máx. 10). */
export function nubeArea(g, p, dmg, big = 1) {
  const c = madd(p.pos, norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading), 2.2), s0 = g.dmgSrc; g.dmgSrc = 'skill'; let n = 0;
  try { for (const m of g.monsters) { if (m.dead || n >= 10 || dist(m.pos, c) > 4.2 * big + m.r) continue; n++; g.damageMonster(m, dmg * 0.4, p, m.pos); if (!m.dead) { m.slowUntil = Math.max(m.slowUntil || 0, g.time + 1.5); if (has(p, 'aguijon')) poison(g, p, m); } } } finally { g.dmgSrc = s0; }
  g.emit({ t: 'boom', p: a3(c), r: 4.2 * big }); return n;
}
