import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { LIMITS } from '../src/sim/data.js';
import { makeBot } from '../src/sim/bot.js';
import { v3 } from '../src/sim/math.js';
import { run } from './helpers.js';

test('límites de entidades: proyectiles, pickups y eventos están acotados', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); g.addPlayer(); g.phaseT = 1e9;
  for (let i = 0; i < 2000; i++) g.addProjectile({ owner: 'm', kind: 'orb', pos: v3(0, 10, 0), vel: v3(0, 0.1, 0), dmg: 0, r: 0.1, life: 60 });
  for (let i = 0; i < 500; i++) g.dropPickup('hp', v3(0, 1, 0));
  for (let i = 0; i < 5000; i++) g.emit({ t: 'x' });
  assert.ok(g.projectiles.length <= LIMITS.projectiles); assert.ok(g.pickups.length <= LIMITS.pickups); assert.ok(g.events.length <= LIMITS.events);
});

test('limpieza: proyectiles y pickups vencen; los muertos se purgan', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer(); p.hp = 1e9; g.phaseT = 1e9;
  for (let i = 0; i < 50; i++) g.addProjectile({ owner: 'm', kind: 'orb', pos: v3(0, 10, 0), vel: v3(0, 0.1, 0), dmg: 0, r: 0.1, life: 2 });
  for (let i = 0; i < 20; i++) g.dropPickup('hp', v3(30, 1, 0));
  for (let i = 0; i < 30; i++) g.spawnMonster('astilla', v3(5, 1.4, -5));
  for (const m of g.monsters) g.damageMonster(m, 1e9, p);
  g.step(1 / 60); assert.equal(g.monsters.length, 0);
  run(g, 2.5); assert.equal(g.projectiles.length, 0);
  run(g, 42); assert.equal(g.pickups.length, 0);
});

test('partida larga con horda al máximo: arreglos acotados todo el tiempo y sin NaN', () => {
  const g = new Game({ mapId: 'm2', seed: 8, difficulty: 2.5 }); const p = g.addPlayer(), q = g.addPlayer(), r = g.addPlayer(), s = g.addPlayer();
  const bots = [p, q, r, s].map((x, i) => [x, makeBot(g, x.id, { seed: i + 1, skill: 1.5 })]);
  let peak = { m: 0, p: 0, k: 0 };
  for (let i = 0; i < 60 * 240 && g.state === 'playing'; i++) {
    for (const [x, think] of bots) { g.setInput(x.id, think(1 / 60)); x.hp = Math.max(x.hp, 50); }
    g.step(1 / 60); g.events.length = 0;
    peak = { m: Math.max(peak.m, g.monsters.length), p: Math.max(peak.p, g.projectiles.length), k: Math.max(peak.k, g.pickups.length) };
  }
  assert.ok(peak.m <= LIMITS.monsters && peak.p <= LIMITS.projectiles && peak.k <= LIMITS.pickups, JSON.stringify(peak));
  console.log('# pico de entidades (4 jugadores, dificultad 2.5):', JSON.stringify(peak));
});

test('memoria: tres partidas completas seguidas no hacen crecer el heap de forma sostenida', { skip: !global.gc }, () => {
  const play = (seed) => { const g = new Game({ mapId: 'm1', seed }); const p = g.addPlayer(); const b = makeBot(g, p.id, { seed }); for (let i = 0; i < 60 * 120 && g.state === 'playing'; i++) { g.setInput(p.id, b(1 / 60)); g.step(1 / 60); g.events.length = 0; } };
  play(1); global.gc(); const h0 = process.memoryUsage().heapUsed;
  for (let s = 2; s <= 4; s++) play(s);
  global.gc(); const growth = (process.memoryUsage().heapUsed - h0) / 1048576;
  console.log(`# crecimiento de heap tras 3 partidas: ${growth.toFixed(1)} MB`);
  assert.ok(growth < 25, `crecimiento ${growth} MB`);
});
