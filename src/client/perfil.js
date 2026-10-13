// Perfil del jugador (se guarda en el navegador): núcleos ahorrados, evolución de cada Huésped y arma cuerpo a cuerpo equipada.
import { EVO_COST, MELEE_WEAPONS, CHARACTERS, WEAPON_ORGANS, CHAMP_ORGANS } from '../sim/data.js';
import { organError } from '../sim/organos.js';
const KEY = 'cristal.perfil.v1';
let cache = null;
const fresh = () => ({ cores: 0, evo: {}, path: {}, melee: {}, owned: [], ess: { carne: 0, cristal: 0, ojo: 0, vacio: 0 }, worg: {}, corg: {} });
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  cache = { ...fresh(), ...o, evo: { ...(o.evo || {}) }, path: { ...(o.path || {}) }, melee: { ...(o.melee || {}) }, owned: Array.isArray(o.owned) ? o.owned.filter((k) => MELEE_WEAPONS[k]) : [], ess: { ...fresh().ess, ...(o.ess || {}) }, worg: { ...(o.worg || {}) }, corg: { ...(o.corg || {}) } };
  return cache;
}
export const perfil = () => cache || load();
export function guardar() { try { localStorage.setItem(KEY, JSON.stringify(perfil())); } catch { /* sin almacenamiento */ } }
/** Datos que recibe la simulación al empezar una partida con este Huésped. */
export const paraPartida = (char) => { const p = perfil(); return { melee: p.melee[char] || undefined, evo: p.evo[char] || 0, path: p.path[char] || [], worg: p.worg, corg: p.corg[char] || [], ess: p.ess }; };
/** Al terminar (o pasar de oleada): guarda núcleos ganados y el nivel de evolución alcanzado. */
export function cerrarPartida(char, jugador) {
  if (!jugador) return; const p = perfil();
  p.cores += Math.max(0, Math.floor(jugador.co || 0));
  p.evo[char] = Math.max(p.evo[char] || 0, jugador.evo || 0);
  if (Array.isArray(jugador.pth) && jugador.pth.length >= (p.path[char] || []).length) p.path[char] = jugador.pth.slice();
  // evolución orgánica: lo que sobra de esencias vuelve al banco; los órganos quedan crecidos para la próxima partida
  if (Array.isArray(jugador.ess)) ['carne', 'cristal', 'ojo', 'vacio'].forEach((k, i) => { p.ess[k] = Math.min(999, jugador.ess[i] || 0); });
  if (Array.isArray(jugador.wg) && Array.isArray(jugador.sl)) jugador.sl.forEach((w, i) => { if ((jugador.wg[i] || []).length) p.worg[w] = jugador.wg[i].slice(); });
  if (Array.isArray(jugador.cg)) p.corg[char] = jugador.cg.slice();
  guardar();
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
