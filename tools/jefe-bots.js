// BOTS POR ESTILO para probar a los jefes (tests/jefes-*.test.js, docs/JEFES.md → «Pruebas»).
// Cada bot juega «como una persona» con su estilo: tirador (el bot de siempre), melé (modo Combo: corre hacia el jefe cuando baja y
// pega A1/A2), habilidades (se queda a media distancia y usa sus habilidades), esquivador (nunca ataca: sólo se mueve y se cubre) y mixto.
// Todos leen las marcas de telegrafía del jefe (mecEvitar). Sin DOM, determinista (semilla propia).
import { Game } from '../src/sim/game.js';
import { makeBot, taskFor, routeTo } from '../src/sim/bot.js';
import { mecEvitar } from '../src/sim/jefe-mec.js';
import { CTL } from '../src/sim/jefe-ia.js';
import { v3, add, sub, mul, dot, cross, len, dist, norm, project, makeRng } from '../src/sim/math.js';

/** shooter · melee · skills (poderes y, entre uno y otro, el arma) · powers (SÓLO poderes, sin disparar) · passive (esquivador) · mixed. */
export const ESTILOS_BOT = ['shooter', 'melee', 'skills', 'powers', 'passive', 'mixed'];
/** Huésped que usa cada estilo (el de habilidades necesita daño de habilidad real contra un jefe). */
export const CHAR_DE = { shooter: 'axioma', melee: 'axioma', skills: 'singular', powers: 'singular', passive: 'axioma', mixed: 'axioma' };
/** Estilo de combate de la partida (data.js → STYLES) que elegiría cada tipo de jugador. */
export const STYLE_DE = { shooter: 'disparo', melee: 'melee', skills: 'habilidad', powers: 'habilidad', passive: 'disparo', mixed: 'disparo' };

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function apuntar(g, p, pt, skill, dt, inp) {
  const eye = g.eyePos(p), to = norm(sub(pt, eye)), tan = norm(project(to, p.up), p.heading);
  const yawErr = Math.atan2(dot(cross(p.heading, tan), p.up), dot(p.heading, tan));
  const pitchErr = Math.asin(Math.max(-1, Math.min(1, dot(to, p.up)))) - p.pitch;
  const mt = 7 * skill * dt;
  inp.dyaw = -Math.max(-mt, Math.min(mt, yawErr)); inp.dpitch = Math.max(-mt, Math.min(mt, pitchErr));
  return Math.max(Math.abs(yawErr), Math.abs(pitchErr));
}
function mover(p, wish, inp) {
  const w = project(wish, p.up), l = len(w); if (l < 0.05) return;
  const n = mul(w, 1 / Math.max(1, l)), right = cross(p.heading, p.up);
  inp.mz = dot(n, p.heading); inp.mx = dot(n, right);
}


function botiquin(g, p, wish) {
  if (p.hp + p.shield > 120) return wish;
  let pk = null, pd = 45; for (const k of g.pickups) { const dd = dist(k.pos, p.pos); if (dd < pd && k.type === 'hp') { pd = dd; pk = k; } }
  return pk ? add(mul(norm(project(sub(pk.pos, p.pos), p.up), p.heading), 2), mul(wish, 0.3)) : wish;
}

/** Crea el bot de un estilo. Devuelve think(dt) → entrada para g.setInput. */
export function botEstilo(g, pid, estilo0, { seed = 1, skill = 1.2 } = {}) {
  let estilo = estilo0;
  const base = makeBot(g, pid, { seed, skill }), rng = makeRng(seed * 4099 + 7);
  let ciclo = 0, modoMix = 0, tModo = 0, strafe = 1, strafeT = 0, a2 = false;
  const think = function think(dt) {
    const p = g.players.find((q) => q.id === pid);
    const jefe = g.monsters.find((m) => !m.dead && m.def.boss);
    if (estilo === 'shooter' || !p || p.dead || !jefe) { const i = base(dt); if (estilo === 'shooter' || estilo === 'passive') i.mode = 'shooter'; return i; }
    if (estilo === 'mixed') { // alterna cada ~9 s entre tirador y melé: el jefe no debería fijarse en nada
      tModo += dt; if (tModo > 9) { tModo = 0; modoMix ^= 1; }
      if (!modoMix) { const i = base(dt); i.mode = 'shooter'; return i; }
      return melee(dt, p, jefe, true);
    }
    if (estilo === 'melee') return melee(dt, p, jefe, false);
    return distancia(dt, p, jefe, estilo);
  };

  think.estilo = (e) => { estilo = e; };   // cambiar de estilo en plena pelea (pruebas de readaptación)
  return think;

  function melee(dt, p, jefe, mix) {
    const inp = { mode: 'combo', mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, a1: false, a2: false, hab: false, mov: false, esp: false, s3: false, ult: false, weapon: -1, pick: p.cards && p.cards.length ? 0 : -1 };
    const task = taskFor(g, p), M = jefe.mec;
    // objetivo: el jefe si se puede alcanzar (bajo), si no los bichos más cercanos, si no esperar bajo el jefe fuera de la onda
    const adds = g.monsters.filter((m) => !m.dead && !m.def.boss && dist(m.pos, p.pos) < 40).sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos));
    const ojos = g.objects.filter((o) => o.hostile && o.hp > 0 && dist(o.pos, p.pos) < 50).sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos));
    const alcanzable = (pt, r) => dist(pt, g.eyePos(p)) < 3.8 + r + 1.2;
    let tgt = null, tpos = null, tr = 1;
    const llega = M && (M.bajo > 0 || (M.act && M.act.id === 'descenso') || (!g.map.R && M.dCd < 9 + 0.5 * Math.max(0, flat(jefe.pos, p.pos) / 8)));   // un jugador aprende el ritmo: se acerca antes de la caída
    if (llega || jefe.pos.y - jefe.r < p.pos.y + 6) { tgt = jefe; tpos = jefe.pos; tr = jefe.r; }
    else if (ojos[0] && dist(ojos[0].pos, p.pos) < 22) { tgt = ojos[0]; tpos = ojos[0].pos; tr = ojos[0].r; }
    else if (adds[0]) { tgt = adds[0]; tpos = adds[0].pos; tr = adds[0].r; }
    let wish = v3();
    if (task && task.pt && !(tgt === jefe && M && M.bajo > 0)) { const gp = task.direct ? task.pt : routeTo(g, p, task.pt); if (dist(gp, p.pos) > (task.stay ?? 1)) wish = add(wish, mul(norm(project(sub(gp, p.pos), p.up), p.heading), 4)); }
    else if (tgt) {
      const dd = g.map.R ? dist(tpos, p.pos) : flat(tpos, p.pos), reach = tr * 0.55 + 3.2;
      const gp = routeTo(g, p, tpos);
      if (dd > reach) wish = add(wish, mul(norm(project(sub(gp, p.pos), p.up), p.heading), 4)); else wish = add(wish, mul(cross(p.up, p.heading), Math.sin(g.time * 1.3)));
      const err = apuntar(g, p, tpos, skill, dt, inp);
      if (alcanzable(tpos, tr) && err < 0.5) { ciclo += dt; if (ciclo > 0.22) { ciclo = 0; a2 = !a2; } inp.a1 = !a2; inp.a2 = a2; }
      if (tgt === jefe && p.hab !== undefined && p.habCd <= 0 && alcanzable(tpos, tr)) inp.hab = true;
    } else { // nada que pegar: esperar fuera del radio de la onda, bajo el jefe
      const c = v3(jefe.pos.x, p.pos.y, jefe.pos.z), dd = flat(c, p.pos);
      if (dd > 22) wish = add(wish, mul(norm(project(sub(routeTo(g, p, c), p.pos), p.up), p.heading), 3)); else if (dd < 19) wish = add(wish, mul(norm(project(sub(p.pos, c), p.up), p.heading), 3));
      strafeT -= dt; if (strafeT <= 0) { strafe = -strafe; strafeT = 0.7 + rng.next() * 1.2; }   // esperando la ventana: se mueve (quieto, lo cazan)
      wish = add(wish, mul(cross(p.up, p.heading), strafe * 1.2)); if ((g.time * 1.7 | 0) % 5 === 0) inp.jump = true;
      apuntar(g, p, jefe.pos, skill, dt, inp);
    }
    const ev = mecEvitar(g, p); if (ev) wish = add(mul(ev, 4), mul(wish, 0.3));
    for (const q of g.projectiles) { if (q.owner !== 'm') continue; const to = sub(p.pos, q.pos), dd = len(to); if (dd < 24 && dd > 1 && dot(norm(q.vel), mul(to, 1 / dd)) > 0.93) { const side = norm(cross(norm(q.vel), p.up)); wish = add(wish, mul(side, dot(side, cross(p.heading, p.up)) >= 0 ? 3 : -3)); } }
    wish = botiquin(g, p, wish);
    mover(p, wish, inp);
    if (p.hp + p.shield < 90) inp.dash = true;
    return inp;
  }

  function distancia(dt, p, jefe, est) {
    const inp = { mode: 'shooter', mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, mov: false, esp: false, s3: false, ult: false, weapon: -1, pick: p.cards && p.cards.length ? 0 : -1 };
    const esf = !!g.map.R, task = taskFor(g, p), c = v3(jefe.pos.x, p.pos.y, jefe.pos.z), dd = esf ? dist(jefe.pos, p.pos) : flat(c, p.pos);
    const want = est === 'passive' ? 52 : 24;
    let wish = v3();
    if (task && task.pt && est !== 'passive') { const gp = task.direct ? task.pt : routeTo(g, p, task.pt); if (dist(gp, p.pos) > (task.stay ?? 1)) wish = add(wish, mul(norm(project(sub(gp, p.pos), p.up), p.heading), 4)); }
    else {
      const away = norm(project(sub(p.pos, c), p.up), p.heading);
      if (dd < want - 4) wish = add(wish, mul(away, 3)); else if (dd > want + 8 && !esf) wish = add(wish, mul(norm(project(sub(routeTo(g, p, c), p.pos), p.up), p.heading), 2.5));   // (en la esfera el jefe está en el centro: se espera a que se asome)
      strafeT -= dt; if (strafeT <= 0) { strafe = -strafe; strafeT = 0.8 + rng.next() * 1.4; }
      wish = add(wish, mul(cross(p.up, p.heading), strafe * 0.9));
    }
    // objetivo: lo que lo está mordiendo (escoltas a < 16 m) y, si no, el jefe
    let mira = jefe.pos; { let bd = 16; for (const m of g.monsters) { if (m.dead || m.def.boss) continue; const d2 = dist(m.pos, p.pos); if (d2 < bd) { bd = d2; mira = m.pos; } } }
    const err = apuntar(g, p, mira, skill, dt, inp);
    if (est === 'skills' || est === 'powers') {
      // sólo habilidades: usa cada una apenas se recarga (el daño del jefe viene de ellas)
      if (err < 0.35) { inp.esp = p.espCd <= 0; inp.s3 = p.s3Cd <= 0; inp.mov = p.movCd <= 0 && dd > 14; inp.ult = (p.ul || 0) >= 100; }
      inp.fire = est === 'skills' && err < 0.12 && p.espCd > 0 && p.s3Cd > 0;   // entre una habilidad y otra dispara (un jugador de poderes también tiene arma)
    } else inp.fire = false;   // esquivador: no ataca
    const ev = mecEvitar(g, p); if (ev) wish = add(mul(ev, 4), mul(wish, 0.3));
    for (const q of g.projectiles) { if (q.owner !== 'm') continue; const to = sub(p.pos, q.pos), d2 = len(to); if (d2 < 24 && d2 > 1 && dot(norm(q.vel), mul(to, 1 / d2)) > 0.93) { const side = norm(cross(norm(q.vel), p.up)); wish = add(wish, mul(side, dot(side, cross(p.heading, p.up)) >= 0 ? 3 : -3)); } }
    wish = botiquin(g, p, wish);
    mover(p, wish, inp);
    if (est === 'passive' && (g.time * 2 | 0) % 7 === 0) inp.jump = true;
    return inp;
  }
}

/**
 * Pelea contra el jefe de una arena (salta directo a la oleada del jefe). Devuelve un resumen:
 *   state, t (segundos de combate), minHp, fases (las que vio), posturas (línea de tiempo [t, postura]), salto (mayor movimiento del jefe en 1 tick),
 *   maxRes (mayor resistencia por adaptación vista), eventos (conteo por tipo), g.
 */
export function pelea({ mapId = 'm1', seed = 1, estilos = ['shooter'], maxSeconds = 600, dt = 1 / 60, antes = null, cada = null, ia = true, difficulty = 1, jefeMem = null } = {}) {
  const ctl0 = { ...CTL }; Object.assign(CTL, ia === true ? { apagada: false } : ia === false ? { apagada: true } : { apagada: false, ...ia });   // ia: true | false (sólo mecánicas, sin adaptación) | { sinResist, sinEfectos, sinPesos }
  const g = new Game({ mapId, seed, difficulty, jefeMem });
  const bots = estilos.map((est, i) => { const p = g.addPlayer('bot' + i, null, { char: CHAR_DE[est] || 'axioma', mode: est === 'melee' ? 'combo' : 'shooter', style: STYLE_DE[est], kit: 2 }); /* kit: 2 botiquines iniciales (Tienda): llegan al jefe como quien juega la partida completa */; return [p.id, botEstilo(g, p.id, est, { seed: seed + i }), est]; });
  g.wave = g.waveTotal - 1; g.phaseT = 0;
  if (antes) antes(g);
  const R = { state: 'playing', t0: null, fases: new Set(), posturas: [], salto: 0, maxRes: 0, eventos: {}, minHp: 1e9, tDano: {}, saltoPlayers: 0 };
  let prev = null;
  while (g.state === 'playing' && g.time < maxSeconds) {
    for (const [id, th] of bots) g.setInput(id, th(dt));
    g.step(dt);
    const b = g.monsters.find((m) => m.def.boss && !m.dead);
    if (b && R.t0 === null) R.t0 = g.time;
    if (b) {
      if (prev && b.mec && !b.mec.goal) { /* sin objetivo de movimiento activo */ }
      if (prev) R.salto = Math.max(R.salto, Math.hypot(b.pos.x - prev.x, b.pos.y - prev.y, b.pos.z - prev.z));
      prev = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
      R.fases.add(b.mec.f);
      if (!R.posturas.length || R.posturas[R.posturas.length - 1][1] !== b.ia.st) R.posturas.push([+(g.time - R.t0).toFixed(1), b.ia.st]);
      R.maxRes = Math.max(R.maxRes, b.ia.st === 'neutro' ? 0 : b.ia.lvl);
    }
    for (const p of g.players) { R.minHp = Math.min(R.minHp, p.hp + p.shield); if (!Number.isFinite(p.pos.x)) throw new Error('NaN'); }
    for (const e of g.events) R.eventos[e.t + (e.k ? ':' + e.k : '')] = (R.eventos[e.t + (e.k ? ':' + e.k : '')] || 0) + 1;
    if (cada) cada(g, b, bots);
    g.events.length = 0;
  }
  R.state = g.state; R.t = +(g.time - (R.t0 || 0)).toFixed(1); R.g = g;
  Object.assign(CTL, ctl0, { apagada: false, sinResist: false, sinEfectos: false, sinPesos: false }, ctl0);
  return R;
}
