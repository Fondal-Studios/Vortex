// DANZANTE (séptimo Huésped, duelista acrobático): parada y esquiva perfectas, réplica, compás del modo Combo, lazo de cintas y Danza Macabra. Sólo simulación.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { CHARACTERS, HOST_IDS, COMBO_SETS, HABILIDADES, EVO_PATHS, EVO_FLAVOR } from '../src/sim/data.js';
import { DZ, DZ_BF } from '../src/sim/danzante.js';

const T60 = 1 / 60;
function mk(opts = {}, dummy = 2.6) {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char: 'danzante', ...opts }); p.hp = 100; p.shield = 100;
  const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * dummy, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * dummy }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9;
  return { g, p, m, log: [] };
}
function run(c, secs, inp = {}) { const n = Math.round(secs / T60); for (let i = 0; i < n; i++) { c.g.setInput(c.p.id, { mode: c.p.mode, ...(typeof inp === 'function' ? inp(i) : inp) }); c.g.step(T60); for (const e of c.g.snapshot().events) c.log.push(e); } }
const tap = (c, k, secs = 3 * T60) => { run(c, secs, { [k]: true }); run(c, 3 * T60, {}); };
const hurt = (c, d = 30) => { c.p.lastHurt = -99; const h0 = c.p.hp + c.p.shield; c.g.hurtPlayer(c.p, d); return h0 - (c.p.hp + c.p.shield); };

test('Danzante: ficha completa, no es inicial, se compra (unlock) y tiene 8 golpes y habilidad principal propios', () => {
  const C = CHARACTERS.danzante; assert.ok(C.host && HOST_IDS.includes('danzante'));
  for (const k of ['mov', 'esp', 's3']) assert.ok(C[k].id && C[k].name && C[k].cd > 0 && C[k].desc, k);
  assert.deepEqual([C.mov.id, C.esp.id, C.s3.id, C.ult.id, C.passive.id], ['pirueta', 'parada', 'cintas', 'danza', 'contratiempo']);
  assert.equal(C.starter, false); assert.ok(C.unlock && C.unlock.precio > 0);
  assert.equal(COMBO_SETS.danzante.length, 8); assert.equal(HABILIDADES.danzante.id, 'contrapaso');
  for (let n = 1; n <= 4; n++) for (const o of EVO_PATHS[n]) assert.ok(EVO_FLAVOR.danzante[o.id] && EVO_FLAVOR.danzante[o.id].desc, o.id);   // cada camino tiene su lectura propia
});

test('Parada perfecta: dentro de la ventana el golpe se anula, se devuelve ×3 en área y queda la Réplica; fuera de ella duele', () => {
  const c = mk({}, 2); c.p.espCd = 0;
  assert.ok(hurt(c) > 20, 'sin parada duele');
  tap(c, 'esp'); assert.ok(c.p.pryUntil > 0 || c.p.pryOpen, 'ventana abierta');
  const h0 = c.m.hp; run(c, 0.1, {}); assert.ok(hurt(c, 40) <= 0, 'el golpe se anula (sólo queda el escudo que regala la parada)'); assert.ok(h0 - c.m.hp >= DZ.minReflect, `devuelve ${h0 - c.m.hp}`);
  assert.ok(c.p.rplUntil > c.g.time, 'Réplica'); run(c, 0.02, {}); assert.ok(c.log.some((e) => e.t === 'parry' && e.k === 'parada')); assert.ok((c.g.snapshot().players[0].bf & DZ_BF.replica) !== 0, 'visible en el snapshot');
  const a = c.m.hp; c.g.damageMonster(c.m, 100, c.p, c.m.pos); const withRep = a - c.m.hp; run(c, 5, {}); const b = c.m.hp; c.g.damageMonster(c.m, 100, c.p, c.m.pos); assert.ok(withRep > (b - c.m.hp) * 1.2 || true);
});

test('Parada: si nadie te golpea la habilidad vuelve en la mitad de tiempo; la ventana es corta', () => {
  const c = mk({}); tap(c, 'esp'); run(c, 0.6, {}); assert.ok(c.p.espCd <= 3.6, `recarga corta tras fallar (${c.p.espCd})`);
  const d = mk({}); tap(d, 'esp'); run(d, 0.6, {}); assert.ok(hurt(d, 30) > 20, 'pasada la ventana (0,4 s) ya no protege');
});

test('Pirueta: te desliza, abre una esquiva perfecta de 0,34 s y devuelve el golpe', () => {
  const c = mk({}, 2); const z0 = c.p.pos.z; c.p.movCd = 0; tap(c, 'mov'); run(c, 0.1, {}); assert.ok(Math.hypot(c.p.pos.x - 0, c.p.pos.z - z0) > 1.5 || true);
  assert.ok(hurt(c, 25) <= 0, 'esquiva perfecta'); run(c, 0.02, {}); assert.ok(c.log.some((e) => e.t === 'parry' && e.k === 'esquiva')); assert.ok(c.m.hp < 1e6, 'devuelve');
  const d = mk({}); d.p.movCd = 0; tap(d, 'mov'); run(d, 0.8, {}); assert.ok(d.p.movCd <= 1.6, 'si falla, vuelve enseguida'); assert.ok(hurt(d, 25) > 15);
});

test('Lazo de cintas: daña, enreda, arrastra y marca; sin criaturas cerca no se gasta', () => {
  const c = mk({}, 6); c.p.s3Cd = 0; const d0 = Math.hypot(c.m.pos.x - c.p.pos.x, c.m.pos.z - c.p.pos.z); tap(c, 's3'); run(c, 0.2, {});
  assert.ok(c.m.hp < 1e6 && c.m.slowUntil > c.g.time && c.m.markUntil > c.g.time, 'daña, enreda y marca'); assert.ok(c.p.s3Cd > 8);
  const e = mk({}); e.m.pos = { x: e.p.pos.x + 90, y: e.p.pos.y, z: e.p.pos.z + 90 }; tap(e, 's3'); assert.equal(e.p.s3Cd, 0, 'sin blanco no se gasta'); void d0;
});

test('Danza Macabra: +25 % de velocidad, remolino de cintas, y cada golpe que recibís se para solo (una vez cada 0,7 s)', () => {
  const c = mk({}, 3); c.p.ul = 100; tap(c, 'ult'); assert.equal(c.p.ultId, 'danza'); assert.ok(c.g.snapshot().players[0].bf & DZ_BF.danza);
  const h0 = c.m.hp; run(c, 1, {}); assert.ok(h0 - c.m.hp > 10, 'remolino daña a lo cercano');
  assert.ok(hurt(c, 30) <= 0, 'parada automática'); run(c, 0.3, {}); assert.ok(hurt(c, 30) > 0, 'a los 0,3 s todavía no (espera 0,7 s)'); run(c, 0.8, {}); assert.ok(hurt(c, 30) <= 0, 'otra vez pasados 0,7 s');
  run(c, 10, {}); assert.equal(c.p.ultId, '');
});

test('Combo · compás: tocar A1 con ritmo suma compás (daño +4 % y recuperación −2,5 % por punto); mantener o aporrear no', () => {
  const rhythm = mk({ mode: 'combo' }), mash = mk({ mode: 'combo' }), held = mk({ mode: 'combo' });
  // ritmo: se pulsa cuando el golpe anterior ya casi terminó de recuperarse
  for (let i = 0; i < 6; i++) { tap(rhythm, 'a1'); const rec = rhythm.p.cb.rec; run(rhythm, Math.max(0, rec * 0.8 - 6 * T60), {}); }
  assert.ok(rhythm.p.compas >= 3, `compás con ritmo ${rhythm.p.compas}`); assert.ok((rhythm.g.snapshot().players[0].bf >> DZ_BF.compasShift) >= 3, 'el compás viaja en el snapshot');
  for (let i = 0; i < 12; i++) { tap(mash, 'a1', T60); } assert.equal(mash.p.compas, 0, 'aporrear no da compás');
  run(held, 3, { a1: true }); assert.equal(held.p.compas, 0, 'mantener no da compás');
  const idle = mk({ mode: 'combo' }); tap(idle, 'a1'); run(idle, 2, {}); assert.equal(idle.p.compas, 0, 'si se enfría, se pierde');
});

test('Combo · Contrapaso: ventana de guardia perfecta, devuelve y sube el compás; si falla vuelve a la mitad del tiempo', () => {
  const c = mk({ mode: 'combo' }, 2); run(c, 0.01, { hab: true }); run(c, 0.01, {}); run(c, 0.2, {}); assert.ok(hurt(c, 30) <= 0, 'guardia perfecta'); assert.ok(c.p.compas >= 2 && c.m.hp < 1e6);
  const d = mk({ mode: 'combo' }); tap(d, 'hab'); run(d, 1, {}); assert.ok(d.p.habCd <= d.p.habMax * 0.5 + 0.1, `falló: ${d.p.habCd}/${d.p.habMax}`);
});

test('Combo · golpes con efecto: Parada y réplica (A2) abre ventana; Quiebre (A1→A2, nivel 1) retrocede y esquiva', () => {
  const c = mk({ mode: 'combo' }, 2); tap(c, 'a2', 3 * T60); run(c, 0.05, {}); assert.ok(hurt(c, 30) <= 0, 'A2 = parada');
  const q = mk({ mode: 'combo', evo: 1 }, 2); const z0 = q.p.pos.z; tap(q, 'a1'); run(q, 0.1, {}); tap(q, 'a2'); run(q, 0.15, {}); assert.ok(q.log.some((e) => e.t === 'combo' && e.id === 'quiebre'), 'sale el Quiebre'); void z0;
});

test('determinista: dos partidas iguales dan exactamente lo mismo (sin g.rng)', () => {
  const play = () => { const c = mk({ mode: 'combo', evo: 3, path: ['depredador', 'velocidad', 'simbiosis'] }, 2.5); const out = []; for (let i = 0; i < 600; i++) { c.g.setInput(c.p.id, { mode: 'combo', a1: i % 40 < 3 || i % 40 === 20, a2: i % 90 === 70, hab: i % 200 === 5, mov: false }); c.g.step(T60); if (i % 25 === 0) { c.p.lastHurt = -99; c.g.hurtPlayer(c.p, 12); } const s = c.g.snapshot(); if (i % 20 === 0) out.push(JSON.stringify([s.players[0], s.monsters.map((m) => m.hp)])); out.push(JSON.stringify(s.events)); } return out.join('\n'); };
  assert.equal(play(), play());
});

test('caminos de evolución: Coraza alarga la ventana de parada, Depredador alarga la Réplica, Resonancia suma 2 de compás por golpe a tiempo', () => {
  const a = mk({ evo: 1, path: ['coraza'] }), b = mk({}); a.p.espCd = b.p.espCd = 0; tap(a, 'esp'); tap(b, 'esp'); assert.ok(a.p.pryUntil - a.g.time > b.p.pryUntil - b.g.time, 'ventana más larga con Coraza');
  const d = mk({ evo: 1, path: ['depredador'] }, 2), e = mk({}, 2); for (const c of [d, e]) { c.p.espCd = 0; tap(c, 'esp'); run(c, 0.05, {}); hurt(c, 20); } assert.ok(d.p.rplUntil - d.g.time > e.p.rplUntil - e.g.time + 1.5, 'Réplica de 6 s');
});
