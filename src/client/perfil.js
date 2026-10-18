// Perfil del jugador (se guarda en el navegador): núcleos ahorrados, evolución de cada Huésped y arma cuerpo a cuerpo equipada.
import { EVO_COST, EVO_PATHS, MELEE_WEAPONS, CHARACTERS, WEAPON_ORGANS, CHAMP_ORGANS } from '../sim/data.js';
import { TERRITORIOS, BENDICIONES, cleanBend, hermana } from '../sim/bendiciones.js';
import { organError } from '../sim/organos.js';
import { xpPartida, progreso, rangoDeXp, RANGO_MAX } from '../sim/maestria.js';
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
const fresh = () => ({ cores: 0, evo: {}, path: {}, melee: {}, owned: [], ess: { carne: 0, cristal: 0, ojo: 0, vacio: 0 }, worg: {}, corg: {}, terr: {}, guia: { off: false, vistos: [] }, mae: {} });
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  cache = { ...fresh(), ...o, evo: { ...(o.evo || {}) }, path: { ...(o.path || {}) }, melee: { ...(o.melee || {}) }, owned: Array.isArray(o.owned) ? o.owned.filter((k) => MELEE_WEAPONS[k]) : [], ess: { ...fresh().ess, ...(o.ess || {}) }, worg: { ...(o.worg || {}) }, corg: { ...(o.corg || {}) }, terr: limpiarTerr(o.terr), guia: limpiarGuia(o.guia), mae: (o.mae && typeof o.mae === 'object') ? { ...o.mae } : {} };
  return cache;
}
export const perfil = () => cache || load();
export function guardar() { try { localStorage.setItem(KEY, JSON.stringify(perfil())); } catch { /* sin almacenamiento */ } }
/** Datos que recibe la simulación al empezar una partida con este Huésped. */
export const paraPartida = (char) => { const p = perfil(); return { melee: p.melee[char] || undefined, evo: p.evo[char] || 0, path: p.path[char] || [], worg: p.worg, corg: p.corg[char] || [], ess: p.ess, bend: bendicionesActivas(), maestria: rangoMaestria(char) }; };
/** Al terminar (o pasar de oleada): guarda núcleos ganados y el nivel de evolución alcanzado. */
export function cerrarPartida(char, jugador, info = {}) {
  if (!jugador) return null; const p = perfil(); const mae = ganarMaestria(char, jugador, info);
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
