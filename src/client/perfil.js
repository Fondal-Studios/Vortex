// Perfil del jugador (se guarda en el navegador): núcleos ahorrados, evolución de cada Huésped y arma cuerpo a cuerpo equipada.
import { EVO_COST, MELEE_WEAPONS, CHARACTERS } from '../sim/data.js';
const KEY = 'cristal.perfil.v1';
let cache = null;
const fresh = () => ({ cores: 0, evo: {}, melee: {}, owned: [] });
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  cache = { ...fresh(), ...o, evo: { ...(o.evo || {}) }, melee: { ...(o.melee || {}) }, owned: Array.isArray(o.owned) ? o.owned.filter((k) => MELEE_WEAPONS[k]) : [] };
  return cache;
}
export const perfil = () => cache || load();
export function guardar() { try { localStorage.setItem(KEY, JSON.stringify(perfil())); } catch { /* sin almacenamiento */ } }
/** Datos que recibe la simulación al empezar una partida con este Huésped. */
export const paraPartida = (char) => { const p = perfil(); return { melee: p.melee[char] || undefined, evo: p.evo[char] || 0 }; };
/** Al terminar (o pasar de oleada): guarda núcleos ganados y el nivel de evolución alcanzado. */
export function cerrarPartida(char, jugador) {
  if (!jugador) return; const p = perfil();
  p.cores += Math.max(0, Math.floor(jugador.co || 0));
  p.evo[char] = Math.max(p.evo[char] || 0, jugador.evo || 0);
  guardar();
}
export const costeSiguiente = (char) => { const t = perfil().evo[char] || 0; return t >= 4 ? 0 : EVO_COST[t + 1]; };
export function evolucionar(char) {
  const p = perfil(), c = costeSiguiente(char); if (!CHARACTERS[char] || !c || p.cores < c) return false;
  p.cores -= c; p.evo[char] = (p.evo[char] || 0) + 1; guardar(); return true;
}
export const posee = (id) => !MELEE_WEAPONS[id] ? false : MELEE_WEAPONS[id].cost === 0 || perfil().owned.includes(id);
export function comprarArma(id) {
  const w = MELEE_WEAPONS[id], p = perfil(); if (!w || posee(id) || p.cores < w.cost) return false;
  p.cores -= w.cost; p.owned.push(id); guardar(); return true;
}
export function equipar(char, id) { if (id && !posee(id)) return false; const p = perfil(); if (id) p.melee[char] = id; else delete p.melee[char]; guardar(); return true; }
