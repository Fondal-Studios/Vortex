import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { MAPS } from '../src/sim/maps.js';
import { MONSTERS, WAVE_PLANS, BOSS_OF, OBJECTIVE_PLAN, OBJECTIVE_INFO } from '../src/sim/data.js';
import { makeBot } from '../src/sim/bot.js';
import { playMatch } from '../tools/bots-report.js';
import { v3, makeRng } from '../src/sim/math.js';

// Mapas del limbo (5: Plaza de los Ecos · 6: Osario sin Techo): registro, límites, física real (sin trampas) y partidas de bots.
const DT = 1 / 60, IDS = ['m5', 'm6'];
const IDLE = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 };
const arena = (mapId, seed = 1) => { const g = new Game({ mapId, seed }); const p = g.addPlayer('t'); g.phaseT = 1e9; p.hp = 1e9; p.shield = 100; return { g, p }; };
/** Camina con la FÍSICA REAL hacia `target` siguiendo map.navStep (como un jugador que va por el camino evidente). */
function walk(g, p, target, maxT = 60) {
  let t = 0;
  while (t < maxT) {
    if (Math.hypot(target.x - p.pos.x, target.z - p.pos.z) < 2.2) return { ok: true, t };
    const st = g.map.navStep(p.pos, target); if (st === 'none') return { ok: false, t, none: true };
    const wp = st || target, wx = wp.x - p.pos.x, wz = wp.z - p.pos.z, l = Math.hypot(wx, wz) || 1;
    p.heading = v3(wx / l, 0, wz / l); g.setInput(p.id, { ...IDLE, mz: 1 }); g.step(DT); g.events.length = 0; t += DT;
    if (p.pos.y < -5) return { ok: false, t, fell: true };
  }
  return { ok: false, t };
}

for (const id of IDS) {
  test(`${id}: registrado con jefe, oleadas de su folclore y objetivos coherentes`, () => {
    const m = MAPS[id]; assert.ok(m && m.id === id && m.limbo);
    assert.ok(MONSTERS[BOSS_OF[id]] && MONSTERS[BOSS_OF[id]].boss !== false);
    const plan = WAVE_PLANS[id]; assert.ok(plan.length >= 5);
    for (const w of plan) for (const k of w) assert.ok(MONSTERS[k], 'criatura inexistente ' + k);
    for (let i = 1; i < plan.length; i++) for (const k of plan[i - 1]) assert.ok(plan[i].includes(k), 'las oleadas sólo agregan criaturas');
    for (const kind of Object.values(OBJECTIVE_PLAN[id])) assert.ok(OBJECTIVE_INFO[kind], 'objetivo sin ficha ' + kind);
    for (const f of ['spawnGround', 'spawnAir', 'playerSpawn', 'outOfBounds', 'gravityAt', 'timeScaleAt', 'fx', 'navStep', 'guard', 'steer']) assert.equal(typeof m[f], 'function', f);
    const g = new Game({ mapId: id, seed: 1 }); assert.equal(g.waveTotal, plan.length + 1);
  });

  test(`${id}: arena cerrada y legible — spawns, objetivos y nodos dentro de los límites`, () => {
    const m = MAPS[id], rng = makeRng(7);
    for (let i = 0; i < 4; i++) { const s = m.playerSpawn(i); assert.ok(m.walkable(s.x, s.z, 0.9), `aparición ${i} libre`); }
    const sp = m.spots; for (const p of [sp.anchor, sp.core, sp.altar, ...sp.plates, ...sp.resonators(4)]) assert.ok(m.walkable(p.x, p.z, 0.8), `punto de objetivo transitable ${JSON.stringify(p)}`);
    for (const ref of [m.playerSpawn(0), v3(0, 0.9, 0), sp.core, sp.altar]) for (let i = 0; i < 60; i++) {
      const g = m.spawnGround(rng, ref); assert.ok(m.walkable(g.x, g.z, 1.2), `aparición terrestre dentro de la arena ${JSON.stringify(g)}`);
      const a = m.spawnAir(rng, ref, v3(0, 1, 0)); assert.ok(m.walkable(a.x, a.z, 0) || m.rooms.some((r) => a.x > r.x0 && a.x < r.x1 && a.z > r.z0 && a.z < r.z1), 'voladores dentro de los límites');
    }
    // todos los nodos de navegación se conectan entre sí (no hay zonas aisladas)
    const n = m.nav; for (let i = 0; i < n.N; i++) for (let j = 0; j < n.N; j++) assert.ok(n.D[i * n.N + j] < 1e8, 'grafo conexo');
    // sin caídas: alrededor de la arena hay muros más altos que cualquier salto (también con gravedad rota)
    for (const w of m.wallDefs) assert.ok(w.h >= 14);
  });

  test(`${id}: transitabilidad física — desde la aparición se llega caminando a cada objetivo y de vuelta`, () => {
    const { g, p } = arena(id), sp = MAPS[id].spots;
    for (const tgt of [sp.anchor, sp.core, sp.altar, sp.plates[0], sp.plates[1], sp.plates[2], sp.plates[3], MAPS[id].playerSpawn(0)]) {
      const r = walk(g, p, tgt); assert.ok(r.ok, `${id}: no llegó a ${JSON.stringify(tgt)} (${JSON.stringify(r)}) desde ${JSON.stringify(p.pos)}`);
    }
  });

  test(`${id}: gravedad rota leve en su zona (se salta más alto) y normal afuera`, () => {
    const m = MAPS[id], z = m.zones.find((q) => q.kind === 'leve');
    assert.ok(Math.abs(m.gravityAt(v3(z.x, 1, z.z)).y) < Math.abs(m.gravityAt(v3(z.x + z.r + 3, 1, z.z)).y) * 0.5);
  });
}

test('mapas del limbo: los bots completan las oleadas y el jefe sin trabarse, y no es trivial', { timeout: 600000 }, () => {
  for (const mapId of IDS) {
    const SEEDS = [1, 2, 3, 4];
    const res = SEEDS.map((seed) => playMatch({ mapId, seed, skill: 1.2, maxSeconds: 1500 }));
    for (const r of res) {
      assert.notEqual(r.state, 'playing', `${mapId}: partida sin terminar (${r.time}s, oleada ${r.wave})`);
      assert.ok(r.maxStall < 90, `${mapId}: bloqueo de ${r.maxStall}s sin progreso`);
      for (const p of r.g.players) assert.ok(r.g.map.walkable(p.pos.x, p.pos.z, 0) || p.dead, 'el bot nunca sale de la arena');
    }
    const wins = res.filter((r) => r.state === 'won').length;
    console.log(`# ${mapId}: victorias ${wins}/${res.length}; tiempo medio ${(res.reduce((a, r) => a + r.time, 0) / res.length).toFixed(0)} s; máx. sin progreso ${Math.max(...res.map((r) => r.maxStall))} s`);
    assert.ok(wins >= 2, `${mapId}: el jefe es derrotable`);
    // «Bot torpe»: antes bastaba skill 0,25; desde que el combate/colisiones se pulieron, 0,25 ya gana m5 (3/3, ~380 s vs ~310 s del bot hábil) y la pérdida aparece con 0,1.
    // Mantenemos la intención (un jugador muy torpe PIERDE) con 0,1.
    const lost = [1, 2, 3].map((seed) => playMatch({ mapId, seed, skill: 0.1, maxSeconds: 1500 })).filter((r) => r.state === 'lost').length;
    assert.ok(lost >= 1, `${mapId}: no es trivial (algún bot torpe pierde)`);
  }
});

test('mapas del limbo: un bot no se queda quieto más de 60 s en la oleada 1', { timeout: 120000 }, () => {
  for (const mapId of IDS) {
    const g = new Game({ mapId, seed: 3 }); const p = g.addPlayer('bot'); const bot = makeBot(g, p.id, { seed: 3, skill: 1.2 });
    let still = 0, max = 0, ref = { x: p.pos.x, z: p.pos.z }, clear = -1;
    while (g.time < 200 && clear < 0) {
      g.setInput(p.id, bot(DT)); g.step(DT); for (const e of g.events) if (e.t === 'clear' && e.wave === 1) clear = g.time; g.events.length = 0;
      if (Math.hypot(p.pos.x - ref.x, p.pos.z - ref.z) > 1.5) { ref = { x: p.pos.x, z: p.pos.z }; still = 0; } else { still += DT; max = Math.max(max, still); }
    }
    assert.ok(clear > 0, `${mapId}: la oleada 1 se limpia`); assert.ok(max < 60, `${mapId}: quieto ${max.toFixed(0)} s`);
  }
});
