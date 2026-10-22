import { refundUltimate } from './ultimate-cooldown.js';
// EFECTOS DE LOS OBJETOS EN LA PARTIDA (docs/INVENTARIO.md). Todo determinista y sin DOM; NO usa g.rng ni g.drRng.
// El equipo entra por `opts.equip` de addPlayer (y `prof.equip` de setLoadout): lista de { s, id, q, k }. Aquí se valida (cleanEquip), se convierte en:
//   · multiplicadores fijos en p.bn (mismas claves que bendiciones y maestría; idempotente, siempre parte de ellas),
//   · p.ig  (arma de disparo puesta: modifica wstat/shapeWeapon del arma base),
//   · p.iw  (arma cuerpo a cuerpo puesta: la usa meleeSet y, si trae set propio, comboUnlocked),
//   · pasivos con condición (p.ipa) y sinergias (se activan al cumplirse la condición; cambian p.bn),
//   · maduración: cada baja suma a p.ik[ranura]; al cruzar un umbral el objeto sube de fase (bono y aspecto) y sale el evento `madura`.
import { PLAYER, WEAPONS } from './data.js';
import { v3, dist, clone, madd, norm, sub } from './math.js';
import { applyMaestria } from './maestria.js';
import { ITEMS, SLOTS, cleanEquip, itemStats, faseDe, pasivosActivos, foldStatic, capBn, rollMul, ADD_KEYS, ITEM_COMBO_SETS, ITEM_COMBO_WEAPON, setActivos } from './items.js';
import { cleanSlots } from './loadout.js';

const r2 = (n) => Math.round(n * 100) / 100;
/** Lo más que pueden sumar JUNTOS los bonos fijos de daño y los pasivos con condición de todo el equipo (el balance de los estilos no se rompe: tests/inventario.test.js). */
export const TOPE_DANIO = { melee: 1.12, gun: 1.07, skill: 1.12 };
const wIndex = (id) => WEAPONS.findIndex((w) => w.id === id);

/** Lista del equipo con las bajas VIVAS (las de antes + las de esta partida). */
export const liveList = (p) => (p.eqList || []).map((e) => ({ ...e, k: e.k + ((p.ik && p.ik[e.s]) || 0) }));

/** Pone el equipo de un jugador (limpia, valida y aplica). Se puede llamar muchas veces (idempotente). */
export function applyEquip(p, list, g = null) {
  p.eqList = cleanEquip(p.char, list === undefined ? p.eqList : list).map((e) => ({ ...e }));
  p.ik = {}; p.synMask = ''; p.ecoN = 0; p.killN = 0; p.racha = []; p.sombra = 0; p.itT = 0; p.regenT = 0;
  recompute(p, g);
}

/** Recalcula todo lo que sale del equipo a partir del estado actual (fases, sinergias). */
export function recompute(p, g = null) {
  applyMaestria(p, p.mastery || 1);                      // vuelve a bendiciones + maestría (sin equipo)
  const list = liveList(p);
  p.ig = null; p.iw = null; p.ipa = []; p.irng = 1; p.ix = baseIx();
  p.eqSnap = list.map((e) => `${e.id}.${faseDe(ITEMS[e.id], e.k)}`).join(',');
  if (!list.length) return;
  const fold = foldStatic(list);
  // sinergias activas (dependen de esencias, órganos, estilo y camino)
  const syn = activeSyn(p, list);
  const sets = setActivos(list); p.sets = sets.map((s) => `${s.set}${s.tier}`);
  for (const s of sets) for (const [k, v] of Object.entries(s.b.fx)) fold[k] = ADD_KEYS.includes(k) ? (fold[k] || 0) + v : (fold[k] ?? 1) * v;   // bonos de 2 y 4 piezas
  for (const s of syn) for (const [k, v] of Object.entries(s.fx)) fold[k] = ADD_KEYS.includes(k) ? (fold[k] || 0) + v : (fold[k] ?? 1) * v;
  capBn(fold); p.ifold = fold;
  for (const [k, v] of Object.entries(fold)) p.bn[k] = ADD_KEYS.includes(k) ? (p.bn[k] || 0) + v : (p.bn[k] ?? 1) * v;
  for (const s of sets) for (const pa of s.b.pa || []) p.ipa.push({ id: pa.id, v: pa.v, s: 'set' });
  for (const e of list) {
    const it = ITEMS[e.id], fase = faseDe(it, e.k), wm = rollMul(e.q) * (1 + 0.02 * fase);
    for (const pa of pasivosActivos(e)) p.ipa.push({ id: pa.id, v: pa.v, s: e.s });
    if (it.g) { const wid = wIndex(it.g.base); if (wid > 0) p.ig = { wid, dmg: 1 + (it.g.dmg - 1) * wm, rate: 1 + (it.g.rate - 1) * wm, mag: 1 + (it.g.mag - 1) * wm, fx: it.g.fx || {}, id: it.id }; }
    if (it.m) p.iw = { id: it.id, fase, wm, set: null };
    if (it.ranged) p.irng = 1 + (it.ranged - 1) * wm;
  }
  ensureGunSlot(p);
  for (const pa of p.ipa) { const ix = p.ix; if (pa.id === 'cazador_elite') ix.elite *= 1 + pa.v; else if (pa.id === 'presa') ix.presa = Math.max(ix.presa, pa.v); else if (pa.id === 'verdugo') ix.verdugo = Math.max(ix.verdugo, pa.v); else if (pa.id === 'regen') ix.regen += pa.v; else if (pa.id === 'savia') ix.savia += pa.v; else if (pa.id === 'fervor') ix.fervor += pa.v; else if (pa.id === 'espinas') ix.espinas = Math.max(ix.espinas, pa.v); else if (pa.id === 'drenaje') ix.drenaje += pa.v; else if (pa.id === 'sombra') ix.sombra = Math.max(ix.sombra, pa.v); else if (pa.id === 'eco_golpe') ix.eco = Math.max(ix.eco, pa.v); else if (pa.id === 'onda') ix.onda = ix.onda ? Math.min(ix.onda, pa.v) : pa.v; else if (pa.id === 'siembra') ix.siembra = Math.max(ix.siembra, pa.v); }
  void g;
}
/** El arma de disparo de un objeto ocupa la última ranura si no estaba entre las elegidas. */
export function ensureGunSlot(p) { if (p.ig && !p.slots.includes(p.ig.wid)) p.slots = cleanSlots([...p.slots.slice(0, 4), p.ig.wid]); }
const baseIx = () => ({ elite: 1, presa: 0, verdugo: 0, regen: 0, savia: 0, fervor: 0, espinas: 0, drenaje: 0, sombra: 0, eco: 0, onda: 0, siembra: 0 });

/** Sinergias cuya condición se cumple ahora. */
function activeSyn(p, list) {
  const out = [], organs = (p.corg ? p.corg.length : 0) + (p.worg ? Object.values(p.worg).reduce((a, l) => a + l.length, 0) : 0);
  const estilo = p.mode === 'combo' ? 'combo' : p.style || '';
  for (const e of list) for (const s of ITEMS[e.id].syn) {
    let ok = false;
    if (s.t === 'ess') ok = !!p.ess && (p.ess[s.k] || 0) >= s.n;
    else if (s.t === 'organ') ok = organs >= s.n;
    else if (s.t === 'estilo') ok = estilo === s.k;
    else if (s.t === 'camino') ok = !!p.path && p.path.includes(s.k);
    if (ok) out.push(s);
  }
  return out;
}
const synMask = (p) => { const list = liveList(p); return activeSyn(p, list).map((s) => `${s.t}${s.k}${s.n || ''}`).join('|'); };

/* ───────── arma de disparo ───────── */
/** Suma al disparo los efectos del arma de disparo puesta (si el arma que se dispara es la suya). */
export function shapeItemGun(w, p, wid) {
  const G = p.ig; if (!G || G.wid !== wid) return w;
  const fx = G.fx, ph = 1;
  if (fx.pierce) w.pierce = true;
  if (fx.chain) w.chain = Math.max(w.chain || 0, fx.chain);
  if (fx.burn) w.burn = Math.max(w.burn || 0, fx.burn * ph);
  if (fx.poison) w.poison = Math.max(w.poison || 0, fx.poison * ph);
  if (fx.slow) w.slow = Math.max(w.slow || 0, fx.slow);
  if (fx.lifesteal) w.lifesteal = Math.max(w.lifesteal || 0, fx.lifesteal);
  if (fx.spreadMul) w.spread = (w.spread || 0) * fx.spreadMul;
  if (fx.critP) w.critP = Math.max(w.critP || 0, fx.critP);
  return w;
}

/* ───────── arma cuerpo a cuerpo ───────── */
/** Arma cuerpo a cuerpo del objeto, con la forma de meleeSet (huespedes.js), o null si no hay. */
export function itemMeleeSet(p) {
  const I = p.iw; if (!I) return null; if (I.set) return I.set;
  const it = ITEMS[I.id], m = it.m, k = I.wm, sc = (d) => ({ ...d, dmg: Math.round(d.dmg * k * 10) / 10 });
  return (I.set = { light: sc(m.light), heavy: sc(m.heavy), type: m.type, special: m.special || null, id: '', item: true, iw: I.id, aff: true, dual: m.dual || 0, exec: m.exec || 0, combo: m.combo || null });
}
/** Set de combos propio del arma puesta (o null: se usa el del Huésped). */
export const itemComboSet = (p) => { const M = p.iw && itemMeleeSet(p); return M && M.combo ? ITEM_COMBO_SETS[M.combo] || null : null; };
export const itemComboShape = (type) => ITEM_COMBO_WEAPON[type] || null;
/** Umbral de ejecución (fracción de vida) de este jugador: 0,18 de siempre; las guadañas y el Verdugo lo suben. */
export function execThreshold(p) { const M = p.iw && itemMeleeSet(p); return Math.max(0.18, M ? M.exec || 0 : 0, p.ix ? p.ix.verdugo : 0); }
/** Se llama una vez por golpe cuerpo a cuerpo (ligero, pesado o de combo): devuelve { mul, onda } (el Eco sube el golpe; la Onda lanza una cuchillada). */
export function itemStrike(p) {
  const ix = p.ix; if (!ix) return { mul: 1, onda: false };
  p.ecoN = (p.ecoN || 0) + 1; p.waveN = (p.waveN || 0) + 1;
  return { mul: ix.eco && p.ecoN % 5 === 0 ? 1 + ix.eco : 1, onda: !!ix.onda && p.waveN % ix.onda === 0 };
}

/* ───────── ganchos de daño ───────── */
/** Multiplicador de daño que aportan los pasivos con condición (se suma a hostOut). */
export function itemOut(g, p, m, src) {
  const ix = p.ix; if (!ix || !p.ipa.length) return 1;
  let k = 1;
  for (const pa of p.ipa) {
    if (pa.id === 'ultimo_aliento' && p.hp < PLAYER.hp * 0.35 && (src === 'melee' || src === 'gun')) k *= 1 + pa.v;
    else if (pa.id === 'escudo_pleno' && p.shield >= PLAYER.shield - 0.5) k *= 1 + pa.v;
    else if (pa.id === 'furia' && p.ultT > 0) k *= 1 + pa.v;
  }
  if (p.racha && p.racha.length) { const n = Math.min(5, p.racha.filter((t) => g.time - t < 5).length); if (n) for (const pa of p.ipa) if (pa.id === 'racha') k *= 1 + pa.v * n; }
  if (m && (m.elite || (m.def && m.def.boss))) k *= ix.elite;
  const st = p.ifold && (src === 'melee' || src === 'gun' || src === 'skill') ? p.ifold[src] || 1 : 1;
  k = Math.min(k, (TOPE_DANIO[src] || 1.1) / st);   // tope: bonos fijos de los objetos × pasivos con condición ≤ TOPE_DANIO
  if (ix.presa && m && m.hp >= m.maxhp * 0.999 && g.time >= (m.markUntil || 0)) { m.markUntil = g.time + 4; m.markMul = Math.max(m.markMul || 1, 1 + ix.presa); }
  return k;
}
/** Daño recibido: Sombra lo reduce tras una baja; las Espinas devuelven una parte. Devuelve el daño final. */
export function itemDamageIn(g, p, dmg) {
  const ix = p.ix; if (!ix) return dmg;
  if (ix.sombra && g.time < p.sombra) dmg *= 1 - ix.sombra;
  if (ix.espinas && dmg > 0) {
    const back = Math.min(40, dmg * ix.espinas), s0 = g.dmgSrc; g.dmgSrc = 'skill';
    try { for (const m of g.monsters) if (!m.dead && dist(m.pos, p.pos) < 5 + m.r) g.damageMonster(m, back, p, m.pos); } finally { g.dmgSrc = s0; }
  }
  p.regenT = 0;
  return dmg;
}
/** Tras un impacto real. */
export function itemHit(g, p, m, dealt) {
  const ix = p.ix; if (!ix) return;
  if (ix.drenaje && p.inMelee && !p.dead && dealt > 0) p.hp = Math.min(PLAYER.hp, p.hp + dealt * ix.drenaje);
}
/** Una baja. `viaMelee`: la dio un golpe cuerpo a cuerpo. */
export function itemKill(g, p, m) {
  if (!p.eqList || !p.eqList.length) return;
  const ix = p.ix, melee = !!p.inMelee, gun = !melee && g.dmgSrc !== 'skill';
  let grew = false;
  for (const e of p.eqList) {
    const it = ITEMS[e.id]; if (!(it.via === 'any' || (it.via === 'melee' && melee) || (it.via === 'gun' && gun))) continue;
    const before = faseDe(it, e.k + (p.ik[e.s] || 0)); p.ik[e.s] = (p.ik[e.s] || 0) + 1;
    const after = faseDe(it, e.k + p.ik[e.s]);
    if (after > before) { grew = true; g.emit({ t: 'madura', pid: p.id, s: e.s, id: e.id, fase: after, p: [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)] }); }
  }
  if (p.racha) { p.racha.push(g.time); if (p.racha.length > 8) p.racha.shift(); }
  if (ix.savia && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + ix.savia);
  if (ix.fervor) refundUltimate(p, ix.fervor * .2);
  if (ix.sombra) p.sombra = g.time + 2;
  if (ix.siembra) { p.killN = (p.killN || 0) + 1; if (p.killN % 6 === 0) g.addObject('spores', clone(m.pos), { owner: p.id, life: 3, r: ix.siembra }); }
  if (grew) recompute(p, g);
}
/** Cada tick: regeneración, sinergias (cada 0,5 s). */
export function itemTick(g, p, dt) {
  if (!p.eqList || !p.eqList.length) return;
  const ix = p.ix;
  if (ix.regen && !p.dead) { p.regenT += dt; if (p.regenT > 3 && p.hp < PLAYER.hp) p.hp = Math.min(PLAYER.hp, p.hp + ix.regen * dt); }
  p.itT += dt;
  if (p.itT >= 0.5) { p.itT = 0; const mk = synMask(p); if (mk !== p.synMask) { p.synMask = mk; recompute(p, g); } }
}

/* ───────── snapshot ───────── */
/** Campos del jugador para el cliente: `eq` (cadena «id.fase,…» → aspecto), `ik` (bajas de la partida por ranura → maduración), `pt` (pity), `bag` (botín, sólo al terminar). */
export function itemsSnap(g, p) {
  const o = {};
  if (p.eqList && p.eqList.length) { o.eq = p.eqSnap; if (p.sets && p.sets.length) o.st4 = p.sets; o.ik = p.ik; if (p.iw) o.iw = p.iw.id; if (p.ig) o.ig = p.ig.id; }
  if (p.pity) o.pt = [p.pity.l, p.pity.e];
  if (p.sigMet) o.sg = 1;
  if (g.state !== 'playing' && p.bag && p.bag.length) o.bag = p.bag.map((b) => `${b.id}|${b.q}|${b.n || 1}`);
  return o;
}
void v3; void norm; void sub; void madd; void SLOTS;
