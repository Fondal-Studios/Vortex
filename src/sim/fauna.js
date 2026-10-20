// FAUNA CONSUMIBLE (docs/FAUNA.md): seres vivos psicodélicos que viven en las arenas y que se pueden COMER para meterse en una METAMORFOSIS temporal.
// Determinista y sin DOM: usa su PROPIO generador derivado de la semilla (g.faRng, como g.evRng / g.arRng / g.ngRng) y su propio contador de ids (g.fa.nextId):
// NUNCA toca g.rng ni g.nextId, así una partida con fauna sigue las mismas oleadas que sin ella. Datos en src/sim/fauna-data.js.
//
//   AMBIENTE  nacen sobre todo en el RESPIRO entre oleadas (en combate casi no; en el jefe nada). Cada especie vive en SU arena, cerca de lo que le gusta
//             (un órgano de la arena viva, una niebla de color) y se comporta: duerme, pasta, se pone alerta, huye (y se cansa), vuela o nada. Las «peligrosas»
//             (3) no huyen: muerden si las pisás. La lluvia de astillas y la tormenta de ecos las ahuyentan.
//   COMER     acercate a ≤ 2,7 m y apretá USAR / E (el input `interact`); con `input.autoc` se come solo al quedarte pegado ~0,6 s. En Melé, el REMATE (3.er golpe
//             o golpe pesado) devora al bicho que tengas delante («devorar»).
//   FORMA     una forma activa (60-90 s) + un residuo menor de la anterior (≤ 20 s). Comer la MISMA refresca; comer una compatible la FUSIONA en un híbrido;
//             si no, la sustituye. Los efectos se aplican por ganchos puntuales: hostHit/hostDamageIn/hostOut (huespedes.js), firePlayer (game.js), remate de Melé.
//   SNAPSHOT  `fa` = { l: bichos, z: rastros } · en cada jugador `mf` (forma), `mt` (segundos), `md` (duración total), `mr` (residuo). Eventos `{t:'fauna'…}`.
import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, project, makeRng, clone } from './math.js';
import { PLAYER } from './data.js';
import { collide, blocked } from './physics.js';
import { FAUNA, ESPECIES, ESPECIE_IDS, TODAS, HIBRIDOS, RARAS, especiesDe, especieIndice, formaIndice, hibridoDe, bonoCodice, parConExtra } from './fauna-data.js';
import { misionAlimento } from './metas.js';

const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
/** Interruptor para pruebas A/B (apagar toda la fauna sin tocar nada más). */
export const CTL = { off: false, sinSpawn: false };
export const ESTADO = { dormida: 0, pastando: 1, alerta: 2, huyendo: 3, acechando: 4, cansada: 5 };
const ZONA_K = { escarcha: 0, fuego: 1, veneno: 2, raiz: 3, vapor: 4 };
export const ZONA_IDS = Object.keys(ZONA_K);

/* ───────── estado ───────── */
export function initFauna(g) {
  g.faRng = makeRng((((g.seed | 0) ^ 0xfa07a5) * 2654435761) >>> 0);
  g.fa = null;
  if (CTL.off || g.map.base) return;   // (La Base es un hub sin fauna)
  g.fa = { list: [], nextId: 1, cd: 2.5, zonas: [], eco: [], stats: { nacidas: 0, comidas: 0, mordidas: 0, huidas: 0, remates: 0, formas: 0, hibridos: 0, raras: 0 } };
}
/** Códice del jugador para la simulación: { especie: veces comida } (duración y efectos extra). */
export function initFaunaPlayer(p, cod) {
  p.fcod = {}; if (cod && typeof cod === 'object') for (const id of ESPECIE_IDS) { const n = Math.max(0, Math.min(99999, Math.floor(Number(cod[id]) || 0))); if (n) p.fcod[id] = n; }
  p.ff = null; p.fr = null; p.fN = {}; p.faPar = null; p.faCd = 0; p.faBusy = false;
}
const vivos = (g) => g.players.filter((p) => !p.dead);
const upAt = (g, pos) => { const gv = g.map.gravityAt(pos, g.time), l = len(gv); return l > 1e-3 ? mul(gv, -1 / l) : v3(0, 1, 0); };
/** Distancia hasta el piso hacia «abajo» (marcha de 0,4 m; null si no hay piso en `max` m). */
function pisoDist(g, pos, up, max = 10) {
  for (let t = 0.2; t <= max; t += 0.5) if (blocked(g.map, madd(pos, up, -t))) return t;
  return null;
}
const hayPiso = (g, pos, up) => pisoDist(g, pos, up, 4.5) !== null;
/** Apoya un punto en el piso (marcha hacia «abajo» desde un poco más arriba). Devuelve null si no hay piso o ya está dentro de un sólido. */
function apoyar(g, pos, up, alto = 0.3) {
  const p0 = madd(pos, up, 1.2); if (blocked(g.map, p0)) return null;
  for (let t = 0; t <= 14; t += 0.3) if (blocked(g.map, madd(p0, up, -t))) return madd(p0, up, -t + alto + 0.2);
  return null;
}
const nearestPlayer = (g, pos) => { let best = null, bd = Infinity; for (const p of g.players) { if (p.dead) continue; const d = dist(p.pos, pos); if (d < bd) { bd = d; best = p; } } return best ? { p: best, d: bd } : null; };

/* ───────── elección y nacimiento ───────── */
function activa(z) { return z.ph !== 'dormida' && z.k > 0.3; }
function eclipseOn(g) { return !!(g.ev && g.ev.id === 'eclipse'); }
function susto(g) { return !!(g.ev && (g.ev.id === 'lluvia_astillas' || g.ev.id === 'tormenta_ecos')); }
function meta(g) {
  if (susto(g)) return 0;
  if (g.practice) return FAUNA.respiro.meta;
  const jefe = g.wave >= g.waveTotal && g.phase === 'wave';
  if (jefe) return FAUNA.jefe.meta;
  const extra = Math.max(0, g.players.length - 1) * 2;
  if (g.phase === 'intermission') return Math.min(FAUNA.max, FAUNA.respiro.meta + extra);
  const furioso = g.ar && g.ar.ph === 'furioso';
  return Math.min(FAUNA.max, Math.max(0, FAUNA.oleada.meta + extra - (furioso ? 2 : 0)));
}
function elegirEspecie(g) {
  const R = g.faRng, vivas = g.fa.list;
  const pel = vivas.filter((f) => f.sp.peligrosa).length, rarasVivas = vivas.filter((f) => f.sp.rara).length;
  const respiro = g.phase === 'intermission';
  if (!rarasVivas && R.next() < FAUNA.rara * (eclipseOn(g) ? 3 : 1) * (respiro ? 1 : 0.3)) return ESPECIES[RARAS[Math.floor(R.next() * RARAS.length)]];
  else R.next();   // el azar se gasta siempre: el flujo no depende de las ramas
  const zs = g.ng ? g.ng.zonas.filter(activa) : [];
  const lista = especiesDe(g.mapId).map((id) => ESPECIES[id]);
  let tot = 0; const w = lista.map((sp) => {
    let k = sp.peso;
    if (sp.peligrosa && pel >= 2) k = 0;
    if (vivas.filter((f) => f.sp === sp).length >= 4) k = 0;
    if (sp.atrae && zs.some((z) => z.tipo === sp.atrae)) k *= 3;
    if (sp.cerca && g.ar && g.ar.L.org.some((o) => o.k === sp.cerca)) k *= 1.6;
    tot += k; return k;
  });
  if (tot <= 0) return lista[0] || null;
  let r = R.next() * tot; for (let i = 0; i < lista.length; i++) { r -= w[i]; if (r <= 0) return lista[i]; }
  return lista[lista.length - 1] || null;
}
/** Dónde nace: junto a lo que le gusta (niebla, órgano) o en un punto caminable del mapa cerca de algún jugador. null si no hay lugar. */
function lugarDeNacimiento(g, sp) {
  const R = g.faRng, vs = vivos(g); if (!vs.length) return null;
  let pos = null;
  if (sp.atrae && g.ng) {
    const zs = g.ng.zonas.filter((z) => z.tipo === sp.atrae && activa(z));
    if (zs.length) { const z = zs[Math.floor(R.next() * zs.length)], a = R.next() * 6.2832, rr = Math.sqrt(R.next()) * z.r * 0.7, t1 = norm(cross(z.u, v3(1, 0, 0)), v3(0, 0, 1)), t2 = cross(z.u, t1); pos = madd(madd(z.pos, t1, Math.cos(a) * rr), t2, Math.sin(a) * rr); } else { R.next(); R.next(); }
  } else { R.next(); R.next(); }
  if (!pos && sp.cerca && g.ar) {
    const os = g.ar.L.org.filter((o) => o.k === sp.cerca);
    if (os.length) { const o = os[Math.floor(R.next() * os.length)], a = R.next() * 6.2832, rr = 3.5 + R.next() * 5, t1 = norm(cross(o.u, v3(1, 0, 0)), v3(0, 0, 1)), t2 = cross(o.u, t1); pos = madd(madd(o.pos, t1, Math.cos(a) * rr), t2, Math.sin(a) * rr); } else { R.next(); R.next(); }
  } else { R.next(); R.next(); }
  if (!pos) {   // varios candidatos del mapa: el más cercano a un jugador (pero a ≥ 9 m, para que no aparezca encima)
    const ref = vs[Math.floor(R.next() * vs.length)]; let best = null, bd = Infinity;
    for (let i = 0; i < 6; i++) {
      let c = null; try { c = g.map.spawnGround(R, ref.pos); } catch { c = null; }
      if (!c) continue; const d = dist(c, ref.pos); if (d >= 9 && d < bd) { bd = d; best = c; }
    }
    pos = best;
  }
  if (!pos) return null;
  const up = upAt(g, pos), suelo = apoyar(g, pos, up, 0.3); if (!suelo || g.map.outOfBounds(suelo)) return null;
  return { pos: suelo, up };
}
function nuevoBicho(g, sp, pos, up, grupo, estado = null) {
  const R = g.faRng, F = g.fa, t1 = norm(cross(up, v3(1, 0, 0)), v3(0, 0, 1));
  const ang = R.next() * 6.2832, fwd = norm(add(mul(t1, Math.cos(ang)), mul(cross(up, t1), Math.sin(ang))));
  const f = { id: F.nextId++, sp, pos: clone(pos), vel: v3(), up: clone(up), fwd, st: estado || (R.next() < sp.dorm ? 'dormida' : 'pastando'), stT: 0, tgt: null, grupo, vida: R.range(FAUNA.vida[0], FAUNA.vida[1]) * (sp.rara ? 1.6 : 1), cansancio: 0, cansada: 0, muerdeCd: 0, h: sp.vuelo ? sp.vuelo : 0, alt: sp.vuelo ? sp.vuelo * (0.8 + 0.4 * R.next()) : 0, born: g.time, ph: R.next() * 6.28, bordeT: 0, forzada: false };
  if (sp.vuelo) f.pos = madd(f.pos, up, f.alt * 0.6);
  F.list.push(f); F.stats.nacidas++;
  if (sp.rara) { F.stats.raras++; g.emit({ t: 'fauna', ph: 'rara', sp: especieIndice(sp.id), p: a3(f.pos) }); }
  return f;
}
/** Nace un bicho (o un grupo). Devuelve la lista de bichos creados. */
function nacer(g, sp = null) {
  const F = g.fa; sp = sp || elegirEspecie(g); if (!sp) return [];
  const lg = lugarDeNacimiento(g, sp); if (!lg) return [];
  const R = g.faRng, n = Math.max(1, Math.min(FAUNA.max - F.list.length, Math.floor(sp.grupo[0] + R.next() * (sp.grupo[1] - sp.grupo[0] + 0.999)))), out = [];
  if (F.list.length >= FAUNA.max) return [];
  const grupo = F.nextId;
  for (let i = 0; i < Math.max(1, n); i++) {
    let pos = lg.pos;
    if (i > 0) { const a = R.next() * 6.2832, t1 = norm(cross(lg.up, v3(1, 0, 0)), v3(0, 0, 1)), t2 = cross(lg.up, t1); const c = apoyar(g, madd(madd(lg.pos, t1, Math.cos(a) * 2), t2, Math.sin(a) * 2), lg.up, 0.3); pos = c || lg.pos; } else { R.next(); }
    out.push(nuevoBicho(g, sp, pos, lg.up, grupo, i > 0 ? out[0].st : null));
  }
  return out;
}
/** Para pruebas y modo desarrollo: crea un bicho de la especie pedida en `pos` (o donde diga el nacimiento normal). */
export function faunaSpawn(g, espId, pos = null, estado = null) {
  const F = g.fa, sp = ESPECIES[espId]; if (!F || !sp) return null;
  if (!pos) { const r = nacer(g, sp); return r[0] || null; }
  const up = upAt(g, pos);
  return nuevoBicho(g, sp, pos, up, F.nextId, estado || 'pastando');
}
/** Misión «Alimentación»: asegura que haya una especie rara cerca de algún jugador. */
export function faunaForzarRara(g) {
  const F = g.fa, vs = vivos(g); if (!F || !vs.length) return null;
  const viva = F.list.find((f) => f.sp.rara); if (viva) { viva.vida = Math.max(viva.vida, 200); viva.forzada = true; return viva; }
  const sp = ESPECIES[RARAS[Math.floor(g.faRng.next() * RARAS.length)]];
  for (let i = 0; i < 6; i++) { const r = nacer(g, sp); if (r[0]) { r[0].vida = 220; r[0].forzada = true; return r[0]; } }
  return null;
}

/* ───────── comportamiento de un bicho ───────── */
function tangente(v, up) { return project(v, up); }
function elegirDestino(g, f) {
  const R = g.faRng, up = f.up, t1 = norm(cross(up, v3(1, 0, 0)), v3(0, 0, 1)), t2 = cross(up, t1), a = R.next() * 6.2832, d = 3 + R.next() * 6;
  const c = madd(madd(f.pos, t1, Math.cos(a) * d), t2, Math.sin(a) * d);
  if (!f.sp.vuelo && !hayPiso(g, c, up)) return null;
  return c;
}
/** Mueve un bicho hacia una velocidad deseada en el plano tangente; los voladores mantienen su altura sobre el piso. */
function mover(g, f, dt, want, rapidez) {
  const up = f.up, sp = f.sp;
  let w = tangente(want, up), l = len(w);
  if (l > 1e-4) w = mul(w, rapidez / l); else w = v3();
  if (!sp.vuelo && l > 1e-4 && (f.bordeT -= dt) <= 0) {   // borde de isla / foso: no camina hacia el vacío (se queda quieta: queda «acorralada» y se deja comer)
    f.bordeT = 0.12;
    const ahead = madd(f.pos, norm(w), 1.1 + f.sp.tam); if (!hayPiso(g, ahead, up)) { f.sinPiso = true; } else f.sinPiso = false;
  }
  if (f.sinPiso && !sp.vuelo) w = v3();
  if (len(w) > 0.05) f.fwd = norm(w, f.fwd);
  let vu = 0;
  if (sp.vuelo) {
    const pd = (f.pisoT = (f.pisoT || 0) - dt) > 0 ? f.pisoD : (f.pisoT = 0.3, f.pisoD = pisoDist(g, f.pos, up, 12));
    const hacia = pd === null ? 0 : (f.alt + 0.35 * Math.sin(g.time * 1.7 + f.ph)) - pd;
    vu = Math.max(-3, Math.min(3, hacia * 2));
  }
  const gv = g.map.gravityAt(f.pos, g.time);
  if (sp.vuelo) f.vel = add(w, mul(up, vu));
  else {
    const vn = dot(f.vel, up);
    f.vel = add(w, mul(up, vn)); f.vel = madd(f.vel, gv, dt);
    if (sp.mov === 2 && l > 1e-4 && f.salto !== undefined) { f.salto -= dt; if (f.salto <= 0) { f.vel = madd(f.vel, up, 5.5); f.salto = 0.35 + 0.15 * Math.sin(f.ph); } }   // las ranas y grillos van a saltos
    else if (sp.mov === 2 && f.salto === undefined) f.salto = 0.2;
  }
  f.pos = madd(f.pos, f.vel, dt);
  const c = collide(g.map, f.pos, f.vel, Math.max(0.3, sp.tam * 0.55), up);
  void c;
  f.up = upAt(g, f.pos);
  if (g.map.outOfBounds(f.pos)) f.vida = -1;
}
function cambiar(f, st) { if (f.st !== st) { f.st = st; f.stT = 0; } }

function tickBicho(g, f, dt, asusto) {
  const sp = f.sp; f.stT += dt; f.vida -= dt * (asusto ? 5 : 1);
  f.muerdeCd = Math.max(0, f.muerdeCd - dt);
  const np = nearestPlayer(g, f.pos);
  let det = sp.alerta; if (np) { if (np.p.input && np.p.input.crouch) det *= 0.65; if (np.p.ff && (TODAS[np.p.ff.id].par.cloak)) det *= 0.55; }
  const d = np ? np.d : 1e9;
  const al = np ? tangente(sub(f.pos, np.p.pos), f.up) : v3();
  let want = v3(), rap = 0;
  if ((asusto || f.sale) && f.st !== 'huyendo' && f.st !== 'cansada') { cambiar(f, 'huyendo'); g.fa.stats.huidas++; }
  switch (f.st) {
    case 'dormida': {   // duerme hasta que te acerques haciendo ruido: corriendo se despierta de lejos, caminando despacio o agachado se la puede alcanzar
      f.vel = v3();
      const ruido = np ? len(project(np.p.vel, np.p.up)) : 0, wake = Math.max(1.0, Math.min(4.2, 1.5 + 0.22 * ruido)) * (np && np.p.input && np.p.input.crouch ? 0.6 : 1);
      if (d < wake || f.stT > 70) cambiar(f, 'alerta');
      break; }
    case 'pastando':
      if (!f.tgt || dist(f.pos, f.tgt) < 0.8 || f.stT > 7) { f.tgt = elegirDestino(g, f); f.stT = 0; f.pausa = f.tgt ? 0 : 1.2; }
      if ((f.pausa = (f.pausa || 0) - dt) > 0 || !f.tgt) { want = v3(); rap = 0; }
      else { want = sub(f.tgt, f.pos); rap = sp.vel * (sp.vuelo ? 1 : 0.6); }
      if (np && d < det) cambiar(f, sp.peligrosa ? 'acechando' : 'alerta');
      break;
    case 'alerta': {
      f.vel = v3(); if (np) f.fwd = norm(tangente(sub(np.p.pos, f.pos), f.up), f.fwd);
      if (np && f.stT > 0.55 && d < det * 0.8 || np && d < 1.3 && f.stT > 0.3) { cambiar(f, 'huyendo'); g.fa.stats.huidas++; }   // tiempo de reacción: ~0,5 s para alcanzarla
      else if (!np || d > det * 1.4) cambiar(f, 'pastando');
      break; }
    case 'acechando': {   // las peligrosas no huyen: se quedan, miran y, si te acercás, se te tiran
      if (np) f.fwd = norm(tangente(sub(np.p.pos, f.pos), f.up), f.fwd);
      if (np && d < 3.2 && f.stT > 0.4) { want = sub(np.p.pos, f.pos); rap = sp.vel * 0.9; }
      if (np && d < FAUNA.muerde.alcance + sp.tam * 0.5 && f.muerdeCd <= 0 && !np.p.dead) morder(g, f, np.p);
      if (!np || d > det * 1.6) cambiar(f, 'pastando');
      break; }
    case 'huyendo': case 'cansada': {
      const cansada = f.st === 'cansada';
      if (!cansada) { f.cansancio += dt; if (f.cansancio > 5.5 + (sp.vuelo ? -1 : 0)) { f.cansada = 3.5; cambiar(f, 'cansada'); break; } }
      else if (f.stT > f.cansada) { f.cansancio = 0; cambiar(f, np && d < det * 0.7 ? 'huyendo' : 'alerta'); break; }
      let dir = np ? norm(al, f.fwd) : f.fwd;
      const lat = cross(f.up, dir); dir = norm(madd(dir, lat, 0.45 * Math.sin(g.time * 3.1 + f.ph)));   // zigzag
      want = dir; rap = sp.corre * (cansada ? 0.4 : 1);
      if (!cansada && f.stT > 1 && np && d > det * 1.8) { f.cansancio = 0; cambiar(f, 'pastando'); }
      break; }
    default: break;
  }
  if (f.st === 'dormida' && !sp.vuelo) return;
  mover(g, f, dt, want, rap);
}
function morder(g, f, p) {
  const M = FAUNA.muerde; f.muerdeCd = M.cd; g.fa.stats.mordidas++;
  const dmg = Math.min(M.dano + M.porOla * g.wave, Math.max(0, p.hp + p.shield - M.vidaMin));
  if (dmg > 0) g.hurtPlayer(p, dmg);
  g.emit({ t: 'fauna', ph: 'muerde', sp: especieIndice(f.sp.id), p: a3(f.pos), pid: p.id });
  cambiar(f, 'pastando'); f.tgt = null;
}

/* ───────── formas: dar, parámetros efectivos, fin ───────── */
/** Parámetros efectivos del jugador: forma activa (con efecto extra del Códice) + residuo menor. null si no hay nada. */
export function parDe(p) {
  const key = `${p.ff ? p.ff.id + (p.ff.extra ? 'x' : '') : ''}|${p.fr ? p.fr.id : ''}`;
  if (p.faPar && p.faPar.key === key) return p.faPar.par;
  let par = null;
  if (p.ff) par = { ...parConExtra(TODAS[p.ff.id], p.ff.extra) };
  if (p.fr && TODAS[p.fr.id]) {
    const R = parConExtra(TODAS[p.fr.id], false), k = FAUNA.residuoK, o = par || {};
    for (const c of ['dIn', 'dOut', 'spd', 'jump']) if (R[c] !== undefined) o[c] = (o[c] ?? 1) * (1 + (R[c] - 1) * k);
    for (const c of ['regen', 'sreg']) if (R[c]) o[c] = (o[c] || 0) + R[c] * k;
    par = o;
  }
  p.faPar = { key, par }; return par;
}
/** Le da a `p` la forma de la especie `espId`. Fusiona (híbrido), refresca o sustituye. Devuelve { hibrido, refresca, forma }. */
export function darForma(g, p, espId) {
  const sp = ESPECIES[espId]; if (!sp) return null;
  const cod = bonoCodice((p.fcod && p.fcod[espId]) || 0);
  let dur = Math.min(FAUNA.duracionMax, sp.dur * cod.durK + cod.durMas);
  const extra = cod.extra, actual = p.ff;
  let id = sp.forma, hibrido = false, refresca = false, base = [sp.forma];
  if (actual) {
    const bases = actual.base || [actual.id];
    if (bases.includes(sp.forma)) { refresca = true; id = actual.id; base = bases; dur = Math.min(FAUNA.duracionMax, Math.max(actual.t, dur * 0.6) + dur * 0.4); }
    else if (!actual.base || actual.base.length === 1) {
      const h = hibridoDe(actual.id, sp.forma);
      if (h) { id = h; hibrido = true; base = [actual.id, sp.forma]; dur = Math.min(FAUNA.duracionMax, Math.max(dur, actual.t) + 10); }
    }
    if (!refresca && !hibrido) {   // sustituye: la anterior queda como residuo menor
      p.fr = { id: actual.id, t: Math.min(actual.t, FAUNA.residuoMax * cod.residuoK) };
    }
  }
  p.ff = { id, t: dur, d: dur, base: base.length > 1 ? base : null, sp: espId, extra: !!extra || (refresca && actual && actual.extra) };
  p.faPar = null; p.faPhaseCd = 0; p.faTrailT = 0;
  const F = TODAS[id], en = F.par.entra;
  if (en && !refresca) { if (en.sh) p.shield = Math.min(PLAYER.shield, p.shield + en.sh); if (en.hp) p.hp = Math.min(PLAYER.hp, p.hp + en.hp); }
  g.fa.stats.formas++; if (hibrido) g.fa.stats.hibridos++;
  return { hibrido, refresca, forma: F };
}
function finForma(g, p) {
  g.emit({ t: 'fauna', ph: 'fin', pid: p.id, f: formaIndice(p.ff.id), p: a3(p.pos) });
  p.ff = null; p.faPar = null;
}

/** Come un bicho: lo retira, da la forma y avisa (evento `fauna` ph `come`). */
export function comer(g, p, f) {
  const F = g.fa; if (!F || p.dead) return false;
  const i = F.list.indexOf(f); if (i < 0) return false;
  F.list.splice(i, 1);
  const r = darForma(g, p, f.sp.id); if (!r) return false;
  p.fN[f.sp.id] = (p.fN[f.sp.id] || 0) + 1; F.stats.comidas++;
  g.emit({ t: 'fauna', ph: 'come', sp: especieIndice(f.sp.id), p: a3(f.pos), pid: p.id, f: formaIndice(p.ff.id), h: r.hibrido ? 1 : 0, rf: r.refresca ? 1 : 0, n: p.fN[f.sp.id], d: Math.round(p.ff.d) });
  if (r.hibrido) g.emit({ t: 'fauna', ph: 'hibrido', pid: p.id, f: formaIndice(p.ff.id), p: a3(p.pos) });
  misionAlimento(g, f.sp);
  return true;
}
const masCercano = (g, pos, max, filtro = null) => { let best = null, bd = max; for (const f of g.fa.list) { if (filtro && !filtro(f)) continue; const d = dist(f.pos, pos); if (d < bd) { bd = d; best = f; } } return best; };

/* ───────── rastros en el suelo (escarcha, fuego, raíces, nubes) ───────── */
function addZona(g, k, pos, u, r, life, dps, slow, pid) {
  const F = g.fa, Z = F.zonas;
  if (Z.length >= FAUNA.zonasMax) Z.shift();
  Z.push({ k, pos: clone(pos), u: clone(u), r, life, born: g.time, dps: dps || 0, slow: slow || 0, pid });
}
function tickZonas(g, dt) {
  const F = g.fa; if (!F.zonas.length) return;
  F.zonas = F.zonas.filter((z) => g.time - z.born < z.life);
  for (const z of F.zonas) {
    const by = g.players.find((q) => q.id === z.pid) || null;
    for (const m of g.monsters) {
      if (m.dead || m.def.boss || dist(m.pos, z.pos) > z.r + m.r) continue;
      if (z.slow) m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.4);
      if (z.dps) { m.hp -= z.dps * dt; m.hurt = Math.max(m.hurt || 0, 0.05); if (m.hp <= 0) g.killMonster(m, by); }
    }
  }
}

/* ───────── paso principal (1 por tick) ───────── */
export function tickFauna(g, dt) {
  const F = g.fa; if (!F) { for (const p of g.players) tickJugador(g, p, dt); return; }
  const asusto = susto(g), vs = vivos(g);
  // nacimientos
  if (!CTL.sinSpawn && vs.length) {
    F.cd -= dt;
    if (F.cd <= 0) {
      const respiro = g.phase === 'intermission' || g.practice, M = meta(g);
      F.cd = respiro ? FAUNA.respiro.cada : FAUNA.oleada.cada;
      if (F.list.length < M && F.list.length < FAUNA.max) nacer(g);
      else g.faRng.next();
    }
  }
  // vida de los bichos
  const quedan = [], M0 = meta(g);
  const quedaran = F.list.filter((f) => !f.sale).length;
  if (quedaran > M0 + 1 && (F.saleT = (F.saleT || 0) - dt) <= 0) {   // más bichos de los que tocan (empezó el combate, el jefe, la lluvia…): el más lejano se va corriendo, de a uno
    F.saleT = 2.5; let lej = null, ld = -1; for (const f of F.list) { if (f.sale || f.forzada) continue; const q = nearestPlayer(g, f.pos); if (q && q.d > ld) { ld = q.d; lej = f; } }
    if (lej) { lej.sale = true; lej.vida = Math.min(lej.vida, 7); }
  }
  for (const f of F.list) {
    tickBicho(g, f, dt, asusto);
    const np = nearestPlayer(g, f.pos);
    if (f.vida <= 0 || !np || np.d > FAUNA.lejos) continue;
    quedan.push(f);
  }
  F.list = quedan;
  // consumo (USAR / E) y auto-consumo
  for (const p of vs) intentarComer(g, p, dt);
  tickZonas(g, dt);
  for (const p of g.players) tickJugador(g, p, dt);
  // ecos (golpes repetidos) pendientes
  if (F.eco.length) {
    const resto = [];
    for (const e of F.eco) {
      if (g.time < e.at) { resto.push(e); continue; }
      const m = g.monsters.find((q) => q.id === e.m), by = g.players.find((q) => q.id === e.pid);
      if (m && !m.dead && by && !by.dead) { by.faBusy = true; try { g.damageMonster(m, e.dmg, by, m.pos); } finally { by.faBusy = false; } g.emit({ t: 'fxeco', p: a3(m.pos) }); }
    }
    F.eco = resto;
  }
}
function intentarComer(g, p, dt) {
  const F = g.fa, inp = p.input; if (!inp) return;
  const edge = !!inp.interact && !p.faPrevUse; p.faPrevUse = !!inp.interact;
  let cand = null;
  if (edge) cand = masCercano(g, p.pos, FAUNA.alcance);
  if (!cand && inp.autoc) {
    const c = masCercano(g, p.pos, 1.7, (f) => f.st !== 'huyendo');
    if (c) { p.faAuto = (p.faAuto || 0) + dt; if (p.faAuto >= 0.6) { cand = c; p.faAuto = 0; } } else p.faAuto = 0;
  } else if (!inp.autoc) p.faAuto = 0;
  if (cand) comer(g, p, cand);
  void F;
}
function tickJugador(g, p, dt) {
  if (!p.ff && !p.fr) return;
  if (p.dead) { if (p.ff) finForma(g, p); p.fr = null; p.faPar = null; return; }   // al caer, la metamorfosis se pierde
  const par = parDe(p);
  if (p.fr) { p.fr.t -= dt; if (p.fr.t <= 0) { p.fr = null; p.faPar = null; } }
  if (p.ff) { p.ff.t -= dt; if (p.ff.t <= 0) { finForma(g, p); } }
  if (!par) return;
  if (par.regen) p.hp = Math.min(PLAYER.hp, p.hp + par.regen * dt);
  if (par.sreg && g.time - p.lastHurt > 1.5) p.shield = Math.min(PLAYER.shield, p.shield + par.sreg * dt);
  if (par.cdTick) for (const k of ['movCd', 'espCd', 's3Cd', 'abilityCd']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt * par.cdTick);
  if (par.cloak && !p.cloakBonus && g.time - (p.faAtk || -9) > 1.2 && g.time >= (p.cloakUntil || 0) - 0.1) p.cloakUntil = g.time + 0.4;
  if (par.trail && p.ff) {
    const T = par.trail; p.faTrailT = (p.faTrailT || 0) - dt;
    const rap = len(project(p.vel, p.up));
    if (p.faTrailT <= 0 && rap > 2 && p.grounded) { p.faTrailT = T.every; addZona(g, ZONA_K[T.k] ?? 0, madd(p.pos, p.up, -PLAYER.eye * 0 - 0.8), p.up, T.r, T.life, T.dps, T.slow, p.id); }
  }
  if (par.aura) {
    const A = par.aura;
    for (const m of g.monsters) {
      if (m.dead || m.def.boss || dist(m.pos, p.pos) > A.r + m.r) continue;
      m.slowUntil = Math.max(m.slowUntil || 0, g.time + 0.35);
      if (A.dps) { m.hp -= A.dps * dt; m.hurt = Math.max(m.hurt || 0, 0.05); if (m.hp <= 0) g.killMonster(m, p); }
    }
  }
}

/* ───────── ganchos de combate ───────── */
/** Multiplicador de velocidad (huespedes.js → updateHost). Incluye la escarcha propia (hielo). */
export function faunaSpd(g, p) {
  const par = p.ff || p.fr ? parDe(p) : null; if (!par) return 1;
  let k = par.spd ?? 1;
  if (par.trail && par.trail.spd && g.fa && g.fa.zonas.some((z) => z.pid === p.id && z.k === ZONA_K[par.trail.k] && dist(z.pos, p.pos) < z.r + 0.9)) k *= 1 + par.trail.spd;
  return k;
}
export const faunaJump = (g, p) => { const par = p.ff || p.fr ? parDe(p) : null; return par && par.jump ? par.jump : 1; };
/** Multiplicador del daño que hace el jugador (huespedes.js → hostOut). */
export function faunaOut(g, p) { const par = p.ff || p.fr ? parDe(p) : null; return par && par.dOut ? par.dOut : 1; }
/** Daño que recibe el jugador (huespedes.js → hostDamageIn, al final de la cadena). Aquí viven la resistencia, la fase, el reflejo y las espinas. */
export function faunaDamageIn(g, p, dmg) {
  const par = p.ff || p.fr ? parDe(p) : null; if (!par || dmg <= 0) return dmg;
  const pre = dmg;
  if (par.phase && p.ff && g.time >= (p.faPhaseCd || 0)) {
    p.faPhaseCd = g.time + par.phase[0]; p.invulUntil = Math.max(p.invulUntil, g.time + par.phase[1]);
    g.emit({ t: 'fauna', ph: 'fase', pid: p.id, p: a3(p.pos) }); return 0;
  }
  if (par.dIn) dmg *= par.dIn;
  if (par.vulnAmbar && p.ngB && p.ngB.dIn > 1.01) dmg *= par.vulnAmbar;
  if ((par.reflect || par.thorns) && !p.faBusy && p.ff) {
    p.faBusy = true;
    try {
      if (par.reflect) { const m = g.monsters.find((q) => !q.dead && !q.def.boss && dist(q.pos, p.pos) < 7 + q.r); if (m) { g.damageMonster(m, pre * par.reflect, p, m.pos); g.emit({ t: 'arc', o: a3(p.pos), to: a3(m.pos) }); } }
      if (par.thorns) { let n = 0; for (const m of g.monsters) { if (n >= 3) break; if (!m.dead && dist(m.pos, p.pos) < 3.6 + m.r) { g.damageMonster(m, pre * par.thorns, p, m.pos); n++; } } }
    } finally { p.faBusy = false; }
  }
  return dmg;
}
/** Dispara en Shooter: la forma cambia la munición (atraviesa, color del rastro). `w` es el arma efectiva de este disparo. */
export function shapeFauna(w, p) {
  const par = p.ff || p.fr ? parDe(p) : null; if (!par) return;
  if (par.pierce && w.kind === 'hitscan') w.pierce = true;
  const f = p.ff ? TODAS[p.ff.id] : null; if (!f) return;
  const b = p.ff.base || [p.ff.id];
  w.fxk = b.includes('hielo') ? 'glaciar' : b.includes('brasa') ? 'brasa' : b.includes('electrica') || b.includes('cobre') || b.includes('sonico') ? 'voltaico' : w.fxk;
}
function estado(g, m, p, st) {   // estados de ralentizar/congelar/quemar/envenenar. Los jefes resisten el congelar (sólo se ralentizan menos).
  const jefe = !!m.def.boss;
  if (st.slow && !jefe) m.slowUntil = Math.max(m.slowUntil || 0, g.time + st.slow);
  if (st.freeze && !jefe) { m.chronoUntil = Math.max(m.chronoUntil || 0, g.time + st.freeze); m.slowUntil = Math.max(m.slowUntil || 0, g.time + st.freeze); }
  if (st.burn && (g.time >= (m.dotUntil || 0) || st.burn[0] >= (m.dotDps || 0))) { m.dotUntil = g.time + st.burn[1]; m.dotDps = st.burn[0]; m.dotKind = 'burn'; m.dotBy = p.id; }
  if (st.poison && (g.time >= (m.dotUntil || 0) || st.poison[0] >= (m.dotDps || 0))) { m.dotUntil = g.time + st.poison[1]; m.dotDps = st.poison[0]; m.dotKind = 'poison'; m.dotBy = p.id; }
}
/** Tras cada impacto de un jugador (huespedes.js → hostHit). Aquí viven los efectos «por golpe» de cada forma. */
export function faunaHit(g, p, m, dealt) {
  if (p.faBusy || !p.ff) return;
  const par = parDe(p); if (!par) return;
  const src = g.dmgSrc || (p.inMelee ? 'melee' : 'gun'); if (src === 'skill') return;
  p.faAtk = g.time;
  const R = g.faRng ? g.faRng : null; const rnd = () => (R ? R.next() : 0.5);
  const dead = m.hp <= 0;
  // estados (sobre el que sigue vivo)
  if (!dead) {
    const st = {};
    if (par.slow && rnd() < par.slow[0]) st.slow = par.slow[1];
    if (par.freeze && rnd() < par.freeze[0]) { st.freeze = par.freeze[1]; if (!m.def.boss) g.emit({ t: 'fauna', ph: 'hiela', p: a3(m.pos) }); }
    if (par.burn) st.burn = par.burn; if (par.poison) st.poison = par.poison;
    estado(g, m, p, st);
    if (par.push && !m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), par.push);
  }
  if (par.lifesteal && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + dealt * par.lifesteal);
  if (g.time < (p.faCd || 0)) return;   // los efectos «de lujo» (cadena, nube, eco, deslumbre) no salen en ametralladora
  p.faCd = g.time + FAUNA.procCd;
  p.faBusy = true;
  try {
    if (par.chain && !dead) {
      const used = new Set([m.id]); let cur = m;
      for (let i = 0; i < par.chain[0]; i++) {
        let best = null, bd = 11; for (const q of g.monsters) { if (q.dead || used.has(q.id)) continue; const d = dist(q.pos, cur.pos); if (d < bd) { bd = d; best = q; } }
        if (!best) break; used.add(best.id); g.damageMonster(best, dealt * par.chain[1], p, best.pos); g.emit({ t: 'arc', o: a3(cur.pos), to: a3(best.pos) });
        if (par.chainFreeze && !best.dead && !best.def.boss && rnd() < par.chainFreeze) estado(g, best, p, { freeze: 1 });
        cur = best;
      }
    }
    if (par.nube && rnd() < par.nube.p) addZona(g, ZONA_K.veneno, m.pos, m.up || p.up, par.nube.r, par.nube.life, par.nube.dps, par.nube.slow, p.id);
    if (par.daze && !dead && rnd() < par.daze[0]) { for (const q of g.monsters) if (!q.dead && !q.def.boss && dist(q.pos, m.pos) < par.daze[1]) q.slowUntil = Math.max(q.slowUntil || 0, g.time + par.daze[2]); g.emit({ t: 'fauna', ph: 'destello', p: a3(m.pos) }); }
    if (par.eco && !dead && rnd() < par.eco && g.fa.eco.length < 6) g.fa.eco.push({ m: m.id, pid: p.id, at: g.time + 0.35, dmg: dealt * 0.5 });
  } finally { p.faBusy = false; }
}
/** REMATE de Melé (huespedes.js → strike y combos.js → resolve): devora al bicho de enfrente y suelta el golpe elemental de la forma. */
export function faunaMelee(g, p, o, dir, range, fin) {
  const F = g.fa; if (!F || !fin || p.dead) return 0;
  let n = 0;
  const bicho = masCercano(g, o, Math.max(FAUNA.alcanceBoca, range + 1.2), (f) => dot(norm(sub(f.pos, o)), dir) > -0.15);
  if (bicho && comer(g, p, bicho)) { n++; g.emit({ t: 'fauna', ph: 'devora', pid: p.id, p: a3(bicho.pos) }); }
  const par = p.ff ? parDe(p) : null;
  if (par && par.fin && g.time >= (p.faFinCd || 0) && !p.faBusy) {
    p.faFinCd = g.time + FAUNA.remateCd; F.stats.remates++;
    const X = par.fin, c = madd(o, dir, Math.min(range, 3)), dm = X.dmg * (1 + 0.06 * g.wave) * (p.ff.extra ? 1.1 : 1);
    p.faBusy = true;
    try {
      let hits = 0;
      for (const m of g.monsters) {
        if (m.dead || dist(m.pos, c) > X.r + m.r) continue;
        g.damageMonster(m, dm, p, m.pos); hits++;
        if (m.dead) continue;
        estado(g, m, p, { freeze: X.freeze && g.faRng.next() < X.freeze ? X.secs || 1.2 : 0, slow: X.slow, burn: X.burn, poison: X.poison });
        if (X.push && !m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, c), dir), X.push);
        if (X.pull && !m.def.boss) m.vel = madd(m.vel, norm(sub(c, m.pos), dir), X.pull);
        if (X.daze) m.slowUntil = Math.max(m.slowUntil || 0, g.time + X.daze);
      }
      if (X.heal && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + X.heal + Math.min(hits, 4) * 2);
      if (X.chain) { const m0 = g.monsters.filter((m) => !m.dead && dist(m.pos, c) < X.r + 2).slice(0, X.chain); for (let i = 0; i + 1 < m0.length; i++) g.emit({ t: 'arc', o: a3(m0[i].pos), to: a3(m0[i + 1].pos) }); }
    } finally { p.faBusy = false; }
    g.emit({ t: 'fauna', ph: 'remate', pid: p.id, k: X.k, p: a3(c), r: X.r, f: formaIndice(p.ff.id) });
    n++;
  }
  return n;
}

/* ───────── snapshot ───────── */
const ESTADO_I = { dormida: 0, pastando: 1, alerta: 2, huyendo: 3, acechando: 4, cansada: 5 };
/** fa = null | { l: [[id, especie, x,y,z, ux,uy,uz, fx,fy,fz, estado]], z: [[tipo, x,y,z, r, restante(0-1), ux,uy,uz]] } */
export function faunaSnap(g) {
  const F = g.fa; if (!F || (!F.list.length && !F.zonas.length)) return null;
  const q = (v) => Math.round(v * 100) / 100;
  return {
    l: F.list.map((f) => [f.id, especieIndice(f.sp.id), q(f.pos.x), q(f.pos.y), q(f.pos.z), r1(f.up.x), r1(f.up.y), r1(f.up.z), r1(f.fwd.x), r1(f.fwd.y), r1(f.fwd.z), ESTADO_I[f.st] ?? 1]),
    z: F.zonas.map((z) => [z.k, q(z.pos.x), q(z.pos.y), q(z.pos.z), z.r, r2(Math.max(0, 1 - (g.time - z.born) / z.life)), r1(z.u.x), r1(z.u.y), r1(z.u.z)]),
  };
}
/** Campos del jugador: mf forma (índice+1) · mt segundos que quedan · md duración total · mr residuo (índice+1). Nada si no hay forma. */
export function faunaPlayerSnap(g, p) {
  if (!p.ff && !p.fr) return {};
  const o = {};
  if (p.ff) { o.mf = formaIndice(p.ff.id); o.mt = Math.round(p.ff.t * 10) / 10; o.md = Math.round(p.ff.d); }
  if (p.fr) o.mr = formaIndice(p.fr.id);
  return o;
}
void HIBRIDOS; void add; void ZONA_IDS;
