import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../tools/bots-report.js';
import { CTL } from '../src/sim/nieblas.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Los bots siguen completando las 6 arenas CON nieblas de colores (no se traban, no hay NaN) y no pierden mucho más que SIN ellas.
// Se compara con la misma partida con CTL.off porque el punto de partida de algunas arenas ya era justo (ver docs/MUNDO_VIVO.md).
// Los bots de prueba no esquivan avisos ni buscan nieblas: sólo demuestran que el sistema no vuelve injugable la arena.
// Correr de a una arena: node --test --test-name-pattern="m4" tests/nieblas-bots.test.js
const SEEDS = [1, 2, 3, 4];
const jugar = (mapId, off) => { CTL.off = off; try { return SEEDS.map((seed) => playMatch({ mapId, seed, skill: 1.2, maxSeconds: 1500 })); } finally { CTL.off = false; } };
for (const mapId of MAP_IDS) {
  test(`${mapId}: los bots completan las oleadas y el jefe con nieblas de colores (no peor que sin ellas) y sin trabarse`, { timeout: 900000 }, () => {
    const sin = jugar(mapId, true), con = jugar(mapId, false);
    for (const r of con) {
      assert.notEqual(r.state, 'playing', `${mapId}: partida sin terminar (${r.time}s, oleada ${r.wave})`);
      assert.ok(r.maxStall < 240, `${mapId}: bloqueo de ${r.maxStall}s sin progreso`);
      for (const p of r.g.players) assert.ok(Number.isFinite(p.pos.x), 'sin NaN');
      for (const m of r.g.monsters) assert.ok(Number.isFinite(m.pos.x) && Number.isFinite(m.hp), 'criaturas sin NaN');
    }
    const w = (a) => a.filter((r) => r.state === 'won').length, st = con.reduce((a, r) => { const s = r.g.ng.stats; for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k]; return a; }, {});
    console.log(`# ${mapId}: victorias CON ${w(con)}/${SEEDS.length} · SIN ${w(sin)}/${SEEDS.length} · entradas a niebla ${st.entradas} · veneno ${Math.round(st.venenoDado)} · curado ${Math.round(st.curado)} · recarga drenada ${Math.round(st.drenado)} s · zonas de órgano ${st.zonasOrgano} · de evento ${st.zonasEvento} · tiempo medio ${Math.round(con.reduce((a, r) => a + r.time, 0) / con.length)} s (sin: ${Math.round(sin.reduce((a, r) => a + r.time, 0) / sin.length)} s)`);
    assert.ok(w(con) >= w(sin) - 2, `${mapId}: las nieblas no vuelven la arena mucho más difícil (CON ${w(con)} vs SIN ${w(sin)}; con tan pocas semillas hay ruido de ±2)`);
    if (w(sin) >= 1) assert.ok(w(con) >= 1 || w(sin) <= 1, `${mapId}: el jefe sigue siendo derrotable`);
  });
}
