// EVENTOS DE OLEADA: la gravedad rota deja de ser permanente y pasa a ser UNO de varios eventos (docs/MUNDO_VIVO.md).
// Determinista y sin DOM: usa su propio generador derivado de la semilla de la partida (g.evRng), así no altera el azar de las oleadas.
// Reglas: como máximo UN evento activo; desde la oleada EVENTO.minOleada; nunca en dos oleadas seguidas; aviso de EVENTO.aviso s;
// la gravedad sólo se invierte dentro de «Marea de Gravedad»; un jugador nunca se invierte dos veces en EVENTO.flipBloqueo s.
import { v3, mul, madd, dot, cross, len, dist, norm, makeRng } from './math.js';
import { EVENTO, EVENTOS, EVENTOS_MAPA, PLAYER } from './data.js';
import { addCores } from './huespedes.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const smooth = (x) => { const k = x < 0 ? 0 : x > 1 ? 1 : x; return k * k * (3 - 2 * k); };

/* ───────── estado ───────── */
export function initEventos(g) {
  g.evRng = makeRng((((g.seed | 0) ^ 0x5eed17) * 2654435761) >>> 0);
  g.ev = null; g.evPlan = null; g.evLastWave = -9; g.evLastId = ''; g.evLog = []; g.evStats = { flips: 0, suaves: 0, pulsos: 0 };
  limpiarBanderas(g);
}
function limpiarBanderas(g) {
  g.evCoreMul = 1; g.evMeleeMul = 1; g.evSilencio = false; g.evEliteBoost = 0; g.evSpeedMul = 1; g.evZona = null;
}
export const hayEvento = (g, id) => !!(g.ev && (!id || g.ev.id === id));
/** ¿Se puede invertir la gravedad AHORA? Sólo durante la fase activa de la Marea de Gravedad. */
export const puedeInvertir = (g) => !!(g.ev && g.ev.id === 'marea_gravedad' && g.ev.ph === 'activo');

/* ───────── gravedad del jugador: inversión suave, acotada y con aterrizaje blando ───────── */
/** Factor de gravedad (+1 normal … −1 invertida) con rampa de entrada y de salida: la inversión nunca es un golpe seco. */
export function factorFlip(t, from, until) {
  const dentro = smooth((t - from) / EVENTO.rampa), fuera = smooth((until - t) / (EVENTO.rampa * 0.8));
  return 1 - 2 * Math.min(dentro, fuera);
}
/** Invierte la gravedad de UN jugador (máx. EVENTO.flipMax s) respetando el bloqueo de 20 s. Con «Reducir efectos de gravedad» (input.soft) es sólo un empujón. */
export function volteaJugador(g, p, secs = EVENTO.flipMax) {
  if (!p || p.dead || g.time < (p.flipLock || 0)) return false;
  secs = Math.min(secs, EVENTO.flipMax);
  p.flipLock = g.time + secs + EVENTO.flipBloqueo;
  if (p.input && p.input.soft) { // sin giro de cámara: un salto hacia arriba y listo
    p.vel = madd(p.vel, p.up, 10); p.grounded = false; g.evStats.suaves++;
    g.emit({ t: 'gravity', soft: true, pid: p.id, p: a3(p.pos) });
    return true;
  }
  p.flipFrom = g.time; p.flipUntil = g.time + secs; g.evStats.flips++;
  return true;
}
/** Aterrizaje blando: corta la subida y limita la caída hasta tocar suelo (máx. EVENTO.amortigua s). */
export function ablandar(g, p, secs = EVENTO.amortigua) {
  p.cushionUntil = g.time + secs;
  const vu = dot(p.vel, p.up); if (vu > 5) p.vel = madd(p.vel, p.up, 5 - vu);
}
/** Se llama en cada paso del jugador, después de aplicar la gravedad: tope de velocidad durante la inversión y amortiguación al terminar. */
export function limitarCaida(g, p, gv) {
  const flipping = g.time < (p.flipUntil || 0);
  if (p.wasFlip && !flipping) ablandar(g, p);
  p.wasFlip = flipping;
  const l = len(gv); if (l < 0.5) return;
  const cus = g.time < (p.cushionUntil || 0);
  if (cus && p.grounded) p.cushionUntil = 0;
  const maxFall = flipping ? EVENTO.caidaMax : cus ? EVENTO.amortiguaCaida : Infinity;
  if (maxFall === Infinity) return;
  const dn = mul(gv, 1 / l), vd = dot(p.vel, dn);
  if (vd > maxFall) p.vel = madd(p.vel, dn, maxFall - vd);
}
/** Pulso de un Familiar o jefe. Devuelve true si invirtió (sólo bajo la Marea); si no, quien llama usa su alternativa (atraer / empujar). */
export function pulso(g, m, range, secs) {
  if (!puedeInvertir(g)) return false;
  let n = 0;
  for (const p of g.alivePlayers()) if (dist(p.pos, m.pos) < range && volteaJugador(g, p, secs)) n++;
  g.evStats.pulsos++;
  g.emit({ t: 'gravity', id: m.id, p: a3(m.pos) });
  return true;
}

/* ───────── planificación por oleada ───────── */
function elegir(g, pool) {
  const ids = Object.keys(pool).filter((k) => EVENTOS[k] && pool[k] > 0);
  if (!ids.length) return null;
  // evitar repetir el mismo evento seguido si hay alternativas
  const ok = ids.length > 1 ? ids.filter((k) => k !== g.evLastId) : ids;
  let r = g.evRng.next() * ok.reduce((s, k) => s + pool[k], 0);
  for (const k of ok) { r -= pool[k]; if (r <= 0) return k; }
  return ok[ok.length - 1];
}
/** Se llama al empezar cada oleada: decide (con azar determinista) si habrá evento y cuándo avisa. */
export function planOleada(g, n, isBoss) {
  if (g.ev) terminar(g, false);
  g.evPlan = null;
  const dado = g.evRng.next(), demora = g.evRng.range(EVENTO.demoraMin, EVENTO.demoraMax); // siempre se gastan: el flujo no depende de las ramas
  if (n < EVENTO.minOleada || g.evLastWave === n - 1) return;       // oleada normal: muy temprano o justo después de un evento
  let pool = EVENTOS_MAPA[g.mapId] || {};
  if (isBoss) pool = pool.marea_gravedad ? { marea_gravedad: pool.marea_gravedad } : {}; // el jefe sólo invierte la gravedad bajo su Marea
  if (dado >= (isBoss ? EVENTO.prob * 0.8 : EVENTO.prob)) return;
  const id = elegir(g, pool); if (!id) return;
  g.evPlan = { id, at: g.time + demora, wave: n };
}
/** Se llama al limpiar la oleada: cualquier evento en curso termina (con premio si ya estaba activo). */
export function finOleada(g) {
  g.evPlan = null;
  if (g.ev) terminar(g, g.ev.ph === 'activo');
}
/** Para pruebas y modo desarrollo: inicia un evento ya mismo (aviso=0 salta directo a la fase activa). */
export function iniciarEvento(g, id, { aviso = EVENTO.aviso } = {}) {
  if (!EVENTOS[id]) return false;
  if (g.ev) terminar(g, false);
  empezar(g, id, aviso);
  return true;
}

/* ───────── ciclo de vida ───────── */
function empezar(g, id, aviso) {
  const D = EVENTOS[id];
  g.ev = { id, ph: 'aviso', t: aviso, d: aviso, dur: D.dur, cd: 0, marks: [], zona: null, acc: 0, wave: g.wave, since: g.time, ok: true };
  g.evLog.push({ id, wave: g.wave, t: r2(g.time) });
  if (H[id].aviso) H[id].aviso(g, g.ev);
  g.emit({ t: 'ev', id, ph: 'aviso', in: aviso, wave: g.wave });
  if (aviso <= 0) activar(g);
}
function activar(g) {
  const e = g.ev; e.ph = 'activo'; e.t = e.dur; e.d = e.dur;
  if (H[e.id].inicio) H[e.id].inicio(g, e);
  g.emit({ t: 'ev', id: e.id, ph: 'activo', dur: e.dur, wave: g.wave });
}
function terminar(g, ok) {
  const e = g.ev; if (!e) return;
  const bueno = ok && e.ok;
  if (H[e.id].fin) H[e.id].fin(g, e, bueno);
  if (bueno) premiar(g, e);
  g.emit({ t: 'ev', id: e.id, ph: 'fin', ok: !!bueno, wave: g.wave });
  limpiarBanderas(g);
  g.evLastWave = e.wave; g.evLastId = e.id; g.ev = null;
}
function premiar(g, e, k = 1) {
  const n = Math.round((8 + 3 * Math.max(1, e.wave)) * k);
  for (const p of g.alivePlayers()) { addCores(g, p, n); g.dropPickup('hp', madd(p.pos, p.up, 2)); }
}
/** Un paso por tick (sólo en fase de oleada). */
export function tickEventos(g, dt) {
  if (!g.ev) {
    if (g.evPlan && g.time >= g.evPlan.at) { const id = g.evPlan.id; g.evPlan = null; empezar(g, id, EVENTO.aviso); }
    return;
  }
  const e = g.ev;
  e.t -= dt;
  if (e.ph === 'aviso') { if (H[e.id].avisoTick) H[e.id].avisoTick(g, e, dt); if (e.t <= 0) activar(g); return; }
  if (H[e.id].tick) H[e.id].tick(g, e, dt);
  if (g.ev === e && e.t <= 0) terminar(g, true);
}

/* ───────── marcas en el suelo (lluvia y tormenta) ───────── */
function normalEn(g, pos) { const gv = g.map.gravityAt(pos, g.time), l = len(gv); return l > 1e-3 ? mul(gv, -1 / l) : v3(0, 1, 0); }
function marcar(g, e, pos, delay, r, k, pd, md) { e.marks.push({ pos: { x: pos.x, y: pos.y, z: pos.z }, u: normalEn(g, pos), at: g.time + delay, r, k, pd, md, born: g.time }); }
function procesarMarcas(g, e) {
  if (!e.marks.length) return;
  const keep = [];
  for (const m of e.marks) {
    if (g.time < m.at) { keep.push(m); continue; }
    g.explode(m.pos, m.r, m.pd, m.md, null, true);
    if (m.k === 1) g.emit({ t: 'ray', p: a3(m.pos), eco: true });
  }
  e.marks = keep;
}
const vivoAlAzar = (g) => { const a = g.alivePlayers(); return a.length ? a[Math.floor(g.evRng.next() * a.length)] : null; };

/* ───────── los 8 eventos ───────── */
const H = {
  marea_gravedad: {
    aviso(g, e) { // Cámara Fractal: su marea de ingravidez es este evento (ventana sobre la instancia del mapa)
      if (g.map.tideWin !== undefined) g.map.tideWin = { warn: g.time, from: g.time + e.d, to: g.time + e.d + 6 };
    },
    inicio(g, e) { e.zero = g.map.tideWin !== undefined; if (!e.zero) e.cd = 3; },
    tick(g, e, dt) {
      if (e.zero) { // ingravidez: al terminar, aterrizaje blando para todos
        if (!e.suave && g.time >= g.map.tideWin.to) { e.suave = true; for (const p of g.alivePlayers()) ablandar(g, p); }
        return;
      }
      if (e.cd > 0) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 0; let c = null;
          for (const p of g.alivePlayers()) { volteaJugador(g, p, EVENTO.flipMax); c = c || p; }
          if (c) g.emit({ t: 'gravity', id: 0, p: a3(c.pos), ev: true });
        }
      }
    },
    fin(g, e) { if (g.map.tideWin !== undefined) { g.map.tideWin = null; if (!e.suave) for (const p of g.alivePlayers()) ablandar(g, p); } },
  },
  niebla_almas: {
    inicio(g) { g.evCoreMul = 1.5; },
  },
  lluvia_astillas: {
    tick(g, e, dt) {
      e.acc -= dt;
      if (e.acc <= 0 && e.marks.length < 8) {
        e.acc = 0.75; const p = vivoAlAzar(g);
        if (p) { const tt = norm(cross(p.up, g.evRng.unit()), v3(1, 0, 0)); marcar(g, e, madd(p.pos, tt, g.evRng.range(2, 10)), 1.5, 3.2, 0, 14 + 0.8 * g.wave, 30); }
      }
      procesarMarcas(g, e);
    },
  },
  tormenta_ecos: {
    tick(g, e, dt) {
      e.acc -= dt;
      if (e.acc <= 0 && e.marks.length < 3) { e.acc = 2.6; const p = vivoAlAzar(g); if (p) marcar(g, e, p.pos, 2.0, 4.5, 1, 26 + 1.2 * g.wave, 120); }
      procesarMarcas(g, e);
    },
  },
  eclipse: {
    inicio(g) { g.evEliteBoost = 0.45; g.evCoreMul = 1.8; },
    fin(g, e, ok) { if (ok) premiar(g, e, 0.5); },
  },
  marea_sangre: {
    inicio(g, e) {
      const tipos = ['astilla', 'racimo'].filter((k) => (g.curTypes || []).includes(k)), pool = tipos.length ? tipos : ['astilla'];
      const n = Math.max(12, Math.min(30, 10 + 3 * g.wave)), horda = [];
      for (let i = 0; i < n; i++) horda.push(i % 4 === 3 ? pool[pool.length - 1] : pool[0]);
      g.queue.unshift(...horda);
      e.gapAntes = g.spawnGap; g.spawnGap = 0.22; g.spawnT = 0; g.evSpeedMul = 1.25;
    },
    fin(g, e, ok) {
      g.spawnGap = Math.max(g.spawnGap, e.gapAntes || g.spawnGap);
      if (ok) for (const p of g.alivePlayers()) { p.hp = PLAYER.hp; p.shield = Math.max(p.shield, PLAYER.shield * 0.5); }
    },
  },
  aurora_bendita: {
    aviso(g, e) { // el pilar de luz se ve ya en el aviso
      const ref = vivoAlAzar(g); if (!ref) return;
      let pos = null;
      try { pos = g.map.spawnGround(g.evRng, ref.pos); } catch { pos = null; }
      if (!pos || dist(pos, ref.pos) < 6) pos = madd(ref.pos, ref.heading, 14);
      e.zona = { pos, r: 7.5, pur: 1, u: normalEn(g, pos) };
    },
    inicio(g, e) { g.evZona = e.zona; },
    tick(g, e, dt) {
      const z = e.zona; if (!z) return;
      let dentro = 0, enemigos = 0;
      for (const p of g.alivePlayers()) if (dist(p.pos, z.pos) < z.r) { dentro++; p.hp = Math.min(PLAYER.hp, p.hp + 6 * dt); p.shield = Math.min(PLAYER.shield, p.shield + 10 * dt); }
      for (const m of g.monsters) if (!m.dead && !m.def.boss && dist(m.pos, z.pos) < z.r) enemigos++;
      z.pur = Math.max(0, Math.min(1, z.pur + (dentro ? 0.05 : 0) * dt - Math.min(0.14, 0.035 * enemigos) * dt));
      if (z.pur <= 0) { e.ok = false; e.t = 0; }
    },
    fin(g, e, ok) {
      if (!ok || !e.zona) return;
      for (const p of g.alivePlayers()) if (dist(p.pos, e.zona.pos) < e.zona.r + 4) p.shield = PLAYER.shield;
      premiar(g, e, e.zona.pur - 0.5); // premio extra proporcional a la pureza (el premio base lo da terminar())
    },
  },
  silencio: {
    inicio(g) { g.evSilencio = true; g.evMeleeMul = 1.5; g.evCoreMul = 1.3; },
  },
};

/* ───────── snapshot ───────── */
export function evSnap(g) {
  const e = g.ev; if (!e) return null;
  return {
    id: e.id, ph: e.ph, t: r2(Math.max(0, e.t)), d: r2(e.d), cd: r2(e.cd || 0),
    mk: e.marks.map((m) => [...a3(m.pos), r2(Math.max(0, m.at - g.time)), m.r, m.k, ...a3(m.u)]),
    z: e.zona ? [...a3(e.zona.pos), e.zona.r, r2(e.zona.pur), ...a3(e.zona.u)] : 0,
  };
}
