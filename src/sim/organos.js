// Evolución orgánica: esencias absorbidas de las criaturas → órganos que crecen en las armas (3 por arma) y en el campeón (1 + nivel). Contrato: docs/EVOLUCION.md
import { WEAPONS, WEAPON_ORGANS, CHAMP_ORGANS, WEAPON_ORGAN_SLOTS, champOrganSlots, ESSENCE_OF, ESS_YIELD } from './data.js';

export const ESS_KEYS = ['carne', 'cristal', 'ojo', 'vacio'];
export function initOrgans(p) { p.ess = p.ess || { carne: 0, cristal: 0, ojo: 0, vacio: 0 }; p.worg = p.worg || {}; p.corg = p.corg || []; p.jumpMul = 1; p.organReq = null; }
export const wOrgans = (p, wid) => (p.worg && p.worg[wid]) || [];
export const hasW = (p, wid, id) => wOrgans(p, wid).includes(id);
export const hasC = (p, id) => !!(p.corg && p.corg.includes(id));
export const anyW = (p, id) => !!p.worg && Object.values(p.worg).some((l) => l.includes(id));

const canPay = (p, cost) => Object.entries(cost).every(([k, n]) => (p.ess[k] || 0) >= n);
const pay = (p, cost) => { for (const [k, n] of Object.entries(cost)) p.ess[k] -= n; };

/** ¿Se puede colocar este órgano? Devuelve '' si sí, o el motivo. */
export function organError(p, target, wid, id) {
  if (target === 'w') {
    const O = WEAPON_ORGANS[id], W = WEAPONS[wid]; if (!O || !W) return 'órgano o arma inexistente';
    const cur = wOrgans(p, wid);
    if (cur.length >= WEAPON_ORGAN_SLOTS) return 'el arma no tiene más lugar';
    if (cur.includes(id)) return 'ya lo tiene';
    if (cur.some((x) => WEAPON_ORGANS[x].group === O.group)) return 'ya tiene un órgano del mismo tipo (hay que elegir)';
    if (O.only && !O.only.includes(W.kind)) return 'no es compatible con esta arma';
    return '';
  }
  const O = CHAMP_ORGANS[id]; if (!O) return 'órgano inexistente';
  if (p.corg.length >= champOrganSlots(p.evo)) return 'sin lugar: evolucioná al campeón para abrir otro espacio';
  if (p.corg.includes(id)) return 'ya lo tiene';
  return '';
}
function put(p, target, wid, id) { if (target === 'w') (p.worg[wid] ||= []).push(id); else p.corg.push(id); }
/** Compra con esencias. */
export function buyOrgan(g, p, target, wid, id) {
  if (p.dead || organError(p, target, wid, id)) return false;
  const cost = (target === 'w' ? WEAPON_ORGANS[id] : CHAMP_ORGANS[id]).cost; if (!canPay(p, cost)) return false;
  pay(p, cost); put(p, target, wid, id); g.emit({ t: 'organ', pid: p.id, target, w: wid, id });
  return true;
}
/** Carga desde el perfil (sin costo, con las mismas reglas). */
export function loadOrgans(p, { worg, corg, ess } = {}) {
  if (ess && typeof ess === 'object') for (const k of ESS_KEYS) if (ess[k] > 0) p.ess[k] = Math.min(999, Math.floor(ess[k]));
  if (worg && typeof worg === 'object') for (const [w, list] of Object.entries(worg)) if (Array.isArray(list)) for (const id of list) if (!organError(p, 'w', +w, id)) put(p, 'w', +w, id);
  if (Array.isArray(corg)) for (const id of corg) if (!organError(p, 'c', 0, id)) put(p, 'c', 0, id);
}
/** Esencia absorbida al matar. */
export function absorb(p, m) { const k = ESSENCE_OF[m.kind]; if (k) p.ess[k] += (m.def.boss ? ESS_YIELD.boss : m.elite ? ESS_YIELD.elite : ESS_YIELD.normal) * (p.bn ? p.bn.ess : 1); }

/** Efectos de los órganos de un arma sobre el disparo. */
export function shapeOrgans(w, p, wid) {
  const L = wOrgans(p, wid); if (!L.length) return w;
  if (L.includes('ojo_compuesto')) { w.spread = (w.spread || 0) * 0.4; w.critP = Math.max(w.critP || 0, 0.18); }
  if (L.includes('espina_cristal')) w.pierce = true;
  if (L.includes('nervio_conductor')) w.chain = Math.max(w.chain || 0, 2);
  if (L.includes('saco_gravitatorio')) w.pullHit = 6;
  if (L.includes('vesicula_acida')) w.burn = Math.max(w.burn || 0, 10);
  if (L.includes('camara_esporas')) w.poison = Math.max(w.poison || 0, 10);
  if (L.includes('glandula_vital')) w.lifesteal = Math.max(w.lifesteal || 0, 0.08);
  return w;
}
/** Multiplicadores del arma (se suman a las mejoras por tarjetas). */
export function organMuls(p, wid) { const L = wOrgans(p, wid); return { dmg: L.includes('glandula_osea') ? 1.2 : 1, rate: L.includes('corazon_doble') ? 1.25 : 1, clip: L.includes('musculo_cargador') ? 1.4 : 1, reload: L.includes('musculo_cargador') ? 0.75 : 1 }; }

/** Efectos del campeón que se calculan cada tick. */
export function champTick(g, p, dt) {
  p.spdMul *= hasC(p, 'adrenal') ? 1.08 : 1;
  p.jumpMul = hasC(p, 'saco_g') ? 1.25 : 1;
  if (hasC(p, 'medula') && !p.dead && g.time - p.lastHurt > 3) p.hp = Math.min(100, p.hp + 1.5 * dt);
  if (hasC(p, 'ojo_extra')) for (const m of g.monsters) if (m.cloak && Math.hypot(m.pos.x - p.pos.x, m.pos.y - p.pos.y, m.pos.z - p.pos.z) < 30) { m.cloak = false; m.reveal = 1; }
  const rq = p.input && p.input.organ; if (rq && rq !== p.organDone) { buyOrgan(g, p, rq.t, rq.w, rq.id); p.organDone = rq; }
  if (!rq) p.organDone = null;
}
export const orgSnap = (p) => ({ ess: ESS_KEYS.map((k) => Math.floor(p.ess[k])), wg: p.slots.map((w) => wOrgans(p, w)), cg: p.corg, cs: champOrganSlots(p.evo) });
