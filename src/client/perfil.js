import { cleanCosmetics } from '../shared/cosmetics.js';
// Perfil del jugador (se guarda en el navegador): núcleos ahorrados, evolución de cada Huésped y arma cuerpo a cuerpo equipada.
import { EVO_COST, evoPathsFor, MELEE_WEAPONS, CHARACTERS, WEAPON_ORGANS, CHAMP_ORGANS } from '../sim/data.js';
import { TERRITORIOS, BENDICIONES, cleanBend, hermana } from '../sim/bendiciones.js';
import { ESPECIES as FLORA_ESP, HITOS, hitosCumplidos } from '../sim/flora-data.js';   // Herbario y materiales vegetales (docs/FLORA.md)
import { organError } from '../sim/organos.js';
import { xpPartida, progreso, rangoDeXp, RANGO_MAX } from '../sim/maestria.js';
import { MODOS_ARBOL, cleanNodos, nodosDe, gastado, errorNodo, costeReinicio, puntosCombo, puntosDisparo } from '../sim/progresion.js';
import { migrarHuespedes, poseeHuesped } from '../sim/tienda.js';
import { limpiarFauna, registrarComida, faunaParaPartida, ESPECIES, HITOS as HITOS_FAUNA } from '../sim/fauna-data.js';   // Códice de Fauna (docs/FAUNA.md)
import { ESTACION_IDS, PLANTAS, macetaEstado } from '../sim/base.js';   // La Base (docs/BASE.md): estaciones y jardín
import { ITEMS, SLOTS, SIGNATURES, LIMITE_INVENTARIO, MATERIAL_IDS, TODOS_MAT_IDS, CONSUMIBLES, MAT_STOCK_MAX, PLANOS, PLANOS_INICIALES, RECETAS, qForja, cleanEquip, equipError, desguaceValor, faseDe, poder } from '../sim/items.js';
const KEY = 'cristal.perfil.v1';
let cache = null;
/** terr = { m1: { bend: null|'id' } }: la clave existe = territorio liberado; bend = bendición elegida (null = liberado pero sin elegir). Se sanea al cargar. */
function limpiarTerr(t) {
  const out = {}; if (!t || typeof t !== 'object') return out;
  for (const id of Object.keys(TERRITORIOS)) { const e = t[id]; if (!e || typeof e !== 'object') continue; out[id] = { bend: BENDICIONES[e.bend] && BENDICIONES[e.bend].terr === id ? e.bend : null }; }
  return out;
}
/** guia = { off: saltada del todo, vistos: [ids de pasos ya mostrados] }. Se sanea al cargar. */
function limpiarGuia(g) { const o = g && typeof g === 'object' ? g : {}; return { off: o.off === true, vistos: Array.isArray(o.vistos) ? o.vistos.filter((x) => typeof x === 'string').slice(0, 12) : [] }; }
/** base = { vis: { estacion: última vez (ms) }, tut: tutorial de la Base visto, jardin: [6 macetas: null | { p: planta, t0: hora de siembra (ms) }] } (docs/BASE.md). Se sanea al cargar. */
function limpiarBase(b) {
  const o = b && typeof b === 'object' ? b : {}, vis = {}, jardin = [null, null, null, null, null, null];
  if (o.vis && typeof o.vis === 'object') for (const id of ESTACION_IDS) if (o.vis[id]) vis[id] = nn(o.vis[id], 4e12);
  if (Array.isArray(o.jardin)) o.jardin.slice(0, 6).forEach((m, i) => { if (m && typeof m === 'object' && PLANTAS[m.p]) jardin[i] = { p: m.p, t0: nn(m.t0, 4e12) }; });
  return { vis, tut: o.tut === true, jardin };
}
const fresh = () => ({ ver: 2, cosmetics: cleanCosmetics(null), cores: 0, evo: {}, path: {}, melee: {}, owned: [], ess: { carne: 0, cristal: 0, ojo: 0, vacio: 0 }, worg: {}, corg: {}, terr: {}, guia: { off: false, vistos: [] }, mae: {}, arb: {}, inventario: [], materiales: matsVacios(), planos: [], cultivo: null, nf: 1, eq: {}, pity: { l: 0, e: 0 }, sigs: {}, nu: 1, huespedes: [], tienda: { clave: '', comp: [], rot: 0 }, consum: { botiquin: 0 }, herbario: { vistas: {}, cosechas: {}, hitos: [] }, flora: { semillas: {}, cebos: 0 }, menu: { iv: 0, tv: '' }, base: { vis: {}, tut: false, jardin: [null, null, null, null, null, null] } });
/* ───── inventario (docs/INVENTARIO.md): v2 del perfil. Los perfiles anteriores (sin `ver`) se abren igual: sólo les falta el inventario, que arranca vacío. ───── */
const nn = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
/** inv = [{ u (id propio), id (plantilla), q (tirada 0..1), k (bajas), lk (bloqueado), fv (favorito), t }]. Se sanea al cargar: ids desconocidos, uid repetidos y exceso se descartan. */
function limpiarInv(a) {
  const out = [], seen = new Set(); if (!Array.isArray(a)) return out;
  for (const e of a.slice(0, 300)) {
    if (!e || typeof e !== 'object' || !ITEMS[e.id]) continue; let u = typeof e.u === 'string' && /^[a-z0-9]{1,12}$/.test(e.u) ? e.u : ''; if (!u || seen.has(u)) continue; seen.add(u);
    out.push({ u, id: e.id, q: Math.round(Math.max(0, Math.min(1, Number(e.q))) * 100) / 100 || 0, k: nn(e.k, 99999), lk: e.lk === true, fv: e.fv === true, t: nn(e.t, 4e12) });
  }
  return out;
}
/** eq = { huésped: { ranura: uid } }: sólo uids que existen, de la ranura correcta, permitidos para ese Huésped y sin repetir la misma pieza en dos Huéspedes. */
function limpiarEq(e, inv) {
  const out = {}, used = new Set(); if (!e || typeof e !== 'object') return out;
  for (const char of Object.keys(CHARACTERS)) {
    const m = e[char]; if (!m || typeof m !== 'object') continue;
    for (const s of SLOTS) { const it = inv.find((x) => x.u === m[s]); if (!it || used.has(it.u) || ITEMS[it.id].slot !== s || equipError(char, it)) continue; used.add(it.u); (out[char] ||= {})[s] = it.u; }
  }
  return out;
}
/** materiales = { hueso: [n0, n1, n2, n3], … } (cantidad por calidad, tope MAT_STOCK_MAX). */
const matsVacios = () => Object.fromEntries(TODOS_MAT_IDS.map((m) => [m, [0, 0, 0, 0]]));
function limpiarMats(m) { const o = matsVacios(); if (m && typeof m === 'object') for (const id of TODOS_MAT_IDS) if (Array.isArray(m[id])) for (let c = 0; c < 4; c++) o[id][c] = nn(m[id][c], MAT_STOCK_MAX); return o; }
/** planos = ids de objetos cuyo plano se conoce (los Comunes se saben de entrada). */
function limpiarPlanos(a) { const s = new Set(PLANOS_INICIALES); if (Array.isArray(a)) for (const id of a) if (PLANOS[id] && !PLANOS[id].inicial) s.add(id); return [...s]; }
/** cultivo = { item, listo (ms), q, dur } o null: la pieza que se está cultivando en la Forja. */
function limpiarCultivo(c) { return c && typeof c === 'object' && ITEMS[c.item] ? { item: c.item, listo: nn(c.listo, 4e12), q: Math.max(0, Math.min(1, Number(c.q) || 0.5)), dur: nn(c.dur, 3600) } : null; }
const limpiarSigs = (s) => { const o = {}; if (s && typeof s === 'object') for (const h of Object.keys(SIGNATURES)) if (s[h]) o[h] = 1; return o; };
function limpiarMae(m) { // maestría por Huésped: { xp, partidas, kills, oleada } (sólo personajes conocidos, números sanos)
  const out = {}; if (!m || typeof m !== 'object') return out; const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  for (const id of Object.keys(CHARACTERS)) { const e = m[id]; if (e && typeof e === 'object') out[id] = { xp: n(e.xp, 99999), partidas: n(e.partidas, 99999), kills: n(e.kills, 999999), oleada: n(e.oleada, 99) }; }
  return out;
}
function limpiarArb(a) { // progresión permanente por Huésped: { combo: { pc, nodos }, disparo: { pc, nodos } } (puntos ganados y nodos elegidos; se sanea al cargar)
  const out = {}; if (!a || typeof a !== 'object') return out;
  for (const id of Object.keys(CHARACTERS)) {
    const e = a[id]; if (!e || typeof e !== 'object' || !CHARACTERS[id].host) continue; const r = {};
    for (const modo of MODOS_ARBOL) { const x = e[modo] && typeof e[modo] === 'object' ? e[modo] : {}; const nodos = cleanNodos(modo, id, x.nodos); r[modo] = { pc: Math.max(gastado(modo, id, nodos), Math.min(99999, Math.floor(Number(x.pc) || 0))), nodos }; }
    out[id] = r;
  }
  return out;
}
/** Huésped elegido en el navegador (para no quitarle a nadie el que ya estaba usando antes de la Tienda). */
function huespedElegido() { try { return localStorage.getItem('cristal.huesped.v1') || (JSON.parse(localStorage.getItem('cristal.equipo.v1') || 'null') || {}).char || null; } catch { return null; } }
/** tienda = { clave (oferta vigente), comp (renglones ya comprados de esa oferta), rot (partidas terminadas: cambia el stock) }. */
function limpiarTienda(t) { const o = t && typeof t === 'object' ? t : {}; return { clave: typeof o.clave === 'string' ? o.clave.slice(0, 24) : '', comp: Array.isArray(o.comp) ? o.comp.filter((x) => /^[mpo][0-9]$/.test(x)).slice(0, 12) : [], rot: nn(o.rot, 1e6) }; }
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  const inv = limpiarInv(o.inventario || o.inv);
  cache = { ...fresh(), ...o, skillLevel: Number.isInteger(o.skillLevel) && o.skillLevel >= 0 && o.skillLevel <= 2 ? o.skillLevel : 0, cores: Number.isFinite(Number(o.cores)) ? nn(o.cores, Number.MAX_SAFE_INTEGER) : 0, ver: 2, cosmetics: cleanCosmetics(o.cosmetics), inventario: inv, materiales: limpiarMats(o.materiales), planos: limpiarPlanos(o.planos), cultivo: limpiarCultivo(o.cultivo), nf: Math.max(1, nn(o.nf, 1e9)), fauna: limpiarFauna(o.fauna), eq: limpiarEq(o.eq, inv), pity: { l: nn(o.pity && o.pity.l, 999), e: nn(o.pity && o.pity.e, 999) }, sigs: limpiarSigs(o.sigs), nu: Math.max(1, nn(o.nu, 1e9)), evo: { ...(o.evo || {}) }, path: { ...(o.path || {}) }, melee: { ...(o.melee || {}) }, owned: Array.isArray(o.owned) ? o.owned.filter((k) => MELEE_WEAPONS[k]) : [], ess: { ...fresh().ess, ...(o.ess || {}) }, worg: { ...(o.worg || {}) }, corg: { ...(o.corg || {}) }, terr: limpiarTerr(o.terr), guia: limpiarGuia(o.guia), mae: limpiarMae(o.mae), arb: limpiarArb(o.arb), huespedes: migrarHuespedes(o, huespedElegido()), tienda: limpiarTienda(o.tienda), consum: { botiquin: nn(o.consum && o.consum.botiquin, 5) }, herbario: limpiarHerbario(o.herbario), flora: limpiarFlora(o.flora), menu: { iv: nn(o.menu && o.menu.iv, 1e9), tv: typeof (o.menu && o.menu.tv) === 'string' ? o.menu.tv.slice(0, 24) : '' }, base: limpiarBase(o.base) };
  return cache;
}
export const perfil = () => cache || load();
/** Vuelve a leer el guardado (las pruebas lo usan después de cambiar el almacenamiento). */
export const recargar = () => { cache = null; return load(); };
export function guardarHabilidades(level) { const p = perfil(); const n = Number.isInteger(level) && level >= 0 && level <= 2 ? level : 0; if (n > (p.skillLevel || 0)) { p.skillLevel = n; guardar(); } }
export function guardar() { try { localStorage.setItem(KEY, JSON.stringify(perfil())); } catch { /* sin almacenamiento */ } }
/** Datos que recibe la simulación al empezar una partida con este Huésped. */
export const paraPartida = (char) => { const p = perfil(); return { equip: equipoParaPartida(char), pity: { ...p.pity }, sigs: Object.keys(p.sigs), melee: p.melee[char] || undefined, evo: p.evo[char] || 0, path: p.path[char] || [], worg: p.worg, corg: p.corg[char] || [], ess: p.ess, bend: bendicionesActivas(), herb: [...perfil().herbario.hitos], maestria: rangoMaestria(char), arbol: arbolParaPartida(char), fauna: faunaParaPartida(p.fauna) }; };
/** Al terminar (o pasar de oleada): guarda núcleos ganados y el nivel de evolución alcanzado. */
export function cerrarPartida(char, jugador, info = {}) {
  if (!jugador) return null; const p = perfil(); const mae = ganarMaestria(char, jugador, info), arb = ganarArbol(char, jugador, info); if (mae && arb) mae.arbol = arb;
  try { cerrarBotin(char, jugador, info); } catch (err) { console.warn('Inventario: no se pudo cerrar el botín', err.message); }
  p.cores += Math.max(0, Math.floor(jugador.co || 0));
  p.tienda.rot = Math.min(1e6, p.tienda.rot + 1);   // cada partida terminada cambia el stock del Cambista (src/sim/tienda.js)
  p.evo[char] = Math.max(p.evo[char] || 0, jugador.evo || 0);
  if (Array.isArray(jugador.pth) && jugador.pth.length >= (p.path[char] || []).length) p.path[char] = jugador.pth.slice();
  // evolución orgánica: lo que sobra de esencias vuelve al banco; los órganos quedan crecidos para la próxima partida
  if (Array.isArray(jugador.ess)) ['carne', 'cristal', 'ojo', 'vacio'].forEach((k, i) => { p.ess[k] = Math.min(999, jugador.ess[i] || 0); });
  if (Array.isArray(jugador.wg) && Array.isArray(jugador.sl)) jugador.sl.forEach((w, i) => { if ((jugador.wg[i] || []).length) p.worg[w] = jugador.wg[i].slice(); });
  if (Array.isArray(jugador.cg)) p.corg[char] = jugador.cg.slice();
  guardar(); return mae;
}
export const costeSiguiente = (char) => { const t = perfil().evo[char] || 0; return t >= 4 ? 0 : EVO_COST[t + 1]; };
export function evolucionar(char, pick = 0) {
  const p = perfil(), c = costeSiguiente(char); if (!CHARACTERS[char] || !c || p.cores < c || !poseeHuesped(p, char)) return false;   // sólo se evoluciona un Huésped que es tuyo (Tienda)
  const opts = evoPathsFor(char)[(p.evo[char] || 0) + 1]; if (!opts) return false;
  p.cores -= c; p.evo[char] = (p.evo[char] || 0) + 1; (p.path[char] ||= []).push(opts[pick === 1 ? 1 : 0].id); guardar(); return true;
}
export const posee = (id) => !MELEE_WEAPONS[id] ? false : MELEE_WEAPONS[id].cost === 0 || perfil().owned.includes(id);
export function comprarArma(id) {
  const w = MELEE_WEAPONS[id], p = perfil(); if (!w || posee(id) || p.cores < w.cost) return false;
  p.cores -= w.cost; p.owned.push(id); guardar(); return true;
}
export function equipar(char, id) { if (id && !posee(id)) return false; const p = perfil(); if (id) p.melee[char] = id; else delete p.melee[char]; guardar(); return true; }

/* ───── órganos (docs/EVOLUCION.md): mismas reglas que la simulación (organError) pero sobre el perfil, fuera de partida ───── */
const vista = (char) => { const p = perfil(); return { ess: p.ess, worg: p.worg, corg: p.corg[char] || [], evo: p.evo[char] || 0 }; };
export const costoOrgano = (target, id) => ((target === 'w' ? WEAPON_ORGANS[id] : CHAMP_ORGANS[id]) || { cost: {} }).cost;
/** Estado de un órgano: { estado: 'tiene'|'comprable'|'sin esencias'|'grupo ocupado'|'sin lugar'|'incompatible', motivo, cost }. */
export function estadoOrgano(target, char, wid, id) {
  const err = organError(vista(char), target, wid, id), cost = costoOrgano(target, id);
  if (err) return { estado: /ya lo tiene/.test(err) ? 'tiene' : /mismo tipo/.test(err) ? 'grupo ocupado' : /lugar/.test(err) ? 'sin lugar' : 'incompatible', motivo: err, cost };
  const ess = perfil().ess, ok = Object.entries(cost).every(([k, n]) => (ess[k] || 0) >= n);
  return { estado: ok ? 'comprable' : 'sin esencias', motivo: ok ? '' : 'faltan esencias', cost };
}
/** Compra un órgano con las esencias del perfil. target: 'w' (arma a distancia `wid` = índice en WEAPONS) o 'c' (campeón `char`). */
export function comprarOrgano(target, char, wid, id) {
  if (estadoOrgano(target, char, wid, id).estado !== 'comprable') return false;
  const p = perfil(), cost = costoOrgano(target, id); for (const [k, n] of Object.entries(cost)) p.ess[k] -= n;
  if (target === 'w') (p.worg[wid] ||= []).push(id); else (p.corg[char] ||= []).push(id);
  guardar(); return true;
}

/* ───── territorios y bendiciones (docs/MUNDO_VIVO.md): se liberan ganando el mapa; cada uno da UNA bendición entre 2 excluyentes ───── */
export const liberado = (terr) => !!perfil().terr[terr];
/** 'bloqueado' (falta liberar el territorio previo) · 'disponible' · 'liberado'. */
export function estadoTerritorio(terr) {
  const t = TERRITORIOS[terr]; if (!t) return 'bloqueado';
  if (liberado(terr)) return 'liberado';
  return t.requiere.every(liberado) ? 'disponible' : 'bloqueado';
}
/** Bendición elegida de un territorio (id) o null. */
export const bendicionElegida = (terr) => (perfil().terr[terr] || {}).bend || null;
/** Bendiciones activas (una por territorio como máximo), listas para `opts.bend` de addPlayer. */
export const bendicionesActivas = () => cleanBend(Object.keys(TERRITORIOS).map(bendicionElegida).filter(Boolean));
/** Hay territorio liberado cuya bendición todavía no se eligió. */
export const bendicionPendiente = () => Object.keys(TERRITORIOS).filter((t) => liberado(t) && !bendicionElegida(t));
/** Se llama al ganar un mapa. Sólo libera si estaba disponible (no se salta la cadena). Devuelve true si es una liberación nueva. */
export function liberarTerritorio(terr) {
  if (estadoTerritorio(terr) !== 'disponible') return false;
  perfil().terr[terr] = { bend: null }; guardar(); return true;
}
/** Elige la bendición `id` de un territorio liberado. Es permanente: la hermana queda cerrada y no se puede cambiar. */
export function elegirBendicion(terr, id) {
  const b = BENDICIONES[id]; if (!b || b.terr !== terr || !liberado(terr) || bendicionElegida(terr)) return false;
  perfil().terr[terr].bend = id; guardar(); return true;
}
/** Estado de una bendición: 'elegida' · 'cerrada' (su hermana fue elegida) · 'elegible' · 'bloqueada' (territorio sin liberar). */
export function estadoBendicion(id) {
  const b = BENDICIONES[id]; if (!b) return 'bloqueada';
  const el = bendicionElegida(b.terr);
  if (el === id) return 'elegida'; if (el && el === hermana(id)) return 'cerrada';
  return liberado(b.terr) ? 'elegible' : 'bloqueada';
}

/* ───── guía de primera partida (src/client/meta-ui.js): pasos contextuales que se muestran una vez y se pueden saltar ───── */
/** ¿Hay que mostrar este paso? (no se saltó la guía y aún no se vio). */
export const guiaPendiente = (id) => { const g = perfil().guia; return !g.off && !g.vistos.includes(id); };
export function guiaVisto(id) { const g = perfil().guia; if (!g.vistos.includes(id)) { g.vistos.push(id); guardar(); } }
/** Salta toda la guía (para siempre en este perfil). */
export function guiaSaltar() { perfil().guia.off = true; guardar(); }

/* ───── maestría por Huésped (src/sim/maestria.js): XP persistente → rangos 1–10 → bonos chicos y marca visible en el cuerpo ───── */
export const maestria = (char) => (perfil().mae[char] || { xp: 0, partidas: 0, kills: 0, oleada: 0 });
export const rangoMaestria = (char) => rangoDeXp(maestria(char).xp);
export const progresoMaestria = (char) => ({ ...progreso(maestria(char).xp), ...maestria(char) });
/** Suma la XP de una partida (jugador = snapshot; info = { wave, won }). Devuelve { xp, ganada, rangoAntes, rangoDespues, subio } (no guarda: lo hace cerrarPartida). */
function ganarMaestria(char, jugador, info) {
  if (!CHARACTERS[char] || !CHARACTERS[char].host) return null;
  const m = (perfil().mae[char] ||= { xp: 0, partidas: 0, kills: 0, oleada: 0 }), antes = rangoDeXp(m.xp);
  const kills = Math.max(0, jugador.kills | 0), wave = Math.max(0, info.wave | 0), ganada = xpPartida({ kills, wave, won: !!info.won });
  m.xp = Math.min(99999, m.xp + ganada); m.partidas++; m.kills += kills; m.oleada = Math.max(m.oleada, wave);
  const despues = rangoDeXp(m.xp); return { xp: m.xp, ganada, rangoAntes: antes, rangoDespues: despues, subio: despues > antes, max: despues >= RANGO_MAX };
}

/* ───── progresión permanente: árbol de COMBOS (modo Combo) y de DISPARO (modo Shooter) por Huésped (src/sim/progresion.js, docs/EVOLUCION.md) ───── */
const arbDe = (char, modo) => { const a = (perfil().arb[char] ||= {}); return (a[modo] ||= { pc: 0, nodos: [] }); };
/** Estado de un árbol: { pc (ganados en total), gastado, libres, nodos (elegidos) }. modo = 'combo' | 'disparo'. */
export function arbol(char, modo) {
  if (!CHARACTERS[char] || !CHARACTERS[char].host || !MODOS_ARBOL.includes(modo)) return { pc: 0, gastado: 0, libres: 0, nodos: [] };
  const e = (perfil().arb[char] || {})[modo] || { pc: 0, nodos: [] }, g = gastado(modo, char, e.nodos);
  return { pc: e.pc, gastado: g, libres: Math.max(0, e.pc - g), nodos: e.nodos.slice() };
}
/** Lo que recibe la simulación (opts.arbol): { combo: [ids], disparo: [ids] }. */
export const arbolParaPartida = (char) => ({ combo: arbol(char, 'combo').nodos, disparo: arbol(char, 'disparo').nodos });
/** Gasta puntos en un nodo. Devuelve null si salió bien o el motivo (texto en español) si no se pudo. */
export function comprarNodo(char, modo, id) {
  if (!CHARACTERS[char] || !CHARACTERS[char].host || !MODOS_ARBOL.includes(modo)) return 'Ese Huésped no tiene árbol.';
  if (!poseeHuesped(perfil(), char)) return 'Ese Huésped todavía no es tuyo: comprálo en la Tienda.';
  const e = arbDe(char, modo), err = errorNodo(modo, char, e.nodos, id, e.pc); if (err) return err;
  e.nodos = cleanNodos(modo, char, [...e.nodos, id]); guardar(); return null;
}
/** Reinicio opcional: devuelve los puntos gastados menos el costo (25 %). Devuelve { costo, devuelto } o null si no había nada elegido. */
export function reiniciarArbol(char, modo) {
  if (!CHARACTERS[char] || !CHARACTERS[char].host || !MODOS_ARBOL.includes(modo)) return null;
  const e = arbDe(char, modo); if (!e.nodos.length) return null;
  const g = gastado(modo, char, e.nodos), costo = costeReinicio(modo, char, e.nodos); e.pc = Math.max(0, e.pc - costo); e.nodos = []; guardar(); return { costo, devuelto: g - costo };
}
/** Suma los puntos de la partida al árbol del modo jugado (jugador = snapshot con pk; info = { wave }). Devuelve { combo, disparo } ganados o null. No guarda: lo hace cerrarPartida. */
function ganarArbol(char, jugador, info) {
  if (!CHARACTERS[char] || !CHARACTERS[char].host || !Array.isArray(jugador.pk)) return null;
  const [h, f, m, k, sm, sk, mm, smm] = jugador.pk.map((x) => Math.max(0, Math.floor(Number(x) || 0))), wave = Math.max(0, (info && info.wave) | 0);
  const jugoC = h + f + m + k > 0, jugoS = sk + sm > 0;   // ¿se jugó en modo Combo y/o Shooter?
  const olC = jugoC && (!jugoS || h + k >= sk) ? wave : 0, olS = jugoS && !olC ? wave : 0;   // las oleadas cuentan una sola vez, para el modo más jugado
  const cc = jugoC ? puntosCombo({ h, f, m, mm }, olC) : 0, ss = jugoS ? puntosDisparo({ k: sk, m: sm, mm: smm }, olS) : 0;
  if (cc) arbDe(char, 'combo').pc = Math.min(99999, arbDe(char, 'combo').pc + cc);
  if (ss) arbDe(char, 'disparo').pc = Math.min(99999, arbDe(char, 'disparo').pc + ss);
  return { combo: cc, disparo: ss };
}

/* ───── inventario y equipo (docs/INVENTARIO.md) ───── */
export const inventario = () => perfil().inventario;
export const instDe = (uid) => perfil().inventario.find((x) => x.u === uid) || null;
const MATERIALES_TXT = Object.fromEntries(TODOS_MAT_IDS.map((m) => [m, ({ hueso: 'Hueso', quitina: 'Quitina', raiz: 'Raíz', cristal: 'Cristal', carne: 'Carne', espora: 'Espora', vacio: 'Vacío', fibra: 'Fibra viva', savia: 'Savia', petalo: 'Pétalo de luz', resina: 'Resina', nectar: 'Néctar', hoja_espejo: 'Hoja espejo', raiz_hierro: 'Raíz-hierro', polen: 'Polen psicodélico' })[m]]));
const nuevoUid = () => { const p = perfil(); let u; do { u = 'u' + (p.nu++).toString(36); } while (p.inventario.some((x) => x.u === u)); return u; };
/** Quién lleva puesta esta pieza: { char, slot } o null. */
export function puestoEn(uid) { const eq = perfil().eq; for (const c of Object.keys(eq)) for (const s of Object.keys(eq[c])) if (eq[c][s] === uid) return { char: c, slot: s }; return null; }
/** Equipo de un Huésped como instancias: { ranura: instancia }. */
export function equipoDe(char) { const out = {}, m = perfil().eq[char] || {}; for (const s of SLOTS) { const it = instDe(m[s]); if (it) out[s] = it; } return out; }
/** Lista que entra a la simulación (opts.equip): [{ s, id, q, k }]. */
export function equipoParaPartida(char) { return cleanEquip(char, Object.entries(equipoDe(char)).map(([s, it]) => ({ s, id: it.id, q: it.q, k: it.k }))); }
/** Suma el valor de desguace al banco del perfil. */
function pagarDesguace(inst) { const v = desguaceValor(inst), p = perfil(); p.cores += v.cores; for (const [k, n] of Object.entries(v.ess)) p.ess[k] = Math.min(999, (p.ess[k] || 0) + n); for (const [m, x] of Object.entries(v.mats || {})) sumarMat(m, x.cal, x.n); return v; }
/** Agrega un objeto al inventario. Devuelve { ok, uid?, conv?: valor } (conv = se desguazó solo: firma repetida o inventario lleno sin lugar). */
export function agregarItem(drop) {
  const p = perfil(); if (!drop || !ITEMS[drop.id]) return { ok: false };
  const inst = { u: '', id: drop.id, q: Math.round(Math.max(0, Math.min(1, Number(drop.q) || 0)) * 100) / 100, k: 0, lk: false, fv: false, t: Date.now() };
  if (ITEMS[drop.id].host && p.inventario.some((x) => x.id === drop.id)) return { ok: true, conv: pagarDesguace(inst), repetida: true };   // la firma ya está: se convierte en recursos
  if (p.inventario.length >= LIMITE_INVENTARIO) {
    const libres = p.inventario.filter((x) => !x.lk && !x.fv && !puestoEn(x.u)).sort((a, b) => ITEMS[a.id].r - ITEMS[b.id].r || poder(a) - poder(b));
    const peor = libres[0];
    if (!peor || ITEMS[peor.id].r > ITEMS[drop.id].r) return { ok: true, conv: pagarDesguace(inst), lleno: true };
    const v = pagarDesguace(peor); p.inventario = p.inventario.filter((x) => x !== peor); inst.u = nuevoUid(); p.inventario.push(inst); guardar();
    return { ok: true, uid: inst.u, reemplazo: { id: peor.id, valor: v } };
  }
  inst.u = nuevoUid(); p.inventario.push(inst); guardar(); return { ok: true, uid: inst.u };
}
/** Desguaza una pieza (no si está bloqueada, es favorita o está puesta). Devuelve { cores, ess } o null. */
export function desguazar(uid) {
  const p = perfil(), it = instDe(uid); if (!it || it.lk || puestoEn(uid)) return null;
  const v = pagarDesguace(it); p.inventario = p.inventario.filter((x) => x !== it); guardar(); return v;
}
/** Desguaza de una vez todo lo que no está protegido y no pasa de la rareza `hasta` (0 = común, 1 = rara…). Devuelve { n, cores, ess }. */
export function desguazarSobrantes(hasta = 0) {
  const tot = { n: 0, cores: 0, ess: {} };
  for (const it of perfil().inventario.slice()) { if (it.lk || it.fv || puestoEn(it.u) || ITEMS[it.id].r > hasta) continue; const v = desguazar(it.u); if (!v) continue; tot.n++; tot.cores += v.cores; for (const [k, n] of Object.entries(v.ess)) tot.ess[k] = (tot.ess[k] || 0) + n; }
  return tot;
}
export function bloquear(uid, v) { const it = instDe(uid); if (!it) return false; it.lk = v === undefined ? !it.lk : !!v; guardar(); return it.lk; }
export function favorito(uid, v) { const it = instDe(uid); if (!it) return false; it.fv = v === undefined ? !it.fv : !!v; guardar(); return it.fv; }
/** Pone una pieza al Huésped. Si estaba puesta en otro, se la quita. Devuelve '' si salió bien o el motivo. */
export function equiparItem(char, uid) {
  const it = instDe(uid), p = perfil(); if (!it || !CHARACTERS[char]) return 'no existe';
  const err = equipError(char, it); if (err) return err;
  const prev = puestoEn(uid); if (prev) delete p.eq[prev.char][prev.slot];
  (p.eq[char] ||= {})[ITEMS[it.id].slot] = uid; guardar(); return '';
}
export function desequipar(char, slot) { const e = perfil().eq[char]; if (!e || !e[slot]) return false; delete e[slot]; guardar(); return true; }

let botin = null;
/** Resumen del botín de la última partida: { items: [{id, q, uid?, conv?, repetida?, lleno?}], madura: [{id, fase}], firma: [ids], pity }. */
export const ultimoBotin = () => botin;
/** Cierra el botín de la partida: guarda lo recogido, suma la maduración y el pity, y registra las armas firma cumplidas. */
function cerrarBotin(char, jugador, info) {
  const p = perfil(); botin = { items: [], madura: [], firma: [], pity: null };
  const bolsa = Array.isArray(info.bag) && info.bag.length ? info.bag : (Array.isArray(jugador.bag) ? jugador.bag.map((s) => { const [id, q, n] = String(s).split('|'); return { id, q: Number(q), n: Number(n) || 1 }; }) : []);
  // maduración: las bajas de la partida suben las piezas que llevaba puestas
  const eq = p.eq[char] || {};
  if (jugador.ik && typeof jugador.ik === 'object') for (const s of SLOTS) { const n = nn(jugador.ik[s], 5000), it = instDe(eq[s]); if (!n || !it) continue; const a = faseDe(ITEMS[it.id], it.k); it.k = Math.min(99999, it.k + n); const b = faseDe(ITEMS[it.id], it.k); if (b > a) botin.madura.push({ id: it.id, fase: b }); }
  botin.mats = {}; botin.planos = [];
  for (const d of bolsa.slice(0, 80)) {
    const id = String(d.id);
    if (id.startsWith('semilla:')) { const sp = id.slice(8); if (FLORA_ESP[sp]) { p.flora.semillas[sp] = nn((p.flora.semillas[sp] || 0) + Math.max(1, nn(d.n || 1, 9)), 99); (botin.semillas ||= []).push(sp); } }
    else if (id.startsWith('mat:')) { const m = id.slice(4); if (TODOS_MAT_IDS.includes(m)) { const cal = nn(d.q, 3), n = Math.max(1, nn(d.n || 1, 9)); sumarMat(m, cal, n); (botin.mats[m] ||= [0, 0, 0, 0])[cal] += n; } }
    else if (id.startsWith('plano:')) { const it = id.slice(6); if (PLANOS[it]) { if (aprenderPlano(it)) botin.planos.push(it); else { sumarMat(ITEMS[it].mat, 1, 2); botin.planos.push(it + '!'); } } }
    else { const r = agregarItem(d); if (r.ok) botin.items.push({ id: d.id, q: d.q, ...r }); }
  }
  if (Array.isArray(jugador.pt)) p.pity = { l: nn(jugador.pt[0], 999), e: nn(jugador.pt[1], 999) };
  if (jugador.sg && SIGNATURES[char]) { if (!p.sigs[char]) botin.firma.push(SIGNATURES[char]); p.sigs[char] = 1; }
  botin.pity = { ...p.pity };
}
/** Texto en español del botín de la última partida (pantalla final). */
export function botinTexto() {
  const b = botin, nm = b ? Object.keys(b.mats || {}) : []; if (!b || (!b.items.length && !b.madura.length && !nm.length && !(b.planos || []).length)) return '';
  const R = ['Común', 'Rara', 'Épica', 'Legendaria'], CAL = ['Burdo', 'Fino', 'Excelente', 'Perfecto'], L = [`BOTÍN (${b.items.length + nm.length + (b.planos || []).length})`];
  for (const m of nm) L.push(`  Material: ${MATERIALES_TXT[m]} ${b.mats[m].map((n, c) => (n ? `${n}× ${CAL[c]}` : '')).filter(Boolean).join(', ')}`);
  for (const pl of b.planos || []) L.push(pl.endsWith('!') ? `  Plano repetido (${ITEMS[pl.slice(0, -1)].name}): se convirtió en materiales` : `  PLANO NUEVO: ${ITEMS[pl].name} (construilo en la Forja)`);
  for (const d of b.items.slice(0, 12)) L.push(`  ${R[ITEMS[d.id].r]} · ${ITEMS[d.id].name}${d.repetida ? ' (ya la tenías: desguazada)' : d.lleno ? ' (inventario lleno: desguazada)' : d.reemplazo ? ' (reemplazó a un objeto sobrante)' : ''}`);
  if (b.items.length > 12) L.push(`  … y ${b.items.length - 12} más`);
  for (const m of b.madura) L.push(`  ¡${ITEMS[m.id].name} maduró! Ahora está ${['Latente', 'Despierta', 'Madura', 'Plena'][m.fase]}.`);
  return '\n\n' + L.join('\n');
}

/* ───── FORJA BIOLÓGICA (docs/INVENTARIO.md): materiales por calidad, planos, recetas, cultivo, fusión ───── */
export const materiales = () => perfil().materiales;
export const planos = () => perfil().planos;
/** Cuántos materiales de ese tipo hay con calidad ≥ cal. */
export const stockMin = (mat, cal = 0) => (perfil().materiales[mat] || []).slice(cal).reduce((a, b) => a + b, 0);
export function sumarMat(mat, cal, n) { const p = perfil(), a = p.materiales[mat]; if (!a || cal < 0 || cal > 3) return 0; const antes = a[cal]; a[cal] = Math.min(MAT_STOCK_MAX, a[cal] + Math.max(0, n | 0)); return a[cal] - antes; }
export const conoce = (id) => perfil().planos.includes(id);
/** Aprende un plano. false si ya se conocía. */
export function aprenderPlano(id) { const p = perfil(); if (!PLANOS[id] || p.planos.includes(id)) return false; p.planos.push(id); return true; }
/** Consume n materiales de tipo `mat` con calidad ≥ cal, gastando primero los de menor calidad. Devuelve la calidad media gastada, o -1 si no alcanza. */
function gastarMat(mat, n, cal, simular) {
  const a = perfil().materiales[mat]; let falta = n, suma = 0; const usa = [0, 0, 0, 0];
  for (let c = cal; c < 4 && falta > 0; c++) { const t = Math.min(falta, a[c]); usa[c] = t; falta -= t; suma += t * c; }
  if (falta > 0) return -1;
  if (!simular) for (let c = 0; c < 4; c++) a[c] -= usa[c];
  return suma / n;
}
/** Estado de una receta para la interfaz: { ok, motivo, receta, faltan: [{mat, n, cal, tiene}] }. */
export function estadoReceta(id) {
  const R = RECETAS[id], p = perfil(); if (!R) return { ok: false, motivo: 'no existe' };
  const faltan = R.mats.map((x) => ({ ...x, tiene: stockMin(x.mat, x.cal) }));
  let motivo = '';
  if (!conoce(id)) motivo = PLANOS[id].firma ? 'Falta el plano raro (lo suelta el jefe de su mapa)' : 'Todavía no conocés el plano';
  else if (p.cultivo) motivo = 'La Forja está cultivando otra pieza';
  else if (faltan.some((x) => x.tiene < x.n)) motivo = 'Faltan materiales';
  else if (p.cores < R.cores) motivo = 'Faltan núcleos';
  return { ok: !motivo, motivo, receta: R, faltan };
}
/** Pone una pieza a cultivar: gasta plano (no se gasta: queda aprendido), materiales y núcleos. El resultado tiene una calidad determinista acotada (qForja). */
export function forjar(id, ahora = Date.now()) {
  const st = estadoReceta(id); if (!st.ok) return { ok: false, motivo: st.motivo };
  const p = perfil(), R = st.receta; let cal = 0, n = 0;
  for (const x of R.mats) { const c = gastarMat(x.mat, x.n, x.cal, false); cal += c * x.n; n += x.n; }
  p.cores -= R.cores; const q = qForja(id, p.nf++, cal / Math.max(1, n));
  p.cultivo = { item: id, listo: ahora + R.tiempo * 1000, q, dur: R.tiempo }; guardar();
  return { ok: true, q, tiempo: R.tiempo };
}
/** Segundos que faltan para recoger (0 = listo), o null si no se cultiva nada. */
export const cultivoFalta = (ahora = Date.now()) => { const c = perfil().cultivo; return c ? Math.max(0, Math.ceil((c.listo - ahora) / 1000)) : null; };
/** Gasta núcleos (1 cada 2 s que faltan) para terminar ya. */
export function acelerar(ahora = Date.now()) { const p = perfil(), f = cultivoFalta(ahora); if (!p.cultivo || !f) return false; const costo = Math.ceil(f / 2); if (p.cores < costo) return false; p.cores -= costo; p.cultivo.listo = ahora; guardar(); return true; }
/** Recoge la pieza terminada y la mete al inventario (si es una firma repetida o el inventario está lleno se convierte, como siempre). */
export function recoger(ahora = Date.now()) {
  const p = perfil(), c = p.cultivo; if (!c || c.listo > ahora) return null;
  p.cultivo = null; const r = agregarItem({ id: c.item, q: c.q }); guardar(); return { item: c.item, q: c.q, ...r };
}
/** Fusión: la pieza `b` (misma ranura, distinta pieza, ni puesta ni bloqueada) se consume y la `a` hereda la mitad de sus bajas y sube su calidad hasta +0,1. */
export function fusionar(a, b) {
  const A = instDe(a), B = instDe(b); if (!A || !B || A === B) return { ok: false, motivo: 'piezas inválidas' };
  if (ITEMS[A.id].slot !== ITEMS[B.id].slot) return { ok: false, motivo: 'tienen que ser de la misma ranura' };
  if (B.lk || B.fv || puestoEn(b)) return { ok: false, motivo: 'la pieza a consumir está bloqueada, es favorita o está puesta' };
  const p = perfil(), costo = 10 + 15 * ITEMS[A.id].r; if (p.cores < costo) return { ok: false, motivo: `faltan núcleos (${costo})` };
  p.cores -= costo; A.k = Math.min(99999, A.k + Math.floor(B.k / 2) + 10 * (ITEMS[B.id].r + 1)); A.q = Math.round(Math.min(1, A.q + 0.02 * (ITEMS[B.id].r + 1) + 0.03) * 100) / 100;
  p.inventario = p.inventario.filter((x) => x !== B); guardar(); return { ok: true, k: A.k, q: A.q };
}
/** Piezas de cada set que lleva el Huésped y el estado de sus bonos (para la pantalla de sets). */
export function setsDe(char) { const l = equipoParaPartida(char); return l; }

/* ───── LA BASE (docs/BASE.md): estación visitada, tutorial y JARDÍN (las macetas guardan la hora real de siembra; la Forja usa `cultivo`, arriba) ───── */
export const baseDatos = () => perfil().base;
/** Marca una estación como visitada (el punto de aviso de la Base se apaga). */
export function visitarEstacion(id, ahora = Date.now()) { if (!ESTACION_IDS.includes(id)) return false; perfil().base.vis[id] = ahora; guardar(); return true; }
export const tutorialBaseVisto = () => perfil().base.tut === true;
export function tutorialBaseListo() { perfil().base.tut = true; guardar(); }
/** Estado de las 6 macetas con la hora `ahora`: [{ estado: 'vacia'|'crece'|'lista', faltan, prog, planta }]. */
export const jardinEstado = (ahora = Date.now()) => perfil().base.jardin.map((m) => macetaEstado(m, ahora));
/** Siembra `planta` en la maceta `i` pagando sus núcleos. { ok, motivo }. */
export function sembrar(i, planta, ahora = Date.now()) {
  const p = perfil(), P = PLANTAS[planta]; if (!P) return { ok: false, motivo: 'Esa semilla no existe' };
  if (!(i >= 0 && i < 6)) return { ok: false, motivo: 'Esa maceta no existe' };
  if (p.base.jardin[i]) return { ok: false, motivo: 'La maceta ya está ocupada' };
  if (p.cores < P.costo) return { ok: false, motivo: `Faltan núcleos (${P.costo})` };
  p.cores -= P.costo; p.base.jardin[i] = { p: planta, t0: ahora }; guardar(); return { ok: true, planta: P };
}
/** Cosecha la maceta `i` si está lista: suma los materiales al stock. { ok, mat, n, cal, motivo }. */
export function cosechar(i, ahora = Date.now()) {
  const p = perfil(), m = p.base.jardin[i], st = macetaEstado(m, ahora);
  if (st.estado === 'vacia') return { ok: false, motivo: 'La maceta está vacía' };
  if (st.estado !== 'lista') return { ok: false, motivo: 'Todavía está creciendo' };
  const P = st.planta; p.materiales[P.mat] ||= [0, 0, 0, 0]; const n = sumarMat(P.mat, P.cal, P.n);   // (un material nuevo, p. ej. vegetal, puede no tener todavía su casillero)
  p.base.jardin[i] = null; guardar(); return { ok: true, mat: P.mat, n, cal: P.cal, planta: P };
}
/** Avisos de la Base por estación: cuántas cosas listas hay (cultivo de la Forja listo, cosecha del jardín, Huésped comprable, botín nuevo). */
export function avisosBase(ahora = Date.now()) {
  const p = perfil(), out = {};
  const f = cultivoFalta(ahora); if (p.cultivo && f === 0) out.forja = 1;
  const c = jardinEstado(ahora).filter((x) => x.estado === 'lista').length; if (c) out.jardin = c;
  return out;
}


/* ───── HERBARIO, SEMILLAS Y FORJA DE JARDÍN (docs/FLORA.md) ───── */
/** herbario = { vistas: { especie: veces vista }, cosechas: { especie: n }, hitos: [ids] }: sólo especies y hitos que existen; números acotados. */
function limpiarHerbario(h) {
  const o = { vistas: {}, cosechas: {}, hitos: [] }; if (!h || typeof h !== 'object') return o;
  for (const sp of Object.keys(FLORA_ESP)) { if (h.vistas && h.vistas[sp]) o.vistas[sp] = Math.max(1, nn(h.vistas[sp], 99999)); if (h.cosechas && h.cosechas[sp]) o.cosechas[sp] = Math.max(1, nn(h.cosechas[sp], 99999)); }
  o.hitos = hitosCumplidos(o); return o;
}
/** flora = { semillas: { especie: n }, cebos: n }: lo que se fabrica con la Forja de jardín y espera en la mochila (la Base y la fauna lo usan). */
function limpiarFlora(f) {
  const o = { semillas: {}, cebos: 0 }; if (!f || typeof f !== 'object') return o;
  for (const sp of Object.keys(FLORA_ESP)) if (f.semillas && f.semillas[sp]) o.semillas[sp] = Math.max(1, nn(f.semillas[sp], 99));
  o.cebos = nn(f.cebos, 20); return o;
}
export const herbario = () => perfil().herbario;
export const florita = () => perfil().flora;   // semillas y cebos
/** Registra que se vio una planta (la primera vez es un descubrimiento). Devuelve { nuevo, hitos: [hitos nuevos] }. */
export function verPlanta(sp) {
  if (!FLORA_ESP[sp]) return { nuevo: false, hitos: [] };
  const h = perfil().herbario, nuevo = !h.vistas[sp]; h.vistas[sp] = Math.min(99999, (h.vistas[sp] || 0) + 1);
  const antes = new Set(h.hitos); h.hitos = hitosCumplidos(h); const nuevos = h.hitos.filter((x) => !antes.has(x));
  if (nuevo || nuevos.length) guardar();
  return { nuevo, hitos: nuevos };
}
/** Registra una cosecha o planta destruida con botín. Devuelve los hitos nuevos. */
export function cosechaPlanta(sp) {
  if (!FLORA_ESP[sp]) return [];
  const h = perfil().herbario; h.cosechas[sp] = Math.min(99999, (h.cosechas[sp] || 0) + 1);
  const antes = new Set(h.hitos); h.hitos = hitosCumplidos(h); const nuevos = h.hitos.filter((x) => !antes.has(x)); guardar(); return nuevos;
}
/** Estado de una receta de consumible de jardín: { ok, motivo, receta, faltan }. */
export function estadoConsumible(id) {
  const R = CONSUMIBLES[id], p = perfil(); if (!R) return { ok: false, motivo: 'no existe' };
  const faltan = R.mats.map((x) => ({ ...x, tiene: stockMin(x.mat, x.cal) }));
  let motivo = '';
  if (faltan.some((x) => x.tiene < x.n)) motivo = 'Faltan materiales'; else if (p.cores < R.cores) motivo = 'Faltan núcleos';
  else if (R.da.botiquin && p.consum.botiquin >= 5) motivo = 'Ya tenés 5 botiquines';
  else if (R.da.cebo && p.flora.cebos >= 20) motivo = 'Ya tenés 20 cebos';
  else if (R.da.semilla && (p.flora.semillas[R.da.semilla] || 0) >= 99) motivo = 'Ya tenés muchas';
  return { ok: !motivo, motivo, receta: R, faltan };
}
/** Fabrica un consumible de jardín al instante (botiquín orgánico, cebo para fauna o semilla). */
export function forjarConsumible(id) {
  const st = estadoConsumible(id); if (!st.ok) return { ok: false, motivo: st.motivo };
  const p = perfil(), R = st.receta;
  for (const x of R.mats) gastarMat(x.mat, x.n, x.cal, false);
  p.cores -= R.cores;
  if (R.da.botiquin) p.consum.botiquin = Math.min(5, p.consum.botiquin + R.da.botiquin);
  if (R.da.cebo) p.flora.cebos = Math.min(20, p.flora.cebos + R.da.cebo);
  if (R.da.semilla) p.flora.semillas[R.da.semilla] = Math.min(99, (p.flora.semillas[R.da.semilla] || 0) + 1);
  guardar(); return { ok: true, receta: R };
}
/** Gasta un cebo (la fauna lo pide al empezar la partida). false si no hay. */
export function usarCebo() { const p = perfil(); if (p.flora.cebos < 1) return false; p.flora.cebos--; guardar(); return true; }

/* ───── Códice de Fauna (docs/FAUNA.md): especies comidas, contador, hitos y ADN. Es del PERFIL: sobrevive a las partidas y a las versiones viejas del guardado. ───── */
export const fauna = () => perfil().fauna;
/** Anota que se comió una especie (se llama con cada evento `fauna/come` propio). Devuelve { nuevo, hitos:[n…], n, especie } para que la pantalla avise («¡Nueva especie en el Códice!», «Hito: 10 comidas»). */
export function registrarFauna(espId, hibrido = null) {
  const sp = ESPECIES[espId]; if (!sp) return null; const r = registrarComida(fauna(), espId, hibrido); guardar();
  return { ...r, especie: sp, hito: r.hitos.length ? HITOS_FAUNA.find((h) => h.n === r.hitos[r.hitos.length - 1]) : null };
}
/** Lo que viaja a una sala cooperativa: { especie: veces }. */
export const faunaDeLaSala = () => faunaParaPartida(fauna());
