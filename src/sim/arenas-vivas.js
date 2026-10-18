// ARENAS VIVAS: cada mapa (m1…m6) es un ORGANISMO con nombre, folclore y ciclo de vida (docs/MUNDO_VIVO.md → «Arenas vivas»).
// Determinista y sin DOM: usa su PROPIO generador derivado de la semilla (g.arRng, como g.evRng en eventos.js) y NUNCA toca g.rng.
// Los datos viven en data.js (ARENA, ARENAS_VIVAS). Los órganos NO son sólidos (no se pisan ni bloquean el paso, los disparos
// o las criaturas): son blancos que se pueden dañar y zonas que ayudan o amenazan. Por eso nunca pueden tapar una aparición ni un camino.
//
// FASES (se calculan solas a partir de la oleada y el tiempo; ver calcFase):
//   dormido   → oleada 0, oleada 1 (primeros 25 s) y mientras el corazón está roto: sin amenazas, ayuda débil.
//   despierto → oleada en curso: amenaza a media cadencia, ayuda plena.
//   furioso   → pasados N segundos de oleada (menos cuanto más avanzada) y en el jefe: amenaza plena, ayuda reducida.
//   ofrenda   → el respiro entre oleadas: sin amenazas, ayuda al máximo (las bocas están llenas, la nube sana).
// DOS CARAS por estructura: ayuda (boca / vena / pulmón sano) y amenaza (golpe / pulso / barrido / giro / pulmón tóxico), con aviso
// de al menos ARENA.telMin segundos y contrajuego claro (moverse, cubrirse detrás de una cobertura o romper el órgano).
import { v3, add, sub, mul, madd, dot, len, dist, norm, project, rotAround, makeRng } from './math.js';
import { ARENA, ARENAS_VIVAS, PLAYER } from './data.js';
import { blocked } from './physics.js';
import { addCores } from './huespedes.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const UP = v3(0, 1, 0);
/** Interruptor para pruebas A/B (apagar las arenas vivas sin tocar nada más). */
export const CTL = { off: false, sinAtaques: false, sinBeneficios: false };   // sinAtaques / sinBeneficios: sólo para medir cada cara por separado
const TIPO = { golpe: 0, pulso: 1, barrido: 2, giro: 3 };

/* ───────── disposición (pura: la comparten simulación, cliente y pruebas) ───────── */
const CACHE = new WeakMap();
/** Posiciones de los órganos de un mapa. Devuelve null si el mapa no tiene organismo. */
export function layoutArena(map) {
  const def = ARENAS_VIVAS[map.id]; if (!def) return null;
  if (CACHE.has(map)) return CACHE.get(map);
  const org = [];
  def.org.forEach((o, idx) => {
    let pos, u = UP, extra = {};
    if (o.cand) ({ pos, u } = ubicarEsfera(map, o, org));
    else if (o.k === 'vena') {
      const a = v3(o.a[0], 0, o.a[1]), b = v3(o.b[0], 0, o.b[1]);
      pos = mul(add(a, b), 0.5); extra = { A: a, B: b, L: dist(a, b) };
    } else pos = v3(o.x, o.y || 0, o.z);
    org.push({ ...o, idx, pos, u, hr: o.hr || 1.8, ...extra });
  });
  const L = { def, org, id: map.id };
  CACHE.set(map, L);
  return L;
}
/** Mapa esférico (m2): primer candidato (polar, azimut) libre de colinas, de los puntos de objetivo y de los órganos ya puestos. */
function ubicarEsfera(map, o, previos) {
  const R = map.R - 0.9, hills = map.solids.filter((s) => s.type === 'sph'), sp = map.spots;
  const spots = [sp.anchor, sp.core, ...(sp.plates || []), ...(sp.valves || [])];
  let first = null;
  for (const [po, az] of o.cand) {
    const s = Math.sin(po), p = v3(Math.cos(az) * s * R, -Math.cos(po) * R, Math.sin(az) * s * R), u = norm(mul(p, -1));
    first = first || { pos: p, u };
    if (hills.every((h) => dist(p, h.c) > h.r + 4) && spots.every((q) => dist(p, q) > 9) && previos.every((q) => dist(p, q.pos) > 14)) return { pos: p, u };
  }
  return first;
}
/** Centro del cuerpo golpeable del órgano (sobre el piso, `h` metros hacia arriba). */
export const centroOrgano = (o) => madd(o.pos, o.u, o.h || 1.2);

/* ───────── estado ───────── */
const maxHp = (o, wave) => Math.round((o.hp || 0) * (1 - ARENA.hpPorOla + ARENA.hpPorOla * Math.max(1, wave)));
const fedMax = (g, o) => (o.hambre || 4) + Math.floor(Math.max(1, g.wave) / 2);
export function initArenas(g) {
  g.arRng = makeRng((((g.seed | 0) ^ 0xa4e7a5) * 2654435761) >>> 0);
  g.ar = null;
  const L = CTL.off ? null : layoutArena(g.map); if (!L) return;
  g.ar = {
    L, ph: 'dormido', t: 0, wave: -1, t0: 0, sed: false, tl: [],
    org: L.org.map((o) => ({ hp: o.hp || 0, max: o.hp || 0, roto: false, hit: -99, lastDmg: -99, cd: o.atk ? o.atk.cd * (0.6 + 0.6 * g.arRng.next()) : 0, fed: 0, zone: 0, brT: 0, br: 0, mode: 0, tick: 0, reviveAt: 0, by: 0 })),
    stats: { golpes: 0, esquivados: 0, rotos: 0, ofrendas: 0, curado: 0, danioOrganos: 0 },
  };
}
const alive = (g) => g.players.filter((p) => !p.dead);
/** A quién se le acredita una baja causada por la arena (el jugador vivo más cercano): así los núcleos, esencias y la carga de la definitiva no se pierden. */
function credito(g, m) { let best = null, bd = Infinity; for (const p of g.players) { if (p.dead) continue; const d = dist(p.pos, m.pos); if (d < bd) { bd = d; best = p; } } return best; }

/** Fase del organismo ahora mismo (función pura del estado de la partida). */
export function calcFase(g, A) {
  if (g.practice || g.wave < 1) return 'dormido';
  if (g.phase === 'intermission') return 'ofrenda';
  if (A.sed) return 'dormido';
  const tw = g.time - A.t0, w = g.wave;
  if (w === 1 && tw < ARENA.dormidoOla1) return 'dormido';
  const limite = w >= g.waveTotal ? ARENA.furioso.jefe : w >= 5 ? ARENA.furioso[5] : ARENA.furioso[w] ?? ARENA.furioso[5];
  return tw >= limite ? 'furioso' : 'despierto';
}
function cambiarFase(g, A, ph) {
  const antes = A.ph; A.ph = ph; A.t = 0;
  if (ARENA.amen[ph] > 0) A.org.forEach((S, i) => { if (A.L.org[i].atk && S.cd < 3) S.cd = 3 + g.arRng.next() * 1.5; }); // nadie ataca de golpe al despertar
  if (ph === 'ofrenda' || ph === 'dormido') A.tl = [];
  if (g.wave >= 1 && !g.practice && !(ph === 'dormido' && A.sed)) g.emit({ t: 'ar', m: A.L.id, ph, de: antes });
}
function nuevaOla(g, A) {
  A.wave = g.wave; A.t0 = g.time; A.sed = false; A.tl = [];
  A.org.forEach((S, i) => {
    const mx = maxHp(A.L.org[i], g.wave);
    S.max = mx; S.hp = Math.min(mx, Math.max(S.roto ? 0 : S.hp, Math.round(mx * 0.6))); S.roto = false; // un órgano roto vuelve con el 60 % de vida
    S.fed = 0; S.zone = 0; S.reviveAt = 0; S.cd = Math.max(S.cd, 4);
  });
}

/* ───────── daño a los órganos ───────── */
const pulmonAbre = (A) => { const i = A.L.org.findIndex((o) => o.k === 'pulmon'); return i < 0 || A.org[i].roto || A.org[i].mode === 0; };
/** Daña el órgano `i` (corazón, raíz o pulmón). Devuelve el daño aplicado. */
export function danarOrgano(g, i, dmg, by, at) {
  const A = g.ar; if (!A || dmg <= 0) return 0;
  const o = A.L.org[i], S = A.org[i]; if (!o || S.roto || !o.hp) return 0;
  let d = dmg;
  if (o.vuln === 'inspira' && !pulmonAbre(A)) d *= 0.3;                // m2: el espejo sólo se abre cuando el Fuelle inspira
  S.hp -= d; S.hit = g.time; S.lastDmg = g.time; S.by = by && by.id ? by.id : S.by; A.stats.danioOrganos += d;
  g.emit({ t: 'arhit', i, p: a3(at || centroOrgano(o)), d: r2(d) });
  if (S.hp <= 0) romper(g, A, i);
  return d;
}
function romper(g, A, i) {
  const o = A.L.org[i], S = A.org[i];
  S.hp = 0; S.roto = true; A.stats.rotos++;
  A.tl = A.tl.filter((T) => T.i !== i);
  if (o.k === 'corazon') { A.sed = true; A.tl = []; }
  if (o.revive) S.reviveAt = g.time + o.revive;
  g.emit({ t: 'ar', m: A.L.id, ph: 'roto', i, p: a3(centroOrgano(o)) });
  const n = 6 + 2 * Math.max(1, g.wave);
  for (const p of alive(g)) addCores(g, p, n);
  g.dropPickup('hp', madd(o.pos, o.u, 1.5));
}
/** Disparos de rayo (hitscan): cada órgano golpeable es una esfera. Devuelve [{ar:i, t}] ordenables junto a las criaturas. */
export function arTargets(g, origin, d, range) {
  const A = g.ar; if (!A) return [];
  const out = [];
  A.L.org.forEach((o, i) => {
    if (o.k === 'vena' || o.k === 'boca' || A.org[i].roto) return;
    const oc = sub(centroOrgano(o), origin), tca = dot(oc, d); if (tca < 0 || tca > range) return;
    const d2 = dot(oc, oc) - tca * tca, rr = o.hr + 0.3; if (d2 > rr * rr) return;
    out.push({ ar: i, t: tca - Math.sqrt(rr * rr - d2) });
  });
  return out;
}
/** Explosiones de jugadores (explode): dañan a los órganos dentro del radio. */
export function arExplosion(g, pos, radius, md, by) {
  const A = g.ar; if (!A || md <= 0) return;
  A.L.org.forEach((o, i) => {
    if (o.k === 'vena' || o.k === 'boca' || A.org[i].roto) return;
    const c = centroOrgano(o), d = dist(c, pos);
    if (d < radius + o.hr) danarOrgano(g, i, md * 0.8 * (1 - 0.5 * d / (radius + o.hr)), by, c);
  });
}
/** Golpe cuerpo a cuerpo (huespedes.js → strike). */
export function arMelee(g, from, range, dir, cosT, dmg, by) {
  const A = g.ar; if (!A) return 0;
  let hits = 0;
  A.L.org.forEach((o, i) => {
    if (o.k === 'vena' || o.k === 'boca' || A.org[i].roto) return;
    const c = centroOrgano(o), to = sub(c, from), l = len(to);
    if (l < range + o.hr && dot(norm(to), dir) > cosT) { danarOrgano(g, i, dmg, by, c); hits++; }
  });
  return hits;
}
/** Una criatura cae cerca de una Boca: la alimenta. */
export function arKill(g, m) {
  const A = g.ar; if (!A || m.def.boss) return;
  A.L.org.forEach((o, i) => {
    if (o.k !== 'boca') return;
    const S = A.org[i];
    if (dist(m.pos, o.pos) > o.r * 2.2) return;
    S.fed += m.elite ? 2 : 1;
    const need = fedMax(g, o);
    if (S.fed >= need) { S.fed -= need; S.zone = Math.max(S.zone, ARENA.zonaDur); A.stats.ofrendas++; g.emit({ t: 'arofrenda', m: A.L.id, i, p: a3(o.pos) }); }
  });
}
/** Multiplicador de velocidad del jugador por las estructuras (carriles de luz, bruma lenta). 1 = nada. */
export const arVel = (g, p) => (p.arB ? p.arB.vel : 1);
/** Multiplicador de daño del jugador por las estructuras (Iris, Costillar). 1 = nada. */
export const arDanio = (g, p) => (p.arB ? p.arB.dmg : 1);

/* ───────── amenazas con aviso ───────── */
const distSeg = (p, a, b) => {
  const ab = sub(b, a), l2 = dot(ab, ab), t = l2 > 1e-9 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return dist(p, madd(a, ab, t));
};
/** Largo libre de una línea desde `o` hacia `dir`: se corta en el primer muro o cobertura (las coberturas son el contrajuego). */
function largoLibre(g, o, dir, max) {
  for (let t = 1.5; t < max; t += 1.5) if (blocked(g.map, madd(o, dir, t))) return Math.max(0, t - 1.5);
  return max;
}
function iniciarAtaque(g, A, o, S, amen) {
  const a = o.atk, vivos = alive(g).filter((p) => dist(p.pos, o.pos) < a.rango);
  if (!vivos.length) { S.cd = 1; return; }
  const tgt = vivos[Math.floor(g.arRng.next() * vivos.length)];
  const T = { i: o.idx, tipo: a.tipo, born: g.time, tel: Math.max(ARENA.telMin, a.tel), u: o.u, dmg: a.dmg + ARENA.danioPorOla * g.wave, w: a.w || 0, hit: [], hitM: [], omega: a.omega || 0, dur: a.dur || 0 };
  T.at = g.time + T.tel;
  if (a.tipo === 'golpe') { T.c = madd(tgt.pos, tgt.up, -0.9); T.r = a.r; }
  else if (a.tipo === 'pulso') { T.c = o.pos; T.r = a.r; }
  else {
    T.c = madd(o.pos, o.u, 0.1); const to = project(sub(tgt.pos, T.c), o.u);
    T.dir = norm(to, v3(1, 0, 0)); T.dir0 = T.dir; T.r = largoLibre(g, madd(T.c, o.u, 0.9), T.dir, a.largo);
  }
  A.tl.push(T);
  S.cd = (a.cd / amen) * (0.85 + 0.3 * g.arRng.next());
}
function danioEnLinea(g, A, T) {
  const a0 = madd(T.c, T.u, 0.9), b0 = madd(a0, T.dir, T.r);
  for (const p of alive(g)) if (!T.hit.includes(p.id) && distSeg(p.pos, a0, b0) < T.w / 2 + PLAYER.radius) { T.hit.push(p.id); g.hurtPlayer(p, T.dmg); A.stats.golpes++; }
  for (const m of g.monsters) if (!m.dead && !m.def.boss && !T.hitM.includes(m.id) && distSeg(m.pos, a0, b0) < T.w / 2 + m.r) { T.hitM.push(m.id); g.damageMonster(m, T.dmg * 3, credito(g, m), m.pos); }
}
function resolver(g, A, T) {
  const o = A.L.org[T.i];
  if (T.tipo === 'golpe' || T.tipo === 'pulso') {
    const ctr = madd(T.c, T.u, 0.9);
    for (const p of alive(g)) { const d = dist(p.pos, ctr); if (d < T.r + 0.4) { g.hurtPlayer(p, T.dmg * (1 - 0.25 * Math.min(1, d / T.r))); A.stats.golpes++; } }
    for (const m of g.monsters) if (!m.dead && !m.def.boss && dist(m.pos, ctr) < T.r + m.r) g.damageMonster(m, T.dmg * 3, credito(g, m), m.pos);
    g.emit({ t: 'boom', p: a3(T.c), r: T.r });
  } else if (T.tipo === 'barrido') {
    T.r = largoLibre(g, madd(T.c, T.u, 0.9), T.dir, o.atk.largo); danioEnLinea(g, A, T);
  }
  g.emit({ t: 'arfire', m: A.L.id, i: T.i, k: TIPO[T.tipo], p: a3(T.c) });
}

/* ───────── paso principal (1 por tick) ───────── */
export function tickArenas(g, dt) {
  const A = g.ar; if (!A) return;
  if (g.wave !== A.wave) nuevaOla(g, A);
  const ph = calcFase(g, A);
  if (ph !== A.ph) cambiarFase(g, A, ph);
  A.t += dt;
  // coordinación con los eventos de oleada (src/sim/eventos.js): mientras llueven astillas/rayos o corre la horda, el organismo ataca a media cadencia (no se apilan avisos en el suelo)
  const cargado = g.ev && g.ev.ph === 'activo' && (g.ev.id === 'lluvia_astillas' || g.ev.id === 'tormenta_ecos' || g.ev.id === 'marea_sangre');
  const amen = A.sed || CTL.sinAtaques ? 0 : ARENA.amen[A.ph] * (cargado ? 0.5 : 1), ayuda = CTL.sinBeneficios ? 0 : ARENA.ayuda[A.ph], vivos = alive(g);
  for (const p of g.players) { if (!p.arB) p.arB = { vel: 1, dmg: 1, vN: 1, dN: 1 }; p.arB.vN = 1; p.arB.dN = 1; }
  // proyectiles de jugadores que tocan un órgano
  for (const pr of g.projectiles) {
    if (pr.owner !== 'p' || pr.mine || pr.well) continue;
    for (let i = 0; i < A.L.org.length; i++) {
      const o = A.L.org[i]; if (o.k === 'vena' || o.k === 'boca' || A.org[i].roto) continue;
      if (dist(pr.pos, centroOrgano(o)) > o.hr + pr.r) continue;
      pr.arHit = pr.arHit || []; if (pr.arHit.includes(i)) continue; pr.arHit.push(i);   // una vez por proyectil y órgano; el proyectil sigue (los órganos no tapan a las criaturas)
      danarOrgano(g, i, pr.dmg, g.players.find((q) => q.id === pr.pid), pr.pos);
    }
  }
  A.org.forEach((S, i) => {
    const o = A.L.org[i];
    // reaparece (El Osario Insomne) o se regenera
    if (S.roto) { if (S.reviveAt && g.time >= S.reviveAt) { S.roto = false; S.hp = Math.round(S.max * 0.5); S.reviveAt = 0; if (o.k === 'corazon') A.sed = false; g.emit({ t: 'ar', m: A.L.id, ph: 'renace', i, p: a3(centroOrgano(o)) }); } return; }
    if (o.hp && S.hp < S.max && g.time - S.lastDmg > 4) S.hp = Math.min(S.max, S.hp + S.max * (o.regen || 0.01) * dt);
    if (o.atk) {
      S.cd -= dt;
      if (amen > 0 && S.cd <= 0) { if (A.tl.length < ARENA.maxTel && !A.tl.some((T) => T.i === i)) iniciarAtaque(g, A, o, S, amen); else S.cd = 0.5; }
      else if (amen === 0) S.cd = Math.max(S.cd, 0);
    }
    if (o.k === 'boca') bocaTick(g, A, o, S, ayuda, dt, vivos);
    else if (o.k === 'vena') for (const p of vivos) { if (distSeg(p.pos, madd(o.A, o.u, 0.9), madd(o.B, o.u, 0.9)) < o.w / 2 + 0.6) beneficio(g, p, o.bene, ayuda, dt, A); }
    else if (o.k === 'pulmon') pulmonTick(g, A, o, S, ayuda, dt, vivos);
  });
  // avisos en curso
  const keep = [];
  for (const T of A.tl) {
    const o = A.L.org[T.i];
    if (A.org[T.i].roto || amen === 0) continue;
    if (T.tipo === 'giro' && g.time >= T.at) {
      if (g.time >= T.at + T.dur) { g.emit({ t: 'arfire', m: A.L.id, i: T.i, k: 3, p: a3(T.c), fin: 1 }); continue; }
      if (!T.sw) { T.sw = 1; g.emit({ t: 'arfire', m: A.L.id, i: T.i, k: 3, p: a3(T.c) }); }
      T.dir = rotAround(T.dir0, T.u, T.omega * (g.time - T.at)); T.r = largoLibre(g, madd(T.c, T.u, 0.9), T.dir, o.atk.largo);
      danioEnLinea(g, A, T); keep.push(T); continue;
    }
    if (T.tipo !== 'giro' && g.time >= T.at) { resolver(g, A, T); continue; }
    keep.push(T);
  }
  A.tl = keep;
  for (const p of g.players) { const b = p.arB; b.vel = b.vN; b.dmg = b.dN; }
}

function beneficio(g, p, bene, ayuda, dt, A) {
  const b = p.arB;
  if (bene === 'cura') { const h0 = p.hp; p.hp = Math.min(PLAYER.hp, p.hp + 6 * ayuda * dt); p.shield = Math.min(PLAYER.shield, p.shield + 10 * ayuda * dt); A.stats.curado += p.hp - h0; }
  else if (bene === 'escudo') { p.shield = Math.min(PLAYER.shield, p.shield + 24 * ayuda * dt); p.hp = Math.min(PLAYER.hp, p.hp + 1.5 * ayuda * dt); }
  else if (bene === 'danio') b.dN = Math.max(b.dN, 1 + 0.25 * Math.min(1.2, ayuda));
  else if (bene === 'veloz') b.vN = Math.max(b.vN, 1 + Math.min(0.45, 0.3 * ayuda));
}
function bocaTick(g, A, o, S, ayuda, dt, vivos) {
  const ofrenda = A.ph === 'ofrenda';
  if (!ofrenda && S.zone > 0) { // defender: las criaturas dentro de la luz la apagan más rápido
    let n = 0; for (const m of g.monsters) if (!m.dead && !m.def.boss && dist(m.pos, o.pos) < o.r) n++;
    S.zone = Math.max(0, S.zone - dt * (1 + 0.35 * Math.min(6, n)));
  }
  if (!(ofrenda || S.zone > 0)) return;
  for (const p of vivos) if (dist(p.pos, o.pos) < o.r) beneficio(g, p, o.bene, ayuda, dt, A);
}
function pulmonTick(g, A, o, S, ayuda, dt, vivos) {
  S.brT += dt * (A.ph === 'dormido' ? 0.6 : 1);
  const t = S.brT % o.ciclo, ex = o.ciclo - o.inhala - o.retiene;
  if (t < o.inhala) { S.mode = 0; S.br = t / o.inhala; }
  else if (t < o.inhala + o.retiene) { S.mode = 1; S.br = 1; }
  else { S.mode = 2; S.br = 1 - (t - o.inhala - o.retiene) / ex; }
  if (S.mode !== 2 || S.br < 0.12) return;
  const toxica = A.ph === 'furioso' && !A.sed;
  if (!toxica) { for (const p of vivos) if (dist(p.pos, o.pos) < o.r) beneficio(g, p, 'cura', ayuda * 0.8, dt, A); return; }
  S.tick -= dt; const golpe = S.tick <= 0; if (golpe) S.tick = 0.5;
  for (const p of vivos) if (dist(p.pos, o.pos) < o.r) {
    if (o.mal === 'lento') p.arB.vN = Math.min(p.arB.vN, 0.6);
    if (golpe) { g.hurtPlayer(p, o.dps * 0.5 + 0.2 * g.wave); A.stats.golpes++; }
  }
  for (const m of g.monsters) if (!m.dead && !m.def.boss && dist(m.pos, o.pos) < o.r) { m.hp -= 9 * dt; if (m.hp <= 0) g.killMonster(m, credito(g, m)); }
}

/* ───────── snapshot (estado compacto para el cliente) ───────── */
/** ar = { ph, t, sed, o:[[hp%, roto, hambre%, zona(s; 99 = abierta), respiro 0-1, modo 0/1/2, golpe reciente]], tl:[[i, tipo, c(3), dir(3), r, w, quedan, total, barriendo]] } */
export function arSnap(g) {
  const A = g.ar; if (!A) return null;
  return {
    ph: A.ph, t: r2(A.t), sed: A.sed ? 1 : 0,
    o: A.org.map((S, i) => { const o = A.L.org[i]; return [S.max ? Math.round(100 * Math.max(0, S.hp) / S.max) : 100, S.roto ? 1 : 0, o.k === 'boca' ? Math.round(100 * S.fed / fedMax(g, o)) : 0, o.k === 'boca' || o.k === 'vena' ? (A.ph === 'ofrenda' ? 99 : r2(S.zone)) : 0, r2(S.br), S.mode, g.time - S.hit < 0.15 ? 1 : 0]; }),
    tl: A.tl.map((T) => [T.i, TIPO[T.tipo], ...a3(T.c), ...(T.dir ? a3(T.dir) : [0, 0, 0]), r2(T.r), r2(T.w), r2(Math.max(0, T.at - g.time)), r2(T.tel), T.sw ? 1 : 0]),
  };
}
