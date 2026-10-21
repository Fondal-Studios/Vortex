// Los Huéspedes: melee, 3 habilidades, definitiva y pasiva de cada uno. Todo determinista y sin DOM. Contrato: docs/HUESPEDES.md
import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, clone } from './math.js';
import { CHARACTERS, PLAYER, MELEE_WEAPONS, MELEE_AFFINITY, EVO_COST, EVO_PATHS, evoPathsFor, CORES, STYLES, STYLE_NEUTRAL } from './data.js';
import { blocked } from './physics.js';
import { initOrgans, champTick, absorb, hasC } from './organos.js';
import { floraMelee } from './flora.js';   // flora interactiva (circular a propósito: sólo se usa dentro de funciones)
import { arMelee } from './arenas-vivas.js';   // arenas vivas (circular a propósito: sólo se usa dentro de funciones)
import { initCombo, comboStep, comboSnap } from './combos.js';
import { dzTick, dzSpd, dzGuard, dzOut, dzBits, dzPirueta, dzParada, dzCintas } from './danzante.js';   // Danzante: paradas/esquivas perfectas y compás (src/sim/danzante.js)
import { singularTick, singularMove, singularSpecial, singularReflujo, singularUlt, singularObject, singularOut, singularKill, singularSnap } from './singular.js';   // Singular: pozos, satélites y Horizonte (src/sim/singular.js)
import { enjambreTick, enjambreObject, enjambreOut, enjambreIn, enjambreKill, enjambreSkill, enjambreSnap } from './enjambre.js';   // Colmena: zánganos, nidos y la Reina (src/sim/enjambre.js)
import { faunaSpd, faunaJump, faunaOut, faunaDamageIn, faunaHit, faunaMelee } from './fauna.js';   // fauna consumible: metamorfosis temporal (src/sim/fauna.js, docs/FAUNA.md)
import { MODO_K } from './modos.js';   // Melé: HAB.1 y HAB.2 no suman el ×1,5 de habilidad del estilo Combo (sólo la principal)
import { progStep } from './progresion.js';   // progresión permanente: multi-kills y rango de estilo (docs/EVOLUCION.md)
import { itemOut, itemDamageIn, itemHit, itemKill, itemTick, itemMeleeSet, execThreshold, itemStrike } from './items-fx.js';   // objetos equipados (docs/INVENTARIO.md)   // modo Combo (circular a propósito: sólo se usan dentro de funciones)

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
export const BF = { guard: 1, cloak: 2, over: 4, frenzy: 8, flora: 16, meta: 32, desfase: 64, glide: 128, barrier: 256, swarm: 512 };
export const ULT_DUR = { marabunta: 10, sobrecarga: 10, frenesi: 8, floracion: 12, colapso: 6, metamorfosis: 12, supernova: 9, danza: 10 };
const DEFAULT_MELEE = { light: { dmg: 40, range: 3.4, arc: 0.5, cd: 0.4 }, heavy: { dmg: 115, range: 4.2, arc: 0.45, cd: 0.95, knock: 12 } };
const HOLD_HEAVY = 0.42;     // s manteniendo melee → golpe pesado
const COMBO_WINDOW = 0.95;   // s para encadenar el siguiente golpe ligero
const ULT_PER_DMG = 0.08, ULT_PER_KILL = 2.5;

export const cdef = (p) => (p.char ? CHARACTERS[p.char] : null);
export const isHost = (p) => !!(cdef(p) && cdef(p).host);
const flat = (p) => norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading);

export function initHost(p) {
  Object.assign(p, { s3Cd: 0, ul: 0, ultT: 0, ultId: '', meleeCd: 0, meleeHold: 0, meleePrev: false, s3Prev: false, ultPrev: false, cmb: 0, cmbT: 0, slam: 0, buf: 0,
    guardUntil: 0, cloakUntil: 0, cloakBonus: false, desfaseUntil: 0, glideUntil: 0, callo: 0, calloT: 0, adapt: {}, spdMul: 1, symb: null, regen: 0, evo: p.evo || 0, path: Array.isArray(p.path) ? p.path : [], melee: p.melee || '', cores: p.cores || 0, evoPrev: 0 }); initOrgans(p); initCombo(p);
}

/* ───────── pasos por tick ───────── */
export function updateHost(g, p, dt) {
  const C = cdef(p), inp = p.input;
  if (inp.evo && !p.evoPrev) evolve(g, p, inp.evo - 1); p.evoPrev = inp.evo;
  p.s3Cd = Math.max(0, p.s3Cd - dt); p.meleeCd = Math.max(0, p.meleeCd - dt);
  if (p.cmbT > 0) { p.cmbT -= dt; if (p.cmbT <= 0) p.cmb = 0; }
  if (p.calloT > 0) { p.calloT -= dt; if (p.calloT <= 0) p.callo = 0; }
  if (p.cloakUntil && g.time >= p.cloakUntil) { p.cloakUntil = 0; p.cloakBonus = false; }
  // definitiva activa
  if (p.ultT > 0) {
    p.ultT -= dt;
    if (p.ultId === 'sobrecarga') p.cd -= dt * 0.6;                       // +60 % cadencia
    if (p.ultId === 'floracion' || p.ultId === 'colapso') zoneTick(g, p, dt);
    if (p.ultId === 'colapso') { /* la singularidad vive como objeto */ }
    if (p.ultT <= 0) { g.emit({ t: 'ultend', pid: p.id, id: p.ultId }); p.ultId = ''; p.ultT = 0; }
  }
  p.spdMul = (C ? C.speed || 1 : 1) * (p.ultId === 'sobrecarga' ? 1.35 : 1) * (g.time < p.cloakUntil ? 1.1 : 1) * (hasPath(p, 'velocidad') ? 1.12 : 1) * (p.bn ? p.bn.spd : 1) * (g.time < (p.frenzyUntil || 0) ? 1.3 : 1);
  champTick(g, p, dt); itemTick(g, p, dt);
  p.spdMul *= faunaSpd(g, p); p.jumpMul *= faunaJump(g, p);   // metamorfosis de fauna: velocidad y salto de la forma activa
  if (p.char === 'colmena') enjambreTick(g, p, dt);   // Colmena: Cría viva, Marabunta, Nidos vivos y la Reina
  if (p.char === 'singular') singularTick(g, p, dt);   // Singular: satélites que giran y golpean, estado de la Marea
  if (p.char === 'danzante') { p.spdMul *= dzSpd(g, p); dzTick(g, p, dt); }   // Danzante: Danza Macabra (+25 % vel.), ventanas de parada/esquiva y compás
  if (C && C.host) {
    if (inp.s3 && !p.s3Prev && !g.evSilencio) useS3(g, p); p.s3Prev = inp.s3;
    if (inp.ult && !p.ultPrev && !g.evSilencio) useUlt(g, p); p.ultPrev = inp.ult;
  }
  // aterrizaje del golpe descendente
  if (p.slam) {
    p.slam -= dt;
    if (p.grounded) { slamLand(g, p); p.slam = 0; } else if (p.slam <= 0) p.slam = 0;
  }
  if (C && C.host) progStep(g, p, dt);   // cuenta bajas / multi-kills / rango de estilo (src/sim/progresion.js)
  if (p.mode === 'combo') comboStep(g, p, dt); else meleeStep(g, p, dt);   // Combo: A1/A2 (src/sim/combos.js); Shooter: melee V de siempre
}

/* ───────── melee ───────── */
function meleeStep(g, p, dt) {
  const inp = p.input, M = meleeSet(p);
  if (inp.melee) { p.meleeHold += dt; }
  const rel = !inp.melee && p.meleePrev;
  p.meleePrev = inp.melee;
  if (rel) { p.buf = 0.18; p.bufHeavy = p.meleeHold >= HOLD_HEAVY; p.meleeHold = 0; }
  if (!inp.melee && !rel) p.meleeHold = 0;
  if (p.buf > 0) {
    p.buf -= dt;
    if (p.meleeCd <= 0 && !p.carry) { p.buf = 0; strike(g, p, M, p.bufHeavy); }
  }
}

/** Arma cuerpo a cuerpo efectiva: la equipada (si existe) o la innata del Huésped. */
export function meleeSet(p) {
  const IW = p.iw && itemMeleeSet(p); if (IW) return IW;   // un arma cuerpo a cuerpo de objeto pisa a la fusionada
  const C = cdef(p), W = MELEE_WEAPONS[p.melee];
  if (W) return { light: W.light, heavy: W.heavy, type: W.type, special: W.special, id: p.melee, aff: !!(C && (MELEE_AFFINITY[p.char] || []).includes(W.type)) };
  return { ...((C && C.melee) || DEFAULT_MELEE), type: 'innata', special: null, id: '', aff: true };
}
export const hasPath = (p, id) => !!(p.path && p.path.includes(id));
export const evoMeleeMul = (p) => (1 + (hasPath(p, 'depredador') ? 0.2 : 0) + (hasPath(p, 'simbiosis') ? 0.15 : 0) + (hasPath(p, 'apoteosis') ? 0.1 : 0));
export const cdMul = (p) => ((p.bn ? p.bn.cd : 1)) * ((STYLES[p.style] || STYLE_NEUTRAL).cd) * (hasPath(p, 'velocidad') ? 0.85 : 1) * (hasC(p, 'adrenal') ? 0.92 : 1);
export const evoCost = (p) => ((p.evo || 0) >= 4 ? 0 : EVO_COST[(p.evo || 0) + 1]);
/** Gasta núcleos para subir un nivel de evolución. */
/** Sube un nivel ELIGIENDO uno de los dos caminos (pick = 0 o 1). El otro queda cerrado para siempre. */
export function evolve(g, p, pick = 0) {
  const c = evoCost(p); if (!c || p.cores < c || p.dead) return false;
  const opts = evoPathsFor(p.char)[p.evo + 1]; if (!opts) return false;   // cada Huésped puede tener sus propios caminos (Colmena)
  const chosen = opts[pick === 1 ? 1 : 0];
  p.cores -= c; p.evo++; p.path.push(chosen.id);
  g.emit({ t: 'evolve', pid: p.id, tier: p.evo, path: chosen.id, p: a3(p.pos) });
  return true;
}
export function addCores(g, p, n) { if (!p || n <= 0) return; p.cores += Math.round(n * (p.bn ? p.bn.cores : 1)); }

function strike(g, p, M, heavy) {
  const air = !p.grounded && p.pitch < -0.45;
  const def = heavy ? M.heavy : M.light;
  const over = p.ultId === 'sobrecarga', meta = p.ultId === 'metamorfosis';
  let dmg = def.dmg * evoMeleeMul(p) * (M.aff ? 1.15 : 1) * (hasC(p, 'tentaculo') ? 1.1 : 1) * (g.evMeleeMul || 1), range = def.range * (meta ? 1.35 : 1) * (hasC(p, 'tentaculo') ? 1.2 : 1), arc = def.arc;
  const fused = M.special && ((p.evo || 0) >= 1 || M.item), strong = hasPath(p, 'simbiosis') ? 1.5 : 1;
  const IS = itemStrike(p), exT = execThreshold(p); dmg *= IS.mul * (M.dual && !heavy ? M.dual : 1);   // objetos: Eco, segunda hoja, umbral de ejecución
  let kind = heavy ? 'heavy' : 'light';
  const prevCmb = p.cmb, speed = len(sub(p.vel, mul(p.up, dot(p.vel, p.up))));
  if (!heavy) { p.cmb = p.cmb >= 3 ? 1 : p.cmb + 1; p.cmbT = COMBO_WINDOW; p.lastCmbN = p.cmb; p.lastLightT = g.time; if (p.cmb === 3) { dmg *= 1.5; } } else { p.cmb = 0; }
  // MOVIMIENTOS EXTRA: corriendo + golpe = estocada en carrera; 2 golpes + pesado = GIRO que pega a todo alrededor
  let lunge = false, spin = false;
  if (!heavy && speed > 12 && p.grounded) { lunge = true; kind = 'lunge'; dmg *= 1.3; range += 2; p.ext = madd(p.ext, flat(p), 26); }
  if (heavy && (prevCmb >= 2 || ((p.lastCmbN || 0) >= 2 && g.time - (p.lastLightT || -9) < 1.8))) { spin = true; kind = 'spin'; dmg *= 1.2; range += 1; }
  if (heavy) p.lastCmbN = 0;
  if (air) { kind = 'air'; p.slam = 3; p.vel = madd(p.vel, p.up, -42); dmg *= 1.2; }
  p.meleeCd = def.cd * (over ? 0.6 : 1);
  const o = g.eyePos(p), d = g.aimDir(p), dir0 = norm(d);
  let hits = 0;
  const cosT = meta || spin ? -1 : 1 - arc * (heavy ? 1.1 : 1);
  const targets = [];
  for (const m of g.monsters) {
    if (m.dead) continue;
    const to = sub(m.pos, o), l = len(to);
    if (l > range + m.r) continue;
    if (dot(norm(to), dir0) < cosT && l > m.r + 0.8) continue;
    targets.push([m, l]);
  }
  targets.sort((a, b) => a[1] - b[1]);
  const maxT = heavy || meta || spin || lunge || (fused && (M.special === 'barrido' || M.special === 'linea' || M.special === 'atraviesa')) ? 8 : 3;
  g.pierceNow = !!(M.light && M.light.pierce); p.inMelee = true;
  for (const [m] of targets.slice(0, maxT)) {
    // enemigos que reaccionan: el ariete bloquea de frente, el espejo esquiva, los pequeños contraatacan
    const facing = m.fwd ? dot(norm(sub(p.pos, m.pos)), m.fwd) : 0;
    let k = 1;
    if (m.kind === 'ariete' && facing > 0.6 && !g.pierceNow) { k = 0.35; g.emit({ t: 'block', id: m.id, p: a3(m.pos) }); }
    if (m.kind === 'espejo' && !m.dodged && g.rng.next() < 0.3) { m.dodged = true; m.slide = { v: mul(cross(m.up || p.up, dir0), 20), t: 0.15 }; g.emit({ t: 'dodge', id: m.id, p: a3(m.pos) }); continue; }   // esquiva: un deslizamiento de 0,15 s (visible, con colisión), no un salto
    if (!m.def.boss && m.hp <= m.maxhp * exT) { // ejecución contextual
      g.emit({ t: 'melee', pid: p.id, kind: 'exec', p: a3(m.pos), d: a3(dir0), hit: 1 });
      p.exec = true; g.damageMonster(m, m.hp + 1, p, m.pos); p.exec = false;
      if (!p.dead) { p.hp = Math.min(PLAYER.hp, p.hp + 10); }
      hits++; continue;
    }
    let dm = dmg * k;
    if (fused && M.special === 'acuchilla' && (m.fwd ? dot(norm(sub(p.pos, m.pos)), m.fwd) < 0.2 : false)) dm *= 2 * (strong > 1 ? 1.25 : 1);
    g.damageMonster(m, dm, p, m.pos); hits++;
    if (hasPath(p, 'depredador') && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + dm * 0.06);
    if (fused && !m.dead) applyMeleeSpecial(g, p, m, M.special, heavy, dm, strong);
    const kn = def.knock || (p.cmb === 3 ? 10 : 4);
    if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), kn);
    if (g.time > (m.counterAt || 0) && !m.def.boss && m.hp > 0 && len(sub(m.pos, p.pos)) < 4.5 && g.rng.next() < (m.elite ? 0.4 : 0.15)) { m.counterAt = g.time + 3; g.hurtPlayer(p, 8); g.emit({ t: 'counter', id: m.id, p: a3(m.pos) }); }
  }
  g.pierceNow = false;
  for (const ob of [...g.objects]) if (ob.hostile && ob.hp > 0 && dist(ob.pos, o) < range + ob.r && dot(norm(sub(ob.pos, o)), dir0) > cosT) { g.damageObject(ob, dmg, p, ob.pos); hits++; }
  hits += arMelee(g, o, range, dir0, cosT, dmg, p);   // órganos de la arena viva
  hits += floraMelee(g, o, range, dir0, cosT, dmg, p);   // plantas de la flora interactiva
  faunaMelee(g, p, o, dir0, range, heavy || p.cmb === 3);   // fauna: el REMATE (golpe pesado o 3.er golpe) devora al bicho de enfrente y suelta el golpe elemental
  if (fused) meleeAfter(g, p, M.special, heavy, dir0, o, dmg, strong);
  if (IS.onda) meleeAfter(g, p, 'onda', true, dir0, o, dmg, strong);
  p.inMelee = false;
  g.emit({ t: 'melee', pid: p.id, kind, p: a3(madd(o, dir0, 1.5)), d: a3(dir0), hit: hits, cmb: p.cmb, mw: M.id, sp: fused ? M.special : undefined, ...(M.item ? { iw: M.iw, hd: (p.hand = (p.hand || 0) ^ 1) } : {}) });
}

export function applyMeleeSpecial(g, p, m, sp, heavy, dealt, strong) {
  switch (sp) {
    case 'quema': m.dotUntil = g.time + 4; m.dotDps = 14 * strong; m.dotKind = 'burn'; m.dotBy = p.id; break;
    case 'sangrado': m.dotUntil = g.time + 5; m.dotDps = 11 * strong; m.dotKind = 'poison'; m.dotBy = p.id; break;
    case 'veneno': m.dotUntil = g.time + 5; m.dotDps = 9 * strong; m.dotKind = 'poison'; m.dotBy = p.id; break;
    case 'rapina': if (!p.dead) p.hp = Math.min(PLAYER.hp, p.hp + dealt * 0.08 * strong); break;
    case 'aturde': m.slowUntil = g.time + 2.5 * strong; if (!m.def.boss) m.vel = mul(m.vel, 0.2); break;
    case 'espora': g.addObject('spores', clone(m.pos), { owner: p.id, life: 3 * strong, r: 4.5 }); break;
    default: break;
  }
}
/** Efectos de la fusión que ocurren una vez por golpe (no por criatura). */
export function meleeAfter(g, p, sp, heavy, dir, o, dmg, strong) {
  if (sp === 'onda' && heavy) g.addProjectile({ owner: 'p', pid: p.id, kind: 'lanza', pos: madd(o, dir, 1.6), vel: mul(dir, 42), dmg: dmg * 0.5 * strong, splash: 0, r: 0.9, life: 0.7, pierce: true, hit: [] });
  if (sp === 'sismo' && heavy) {
    for (const m of g.monsters) { if (m.dead) continue; const d = dist(m.pos, p.pos); if (d < 7 + m.r) { g.damageMonster(m, dmg * 0.4 * strong, p, m.pos); if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), 12); } }
    g.emit({ t: 'boom', p: a3(p.pos), r: 7 });
  }
  if (sp === 'estocada' && heavy) p.ext = madd(p.ext, flat(p), 30);
  if (sp === 'destello' && heavy) { p.ext = madd(p.ext, flat(p), 46); p.invulUntil = Math.max(p.invulUntil, g.time + 0.3); g.emit({ t: 'blink', p: a3(p.pos) }); }
}

function slamLand(g, p) {
  let n = 0;
  for (const m of g.monsters) { if (m.dead) continue; const d = dist(m.pos, p.pos); if (d < 6.5 + m.r) { g.damageMonster(m, 95 * (1 - 0.4 * d / (6.5 + m.r)), p, m.pos); if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), 14); n++; } }
  g.emit({ t: 'melee', pid: p.id, kind: 'air', p: a3(p.pos), d: a3(mul(p.up, -1)), hit: n, land: true }); g.emit({ t: 'boom', p: a3(p.pos), r: 6.5 });
}

/* ───────── habilidades 1 y 2 de los nuevos ids (las llama characters.js) ───────── */
export function hostMove(g, p, id) {
  const h = flat(p);
  switch (id) {
    case 'zumbido': return enjambreSkill(g, p, id);   // Colmena
    case 'impulso': {
      p.ext = madd(p.ext, h, 40); p.invulUntil = Math.max(p.invulUntil, g.time + 0.3);
      for (const m of g.monsters) { if (m.dead) continue; const d = sub(m.pos, p.pos), t = dot(d, h); if (t < -1 || t > 11) continue; if (len(sub(d, mul(h, t))) < m.r + 2) { g.damageMonster(m, 55, p, m.pos); if (!m.def.boss) m.vel = madd(m.vel, h, 16); } }
      return true;
    }
    case 'barrera': {
      const pos = madd(madd(p.pos, h, 5.5), p.up, 1.6);
      for (const o of g.objects.filter((q) => q.type === 'wall' && q.owner === p.id).slice(1 - 2)) g.removeObject(o);
      g.addObject('wall', pos, { owner: p.id, life: 10, r: 4, hp: 1, up: clone(p.up), fwd: h });
      return true;
    }
    case 'planeo': {
      p.vel = madd(madd(p.vel, p.up, 13), h, 14); p.grounded = false; p.glideUntil = g.time + 2.2;
      return true;
    }
    case 'pirueta': return dzPirueta(g, p);
    case 'honda': return singularMove(g, p);
    default: return false;
  }
}
export function hostSpecial(g, p, id) {
  const o = g.eyePos(p), d = g.aimDir(p);
  switch (id) {
    case 'cria': return enjambreSkill(g, p, id);   // Colmena
    case 'espinas': {
      const right = cross(p.heading, p.up);
      for (const s of [-1, 0, 1]) {
        const dd = norm(add(d, mul(right, s * 0.04)));
        const end = g.hitscan(p, o, dd, { dmg: 70, range: 75, pierce: true });
        g.emit({ t: 'beam', pid: p.id, o: a3(o), to: a3(end), c: 'spine' });
      }
      return true;
    }
    case 'camuflaje': p.cloakUntil = g.time + 5; p.cloakBonus = true; return true;
    case 'esporas': {
      const pos = madd(p.pos, flat(p), 8);
      g.addObject('spores', pos, { owner: p.id, life: 6, r: 7 });
      return true;
    }
    case 'pulso': {
      let n = 0;
      for (const m of g.monsters) { if (m.dead) continue; const dd = dist(m.pos, p.pos); if (dd < 8 + m.r) { g.damageMonster(m, 36, p, m.pos); n++; } }
      p.hp = Math.min(PLAYER.hp, p.hp + 20 + Math.min(n, 5) * 4); p.shield = Math.min(PLAYER.shield, p.shield + 20); p.ul = Math.min(100, p.ul + 5 + n * 2);
      g.emit({ t: 'pulse', pid: p.id, p: a3(p.pos) });
      return true;
    }
    case 'parada': return dzParada(g, p);
    case 'pozo': return singularSpecial(g, p);
    default: return false;
  }
}

/* ───────── habilidad 3 ───────── */
function useS30(g, p) {
  const C = cdef(p); if (!C || !C.s3 || p.dead || p.s3Cd > 0 || p.carry) return false;
  const id = C.s3.id, o = g.eyePos(p), d = g.aimDir(p);
  switch (id) {
    case 'caparazon': p.guardUntil = g.time + 4; break;
    case 'marca': {
      let best = null, bt = 70;
      for (const m of g.monsters) { if (m.dead) continue; const oc = sub(m.pos, o), t = dot(oc, d); if (t < 0 || t > bt) continue; if (len(sub(oc, mul(d, t))) < m.r * 1.6 + 1) { bt = t; best = m; } }
      if (!best) return false;                             // sin blanco no se gasta
      best.markUntil = g.time + 8; best.markMul = 1.4; g.emit({ t: 'mark', pid: p.id, p: a3(best.pos), id: best.id });
      break;
    }
    case 'biomasa': {
      let n = 0;
      for (const m of g.monsters) { if (m.dead || n >= 6) continue; if (dist(m.pos, p.pos) < 9 + m.r) { g.damageMonster(m, 75, p, m.pos); n++; } }
      p.hp = Math.min(PLAYER.hp, p.hp + 8 + n * 9); p.shield = Math.min(PLAYER.shield, p.shield + n * 6);
      break;
    }
    case 'tiempo': g.addObject('chrono', clone(p.pos), { owner: p.id, life: 5, r: 11 }); break;
    case 'reflujo': singularReflujo(g, p); break;
    case 'cintas': if (!dzCintas(g, p)) return false; break;
    case 'nido': enjambreSkill(g, p, 'nido'); break;   // Colmena
    case 'simbionte': {
      for (const q of g.objects.filter((x) => x.type === 'symb' && x.owner === p.id)) g.removeObject(q);
      g.addObject('symb', madd(p.pos, p.up, 2), { owner: p.id, life: 10, r: 1.4, cd: 0.4 });
      break;
    }
    default: return false;
  }
  p.s3Cd = C.s3.cd * cdMul(p); g.emit({ t: 'skill', pid: p.id, k: 's3', id, p: a3(p.pos) });
  return true;
}

/* ───────── definitiva ───────── */
function useUlt0(g, p) {
  const C = cdef(p); if (!C || !C.ult || p.dead || p.carry || p.ul < C.ult.charge || p.ultT > 0) return false;
  const id = C.ult.id; p.ul = 0; p.ultId = id; p.ultT = (ULT_DUR[id] || 8) * (hasPath(p, 'apoteosis') ? 1.3 : 1) * (hasPath(p, 'resonancia') ? 1.25 : 1) * (hasC(p, 'espiraculo') ? 1.2 : 1);
  if (id === 'supernova') singularUlt(g, p);
  if (id === 'colapso') {
    const pos = madd(p.pos, flat(p), 12);
    g.addObject('well', pos, { owner: p.id, life: 6, r: 3, dmg: 150, splash: 13 });
    g.addObject('chrono', clone(pos), { owner: p.id, life: 6, r: 14 });
  }
  if (id === 'frenesi') p.movCd = 0;
  g.emit({ t: 'skill', pid: p.id, k: 'ult', id, p: a3(p.pos) });
  return true;
}
function zoneTick(g, p, dt) {
  const s0 = g.dmgSrc; g.dmgSrc = 'skill'; try { zoneTick0(g, p, dt); } finally { g.dmgSrc = s0; }
}
function zoneTick0(g, p, dt) {
  if (p.ultId === 'floracion') {
    for (const m of g.monsters) { if (m.dead || dist(m.pos, p.pos) > 11 + m.r) continue; m.slowUntil = g.time + 0.4; if (!m.def.boss || true) { m.hp -= 25 * dt; m.hurt = Math.max(m.hurt, 0.05); if (m.hp <= 0) g.killMonster(m, p); } }
    p.hp = Math.min(PLAYER.hp, p.hp + 6 * dt);
  }
}

/* ───────── ganchos de game.js ───────── */
/** Daño que recibe el jugador (escala por resistencia, caparazón, callo, desfase). Devuelve el daño final. */
export function hostDamageIn(g, p, dmg) {
  const C = cdef(p); if (!C) return dmg;
  if (p.char === 'danzante') { const z = dzGuard(g, p, dmg); if (z !== null) return z; }   // parada / esquiva perfecta: el golpe se anula
  if (C.hp) dmg /= C.hp;
  dmg *= (STYLES[p.style] || STYLE_NEUTRAL).taken;
  if (p.meleeHold > 0.12 && !p.dead) { dmg *= 0.5; if (g.time > (p.blockFx || 0)) { p.blockFx = g.time + 0.3; g.emit({ t: 'pblock', pid: p.id }); } }   // cargar el golpe pesado = BLOQUEAR (mitad de daño)
  if (hasPath(p, 'coraza')) dmg *= 0.82;
  if (hasC(p, 'placas')) dmg *= 0.88;
  if (p.bn) dmg *= p.bn.dmgIn;
  dmg = itemDamageIn(g, p, dmg);   // Sombra y Espinas de los objetos
  if (g.time < p.guardUntil) { const ab = dmg * 0.7; dmg -= ab; for (const m of g.monsters) if (!m.dead && dist(m.pos, p.pos) < 5 + m.r) g.damageMonster(m, ab * (g.time < (p.baluarteUntil || 0) ? 1 : 0.6), p, m.pos); }
  if (g.time < p.desfaseUntil && C.passive && C.passive.id === 'desfase') dmg *= 0.65;
  if (C.passive && C.passive.id === 'callo') dmg *= 1 - Math.min(0.4, p.callo * 0.04);
  if (p.ultId === 'floracion') dmg *= 0.8;
  if (p.char === 'colmena') dmg *= enjambreIn(p);   // Marabunta y Cohabitación
  if (p.ultId === 'supernova') dmg *= 0.75;   // la estrella aguanta
  if (g.time < (p.blessUntil || 0)) dmg *= 0.8;   // Bendición de Seraf (modo Combo)
  return faunaDamageIn(g, p, dmg);   // metamorfosis de fauna: resistencia, fase, reflejo y espinas de la forma

}
export function hostDamaged(g, p) { const C = cdef(p); if (C && C.passive && C.passive.id === 'callo') { p.callo = Math.min(10, p.callo + 1); p.calloT = 6; } }

/** Multiplicador de daño que hace un jugador a una criatura. */
export function hostOut(g, p, m) {
  const st = STYLES[p.style] || STYLE_NEUTRAL, src = g.dmgSrc || (p.inMelee ? 'melee' : 'gun');
  let k = (st.mul[src] || 1) * (p.mode === 'combo' && src === 'skill' && !p.inHab ? MODO_K : 1) * (p.bn && (src === 'melee' || src === 'gun' || src === 'skill') ? p.bn[src] : 1) * itemOut(g, p, m, src);
  k *= faunaOut(g, p);   // metamorfosis de fauna: +daño de la forma
  const C = cdef(p); if (!C) return k;
  const id = C.passive && C.passive.id;
  if (id === 'desprevenido') { const f = m.fwd ? dot(norm(sub(p.pos, m.pos)), m.fwd) : 1; if (f < 0.3 || m.cloak) k *= 1.5; }
  if (id === 'adaptacion') k *= 1 + 0.02 * Math.min(5, p.adapt[m.kind] || 0);
  if (id === 'cria_viva') k *= enjambreOut(p);
  if (p.cloakBonus && g.time < p.cloakUntil) k *= 1.8;
  if (p.ultId === 'metamorfosis') k *= 1.25;
  if (p.ultId === 'sobrecarga') k *= 1.1;
  if (hasPath(p, 'apoteosis')) k *= 1.1;
  if (hasPath(p, 'artilleria') && !p.inMelee) k *= 1.15;
  if (p.blessWave && p.blessWave === g.wave) k *= 1.1;
  if (hasC(p, 'ojo_extra')) k *= 1.12;
  if (p.char === 'singular') k *= singularOut(g, p, m);   // +20 % a lo que está dentro de un pozo propio
  if (p.char === 'danzante') k *= dzOut(g, p, src);   // Réplica
  return k;
}
/** Tras un impacto (daño real aplicado): carga de definitiva, vampirismo de Metamorfosis y ruptura del camuflaje. */
export function hostHit(g, p, m, dealt) {
  itemHit(g, p, m, dealt); faunaHit(g, p, m, dealt);   // fauna: efectos por golpe de la forma (hielo, brasa, rayos…)
  if (p.ultId === '' && !g.enjDmg) p.ul = Math.min(100, p.ul + dealt * ULT_PER_DMG * (p.bn ? p.bn.ult : 1) * (STYLES[p.style] || STYLE_NEUTRAL).ult * (hasPath(p, 'resonancia') ? 1.4 : 1) * (hasC(p, 'saco_g') ? 1.15 : 1));
  if (p.ultId === 'metamorfosis' && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + dealt * 0.04);
  if (p.cloakUntil) { p.cloakUntil = 0; p.cloakBonus = false; }   // atacar rompe el camuflaje (el primer golpe ya cobró el bonus)
}
export function hostKill(g, p, m) {
  absorb(p, m); itemKill(g, p, m); if (p.char === 'colmena') enjambreKill(g, p);   // Plaga: cada baja cría un zángano
  if (p.bn && p.bn.kheal && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + p.bn.kheal); // bendición Descanso Ajeno
  if (hasPath(p, 'anomalia') && !m.def.boss && g.rng.next() < 0.25) g.explode(m.pos, 5, 0, 70, p, false);
  if (p.char === 'singular') singularKill(g, p, m);   // Anomalía: tira de los vecinos hacia el cadáver
  addCores(g, p, m.def.cost * CORES.perCost * (m.elite ? CORES.eliteMul : 1) * (g.evCoreMul || 1) + (m.def.boss ? CORES.boss : 0));
  const C = cdef(p); if (!C) return;
  if (p.ultId === '') p.ul = Math.min(100, p.ul + ULT_PER_KILL);
  const id = C.passive && C.passive.id;
  if (id === 'adaptacion') p.adapt[m.kind] = (p.adapt[m.kind] || 0) + 1;
  if (id === 'carnivoro' && p.inMelee && !p.dead) { p.hp = Math.min(PLAYER.hp, p.hp + 14); p.ul = Math.min(100, p.ul + 8); }
  if (p.ultId === 'frenesi') { // reinicia el desplazamiento y salta a la siguiente víctima (la marcada primero)
    p.movCd = 0;
    let best = null, bd = 32;
    for (const q of g.monsters) { if (q.dead || q === m) continue; const dd = dist(q.pos, p.pos) - (g.time < (q.markUntil || 0) ? 10 : 0); if (dd < bd) { bd = dd; best = q; } }
    if (best) { const to = norm(sub(best.pos, p.pos)); p.pos = madd(best.pos, to, -(best.r + 1.6)); p.vel = v3(); p.invulUntil = Math.max(p.invulUntil, g.time + 0.4); g.emit({ t: 'blink', p: a3(p.pos) }); p.heading = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.meleeCd = 0; p.buf = 0.18; p.bufHeavy = false; }
  }
}

/* ───────── objetos de los Huéspedes (barrera, esporas, burbuja de tiempo, simbionte) ───────── */
export function hostObject(g, o, dt) {
  const s0 = g.dmgSrc; g.dmgSrc = 'skill'; try { return hostObject0(g, o, dt); } finally { g.dmgSrc = s0; }
}
function hostObject0(g, o, dt) {
  switch (o.type) {
    case 'wall': {
      o.life -= dt; if (o.life <= 0) { g.removeObject(o); return true; }
      for (const m of g.monsters) { if (m.dead || m.def.boss) continue; const d = dist(m.pos, o.pos); if (d < o.r + m.r) m.vel = madd(m.vel, norm(sub(m.pos, o.pos)), 30 * dt); }
      return true;
    }
    case 'spores': {
      o.life -= dt; if (o.life <= 0) { g.removeObject(o); return true; }
      const by = g.players.find((q) => q.id === o.owner);
      for (const m of g.monsters) { if (m.dead || dist(m.pos, o.pos) > o.r + m.r) continue; m.slowUntil = g.time + 0.4; m.hp -= 9 * dt; m.hurt = Math.max(m.hurt, 0.05); if (m.hp <= 0) g.killMonster(m, by || null); }
      return true;
    }
    case 'pozo': return singularObject(g, o, dt);
    case 'chrono': {
      o.life -= dt; if (o.life <= 0) { g.removeObject(o); return true; }
      for (const m of g.monsters) if (!m.dead && dist(m.pos, o.pos) < o.r + m.r) m.chronoUntil = g.time + 0.15;
      return true;
    }
    case 'zangano': case 'nido': case 'reina': return enjambreObject(g, o, dt);   // Colmena
    case 'symb': {
      o.life -= dt; o.cd -= dt;
      const by = g.players.find((q) => q.id === o.owner);
      if (o.life <= 0 || !by || by.dead) { g.removeObject(o); return true; }
      const want = madd(madd(by.pos, cross(by.heading, by.up), 2.4), by.up, 2);
      o.pos = madd(o.pos, sub(want, o.pos), Math.min(1, 6 * dt));
      if (o.cd <= 0) {
        let best = null, bd = 28;
        for (const m of g.monsters) { if (m.dead) continue; const d = dist(m.pos, o.pos); if (d < bd) { bd = d; best = m; } }
        if (best) { g.damageMonster(best, 16, by, best.pos); g.emit({ t: 'tshot', o: a3(o.pos), to: a3(best.pos) }); }
        o.cd = 0.45;
      }
      return true;
    }
    default: return false;
  }
}
/** ¿Esta posición está dentro de una barrera de Micelio? (los proyectiles enemigos mueren). */
export const inWall = (g, pos) => g.objects.some((o) => o.type === 'wall' && dist(pos, o.pos) < o.r);
export const inChrono = (g, pos) => g.objects.some((o) => o.type === 'chrono' && dist(pos, o.pos) < o.r);

export function hostSnap(g, p) {
  let bf = 0;
  if (g.time < p.guardUntil) bf |= BF.guard; if (g.time < p.cloakUntil) bf |= BF.cloak;
  if (p.ultId === 'sobrecarga') bf |= BF.over; if (p.ultId === 'frenesi') bf |= BF.frenzy; if (p.ultId === 'floracion') bf |= BF.flora; if (p.ultId === 'metamorfosis') bf |= BF.meta;
  if (g.time < p.desfaseUntil) bf |= BF.desfase; if (g.time < p.glideUntil) bf |= BF.glide;
  if (g.objects.some((o) => o.type === 'wall' && o.owner === p.id)) bf |= BF.barrier;
  const sy = g.objects.find((o) => o.type === 'symb' && o.owner === p.id);
  if (p.char === 'colmena' && (g.time < (p.swarmUntil || 0) || p.ultId === 'marabunta')) bf |= BF.swarm;   // el enjambre está en frenesí
  if (p.char === 'danzante') bf |= dzBits(g, p);   // bits 12+ (parada, esquiva, réplica, danza y compás 0..5)
  return { mc: r2(p.movCd), ec: r2(p.espCd), s3c: r2(p.s3Cd), ul: Math.round(p.ul), ua: r2(p.ultT), cmb: p.cmb, bf, sy: sy ? a3(sy.pos) : null, ui: p.ultId, cal: p.callo, sty: p.style || '', co: Math.round(p.cores), evo: p.evo || 0, evn: evoCost(p), pth: p.path, mw: p.melee || '', mr: p.mastery || 1, ...comboSnap(p), ...singularSnap(g, p), ...enjambreSnap(g, p) };
}

function useS3(g, p) { const s = g.dmgSrc; g.dmgSrc = 'skill'; try { return useS30(g, p); } finally { g.dmgSrc = s; } }

function useUlt(g, p) { const s = g.dmgSrc; g.dmgSrc = 'skill'; try { return useUlt0(g, p); } finally { g.dmgSrc = s; } }
