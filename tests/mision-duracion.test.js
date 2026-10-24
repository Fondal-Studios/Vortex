// DURACIÓN MEDIDA (GDD AC-10): un bot tirador competente completa cada capítulo de la campaña en 8–12 min de reloj de simulación
// (rango tolerante 7,5–13 min, semilla fija) y VENCE al jefe final de los seis. No prueba humanos: ver docs/MISIONES.md.
// Medición completa por estilo y semillas: node tools/audit/medicion-capitulos.mjs all all 1,2,3,4,5
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { CAMPAIGN_ORDER } from '../src/sim/campaign.js';
import { botEstilo, CHAR_DE, STYLE_DE } from '../tools/jefe-bots.js';

function jugar(cap, estilo, seed) {
  const g = new Game({ mapId: cap, seed, campaign: true, magazines: true, calm: 4, skillLevel: cap === 'm1' ? 0 : 2 });
  const p = g.addPlayer('Conciencia', null, { char: CHAR_DE[estilo], style: STYLE_DE[estilo], mode: estilo === 'melee' ? 'combo' : 'shooter', kit: 0 });
  const bot = botEstilo(g, p.id, estilo, { seed }), dt = 1 / 30; let jefeVisto = false, nWaves = 0;
  while (g.state === 'playing' && g.time < 1600) {
    const i = bot(dt); i.support = !!(i.esp || i.s3); g.setInput(p.id, i); g.step(dt);
    if (g.monsters.some((m) => m.def.boss)) jefeVisto = true;
    for (const e of g.events) if (e.t === 'wave') nWaves++;
    g.events.length = 0;
  }
  return { state: g.state, min: g.time / 60, jefeVisto, nWaves, total: g.waveTotal, failure: g.operationFailure };
}
for (const cap of CAMPAIGN_ORDER) {
  test(`capítulo ${cap}: un bot tirador gana en 7,5–13 min tras todas las oleadas y el jefe final`, () => {
    const r = jugar(cap, 'shooter', 1);
    assert.equal(r.state, 'won', `${cap}: ${r.state} ${r.failure || ''}`);
    assert.ok(r.jefeVisto, 'apareció el jefe final'); assert.equal(r.nWaves, r.total, 'se jugaron todas las oleadas');
    assert.ok(r.min >= 7.5 && r.min <= 13, `${cap}: ${r.min.toFixed(2)} min`);
  });
}
