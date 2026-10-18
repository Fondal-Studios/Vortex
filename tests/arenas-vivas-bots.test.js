import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../tools/bots-report.js';
import { CTL } from '../src/sim/arenas-vivas.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Los bots siguen ganando las 6 arenas CON organismo vivo. Se compara contra la misma partida SIN arenas vivas (CTL.off) porque el
// punto de partida de algunas arenas ya era justo (m3 y m6: los bots de prueba ganan 2 de 4 / 1 de 4 incluso sin organismo).
// Correr de a una arena: node --test --test-name-pattern="m4" tests/arenas-vivas-bots.test.js
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const jugar = (mapId, off) => { CTL.off = off; try { return SEEDS.map((seed) => playMatch({ mapId, seed, skill: 1.2, maxSeconds: 1500 })); } finally { CTL.off = false; } };
for (const mapId of MAP_IDS) {
  test(`${mapId}: los bots completan las oleadas y el jefe con el organismo vivo (no peor que sin él) y sin trabarse`, { timeout: 900000 }, () => {
    const sin = jugar(mapId, true), con = jugar(mapId, false);
    for (const r of con) {
      assert.notEqual(r.state, 'playing', `${mapId}: partida sin terminar (${r.time}s, oleada ${r.wave})`);
      // (límite holgado: en m6 a veces queda un volador suelto fuera de los muros y el rezagado tarda en volver; pasa también SIN organismo, con 50 s)
      assert.ok(r.maxStall < 240, `${mapId}: bloqueo de ${r.maxStall}s sin progreso`);
      for (const p of r.g.players) assert.ok(Number.isFinite(p.pos.x), 'sin NaN');
    }
    const w = (a) => a.filter((r) => r.state === 'won').length, wCon = w(con), wSin = w(sin);
    const st = con.reduce((a, r) => { const s = r.g.ar.stats; for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k]; return a; }, {});
    console.log(`# ${mapId} ${con[0].g.ar.L.def.nombre}: victorias CON ${wCon}/${SEEDS.length} · SIN ${wSin}/${SEEDS.length} · golpes recibidos ${st.golpes} · ofrendas ${st.ofrendas} · órganos rotos ${st.rotos} · curado ${Math.round(st.curado)} · daño a órganos ${Math.round(st.danioOrganos)}`);
    assert.ok(wCon >= 1, `${mapId}: el jefe sigue siendo derrotable`);
    assert.ok(wCon >= wSin - 2, `${mapId}: el organismo no vuelve la arena mucho más difícil (CON ${wCon} vs SIN ${wSin}; con tan pocas semillas hay ruido de ±2)`);
  });
}
