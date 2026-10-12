// Equipo del jugador: armas elegidas (5 ranuras), mejoras por oleada (tarjetas) y estadísticas efectivas de cada arma.
import { WEAPON_MUTS, WEAPONS, UPGRADE_KINDS, WEAPON_MODS } from './data.js';

export const DEFAULT_SLOTS = [0, 1, 2, 3, 4];
/** Ranuras válidas: 5 armas distintas; la ranura 0 es siempre el Haz (munición infinita, red de seguridad). */
export function cleanSlots(slots) {
  const out = [0];
  if (Array.isArray(slots)) for (const w of slots) if (Number.isInteger(w) && w > 0 && w < WEAPONS.length && !out.includes(w) && out.length < 5) out.push(w);
  for (const w of DEFAULT_SLOTS) if (out.length < 5 && !out.includes(w)) out.push(w);
  return out;
}
export const emptyUpg = () => ({ dmg: 0, rate: 0, mag: 0, mod: null, mut: null });
export const upgOf = (p, wid) => (p.upg[wid] ||= emptyUpg());
/** Estadísticas efectivas de un arma para un jugador. */
export function wstat(p, wid) {
  const u = p.upg[wid] || emptyUpg();
  return { dmg: 1 + 0.22 * u.dmg, rate: 1 + 0.14 * u.rate, mag: 1 + 0.3 * u.mag, mod: u.mod, mut: u.mut };
}
export const ammoMax = (p, wid) => { const w = WEAPONS[wid]; return w.max === Infinity ? Infinity : Math.ceil(w.max * wstat(p, wid).mag); };
export const modsFor = (wid) => Object.keys(WEAPON_MODS).filter((m) => !((m === 'precision' || m === 'toxica') && WEAPONS[wid].kind !== 'hitscan') && !(m === 'precision' && WEAPONS[wid].pellets > 3) && !(m === 'perfora' && (WEAPONS[wid].pierce)) && !(m === 'cadena' && WEAPONS[wid].chain) && !(m === 'explosiva' && WEAPONS[wid].splash));

/** Tres tarjetas para el jugador: [{w, k:'dmg'|'rate'|'mag'|'mod', mod?}] */
export function makeCards(g, p) {
  const cards = [], tries = 40;
  const wl = p.slots.slice();
  // evolución de 2.º nivel: con una mutación elegida y algo de práctica, el arma ofrece dos ramas excluyentes
  const elig = wl.filter((w) => { const u = p.upg[w]; return u && u.mod && !u.mut && u.dmg + u.rate >= 2 && WEAPON_MUTS[u.mod]; });
  if (elig.length && g.rng.next() < 0.6) { const w = g.rng.pick(elig), br = WEAPON_MUTS[p.upg[w].mod]; for (const b of br) cards.push({ w, k: 'mut', mod: p.upg[w].mod, mut: b.id }); }
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
  if (c.k === 'mut') u.mut = c.mut; else if (c.k === 'mod') u.mod = c.mod; else u[c.k] = Math.min(UPGRADE_KINDS[c.k].max, u[c.k] + 1);
  if (c.k === 'mag') { const w = WEAPONS[c.w]; if (w.max !== Infinity) p.ammo[c.w] = Math.min(ammoMax(p, c.w), p.ammo[c.w] + Math.ceil(w.max * 0.3)); }
}
/** Texto corto de una tarjeta (menú) */
export function cardText(c) {
  const w = WEAPONS[c.w]; if (c.k === 'mut') return `${w.name}: ${WEAPON_MUTS[c.mod].find((b) => b.id === c.mut).name}`; return c.k === 'mod' ? `${w.name}: ${WEAPON_MODS[c.mod].name}` : `${w.name}: ${UPGRADE_KINDS[c.k].name}`;
}

/** Aplica a un disparo las mutaciones del arma (nivel 1 y rama de nivel 2). Modifica y devuelve `w`. */
export function shapeWeapon(w, st) {
  const m = st.mod, x = st.mut;
  if (m === 'precision') { w.spread = (w.spread || 0) * 0.4; w.critP = x === 'ojo' ? 0.3 : 0.15; w.critRefund = x === 'pulso'; }
  if (m === 'toxica') w.poison = Math.max(w.poison || 0, 9);
  if (x === 'espina') { w.dmg *= 1.3; w.armorBreak = true; }
  if (x === 'aguijon') { w.dmg *= 0.8; w.poison = Math.max(w.poison || 0, 10); }
  if (m === 'explosiva') { w.blast = x === 'detonante' ? 4.6 : 2.6; if (x === 'implosiva') w.pull = 7; }
  if (m === 'cadena') { w.chain = Math.max(w.chain || 0, x === 'sinapsis' ? 4 : 2); if (x === 'tormenta') w.stormSlow = true; }
  return w;
}
export const anyMut = (p, id) => Object.values(p.upg).some((u) => u && u.mut === id);

/** Cargadores: balas por cargador de un arma (según su cadencia: lo rápido tiene cargador grande) y tiempo de recarga. */
export const clipOf = (p, wid) => { const w = WEAPONS[wid]; const base = w.clip || Math.max(3, Math.min(40, Math.round(4 / w.rate))); return Math.max(1, Math.round(base * (1 + 0.15 * ((p.upg[wid] || {}).mag || 0)))); };
export const reloadTime = (p, wid) => { const w = WEAPONS[wid]; return w.reload || Math.min(2.2, 1.0 + 0.025 * clipOf(p, wid)); };
