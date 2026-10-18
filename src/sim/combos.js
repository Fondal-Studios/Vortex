// MODO COMBO (docs/HUESPEDES.md → «Modo Combo»): dos botones de ataque (A1, A2) que se encadenan en combos + UNA habilidad principal por Huésped.
// Todo determinista y sin DOM: NO usa g.rng. Los datos (sets de golpes, armas, habilidades) viven en data.js (COMBO_SETS, COMBO_WEAPON, HABILIDADES).
//
// Cómo funciona un combo: cada pulsación de A1/A2 se agrega a una «cadena» (['a1','a1','a2']). El golpe que sale es el MÁS LARGO de la lista del Huésped
// cuya secuencia coincide con el final de la cadena y ya está desbloqueado (por nivel de evolución o camino). Tras cada golpe hay una recuperación; si la
// pulsación siguiente continúa un combo válido se puede «cancelar» al 70 % de la recuperación (más rápido); si no, hay que esperar la recuperación entera.
// Pasada la ventana (COMBO_RULES.window) sin atacar, la cadena se corta. Saltar o usar la habilidad cancela la recuperación.
import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, clone } from './math.js';
import { PLAYER, COMBO_SETS, COMBO_WEAPON, COMBO_RULES, COMBO_CHARGE, COMBO_TUNE, HABILIDADES } from './data.js';
import { blocked } from './physics.js';
import { hasC } from './organos.js';
import { cdef, isHost, meleeSet, hasPath, evoMeleeMul, cdMul, applyMeleeSpecial, meleeAfter } from './huespedes.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const flat = (p) => norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading);
const heal = (q, n) => { q.hp = Math.min(PLAYER.hp, q.hp + n); };

/** Pone en el jugador el estado de combos y habilidad (lo llama initHost; conserva el modo si ya estaba elegido). */
export function initCombo(p) {
  p.mode = p.mode === 'combo' && isHost(p) ? 'combo' : 'shooter';
  p.cb = { buf: [], n: 0, win: 0, cd: 0, rec: 0, cancel: COMBO_RULES.cancel, q: '', qp: 1, qt: 0, prev1: false, prev2: false, chg: 0, last: '', lastName: '' };
  Object.assign(p, { habCd: 0, habPend: null, habPrev: false, frenzyUntil: 0, blessUntil: 0, baluarteUntil: 0, eclipse: null });
  if (p.mode === 'combo') p.style = 'combo';
}
/** Cambia entre 'shooter' y 'combo'. Sólo los Huéspedes pueden jugar Combo. Devuelve el modo resultante. */
export function setMode(p, mode) {
  const want = mode === 'combo' && isHost(p) ? 'combo' : 'shooter';
  if (p.mode === want) return want;
  p.mode = want; p.style = want === 'combo' ? 'combo' : ''; p.cb.buf = []; p.cb.n = 0; p.cb.q = ''; p.cb.win = 0; p.cb.cd = 0; p.cmb = 0; p.habPend = null;
  return want;
}

/* ───────── set de golpes ───────── */
const shapeOf = (p) => COMBO_WEAPON[meleeSet(p).type] || COMBO_WEAPON.innata;
/** Golpes disponibles ahora: desbloqueados por nivel/camino y que caben en el largo de cadena que permite el arma fusionada. */
export function comboUnlocked(p) {
  const set = COMBO_SETS[p.char] || [], W = shapeOf(p);
  return set.filter((m) => (p.evo || 0) >= m.evo && (!m.path || hasPath(p, m.path)) && m.seq.length <= W.chain);
}
const sameTail = (buf, seq) => seq.length <= buf.length && seq.every((x, i) => buf[buf.length - seq.length + i] === x);
const hasLonger = (moves, buf) => moves.some((m) => m.seq.length > buf.length && buf.every((x, i) => m.seq[i] === x));
/** El golpe más largo cuya secuencia coincide con el final de la cadena. Devuelve { mv, len } (len = cuántas entradas usó). */
export function pickMove(moves, buf) {
  for (let L = buf.length; L >= 1; L--) {
    let found = null; for (const m of moves) if (m.seq.length === L && sameTail(buf, m.seq)) found = m;   // si hay empate gana el definido después
    if (found) return { mv: found, len: L };
  }
  return null;
}

/* ───────── paso por tick (lo llama huespedes.js → updateHost) ───────── */
export function comboStep(g, p, dt) {
  const inp = p.input, cb = p.cb, C = cdef(p), H = HABILIDADES[p.char];
  cb.cd = Math.max(0, cb.cd - dt); p.habCd = Math.max(0, p.habCd - dt);
  if (cb.win > 0) { cb.win -= dt; if (cb.win <= 0) { cb.buf = []; cb.n = 0; p.cmb = 0; } }
  if (cb.qt > 0) { cb.qt -= dt; if (cb.qt <= 0) cb.q = ''; }
  if (p.baluarteUntil && g.time >= p.baluarteUntil) p.baluarteUntil = 0;
  eclipseTick(g, p, dt);
  // habilidad pendiente (preparación = telegrafía)
  if (p.habPend) { p.habPend.t -= dt; if (p.habPend.t <= 0) { const id = p.habPend.id; p.habPend = null; resolveHab(g, p, id); } }
  const e1 = !!inp.a1 && !cb.prev1, e2 = !!inp.a2 && !cb.prev2, rel2 = !inp.a2 && cb.prev2;
  cb.prev1 = !!inp.a1; cb.prev2 = !!inp.a2;
  if (p.dead || p.carry) { cb.q = ''; cb.chg = 0; p.habPrev = !!inp.hab; return; }
  // habilidad principal: un toque
  if (inp.hab && !p.habPrev && !g.evSilencio) useHab(g, p, H);
  p.habPrev = !!inp.hab;
  // salto cancela la recuperación
  if (inp.jump && cb.cd > 0.05) cb.cd = 0;
  // entradas de ataque: A1 al pulsar (mantener repite); A2 al pulsar, o al soltar si se CARGA (Seraf)
  const charge = !!COMBO_CHARGE[p.char];
  if (e1) { cb.q = 'a1'; cb.qp = 1; cb.qt = COMBO_RULES.buffer; }
  if (charge) {
    if (inp.a2) cb.chg = Math.min(COMBO_RULES.chargeMax, cb.chg + dt);
    if (rel2) { cb.q = 'a2'; cb.qp = 1 + cb.chg / COMBO_RULES.chargeMax; cb.qt = COMBO_RULES.buffer; cb.chg = 0; }
    if (!inp.a2 && !rel2) cb.chg = 0;
  } else if (e2) { cb.q = 'a2'; cb.qp = 1; cb.qt = COMBO_RULES.buffer; }
  if (!cb.q && cb.cd <= 0) { if (inp.a1) { cb.q = 'a1'; cb.qp = 1; cb.qt = COMBO_RULES.buffer; } else if (inp.a2 && !charge) { cb.q = 'a2'; cb.qp = 1; cb.qt = COMBO_RULES.buffer; } }
  if (!cb.q) return;
  const moves = comboUnlocked(p), W = shapeOf(p);
  const tentative = [...cb.buf, cb.q].slice(-W.chain), pick = pickMove(moves, tentative);
  const chains = pick && pick.len > 1;   // ¿continúa un combo válido?
  if (cb.cd > 0 && !(chains && cb.cd <= cb.rec * (1 - cb.cancel))) return;
  const name = cb.q, power = cb.qp; cb.q = '';
  // golpe descendente en el aire (mirando abajo): reutiliza el aterrizaje del melé de siempre (huespedes.js → slamLand)
  if (name === 'a2' && !p.grounded && p.pitch < -0.35 && !(C && COMBO_CHARGE[p.char])) { p.slam = 3; p.vel = madd(p.vel, p.up, -42); cb.cd = 0.5; cb.rec = 0.5; g.emit({ t: 'combo', pid: p.id, n: cb.n, id: 'plunge', name: 'Caída', hit: 0, p: a3(p.pos), air: true }); return; }
  fire(g, p, name, power, moves, W);
}

function fire(g, p, name, power, moves, W) {
  const cb = p.cb;
  let buf = [...cb.buf, name].slice(-W.chain);
  const pick = pickMove(moves, buf); if (!pick) return;
  if (pick.len < buf.length) buf = buf.slice(-pick.len);                 // la cadena vieja no encajó: se reinicia desde lo que sí coincide
  cb.n = buf.length === 1 ? 1 : cb.n + 1;
  const last = !hasLonger(moves, buf);
  const mv = pick.mv;
  const hits = resolve(g, p, mv, power, W, last);
  const M = meleeSet(p), base = mv.w === 'h' ? M.heavy : M.light;
  const fr = g.time < p.frenzyUntil ? 0.75 : 1, over = p.ultId === 'sobrecarga' ? 0.6 : 1;
  cb.rec = Math.max(0.12, base.cd * mv.cdr * W.cd * fr * over * (hasPath(p, 'velocidad') ? 0.92 : 1)); cb.cd = cb.rec;
  cb.cancel = mv.cancel || COMBO_RULES.cancel; cb.last = mv.id; cb.lastName = mv.name;
  if (last) { cb.buf = []; cb.win = cb.rec + 0.2; cb.nEnd = cb.n; cb.n = last ? 0 : cb.n; }
  else { cb.buf = buf; cb.win = cb.rec + COMBO_RULES.window; }
  p.cmb = Math.min(3, last ? 3 : cb.n); p.cmbT = cb.win;
  g.emit({ t: 'combo', pid: p.id, n: last ? cb.nEnd : cb.n, id: mv.id, name: mv.name, hit: hits, fin: last, p: a3(p.pos) });
}

/* ───────── un golpe ───────── */
function resolve(g, p, mv0, power, W, last) {
  const M = meleeSet(p), cb = p.cb;
  let mv = mv0;
  if (W.spinAt && cb.n >= W.spinAt && !mv.ranged) mv = { ...mv, arc: 2, kind: 'spin', dmg: mv.dmg * 1.15, hits: 1 };   // hacha: el 3.º golpe es un giro
  const heavy = mv.w === 'h', base = heavy ? M.heavy : M.light;
  const side = mv.seq[mv.seq.length - 1] === 'a2' ? W.a2 : W.a1;
  const over = p.ultId === 'sobrecarga', meta = p.ultId === 'metamorfosis', strong = hasPath(p, 'simbiosis') ? 1.5 : 1;
  const frenzy = g.time < p.frenzyUntil;
  let dmg = base.dmg * mv.dmg * W.dmg * (mv.charge ? power : 1) * evoMeleeMul(p) * (M.aff ? 1.15 : 1) * (hasC(p, 'tentaculo') ? 1.1 : 1) * (g.evMeleeMul || 1) * (frenzy ? 1.2 : 1) * (last && W.fin ? W.fin : 1) * (COMBO_TUNE[p.char] || 1);
  const range = base.range * mv.rng * (mv.ranged ? 1 : side.rng) * (meta ? 1.35 : 1) * (hasC(p, 'tentaculo') ? 1.2 : 1);
  const arcv = base.arc * mv.arc * (mv.ranged ? 1 : side.arc), full = mv.arc >= 2 || meta;
  const cosT = full ? -1 : Math.max(-1, 1 - arcv * (heavy ? 1.1 : 1));
  const o = g.eyePos(p), dir0 = norm(g.aimDir(p)), h = flat(p);
  const s0 = g.dmgSrc; g.dmgSrc = 'melee'; p.inMelee = true; g.pierceNow = !!base.pierce;
  let hits = 0;
  try {
    if (mv.ranged) hits = shoot(g, p, mv, dmg, range, M, o, dir0);
    else {
      const targets = [];
      let p0 = clone(p.pos);
      if (mv.blink) {   // teletransporte corto (hacia adelante o, si es negativo, hacia atrás)
        const sgn = mv.blink < 0 ? -1 : 1, hh = mul(h, sgn); let t = 0;
        for (; t < Math.abs(mv.blink); t += 1) if (blocked(g.map, madd(madd(p.pos, p.up, 0.4), hh, t + 1.4))) break;
        p.pos = madd(p.pos, hh, Math.max(0, t - 0.2)); p.vel = mul(p.vel, 0.3); p.invulUntil = Math.max(p.invulUntil, g.time + 0.3); g.emit({ t: 'blink', p: a3(p.pos) });
      }
      const seg = sub(p.pos, p0), segL = len(seg), segN = segL > 0.01 ? mul(seg, 1 / segL) : h;
      for (const m of g.monsters) {
        if (m.dead) continue;
        if (mv.line && mv.blink) {   // corte en línea entre donde estabas y donde llegaste
          const to = sub(m.pos, p0), t = Math.max(0, Math.min(segL, dot(to, segN))); const dd = len(sub(to, mul(segN, t)));
          if (dd < m.r + 2.4) targets.push([m, t]);
          continue;
        }
        const to = sub(m.pos, o), l = len(to);
        if (l > range + m.r) continue;
        if (dot(norm(to), dir0) < cosT && l > m.r + 0.8) continue;
        targets.push([m, l]);
      }
      targets.sort((a, b) => a[1] - b[1]);
      const maxT = heavy || full || mv.line || base.pierce || mv.fx ? 8 : 4;
      for (const [m] of targets.slice(0, maxT)) {
        if (m.dead) continue;
        if (!m.def.boss && m.hp <= m.maxhp * 0.18) {   // ejecución
          g.emit({ t: 'melee', pid: p.id, kind: 'exec', p: a3(m.pos), d: a3(dir0), hit: 1 });
          p.exec = true; g.damageMonster(m, m.hp + 1, p, m.pos); p.exec = false; if (!p.dead) heal(p, 10); hits++; continue;
        }
        const facing = m.fwd ? dot(norm(sub(p.pos, m.pos)), m.fwd) : 0;
        const k = m.kind === 'ariete' && facing > 0.6 && !base.pierce ? 0.35 : 1;   // el ariete bloquea de frente (sin azar)
        let dm = dmg * k;
        for (let i = 0; i < mv.hits && !m.dead; i++) g.damageMonster(m, dm, p, m.pos);
        hits++;
        if (hasPath(p, 'depredador') && !p.dead) heal(p, dm * mv.hits * 0.06);
        if (!m.dead && (p.evo || 0) >= 1 && M.special) applyMeleeSpecial(g, p, m, M.special, heavy, dm, strong);
        if (!m.dead && !m.def.boss) { const kn = (base.knock || 4) * (heavy ? 1 : 0.8) * (mv.fx === 'pull' ? -1 : 1); m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), kn); }
        if (mv.fx && mv.fx.includes('marca') && !m.dead) { m.markUntil = g.time + 6; m.markMul = 1.3; }
      }
      if ((p.evo || 0) >= 1 && M.special) meleeAfter(g, p, M.special, heavy || last, dir0, o, dmg, strong);
      if (mv.dash) p.ext = madd(p.ext, h, mv.dash * 2.2);
      if (mv.jump) { p.vel = madd(p.vel, p.up, mv.jump); p.grounded = false; }
      if (W.sismo && !mv.fx) ring(g, p, 4.5, dmg * 0.3, 10);
      applyFx(g, p, mv, dmg, o, dir0);
      g.emit({ t: 'melee', pid: p.id, kind: mv.kind, p: a3(madd(o, dir0, 1.5)), d: a3(dir0), hit: hits, cmb: p.cmb, mw: M.id, sp: (p.evo || 0) >= 1 ? M.special || undefined : undefined });
    }
  } finally { g.dmgSrc = s0; p.inMelee = false; g.pierceNow = false; }
  return hits;
}

/** Flechas de luz (Seraf): son «melé-rango»: cuentan como golpes. */
function shoot(g, p, mv, dmg, range, M, o, d) {
  const right = cross(p.heading, p.up), n = mv.hits, fan = mv.fan || (n > 1 ? 0.05 : 0), pierce = !!(mv.pierce || (M.light && M.light.pierce) || M.type === 'lanza');
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * fan, dd = norm(add(d, mul(right, off)));
    const before = g.monsters.reduce((a, m) => a + (m.dead ? 0 : m.hp), 0);
    const end = g.hitscan(p, o, dd, { dmg, range, pierce });
    if (g.monsters.reduce((a, m) => a + (m.dead ? 0 : m.hp), 0) < before) hits++;
    g.emit({ t: 'beam', pid: p.id, o: a3(o), to: a3(end), c: mv.fx === 'cura' ? 'heal' : 'rail' });
  }
  return hits;
}

/** Onda en el suelo alrededor del jugador (daño y empuje). */
function ring(g, p, r, dmg, kn) {
  for (const m of g.monsters) { if (m.dead) continue; const d = dist(m.pos, p.pos); if (d < r + m.r) { g.damageMonster(m, dmg, p, m.pos); if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), kn); } }
  g.emit({ t: 'boom', p: a3(p.pos), r });
}
function applyFx(g, p, mv, dmg, o, dir) {
  const fx = mv.fx || '', big = mv.big ? 1.6 : 1;
  if (fx.includes('onda')) g.addProjectile({ owner: 'p', pid: p.id, kind: 'lanza', pos: madd(o, dir, 1.6), vel: mul(dir, 42), dmg: dmg * 0.6, splash: 0, r: 0.9, life: 0.7, pierce: true, hit: [] });
  if (fx.includes('sismo')) ring(g, p, 5.5 * big, dmg * 0.4, 12);
  if (fx.includes('raices')) {
    for (const m of g.monsters) { if (m.dead || dist(m.pos, p.pos) > 5 * big + m.r) continue; m.slowUntil = g.time + 2.5; if (!m.def.boss) m.vel = mul(m.vel, 0.1); }
    g.addObject('spores', madd(p.pos, flat(p), 2.5), { owner: p.id, life: 2.5, r: 4 * big });
  }
  if (fx.includes('pull')) for (const m of g.monsters) { if (m.dead || m.def.boss) continue; const d = dist(m.pos, p.pos); if (d < 9 + m.r) m.vel = madd(m.vel, norm(sub(p.pos, m.pos)), 14); }
  if (fx.includes('desfase')) p.desfaseUntil = Math.max(p.desfaseUntil || 0, g.time + 2);
  if (fx.includes('cura')) { heal(p, 10); for (const q of g.players) if (q !== p && !q.dead && dist(q.pos, p.pos) < 12) heal(q, 10); }
}

/* ───────── habilidad principal ───────── */
const habScale = (p) => 1 + 0.06 * (p.evo || 0);
function useHab(g, p, H) {
  if (!H || p.dead || p.carry || p.habCd > 0 || p.habPend) return false;
  p.habCd = H.cd * cdMul(p) * (1 - 0.05 * (p.evo || 0)); p.habMax = p.habCd;
  p.habPend = { id: H.id, t: H.wind }; p.cb.cd = Math.min(p.cb.cd, 0.1);   // la habilidad cancela la recuperación del golpe
  if (H.id === 'baluarte') { p.guardUntil = g.time + H.wind + 4.5 * (hasPath(p, 'coraza') ? 1.3 : 1) * (p.evo >= 3 ? 1.2 : 1); p.baluarteUntil = p.guardUntil; }   // el escudo ya está arriba mientras se prepara
  g.emit({ t: 'hab', pid: p.id, id: H.id, ph: 'cast', p: a3(p.pos), r: r2(H.r * habScale(p)), dur: H.wind });
  return true;
}
function resolveHab(g, p, id) {
  const H = HABILIDADES[p.char]; if (!H || p.dead) return;
  const r = H.r * habScale(p), s0 = g.dmgSrc; g.dmgSrc = 'skill';
  const near = (rr) => g.monsters.filter((m) => !m.dead && dist(m.pos, p.pos) < rr + m.r);
  try {
    if (id === 'baluarte') {
      for (const m of near(r)) { g.damageMonster(m, 35 * habScale(p), p, m.pos); if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), 16); }
      p.shield = Math.min(PLAYER.shield, p.shield + 25 + (hasPath(p, 'coraza') ? 20 : 0));
      g.emit({ t: 'skill', pid: p.id, k: 's3', id: 'caparazon', p: a3(p.pos) }); g.emit({ t: 'boom', p: a3(p.pos), r });
    } else if (id === 'caza') {
      const h = flat(p); p.invulUntil = Math.max(p.invulUntil, g.time + 0.4); p.ext = madd(p.ext, h, 40);
      for (const m of g.monsters) {
        if (m.dead) continue; const d = sub(m.pos, p.pos), t = dot(d, h);
        if (t < -2 || t > 13 || len(sub(d, mul(h, t))) > m.r + 3) continue;
        g.damageMonster(m, 70 * habScale(p), p, m.pos); if (!m.def.boss) m.vel = madd(m.vel, h, 12); m.markUntil = g.time + 6; m.markMul = 1.3;
      }
      p.frenzyUntil = g.time + 6 * (hasPath(p, 'depredador') ? 1.25 : 1);
      g.emit({ t: 'skill', pid: p.id, k: 'mov', id: 'impulso', p: a3(p.pos) });
    } else if (id === 'estallido') {
      let n = 0;
      for (const m of near(r)) { g.damageMonster(m, 90 * habScale(p), p, m.pos); m.slowUntil = g.time + 3; if (!m.def.boss) m.vel = mul(m.vel, 0.1); n++; }
      const amt = 30 + 4 * Math.min(n, 6);
      for (const q of g.players) if (!q.dead && dist(q.pos, p.pos) < r + 4) { heal(q, amt * (q === p ? 1.3 : 1)); q.shield = Math.min(PLAYER.shield, q.shield + 25); }
      g.addObject('spores', clone(p.pos), { owner: p.id, life: 4, r: r * 0.7 });
      g.emit({ t: 'skill', pid: p.id, k: 's3', id: 'biomasa', p: a3(p.pos) }); g.emit({ t: 'boom', p: a3(p.pos), r });
    } else if (id === 'eclipse') {
      const pos = madd(p.pos, flat(p), 4); p.invulUntil = Math.max(p.invulUntil, g.time + 0.4);
      g.addObject('chrono', clone(pos), { owner: p.id, life: 6, r }); p.eclipse = { pos: clone(pos), until: g.time + 6, r };
      g.emit({ t: 'skill', pid: p.id, k: 's3', id: 'tiempo', p: a3(pos) });
    } else if (id === 'bendicion') {
      for (const q of g.players) {
        if (dist(q.pos, p.pos) > r) continue;
        if (q.dead) { if (!q.lost && q !== p) { g.reviveInPlace(q); q.hp = 60; } continue; }
        heal(q, PLAYER.hp * (0.4 + 0.05 * (p.evo || 0))); q.shield = PLAYER.shield; q.blessUntil = g.time + 6;
      }
      g.emit({ t: 'skill', pid: p.id, k: 'esp', id: 'pulso', p: a3(p.pos) });
    }
    g.emit({ t: 'hab', pid: p.id, id, ph: 'go', p: a3(p.pos), r: r2(r) });
  } finally { g.dmgSrc = s0; }
}
/** Eclipse de Umbra: daño continuo dentro de la zona (la lentitud la da el objeto 'chrono'). */
function eclipseTick(g, p, dt) {
  const e = p.eclipse; if (!e) return;
  if (g.time >= e.until) { p.eclipse = null; return; }
  const s0 = g.dmgSrc; g.dmgSrc = 'skill';
  try { for (const m of g.monsters) { if (m.dead || dist(m.pos, e.pos) > e.r + m.r) continue; m.slowUntil = g.time + 0.4; m.hp -= 24 * dt; m.hurt = Math.max(m.hurt, 0.05); if (m.hp <= 0) g.killMonster(m, p); } } finally { g.dmgSrc = s0; }
}

/* ───────── snapshot ───────── */
export function comboSnap(p) {
  if (p.mode !== 'combo') return { md: 0 };
  const cb = p.cb, H = HABILIDADES[p.char];
  return { md: 1, cn: cb.n || (cb.nEnd && cb.win > 0 ? cb.nEnd : 0), cw: r2(Math.max(0, cb.win)), cnm: cb.lastName, hc: r2(p.habCd), hx: r2(p.habMax || (H ? H.cd : 0)), hw: p.habPend ? r2(p.habPend.t) : 0, cc: r2(cb.chg / COMBO_RULES.chargeMax) };
}
