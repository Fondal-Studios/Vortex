// SINGULAR — «El Astro Muerto» (docs/HUESPEDES.md → «Singular»). Control de gravedad y de ÁREA. Todo determinista y sin DOM; NO usa g.rng ni Math.random.
//
// Mecánica propia (tres piezas que se refuerzan entre sí):
//   · POZOS gravitatorios (objeto 'pozo'): tiran de las criaturas hacia su centro (las agrupan), las aplastan, se comen los proyectiles enemigos y al
//     cerrarse IMPLOSIONAN. Máximo 3 por jugador (4 con Apoteosis; los chicos van primero al reponer). Lo que está adentro recibe +20 % de daño (hostOut).
//   · SATÉLITES de roca estelar que giran alrededor del jugador (posiciones deterministas: fase acumulada `p.orbPh`); golpean a lo que cruzan (0,45 s por criatura
//     y satélite). Con Coraza frenan los proyectiles enemigos. El snapshot manda `so:[n, fase]` y `sm` para que el cliente los dibuje en el mismo sitio.
//   · HORIZONTE: no se le invierte la gravedad (eventos.js → volteaJugador llama a `singularInmune`) y la Marea de Gravedad le da +35 % a pozos y satélites.
// Los ganchos están en huespedes.js (hostMove/hostSpecial/useS30/useUlt0/hostObject/hostOut/hostKill/hostSnap/updateHost), combos.js (fx 'atrae'|'pozo'|'orbita',
// habilidad 'gravedad', remate 'pozo') y eventos.js. Los caminos de EVO_PATHS (compartidos por todos los Huéspedes) se leen con hasPath: ver `docs/HUESPEDES.md`.
import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, clone } from './math.js';
import { PLAYER, LIMITS } from './data.js';
import { blocked } from './physics.js';
import { hasPath } from './huespedes.js';

const TAU = Math.PI * 2;
const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const flat = (p) => norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading);

/** Números de balance de Singular (todo en un lugar). */
export const SING = {
  maxPozos: LIMITS.pozos, pozoLife: 6, pozoR: 11, pozoCore: 4.2, pull: 36, dps: 20, tick: 0.25,           // pozo normal
  miniR: 7.5, miniCore: 3, miniLife: 2.4, miniPull: 26, miniDps: 10,                              // pozo chico (Honda, golpes de Combo)
  bigR: 18, bigCore: 7, bigPull: 46, bigDps: 38,                                                  // pozo de la Supernova
  orbN: 3, orbMax: LIMITS.satelites, orbR: 3.4, orbW: 2.4, orbDmg: 10, orbCd: 0.45, orbHit: 0.9,                 // satélites
  marea: 1.35,                                                                                    // multiplicador de la Marea de Gravedad
  dentro: 1.2,                                                                                    // daño extra a lo que está dentro de un pozo propio
};

export const isSing = (p) => !!p && p.char === 'singular';
/** ¿Está activa la Marea para este jugador? (la pasiva Horizonte la enciende mientras dura el evento o el pulso de un jefe). */
export const mareaOn = (g, p) => g.time < (p.mareaUntil || 0);
const mk = (g, p) => (mareaOn(g, p) ? SING.marea : 1);
const evoK = (p) => 1 + 0.06 * (p.evo || 0);
const supernova = (p) => p.ultId === 'supernova';

/* ───────── satélites ───────── */
export const orbN = (p) => Math.min(SING.orbMax, (SING.orbN + (hasPath(p, 'depredador') ? 1 : 0) + (hasPath(p, 'simbiosis') ? 1 : 0)) * (supernova(p) ? 2 : 1));
const orbR = (g, p) => SING.orbR * (mareaOn(g, p) ? 1.2 : 1) * (supernova(p) ? 1.4 : 1);
const orbW = (g, p) => SING.orbW * (hasPath(p, 'velocidad') ? 1.4 : 1) * (supernova(p) ? 1.3 : 1) * (mareaOn(g, p) ? 1.2 : 1);
const orbDmg = (g, p) => (SING.orbDmg + 2 * (p.evo || 0)) * (hasPath(p, 'simbiosis') ? 1.25 : 1) * mk(g, p);
/** Posición del satélite i de n (marco del jugador: plano perpendicular a `up`, con un balanceo vertical). */
export function orbPos(g, p, i, n) {
  const ref = Math.abs(p.up.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), e1 = norm(cross(p.up, ref)), e2 = cross(p.up, e1);
  const a = (p.orbPh || 0) + (i * TAU) / n, R = orbR(g, p), h = 1.1 + 0.45 * Math.sin(2 * a + (p.orbPh || 0) * 0.5);
  return madd(madd(madd(clone(p.pos), p.up, h), e1, Math.cos(a) * R), e2, Math.sin(a) * R);
}

/** Cada tick: fase de los satélites, golpes de los satélites, escudo de proyectiles (Coraza) y estado de la Marea. */
export function singularTick(g, p, dt) {
  if (g.ev && g.ev.id === 'marea_gravedad' && g.ev.ph === 'activo') p.mareaUntil = Math.max(p.mareaUntil || 0, g.time + 0.4);
  p.orbPh = ((p.orbPh || 0) + dt * orbW(g, p)) % TAU;
  if (p.dead) return;
  const n = orbN(p), R = orbR(g, p), dmg = orbDmg(g, p), s0 = g.dmgSrc;
  const pts = []; for (let i = 0; i < n; i++) pts.push(orbPos(g, p, i, n));
  g.dmgSrc = 'skill';
  try {
    for (const m of g.monsters) {
      if (m.dead) continue;
      const dc = dist(m.pos, p.pos); if (dc > R + m.r + 2.2) continue;
      const cd = m.orbAt || (m.orbAt = {}); if (g.time < (cd[p.id] || 0)) continue;
      for (let i = 0; i < n; i++) {
        if (dist(m.pos, pts[i]) > m.r + SING.orbHit) continue;
        cd[p.id] = g.time + SING.orbCd; g.damageMonster(m, dmg, p, m.pos);
        if (!m.dead && !m.def.boss) m.vel = madd(m.vel, norm(sub(p.pos, m.pos)), 4);   // el satélite también los acerca
        break;
      }
    }
  } finally { g.dmgSrc = s0; }
  if (hasPath(p, 'coraza')) { // Coraza: los satélites se comen los proyectiles enemigos que cruzan
    let n2 = 0;
    for (const pr of g.projectiles) {
      if (pr.owner !== 'm' || pr.life <= 0) continue;
      for (let i = 0; i < n; i++) if (dist(pr.pos, pts[i]) < 1.3) { pr.life = 0; if (n2++ < 3) g.emit({ t: 'splat', p: a3(pr.pos) }); break; }
    }
  }
}

/* ───────── pozos ───────── */
/** Crea un pozo. Respeta el máximo por jugador: al pasarse se retira primero el chico más viejo y, si no hay, el más viejo. Devuelve el objeto. */
export function addPozo(g, p, pos, o = {}) {
  const max = SING.maxPozos + (hasPath(p, 'apoteosis') ? 1 : 0);
  if (!o.big) {
    const mine = g.objects.filter((q) => q.type === 'pozo' && q.owner === p.id && !q.big);
    while (mine.length >= max) { const out = mine.find((q) => q.kind === 'mini') || mine[0]; g.removeObject(out); mine.splice(mine.indexOf(out), 1); }
  }
  const k = mk(g, p) * (hasPath(p, 'artilleria') ? 1.12 : 1);
  const life = (o.life ?? SING.pozoLife) * (hasPath(p, 'resonancia') ? 1.35 : 1);
  const r = (o.r ?? SING.pozoR) * k, core = (o.core ?? SING.pozoCore) * k;
  const obj = g.addObject('pozo', pos, { owner: p.id, life, r, core, tk: SING.tick, kind: o.big ? 'big' : o.mini ? 'mini' : o.hab ? 'hab' : undefined, big: !!o.big, mini: !!o.mini, hab: !!o.hab, dmgK: o.dmgK ?? 1, cDmg: o.cDmg, cRad: o.cRad });
  g.emit({ t: 'pozo', pid: p.id, p: a3(pos), r: r2(r), kind: obj.kind || 'normal' });
  return obj;
}
/** Un tick del pozo: tira de las criaturas, las frena/daña y absorbe proyectiles. Lo llama huespedes.js → hostObject. */
export function singularObject(g, o, dt) {
  const by = g.players.find((q) => q.id === o.owner);
  if (o.big && by && !by.dead) o.pos = madd(clone(by.pos), by.up, 1.4);   // el de la Supernova te sigue
  o.life -= dt;
  if (o.life <= 0 || (o.big && (!by || by.dead || !supernova(by)))) { colapso(g, o, by); g.removeObject(o); return true; }
  const k = by ? mk(g, by) : 1, S = (o.big ? SING.bigPull : o.mini ? SING.miniPull : SING.pull) * k * (o.hab ? 1.25 : 1);
  o.tk -= dt; const tick = o.tk <= 0; if (tick) o.tk += SING.tick;
  const dps = (o.big ? SING.bigDps : o.mini ? SING.miniDps : SING.dps) * k * (by ? evoK(by) : 1) * o.dmgK;
  const s0 = g.dmgSrc; g.dmgSrc = 'skill';
  try {
    for (const m of g.monsters) {
      if (m.dead) continue;
      const d = dist(m.pos, o.pos), reach = o.r + m.r; if (d > reach) continue;
      if (!m.def.boss && d > 0.9) { const f = 0.45 + 0.55 * (1 - d / reach); m.vel = madd(m.vel, norm(sub(o.pos, m.pos)), S * f * dt); }
      if (d < o.core + m.r) {
        m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.35);
        if (tick) g.damageMonster(m, dps * SING.tick * (m.def.boss ? 0.6 : 1), by || null, m.pos);
      }
    }
  } finally { g.dmgSrc = s0; }
  let n = 0;   // se comen los proyectiles enemigos que se acercan al centro
  for (const pr of g.projectiles) if (pr.owner === 'm' && pr.life > 0 && dist(pr.pos, o.pos) < o.r * 0.45) { pr.life = 0; if (n++ < 3) g.emit({ t: 'splat', p: a3(pr.pos) }); }
  return true;
}
/** Implosión al cerrarse el pozo. */
function colapso(g, o, by) {
  const s0 = g.dmgSrc; g.dmgSrc = 'skill';
  try {
    const rad = o.cRad ?? (o.big ? 14 : o.mini ? 4 : 8), dmg = (o.cDmg ?? (o.big ? 300 : o.mini ? 40 : 120)) * (by ? evoK(by) : 1) * (by && hasPath(by, 'artilleria') ? 1.5 : 1) * (by ? mk(g, by) : 1);
    g.explode(o.pos, rad, 0, dmg, by || null, false);
    if (o.hab || o.big) for (const m of g.monsters) if (!m.dead && dist(m.pos, o.pos) < rad + m.r) { m.slowUntil = Math.max(m.slowUntil || 0, g.time + 2); if (!m.def.boss) m.vel = mul(m.vel, 0.4); }
    g.emit({ t: 'pozoend', pid: o.owner, p: a3(o.pos), r: r2(rad), kind: o.kind || 'normal' });
  } finally { g.dmgSrc = s0; }
}

/* ───────── habilidades (Shooter) ───────── */
/** Hab. 1 · Honda gravitatoria. */
export function singularMove(g, p) {
  const h = flat(p), pozos = g.objects.filter((q) => q.type === 'pozo' && q.owner === p.id);
  let w = null, bd = 32; for (const q of pozos) { const d = dist(p.pos, q.pos); if (d > 3 && d < bd) { bd = d; w = q; } }
  if (w) { // rodea el pozo y sale por la tangente que más se parece a donde mirás
    const to = norm(sub(w.pos, p.pos)); let tg = norm(cross(p.up, to), h); if (dot(tg, h) < 0) tg = mul(tg, -1);
    p.ext = madd(madd(p.ext, tg, 36), to, 12); p.invulUntil = Math.max(p.invulUntil || 0, g.time + 0.3); w.life += 1.2;
  } else {
    p.ext = madd(p.ext, h, 30); p.vel = madd(p.vel, p.up, 6); p.grounded = false;
    addPozo(g, p, madd(clone(p.pos), p.up, 0.6), { mini: true, life: SING.miniLife, r: SING.miniR, core: SING.miniCore });
  }
  return true;
}
/** Hab. 2 · Pozo gravitatorio: se abre donde mirás (al primer sólido, o centrado sobre la primera criatura que cruce el rayo). */
export function singularSpecial(g, p) {
  const o = g.eyePos(p), d = norm(g.aimDir(p)); let at = madd(o, d, 18), hit = false;
  for (let t = 2; t <= 26 && !hit; t += 1) {
    const q = madd(o, d, t);
    if (blocked(g.map, q)) { at = madd(o, d, Math.max(2, t - 1.5)); hit = true; break; }
    for (const m of g.monsters) if (!m.dead && dist(m.pos, q) < m.r + 1.2) { at = clone(m.pos); hit = true; break; }
  }
  addPozo(g, p, at);
  return true;
}
/** Hab. 3 · Reflujo de marea: cada pozo propio escupe hacia afuera (daña, frena y empuja); sin pozos, una onda alrededor tuyo. */
export function singularReflujo(g, p) {
  const pozos = g.objects.filter((q) => q.type === 'pozo' && q.owner === p.id), k = mk(g, p), dmg = 85 * evoK(p) * k;
  const centers = pozos.length ? pozos.map((q) => ({ pos: q.pos, r: q.r * 1.15 })) : [{ pos: p.pos, r: 7 * k }];
  const hurt = new Set();
  for (const c of centers) {
    for (const m of g.monsters) {
      if (m.dead || hurt.has(m.id)) continue;
      const d = dist(m.pos, c.pos); if (d > c.r + m.r) continue;
      hurt.add(m.id); g.damageMonster(m, dmg * (pozos.length ? 1 : 0.7), p, m.pos);
      if (!m.dead) { m.slowUntil = Math.max(m.slowUntil || 0, g.time + 1.5); if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, c.pos)), 30); }
    }
    g.emit({ t: 'boom', p: a3(c.pos), r: r2(c.r) });
  }
  g.emit({ t: 'reflujo', pid: p.id, p: a3(p.pos), n: centers.length });
  return true;
}
/** Definitiva · Supernova: los pozos se funden en uno enorme que te sigue (la duración la pone useUlt0). */
export function singularUlt(g, p) {
  for (const q of g.objects.filter((x) => x.type === 'pozo' && x.owner === p.id)) g.removeObject(q);
  addPozo(g, p, madd(clone(p.pos), p.up, 1.4), { big: true, life: p.ultT, r: SING.bigR, core: SING.bigCore });
}

/* ───────── ganchos de los combos ───────── */
/** fx de un golpe de Combo: 'atrae' (tira de todo lo cercano), 'pozo' (deja un pozo chico adelante) y 'orbita' (los satélites estallan en anillo). */
export function singularFx(g, p, fx, dmg, big) {
  const k = big ? 1.5 : 1;
  if (fx.includes('atrae')) for (const m of g.monsters) { if (m.dead || m.def.boss) continue; const d = dist(m.pos, p.pos); if (d < 10 * k + m.r && d > 1.2) m.vel = madd(m.vel, norm(sub(p.pos, m.pos)), 16 * k); }
  if (fx.includes('pozo')) addPozo(g, p, madd(madd(clone(p.pos), flat(p), 4.5), p.up, 0.6), { mini: true, life: SING.miniLife * (big ? 1.4 : 1), r: SING.miniR * k, core: SING.miniCore * k });
  if (fx.includes('orbita')) {
    const n = orbN(p), R = 7.5 * k;
    for (const m of g.monsters) if (!m.dead && dist(m.pos, p.pos) < R + m.r) g.damageMonster(m, dmg * 0.3 * (n / 3), p, m.pos);
    g.emit({ t: 'orbburst', pid: p.id, p: a3(p.pos), n, r: r2(R) });
  }
}
/** Habilidad principal del Combo («Colapso gravitatorio»): un pozo grande delante que dura 2,6 s y al cerrarse implosiona y frena. */
export function singularHab(g, p, r) {
  const at = madd(madd(clone(p.pos), flat(p), 5), p.up, 0.6);
  addPozo(g, p, at, { hab: true, life: 2.6, r, core: r * 0.5, dmgK: 1.3, cDmg: 170, cRad: r * 1.05 });
}

/* ───────── ganchos de huespedes.js / eventos.js ───────── */
/** Daño extra: lo que está dentro de un pozo propio recibe +20 %. */
export function singularOut(g, p, m) {
  for (const o of g.objects) if (o.type === 'pozo' && o.owner === p.id && dist(m.pos, o.pos) < o.core + m.r) return SING.dentro;
  return 1;
}
/** Anomalía: cada baja tira de las criaturas vecinas hacia el cadáver (agrupa para el siguiente golpe). */
export function singularKill(g, p, m) {
  if (!hasPath(p, 'anomalia')) return;
  for (const q of g.monsters) if (!q.dead && q !== m && !q.def.boss && dist(q.pos, m.pos) < 8 + q.r) q.vel = madd(q.vel, norm(sub(m.pos, q.pos)), 14);
}
/** Horizonte: la inversión de gravedad no le afecta, y si era la Marea (o un jefe) se le enciende el +35 %. Devuelve true si absorbió el pulso. */
export function singularInmune(g, p, secs) {
  if (!isSing(p)) return false;
  p.mareaUntil = Math.max(p.mareaUntil || 0, g.time + secs + 0.5);
  g.emit({ t: 'horizonte', pid: p.id, p: a3(p.pos) });
  return true;
}
/** Campos del snapshot: so = [satélites, fase], sm = 1 con la Marea encendida. */
export function singularSnap(g, p) {
  if (!isSing(p)) return {};
  return { so: [orbN(p), r2(p.orbPh || 0)], sm: mareaOn(g, p) ? 1 : 0 };
}
void PLAYER; void add; void len;
