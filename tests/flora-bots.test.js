import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../tools/bots-report.js';
import { CTL } from '../src/sim/flora.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Los bots siguen ganando las 6 arenas CON flora interactiva (no peor que sin ella, mismo criterio que tests/arenas-vivas-bots.test.js: m3 y m6 ya eran justas).
// Correr de a una arena: node --test --test-name-pattern="m4" tests/flora-bots.test.js
const SEEDS = [1, 2, 3, 4];
const jugar = (mapId, off) => { CTL.off = off; try { return SEEDS.map((seed) => playMatch({ mapId, seed, skill: 1.2, maxSeconds: 1500 })); } finally { CTL.off = false; } };
for (const mapId of MAP_IDS) {
  test(`${mapId}: los bots completan las oleadas y el jefe con la flora viva (no peor que sin ella) y sin trabarse`, { timeout: 900000 }, () => {
    const sin = jugar(mapId, true), con = jugar(mapId, false);
    for (const r of con) {
      assert.notEqual(r.state, 'playing', `${mapId}: partida sin terminar (${r.time}s, oleada ${r.wave})`);
      assert.ok(r.maxStall < 240, `${mapId}: bloqueo de ${r.maxStall}s sin progreso`);
      for (const p of r.g.players) assert.ok(Number.isFinite(p.pos.x), 'sin NaN');
      assert.ok(r.g.fl.p.length <= 40, 'tope de entidades');
    }
    const w = (a) => a.filter((r) => r.state === 'won').length, wCon = w(con), wSin = w(sin);
    const st = con.reduce((a, r) => { const s = r.g.fl.stats; for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k]; return a; }, {});
    console.log(`# ${mapId}: victorias CON flora ${wCon}/${SEEDS.length} · SIN ${wSin}/${SEEDS.length} · curado ${Math.round(st.curado)} · cosechas ${st.cosechas} · destruidas ${st.destruidas} · mordiscos ${st.mordiscos} · atrapados ${st.atrapados} · estallidos ${st.estallidos} · nubes ${st.nubes} · fuego ${st.fuego} · raras ${st.raras}`);
    assert.ok(wCon >= 1, `${mapId}: el jefe sigue siendo derrotable`);
    assert.ok(wCon >= wSin - 1, `${mapId}: la flora no vuelve la arena mucho más difícil (CON ${wCon} vs SIN ${wSin}; con tan pocas semillas hay ruido de ±1)`);
  });
}
