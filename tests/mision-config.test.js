// Misiones declarativas y finitas (docs/MISIONES.md, GDD AC-02/AC-10): definición válida, nada infinito, y terminación por TODOS los caminos
// (victoria, derrota, tiempo agotado de misión/jefe/etapa, jugador AFK). Simulación pura, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { MAPS } from '../src/sim/maps.js';
import { WAVE_PLANS, MONSTERS, CORES } from '../src/sim/data.js';
import { MISIONES, MODOS_APARTE, LIMITES, DESCANSO, PREMIO_MISION, validarMision, misionConfig } from '../src/sim/mision-config.js';
import { CAMPAIGN_ORDER, CAMPAIGN_BOSSES } from '../src/sim/campaign.js';
import { OPERATIONS } from '../src/sim/operations.js';

const nueva = (map, n = 1, extra = {}) => { const g = new Game({ mapId: map, operation: true, seed: 5, ...extra }); for (let i = 0; i < n; i++) g.addPlayer('P' + i); return g; };
const correr = (g, s, dt = 1 / 30) => { for (let t = 0; t < s && g.state === 'playing'; t += dt) g.step(dt); };

test('toda arena es una misión finita con definición válida, o un modo aparte declarado', () => {
  for (const id of Object.keys(MAPS)) {
    assert.ok(MISIONES[id] || MAPS[id].base, `${id}: sin misión ni declaración`);
    if (MISIONES[id]) assert.deepEqual(validarMision(id, WAVE_PLANS[id]), [], id);
  }
  assert.deepEqual(Object.keys(MISIONES).sort(), [...CAMPAIGN_ORDER].sort(), 'las seis misiones son las de la campaña');
  // El Campo de pruebas es el ÚNICO modo sin final y está declarado; nunca se usa como misión.
  assert.deepEqual(Object.entries(MODOS_APARTE).filter(([, m]) => m.sinFin).map(([k]) => k).sort(), ['practica', 'santuario']);
  const p = new Game({ mapId: 'm1', practice: true, operation: true }); assert.equal(p.operation, null); assert.equal(p.cfg, null);
});
test('ningún límite es infinito y el jefe se enfurece antes de su tope', () => {
  for (const id of CAMPAIGN_ORDER) {
    const c = misionConfig(id);
    for (const [k, v] of Object.entries({ ...c.limites, ...c.descanso })) assert.ok(Number.isFinite(v) && v > 0, `${id}.${k}`);
    assert.ok(c.boss.enrageT < c.limites.jefe && MONSTERS[c.boss.kind].boss, id);
    assert.ok(c.descanso.solo >= 10 && c.descanso.solo <= 20 && c.descanso.coop <= 22, 'descansos orientativos de 10–20 s');
    assert.ok(c.stages.length >= 5 && c.stages.length <= 8, 'entre 5 y 8 oleadas');
    assert.equal(c.stages.at(-1).kind, 'jefe'); assert.equal(c.stages.filter((s) => s.kind === 'jefe').length, 1);
    assert.ok(CAMPAIGN_BOSSES[id], 'jefe final nombrado');
    for (const s of c.stages) assert.ok(s.plan < WAVE_PLANS[id].length, 'usa los planes de WAVE_PLANS del mapa');
  }
  assert.ok(LIMITES.mision <= 1800 && DESCANSO.rapido >= 10);
});
test('las oleadas de cada misión son variadas: tipos, objetivos y composición', () => {
  for (const id of CAMPAIGN_ORDER) {
    const st = misionConfig(id).stages, tipos = new Set(st.map((s) => s.kind));
    for (const k of ['combate', 'cronometrada', 'evento', 'jefe']) assert.ok(tipos.has(k), `${id} sin ${k}`);
    assert.ok(tipos.size >= 5, `${id}: ${[...tipos]}`);
    assert.ok(new Set(st.map((s) => s.plan)).size >= 4, `${id}: composición poco variada`);
    assert.ok(st.every((s, i) => i === 0 || s.tier >= st[i - 1].tier), 'la intensidad no baja');
  }
});
test('«Islas — Despertar» es el capítulo 1 y los demás conservan los nombres del repositorio', () => {
  assert.equal(OPERATIONS.m1.title, 'Islas — Despertar'); assert.equal(OPERATIONS.m1.chapter, 1);
  assert.deepEqual(CAMPAIGN_ORDER.map((id) => OPERATIONS[id].arena), ['Vacío de Islas', 'Laberinto Celestial', 'Jardín de Carne', 'Plaza de los Ecos', 'Osario sin Techo', 'Cámara Fractal']);
});

test('VICTORIA: recorrer todas las oleadas hasta el jefe termina en won y paga premio de misión', () => {
  const g = nueva('m3'), p = g.players[0]; let cores0;
  for (let n = 1; n <= g.waveTotal; n++) {
    g.startWave(n, WAVE_PLANS.m3); g.queue = []; g.omens = []; g.monsters = []; g.objects = g.objects.filter((o) => !o.objective); g.objective = null; g.objective0 = null;
    cores0 = p.cores || 0; g.updateWaves(0.01);
    if (n < g.waveTotal) { assert.equal(g.phase, 'intermission'); assert.equal(g.state, 'playing'); assert.ok((p.cores || 0) - cores0 >= (g.cfg.stages[n - 1].reward ?? CORES.wave + n * 2), `premio de la oleada ${n}`); }   // + la misión secundaria si se cumplió
  }
  assert.equal(g.state, 'won'); assert.ok((p.cores || 0) - cores0 >= PREMIO_MISION, 'premio de misión al vencer');
});
test('DERROTA: el equipo caído termina la misión; en coop basta que caigan todos', () => {
  const g = nueva('m1', 2); g.startWave(1, WAVE_PLANS.m1); g.players[0].dead = true; correr(g, 0.1); assert.equal(g.state, 'playing');
  g.players[1].dead = true; correr(g, 0.1); assert.equal(g.state, 'lost');
});
test('TIEMPO AGOTADO de la misión: derrota clara aunque nadie haga nada', () => {
  const g = nueva('m1'); g.time = g.cfg.limites.mision - 0.05; g.players[0].hp = g.players[0].shield = 1e9; correr(g, 1);
  assert.equal(g.state, 'lost'); assert.match(g.snapshot().operation.failure, /Tiempo agotado/);
});
test('TIEMPO AGOTADO del encuentro final: derrota por tiempo, no combate eterno', () => {
  for (const id of CAMPAIGN_ORDER) {
    const g = nueva(id); g.startWave(g.waveTotal, WAVE_PLANS[id]); g.spawnFromQueue(); g.omens = []; g.updateOmens();
    g.time = 0; g.stageT = g.stageLimit - 0.05; g.queue = []; correr(g, 1);
    assert.equal(g.state, 'lost', id); assert.match(g.operationFailure, /Tiempo agotado.*encuentro final/);
  }
});
test('el tope del jefe crece con el equipo y el enfurecimiento llega antes que el tope', () => {
  const a = nueva('m1', 1); a.startWave(a.waveTotal, WAVE_PLANS.m1); const b = nueva('m1', 4); b.startWave(b.waveTotal, WAVE_PLANS.m1);
  assert.ok(b.stageLimit > a.stageLimit); assert.equal(a.stageLimit, a.cfg.limites.jefe);
});
test('TIEMPO AGOTADO de una oleada de combate: la red se repliega y la misión sigue (no se queda trabada)', () => {
  const g = nueva('m1'); g.startWave(1, WAVE_PLANS.m1); assert.equal(g.stageLimit, g.cfg.limites.etapa);
  g.queue.push('astilla'); g.stageT = g.stageLimit + 1; g.players[0].hp = g.players[0].shield = 1e9; correr(g, 3);
  assert.equal(g.queue.length, 0); assert.ok(g.events.some((e) => e.t === 'stagecap') || g.phase === 'intermission');
  correr(g, 5); assert.equal(g.phase, 'intermission');
});
test('OBJETIVO sin cumplir: se agota su tiempo y la misión se pierde (sin esperas infinitas)', () => {
  for (const id of CAMPAIGN_ORDER) {
    const g = nueva(id), n = g.cfg.stages.findIndex((s) => s.objective && s.objective !== 'resistir') + 1; g.startWave(n, WAVE_PLANS[id]);
    assert.ok(Number.isFinite(g.objective.limit) && g.objective.limit > 0 && g.objective.limit <= 260, id);
    g.players[0].hp = g.players[0].shield = 1e9; g.objective.t = g.objective.limit - 0.01; g.objective.type === 'ancla' || 0; g.players[0].pos = { x: 5e3, y: 5e3, z: 5e3 };
    g.players[0].dead = false; g.step(0.05); g.step(0.05);
    assert.ok(g.state === 'lost' || g.objective.state !== 'active', id + ' ' + g.state);
  }
});
test('AFK: en solitario el intermedio NO se congela esperando la mejora; se elige sola', () => {
  const g = nueva('m1'); g.startWave(1, WAVE_PLANS.m1); g.queue = []; g.omens = []; g.monsters = []; g.objective = null; g.updateWaves(0.01);
  assert.equal(g.phase, 'intermission'); assert.ok(g.players[0].cards.length >= 1, 'hay mejoras para elegir');
  g.players[0].hp = g.players[0].shield = 1e9;
  const antes = g.wave; let t = 0; while (g.wave === antes && t < 120) { g.step(1 / 30); t += 1 / 30; }
  assert.equal(g.wave, antes + 1, 'la oleada siguiente empezó sin que nadie eligiera');
  assert.ok(t <= g.cfg.descanso.solo + g.cfg.limites.elegirMejora + 1, `esperó ${t.toFixed(1)} s`);
  assert.equal(g.players[0].cards.length, 0);
});
test('AFK en una misión completa: un jugador inactivo no la deja abierta más allá del tope de la misión', () => {
  const g = nueva('m2'); g.players[0].hp = g.players[0].shield = 1e9; g.players[0].bleed = 1e9;   // inmortal e inactivo: el peor caso
  const dt = 1 / 20; let t = 0; while (g.state === 'playing' && t < 2000) { g.step(dt); t += dt; }
  assert.notEqual(g.state, 'playing', 'la partida terminó sola'); assert.ok(g.time <= g.cfg.limites.mision + 1);
});
test('coop 1–4: la misión se arma igual y el jefe final escala con el equipo', () => {
  for (let n = 1; n <= 4; n++) { const g = nueva('m5', n); assert.equal(g.waveTotal, 8); g.startWave(8, WAVE_PLANS.m5); g.spawnFromQueue(); g.omens = []; g.updateOmens(); const b = g.monsters.find((m) => m.def.boss); assert.ok(b); assert.ok(b.maxhp >= MONSTERS[b.kind].hp * (1 + 0.7 * (n - 1)) - 1); }
});
test('la oleada declarada usa una composición propia: la etapa 6 de m4 incluye criaturas que la 1 no', () => {
  const g = nueva('m4'); const set = (n) => { g.startWave(n, WAVE_PLANS.m4); return new Set(g.queue); };
  const a = set(1), b = set(7); assert.ok([...b].some((k) => !a.has(k)));
});
