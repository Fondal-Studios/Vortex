// MECÁNICAS DE LOS JEFES por fases (docs/JEFES.md). Determinista y sin DOM: usa el generador propio de la IA (iaRand), NUNCA g.rng.
// Cada jefe de las 6 arenas tiene 4 fases (por vida), un repertorio de ataques con TELEGRAFÍA de al menos 1 s (marcas en el suelo que
// viajan en el snapshot), ventanas de vulnerabilidad, partes destruibles, una mecánica de equipo y UN MOMENTO ÚNICO. La IA adaptativa
// (jefe-ia.js) decide QUÉ ataques pesan más según cómo jugás. Política «sin teletransportes»: el jefe sólo se mueve con velocidad limitada
// (picadas, caídas con arco visible, subidas lentas); nunca cambia de lugar de golpe.
import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, project, clone, clamp } from './math.js';
import { blocked } from './physics.js';
import { MONSTERS } from './data.js';
import { JEFES, REPERTORIO, FASE_UMBRALES, IA, POSTURAS } from './jefe-data.js';
import { iaRand, iaFase, iaEstilo, iaDistMedia } from './jefe-ia.js';
import { nieblaTemporal } from './nieblas.js';
import { floraElemento } from './flora.js';

const r2 = (n) => Math.round(n * 10) / 10;
const a3 = (v) => [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, Math.round(v.z * 10) / 10];
const UP = v3(0, 1, 0);
const vivos = (g) => g.players.filter((p) => !p.dead);
/** Daño del jefe a un jugador: crece con la oleada (como el de las criaturas) y con el enfurecimiento por tiempo. */
const D = (g, m, v) => v * (1 + 0.04 * (g.wave - 1)) * (1 + IA.enrageDanio * (m.ia ? m.ia.enr : 0));
const rnd = (m) => iaRand(m.ia);
const MAX_MARCAS = 16;

/* ───────── estado ───────── */
export function mecInit(g, m) {
  const J = JEFES[g.mapId] || JEFES.m1, a = g.map.bossAnchor, esfera = !!g.map.R;
  let gy = 0;
  if (!esfera) { gy = a.y - 40; for (let y = a.y; y > a.y - 80; y -= 0.5) if (blocked(g.map, v3(a.x, y, a.z))) { gy = y + 0.5; break; } }
  m.mec = {
    J: g.mapId, f: 1, t: 0, act: null, cd: 9 + rnd(m) * 2, dCd: 22 + rnd(m) * 4, uCd: 0, unicoPend: false, unicoHecho: 0,
    tg: [], haz: [], bajo: 0, nu: 0, vuln: 1, refl: 0, spin: 0, velo: 0, prot: 0, gy, esfera, low: null, goal: null, speed: 0, rise: false,
    crias: [], brotes: [], dark: 0, rcd: 0, silencio: 0,
  };
  m.fase = 1; m.phase = 1;
  return m.mec;
}
export const mecBajo = (m) => !!(m.mec && m.mec.bajo > 0);
export const mecNucleo = (m) => !!(m.mec && m.mec.nu > 0);

/* ───────── geometría ───────── */
/** Punto del suelo bajo el jefe (mapas planos: bajo el ancla; mapa esférico: el casco hacia donde está el equipo). */
function sueloBajo(g, m) {
  const M = m.mec, a = g.map.bossAnchor;
  if (!M.esfera) return v3(a.x, M.gy, a.z);
  const vs = vivos(g); let c = v3(); for (const p of vs) c = add(c, p.pos);
  const d = norm(c, mul(vs[0] ? vs[0].up : UP, -1));
  return mul(d, g.map.R - 0.6);
}
/** Posición «baja» del jefe: tocando el suelo en su sitio (altura = su radio de colisión + un poco). */
function posBaja(g, m) {
  const M = m.mec, cr = m.r * 0.92 + 0.8;
  if (M.esfera) return mul(norm(sueloBajo(g, m)), g.map.R - 0.6 - cr);
  return v3(g.map.bossAnchor.x, M.gy + cr, g.map.bossAnchor.z);
}
/** Centro de los ataques «alrededor del jefe»: el suelo bajo él. En el mapa esférico la Madre sólo tiene «suelo» cuando se asoma (está baja). */
const ctr = (g, m) => (m.mec.esfera && !m.mec.bajo ? null : sueloBajo(g, m));
/** Distancia «en planta» de un jugador a un punto del suelo y su altura sobre él. */
function planta(p, c) { const v = sub(p.pos, c), h = dot(v, p.up); return { fl: len(project(v, p.up)), h, v }; }

function marca(m, k, pos, r, T, c, ex = {}) {
  const M = m.mec; if (M.tg.length >= MAX_MARCAS) M.tg.shift();
  const mk = { k, x: pos.x, y: pos.y, z: pos.z, r, t: T, T, c, ...ex }; M.tg.push(mk); return mk;
}
const quitar = (m, mk) => { m.mec.tg = m.mec.tg.filter((x) => x !== mk); };

/** Daño en círculo sobre el suelo: jugadores a menos de r en planta y a poca altura. */
function golpeCirculo(g, m, c, r, dmg, o = {}) {
  let n = 0;
  for (const p of vivos(g)) {
    const { fl, h, v } = planta(p, c);
    if (fl > r + 0.6 || Math.abs(h) > (o.hmax || 6)) continue;
    if (o.suelo && !p.grounded) continue;   // saltar la onda sirve
    n++; g.hurtPlayer(p, D(g, m, dmg * (o.falloff ? 1 - 0.35 * (fl / r) : 1)));
    if (o.knock) g.push(p, madd(mul(norm(project(v, p.up), p.heading), o.knock), p.up, o.up ?? 5));
  }
  return n;
}
const flatDir = (a, b) => { const d = sub(b, a); return norm(v3(d.x, 0, d.z), v3(1, 0, 0)); };
/** ¿Hay línea de tiro libre (sin muros) entre dos puntos? */
function libre(g, a, b) {
  if (!g.map.walls) return true;
  const d = sub(b, a), l = len(d); if (l < 1) return true; const n = mul(d, 1 / l);
  for (let t = 1.5; t < l - 1; t += 1.5) if (blocked(g.map, madd(a, n, t))) return false;
  return true;
}
function elegir(g, m, pref) {
  const vs = vivos(g); if (!vs.length) return null;
  if (pref) { const c = vs.filter((p) => iaEstilo(m, p.id) === pref); if (c.length) return c[Math.floor(rnd(m) * c.length)]; }
  return vs[Math.floor(rnd(m) * vs.length)];
}
/** Diferencia angular absoluta (0..π). */
const angDif = (a, b) => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
const cuenta = (g) => Math.max(1, vivos(g).length);

/* ───────── movimiento ───────── */
/** Velocidad deseada para el cuerpo del jefe si una mecánica lo controla (si no, devuelve null y manda su órbita de siempre). */
export function mecMov(g, m, dt, want) {
  const M = m.mec; if (!M) return null;
  if (M.goal) {
    const to = sub(M.goal, m.pos), d = len(to);
    return { desired: mul(norm(to, v3()), Math.min(M.speed, d / 0.12)), accel: 9, dive: true };
  }
  if (M.rise && want) {
    const to = sub(want, m.pos), d = len(to);
    if (d < 3) M.rise = false;
    else return { desired: mul(norm(to, v3()), Math.min(9, d * 1.2)), accel: 6, dive: true };
  }
  return null;
}
function bajar(m, pos, speed) { m.mec.goal = clone(pos); m.mec.speed = speed; m.mec.rise = false; }
function soltar(m) { m.mec.goal = null; m.mec.rise = true; }

/* ───────── ataques ───────── */
// Cada ataque: ini(g,m) → act | null  ·  paso(g,m,act,dt) → true cuando termina.  La telegrafía es la marca (tg) + el sonido (evento jatk 'tel').
const ATQ = {
  nova: {
    ok: (g, m) => { const c = ctr(g, m); return !!c && vivos(g).some((p) => planta(p, c).fl < m.r + 16); },
    ini(g, m) {
      const T = Math.max(1.1, 1.6 - 0.1 * m.mec.f), c = ctr(g, m), r = m.r + 9;
      return { id: 'nova', t: T, T, mk: marca(m, 'c', c, r, T, 0), c, r };
    },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      golpeCirculo(g, m, a.c, a.r, 26 + 3 * m.mec.f, { knock: 22, falloff: true, hmax: 9 });
      g.emit({ t: 'jatk', k: 'nova', p: a3(a.c), r: a.r }); quitar(m, a.mk); return true;
    },
  },
  zonas: {
    ini(g, m) {
      const M = m.mec, ia = m.ia, pas = ia.st === 'antipasivo' ? 1 : 0, vs = vivos(g);
      const T = Math.max(1.1, 1.8 - 0.1 * M.f - 0.35 * pas * ia.lvl), n = Math.min(8, 2 + M.f + (vs.length - 1) + 2 * pas);
      const zs = [];
      for (let i = 0; i < n; i++) {
        const p = vs[i % vs.length], ang = rnd(m) * 6.28, off = i < vs.length ? 0 : 3 + rnd(m) * 6;
        const pos = madd(madd(p.pos, p.vel, 0.7), norm(cross(p.up, v3(Math.cos(ang), 0.3, Math.sin(ang))), v3(1, 0, 0)), off);
        const c = madd(pos, p.up, -0.8);
        zs.push({ c, up: p.up, mk: marca(m, 'c', c, 4.4, T, 1) });
      }
      return { id: 'zonas', t: T, T, zs, pas };
    },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      for (const z of a.zs) {
        golpeCirculo(g, m, z.c, 4.4, 22 + 2 * m.mec.f, { knock: 8, hmax: 5 });
        g.emit({ t: 'jatk', k: 'zona', p: a3(z.c), r: 4.4 }); quitar(m, z.mk);
        const A = JEFES[m.mec.J].arena; if (A && A.fuego && g.fl) { try { floraElemento(g, z.c, 4.4, 'fuego'); } catch { /* sin flora */ } }
        if (a.pas && m.ia.lvl > 0.4 && m.mec.haz.length < 5) m.mec.haz.push({ k: 'z', c: z.c, up: z.up, r: 3.8, t: 6, T: 6, mk: marca(m, 'h', z.c, 3.8, 6, 1), dps: 7, tick: 0 });
      }
      return true;
    },
  },
  barrido: {
    ok: (g, m) => !m.mec.esfera,
    ini(g, m) {
      const M = m.mec, c = sueloBajo(g, m), p = elegir(g, m, null), a0 = Math.atan2(p.pos.z - c.z, p.pos.x - c.x);
      const T = 1.6, n = M.f >= 3 ? 3 : 2, w = (rnd(m) < 0.5 ? -1 : 1) * (0.5 + 0.05 * M.f);
      const mk = marca(m, 'b', c, 46, T, 2, { a: a0, n, w: 0 });
      return { id: 'barrido', fase: 'tel', t: T, T, c, a: a0, n, w, dur: 5, mk, golpe: {} };
    },
    paso(g, m, a, dt) {
      if (a.fase === 'tel') { if ((a.t -= dt) > 0) return false; a.fase = 'giro'; a.t = a.dur; a.mk.t = a.mk.T = a.dur; a.mk.w = a.w; g.emit({ t: 'jatk', k: 'barrido', p: a3(a.c) }); return false; }
      a.a += a.w * dt; a.mk.a = a.a; a.t -= dt; a.mk.t = a.t;
      for (const p of vivos(g)) {
        const { fl, h } = planta(p, a.c); if (fl < 2.5 || fl > 46 || h > 2.2 || !p.grounded) continue;
        const ang = Math.atan2(p.pos.z - a.c.z, p.pos.x - a.c.x);
        for (let i = 0; i < a.n; i++) {
          const d = angDif(ang, a.a + (i * 6.2832) / a.n);
          if (d < Math.max(0.06, 1.9 / fl) && g.time >= (a.golpe[p.id] || 0) && libre(g, madd(a.c, UP, 1.2), madd(p.pos, p.up, 0.6))) { a.golpe[p.id] = g.time + 0.7; g.hurtPlayer(p, D(g, m, 13 + m.mec.f)); g.push(p, madd(mul(norm(sub(p.pos, a.c), p.heading), 6), p.up, 3)); }
        }
      }
      if (a.t <= 0) { quitar(m, a.mk); return true; }
      return false;
    },
  },
  carga: {
    ok: (g, m) => !m.mec.esfera && m.def.fly,
    ini(g, m) {
      const M = m.mec, cr = m.r * 0.92 + 0.8, ia = m.ia;
      // víctima: contra el tirador, al que está más lejos (cierra la distancia); si no, uno al azar
      const vs = vivos(g).slice().sort((p, q) => iaDistMedia(m, q.id) - iaDistMedia(m, p.id));
      const p = ia.st === 'antidist' && vs.length ? vs[0] : elegir(g, m, null);
      const lowY = M.gy + cr, a = m.pos, y0 = lowY;
      let dir = flatDir(a, p.pos); let L = Math.min(48, Math.hypot(p.pos.x - a.x, p.pos.z - a.z) + 10);
      for (let t = 4; t < L; t += 2) if (blocked(g.map, v3(a.x + dir.x * t, y0, a.z + dir.z * t))) { L = Math.max(8, t - cr - 1); break; }
      const from = v3(a.x, y0, a.z), to = v3(a.x + dir.x * L, y0, a.z + dir.z * L), T = Math.max(1.2, 1.5 - 0.08 * M.f);
      bajar(m, from, (a.y - y0) / (T * 0.9));
      return { id: 'carga', fase: 'tel', t: T, T, from, to, mk: marca(m, 'l', v3(from.x, M.gy + 0.1, from.z), m.r * 0.9, T, 3, { x2: to.x, y2: M.gy + 0.1, z2: to.z }), golpe: {}, dir };
    },
    paso(g, m, a, dt) {
      const M = m.mec;
      if (a.fase === 'tel') {
        if ((a.t -= dt) > 0) return false;
        a.fase = 'run'; a.t = 3; bajar(m, a.to, 40); g.emit({ t: 'jatk', k: 'carga', p: a3(a.from) }); return false;
      }
      a.t -= dt;
      for (const p of vivos(g)) if (!a.golpe[p.id] && dist(p.pos, m.pos) < m.r * 0.85 + 1.6) { a.golpe[p.id] = 1; g.hurtPlayer(p, D(g, m, 32 + 2 * M.f)); g.push(p, madd(mul(norm(project(sub(p.pos, m.pos), p.up), p.heading), 24), p.up, 7)); }
      if (dist(m.pos, a.to) < 3 || a.t <= 0) { // al terminar queda a ras del suelo: ventana de recuperación
        quitar(m, a.mk); M.bajo = 4; M.vuln = 1.3; M.nu = 0; M.low = clone(m.pos); bajar(m, m.pos, 2); g.emit({ t: 'jatk', k: 'cansado', p: a3(m.pos) }); return true;
      }
      return false;
    },
  },
  reflejo: {
    ini(g, m) { const T = 1.3; return { id: 'reflejo', t: T, T, mk: marca(m, 'o', m.pos, m.r + 3, T, 4) }; },
    paso(g, m, a, dt) {
      a.mk.x = m.pos.x; a.mk.y = m.pos.y; a.mk.z = m.pos.z;
      if ((a.t -= dt) > 0) return false;
      m.mec.refl = 3.6; quitar(m, a.mk); g.emit({ t: 'jatk', k: 'reflejo', p: a3(m.pos), id: m.id }); return true;
    },
  },
  espinas: {
    ok: (g, m) => { const c = ctr(g, m); return !!c && vivos(g).some((p) => planta(p, c).fl < m.r + 14); },
    ini(g, m) { const T = 1.3; return { id: 'espinas', t: T, T, mk: marca(m, 'o', m.pos, m.r + 4, T, 0) }; },
    paso(g, m, a, dt) {
      a.mk.x = m.pos.x; a.mk.y = m.pos.y; a.mk.z = m.pos.z;
      if ((a.t -= dt) > 0) return false;
      m.mec.spin = 5; quitar(m, a.mk); g.emit({ t: 'jatk', k: 'espinas', p: a3(m.pos), id: m.id }); return true;
    },
  },
  silencio: {
    ok: (g, m) => !!ctr(g, m),
    ini(g, m) { const c = ctr(g, m), T = 2.0; return { id: 'silencio', t: T, T, c, mk: marca(m, 'c', c, 30, T, 5) }; },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      for (const p of vivos(g)) {
        if (planta(p, a.c).fl > 30) continue;
        p.silencioHasta = g.time + 2.8;
        for (const k of ['movCd', 'espCd', 's3Cd', 'habCd', 'abilityCd']) if (p[k] !== undefined) p[k] = Math.max(p[k], 2.5);
        g.emit({ t: 'jia', k: 'silencio', pid: p.id });
      }
      g.emit({ t: 'jatk', k: 'silencio', p: a3(a.c), r: 30 }); quitar(m, a.mk); return true;
    },
  },
  voladores: {
    ok: (g, m) => g.monsters.filter((k) => k.kind === 'prisma' && !k.dead).length < 7 && g.monsters.length < 70,
    ini(g, m) {
      const n = Math.min(5, 2 + Math.floor(m.mec.f / 2) + cuenta(g) - 1), ref = elegir(g, m, 'shooter') || elegir(g, m, null), T = 1.2;
      for (let i = 0; i < n; i++) {
        let pos = null; for (let k = 0; k < 6 && !pos; k++) { const q = g.map.spawnAir(g.arRng || g.rng, ref.pos, ref.up); if (q && dist(q, ref.pos) > 12) pos = q; }
        if (pos) { g.omens.push({ kind: 'prisma', pos: clone(pos), at: g.time + T, k: 'prisma', parentId: m.id }); g.emit({ t: 'omen', k: 'prisma', p: a3(pos), in: T }); }
      }
      g.emit({ t: 'jatk', k: 'voladores', p: a3(m.pos) });
      return { id: 'voladores', t: T, T };
    },
    paso(g, m, a, dt) { return (a.t -= dt) <= 0; },
  },
  reparto: {
    ini(g, m) {
      const vs = vivos(g); let c = v3(); for (const p of vs) c = add(c, p.pos); c = mul(c, 1 / vs.length);
      const s = sueloBajo(g, m), out = norm(sub(c, s), v3(1, 0, 0)), T = 3.0, pos = madd(c, out, 4);
      const ref = vs[0], cc = madd(pos, ref.up, -dot(sub(pos, ref.pos), ref.up) - 0.8);
      return { id: 'reparto', t: T, T, c: cc, mk: marca(m, 'c', cc, 5.6, T, 7, { ref: 1 }) };
    },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      const vs = vivos(g), dentro = vs.filter((p) => planta(p, a.c).fl < 5.6), pool = 19 * vs.length;
      for (const p of vs) { const es = dentro.includes(p); g.hurtPlayer(p, D(g, m, es ? pool / dentro.length : 62)); }
      g.emit({ t: 'jatk', k: 'reparto', p: a3(a.c), r: 5.6, n: dentro.length }); quitar(m, a.mk); return true;
    },
  },
  arena: {
    ini(g, m) {
      const A = JEFES[m.mec.J].arena, T = 1.2; let n = 0;
      if (A.ordenar && g.ar && g.ar.ph !== 'dormido' && g.ar.ph !== 'ofrenda') g.ar.org.forEach((S, i) => { if (g.ar.L.org[i].atk && !S.roto && S.cd > 1.2) { S.cd = 0.5 + 0.4 * n; n++; } });
      let mk = null;
      if (A.niebla && g.ng) {
        const p = elegir(g, m, 'passive') || elegir(g, m, 'shooter') || elegir(g, m, null), pos = madd(p.pos, norm(sub(sueloBajo(g, m), p.pos), v3(1, 0, 0)), 7);
        const z = nieblaTemporal(g, A.niebla, madd(pos, p.up, 0.6), 8, 16);
        if (z) mk = marca(m, 'c', madd(pos, p.up, -0.8), 8, T + 1.2, 8);
      }
      g.emit({ t: 'jatk', k: 'arena', p: a3(m.pos), n, tx: A.etiqueta });
      return { id: 'arena', t: T, T, mk };
    },
    paso(g, m, a, dt) { if ((a.t -= dt) > 0) return false; if (a.mk) quitar(m, a.mk); return true; },
  },
  trampas: {
    ok: (g, m) => m.mec.haz.length < 4,
    ini(g, m) {
      const vs = vivos(g), p = elegir(g, m, 'passive') || vs[0], n = Math.min(3, 4 - m.mec.haz.length), T = 1.3;
      for (let i = 0; i < n; i++) {
        const ang = rnd(m) * 6.28, c = madd(madd(p.pos, p.vel, 0.6), norm(cross(p.up, v3(Math.cos(ang), 0.2, Math.sin(ang))), v3(1, 0, 0)), 2 + rnd(m) * 7);
        const cc = madd(c, p.up, -0.8);
        m.mec.haz.push({ k: 't', c: cc, up: p.up, r: 2.6, t: 14, T: 14, arm: T, mk: marca(m, 'h', cc, 2.6, 14, 9, { arm: T }) });
      }
      g.emit({ t: 'jatk', k: 'trampas', p: a3(p.pos) });
      return { id: 'trampas', t: T, T };
    },
    paso(g, m, a, dt) { return (a.t -= dt) <= 0; },
  },
  /* ── descenso: PISOTÓN (Mandinga) · ASOMO (Madre) · CAÍDA DE PÁRPADOS (Basilisco) ── */
  descenso: {
    ok: (g, m) => !m.mec.bajo,
    ini(g, m, o = {}) {
      const M = m.mec, T = o.T || (m.mec.esfera ? 6.5 : 2.0), c = sueloBajo(g, m), low = posBaja(g, m);
      M.low = low;
      const alto = M.esfera ? clone(m.pos) : v3(m.pos.x, m.pos.y + 3.5, m.pos.z);
      if (!M.esfera) bajar(m, alto, 6);
      const mk = marca(m, 'c', c, 17, T, 0, { big: 1 });
      return { id: 'descenso', fase: 'alza', t: T, T, c, low, mk, unico: !!o.unico, golpe: false };
    },
    paso(g, m, a, dt) {
      const M = m.mec; a.t -= dt; a.mk.t = Math.max(0, a.t);
      if (a.fase === 'alza' && a.t < a.T * (M.esfera ? 0.75 : 0.5)) { a.fase = 'cae'; bajar(m, a.low, M.esfera ? 17 : 31); g.emit({ t: 'jatk', k: 'caida', p: a3(m.pos), id: m.id }); }
      if (a.fase === 'cae' && (dist(m.pos, a.low) < 2.2 || a.t < -2)) {
        const nm = M.f; M.bajo = [7, 6.5, 6, 5.5][nm - 1] || 6; M.vuln = 1.35; M.low = clone(a.low);
        M.nu = m.kind === 'coloso' ? M.bajo : 0;
        golpeCirculo(g, m, a.c, 17, 27 + 3 * nm, { suelo: true, knock: 16, hmax: 8 });
        bajar(m, a.low, 3);
        g.emit({ t: 'jatk', k: 'impacto', p: a3(a.c), r: 17, nu: m.kind === 'coloso' ? 1 : 0, id: m.id }); quitar(m, a.mk);
        return true;
      }
      return false;
    },
  },
  /* ── momentos únicos ── */
  parto: {   // La Madre: pare crías protectoras; si las rompés todas queda abierta
    ok: (g, m) => !m.mec.crias.length,
    ini(g, m) {
      const T = 3.0, vs = vivos(g), n = Math.min(8, 5 + cuenta(g) - 1), pts = [];
      for (let i = 0; i < n; i++) { const ref = vs[i % vs.length], pos = g.map.spawnGround(g.arRng || g.rng, ref.pos); pts.push({ pos, mk: marca(m, 'c', pos, 2.2, T, 0) }); }
      m.vis = 'gestate'; m.gestAnim = T;
      return { id: 'parto', t: T, T, pts };
    },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      for (const q of a.pts) { const o = g.addObject('sac', q.pos, { hp: 90, maxhp: 90, hatch: 14, hostile: true, r: 1.6, parent: m.id, cria: true }); m.mec.crias.push({ id: o.id, hatch: 14 }); quitar(m, q.mk); }
      m.mec.prot = 1; m.mec.protEn = g.time; g.emit({ t: 'jatk', k: 'parto', p: a3(m.pos) }); return true;
    },
  },
  raices: {   // La Madre: raíces que atrapan unos segundos a quien siga en el círculo
    ok: (g, m) => m.kind === 'madre',
    ini(g, m) {
      const T = 1.5, vs = vivos(g), zs = [];
      for (const p of vs.slice(0, 4)) { const c = madd(madd(p.pos, p.vel, 0.6), p.up, -0.8); zs.push({ c, mk: marca(m, 'c', c, 3.6, T, 10) }); }
      return { id: 'raices', t: T, T, zs };
    },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      for (const z of a.zs) { quitar(m, z.mk); for (const p of vivos(g)) if (planta(p, z.c).fl < 3.6) { g.hurtPlayer(p, D(g, m, 10)); p.atrapadoHasta = g.time + 1.6; p.vel = v3(); } g.emit({ t: 'jatk', k: 'raiz', p: a3(z.c), r: 3.6 }); }
      return true;
    },
  },
  mirada_total: {   // Basilisco del laberinto: barrido de mirada de 360°; sólo los muros salvan
    ok: (g, m) => !m.mec.esfera,
    ini(g, m) {
      const T = 3.0, p = elegir(g, m, null), c = clone(m.pos), a0 = Math.atan2(p.pos.z - c.z, p.pos.x - c.x);
      m.mec.dark = T + 7;
      return { id: 'mirada_total', fase: 'tel', t: T, T, c, a: a0, w: (rnd(m) < 0.5 ? -1 : 1) * 0.62, dur: 7, golpe: {}, mk: marca(m, 'b', v3(c.x, m.mec.gy + 0.1, c.z), 90, T, 2, { a: a0, n: 1, w: 0, fino: 1 }) };
    },
    paso(g, m, a, dt) {
      a.c = clone(m.pos);
      if (a.fase === 'tel') { if ((a.t -= dt) > 0) return false; a.fase = 'giro'; a.t = a.dur; a.mk.w = a.w; a.mk.t = a.mk.T = a.dur; g.emit({ t: 'jatk', k: 'mirada', p: a3(a.c) }); return false; }
      a.a += a.w * dt; a.mk.a = a.a; a.t -= dt; a.mk.t = a.t;
      for (const p of vivos(g)) {
        const dx = p.pos.x - a.c.x, dz = p.pos.z - a.c.z, fl = Math.hypot(dx, dz); if (fl < 2) continue;
        const d = angDif(Math.atan2(dz, dx), a.a);
        if (d < 0.1 && g.time >= (a.golpe[p.id] || 0) && libre(g, a.c, madd(p.pos, p.up, 0.8))) { a.golpe[p.id] = g.time + 1.6; g.hurtPlayer(p, D(g, m, 30), true); g.emit({ t: 'jatk', k: 'mirada_hit', pid: p.id }); }
      }
      if (a.t <= 0) { quitar(m, a.mk); m.mec.dark = 0; return true; }
      return false;
    },
  },
  floracion: {   // Basilisco del Jardín: brotan ojos en el suelo
    ok: (g, m) => !m.mec.brotes.length,
    ini(g, m) {
      const T = 2.2, vs = vivos(g), n = Math.min(6, 3 + cuenta(g)), pts = [];
      for (let i = 0; i < n; i++) { const ref = vs[i % vs.length], pos = g.map.spawnGround(g.arRng || g.rng, ref.pos); pts.push({ pos, mk: marca(m, 'c', pos, 2.0, T, 10) }); }
      return { id: 'floracion', t: T, T, pts };
    },
    paso(g, m, a, dt) {
      if ((a.t -= dt) > 0) return false;
      for (const q of a.pts) { const o = g.addObject('ojo', madd(q.pos, UP, 1.6), { hp: 150, maxhp: 150, hostile: true, r: 1.5, boss: true, parent: m.id, brote: true, cd: 2.5 + rnd(m) * 1.5, vida: 16 }); m.mec.brotes.push(o.id); quitar(m, q.mk); }
      g.emit({ t: 'jatk', k: 'floracion', p: a3(m.pos) }); return true;
    },
  },
  campanadas: {   // Mandinga del Reloj: doce marcas que caen como las horas; a medianoche el reloj se detiene
    ini(g, m) {
      const c0 = sueloBajo(g, m), a0 = rnd(m) * 6.28, pts = [];
      for (let i = 0; i < 12; i++) { const an = a0 + (i / 12) * 6.2832; pts.push({ pos: v3(c0.x + Math.cos(an) * 17, c0.y + 0.1, c0.z + Math.sin(an) * 17), at: i * 0.55, T: 1.3, mk: null, hecho: false }); }
      return { id: 'campanadas', t: 0, T: 12 * 0.55 + 1.3, pts, fase: 'toca' };
    },
    paso(g, m, a, dt) {
      a.t += dt;
      for (const q of a.pts) {
        if (!q.mk && !q.hecho && a.t >= q.at) { q.mk = marca(m, 'c', q.pos, 4.8, q.T, 7, { num: a.pts.indexOf(q) + 1 }); g.emit({ t: 'jatk', k: 'campana', p: a3(q.pos), n: a.pts.indexOf(q) + 1 }); }
        if (q.mk && !q.hecho) { q.mk.t = q.at + q.T - a.t; if (a.t >= q.at + q.T) { golpeCirculo(g, m, q.pos, 4.8, 22, { knock: 10, hmax: 6 }); g.emit({ t: 'jatk', k: 'zona', p: a3(q.pos), r: 4.8 }); quitar(m, q.mk); q.hecho = true; } }
      }
      if (a.pts.every((q) => q.hecho)) { m.mec.dCd = 0; m.mec.forzarCaida = 1; return true; }   // «medianoche»: sigue con la caída del Mandinga
      return false;
    },
  },
  procesion: {   // Basilisco del Osario: una fila de marcas avanza hacia vos, y luego otra cruzada
    ini(g, m) {
      const c = sueloBajo(g, m), p = elegir(g, m, null), d0 = flatDir(c, p.pos), pts = [];
      for (let w = 0; w < 2; w++) {
        const d = w ? v3(-d0.z, 0, d0.x) : d0;
        for (let i = 0; i < 9; i++) { const pos = v3(c.x + d.x * (7 + i * 5.5), c.y + 0.1, c.z + d.z * (7 + i * 5.5)); if (!blocked(g.map, madd(pos, UP, 1.2))) pts.push({ pos, at: w * 4.4 + i * 0.4, T: 1.2, mk: null, hecho: false }); }
      }
      return { id: 'procesion', t: 0, T: 9, pts };
    },
    paso(g, m, a, dt) {
      a.t += dt;
      for (const q of a.pts) {
        if (!q.mk && !q.hecho && a.t >= q.at) q.mk = marca(m, 'c', q.pos, 4.2, q.T, 0);
        if (q.mk && !q.hecho) { q.mk.t = q.at + q.T - a.t; if (a.t >= q.at + q.T) { golpeCirculo(g, m, q.pos, 4.2, 20, { knock: 9, hmax: 6 }); g.emit({ t: 'jatk', k: 'zona', p: a3(q.pos), r: 4.2 }); quitar(m, q.mk); q.hecho = true; } }
      }
      if (a.pts.every((q) => q.hecho)) { g.emit({ t: 'jatk', k: 'procesion_fin', p: a3(m.pos) }); return true; }
      return false;
    },
  },
};
const UNICOS = new Set(['parto', 'mirada_total', 'floracion', 'campanadas', 'procesion']);

/* ───────── elección ───────── */
function elegirAtaque(g, m) {
  const M = m.mec, J = JEFES[M.J], ia = m.ia, cand = [];
  for (const id of Object.keys(REPERTORIO)) {
    const R = REPERTORIO[id]; if (R.f > M.f || (J.sin || []).includes(id)) continue;
    const A = ATQ[id]; if (!A || (A.ok && !A.ok(g, m))) continue;
    if (id === 'reparto' && vivos(g).length < 1) continue;
    let w = R.w * (R.st[ia.st] ? 1 + (R.st[ia.st] - 1) * ia.lvl : 1);
    if (M.act === null && M.ultimo === id) w *= 0.25;   // no repetir
    if (id === 'reflejo' && M.refl > 0 || id === 'espinas' && M.spin > 0) continue;
    cand.push([id, w]);
  }
  // extras propios de cada jefe (siempre disponibles desde la fase 2)
  if (M.f >= 2 && J.base === 'madre') { cand.push(['raices', 2.2]); }
  if (M.f >= 3 && !M.unicoPend) { const u = J.unico.id; if (g.time >= M.uCd && ATQ[u] && (!ATQ[u].ok || ATQ[u].ok(g, m))) cand.push([u, 1.6]); }
  const tot = cand.reduce((a, [, w]) => a + w, 0); if (!cand.length) return null;
  let r = rnd(m) * tot; for (const [id, w] of cand) { r -= w; if (r <= 0) return id; }
  return cand[cand.length - 1][0];
}

/* ───────── paso principal ───────── */
export function mecTick(g, m, dt) {
  const M = m.mec; if (!M) return;
  const J = JEFES[M.J], ia = m.ia;
  M.t += dt;
  // fase por vida (cuatro fases)
  const frac = m.hp / m.maxhp; let f = 1; for (const u of FASE_UMBRALES) if (frac <= u) f++;
  if (f > M.f) {
    M.f = f; m.fase = f; m.phase = Math.min(3, f);
    g.emit({ t: 'phase', n: f, id: m.id, nm: J.fases[f - 1], tot: 4, mj: M.J });
    iaFase(g, m);
    if (f === 3) { M.unicoPend = true; M.cd = Math.min(M.cd, 1.5); if (J.unico.id === 'pisoton') M.dCd = Math.min(M.dCd, 2.5); }
    M.cd = Math.max(M.cd, 2.2);   // un respiro al cambiar de fase
  }
  const ritmo = 1 - IA.enrageRitmo * ia.enr;
  // temporizadores de estados
  if (M.bajo > 0) { M.bajo -= dt; if (M.bajo <= 0) { M.bajo = 0; M.nu = 0; M.vuln = 1; M.prot = M.prot; soltar(m); } else M.nu = Math.max(0, M.nu - dt); }
  for (const k of ['refl', 'spin', 'velo', 'dark', 'silencio']) if (M[k] > 0) M[k] = Math.max(0, M[k] - dt);
  // marcas: descuento de tiempo
  for (const mk of M.tg) mk.t -= dt;   // (las marcas de secuencia reponen su tiempo en su propio paso)
  M.tg = M.tg.filter((mk) => mk.t > -0.5);
  // aura de espinas
  if (M.spin > 0) {
    M.espT = (M.espT || 0) - dt;
    if (M.espT <= 0) { M.espT = 0.5; const c = sueloBajo(g, m); for (const p of vivos(g)) if (planta(p, c).fl < m.r + 5.5 && Math.abs(planta(p, c).h) < 14) g.hurtPlayer(p, D(g, m, 5), true); }
  }
  // zonas persistentes (peligro / trampas)
  for (const z of M.haz) {
    z.t -= dt; if (z.mk) z.mk.t = z.t;
    if (z.k === 'z') { z.tick -= dt; if (z.tick <= 0) { z.tick = 0.5; for (const p of vivos(g)) if (planta(p, z.c).fl < z.r && Math.abs(planta(p, z.c).h) < 3) g.hurtPlayer(p, D(g, m, z.dps * 0.5), true); } }
    else if (z.k === 't') {
      if (z.arm > 0) z.arm -= dt;
      else for (const p of vivos(g)) if (planta(p, z.c).fl < z.r && Math.abs(planta(p, z.c).h) < 3) { g.hurtPlayer(p, D(g, m, 28)); g.push(p, madd(p.vel, p.up, 8)); g.emit({ t: 'jatk', k: 'zona', p: a3(z.c), r: z.r }); z.t = 0; break; }
    }
  }
  M.haz = M.haz.filter((z) => { if (z.t > 0) return true; if (z.mk) quitar(m, z.mk); return false; });
  // partes destruibles: crías de la Madre y ojos brotados
  if (M.crias.length) {
    let hay = 0, rotas = 0;
    for (const c of M.crias) { const o = g.objects.find((x) => x.id === c.id); if (o) { hay++; c.hatch = o.hatch; } else if (!c.fin) { c.fin = 1; if (c.hatch > 0.4) rotas++; M.criasRotas = (M.criasRotas || 0) + (c.hatch > 0.4 ? 1 : 0); } }
    if (!hay) {
      const total = M.crias.length, rot = M.crias.filter((c) => c.hatch > 0.4).length;
      M.crias = []; M.prot = 0; M.criasRotas = 0;
      if (rot >= total) { M.bajo = 6; M.vuln = 1.6; if (m.kind === 'madre') { m.open = true; m.openT = 6; } g.emit({ t: 'jatk', k: 'cria_rota', p: a3(m.pos), id: m.id }); }
      M.uCd = g.time + 30;
    }
  }
  if (M.brotes.length) {
    let hay = 0;
    for (const id of M.brotes) {
      const o = g.objects.find((x) => x.id === id); if (!o) continue; hay++;
      o.vida -= dt; o.cd -= dt;
      if (o.vida <= 0) { m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.025); for (const p of vivos(g)) if (dist(p.pos, o.pos) < 8) g.hurtPlayer(p, D(g, m, 18)); g.emit({ t: 'jatk', k: 'ojo_estalla', p: a3(o.pos) }); g.removeObject(o); continue; }
      if (o.cd <= 0) {
        const vs = vivos(g).sort((a, b) => dist(a.pos, o.pos) - dist(b.pos, o.pos)); const p = vs[0];
        if (p) { o.cd = 3.8; const c = madd(madd(p.pos, p.vel, 0.7), p.up, -0.8); const mk = marca(m, 'c', c, 2.6, 1.2, 10); (M.gz ||= []).push({ c, mk, t: 1.2 }); }
        else o.cd = 2;
      }
    }
    if (!hay) { M.brotes = []; M.bajo = Math.max(M.bajo, 5); M.vuln = 1.4; M.low = posBaja(g, m); if (!M.goal) bajar(m, M.low, 14); g.emit({ t: 'jatk', k: 'cansado', p: a3(m.pos) }); M.uCd = g.time + 28; }
  }
  if (M.gz) { for (const z of M.gz) { z.t -= dt; if (z.t <= 0) { golpeCirculo(g, m, z.c, 2.6, 14, { hmax: 5 }); quitar(m, z.mk); } } M.gz = M.gz.filter((z) => z.t > 0); }
  // bajo: mantiene la posición baja
  if (M.bajo > 0 && M.low && !M.goal) bajar(m, M.low, 3);
  // ataque en curso
  if (M.act) {
    const A = ATQ[M.act.id];
    if (A.paso(g, m, M.act, dt)) { M.ultimo = M.act.id; if (UNICOS.has(M.act.id)) M.uCd = g.time + (M.act.id === 'campanadas' ? 38 : 34); M.act = null; M.cd = Math.max(1.2, [0, 6.2, 5.2, 4.4, 3.6][M.f] * ritmo * (1 - 0.06 * (cuenta(g) - 1))); }
    return;
  }
  if (g.time < 0 || M.t < 6) return;   // al principio el jefe se presenta
  M.cd -= dt; M.dCd -= dt;
  if (M.cd > 0 && !M.forzarCaida) return;
  // ¿toca descender?
  if (!M.bajo && (M.dCd <= 0 || M.forzarCaida) && ATQ.descenso.ok(g, m)) {
    const unico = (J.unico.id === 'pisoton' && M.f >= 3 && M.unicoPend);
    if (unico) { M.unicoPend = false; M.unicoHecho++; g.emit({ t: 'jia', k: 'unico', id: m.id, nm: J.unico.nombre, tx: J.unico.aviso }); }
    M.act = ATQ.descenso.ini(g, m, { unico, T: unico ? 2.4 : 2.0 });
    M.dCd = [0, 30, 26, 22, 19][M.f] * ritmo * (ia.st === 'antimele' ? 1.15 : 1); M.forzarCaida = 0;
    g.emit({ t: 'jatk', k: 'tel', a: 'descenso', id: m.id }); return;
  }
  let id;
  if (M.unicoPend && ATQ[J.unico.id] && J.unico.id !== 'pisoton') {
    id = J.unico.id; M.unicoPend = false; M.unicoHecho++;
    if (ATQ[id].ok && !ATQ[id].ok(g, m)) id = null; else g.emit({ t: 'jia', k: 'unico', id: m.id, nm: J.unico.nombre, tx: J.unico.aviso });
  }
  if (!id) id = elegirAtaque(g, m);
  if (!id) { M.cd = 2; return; }
  M.act = ATQ[id].ini(g, m); g.emit({ t: 'jatk', k: 'tel', a: id, id: m.id });
}

/* ───────── daño recibido ───────── */
/** Multiplicador del daño que recibe el jefe por sus ventanas y escudos temporales (el de la adaptación está en jefe-ia.js). */
export function mecMult(g, m, src, by) {
  const M = m.mec; if (!M) return 1;
  let k = 1;
  if (M.bajo > 0) k *= M.vuln;
  if (M.refl > 0 && src === 'gun' && by && enCono(m, by)) k *= 0.3;
  if (M.spin > 0 && src === 'melee') k *= 0.7;
  if (M.prot) k *= 0.6;
  return k;
}
function enCono(m, by) { const to = norm(sub(by.pos, m.pos)); return dot(to, m.fwd || v3(0, 0, 1)) > 0.15; }
/** Efectos colaterales de un golpe al jefe (devolver disparos, espinas). */
export function mecGolpe(g, m, by, dealt, src) {
  const M = m.mec; if (!M || !by || !by.input) return;
  if (M.refl > 0 && src === 'gun' && g.time >= M.rcd && enCono(m, by)) {
    M.rcd = g.time + 0.55;
    g.addProjectile({ owner: 'm', kind: 'shard', pos: clone(m.pos), vel: mul(norm(sub(madd(by.pos, by.up, 0.6), m.pos)), 24), dmg: D(g, m, 9), r: 0.7, life: 4 });
    g.emit({ t: 'jatk', k: 'devuelve', p: a3(m.pos) });
  }
  if (M.spin > 0 && src === 'melee' && g.time >= (by.espinaCd || 0)) { by.espinaCd = g.time + 0.45; g.hurtPlayer(by, D(g, m, 9), true); g.emit({ t: 'jatk', k: 'espina', pid: by.id }); }
}
/** Silencio: ¿el jugador no puede usar habilidades ahora? */
export const mecSilencio = (g, p) => g.time < (p.silencioHasta || 0);
/** Raíces: ¿el jugador está atrapado? */
export const mecAtrapado = (g, p) => g.time < (p.atrapadoHasta || 0);

/** Para los bots y la ayuda al jugador: un vector (en planta) para salir de las marcas que van a pegarle pronto, o null. */
export function mecEvitar(g, p) {
  const boss = g.monsters.find((q) => q.def.boss && !q.dead && q.mec); if (!boss) return null;
  let out = v3(), n = 0;
  for (const mk of boss.mec.tg) {
    const c = v3(mk.x, mk.y, mk.z);
    if (mk.k === 'c' && mk.ref) { // el refugio del reparto: hay que ENTRAR
      const d = planta(p, c).fl; if (d > mk.r * 0.6) { out = add(out, mul(norm(project(sub(c, p.pos), p.up), v3()), 2)); n++; } continue;
    }
    if (mk.k === 'c' && mk.t < 2.2) { const pl = planta(p, c); if (pl.fl < mk.r + 1.8 && Math.abs(pl.h) < 8) { out = add(out, mul(norm(project(sub(p.pos, c), p.up), p.heading), 2.4)); n++; } }
    else if (mk.k === 'l') { const a = c, b = v3(mk.x2, mk.y2, mk.z2), ab = sub(b, a), t = clamp(dot(sub(p.pos, a), ab) / (dot(ab, ab) || 1), 0, 1), q = madd(a, ab, t); if (dist(q, p.pos) < mk.r + 3) { out = add(out, mul(norm(project(sub(p.pos, q), p.up), cross(p.up, norm(ab))), 2.4)); n++; } }
    else if (mk.k === 'b') { const pl = planta(p, c); if (pl.fl > 2 && pl.fl < mk.r && !mk.fino) { out = add(out, mul(norm(project(sub(p.pos, c), p.up), p.heading), 1.2)); n++; } }
  }
  for (const z of boss.mec.haz) { const pl = planta(p, z.c); if (pl.fl < z.r + 1.5 && (z.k === 'z' || z.arm <= 0 || z.arm < 0.6)) { out = add(out, mul(norm(project(sub(p.pos, z.c), p.up), p.heading), 2)); n++; } }
  return n ? out : null;
}

/** Resumen compacto para el snapshot. */
export function mecSnap(m) {
  const M = m.mec; if (!M) return null;
  const tg = M.tg.slice(0, MAX_MARCAS).map((k) => [k.k, r2(k.x), r2(k.y), r2(k.z), r2(k.r), r2(Math.max(0, k.t)), r2(k.T), k.c, k.k === 'l' ? [r2(k.x2), r2(k.y2), r2(k.z2)] : k.k === 'b' ? [Math.round(k.a * 100) / 100, k.n || 1, Math.round((k.w || 0) * 100) / 100, k.fino ? 1 : 0] : k.ref ? 1 : k.num || 0]);
  return { f: M.f, tg, bj: r2(M.bajo), nu: r2(M.nu), rf: r2(M.refl), sp: r2(M.spin), vl: M.vuln, dk: r2(M.dark), pr: M.prot ? 1 : 0, ac: M.act ? M.act.id : '', br: M.brotes.length, cr: M.crias.length, mj: M.J };
}
export function mecNombre(mapId) { return (JEFES[mapId] || JEFES.m1).nombre; }
export { POSTURAS, MONSTERS };
