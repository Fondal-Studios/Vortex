// Equipo del jugador: armas elegidas (5 ranuras), mejoras por oleada (tarjetas) y estadísticas efectivas de cada arma.
import { WEAPONS, UPGRADE_KINDS, WEAPON_MODS } from './data.js';

export const DEFAULT_SLOTS = [0, 1, 2, 3, 4];
/** Ranuras válidas: 5 armas distintas; la ranura 0 es siempre el Haz (munición infinita, red de seguridad). */
export function cleanSlots(slots) {
  const out = [0];
  if (Array.isArray(slots)) for (const w of slots) if (Number.isInteger(w) && w > 0 && w < WEAPONS.length && !out.includes(w) && out.length < 5) out.push(w);
  for (const w of DEFAULT_SLOTS) if (out.length < 5 && !out.includes(w)) out.push(w);
  return out;
}
export const emptyUpg = () => ({ dmg: 0, rate: 0, mag: 0, mod: null });
export const upgOf = (p, wid) => (p.upg[wid] ||= emptyUpg());
/** Estadísticas efectivas de un arma para un jugador. */
export function wstat(p, wid) {
  const u = p.upg[wid] || emptyUpg();
  return { dmg: 1 + 0.22 * u.dmg, rate: 1 + 0.14 * u.rate, mag: 1 + 0.3 * u.mag, mod: u.mod };
}
export const ammoMax = (p, wid) => { const w = WEAPONS[wid]; return w.max === Infinity ? Infinity : Math.ceil(w.max * wstat(p, wid).mag); };
export const modsFor = (wid) => Object.keys(WEAPON_MODS).filter((m) => !(m === 'perfora' && (WEAPONS[wid].pierce)) && !(m === 'cadena' && WEAPONS[wid].chain) && !(m === 'explosiva' && WEAPONS[wid].splash));

/** Tres tarjetas para el jugador: [{w, k:'dmg'|'rate'|'mag'|'mod', mod?}] */
export function makeCards(g, p) {
  const cards = [], tries = 40;
  const wl = p.slots.slice();
  for (let i = 0; i < tries && cards.length < 3; i++) {
    const w = g.rng.pick(wl), u = upgOf(p, w), r = g.rng.next();
    let c;
    if (r < 0.2 && !u.mod && modsFor(w).length) c = { w, k: 'mod', mod: g.rng.pick(modsFor(w)) };
    else { const k = g.rng.pick(['dmg', 'dmg', 'rate', 'rate', 'mag']); if (WEAPONS[w].max === Infinity && k === 'mag') continue; if (u[k] >= UPGRADE_KINDS[k].max) continue; c = { w, k }; }
    if (cards.some((x) => x.w === c.w && x.k === c.k)) continue;
    cards.push(c);
  }
  return cards;
}
export function applyCard(p, c) {
  const u = upgOf(p, c.w);
  if (c.k === 'mod') u.mod = c.mod; else u[c.k] = Math.min(UPGRADE_KINDS[c.k].max, u[c.k] + 1);
  if (c.k === 'mag') { const w = WEAPONS[c.w]; if (w.max !== Infinity) p.ammo[c.w] = Math.min(ammoMax(p, c.w), p.ammo[c.w] + Math.ceil(w.max * 0.3)); }
}
/** Texto corto de una tarjeta (menú) */
export function cardText(c) {
  const w = WEAPONS[c.w]; return c.k === 'mod' ? `${w.name}: ${WEAPON_MODS[c.mod].name}` : `${w.name}: ${UPGRADE_KINDS[c.k].name}`;
}
