// Cargadores y recarga: el cargador se vacía, se recarga solo o con R, tarda, se cancela al cambiar de arma y respeta la reserva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { run } from './helpers.js';
import { clipOf } from '../src/sim/loadout.js';

const mk = () => { const g = new Game({ mapId: 'm1', seed: 1, magazines: true }); const p = g.addPlayer('t', null, { char: 'axioma' }); g.phaseT = 1e9; p.hp = 1e6; p.shield = 100; return { g, p }; };

test('el cargador se vacía, recarga sola y vuelve a disparar; la reserva baja', () => {
  const { g, p } = mk(); p.weapon = 2; p.ammo[2] = 150; const cap = clipOf(p, 2); assert.ok(cap >= 10);
  g.setInput(p.id, { fire: true }); run(g, 0.5); const s1 = g.snapshot().players[0]; assert.ok(s1.cl < cap, `disparó del cargador (${s1.cl}/${cap})`);
  run(g, 4); g.setInput(p.id, { fire: false }); run(g, 3); const s2 = g.snapshot().players[0];
  assert.ok(p.ammo[2] < 150 && s2.cl > 0, `recargó sola (cl ${s2.cl}, reserva ${s2.rs})`); assert.ok(s2.rs >= 0);
});

test('recarga manual: tarda, bloquea el disparo y se cancela al cambiar de arma', () => {
  const { g, p } = mk(); p.weapon = 2; p.ammo[2] = 150; p.clip[2] = 3;
  g.setInput(p.id, { reload: true }); run(g, 0.05); g.setInput(p.id, { reload: false });
  assert.ok(p.reloadT > 0.5, 'tarda'); const a0 = p.ammo[2]; g.setInput(p.id, { fire: true }); run(g, 0.3); assert.equal(p.ammo[2], a0, 'no dispara recargando'); g.setInput(p.id, { fire: false });
  run(g, 2); assert.equal(p.reloadT, 0); assert.equal(p.clip[2], clipOf(p, 2));
  p.clip[2] = 2; g.setInput(p.id, { reload: true }); run(g, 0.05); g.setInput(p.id, { reload: false, weapon: 3 }); run(g, 0.2); assert.equal(p.reloadT, 0, 'cambiar de arma cancela'); assert.equal(p.clip[2], 2);
});

test('sin reserva no recarga y cae al Haz; el Haz (munición infinita) recarga siempre; sin cargadores (pruebas viejas) nada cambia', () => {
  const { g, p } = mk(); p.weapon = 2; p.ammo[2] = 2; p.clip[2] = 2; g.setInput(p.id, { fire: true }); run(g, 1); assert.equal(p.weapon, 0, 'sin reserva vuelve al Haz');
  p.weapon = 0; p.clip[0] = 0; g.setInput(p.id, { fire: false }); run(g, 3); assert.ok(p.clip[0] > 0, 'Haz recarga');
  const g2 = new Game({ mapId: 'm1', seed: 1 }); const q = g2.addPlayer('t'); g2.phaseT = 1e9; q.weapon = 2; q.ammo[2] = 150; g2.setInput(q.id, { fire: true }); run(g2, 3); assert.ok(q.ammo[2] < 150 - 20); assert.equal(g2.snapshot().players[0].cl, undefined);
});
