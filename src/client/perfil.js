// Perfil del jugador (se guarda en el navegador): núcleos ahorrados, evolución de cada Huésped y arma cuerpo a cuerpo equipada.
import { EVO_COST, EVO_PATHS, MELEE_WEAPONS, CHARACTERS, WEAPON_ORGANS, CHAMP_ORGANS } from '../sim/data.js';
import { TERRITORIOS, BENDICIONES, cleanBend, hermana } from '../sim/bendiciones.js';
import { organError } from '../sim/organos.js';
import { xpPartida, progreso, rangoDeXp, RANGO_MAX } from '../sim/maestria.js';
import { ITEMS, SLOTS, SIGNATURES, LIMITE_INVENTARIO, cleanEquip, equipError, desguaceValor, faseDe, poder } from '../sim/items.js';
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
const fresh = () => ({ ver: 2, cores: 0, evo: {}, path: {}, melee: {}, owned: [], ess: { carne: 0, cristal: 0, ojo: 0, vacio: 0 }, worg: {}, corg: {}, terr: {}, guia: { off: false, vistos: [] }, mae: {}, inv: [], eq: {}, pity: { l: 0, e: 0 }, sigs: {}, nu: 1 });
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
const limpiarSigs = (s) => { const o = {}; if (s && typeof s === 'object') for (const h of Object.keys(SIGNATURES)) if (s[h]) o[h] = 1; return o; };
function limpiarMae(m) { // maestría por Huésped: { xp, partidas, kills, oleada } (sólo personajes conocidos, números sanos)
  const out = {}; if (!m || typeof m !== 'object') return out; const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  for (const id of Object.keys(CHARACTERS)) { const e = m[id]; if (e && typeof e === 'object') out[id] = { xp: n(e.xp, 99999), partidas: n(e.partidas, 99999), kills: n(e.kills, 999999), oleada: n(e.oleada, 99) }; }
  return out;
}
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  const inv = limpiarInv(o.inv);
  cache = { ...fresh(), ...o, ver: 2, inv, eq: limpiarEq(o.eq, inv), pity: { l: nn(o.pity && o.pity.l, 999), e: nn(o.pity && o.pity.e, 999) }, sigs: limpiarSigs(o.sigs), nu: Math.max(1, nn(o.nu, 1e9)), evo: { ...(o.evo || {}) }, path: { ...(o.path || {}) }, melee: { ...(o.melee || {}) }, owned: Array.isArray(o.owned) ? o.owned.filter((k) => MELEE_WEAPONS[k]) : [], ess: { ...fresh().ess, ...(o.ess || {}) }, worg: { ...(o.worg || {}) }, corg: { ...(o.corg || {}) }, terr: limpiarTerr(o.terr), guia: limpiarGuia(o.guia), mae: limpiarMae(o.mae) };
  return cache;
}
export const perfil = () => cache || load();
export function guardar() { try { localStorage.setItem(KEY, JSON.stringify(perfil())); } catch { /* sin almacenamiento */ } }
/** Datos que recibe la simulación al empezar una partida con este Huésped. */
export const paraPartida = (char) => { const p = perfil(); return { equip: equipoParaPartida(char), pity: { ...p.pity }, sigs: Object.keys(p.sigs), melee: p.melee[char] || undefined, evo: p.evo[char] || 0, path: p.path[char] || [], worg: p.worg, corg: p.corg[char] || [], ess: p.ess, bend: bendicionesActivas(), maestria: rangoMaestria(char) }; };
/** Al terminar (o pasar de oleada): guarda núcleos ganados y el nivel de evolución alcanzado. */
export function cerrarPartida(char, jugador, info = {}) {
  if (!jugador) return null; const p = perfil(); const mae = ganarMaestria(char, jugador, info);
  try { cerrarBotin(char, jugador, info); } catch (err) { console.warn('Inventario: no se pudo cerrar el botín', err.message); }
  p.cores += Math.max(0, Math.floor(jugador.co || 0));
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
  const p = perfil(), c = costeSiguiente(char); if (!CHARACTERS[char] || !c || p.cores < c) return false;
  const opts = EVO_PATHS[(p.evo[char] || 0) + 1]; if (!opts) return false;
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

/* ───── inventario y equipo (docs/INVENTARIO.md) ───── */
export const inventario = () => perfil().inv;
export const instDe = (uid) => perfil().inv.find((x) => x.u === uid) || null;
const nuevoUid = () => { const p = perfil(); let u; do { u = 'u' + (p.nu++).toString(36); } while (p.inv.some((x) => x.u === u)); return u; };
/** Quién lleva puesta esta pieza: { char, slot } o null. */
export function puestoEn(uid) { const eq = perfil().eq; for (const c of Object.keys(eq)) for (const s of Object.keys(eq[c])) if (eq[c][s] === uid) return { char: c, slot: s }; return null; }
/** Equipo de un Huésped como instancias: { ranura: instancia }. */
export function equipoDe(char) { const out = {}, m = perfil().eq[char] || {}; for (const s of SLOTS) { const it = instDe(m[s]); if (it) out[s] = it; } return out; }
/** Lista que entra a la simulación (opts.equip): [{ s, id, q, k }]. */
export function equipoParaPartida(char) { return cleanEquip(char, Object.entries(equipoDe(char)).map(([s, it]) => ({ s, id: it.id, q: it.q, k: it.k }))); }
/** Suma el valor de desguace al banco del perfil. */
function pagarDesguace(inst) { const v = desguaceValor(inst), p = perfil(); p.cores += v.cores; for (const [k, n] of Object.entries(v.ess)) p.ess[k] = Math.min(999, (p.ess[k] || 0) + n); return v; }
/** Agrega un objeto al inventario. Devuelve { ok, uid?, conv?: valor } (conv = se desguazó solo: firma repetida o inventario lleno sin lugar). */
export function agregarItem(drop) {
  const p = perfil(); if (!drop || !ITEMS[drop.id]) return { ok: false };
  const inst = { u: '', id: drop.id, q: Math.round(Math.max(0, Math.min(1, Number(drop.q) || 0)) * 100) / 100, k: 0, lk: false, fv: false, t: Date.now() };
  if (ITEMS[drop.id].host && p.inv.some((x) => x.id === drop.id)) return { ok: true, conv: pagarDesguace(inst), repetida: true };   // la firma ya está: se convierte en recursos
  if (p.inv.length >= LIMITE_INVENTARIO) {
    const libres = p.inv.filter((x) => !x.lk && !x.fv && !puestoEn(x.u)).sort((a, b) => ITEMS[a.id].r - ITEMS[b.id].r || poder(a) - poder(b));
    const peor = libres[0];
    if (!peor || ITEMS[peor.id].r > ITEMS[drop.id].r) return { ok: true, conv: pagarDesguace(inst), lleno: true };
    const v = pagarDesguace(peor); p.inv = p.inv.filter((x) => x !== peor); inst.u = nuevoUid(); p.inv.push(inst); guardar();
    return { ok: true, uid: inst.u, reemplazo: { id: peor.id, valor: v } };
  }
  inst.u = nuevoUid(); p.inv.push(inst); guardar(); return { ok: true, uid: inst.u };
}
/** Desguaza una pieza (no si está bloqueada, es favorita o está puesta). Devuelve { cores, ess } o null. */
export function desguazar(uid) {
  const p = perfil(), it = instDe(uid); if (!it || it.lk || puestoEn(uid)) return null;
  const v = pagarDesguace(it); p.inv = p.inv.filter((x) => x !== it); guardar(); return v;
}
/** Desguaza de una vez todo lo que no está protegido y no pasa de la rareza `hasta` (0 = común, 1 = rara…). Devuelve { n, cores, ess }. */
export function desguazarSobrantes(hasta = 0) {
  const tot = { n: 0, cores: 0, ess: {} };
  for (const it of perfil().inv.slice()) { if (it.lk || it.fv || puestoEn(it.u) || ITEMS[it.id].r > hasta) continue; const v = desguazar(it.u); if (!v) continue; tot.n++; tot.cores += v.cores; for (const [k, n] of Object.entries(v.ess)) tot.ess[k] = (tot.ess[k] || 0) + n; }
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
  const bolsa = Array.isArray(info.bag) && info.bag.length ? info.bag : (Array.isArray(jugador.bag) ? jugador.bag.map((s) => { const [id, q] = String(s).split(':'); return { id, q: Number(q) }; }) : []);
  // maduración: las bajas de la partida suben las piezas que llevaba puestas
  const eq = p.eq[char] || {};
  if (jugador.ik && typeof jugador.ik === 'object') for (const s of SLOTS) { const n = nn(jugador.ik[s], 5000), it = instDe(eq[s]); if (!n || !it) continue; const a = faseDe(ITEMS[it.id], it.k); it.k = Math.min(99999, it.k + n); const b = faseDe(ITEMS[it.id], it.k); if (b > a) botin.madura.push({ id: it.id, fase: b }); }
  for (const d of bolsa.slice(0, 80)) { const r = agregarItem(d); if (r.ok) botin.items.push({ id: d.id, q: d.q, ...r }); }
  if (Array.isArray(jugador.pt)) p.pity = { l: nn(jugador.pt[0], 999), e: nn(jugador.pt[1], 999) };
  if (jugador.sg && SIGNATURES[char]) { if (!p.sigs[char]) botin.firma.push(SIGNATURES[char]); p.sigs[char] = 1; }
  botin.pity = { ...p.pity };
}
/** Texto en español del botín de la última partida (pantalla final). */
export function botinTexto() {
  const b = botin; if (!b || (!b.items.length && !b.madura.length)) return '';
  const R = ['Común', 'Rara', 'Épica', 'Legendaria'], L = [`BOTÍN (${b.items.length})`];
  for (const d of b.items.slice(0, 12)) L.push(`  ${R[ITEMS[d.id].r]} · ${ITEMS[d.id].name}${d.repetida ? ' (ya la tenías: desguazada)' : d.lleno ? ' (inventario lleno: desguazada)' : d.reemplazo ? ' (reemplazó a un objeto sobrante)' : ''}`);
  if (b.items.length > 12) L.push(`  … y ${b.items.length - 12} más`);
  for (const m of b.madura) L.push(`  ¡${ITEMS[m.id].name} maduró! Ahora está ${['Latente', 'Despierta', 'Madura', 'Plena'][m.fase]}.`);
  return '\n\n' + L.join('\n');
}
