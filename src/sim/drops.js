// DROPEO DE OBJETOS (docs/INVENTARIO.md): determinista, con su PROPIO generador derivado de la semilla (g.drRng); nunca usa g.rng, así que
// activarlo no cambia las oleadas, los eventos ni las arenas vivas. Todo el azar de acá sale de g.drRng.
//
// Fuentes: élite con afijo · jefe · ofrenda de arena viva · evento de oleada superado · misión cumplida · cofre (capullo florecido, geoda) ·
// respiro entre oleadas (una por jugador) · herrero (forja con núcleos y esencias).
// Cada jugador tiene su cuenta de «pity»: p.pity = { l: tiradas sin legendaria, e: tiradas sin épica o mejor }. Viaja por opts.pity y vuelve por el snapshot (pt).
// Las armas FIRMA (una por Huésped) no entran en las tablas: sólo caen al derrotar al jefe de su mapa con ese Huésped habiendo cumplido misiones (SIGNATURES).
import { makeRng, madd, dist, len, norm, mul, clone, v3 } from './math.js';
import { collide } from './physics.js';
import { ITEMS, ITEM_IDS, SLOTS, SIGNATURES, MATERIAL_IDS, MATERIALS, FORJA_FIRMA } from './items.js';

export const PITY = { epica: 10, legendaria: 30, suave: 10, paso: 0.012 };
/** Pesos base [común, rara, épica, legendaria] y probabilidad de que la fuente suelte algo. */
export const FUENTES = {
  elite:   { tabla: [55, 32, 11, 2], prob: (w) => Math.min(0.42, 0.2 + 0.015 * w), nombre: 'Élite' },
  jefe:    { tabla: [0, 35, 50, 15], prob: () => 1, nombre: 'Jefe', n: 2 },
  ofrenda: { tabla: [60, 30, 9, 1], prob: () => 1, nombre: 'Ofrenda de la arena' },
  evento:  { tabla: [50, 35, 13, 2], prob: () => 1, nombre: 'Evento superado' },
  mision:  { tabla: [45, 38, 15, 2], prob: () => 1, nombre: 'Misión cumplida' },
  cofre:   { tabla: [35, 40, 22, 3], prob: () => 1, nombre: 'Cofre' },
  respiro: { tabla: [75, 20, 4.5, 0.5], prob: () => 1, nombre: 'Respiro' },
  herrero: { tabla: [0, 55, 38, 7], prob: () => 1, nombre: 'Herrero' },
};
export const FUENTE_ES = Object.fromEntries(Object.entries(FUENTES).map(([k, v]) => [k, v.nombre]));
/** Cuánto crecen los pesos de cada rareza con la oleada (por oleada sobre la 1.ª). */
export const ESCALA_OLEADA = [0, 0.04, 0.08, 0.1];
/** Materiales que más caen en cada arena (×2) y los que suelta cada afijo de élite (×3). */
export const MAT_MAPA = { m1: ['cristal', 'vacio'], m2: ['cristal', 'hueso'], m3: ['cristal', 'vacio'], m4: ['raiz', 'carne', 'espora'], m5: ['quitina', 'hueso'], m6: ['hueso', 'espora'] };
export const MAT_AFIJO = { blindado: 'quitina', veloz: 'raiz', vampirico: 'carne', explosivo: 'espora', espectral: 'vacio', 'llorón': 'cristal' };
export const SLOT_PESO = { gun: 16, melee: 16, head: 14, torso: 14, arms: 14, legs: 14, relic: 12 };
const DESCARTE = 0.3;   // peso de repetir justo el objeto anterior

/** Prepara el dropeo de una partida (lo llama el constructor de Game). */
export function initDrops(g, seed) {
  g.drRng = makeRng(((seed >>> 0) ^ 0x9e3779b1) >>> 0);
  g.loot = []; g.lootId = 1; g.stats.misDone = 0; g.stats.drops = 0;
}
export function initPity(p, pity) {
  const n = (x) => Math.max(0, Math.min(999, Math.floor(Number(x) || 0)));
  p.pity = { l: n(pity && pity.l), e: n(pity && pity.e) }; p.bag = []; p.lastDrop = '';
}

/* ───────── tirada ───────── */
/** Pesos [c,r,e,l] de esta tirada para el jugador p (oleada, dificultad y pity). Devuelve { w, forzar } (forzar = rareza mínima garantizada). */
export function pesosRareza(g, p, fuente) {
  const F = FUENTES[fuente], w = F.tabla.slice(), ola = Math.max(0, (g.wave || 1) - 1), dif = Math.max(0.5, Math.min(2, g.difficulty || 1));
  for (let i = 1; i < 4; i++) w[i] *= 1 + ESCALA_OLEADA[i] * ola;
  w[2] *= 0.9 + 0.1 * dif; w[3] *= 0.9 + 0.1 * dif;
  const tot = w.reduce((a, b) => a + b, 0), py = p.pity || { l: 0, e: 0 };
  if (py.l > PITY.suave) w[3] += tot * PITY.paso * (py.l - PITY.suave);       // pity suave: la legendaria se acerca
  let forzar = 0;
  if (py.l >= PITY.legendaria) forzar = 3; else if (py.e >= PITY.epica) forzar = 2;   // pity duro
  return { w, forzar };
}
/** Elige una rareza con la tabla y el pity. */
export function rarezaDe(g, p, fuente) {
  const { w, forzar } = pesosRareza(g, p, fuente), tot = w.reduce((a, b) => a + b, 0);
  let x = g.drRng.next() * tot, r = 0;
  for (let i = 0; i < 4; i++) { x -= w[i]; if (x <= 0) { r = i; break; } r = i; }
  return Math.max(r, forzar);
}
/** Elige un objeto de esa rareza (sin firmas) según ranuras y materiales. */
export function objetoDe(g, p, rareza, ctx = {}) {
  let pool = ITEM_IDS.filter((id) => ITEMS[id].r === rareza && !ITEMS[id].host);
  if (!pool.length) pool = ITEM_IDS.filter((id) => !ITEMS[id].host);
  const mats = MAT_MAPA[g.mapId] || [], pesos = pool.map((id) => {
    const it = ITEMS[id]; let w = SLOT_PESO[it.slot] || 10;
    if (mats.includes(it.mat)) w *= 2;
    if (ctx.mat && it.mat === ctx.mat) w *= 3;
    if (p && p.lastDrop === id) w *= DESCARTE;
    return w;
  });
  const tot = pesos.reduce((a, b) => a + b, 0); let x = g.drRng.next() * tot;
  for (let i = 0; i < pool.length; i++) { x -= pesos[i]; if (x <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
/** Una tirada completa para el jugador p. Devuelve la instancia { id, q, r, src } y actualiza su pity. */
export function tirar(g, p, fuente, ctx = {}) {
  const r = rarezaDe(g, p, fuente), id = objetoDe(g, p, r, ctx), q = Math.round(g.drRng.next() * 100) / 100;
  if (p) {
    const py = p.pity || (p.pity = { l: 0, e: 0 });
    py.l = r === 3 ? 0 : Math.min(999, py.l + 1); py.e = r >= 2 ? 0 : Math.min(999, py.e + 1); p.lastDrop = id;
  }
  g.stats.drops++;
  return { id, q, r: ITEMS[id].r, src: fuente };
}

/* ───────── el objeto en el mundo ───────── */
const a3 = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
/** Suelta un objeto en el mundo para `forPid` (0 = cualquiera lo puede recoger). */
export function soltar(g, inst, pos, forPid) {
  if (g.loot.length >= 24) g.loot.shift();
  const kick = g.drRng.unit(), up = v3(0, 1, 0);
  const o = { id: g.lootId++, inst, pos: madd(clone(pos), up, 0.8), vel: v3(kick.x * 3, 5, kick.z * 3), up, life: 150, for: forPid || 0, dead: false, t: 0 };
  g.loot.push(o); g.emit({ t: 'drop', lid: o.id, id: inst.id, r: inst.r, src: inst.src, pid: o.for, p: a3(pos) });
  return o;
}
/** Entrega directa a la mochila de la partida (jefe, forja, final): sin recoger. */
export function entregar(g, p, inst, pos) {
  p.bag.push({ id: inst.id, q: inst.q, r: inst.r, src: inst.src });
  g.emit({ t: 'drop', lid: 0, id: inst.id, r: inst.r, src: inst.src, pid: p.id, p: a3(pos || p.pos), directo: true });
  g.emit({ t: 'loot', pid: p.id, id: inst.id, q: inst.q, r: inst.r, src: inst.src, p: a3(p.pos) });
}
function recoger(g, p, o) {
  o.dead = true; p.bag.push({ id: o.inst.id, q: o.inst.q, r: o.inst.r, src: o.inst.src });
  g.emit({ t: 'loot', pid: p.id, id: o.inst.id, q: o.inst.q, r: o.inst.r, src: o.inst.src, p: a3(o.pos) });
}

/** Cada tick: física del botín y recogida (comunes y raras al pasar; épicas y legendarias con USAR). */
export function updateLoot(g, dt) {
  if (!g.loot.length) return;
  for (const o of g.loot) {
    o.life -= dt; o.t += dt;
    const grav = g.map.gravityAt(o.pos, g.time);
    if (len(grav) > 0.5) o.up = norm(mul(grav, -1));
    o.vel = madd(o.vel, grav, dt); o.pos = madd(o.pos, o.vel, dt);
    collide(g.map, o.pos, o.vel, 0.45, o.up);
    if (g.map.outOfBounds(o.pos)) { const ref = g.alivePlayers().find((q) => !o.for || q.id === o.for) || g.players[0]; if (ref) { o.pos = madd(clone(ref.pos), ref.up, 1.5); o.vel = v3(); } else o.dead = true; }
    if (o.life <= 0) { const ref = g.players.find((q) => !o.for || q.id === o.for); if (ref) recoger(g, ref, o); else o.dead = true; continue; }   // nunca se pierde: al vencer, va a su dueño
    if (o.t < 0.5) continue;
    for (const p of g.players) {
      if (p.dead || o.dead || (o.for && o.for !== p.id)) continue;
      const d = dist(o.pos, p.pos);
      if ((o.inst.r < 2 && d < 2.4) || (d < 4.2 && p.interactEdge)) { recoger(g, p, o); break; }
    }
  }
  if (g.loot.some((o) => o.dead)) g.loot = g.loot.filter((o) => !o.dead);
}
/** Al terminar la partida lo que quedó en el piso se entrega a su dueño (o al primer jugador). */
export function flushLoot(g) {
  for (const o of g.loot) { if (o.dead) continue; const ref = g.players.find((q) => !o.for || q.id === o.for) || g.players[0]; if (ref) recoger(g, ref, o); }
  g.loot = [];
}
export const lootSnap = (g) => g.loot.map((o) => [o.id, o.inst.id, o.inst.r, ...a3(o.pos), o.for]);

/* ───────── fuentes ───────── */
const vivos = (g) => g.players.filter((p) => !p.dead);
/** Elige a quién le toca un botín de una criatura: quien la mató, o el jugador vivo más cercano. */
function dueno(g, by, pos) {
  if (by && by.input && !by.dead) return by;
  let best = null, bd = Infinity; for (const p of vivos(g)) { const d = dist(p.pos, pos); if (d < bd) { bd = d; best = p; } } return best;
}
/** Una criatura murió: las élites con afijo y las geodas (cofres) pueden soltar objetos. */
export function dropsKill(g, by, m) {
  if (g.practice) return;
  if (m.kind === 'geoda') { const p = dueno(g, by, m.pos); if (p && g.drRng.next() < 0.35) soltar(g, tirar(g, p, 'cofre'), m.pos, 0); return; }
  if (!m.elite || m.def.boss) return;
  const p = dueno(g, by, m.pos); if (!p) return;
  if (g.drRng.next() >= FUENTES.elite.prob(g.wave)) return;
  soltar(g, tirar(g, p, 'elite', { mat: MAT_AFIJO[m.affix] }), m.pos, p.id);
}
/** Cada jugador vivo recibe su propio botín de una fuente grupal (misión, evento, respiro, ofrenda). */
export function dropsGrupo(g, fuente, pos) {
  if (g.practice) return;
  for (const p of vivos(g)) soltar(g, tirar(g, p, fuente), pos ? madd(clone(pos), v3(g.drRng.next() * 2 - 1, 0, g.drRng.next() * 2 - 1), 1.5) : madd(clone(p.pos), p.heading, 2.5), p.id);
}
/** Ofrenda de una arena viva (boca llena): un botín compartido en el lugar de la boca. */
export function dropsOfrenda(g, pos) {
  if (g.practice || g.time - (g.lastOfrenda ?? -99) < 25) return;   // como mucho una ofrenda cada 25 s
  g.lastOfrenda = g.time;
  const ref = vivos(g).sort((a, b) => dist(a.pos, pos) - dist(b.pos, pos))[0]; if (!ref) return;
  soltar(g, tirar(g, ref, 'ofrenda'), pos, 0);
}
/** Cofre de un capullo florecido: botín compartido. */
export function dropsCofre(g, pos) {
  if (g.practice) return;
  const ref = vivos(g).sort((a, b) => dist(a.pos, pos) - dist(b.pos, pos))[0]; if (!ref) return;
  soltar(g, tirar(g, ref, 'cofre'), pos, 0);
}
export function dropsMision(g) { g.stats.misDone = (g.stats.misDone || 0) + 1; dropsGrupo(g, 'mision'); }
export const dropsEvento = (g) => dropsGrupo(g, 'evento');
export const dropsRespiro = (g) => dropsGrupo(g, 'respiro');

/** ¿Cumple p la condición de su arma firma en esta partida? (jefe del mapa vencido, misiones, mapa correcto). */
export function firmaCumplida(g, p) {
  const sid = p.char && SIGNATURES[p.char]; if (!sid || g.practice) return false;
  const c = ITEMS[sid].sig; return !!c && g.mapId === c.map && (g.stats.misDone || 0) >= c.misiones;
}
/** Cayó el jefe: cada jugador recibe 2 objetos directo en la mochila; y su arma firma si cumplió la condición. */
export function dropsJefe(g, pos) {
  if (g.practice) return;
  for (const p of g.players) {
    if (p.dead && p.lost) continue;
    for (let i = 0; i < (FUENTES.jefe.n || 1); i++) entregar(g, p, tirar(g, p, 'jefe'), pos);
    if (firmaCumplida(g, p)) {
      const sid = SIGNATURES[p.char]; p.sigMet = true;
      entregar(g, p, { id: sid, q: Math.round(g.drRng.next() * 100) / 100, r: 3, src: 'firma' }, pos);
      g.emit({ t: 'firma', pid: p.id, id: sid, char: p.char });
    }
  }
}

/** Herrero: forja un objeto vivo (firma = el arma del Huésped, sólo con el plano desbloqueado). Devuelve true si se forjó. Lo llama npcs.js. */
export function forjar(g, p, firma = false) {
  if (g.practice || p.dead) return false;
  const maxKey = ['carne', 'cristal', 'ojo', 'vacio'].reduce((a, k) => ((p.ess[k] || 0) > (p.ess[a] || 0) ? k : a), 'carne');
  if (firma) {
    const sid = p.char && SIGNATURES[p.char]; if (!sid || !p.sigPlan || p.sigForged) return false;
    const mk = MATERIALS[ITEMS[sid].mat].ess; if (p.cores < FORJA_FIRMA.cores || (p.ess[mk] || 0) < FORJA_FIRMA.ess) return false;
    p.cores -= FORJA_FIRMA.cores; p.ess[mk] -= FORJA_FIRMA.ess; p.sigForged = true;
    entregar(g, p, { id: sid, q: Math.round(g.drRng.next() * 100) / 100, r: 3, src: 'forja' }); return true;
  }
  if (p.cores < 45 || (p.ess[maxKey] || 0) < 4) return false;
  p.cores -= 45; p.ess[maxKey] -= 4;
  const mat = MATERIAL_IDS.find((m) => MATERIALS[m].ess === maxKey && g.drRng.next() < 0.5) || undefined;
  entregar(g, p, tirar(g, p, 'herrero', { mat })); return true;
}
void SLOTS;
