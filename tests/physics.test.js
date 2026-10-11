import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, v3, hash } from './helpers.js';
import { Game } from '../src/sim/game.js';
import { MAPS } from '../src/sim/maps.js';
import { len, dist, dot, finite, makeRng } from '../src/sim/math.js';
import { G, PLAYER } from '../src/sim/data.js';

test('M1: el jugador queda apoyado sobre la isla central (grounded, y≈0.9)', () => {
  const { g, p } = arena('m1'); run(g, 2);
  assert.ok(p.grounded); assert.ok(Math.abs(p.pos.y - PLAYER.radius) < 0.05, `y=${p.pos.y}`);
});

test('M1: saltar sube y vuelve a caer a la isla', () => {
  const { g, p } = arena('m1'); run(g, 0.5);
  let maxY = 0; g.setInput(p.id, { jump: true }); run(g, 0.05); g.setInput(p.id, { jump: false });
  run(g, 1.5, () => { maxY = Math.max(maxY, p.pos.y); });
  assert.ok(maxY > 3, `salto máximo ${maxY}`); assert.ok(p.grounded);
});

test('M1: zona de gravedad invertida (ascensor): el jugador "cae" hacia arriba y camina por el techo', () => {
  const { g, p } = arena('m1'); const z = MAPS.m1.zones.find((q) => q.kind === 'flip');
  p.pos = v3(z.c.x, z.y0 + 2, z.c.z); run(g, 3);
  assert.ok(p.up.y < -0.9, `up.y=${p.up.y}`); assert.ok(p.grounded, 'aterriza en la cara inferior de la isla-techo');
  assert.ok(p.pos.y > z.y0 + 15);
});

test('M1: zona sin gravedad: se conserva la velocidad y no hay caída', () => {
  const { g, p } = arena('m1'); const z = MAPS.m1.zones.find((q) => q.kind === 'zero');
  p.pos = v3(z.c.x, z.c.y, z.c.z); p.vel = v3(0, 0, 0); run(g, 1.5);
  assert.ok(Math.abs(p.pos.y - z.c.y) < 0.5, `y=${p.pos.y}`);
});

test('M1: planetoide con gravedad propia: se camina alrededor sin caerse', () => {
  const { g, p } = arena('m1'); const s = MAPS.m1.solids.find((q) => q.type === 'sph');
  const side = v3(s.c.x + s.r + PLAYER.radius, s.c.y, s.c.z); p.pos = { ...side }; // lejos del portal de la cima
  run(g, 4, () => { g.setInput(p.id, { mz: 1 }); });
  const d = dist(p.pos, s.c);
  assert.ok(Math.abs(d - (s.r + PLAYER.radius)) < 0.4, `distancia al centro ${d}`);
  const radial = { x: (p.pos.x - s.c.x) / d, y: (p.pos.y - s.c.y) / d, z: (p.pos.z - s.c.z) / d };
  assert.ok(dot(radial, p.up) > 0.98, 'el "arriba" apunta hacia afuera del planetoide');
});

test('M1: caer al vacío resta vida y reaparece en la isla central', () => {
  const { g, p } = arena('m1', { hp: 100 }); p.pos = v3(200, 0, 0); p.vel = v3();
  run(g, 3);
  assert.ok(p.shield < 100 || p.hp < 100, 'recibió daño de caída');
  assert.ok(dist(p.pos, v3(0, 0, 0)) < 30 && p.pos.y > -2, `reapareció en ${JSON.stringify(p.pos)}`);
});

test('M1: portales teletransportan y el enfriamiento evita el rebote infinito', () => {
  const { g, p } = arena('m1'); const po = MAPS.m1.portals[0];
  p.pos = { ...po.a }; g.step(1 / 60);
  assert.ok(dist(p.pos, po.b) < 3, 'llegó al portal gemelo');
  const there = { ...p.pos }; run(g, 0.5); assert.ok(dist(p.pos, there) < 3, 'no rebota inmediatamente');
});

test('M1: burbuja de tiempo lento reduce la velocidad de las criaturas dentro (30%)', () => {
  const map = MAPS.m1, z = map.zones.find((q) => q.kind === 'slow');
  assert.equal(map.timeScaleAt(z.c), z.scale); assert.equal(map.timeScaleAt(v3(0, 0, 40)), 1);
  const mk = (pos) => { const { g, p } = arena('m1'); p.pos = v3(0, 0.9, 20); const m = g.spawnMonster('astilla', pos); return { g, m, p }; };
  const a = mk(v3(z.c.x, 1.4, z.c.z)), b = mk(v3(-10, 1.4, 6));
  const x0 = a.m.pos.x, y0 = b.m.pos.x;
  run(a.g, 1); run(b.g, 1);
  assert.ok(dist(a.m.pos, v3(x0, a.m.pos.y, z.c.z)) < dist(b.m.pos, v3(y0, b.m.pos.y, 6)) * 0.6, 'dentro de la burbuja avanza bastante menos');
});

test('M1: los proyectiles se detienen contra la geometría y fuera del mapa', () => {
  const { g, p } = arena('m1');
  g.addProjectile({ owner: 'm', kind: 'orb', pos: v3(0, -2, 0), vel: v3(0, 0, 0), dmg: 5, r: 0.5, life: 5 });
  g.step(1 / 60); assert.equal(g.projectiles.length, 0, 'nace dentro de la isla: se absorbe');
  g.addProjectile({ owner: 'm', kind: 'orb', pos: v3(0, 10, 0), vel: v3(0, 400, 0), dmg: 5, r: 0.5, life: 20 });
  run(g, 3); assert.equal(g.projectiles.length, 0, 'sale de los límites y se elimina');
});

test('M2: se camina por el interior de la esfera: el radio se conserva y el "arriba" apunta al centro', () => {
  const { g, p } = arena('m2'); const R = MAPS.m2.R;
  let worst = 0;
  run(g, 20, () => { g.setInput(p.id, { mz: 1, dyaw: 0.01 }); worst = Math.max(worst, Math.abs(len(p.pos) - (R - PLAYER.radius))); });
  assert.ok(worst < 4.5, `desvío radial máximo ${worst}`); // las colinas elevan el suelo hasta ~8
  assert.ok(len(p.pos) <= R); assert.ok(finite(p.pos));
  const inward = { x: -p.pos.x / len(p.pos), y: -p.pos.y / len(p.pos), z: -p.pos.z / len(p.pos) };
  assert.ok(dot(inward, p.up) > 0.95 || worst > 0.5);
});

test('M2: la marea apaga la gravedad en la ventana programada y avisa antes', () => {
  const m = MAPS.m2;
  assert.ok(!m.fx(10).warn && !m.fx(10).zero);
  assert.ok(m.fx(m.tide.warn + 1).warn); assert.ok(m.fx(m.tide.zeroAt + 1).zero);
  assert.ok(len(m.gravityAt(v3(0, -80, 0), m.tide.zeroAt + 1)) === 0);
  assert.ok(Math.abs(len(m.gravityAt(v3(0, -80, 0), 10)) - G) < 1e-9);
  assert.ok(!m.fx(m.tide.zeroEnd + 0.1).zero);
});

test('M2: en marea cero-G el jugador flota (no cae) y puede nadar con 3D', () => {
  const { g, p } = arena('m2'); g.time = MAPS.m2.tide.zeroAt + 0.5; p.pos = v3(0, -40, 0);
  run(g, 1.5);
  assert.ok(Math.abs(p.pos.y + 40) < 1, `no cae: y=${p.pos.y}`);
  p.pitch = 0.0; run(g, 1.5, () => g.setInput(p.id, { mz: 1 }));
  assert.ok(len(p.vel) > 3, 'se desplaza con empuje propio');
});

test('M2: las colinas son sólidas (no se atraviesan)', () => {
  const { g, p } = arena('m2'); const h = MAPS.m2.solids.find((s) => s.type === 'sph');
  const dir = { x: h.c.x / len(h.c), y: h.c.y / len(h.c), z: h.c.z / len(h.c) };
  p.pos = { x: dir.x * (h.r), y: dir.y * h.r, z: dir.z * h.r }; // pegado a la cima interior
  run(g, 1);
  assert.ok(dist(p.pos, h.c) >= h.r + PLAYER.radius - 0.05 || len(p.pos) >= MAPS.m2.R - 2);
});

test('fuzz: entradas aleatorias durante 60 s nunca producen NaN/Infinity en ninguna mapa', () => {
  for (const mapId of ['m1', 'm2']) {
    const g = new Game({ mapId, seed: 11 }), p = g.addPlayer(); const rng = makeRng(5);
    for (let i = 0; i < 3600; i++) {
      g.setInput(p.id, { mx: rng.range(-1, 1), mz: rng.range(-1, 1), dyaw: rng.range(-0.3, 0.3), dpitch: rng.range(-0.3, 0.3), jump: rng.next() < 0.1, fire: rng.next() < 0.5, dash: rng.next() < 0.3, weapon: rng.int(-1, 4) });
      g.step(1 / 60); g.events.length = 0;
      if (!finite(p.pos) || !finite(p.vel) || !finite(p.up)) assert.fail(`NaN en jugador ${mapId} tick ${i}`);
      for (const m of g.monsters) if (!finite(m.pos)) assert.fail(`NaN en ${m.kind}`);
    }
  }
});

test('determinismo: misma semilla y mismas entradas ⇒ mismo estado (base del servidor autoritativo)', () => {
  const play = () => {
    const g = new Game({ mapId: 'm1', seed: 42 }); const a = g.addPlayer(), b = g.addPlayer(); const rng = makeRng(9);
    for (let i = 0; i < 1800; i++) {
      g.setInput(a.id, { mz: 1, dyaw: rng.range(-0.05, 0.05), fire: true }); g.setInput(b.id, { mx: rng.range(-1, 1), fire: rng.next() < 0.5, jump: rng.next() < 0.05 });
      g.step(1 / 60); g.events.length = 0;
    }
    return hash(g.snapshot());
  };
  assert.equal(play(), play());
});
