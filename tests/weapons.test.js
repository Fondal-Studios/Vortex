import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, ahead, v3 } from './helpers.js';
import { WEAPONS, PLAYER } from '../src/sim/data.js';

const target = (g, p, d, kind = 'astilla', lift = 0.0) => { const m = g.spawnMonster(kind, ahead(p, d, lift)); m.state = 'idle'; m.cd = m.cd2 = 1e9; return m; };
const freeze = (m) => { m.def = { ...m.def, speed: 0 }; m.speedMul = 0; };
const fire = (g, p, w, secs = 0.05) => { p.weapon = w; g.setInput(p.id, { fire: true }); run(g, secs); g.setInput(p.id, { fire: false }); };

test('Haz: un disparo hitscan daña a la criatura apuntada exactamente su daño', () => {
  const { g, p } = arena(); const m = target(g, p, 12); freeze(m); const hp0 = m.hp;
  g.setInput(p.id, { fire: true }); g.step(1 / 60);
  assert.equal(hp0 - m.hp, WEAPONS[0].dmg);
});

test('cada arma hitscan (Haz, Prisma, Ráfaga, Aguja) hace daño y respeta su tope', () => {
  for (const w of [0, 1, 2, 4]) {
    const { g, p } = arena(); const m = target(g, p, 10); freeze(m); m.hp = m.maxhp = 1e5;
    p.ammo[w] = Math.max(p.ammo[w], 5);
    fire(g, p, w, 0.02);
    const dealt = m.maxhp - m.hp, W = WEAPONS[w];
    assert.ok(dealt > 0, `arma ${W.id} no dañó`);
    assert.ok(dealt <= W.dmg * (W.pellets || 1) + 1e-6, `arma ${W.id} dañó de más: ${dealt}`);
  }
});

test('la cadencia limita los disparos: Ráfaga ≈ 1/0.085 por segundo', () => {
  const { g, p } = arena(); p.weapon = 2; p.ammo[2] = 1000; let shots = 0;
  g.setInput(p.id, { fire: true });
  for (let i = 0; i < 120; i++) { g.step(1 / 60); shots += g.drainEvents().filter((e) => e.t === 'shot').length; }
  assert.ok(shots >= 22 && shots <= 25, `disparos en 2s: ${shots}`);
});

test('consumo de munición: Prisma gasta 1 por disparo; Haz es infinito', () => {
  const { g, p } = arena(); p.ammo[1] = 10;
  fire(g, p, 1, 0.02); assert.equal(p.ammo[1], 9);
  const a0 = p.ammo[0]; fire(g, p, 0, 1); assert.equal(p.ammo[0], a0); assert.equal(a0, Infinity);
});

test('sin munición el arma cae al Haz', () => {
  const { g, p } = arena(); p.ammo[3] = 0; p.weapon = 3;
  g.setInput(p.id, { fire: true }); g.step(1 / 60);
  assert.equal(p.weapon, 0);
});

test('Aguja atraviesa (pierce) a varias criaturas; Haz sólo a la primera', () => {
  for (const [w, expectBoth] of [[4, true], [0, false]]) {
    const { g, p } = arena(); const a = target(g, p, 10), b = target(g, p, 16); freeze(a); freeze(b); a.hp = a.maxhp = b.hp = b.maxhp = 1e5;
    p.ammo[4] = 5; fire(g, p, w, 0.02);
    assert.ok(a.hp < a.maxhp, 'la primera siempre recibe daño');
    assert.equal(b.hp < b.maxhp, expectBoth, `arma ${w}`);
  }
});

test('la geometría bloquea los disparos (una criatura bajo la isla no recibe daño)', () => {
  const { g, p } = arena('m1'); p.pitch = -1.5; // mirando recto hacia abajo
  const m = g.spawnMonster('astilla', v3(p.pos.x, -8, p.pos.z)); m.vel = v3(); m.pos = v3(p.pos.x, -8, p.pos.z); freeze(m);
  const hp0 = m.hp; g.setInput(p.id, { fire: true }); g.step(1 / 60);
  assert.equal(m.hp, hp0);
});

test('Nova: proyectil con daño en área y caída por distancia; sin daño propio', () => {
  const { g, p } = arena(); const near = target(g, p, 20), far = target(g, p, 20); freeze(near); freeze(far);
  near.hp = near.maxhp = far.hp = far.maxhp = 1e5;
  far.pos = v3(near.pos.x + 7.5, near.pos.y, near.pos.z);
  const hp = p.hp, sh = p.shield; p.ammo[3] = 3; p.weapon = 3;
  g.setInput(p.id, { fire: true }); g.step(1 / 60); g.setInput(p.id, { fire: false });
  assert.equal(g.projectiles.length, 1);
  run(g, 1);
  assert.equal(g.projectiles.length, 0, 'el cohete debe explotar');
  const dn = near.maxhp - near.hp, df = far.maxhp - far.hp;
  assert.ok(dn > df && df > 0, `caída por distancia: cerca ${dn} lejos ${df}`);
  assert.equal(p.hp, hp); assert.equal(p.shield, sh);
});

test('escudo absorbe primero, después la vida; el escudo se regenera tras la demora', () => {
  const { g, p } = arena('m1', { hp: 100 });
  g.hurtPlayer(p, 60); assert.equal(p.shield, 40); assert.equal(p.hp, 100);
  g.hurtPlayer(p, 60); assert.equal(p.shield, 0); assert.equal(p.hp, 80);
  run(g, PLAYER.shieldDelay - 0.5); assert.equal(p.shield, 0);
  run(g, 1 + 100 / PLAYER.shieldRate); assert.equal(Math.round(p.shield), 100);
  assert.equal(p.hp, 80, 'la vida NO se regenera sola');
});

test('muerte: al llegar a 0 de vida el jugador cae y, sin más jugadores, la partida se pierde', () => {
  const { g, p } = arena('m1', { hp: 10 });
  g.hurtPlayer(p, 500);
  assert.ok(p.dead); g.step(1 / 60); assert.equal(g.state, 'lost');
});

test('blindaje: Geoda cerrada recibe 20% del daño; abierta 100%', () => {
  const { g, p } = arena(); const m = target(g, p, 15, 'geoda'); const hp0 = m.hp;
  m.open = false; g.damageMonster(m, 100, p); assert.ok(Math.abs(hp0 - m.hp - 20) < 1e-9);
  m.open = true; g.damageMonster(m, 100, p); assert.ok(Math.abs(hp0 - m.hp - 120) < 1e-9);
});

test('matar da puntos y bajas al jugador que disparó', () => {
  const { g, p } = arena(); const m = target(g, p, 10); freeze(m); m.hp = 1;
  g.setInput(p.id, { fire: true }); g.step(1 / 60);
  assert.equal(p.kills, 1); assert.ok(p.score > 0);
});

test('recoger botiquín y munición respeta los topes', () => {
  const { g, p } = arena('m1', { hp: 100 }); p.hp = 50;
  g.dropPickup('hp', p.pos); g.dropPickup('ammo', p.pos, 2); p.ammo[2] = 10;
  g.step(1 / 60);
  assert.equal(p.hp, 85); assert.ok(p.ammo[2] > 10 && p.ammo[2] <= WEAPONS[2].max);
  p.ammo[2] = WEAPONS[2].max; g.dropPickup('ammo', p.pos, 2); g.step(1 / 60);
  assert.equal(g.pickups.length, 1, 'con munición llena no se consume');
});
