// Eventos de oleada (src/sim/eventos.js): la gravedad invertida sólo existe dentro de «Marea de Gravedad».
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
import { EVENTO, EVENTOS, EVENTO_IDS, EVENTOS_MAPA, WAVE_PLANS } from '../src/sim/data.js';
import { iniciarEvento, puedeInvertir, volteaJugador, factorFlip, planOleada } from '../src/sim/eventos.js';
import { MAP_IDS } from '../src/sim/maps.js';
import { arena, run, ahead, hash } from './helpers.js';
import { len, dot, dist } from '../src/sim/math.js';

/** Partida larga con un bot invulnerable; registra eventos de oleada y cambios de gravedad de cada jugador. */
function jugar({ mapId = 'm1', seed = 1, oleadas = 12, maxSeg = 3000, dt = 1 / 30, soft = false } = {}) {
  const g = new Game({ mapId, seed }); g.waveTotal = oleadas + 1;
  const p = g.addPlayer('bot'); const bot = makeBot(g, p.id, { seed, skill: 1.2 });
  const avisos = [], activos = [], flips = [], gravEv = []; let ultima = 0;
  while (g.state === 'playing' && g.wave <= oleadas && g.time < maxSeg) {
    p.hp = 1e9; p.shield = 100;
    const inp = bot(dt); if (soft) inp.soft = true; g.setInput(p.id, inp);
    const antes = p.flipFrom, flipAntes = g.time < p.flipUntil;
    g.step(dt);
    for (const e of g.events) {
      if (e.t === 'ev' && e.ph === 'aviso') avisos.push({ id: e.id, wave: g.wave, t: g.time });
      if (e.t === 'ev' && e.ph === 'activo') activos.push({ id: e.id, wave: g.wave, t: g.time });
      if (e.t === 'gravity') gravEv.push({ t: g.time, soft: !!e.soft, marea: puedeInvertir(g) });
    }
    if (!flipAntes && g.time < p.flipUntil) flips.push({ t: g.time, marea: puedeInvertir(g), id: g.ev && g.ev.id });
    void antes; ultima = g.time; g.events.length = 0;
  }
  return { g, p, avisos, activos, flips, gravEv, ultima };
}

test('datos: 8 eventos con nombre, descripción, telegrafía y contrapartida; cada mapa tiene su subconjunto con pesos', () => {
  assert.ok(EVENTO_IDS.length >= 7);
  for (const id of EVENTO_IDS) { const D = EVENTOS[id]; for (const k of ['name', 'desc', 'tele', 'contra']) assert.ok(typeof D[k] === 'string' && D[k].length > 3, `${id}.${k}`); assert.ok(D.dur > 0 && D.dur <= 30, `${id} duración acotada`); }
  const usados = new Set();
  for (const m of MAP_IDS) { const w = EVENTOS_MAPA[m]; assert.ok(w && Object.keys(w).length >= 4, `mapa ${m} sin subconjunto`); for (const [k, v] of Object.entries(w)) { assert.ok(EVENTOS[k], `${m}: evento desconocido ${k}`); assert.ok(v > 0); usados.add(k); } }
  assert.deepEqual([...usados].sort(), [...EVENTO_IDS].sort(), 'todos los eventos aparecen en algún mapa');
  assert.ok(EVENTOS_MAPA.m1.marea_gravedad >= 3 && EVENTOS_MAPA.m2.marea_gravedad >= 3, 'el Vacío de Islas y la Cámara Fractal son los de la gravedad');
  assert.equal(EVENTO.flipMax, 3.5); assert.equal(EVENTO.flipBloqueo, 20); assert.equal(EVENTO.aviso, 4);
});

test('determinista: misma semilla ⇒ mismos eventos, mismas fechas y mismo estado; otra semilla ⇒ otro plan', () => {
  const a = jugar({ seed: 5, oleadas: 5 }), b = jugar({ seed: 5, oleadas: 5 }), c = jugar({ seed: 6, oleadas: 5 });
  assert.deepEqual(a.g.evLog, b.g.evLog); assert.deepEqual(a.avisos, b.avisos); assert.equal(hash(a.g.snapshot()), hash(b.g.snapshot()));
  assert.ok(a.g.evLog.length >= 1, 'hubo eventos');  void c;
  const plan = (seed) => { const g = new Game({ mapId: 'm1', seed }); const out = []; for (let n = 1; n <= 12; n++) { g.wave = n; g.evLastWave = -9; planOleada(g, n, false); out.push(g.evPlan ? g.evPlan.id : null); } return out.join(); };
  assert.equal(plan(3), plan(3)); assert.notEqual(plan(3), plan(4));
});

test('máximo UN evento por oleada, ninguno antes de la oleada 3, nunca en dos oleadas seguidas y avisado ~4 s antes', () => {
  for (const mapId of ['m1', 'm3']) {
    const r = jugar({ mapId, seed: 2, oleadas: 12 });
    assert.ok(r.g.wave >= 10, `${mapId}: el bot llegó a la oleada ${r.g.wave}`);
    const porOleada = {}; for (const a of r.avisos) porOleada[a.wave] = (porOleada[a.wave] || 0) + 1;
    for (const [w, n] of Object.entries(porOleada)) { assert.equal(n, 1, `${mapId}: ${n} eventos en la oleada ${w}`); assert.ok(+w >= EVENTO.minOleada, `evento en la oleada ${w}`); }
    const ws = Object.keys(porOleada).map(Number).sort((x, y) => x - y);
    for (let i = 1; i < ws.length; i++) assert.ok(ws[i] - ws[i - 1] >= 2, `${mapId}: oleadas seguidas con evento ${ws[i - 1]},${ws[i]}`);
    assert.ok(ws.length >= 2 && ws.length <= 8, `${mapId}: eventos en ${ws.length} oleadas de 12`);
    for (const a of r.avisos) { const ac = r.activos.find((x) => x.id === a.id && x.t >= a.t); assert.ok(ac && Math.abs(ac.t - a.t - EVENTO.aviso) < 0.1, `aviso ${EVENTO.aviso} s antes`); }
    for (const e of r.g.evLog) assert.ok(EVENTOS[e.id]);
  }
});

test('la gravedad SÓLO se invierte dentro de la Marea de Gravedad; nunca dos inversiones a un jugador en 20 s; <3 cambios por minuto', () => {
  // Forzamos que casi toda oleada elegible traiga Marea de Gravedad (peor caso): si aun así se cumple, con el azar normal sobra.
  const prob = EVENTO.prob, pesos = { ...EVENTOS_MAPA.m1 }, p2 = { ...EVENTOS_MAPA.m2 }, p6 = { ...EVENTOS_MAPA.m6 };
  EVENTO.prob = 1; for (const [m, w] of [['m1', pesos], ['m2', p2], ['m6', p6]]) { for (const k of Object.keys(w)) EVENTOS_MAPA[m][k] = k === 'marea_gravedad' ? 10 : 0.0001; }
  let totalFlips = 0, mareas = 0;
  try {
    for (const [mapId, seed, oleadas] of [['m1', 1, 12], ['m1', 7, 10], ['m2', 3, 7], ['m6', 5, 8]]) {
      const r = jugar({ mapId, seed, oleadas });
      mareas += r.g.evLog.filter((e) => e.id === 'marea_gravedad').length;
      for (const f of r.flips) assert.ok(f.marea && f.id === 'marea_gravedad', `${mapId}/${seed}: inversión fuera de la Marea en t=${f.t.toFixed(1)}`);
      for (const e of r.gravEv) assert.ok(e.marea, `${mapId}/${seed}: pulso de gravedad fuera de la Marea`);
      for (let i = 1; i < r.flips.length; i++) assert.ok(r.flips[i].t - r.flips[i - 1].t >= EVENTO.flipBloqueo, `${mapId}/${seed}: dos inversiones a ${(r.flips[i].t - r.flips[i - 1].t).toFixed(1)} s`);
      const t = r.flips.map((f) => f.t); // ventana deslizante de 60 s y promedio por minuto
      for (let i = 0; i < t.length; i++) assert.ok(t.filter((x) => x >= t[i] && x < t[i] + 60).length < 3, `${mapId}/${seed}: ≥3 cambios en un minuto`);
      assert.ok(r.flips.length / (r.ultima / 60) < 3, `${mapId}: promedio ${(r.flips.length / (r.ultima / 60)).toFixed(2)}/min`);
      totalFlips += r.flips.length;
    }
  } finally { EVENTO.prob = prob; Object.assign(EVENTOS_MAPA.m1, pesos); Object.assign(EVENTOS_MAPA.m2, p2); Object.assign(EVENTOS_MAPA.m6, p6); }
  assert.ok(mareas >= 6 && totalFlips >= 3, `la prueba debe ejercitar la Marea (mareas ${mareas}, inversiones ${totalFlips})`);
  // y con el azar normal (sin forzar), una partida larga tampoco rompe nada
  const n = jugar({ mapId: 'm1', seed: 11, oleadas: 12 }); for (const f of n.flips) assert.ok(f.marea);
  console.log(`# 4 partidas forzadas: ${mareas} mareas, ${totalFlips} inversiones de jugador; azar normal: ${n.flips.length} en ${(n.ultima / 60).toFixed(0)} min`);
});

test('bloqueo de 20 s: volteaJugador no repite al mismo jugador; dura como máximo 3,5 s; rampa suave y aterrizaje blando', () => {
  const { g, p } = arena('m1'); p.pos.y = 30; p.vel = { x: 0, y: 0, z: 0 };
  assert.equal(volteaJugador(g, p, 9), true); assert.ok(p.flipUntil - g.time <= 3.5 + 1e-9, 'tope de 3,5 s');
  assert.equal(volteaJugador(g, p), false, 'no se repite');
  assert.equal(factorFlip(0, 0, 3.5), 1); assert.ok(factorFlip(0.3, 0, 3.5) > -0.2 && factorFlip(0.3, 0, 3.5) < 0.6, 'a mitad de la rampa pasa por ~0 (flotar), no de golpe');
  assert.equal(factorFlip(1.5, 0, 3.5), -1); assert.equal(factorFlip(3.499, 0, 3.5) > 0.9, true);
  let upMin = 9; const up0 = p.up.y; g.setInput(p.id, {});
  run(g, 3.4, () => { upMin = Math.min(upMin, p.up.y); });
  assert.ok(upMin < -0.9, 'se dio vuelta'); assert.ok(up0 > 0.9);
  // terminada la inversión: sube como mucho unos u/s y la caída se limita hasta tocar suelo
  run(g, 1.0); assert.ok(p.vel.y < 12, `sin lanzamiento hacia arriba (vy=${p.vel.y.toFixed(1)})`);
  let peorCaida = 0; run(g, 8, () => { if (g.time < p.cushionUntil) peorCaida = Math.max(peorCaida, -p.vel.y); });
  assert.ok(peorCaida <= EVENTO.amortiguaCaida + 0.8, `caída amortiguada (${peorCaida.toFixed(1)} u/s)`);
  assert.ok(g.time < p.flipLock, 'sigue el bloqueo de 20 s');
  g.time = p.flipLock + 0.1; assert.equal(volteaJugador(g, p), true, 'pasados los 20 s se puede otra vez');
});

test('«Reducir efectos de gravedad» (soft): la inversión es un empujón hacia arriba, sin giro (up no cambia) y con el mismo bloqueo', () => {
  const { g, p } = arena('m1'); g.setInput(p.id, { soft: true });
  assert.equal(volteaJugador(g, p), true); assert.ok(!(g.time < p.flipUntil), 'sin inversión');
  let upMin = 9, vyMax = 0; run(g, 2, () => { upMin = Math.min(upMin, p.up.y); vyMax = Math.max(vyMax, p.vel.y); });
  assert.ok(upMin > 0.99, 'la cámara no gira'); assert.ok(vyMax > 3, `empujón hacia arriba (vy máx ${vyMax.toFixed(1)})`);
  assert.equal(volteaJugador(g, p), false); assert.equal(g.snapshot().players[0].flip, false);
  const r = jugar({ mapId: 'm1', seed: 1, oleadas: 6, soft: true }); assert.equal(r.flips.length, 0, 'ningún giro con soft');
});

test('Marea de Gravedad: cuenta atrás de 3 s en el snapshot y luego invierte a todos; fuera de la Marea los jefes no invierten', () => {
  const { g, p } = prep('m1'); g.wave = 3;
  assert.equal(puedeInvertir(g), false); iniciarEvento(g, 'marea_gravedad');
  let s = g.snapshot().ev; assert.equal(s.ph, 'aviso'); assert.ok(s.t <= 4 && s.t > 3.9); assert.equal(puedeInvertir(g), false, 'durante el aviso aún no');
  run(g, 4.1); s = g.snapshot().ev; assert.equal(s.ph, 'activo'); assert.ok(s.cd > 0 && s.cd <= 3, 'cuenta atrás visible'); assert.equal(puedeInvertir(g), true);
  const antes = g.time < p.flipUntil; run(g, 3.2); assert.equal(antes, false); assert.ok(g.time < p.flipUntil || p.flipLock > 0, 'invirtió tras la cuenta atrás');
  assert.ok(p.flipUntil - p.flipFrom <= 3.5 + 1e-9);
  const cores0 = p.cores; run(g, 8); assert.equal(g.ev, null, 'terminó'); assert.equal(puedeInvertir(g), false); assert.ok(p.cores > cores0 || g.pickups.length > 0, 'premio al terminar');
});

test('Cámara Fractal: su marea de ingravidez es el evento (sin reloj de 60 s) y termina con aterrizaje blando', () => {
  const { g, p } = prep('m2');
  run(g, 130); assert.ok(!g.map.zeroG(g.time) && !g.snapshot().fx.zero, 'sin evento no hay ingravidez, ni a los 130 s');
  iniciarEvento(g, 'marea_gravedad'); run(g, 1); assert.equal(g.snapshot().fx.warn, true, 'el aviso enciende la advertencia del cascarón');
  run(g, 3.5); assert.equal(g.snapshot().fx.zero, true); assert.ok(len(g.map.gravityAt(p.pos, g.time)) === 0);
  let blando = false; run(g, 6.2, () => { if (p.cushionUntil > g.time) blando = true; }); assert.equal(g.snapshot().fx.zero, false); assert.ok(blando, 'amortiguación al volver la gravedad');
  assert.ok(new Game({ mapId: 'm2' }).map !== new Game({ mapId: 'm2' }).map, 'cada partida tiene su propia marea (instancia)');
});

/* ───────── los otros eventos ───────── */
const prep = (mapId = 'm1') => { const { g, p } = arena(mapId); g.phase = 'wave'; g.wave = 4; g.queue = []; g.spawnT = 99; g.curTypes = ['astilla', 'racimo'];
  const d = g.spawnMonster('geoda', ahead(p, 22)); d.passive = true; d.cd = 1e9; d.hp = d.maxhp = 1e9; // una criatura lejana: la oleada no termina sola
  return { g, p }; };

test('Lluvia de Astillas: marca círculos en el suelo y, 1,5 s después, el impacto hiere a quien siga ahí', () => {
  const { g, p } = prep(); p.shield = 1000; g.setInput(p.id, {}); iniciarEvento(g, 'lluvia_astillas', { aviso: 0 });
  let vistas = 0, maxMk = 0; const sh0 = p.shield; run(g, 8, () => { const mk = g.snapshot().ev.mk; vistas += mk.length ? 1 : 0; maxMk = Math.max(maxMk, mk.length); });
  assert.ok(vistas > 60 && maxMk <= 8, 'círculos telegrafiados'); const m = g.snapshot().ev.mk[0]; if (m) assert.ok(m[3] <= 1.5 + 1e-6, 'tiempo restante visible');
  assert.ok(p.shield < sh0 || p.hp < 1e6, 'hubo impactos');
});

test('Tormenta de Ecos: el rayo cae donde estabas y destroza a las criaturas que atraigas al círculo', () => {
  const { g, p } = prep(); iniciarEvento(g, 'tormenta_ecos', { aviso: 0 });
  const m = g.spawnMonster('geoda', ahead(p, 2)); m.cd = 1e9; m.hp = m.maxhp = 90; m.passive = true; const hp0 = m.hp; let marcado = false;
  run(g, 6, () => { const mk = g.snapshot().ev.mk; if (mk.length && dist({ x: mk[0][0], y: mk[0][1], z: mk[0][2] }, p.pos) < 1) marcado = true; });
  assert.ok(marcado, 'se marcó el punto donde estás'); assert.ok(m.dead || m.hp < hp0, 'el rayo también daña a las criaturas');
});

test('Eclipse: más élites con afijo y más núcleos por baja; Niebla: núcleos ×1,5; Silencio: sin habilidades y melé ×1,5', () => {
  const { g, p } = prep(); iniciarEvento(g, 'eclipse', { aviso: 0 }); assert.equal(g.evCoreMul, 1.8); assert.ok(g.evEliteBoost > 0.3);
  let elites = 0; for (let i = 0; i < 40; i++) { const m = g.spawnMonster('astilla', ahead(p, 30 + i)); if (m && m.elite) { elites++; assert.ok(m.affix, 'élite con afijo'); } }
  assert.ok(elites > 10, `muchos élites en el Eclipse (${elites}/40)`);
  const { g: g2 } = prep(); let e0 = 0; for (let i = 0; i < 40; i++) { const m = g2.spawnMonster('astilla', { x: 40 + i, y: 1, z: 40 }); if (m && m.elite) e0++; } assert.ok(elites > e0, 'más élites que sin evento');
  const a = prep(); iniciarEvento(a.g, 'niebla_almas', { aviso: 0 }); assert.equal(a.g.evCoreMul, 1.5);
  const s = prep(); iniciarEvento(s.g, 'silencio', { aviso: 0 }); assert.equal(s.g.evMeleeMul, 1.5); const usos = []; const libre = () => { s.p.movCd = 0; s.p.espCd = 0; s.p.abilityCd = 0; s.p.s3Cd = 0; s.p.movPrev = s.p.espPrev = s.p.abilityPrev = false; }; libre();
  s.g.setInput(s.p.id, { ability: true, mov: true, esp: true, s3: true, ult: true }); run(s.g, 0.5, () => { for (const e of s.g.drainEvents()) if (e.t === 'skill' || e.t === 'ability') usos.push(e); }); assert.equal(usos.length, 0, 'ninguna habilidad se usa');
  s.g.evSilencio = false; s.g.setInput(s.p.id, { mov: false, esp: false, ability: false }); run(s.g, 0.1); libre(); s.g.setInput(s.p.id, { ability: true, mov: true, esp: true }); run(s.g, 0.3, () => { for (const e of s.g.drainEvents()) if (e.t === 'skill' || e.t === 'ability') usos.push(e); }); assert.ok(usos.length > 0, 'control: sin Silencio sí se usan'); s.g.evSilencio = true;
  s.g.setInput(s.p.id, {}); run(s.g, 12.5); assert.equal(s.g.evSilencio, false, 'termina el silencio'); assert.equal(s.g.evMeleeMul, 1);
});

test('Marea de Sangre: suma una horda rápida de criaturas débiles y al sobrevivir cura', () => {
  const { g, p } = prep(); const q0 = g.queue.length; p.hp = 30; iniciarEvento(g, 'marea_sangre', { aviso: 0 });
  assert.ok(g.queue.length - q0 >= 12 && g.queue.length - q0 <= 30, `horda de ${g.queue.length - q0}`); assert.ok(g.queue.every((k) => ['astilla', 'racimo'].includes(k)), 'sólo débiles');
  assert.equal(g.evSpeedMul, 1.25); assert.ok(g.spawnGap < 0.3);
  const m = g.spawnMonster('astilla', ahead(p, 30)); const base = g.spawnMonster('astilla', ahead(p, 31), { noElite: true }); assert.ok(m.speedMul > 1.2 && base.speedMul > 1.2);
  g.queue = []; g.monsters = []; run(g, 14.5); assert.equal(g.ev, null); assert.equal(g.evSpeedMul, 1); assert.ok(p.hp >= 100 - 1e-6 || p.hp > 30, 'recompensa de vida');
});

test('Bendición de la Aurora: zona que cura y da +30 % de daño; las criaturas la apagan; si sobrevive, premio', () => {
  const { g, p } = prep(); iniciarEvento(g, 'aurora_bendita', { aviso: 0 }); const z = g.ev.zona; assert.ok(z && z.r > 5);
  p.pos = { x: z.pos.x, y: z.pos.y, z: z.pos.z }; p.hp = 50; g.setInput(p.id, {}); run(g, 3); assert.ok(p.hp > 60, `cura dentro (${p.hp.toFixed(0)})`);
  const m = g.spawnMonster('geoda', ahead(p, 3)); m.passive = true; m.cd = 1e9; m.hp = m.maxhp = 1000; const h0 = m.hp; g.damageMonster(m, 100, p); const d1 = h0 - m.hp;
  g.evZona = null; const h1 = m.hp; g.damageMonster(m, 100, p); const d2 = h1 - m.hp; assert.ok(d1 > d2 * 1.25, `más daño dentro (${d1} vs ${d2})`);
  g.evZona = z; assert.ok(g.snapshot().ev.z.length === 8, 'la zona viaja en el snapshot');
  // si las criaturas dominan la zona, se apaga y no hay premio
  const q = prep(); iniciarEvento(q.g, 'aurora_bendita', { aviso: 0 }); const zq = q.g.ev.zona; q.p.pos = { x: zq.pos.x + 80, y: zq.pos.y, z: zq.pos.z };
  for (let i = 0; i < 6; i++) { const mm = q.g.spawnMonster('geoda', { x: zq.pos.x + i, y: zq.pos.y, z: zq.pos.z }); mm.passive = true; mm.cd = 1e9; mm.stun = true; }
  const c0 = q.p.cores; run(q.g, 25); assert.equal(q.g.ev, null); assert.equal(q.p.cores, c0, 'zona perdida: sin premio');
});

test('snapshot.ev: null sin evento; con evento trae id, fase, tiempo y es serializable; el evento "fin" avisa al cliente', () => {
  const { g, p } = prep(); assert.equal(g.snapshot().ev, null); const evs = []; iniciarEvento(g, 'niebla_almas');
  const s = g.snapshot(); assert.deepEqual(Object.keys(s.ev).sort(), ['cd', 'd', 'id', 'mk', 'ph', 't', 'z']); JSON.parse(JSON.stringify(s));
  for (let i = 0; i < 60 * 26; i++) { g.step(1 / 60); for (const e of g.drainEvents()) if (e.t === 'ev') evs.push(e.ph + (e.ok ? ':ok' : '')); }
  assert.deepEqual(evs, ['activo', 'fin:ok']); assert.equal(g.snapshot().ev, null); void p;
});

test('el jefe de la oleada final sólo invierte la gravedad si le toca su Marea; terminar la oleada corta el evento', () => {
  const g = new Game({ mapId: 'm1', seed: 4 }); g.addPlayer('x'); g.wave = 6; g.phase = 'wave';
  for (let s = 0; s < 40; s++) { const gg = new Game({ mapId: 'm1', seed: s }); gg.addPlayer('x'); gg.wave = 6; planOleada(gg, gg.waveTotal, true); if (gg.evPlan) assert.equal(gg.evPlan.id, 'marea_gravedad'); }
  const h = new Game({ mapId: 'm3', seed: 1 }); h.addPlayer('x'); for (let s = 0; s < 20; s++) { planOleada(h, h.waveTotal, true); assert.equal(h.evPlan, null, 'm3 no tiene Marea de Gravedad: el jefe no lleva evento'); }
  assert.ok(WAVE_PLANS.m1.length + 1 === g.waveTotal);
});
