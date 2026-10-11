import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { MONSTERS, WAVE_PLANS, BOSS_OF, LIMITS } from '../src/sim/data.js';
import { run } from './helpers.js';

const queueFor = (mapId, n, players = 1) => {
  const g = new Game({ mapId, seed: 3 }); for (let i = 0; i < players; i++) g.addPlayer();
  g.startWave(n, WAVE_PLANS[mapId]); return g.queue.slice();
};
const power = (q) => q.reduce((s, k) => s + MONSTERS[k].cost, 0);

for (const mapId of ['m1', 'm2']) {
  test(`${mapId}: la dificultad sube oleada a oleada (presupuesto de criaturas creciente)`, () => {
    const total = WAVE_PLANS[mapId].length; let prev = 0;
    for (let n = 1; n <= total; n++) { const pw = power(queueFor(mapId, n)); assert.ok(pw > prev, `oleada ${n}: ${pw} <= ${prev}`); prev = pw; }
  });

  test(`${mapId}: sólo aparecen criaturas habilitadas para esa oleada y el jefe llega al final`, () => {
    const plan = WAVE_PLANS[mapId];
    for (let n = 1; n <= plan.length; n++) for (const k of queueFor(mapId, n)) assert.ok(plan[n - 1].includes(k), `${k} no habilitada en oleada ${n}`);
    const last = queueFor(mapId, plan.length + 1);
    assert.equal(last[0], BOSS_OF[mapId], 'el jefe abre la oleada final'); assert.equal(last.filter((k) => MONSTERS[k].boss).length, 1);
  });
}

test('el bestiario completo se usa entre los dos mapas (8 criaturas + 2 jefes)', () => {
  const used = new Set([...Object.values(WAVE_PLANS).flat(2), ...Object.values(BOSS_OF)]);
  assert.deepEqual([...used].sort(), Object.keys(MONSTERS).sort());
});

test('más jugadores ⇒ hordas más grandes (escalado cooperativo)', () => {
  assert.ok(power(queueFor('m1', 4, 3)) > power(queueFor('m1', 4, 1)) * 1.8);
});

test('ciclo de oleada: calma inicial → spawn en goteo → oleada limpia → respiro → siguiente', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer(); p.hp = 1e9; const ev = [];
  run(g, 3, () => { }); assert.equal(g.wave, 0); assert.equal(g.monsters.length, 0, 'calma inicial');
  run(g, 3, () => { }); assert.equal(g.wave, 1);
  let maxAlive = 0; run(g, 5, () => { maxAlive = Math.max(maxAlive, g.monsters.length); }); assert.ok(g.monsters.length > 0);
  const total = g.queue.length + g.monsters.length;
  assert.ok(total > g.monsters.length || g.queue.length === 0, 'el resto sigue en cola (goteo)');
  // matar todo hasta limpiar
  for (let i = 0; i < 6000 && g.phase === 'wave'; i++) { for (const m of g.monsters) g.damageMonster(m, 1e9, p); g.step(1 / 60); for (const e of g.drainEvents()) ev.push(e); }
  assert.equal(g.phase, 'intermission'); assert.ok(ev.some((e) => e.t === 'clear' && e.wave === 1));
  assert.equal(p.cards.length, 3, 'tres tarjetas de mejora'); run(g, 8, () => { }); assert.equal(g.wave, 1, 'espera la elección (hasta 12 s)');
  g.setInput(p.id, { pick: 1 }); run(g, 6, () => { }); assert.equal(g.wave, 2, 'tras elegir, sigue');
});

test('victoria: matar al jefe de la oleada final termina la partida en "won"; perder a todos en "lost"', () => {
  const g = new Game({ mapId: 'm2', seed: 2 }); const p = g.addPlayer(); p.hp = 1e9;
  g.wave = g.waveTotal - 1; g.phaseT = 0.1; run(g, 1);
  assert.equal(g.wave, g.waveTotal); const boss = g.monsters.find((m) => m.def.boss) || (run(g, 2), g.monsters.find((m) => m.def.boss));
  assert.ok(boss, 'jefe presente'); boss.open = true; g.damageMonster(boss, 1e9, p);
  for (let i = 0; i < 600 && g.state === 'playing'; i++) { for (const m of g.monsters) g.damageMonster(m, 1e9, p); g.step(1 / 60); }
  assert.equal(g.state, 'won');
  const h = new Game({ mapId: 'm1', seed: 2 }); const q = h.addPlayer(); h.hurtPlayer(q, 1e4); h.step(1 / 60); assert.equal(h.state, 'lost');
});

test('cooperativo: el jugador caído revive al comenzar la siguiente oleada', () => {
  const g = new Game({ mapId: 'm1', seed: 4 }); const a = g.addPlayer(), b = g.addPlayer(); a.hp = 1e9; g.hurtPlayer(b, 1e4);
  assert.ok(b.dead); assert.equal(g.state, 'playing'); g.step(1 / 60); assert.equal(g.state, 'playing', 'queda uno vivo');
  g.phaseT = 0.01; run(g, 0.1); assert.ok(!b.dead && b.hp > 0);
});

test('límite duro de criaturas vivas aun con spawns forzados', () => {
  const g = new Game({ mapId: 'm1', seed: 5 }); const p = g.addPlayer(); p.hp = 1e9;
  for (let i = 0; i < 500; i++) g.spawnMonster('astilla', { x: 0, y: 1.4, z: -10 });
  assert.equal(g.monsters.length, LIMITS.monsters);
});
