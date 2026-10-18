import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { BN_NEUTRO } from '../src/sim/bendiciones.js';
import { XP_RANGO, RANGO_MAX, rangoDeXp, progreso, xpPartida, maestriaMods, recompensas, proximaRecompensa, cosmeticosActivos, BONOS } from '../src/sim/maestria.js';
import { HOST_IDS } from '../src/sim/data.js';

test('rangos: umbrales, progreso y tope', () => {
  assert.equal(rangoDeXp(0), 1); assert.equal(rangoDeXp(99), 1); assert.equal(rangoDeXp(100), 2); assert.equal(rangoDeXp(99999), RANGO_MAX);
  const p = progreso(175); assert.equal(p.rango, 2); assert.equal(p.falta, XP_RANGO[3] - 175); assert.ok(p.frac > 0 && p.frac < 1); assert.equal(progreso(5000).max, true);
});
test('XP de partida: crece con bajas, oleadas y victoria', () => {
  assert.ok(xpPartida({ kills: 10, wave: 3 }) > xpPartida({ kills: 0, wave: 0 })); assert.equal(xpPartida({ won: true }) - xpPartida({}), 60);
});
test('bonos chicos y sin efecto en rango 1; los cinco Huéspedes tienen 5 bonos', () => {
  for (const id of HOST_IDS) {
    assert.deepEqual(maestriaMods(id, 1), {}); assert.equal(BONOS[id].length, 5);
    for (const [k, v] of Object.entries(maestriaMods(id, 10))) if (k !== 'heal' && k !== 'kheal') assert.ok(Math.abs(v - 1) <= 0.12, `${id}.${k}=${v}`);
    assert.equal(recompensas(id).length, 9);
  }
  assert.equal(proximaRecompensa('axioma', 1).rango, 2); assert.equal(proximaRecompensa('axioma', 10), null);
  assert.deepEqual(cosmeticosActivos(1), []); assert.ok(cosmeticosActivos(10).includes('prisma'));
});
test('addPlayer: opts.maestria aplica mods a p.bn y sale en el snapshot (mr); sin ella nada cambia', () => {
  const g0 = new Game({ map: 'm1', seed: 1 }), p0 = g0.addPlayer('A', null, { char: 'axioma' });
  assert.deepEqual(p0.bn, BN_NEUTRO); assert.equal(g0.snapshot().players[0].mr, 1);
  const g1 = new Game({ map: 'm1', seed: 1 }), p1 = g1.addPlayer('A', null, { char: 'axioma', maestria: 10 });
  assert.ok(p1.bn.melee > 1 && p1.bn.dmgIn < 1); assert.equal(g1.snapshot().players[0].mr, 10);
});
