import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { LIMITS, MONSTERS } from '../src/sim/data.js';
import { v3 } from '../src/sim/math.js';
import { makeBot } from '../src/sim/bot.js';

test('rendimiento de la simulación con la horda máxima (90 criaturas + 300 proyectiles, 4 jugadores)', () => {
  for (const mapId of ['m1', 'm2']) {
    const g = new Game({ mapId, seed: 1 }); const ps = [0, 1, 2, 3].map(() => g.addPlayer()); g.phaseT = 1e9;
    const kinds = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].boss);
    for (let i = 0; i < LIMITS.monsters; i++) { const k = kinds[i % kinds.length]; g.spawnMonster(k, MONSTERS[k].fly ? g.map.spawnAir(g.rng, ps[0].pos, ps[0].up) : g.map.spawnGround(g.rng, ps[0].pos)); }
    const bots = ps.map((p, i) => [p, makeBot(g, p.id, { seed: i, skill: 1.2 })]);
    for (let i = 0; i < 300; i++) g.addProjectile({ owner: 'm', kind: 'orb', pos: v3(0, 20, 0), vel: v3(0.5, 0.2, 0.1), dmg: 0, r: 0.2, life: 1e3 });
    const N = 600, ts = [];
    for (let i = 0; i < N; i++) {
      for (const [p, t] of bots) { g.setInput(p.id, t(1 / 60)); p.hp = 1e9; }
      for (const m of g.monsters) m.hp = m.maxhp = 1e9;
      const t0 = performance.now(); g.step(1 / 60); ts.push(performance.now() - t0); g.events.length = 0;
    }
    ts.sort((a, b) => a - b); const mean = ts.reduce((a, b) => a + b, 0) / N, p99 = ts[Math.floor(N * 0.99)];
    console.log(`# sim ${mapId}: ${g.monsters.length} criaturas, ${g.projectiles.length} proyectiles → ${mean.toFixed(2)} ms/paso (p99 ${p99.toFixed(2)} ms; presupuesto 16.7 ms)`);
    assert.ok(g.monsters.length >= 55, `criaturas vivas ${g.monsters.length}`);
    assert.ok(p99 < 16.7, `p99 ${p99}ms excede el presupuesto de 60 Hz`);
  }
});
