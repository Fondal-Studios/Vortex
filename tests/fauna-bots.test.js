import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../tools/bots-report.js';
import { CTL } from '../src/sim/fauna.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Los bots siguen completando las 6 arenas CON fauna (no se traban, no hay NaN, nada se cae del mapa) y no pierden mucho más que SIN ella.
// Los bots no comen ni evitan nada: sólo demuestran que los bichos (y las mordidas de las 3 peligrosas) no vuelven injugable la arena ni les cierran el paso.
// Correr de a una arena: node --test --test-name-pattern="m4" tests/fauna-bots.test.js
const SEEDS = [1, 2];
const jugar = (mapId, off) => { CTL.off = off; try { return SEEDS.map((seed) => playMatch({ mapId, seed, skill: 1.2, maxSeconds: 1500 })); } finally { CTL.off = false; } };
for (const mapId of MAP_IDS) {
  test(`${mapId}: los bots completan las oleadas y el jefe con fauna (no peor que sin ella) y sin trabarse`, { timeout: 900000 }, () => {
    const sin = jugar(mapId, true), con = jugar(mapId, false);
    for (const r of con) {
      assert.notEqual(r.state, 'playing', `${mapId}: partida sin terminar (${r.time}s, oleada ${r.wave})`);
      assert.ok(r.maxStall < 240, `${mapId}: bloqueo de ${r.maxStall}s sin progreso`);
      for (const p of r.g.players) assert.ok(Number.isFinite(p.pos.x), 'sin NaN');
      for (const m of r.g.monsters) assert.ok(Number.isFinite(m.pos.x) && Number.isFinite(m.hp), 'criaturas sin NaN');
      for (const f of r.g.fa.list) assert.ok(Number.isFinite(f.pos.x) && !r.g.map.outOfBounds(f.pos), 'bichos sin NaN y dentro del mapa');
      assert.ok(r.g.fa.list.length <= 12, 'tope de bichos');
    }
    const w = (a) => a.filter((r) => r.state === 'won').length, st = con.reduce((a, r) => { const s = r.g.fa.stats; for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k]; return a; }, {});
    console.log(`# ${mapId}: victorias CON ${w(con)}/${SEEDS.length} · SIN ${w(sin)}/${SEEDS.length} · nacidas ${st.nacidas} · mordidas ${st.mordidas} · huidas ${st.huidas}`);
    assert.ok(w(con) >= w(sin) - 1, `${mapId}: la fauna no vuelve la arena mucho más difícil (CON ${w(con)} vs SIN ${w(sin)})`);
    assert.ok(st.nacidas > 0, 'hubo fauna');
  });
}
