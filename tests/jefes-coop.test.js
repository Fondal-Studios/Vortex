// Jefes en COOPERATIVO (2–4 jugadores, la misma simulación que corre el servidor): ganan los bots de distintos estilos, la IA reconoce a cada uno y el equipo,
// la mecánica «Juntos» reparte el golpe y todo el estado del jefe sigue siendo compacto. Correr: node --test tests/jefes-coop.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pelea } from '../tools/jefe-bots.js';

for (const [mapId, estilos] of [['m1', ['shooter', 'melee', 'skills', 'shooter']], ['m3', ['shooter', 'melee', 'shooter']], ['m5', ['melee', 'skills']]]) {
  test(`${mapId}: ${estilos.length} jugadores (${estilos.join(', ')}) vencen al jefe; la IA reconoce a cada uno`, { timeout: 900000 }, () => {
    let maxSnap = 0, juntos = 0;
    const r = pelea({ mapId, seed: 3, estilos, maxSeconds: 900, cada: (g, b) => {
      if (!b) return; if (g.tick % 30 === 0) { const s = g.snapshot().boss; if (s) maxSnap = Math.max(maxSnap, JSON.stringify({ ia: s.ia, mc: s.mc }).length); }
      for (const e of g.events) if (e.t === 'jatk' && e.k === 'reparto') juntos++;
    } });
    assert.equal(r.state, 'won', `${mapId}: ${r.state} a los ${r.t} s`); assert.deepEqual([...r.fases].sort(), [1, 2, 3, 4]);
    assert.ok(r.salto < 1.2, `salto ${r.salto}`); assert.ok(maxSnap < 1400, `snapshot ${maxSnap} bytes`);
    const b = r.g.boss, pl = b.ia.pl, ids = r.g.players.map((p) => p.id);
    // cada bot de melé fue clasificado como melé (o mixto) y nunca como tirador; los tiradores nunca como melé
    ids.forEach((id, i) => { const e = pl[id].estilo; if (estilos[i] === 'melee') assert.ok(['melee', 'mixed', 'passive'].includes(e), `${mapId}: el melé quedó como ${e}`); if (estilos[i] === 'shooter') assert.ok(['shooter', 'mixed', 'passive'].includes(e), `${mapId}: el tirador quedó como ${e}`); });
    console.log(`# ${mapId} coop ${estilos.length}: ${r.t} s · posturas ${JSON.stringify(r.posturas.map((x) => x[1]))} · estilos ${JSON.stringify(ids.map((id) => pl[id].estilo))} · «juntos» ${juntos}`);
  });
}

test('Juntos con 4 jugadores: si todos entran al refugio el golpe se reparte (cada uno recibe ≈ ¼ de lo que recibiría solo afuera)', async () => {
  const { Game } = await import('../src/sim/game.js'); const { mecForzar } = await import('../src/sim/jefe-mec.js'); const { v3 } = await import('../src/sim/math.js');
  const g = new Game({ mapId: 'm3', seed: 3 }); const ps = [0, 1, 2, 3].map((i) => { const p = g.addPlayer('t' + i, null, { char: 'axioma' }); p.hp = 1e6; p.shield = 0; return p; });
  g.phaseT = 1e9; g.wave = g.waveTotal; g.phase = 'wave'; g.queue = []; g.ar = null; g.ng = null; g.fl = null; g.fa = null;
  const b = g.spawnMonster('argos', g.map.bossAnchor); b.mec.t = 30; b.mec.cd = b.cd = b.cd2 = b.sum = b.gazeCd = 1e9; b.mec.dCd = 1e9;
  const dmg = {}; const e0 = g.emit.bind(g); g.emit = (e) => { if (e.t === 'hurt') dmg[e.pid] = (dmg[e.pid] || 0) + e.dmg; e0(e); };
  ps.forEach((p, i) => { p.pos = v3(-6 + i * 4, 0.9, 6); p.vel = v3(); }); for (let i = 0; i < 20; i++) g.step(1 / 60);
  assert.ok(mecForzar(g, b, 'reparto')); for (let i = 0; i < 12; i++) g.step(1 / 60); const mk = b.mec.tg.find((k) => k.ref);
  ps.forEach((p, i) => { p.pos = v3(mk.x + i - 1.5, 0.9, mk.z); p.vel = v3(); }); for (let i = 0; i < 200; i++) g.step(1 / 60);
  const cada = ps.map((p) => dmg[p.id] || 0); assert.ok(Math.max(...cada) < 62 * 0.6, `con los 4 adentro: ${JSON.stringify(cada)} (afuera serían ≥ 62)`); assert.ok(Math.min(...cada) > 5);
});
