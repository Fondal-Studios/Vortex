// FLORA INTERACTIVA (docs/FLORA.md): cada arena tiene un jardín psicodélico que INTERACTÚA con el Huésped, las criaturas y el entorno.
// Determinista y sin DOM: usa su PROPIO generador derivado de la semilla (g.flRng, como g.arRng en arenas-vivas.js y g.ngRng en nieblas.js)
// y NUNCA toca g.rng. Los datos viven en flora-data.js. Las plantas NO son sólidas (no tapan caminos, disparos ni apariciones): son
// blancos que se pueden dañar y zonas que ayudan, hieren o atrapan.
//
// ESTADOS de cada planta: 0 brote (crece, inofensiva) · 1 madura (actúa) · 2 armando (AVISO ≥ 1 s antes de morder/atrapar/estallar) ·
// 3 marchita (rebrota tras un tiempo) · 4 ausente (casilla libre de una planta rara).
// REGLAS DE JUSTICIA: toda planta ofensiva avisa ≥ FLORA.telMin; el veneno no baja de FLORA.venenoMin; las ofensivas nacen lejos de
// las apariciones y de los objetivos; ningún efecto actúa en el campo de pruebas; la curación tiene enfriamiento (no se encadena).
// CONTRAJUEGO: se pueden destruir (dan botín), evitar (el aviso se ve) o usar a favor (las ofensivas también hieren a las criaturas).
import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, makeRng } from './math.js';
import { PLAYER, LIMITS } from './data.js';
import { blocked } from './physics.js';
import { ESPECIES, ESP_IDS, ARENA_FLORA, FLORA, ST, HERB_TOPE, herbMods } from './flora-data.js';
import { entregar } from './drops.js';
import { PLANOS_JARDIN } from './items.js';
import { layoutArena } from './arenas-vivas.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
/** Interruptor para pruebas A/B (apagar toda la flora sin tocar nada más). */
export const CTL = { off: false, sinOfensivas: false, sinCuracion: false };
const SLOTS_RARAS = 4;

/* ───────── disposición (pura: la comparten simulación, cliente y pruebas) ───────── */
const CACHE = new WeakMap();
const UPV = v3(0, 1, 0);
const prioridad = { ofensiva: 0, toxica: 1, cura: 2 };

function claves(map) {
  const sp = map.spots || {}, obj = [], spawns = [], org = [];
  for (let i = 0; i < 4; i++) spawns.push(map.playerSpawn(i));
  for (const k of ['anchor', 'core', 'altar']) if (sp[k]) obj.push(sp[k]);
  for (const k of ['plates', 'valves']) if (Array.isArray(sp[k])) obj.push(...sp[k]);
  for (const p of map.portals || []) { obj.push(p.a, p.b); }
  const L = layoutArena(map);
  if (L) for (const o of L.org) org.push({ p: o.pos, r: o.k === 'boca' || o.k === 'pulmon' ? Math.min(7, o.r * 0.55) : o.hr + 2.2, ofe: o.k === 'boca' || o.k === 'pulmon' ? 3 : 2 });
  return { spawns, obj: obj.filter(Boolean), org };
}
function distSeg(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab), t = l2 > 1e-9 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return dist(p, madd(a, ab, t));
}
/** ¿Se puede poner una planta acá? Suelo firme, aire libre alrededor, gravedad normal y a distancia de apariciones, objetivos, órganos y otras plantas. */
export function sitioLibre(map, pos, u, K, ofe, otros = []) {
  if (blocked(map, madd(pos, u, 0.5)) || blocked(map, madd(pos, u, 1.6)) || !blocked(map, madd(pos, u, -0.35))) return false;
  const t1 = norm(cross(u, Math.abs(u.y) < 0.9 ? UPV : v3(1, 0, 0))), t2 = cross(u, t1);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, q = madd(madd(pos, t1, Math.cos(a) * 1.4), t2, Math.sin(a) * 1.4);
    if (blocked(map, madd(q, u, 0.5)) || !blocked(map, madd(q, u, -0.35))) return false;
  }
  if (map.walkable && !map.walkable(pos.x, pos.z, 1.2)) return false;
  const gv = map.gravityAt(madd(pos, u, 1), 0), gl = len(gv); if (gl < 5 || dot(mul(gv, 1 / gl), u) > -0.9) return false;
  if (K) {
    for (const s of K.spawns) if (dist(pos, s) < (ofe ? FLORA.distSpawn : 6)) return false;
    for (const q of K.obj) if (dist(pos, q) < (ofe ? FLORA.distClave : 5)) return false;
    for (const o of K.org) if (dist(pos, o.p) < o.r + (ofe ? o.ofe : 0)) return false;
    if (ofe && K.spawns[0]) for (const q of K.obj) if (distSeg(pos, K.spawns[0], q) < 2.6) return false;   // no sobre las sendas rectas de la aparición a los objetivos
  }
  for (const q of otros) if (dist(pos, q.pos) < FLORA.sepMin) return false;
  return true;
}
function candidato(map, rng) {
  const id = map.id;
  if (id === 'm1') {
    const is = map.islands.filter((i) => !i.hang), tot = is.reduce((a, i) => a + i.r * i.r, 0);
    let x = rng.next() * tot, k = 0; for (; k < is.length - 1; k++) { x -= is[k].r * is[k].r; if (x <= 0) break; }
    const I = is[k], a = rng.next() * 6.2832, rr = Math.sqrt(rng.next()) * (I.r - 3);
    return { pos: v3(I.x + Math.cos(a) * rr, I.top, I.z + Math.sin(a) * rr), u: UPV };
  }
  if (id === 'm2') { const n = rng.unit(); return { pos: mul(n, map.R - 0.05), u: mul(n, -1) }; }
  if (id === 'm3') {
    const N = map.maze.vw.length - 1, i = Math.floor(rng.next() * N), j = Math.floor(rng.next() * N), c = v3(map.maze.X(i) + 8, 0, map.maze.Z(j) + 8);
    return { pos: v3(c.x + (rng.next() * 2 - 1) * 5.5, 0, c.z + (rng.next() * 2 - 1) * 5.5), u: UPV };
  }
  if (id === 'm4') {
    const ds = map.layout.discs.filter((d) => d.kind === 'plat'), tot = ds.reduce((a, d) => a + d.r * d.r, 0);
    let x = rng.next() * tot, k = 0; for (; k < ds.length - 1; k++) { x -= ds[k].r * ds[k].r; if (x <= 0) break; }
    const D = ds[k], a = rng.next() * 6.2832, rr = Math.sqrt(rng.next()) * Math.max(1, D.r - 2.2);
    return { pos: v3(D.x + Math.cos(a) * rr, D.top, D.z + Math.sin(a) * rr), u: UPV };
  }
  const rooms = map.rooms || [], area = rooms.map((r) => (r.x1 - r.x0) * (r.z1 - r.z0)), tot = area.reduce((a, b) => a + b, 0);
  let x = rng.next() * tot, k = 0; for (; k < rooms.length - 1; k++) { x -= area[k]; if (x <= 0) break; }
  const R = rooms[k]; return { pos: v3(R.x0 + 2.5 + rng.next() * (R.x1 - R.x0 - 5), 0, R.z0 + 2.5 + rng.next() * (R.z1 - R.z0 - 5)), u: UPV };
}
/** Disposición de la flora de una arena (misma semilla → mismas plantas). Devuelve { id, plants:[{ sp, pos, u }] } o null. */
export function layoutFlora(map, seed = 1) {
  const A = ARENA_FLORA[map.id]; if (!A) return null;
  let byMap = CACHE.get(map); if (!byMap) CACHE.set(map, byMap = new Map());
  const key = seed | 0; if (byMap.has(key)) return byMap.get(key);
  const rng = makeRng((((seed | 0) ^ 0xf10a5a) * 2654435761) >>> 0), K = claves(map), plants = [];
  const orden = Object.keys(A).sort((a, b) => prioridad[ESPECIES[a].fn] - prioridad[ESPECIES[b].fn]);
  const hechas = {};
  for (const sid of orden) {
    const S = ESPECIES[sid], ofe = S.fn === 'ofensiva' || S.tipo === 'hongo' || S.tipo === 'narcotica' || S.tipo === 'brasas';
    let n = 0;
    for (let tries = 0; n < A[sid] && tries < 600; tries++) {
      const c = candidato(map, rng);
      if (!sitioLibre(map, c.pos, c.u, K, ofe, plants)) continue;
      plants.push({ sp: sid, pos: c.pos, u: c.u, ini: rng.next() }); n++;
    }
    hechas[sid] = n;
  }
  // orden estable por familia de la configuración (la casilla i es siempre la misma planta)
  const cfg = Object.keys(A); plants.sort((a, b) => cfg.indexOf(a.sp) - cfg.indexOf(b.sp));
  const L = { id: map.id, seed: key, plants, hechas };
  byMap.set(key, L); return L;
}

/* ───────── estado ───────── */
const centro = (pl) => madd(pl.pos, pl.u, 0.7);
function planta(i, sid, pos, u, ini) {
  const S = ESPECIES[sid];
  return { i, sp: S, id: sid, pos, u, hp: S.hp, max: S.hp, st: ini == null ? ST.AUSENTE : (ini < 0.72 ? ST.MADURA : ST.BROTE), t: ini != null && ini >= 0.72 ? S.brote * (ini - 0.72) / 0.28 : 0, cd: 0, frz: 0, burn: 0, wilt: 0, reb: S.rebrota, usos: S.p.usos || S.p.reflejos || 0, res: S.p.reserva || 0, ex: {}, by: 0, hitT: -99, gm: 1, tras: false, rare: false, life: Infinity, destr: false, tel: S.p.tel || 0, fa: 0, pT: -9 };
}
export function initFlora(g) {
  g.flRng = makeRng((((g.seed | 0) ^ 0xf10a5a) * 2654435761) >>> 0);
  g.fl = null;
  if (CTL.off) return;
  const L = layoutFlora(g.map, g.seed); if (!L) return;
  const P = L.plants.map((q, i) => planta(i, q.sp, q.pos, q.u, q.ini));
  for (let k = 0; k < SLOTS_RARAS; k++) P.push(planta(P.length, 'flor_aurora', v3(), UPV, null));
  g.fl = { L, p: P, nubes: [], nextNube: 1, acc: 0, ver: 1, dirty: true, lTick: -999, evKey: '', mis: 0, jefe: false, eclipse: false, aurora: false,
    stats: { curado: 0, danio: 0, cosechas: 0, destruidas: 0, atrapados: 0, reflejos: 0, hielo: 0, fuego: 0, nubes: 0, raras: 0, estallidos: 0, mordiscos: 0 } };
  if (P.length > (LIMITS.flora || FLORA.maxActivas)) P.length = LIMITS.flora || FLORA.maxActivas;
}
const vivos = (g) => g.players.filter((p) => !p.dead);
function credito(g, pos) { let best = null, bd = Infinity; for (const p of g.players) { if (p.dead) continue; const d = dist(p.pos, pos); if (d < bd) { bd = d; best = p; } } return best; }
const esc = (g) => 1 + FLORA.danoPorOla * Math.max(0, g.wave - 1);
const resis = (p) => 1 - (p.herb ? p.herb.resis : 0);
const cura_ = (p) => 1 + (p.herb ? p.herb.cura : 0);
/** Aplica las mejoras del Herbario (hitos del perfil, saneados) a un jugador. Las llama addPlayer. */
export function applyHerb(p, ids) { p.herbIds = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string').slice(0, 16) : []; p.herb = herbMods(p.herbIds); }

/* geometría local: distancia tangente y altura de un punto respecto de la base de una planta */
function rel(pl, q) {
  const vx = q.x - pl.pos.x, vy = q.y - pl.pos.y, vz = q.z - pl.pos.z, h = vx * pl.u.x + vy * pl.u.y + vz * pl.u.z;
  const t2 = vx * vx + vy * vy + vz * vz - h * h;
  return { d: Math.sqrt(t2 > 0 ? t2 : 0), h };
}
const enP = (pl, p, rad) => { if (p.dead) return false; const q = rel(pl, p.pos); return q.d < rad + 0.5 && q.h > -0.5 && q.h < 3.2; };
const enM = (pl, m, rad) => { if (m.dead || m.def.boss || m.passive) return false; const q = rel(pl, m.pos); return q.d < rad + m.r * 0.5 && q.h > -1 && q.h < m.r + 3.2; };
/** ¿El Huésped apretó USAR hace un momento? */
const usa = (g, p) => g.time < (p.flUse || 0);
const emit = (g, a, pl, extra = {}) => g.emit({ t: 'flora', a, sp: pl.sp.i, id: pl.i, p: a3(pl.pos), ...extra });

/* efectos sobre el Huésped */
function velJ(g, p, k, sec, flag) { if (g.time >= (p.flVelUntil || 0) || k < p.flVel) p.flVel = k; p.flVelUntil = Math.max(p.flVelUntil || 0, g.time + sec); markFx(g, p, flag, sec); }
function markFx(g, p, flag, sec) { if (g.time >= (p.flFxUntil || 0)) p.flFx = 0; p.flFx |= flag; p.flFxUntil = Math.max(p.flFxUntil || 0, g.time + sec); }
/** Multiplicador de velocidad del Huésped por la flora (savia, zarzas, lianas, sueño). 1 = nada. */
export const flVel = (g, p) => (g.time < (p.flVelUntil || 0) ? p.flVel : 1);
/** Multiplicador del daño que RECIBE el Huésped (Brote del Coro). */
export const flRecibe = (g, p) => (g.time < (p.flWardUntil || 0) ? p.flWard : 1);

/* ───────── cambios de estado ───────── */
function marchitar(g, pl, causa) {
  if (pl.st === ST.AUSENTE) return;
  if (pl.rare) { pl.st = ST.AUSENTE; g.fl.dirty = true; g.fl.ver++; emit(g, 'marchita', pl, { c: causa }); return; }
  pl.st = ST.MARCHITA; pl.t = 0; pl.burn = 0; pl.frz = 0; pl.tras = false; pl.wilt = 0; pl.ex = {};
  pl.reb = pl.sp.rebrota * (pl.destr ? FLORA.rebrotaRota : 1) * (0.92 + 0.16 * g.flRng.next()); pl.destr = false;
  emit(g, 'marchita', pl, { c: causa });
}
function armar(g, pl, p = null) {
  if (pl.st !== ST.MADURA || pl.frz > g.time || CTL.sinOfensivas) return;
  pl.st = ST.ARMANDO; pl.t = 0; pl.tel = Math.max(FLORA.telMin, pl.sp.p.tel || 1.1);
  if (p) pl.by = p.id;
  emit(g, 'arma', pl, { tel: r2(pl.tel) });
}
/** Reparte materiales (y a veces una semilla o un plano) al Huésped: cosecha con USAR (cal base) o botín al destruir (menos y de peor calidad). */
function botin(g, pl, p, modo) {
  const S = pl.sp, C = S.cos, rng = g.flRng, f = modo === 'rota' ? FLORA.rotaCosecha : 1;
  let n = C.n[0] + Math.floor(rng.next() * (C.n[1] - C.n[0] + 1)) + (modo === 'cosecha' && p.herb ? p.herb.cos : 0);
  n = Math.max(1, Math.round(n * f));
  const sube = rng.next() < 0.22 + 0.03 * Math.max(0, g.wave - 1) + (p.herb ? p.herb.calidad : 0), baja = rng.next() < 0.2;
  let cal = Math.max(0, Math.min(3, C.q + (sube ? 1 : 0) - (baja ? 1 : 0) - (modo === 'rota' ? 1 : 0)));
  if (S.rara) cal = Math.max(2, cal);
  entregar(g, p, { id: 'mat:' + C.mat, q: cal, n, r: cal, k: 'mat', src: 'flora' }, pl.pos);
  if (S.rara || (modo === 'cosecha' && rng.next() < 0.06)) entregar(g, p, { id: 'semilla:' + S.id, q: 0, n: 1, r: 1, k: 'semilla', src: 'flora' }, pl.pos);
  if (S.rara && PLANOS_JARDIN.length) entregar(g, p, { id: 'plano:' + PLANOS_JARDIN[Math.floor(rng.next() * PLANOS_JARDIN.length)], q: 0.5, n: 1, r: 1, k: 'plano', src: 'flora' }, pl.pos);
  g.fl.stats.cosechas += modo === 'cosecha' ? 1 : 0;
  emit(g, modo === 'cosecha' ? 'cosecha' : 'rota', pl, { pid: p.id, m: C.mat, n, q: cal });
}
function destruir(g, pl, by, conBotin = true) {
  if (pl.st === ST.AUSENTE) return;
  g.fl.stats.destruidas++;
  const p = by || credito(g, pl.pos);
  if (conBotin && p && p.input && pl.st !== ST.MARCHITA && pl.st !== ST.BROTE) botin(g, pl, p, 'rota');
  pl.destr = true; pl.hp = pl.max; marchitar(g, pl, 'rota');
}
/** Daño a una planta. `elem`: 'fuego' | 'hielo' | 'veneno' | 'explosion' | null. */
export function danarPlanta(g, pl, dmg, by, elem = null) {
  if (!pl || pl.st === ST.MARCHITA || pl.st === ST.AUSENTE || dmg <= 0) return 0;
  if (pl.sp.fn === 'cura' && by && by.input) return 0;   // las plantas que curan no reciben los disparos, golpes ni explosiones del Huésped (sólo las rompen los enemigos, el fuego y la niebla ácida)
  if (pl.frz > g.time && elem !== 'hielo') { if (dmg >= 8) { dmg = Math.max(dmg * FLORA.hielo.rompe, pl.max * 0.5); pl.frz = 0; emit(g, 'rompe', pl); } else return 0; }   // congelada es quebradiza: un golpe fuerte le saca la mitad de la vida
  const S = pl.sp;
  pl.hp -= dmg; pl.hitT = g.time; if (by && by.id) pl.by = by.id;
  g.fl.stats.danio += dmg;
  if (elem === 'fuego' && S.infl) encender(g, pl, by);
  else if (elem === 'explosion' && S.tipo === 'brasas') encender(g, pl, by);
  else if (elem === 'hielo') congelar(g, pl);
  else if (elem === 'veneno' && !S.tox) pl.hp -= dmg * 0.5;
  if (pl.hp <= 0) { destruir(g, pl, by && by.input ? by : null); return dmg; }
  if (pl.st === ST.MADURA && ['explosiva', 'hongo', 'muerde', 'liana'].includes(S.tipo)) armar(g, pl, by && by.input ? by : null);
  return dmg;
}
function encender(g, pl, by) {
  if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA || pl.burn > g.time) return;
  pl.burn = g.time + FLORA.fuego.dur; pl.frz = 0; if (by && by.id) pl.by = by.id; g.fl.stats.fuego++;
  emit(g, 'arde', pl);
}
function congelar(g, pl) {
  if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA) return;
  pl.frz = g.time + FLORA.hielo.dur; pl.burn = 0; g.fl.stats.hielo++;
  emit(g, 'hiela', pl);
}

/* ───────── nubes de esporas ───────── */
function nube(g, tipo, pos, u, r, vida, S, by) {
  const F = g.fl; if (F.nubes.length >= FLORA.nubesMax) F.nubes.shift();
  F.nubes.push({ id: F.nextNube++, tipo, pos: madd(pos, u, 0.6), u, r, t0: g.time, vida, by: by || 0, S });
  F.stats.nubes++; g.emit({ t: 'flora', a: 'nube', sp: S.i, tipo: tipo === 'veneno' ? 0 : 1, p: a3(pos), r });
}

/* ───────── resolución de un ataque con aviso ───────── */
function resolver(g, pl) {
  const S = pl.sp, P = S.p, e = esc(g), by = g.players.find((q) => q.id === pl.by) || null;
  const cred = by || credito(g, pl.pos);
  const golpea = (rad, dp, dm, falloff = 0) => {
    for (const p of g.players) if (enP(pl, p, rad)) { const d = rel(pl, p.pos).d; g.hurtPlayer(p, dp * e * resis(p) * (1 - falloff * Math.min(1, d / rad))); g.fl.stats.mordiscos++; }
    for (const m of g.monsters) if (enM(pl, m, rad)) g.damageMonster(m, dm * e, cred, m.pos);
  };
  if (S.tipo === 'muerde') {
    golpea(S.r, P.dmg, P.mdmg);
    emit(g, 'muerde', pl); pl.cd = g.time + P.cd; pl.st = ST.MADURA; pl.t = 0;
    if (pl.tras) marchitar(g, pl, 'cosechada');
  } else if (S.tipo === 'liana') {
    for (const p of g.players) if (enP(pl, p, S.r)) { g.hurtPlayer(p, P.dmg * e * resis(p)); velJ(g, p, 0.12, P.raiz, 2); g.fl.stats.atrapados++; }
    for (const m of g.monsters) if (enM(pl, m, S.r)) { m.slowUntil = Math.max(m.slowUntil || 0, g.time + P.mraiz); m.vel = mul(m.vel, 0.1); g.damageMonster(m, P.mdmg * e, cred, m.pos); g.fl.stats.atrapados++; }
    emit(g, 'ata', pl); pl.usos--; pl.cd = g.time + P.cd; pl.st = ST.MADURA; pl.t = 0;
    if (pl.usos <= 0 || pl.tras) marchitar(g, pl, 'gastada');
  } else if (S.tipo === 'explosiva') {
    const R = S.r;
    golpea(R, P.dmg, P.mdmg, 0.5);
    for (const o of g.fl.p) if (o !== pl && o.st !== ST.AUSENTE && o.st !== ST.MARCHITA && dist(o.pos, pl.pos) < R + 1) {
      if (P.fuego && o.sp.infl) encender(g, o, cred); danarPlanta(g, o, P.plantas, o.sp.fn === 'cura' ? null : cred, 'explosion');   // (lo curativo sólo lo rompe el entorno, no el Huésped)
    }
    if (P.fuego) for (const m of g.monsters) if (enM(pl, m, R)) { m.dotUntil = g.time + 4; m.dotDps = 12; m.dotKind = 'burn'; m.dotBy = cred ? cred.id : 0; }
    g.emit({ t: 'boom', p: a3(centro(pl)), r: R });
    g.fl.stats.estallidos++; emit(g, 'estalla', pl);
    pl.hp = pl.max; marchitar(g, pl, 'estalló');
  } else if (S.tipo === 'hongo') {
    nube(g, P.nube, pl.pos, pl.u, P.nr, P.vida, S, pl.by); emit(g, 'suelta', pl);
    pl.hp = pl.max; marchitar(g, pl, 'soltó');
  } else if (S.tipo === 'narcotica') {
    nube(g, P.nube, pl.pos, pl.u, P.nr, P.vida, S, pl.by); emit(g, 'suelta', pl);
    pl.st = ST.MADURA; pl.t = 0; pl.cd = g.time + P.cada;
    if (pl.tras) marchitar(g, pl, 'cosechada');
  } else if (S.tipo === 'brasas') {
    encender(g, pl, cred); pl.st = ST.MADURA; pl.t = 0;
  }
}

/* ───────── comer / cosechar ───────── */
function comer(g, pl, p) {
  const S = pl.sp, P = S.p, bonus = cura_(p), aur = g.evZona && g.ev && g.ev.id === 'aurora_bendita' && dist(pl.pos, g.evZona.pos) < g.evZona.r + 4 ? 1.4 : 1;
  const h0 = p.hp, s0 = p.shield;
  if (S.tipo === 'cura') { p.hp = Math.min(PLAYER.hp, p.hp + (P.hp || 0) * bonus * aur); p.shield = Math.min(PLAYER.shield, p.shield + (P.sh || 0) * bonus * aur); }
  else if (S.tipo === 'escudo') { p.shield = Math.min(PLAYER.shield, p.shield + P.sh * bonus); p.hp = Math.min(PLAYER.hp, p.hp + (P.hp || 0) * bonus); p.flWard = P.ward; p.flWardUntil = g.time + P.wardT; markFx(g, p, 4, P.wardT); }
  else if (S.tipo === 'energia') {
    p.ul = Math.min(100, (p.ul || 0) + P.ul * bonus); p.hp = Math.min(PLAYER.hp, p.hp + (P.hp || 0) * bonus);
    for (const k of ['abilityCd', 'movCd', 'espCd', 's3Cd']) if (p[k] > 0) p[k] *= 1 - P.cd;
  }
  p.flIcd = g.time + FLORA.curaIcd; g.fl.stats.curado += (p.hp - h0) + (p.shield - s0);
  emit(g, S.tipo === 'escudo' ? 'escudo' : S.tipo === 'energia' ? 'energia' : 'cura', pl, { pid: p.id, hp: r2(p.hp - h0), sh: r2(p.shield - s0) });
  marchitar(g, pl, 'comida');
}
function necesita(p, S) {
  if (S.tipo === 'energia') return (p.ul || 0) < 92 || ['abilityCd', 'movCd', 'espCd', 's3Cd'].some((k) => p[k] > 1);
  if (S.tipo === 'escudo') return p.shield < PLAYER.shield * 0.7 || p.hp < PLAYER.hp * 0.7;
  return (p.hp + p.shield) / (PLAYER.hp + PLAYER.shield) < FLORA.curaSiBajo;
}
function cosechar(g, pl, p) {
  botin(g, pl, p, 'cosecha');
  p.flHarvCd = g.time + FLORA.cosechaCd; p.flUse = 0;
  const T = pl.sp.tipo;
  if (pl.sp.rara && pl.sp.fn === 'cura') { comer(g, pl, p); if (pl.st !== ST.AUSENTE) marchitar(g, pl, 'cosechada'); return; }
  if (['muerde', 'liana', 'explosiva', 'hongo', 'narcotica'].includes(T)) { pl.tras = true; armar(g, pl, p); if (pl.st === ST.MADURA) marchitar(g, pl, 'cosechada'); return; }   // cosechar lo peligroso la despierta: aviso y a correr
  marchitar(g, pl, 'cosechada');
}

/* ───────── plantas raras ───────── */
function ponerRara(g, sid, ref, cerca = null) {
  const F = g.fl, slot = F.p.find((q) => q.st === ST.AUSENTE && q.rare !== 'x'), S = ESPECIES[sid];
  if (!slot || !S || F.p.filter((q) => q.rare && q.st !== ST.AUSENTE).length >= FLORA.maxRaras) return null;
  const K = null;
  for (let k = 0; k < 14; k++) {
    let pos = null;
    if (cerca) { const a = g.flRng.next() * 6.2832, rr = 1.5 + g.flRng.next() * (cerca.r || 4); pos = madd(madd(cerca.pos, v3(1, 0, 0), Math.cos(a) * rr), v3(0, 0, 1), Math.sin(a) * rr); pos.y = cerca.pos.y; }
    else { try { pos = g.map.spawnGround(g.flRng, ref.pos); } catch { pos = null; } if (pos) pos = { x: pos.x, y: pos.y, z: pos.z }; }
    if (!pos) continue;
    const gv = g.map.gravityAt(pos, g.time), l = len(gv), u = l > 1e-3 ? mul(gv, -1 / l) : UPV;
    // el suelo firme se busca bajando por la normal hasta tocar sólido
    let p0 = madd(pos, u, 2.5), found = null;
    for (let s = 0; s < 40; s++) { if (blocked(g.map, p0)) { found = madd(p0, u, 0.2); break; } p0 = madd(p0, u, -0.25); }
    if (!found) continue;
    if (!sitioLibre(g.map, found, u, K, false, F.p.filter((q) => q.st !== ST.AUSENTE))) continue;
    Object.assign(slot, planta(slot.i, sid, found, u, null), { st: ST.BROTE, rare: true, life: g.time + FLORA.rareVida });
    F.dirty = true; F.ver++; F.stats.raras++;
    emit(g, 'rara', slot); return slot;
  }
  return null;
}
function eventosRaros(g) {
  const F = g.fl, ref = vivos(g)[0]; if (!ref || g.practice) return;
  const e = g.ev;
  if (e && e.ph === 'activo') {
    const key = e.id + ':' + e.since;
    if (key !== F.evKey) {
      F.evKey = key;
      if (e.id === 'aurora_bendita' && e.zona) ponerRara(g, 'flor_aurora', ref, { pos: e.zona.pos, r: Math.max(2, e.zona.r - 2) });
      else if (e.id === 'eclipse') { const vs = vivos(g); for (let k = 0; k < 2; k++) ponerRara(g, 'loto_eclipse', vs[k % vs.length]); }
    }
  }
  if ((g.stats.misDone || 0) > F.mis) { F.mis = g.stats.misDone; ponerRara(g, 'retono_pacto', ref); }
  if (!F.jefe && g.wave >= g.waveTotal && g.phase === 'wave') { F.jefe = true; ponerRara(g, 'corona_jefe', ref); }
}

/* ───────── el paso principal (1 por tick) ───────── */
export function tickFlora(g, dt) {
  const F = g.fl; if (!F || (g.practice && !g.flForce)) return;
  for (const p of g.players) if (p.interactEdge) p.flUse = g.time + 0.3;   // USAR dura un solo tick: se recuerda hasta el próximo escaneo (10 Hz)
  const e = g.ev, ph = e && e.ph === 'activo' ? e.id : '';
  F.eclipse = ph === 'eclipse'; F.aurora = ph === 'aurora_bendita';
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE) continue;
    if (g.time > pl.life) { marchitar(g, pl, 'tiempo'); continue; }
    const gm = pl.gm || 1;
    if (pl.st === ST.BROTE) { pl.t += dt * gm; if (pl.t >= pl.sp.brote) { pl.st = ST.MADURA; pl.t = 0; emit(g, 'brota', pl); } }
    else if (pl.st === ST.MARCHITA) { pl.t += dt * gm; if (pl.t >= pl.reb) { pl.st = ST.BROTE; pl.t = 0; pl.hp = pl.max; pl.usos = pl.sp.p.usos || pl.sp.p.reflejos || 0; pl.res = pl.sp.p.reserva || 0; emit(g, 'rebrota', pl); } }
    else if (pl.st === ST.ARMANDO && pl.frz <= g.time) { pl.t += dt; if (pl.t >= pl.tel) resolver(g, pl); }
  }
  if (g.projectiles.length) proyectiles(g);
  eventosRaros(g);
  F.acc += dt;
  if (F.acc >= FLORA.paso) { const h = F.acc; F.acc = 0; escanear(g, h); }
}

function proyectiles(g) {
  const F = g.fl;
  for (const pr of g.projectiles) {
    if (pr.mine || pr.well) continue;
    for (const pl of F.p) {
      if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA) continue;
      const c = centro(pl), dx = pr.pos.x - c.x, dy = pr.pos.y - c.y, dz = pr.pos.z - c.z, rr = (pl.sp.tipo === 'espejo' ? pl.sp.r : 1.0) + pr.r;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      if (pr.owner === 'm') {
        if (pl.sp.tipo === 'espejo' && !pr.flRef && pl.usos > 0 && pl.frz <= g.time) {   // PLANTA ESPEJO: devuelve el disparo
          pr.flRef = true; pr.owner = 'p'; const tgt = credito(g, pr.pos); pr.pid = tgt ? tgt.id : 0; pr.vel = mul(pr.vel, -1); pr.life = Math.max(pr.life, 1.5);
          pl.usos--; pl.hp -= pl.sp.p.costo; F.stats.reflejos++; pl.pT = g.time; emit(g, 'refleja', pl);
          if (pl.usos <= 0 || pl.hp <= 0) marchitar(g, pl, 'gastada');
        } else if (!pr.flHit || !pr.flHit.includes(pl.i)) { (pr.flHit ||= []).push(pl.i); danarPlanta(g, pl, pr.dmg * 0.8, null); }
      } else if (pr.owner === 'p') {
        if (pr.flHit && pr.flHit.includes(pl.i)) continue;
        (pr.flHit ||= []).push(pl.i);
        const p = g.players.find((q) => q.id === pr.pid) || null;
        danarPlanta(g, pl, pr.dmg * 0.6, p, pr.kind === 'brasa' ? 'fuego' : null);
      }
    }
  }
}

function escanear(g, h) {
  const F = g.fl, vs = vivos(g), mons = g.monsters, e = esc(g);
  // entorno: ritmo de crecimiento y marchitar (nieblas, órganos vivos, eventos)
  for (const pl of F.p) pl.gm = 1;
  const lluvia = g.ev && g.ev.ph === 'activo' && g.ev.id === 'lluvia_astillas';
  const act = (z) => z.ph === 'activo' && z.k >= 0.55;
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE) continue;
    const w0 = pl.wilt;
    if (lluvia) pl.gm *= 2;
    if (F.aurora && g.evZona && dist(pl.pos, g.evZona.pos) < g.evZona.r + 4) pl.gm *= 2;
    if (g.ng) for (const z of g.ng.zonas) {
      if (!act(z) || dist(pl.pos, z.pos) > z.r + 0.5) continue;
      if (z.tipo === 'acida' && !pl.sp.tox && pl.st !== ST.MARCHITA && !pl.rare) { pl.wilt += h; if (pl.wilt >= 2.5) marchitar(g, pl, 'acida'); }
      else if (z.tipo === 'cian') {
        pl.gm *= 3; pl.wilt = 0;
        if (pl.st === ST.MARCHITA) { pl.t += h * 4; if (pl.t >= pl.reb) { pl.st = ST.BROTE; pl.t = pl.sp.brote * 0.7; pl.hp = pl.max; emit(g, 'florece', pl); } }
        else if (pl.st === ST.BROTE && pl.t < pl.sp.brote && pl.t + h * 3 >= pl.sp.brote) emit(g, 'florece', pl);
      }
    }
    if (pl.st === ST.AUSENTE) continue;
    if (g.ar) g.ar.L.org.forEach((o, i) => {
      const S = g.ar.org[i]; if (S.roto) return;
      if (o.k === 'boca' && (S.zone > 0 || g.ar.ph === 'ofrenda') && dist(pl.pos, o.pos) < o.r) pl.gm *= 2;                       // la Boca llena riega
      else if (o.k === 'pulmon' && S.mode === 2 && dist(pl.pos, o.pos) < o.r * 0.8) {
        if (g.ar.ph === 'furioso' && !g.ar.sed) { if (!pl.sp.tox && pl.st !== ST.MARCHITA && !pl.rare) { pl.wilt += h * 0.6; if (pl.wilt >= 2.5) marchitar(g, pl, 'aliento'); } }   // el pulmón tóxico marchita
        else pl.gm *= 2;                                                                                                               // el aliento sano abona
      }
    });
    if (pl.st !== ST.MARCHITA && pl.wilt > 0 && pl.wilt <= w0) pl.wilt = Math.max(0, pl.wilt - h * 0.5);   // fuera de lo que marchita, se recupera
  }
  // fuego: arde, prende a las vecinas y hiere
  for (const pl of F.p) {
    if (pl.burn <= g.time) { if (pl.burn > 0 && pl.st !== ST.AUSENTE && pl.st !== ST.MARCHITA) { pl.burn = 0; pl.hp = pl.max; pl.destr = true; marchitar(g, pl, 'quemada'); } else pl.burn = 0; continue; }
    if (pl.st === ST.AUSENTE) continue;
    const FU = FLORA.fuego, cred = g.players.find((q) => q.id === pl.by) || credito(g, pl.pos);
    pl.hp -= 12 * h; pl.fa += h;
    for (const p of vs) if (enP(pl, p, FU.r) && pl.fa >= 0.5) g.hurtPlayer(p, FU.dps * 0.5 * e * resis(p));
    if (pl.fa >= 0.5) pl.fa = 0;
    for (const m of mons) if (enM(pl, m, FU.r)) { m.dotUntil = Math.max(m.dotUntil || 0, g.time + 1.2); m.dotDps = FU.mdps; m.dotKind = 'burn'; m.dotBy = cred ? cred.id : 0; }
    for (const o of F.p) if (o !== pl && o.sp.infl && o.burn <= g.time && o.st !== ST.AUSENTE && o.st !== ST.MARCHITA && dist(o.pos, pl.pos) < FU.propaga && g.flRng.next() < FU.prob * h * 2.5) encender(g, o, cred);
    if (pl.hp <= 0) { pl.burn = 0; pl.hp = pl.max; pl.destr = true; marchitar(g, pl, 'quemada'); }
  }
  // fauna (src/sim/fauna.js, docs/FLORA.md → «Con la fauna»): sus rastros de fuego / escarcha / veneno / raíces tocan a las plantas y los herbívoros pastan las curativas
  if (g.fa) {
    for (const z of g.fa.zonas || []) {
      if (g.time - z.born > z.life) continue;
      const dueno = g.players.find((q) => q.id === z.pid) || null;
      for (const pl of F.p) {
        if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA || dist(pl.pos, z.pos) > z.r + 0.8) continue;
        if (z.k === 1) { if (pl.sp.infl) encender(g, pl, dueno); else danarPlanta(g, pl, 16 * h, dueno, 'fuego'); }
        else if (z.k === 0) { if (pl.frz <= g.time) congelar(g, pl); }
        else if (z.k === 2) danarPlanta(g, pl, 6 * h, dueno, 'veneno');
        else if (z.k === 3) pl.gm *= 2;
      }
    }
    for (const f of g.fa.list || []) {
      if (f.st !== 'pastando' || (f.sp && f.sp.peligrosa)) { f.flPasta = 0; continue; }
      const al = floraAlimento(g, f.pos, 2.4);
      if (!al) { f.flPasta = 0; continue; }
      f.flPasta = (f.flPasta || 0) + h;
      if (f.flPasta >= 4) { f.flPasta = 0; floraAlimento(g, f.pos, 2.4, true); }
    }
  }
  // cada planta según su comportamiento
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA || pl.st === ST.BROTE || pl.frz > g.time) continue;
    const S = pl.sp, P = S.p, T = S.tipo, rt = (P.rt || 0) * (F.eclipse && S.fn === 'ofensiva' ? 1.25 : 1);
    // criaturas que pisotean lo curativo
    if (pl.st === ST.MADURA && S.fn === 'cura' && !pl.rare) {
      let n = 0; for (const m of mons) if (!m.def.fly && enM(pl, m, S.r * 0.8)) { n++; if (n >= 3) break; }
      if (n) { pl.hp -= 9 * n * h; pl.pT = g.time; if (pl.hp <= 0) { destruir(g, pl, null, false); continue; } }
    }
    if (pl.st === ST.MADURA && pl.cd <= g.time && !CTL.sinOfensivas) {
      // disparadores
      if (T === 'muerde' || T === 'liana' || T === 'hongo' || T === 'narcotica') {
        let hit = vs.find((p) => enP(pl, p, rt)) || null; const m = !hit ? mons.find((q) => enM(pl, q, rt)) : null;
        if (hit || m) armar(g, pl, hit);
      } else if (T === 'explosiva') {
        const hit = vs.find((p) => enP(pl, p, rt)) || null; if (hit || mons.some((q) => enM(pl, q, rt))) armar(g, pl, hit);
      }
    }
    if (pl.st === ST.ARMANDO) {   // cosechar lo peligroso mientras avisa: te llevás el material, pero la mordida / el estallido igual llega
      if (!pl.tras && ['muerde', 'liana', 'explosiva', 'hongo', 'narcotica'].includes(T)) for (const p of vs) if (usa(g, p) && g.time >= (p.flHarvCd || 0) && enP(pl, p, FLORA.cosechaR)) { cosechar(g, pl, p); break; }
      continue;
    }
    // efectos continuos
    if (T === 'cura' || T === 'energia' || T === 'escudo') {
      if (CTL.sinCuracion) continue;
      for (const p of vs) {
        if (!enP(pl, p, S.r) || g.time < (p.flIcd || 0) || g.time < (p.flHarvCd || 0)) continue;
        if (usa(g, p) && dist(p.pos, pl.pos) <= FLORA.cosechaR + 1) { cosechar(g, pl, p); break; }
        if (necesita(p, S)) { comer(g, pl, p); break; }
      }
    } else if (T === 'aura') {
      if (CTL.sinCuracion) continue;
      for (const p of vs) {
        if (!enP(pl, p, S.r)) continue;
        if (usa(g, p) && g.time >= (p.flHarvCd || 0) && dist(p.pos, pl.pos) <= FLORA.cosechaR + 1) { cosechar(g, pl, p); break; }
        const h0 = p.hp + p.shield, b = cura_(p);
        if (p.hp < PLAYER.hp) p.hp = Math.min(PLAYER.hp, p.hp + P.hps * b * h); else p.shield = Math.min(PLAYER.shield, p.shield + P.shs * b * h);
        const got = p.hp + p.shield - h0; pl.res -= got; F.stats.curado += got; markFx(g, p, 32, 0.4);
        if (pl.res <= 0) { marchitar(g, pl, 'agotada'); break; }
      }
    } else if (T === 'zarza') {
      const seen = new Set();
      for (const p of vs) if (enP(pl, p, S.r)) {
        const k = 'p' + p.id; seen.add(k); velJ(g, p, P.vel, 0.4, 1);
        const x = (pl.ex[k] = (pl.ex[k] || 0) + h); if (x >= P.gracia && (pl.ex[k + 't'] = (pl.ex[k + 't'] || 0) + h) >= P.tick) { pl.ex[k + 't'] = 0; g.hurtPlayer(p, P.dmg * e * resis(p)); if (g.time - pl.pT > 0.5) { pl.pT = g.time; emit(g, 'pincha', pl, { pid: p.id }); } }
        if (usa(g, p) && g.time >= (p.flHarvCd || 0) && dist(p.pos, pl.pos) <= FLORA.cosechaR + 1) { cosechar(g, pl, p); break; }
      }
      for (const m of mons) if (enM(pl, m, S.r)) { const k = 'm' + m.id; seen.add(k); m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.5); const x = (pl.ex[k] = (pl.ex[k] || 0) + h); if (x >= P.gracia) { m.hp -= P.mdps * e * h; m.hurt = Math.max(m.hurt || 0, 0.05); if (m.hp <= 0) g.killMonster(m, credito(g, m.pos)); } }
      for (const k of Object.keys(pl.ex)) if (!seen.has(k.replace(/t$/, ''))) delete pl.ex[k];
    } else if (T === 'savia') {
      for (const p of vs) if (enP(pl, p, S.r)) { velJ(g, p, P.vel, 0.4, 1); if (usa(g, p) && g.time >= (p.flHarvCd || 0) && dist(p.pos, pl.pos) <= FLORA.cosechaR + 1) { cosechar(g, pl, p); break; } }
      for (const m of mons) if (enM(pl, m, S.r)) { m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.5); m.vel = mul(m.vel, 0.9); }
    } else if (T === 'espejo' || T === 'brasas') {
      for (const p of vs) if (usa(g, p) && g.time >= (p.flHarvCd || 0) && enP(pl, p, FLORA.cosechaR)) { cosechar(g, pl, p); break; }
    }
    if (pl.st === ST.MADURA && ['liana', 'muerde', 'explosiva', 'hongo', 'narcotica'].includes(T)) {   // cosechar lo peligroso: USAR a su alcance
      for (const p of vs) if (usa(g, p) && g.time >= (p.flHarvCd || 0) && enP(pl, p, FLORA.cosechaR)) { cosechar(g, pl, p); break; }
    }
  }
  // nubes de esporas
  const keep = [];
  for (const nb of F.nubes) {
    if (g.time - nb.t0 > nb.vida) continue;
    keep.push(nb); const P = nb.S.p, cred = g.players.find((q) => q.id === nb.by) || null;
    for (const p of vs) {
      const q = dist(p.pos, nb.pos); if (q > nb.r) continue;
      if (nb.tipo === 'veneno') {
        velJ(g, p, P.vel, 0.4, 8); p.flAcc = (p.flAcc || 0) + h;
        if (p.flAcc >= 0.5) { p.flAcc -= 0.5; const d = Math.min(P.dps * 0.5 * e * resis(p), Math.max(0, p.hp + p.shield - FLORA.venenoMin)); if (d > 0) g.hurtPlayer(p, d); }
      } else velJ(g, p, P.vel, 0.4, 16);
    }
    for (const m of mons) {
      if (m.dead || m.def.boss || m.passive || dist(m.pos, nb.pos) > nb.r + m.r * 0.5) continue;
      if (nb.tipo === 'veneno') { m.dotUntil = Math.max(m.dotUntil || 0, g.time + 1.2); m.dotDps = P.mdps * e; m.dotKind = 'poison'; m.dotBy = cred ? cred.id : 0; }
      else { m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.6); m.vel = mul(m.vel, 0.72); }
    }
  }
  F.nubes = keep;
}

/* ───────── ganchos de armas, explosiones y golpes (los llama game.js / huespedes.js) ───────── */
/** Elemento que un arma le pasa a lo que golpea. */
export const elementoDeArma = (w) => (!w ? null : w.burn || w.id === 'solar' || w.id === 'brasa' ? 'fuego' : w.slow ? 'hielo' : w.poison ? 'veneno' : null);
/** Disparo de rayo (hitscan): cada planta viva es una esfera de ~1 m. No frena el disparo. */
export function floraRayo(g, o, d, tEnd, w, p) {
  const F = g.fl; if (!F || (g.practice && !g.flForce)) return;
  const el = elementoDeArma(w);
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA) continue;
    const oc = sub(centro(pl), o), tca = dot(oc, d); if (tca < 0 || tca > tEnd + 0.01) continue;
    const d2 = dot(oc, oc) - tca * tca, rr = pl.sp.tipo === 'arbol' ? 2.2 : pl.sp.tipo === 'espejo' ? 1.1 : 1.0; if (d2 > rr * rr) continue;
    danarPlanta(g, pl, w.dmg * (w.pellets > 1 ? 0.9 : 1), p, el);
  }
}
/** Explosiones: dañan a las plantas dentro del radio; las inflamables arden con una explosión grande. */
export function floraExplosion(g, pos, radius, md, by) {
  const F = g.fl; if (!F || md <= 0 || (g.practice && !g.flForce)) return;
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA) continue;
    const c = centro(pl), d = dist(c, pos); if (d > radius + 0.8) continue;
    danarPlanta(g, pl, md * 0.8 * (1 - 0.5 * Math.min(1, d / (radius + 0.8))), by && by.input ? by : null, md >= 40 ? 'explosion' : null);
  }
}
/** Golpe cuerpo a cuerpo en cono. Devuelve cuántas plantas golpeó. */
export function floraMelee(g, from, range, dir, cosT, dmg, by) {
  const F = g.fl; if (!F || (g.practice && !g.flForce)) return 0;
  let hits = 0;
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA) continue;
    const c = centro(pl), to = sub(c, from), l = len(to);
    if (l < range + 0.9 && dot(norm(to), dir) > cosT) { danarPlanta(g, pl, dmg * 0.7, by, null); hits++; }
  }
  return hits;
}
/** API para otros sistemas (fauna, habilidades): aplica un elemento a las plantas dentro de `r`. elem: 'fuego' | 'hielo' | 'veneno' | 'explosion'. Devuelve cuántas tocó. */
export function floraElemento(g, pos, r, elem, by = null, dmg = 8) {
  const F = g.fl; if (!F) return 0; let n = 0;
  for (const pl of F.p) {
    if (pl.st === ST.AUSENTE || pl.st === ST.MARCHITA || dist(pl.pos, pos) > r + 0.8) continue;
    if (elem === 'fuego') { if (pl.sp.infl) encender(g, pl, by); else danarPlanta(g, pl, dmg, by, 'fuego'); }
    else if (elem === 'hielo') congelar(g, pl);
    else danarPlanta(g, pl, dmg, by, elem);
    n++;
  }
  return n;
}
/** API para la fauna: la planta madura comestible más cercana (cura / energía / escudo / aura). Con `consumir` se la come (queda marchita). */
export function floraAlimento(g, pos, r, consumir = false) {
  const F = g.fl; if (!F) return null; let best = null, bd = r;
  for (const pl of F.p) { if (pl.st !== ST.MADURA || !['cura', 'energia', 'escudo', 'aura'].includes(pl.sp.tipo)) continue; const d = dist(pl.pos, pos); if (d < bd) { bd = d; best = pl; } }
  if (!best) return null;
  const out = { id: best.i, sp: best.sp.id, mat: best.sp.cos.mat, p: a3(best.pos), d: r2(bd) };
  if (consumir) { emit(g, 'comida', best, { fauna: 1 }); marchitar(g, best, 'comida'); }
  return out;
}

/* ───────── snapshot ───────── */
/** fl = { v, s:[[estado, vida %, banderas, progreso %]], nb:[[tipo 0 veneno/1 sueño, x,y,z, r, vida restante %]], b:[[jugador, banderas]], l? (cada ~1,5 s o al cambiar): [[especie, x,y,z, ux,uy,uz]] }
 *  banderas de planta: 1 congelada · 2 ardiendo · 4 eclipse · 8 (libre) · 16 cosechable · 32 rara.   banderas del Huésped: 1 frenado · 2 atrapado · 4 escudo · 8 veneno · 16 sueño · 32 curándose. */
export function flSnap(g) {
  const F = g.fl; if (!F || (g.practice && !g.flForce)) return null;
  const out = {
    v: F.ver,
    s: F.p.map((pl) => {
      const S = pl.sp; let prog = 100;
      if (pl.st === ST.BROTE) prog = Math.round(100 * Math.min(1, pl.t / S.brote)); else if (pl.st === ST.ARMANDO) prog = Math.round(100 * Math.min(1, pl.t / Math.max(0.01, pl.tel)));
      else if (pl.st === ST.MARCHITA) prog = Math.round(100 * Math.min(1, pl.t / Math.max(1, pl.reb))); else if (S.tipo === 'aura') prog = Math.round(100 * Math.max(0, pl.res) / S.p.reserva); else if (S.p.usos || S.p.reflejos) prog = Math.round(100 * pl.usos / (S.p.usos || S.p.reflejos));
      const fl = (pl.frz > g.time ? 1 : 0) | (pl.burn > g.time ? 2 : 0) | (F.eclipse ? 4 : 0) | (pl.st === ST.MADURA ? 16 : 0) | (pl.rare ? 32 : 0);
      return [pl.st, Math.max(0, Math.round(100 * pl.hp / pl.max)), fl, prog];
    }),
    nb: F.nubes.map((n) => [n.tipo === 'veneno' ? 0 : 1, ...a3(n.pos), n.r, Math.max(0, Math.round(100 * (1 - (g.time - n.t0) / n.vida)))]),
    b: g.players.filter((p) => g.time < (p.flFxUntil || 0)).map((p) => [p.id, p.flFx || 0]),
  };
  if (g.tick - F.lTick >= 90 || F.dirty) { out.l = F.p.map((pl) => (pl.st === ST.AUSENTE && !pl.rare ? [-1, 0, 0, 0, 0, 1, 0] : [pl.sp.i, ...a3(pl.pos), r2(pl.u.x), r2(pl.u.y), r2(pl.u.z)])); F.lTick = g.tick; F.dirty = false; }
  return out;
}
void ESP_IDS; void HERB_TOPE; void add;
/** Para el cliente (decorado y pruebas): sitios candidatos y puntos que hay que respetar en un mapa. */
export { candidato as candidatoFlora, claves as clavesDe };
