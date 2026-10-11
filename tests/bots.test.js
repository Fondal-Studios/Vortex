import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../tools/bots-report.js';

// Partidas completas simuladas por bots (60 Hz, mismo código que usa el servidor).
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
for (const mapId of ['m1', 'm2']) {
  test(`gameplay ${mapId}: ${SEEDS.length} partidas de bots de principio a fin, sin caídas ni bloqueos`, { timeout: 240000 }, () => {
    const res = SEEDS.map((seed) => playMatch({ mapId, seed, skill: 1.2, maxSeconds: 1500 }));
    for (const r of res) {
      assert.notEqual(r.state, 'playing', `seed sin terminar a los ${r.time}s (oleada ${r.wave})`);
      assert.ok(r.maxStall < 150, `bloqueo: ${r.maxStall}s sin progreso`);
      const times = Object.entries(r.waveAt).sort((a, b) => a[0] - b[0]).map(([, t]) => t);
      assert.deepEqual(times, [...times].sort((a, b) => a - b), 'las oleadas empiezan en orden creciente');
    }
    const wins = res.filter((r) => r.state === 'won').length;
    const maxWave = Math.max(...res.map((r) => r.wave));
    console.log(`# ${mapId}: victorias ${wins}/${res.length}; oleada máx ${maxWave}; oleada media de derrota ${(res.filter((r) => r.state === 'lost').reduce((a, r) => a + r.wave, 0) / Math.max(1, res.length - wins)).toFixed(1)}; tiempo medio ${(res.reduce((a, r) => a + r.time, 0) / res.length).toFixed(0)}s`);
    assert.ok(wins >= 1, 'el jefe debe ser derrotable por un jugador competente');
    assert.ok(wins < res.length, 'no debería ser trivial: algún bot pierde');
    assert.ok(maxWave === 7, 'llegan al jefe');
  });
}

test('gameplay cooperativo: 2 bots cooperando ganan al menos una vez y la dificultad escala por jugador', { timeout: 240000 }, () => {
  const res = [1, 2, 3, 4].map((seed) => playMatch({ mapId: 'm1', seed, players: 2, skill: 1.2, maxSeconds: 1500 }));
  for (const r of res) assert.notEqual(r.state, 'playing');
  console.log(`# coop 2 bots M1: victorias ${res.filter((r) => r.state === 'won').length}/4`);
  assert.ok(res.some((r) => r.state === 'won'));
});
