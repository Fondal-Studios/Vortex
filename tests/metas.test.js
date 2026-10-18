import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { misionDe, MISIONES, puntoObjetivo } from '../src/sim/metas.js';
import { metaActual, textoMision, textoObjetivo, metaMapa, PASOS_GUIA } from '../src/client/meta-texto.js';
import { TERRITORIO_IDS } from '../src/sim/bendiciones.js';
import { arena, run, hash } from './helpers.js';

// startWave necesita el plan: lo pasamos igual que updateWaves
import { WAVE_PLANS } from '../src/sim/data.js';
const ola = (n, mapId = 'm1', seed = 3) => { const g = new Game({ mapId, seed }); const p = g.addPlayer('t'); p.hp = 1e6; g.startWave(n, WAVE_PLANS[mapId]); return { g, p }; };

test('misionDe: ciclo determinista; el élite sólo desde la oleada 3', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(misionDe), ['melee', 'intacto', 'elite', 'melee', 'intacto', 'elite']);
  for (const k of Object.keys(MISIONES)) assert.ok(MISIONES[k].nombre);
});

test('cada oleada normal tiene su misión en el snapshot; el jefe y la práctica no', () => {
  const { g } = ola(1);
  const s = g.snapshot(); assert.equal(s.mis.k, 'melee'); assert.equal(s.mis.st, 'active'); assert.ok(s.mis.rc > 0 && s.mis.n >= 3);
  const j = ola(new Game({ mapId: 'm1' }).waveTotal); assert.equal(j.g.snapshot().mis, null, 'sin misión en el jefe');
  const pr = new Game({ mapId: 'm1', practice: true }); assert.equal(pr.snapshot().mis, null);
});

test('misión melé: sólo cuentan las bajas con golpe cuerpo a cuerpo y paga núcleos', () => {
  const { g, p } = ola(1); const antes = p.cores;
  const mata = (melee) => { const m = g.spawnMonster('astilla', p.pos, { noElite: true }); p.inMelee = melee; g.killMonster(m, p); p.inMelee = false; };
  mata(false); assert.equal(g.mision.p, 0, 'un disparo no cuenta');
  for (let i = 0; i < g.mision.n; i++) mata(true);
  assert.equal(g.mision.st, 'done'); assert.equal(p.cores - antes >= g.mision.rc, true);
  assert.ok(g.events.some((e) => e.t === 'mision' && e.ph === 'done'));
});

test('misión intocable: el primer daño la pierde; si no, se cumple al superar la oleada', () => {
  let { g, p } = ola(2); assert.equal(g.mision.k, 'intacto');
  g.hurtPlayer(p, 10, true); assert.equal(g.mision.st, 'failed');
  ({ g, p } = ola(2)); const antes = p.cores;
  g.queue = []; g.omens = []; g.monsters = []; g.objective = null; g.step(1 / 60);   // oleada despejada
  assert.equal(g.mision.st, 'done'); assert.ok(p.cores > antes);
});

test('misión élite: siempre se puede cumplir (el primer bicho es élite) y da esencia', () => {
  const { g, p } = ola(3); assert.equal(g.mision.k, 'elite');
  const m = g.spawnMonster('astilla', p.pos); assert.ok(m.elite, 'élite garantizado');
  const e0 = Object.values(p.ess).reduce((a, b) => a + b, 0);
  g.killMonster(m, p); assert.equal(g.mision.st, 'done');
  assert.ok(Object.values(p.ess).reduce((a, b) => a + b, 0) > e0);
  const n = g.spawnMonster('astilla', p.pos, { noElite: false }); assert.equal(typeof n.elite, 'boolean');
});

test('misión no cumplida al terminar la oleada queda perdida', () => {
  const { g } = ola(1); g.queue = []; g.omens = []; g.monsters = []; g.objective = null; g.step(1 / 60);
  assert.equal(g.mision.st, 'failed');
});

test('determinismo: dos partidas iguales dan el mismo snapshot con misiones', () => {
  const a = ola(3, 'm2', 9), b = ola(3, 'm2', 9);
  run(a.g, 3); run(b.g, 3); assert.equal(hash(a.g.snapshot()), hash(b.g.snapshot()));
});

test('snapshot.obj.tg: el punto del objetivo es un lugar o null', () => {
  for (const [mapId, n] of [['m1', 2], ['m1', 4], ['m1', 5], ['m4', 2]]) {
    const { g } = ola(n, mapId); const o = g.snapshot().obj;
    assert.ok(o, `${mapId} oleada ${n} trae objetivo`); assert.ok(Array.isArray(o.tg) && o.tg.length === 3 && o.tg.every(Number.isFinite), `${o.type}: punto válido`);
    assert.deepEqual(puntoObjetivo(g), o.tg);
  }
  const { g } = ola(1); assert.equal(g.snapshot().obj, null);
});

test('núcleo: la flecha apunta al núcleo y, cuando alguien lo lleva, al altar', () => {
  const { g, p } = ola(5); const [core, altar] = g.objects.filter((o) => o.objective);
  assert.deepEqual(puntoObjetivo(g).map((x) => x), [core.pos.x, core.pos.y, core.pos.z].map((x) => Math.round(x * 100) / 100));
  core.carrier = p.id; p.carry = core.id;
  assert.deepEqual(puntoObjetivo(g), [altar.pos.x, altar.pos.y, altar.pos.z].map((x) => Math.round(x * 100) / 100));
});

/* ───── textos del HUD (puros) ───── */
const snap = (o = {}) => ({ state: 'playing', phase: 'wave', wave: 3, waveTotal: 8, left: 12, obj: null, boss: null, mis: null, intermission: 5, ...o });
test('metaActual: oleada normal, objetivo, respiro, mejora y jefe', () => {
  assert.equal(metaActual(snap(), {}).main, 'Oleada 3/8 · Eliminá 12 criaturas');
  assert.equal(metaActual(snap({ left: 1 }), {}).main, 'Oleada 3/8 · Eliminá 1 criatura');
  const o = metaActual(snap({ obj: { type: 'nucleo', state: 'active', prog: 0.3, title: 'x' } }), { carry: 4 });
  assert.match(o.main, /^Oleada 3\/8 · Llevá el núcleo al altar/); assert.equal(o.kind, 'objetivo');
  assert.match(metaActual(snap({ obj: { type: 'ancla', state: 'active', prog: 0.5 } }), {}).main, /Ancla.*50 %/);
  assert.match(metaActual(snap({ phase: 'intermission' }), {}).main, /Respiro .* oleada 4\/8 en 5 s/);
  assert.equal(metaActual(snap({ phase: 'intermission' }), { cards: [[1]] }).kind, 'mejora');
  assert.match(metaActual(snap({ phase: 'intermission', wave: 0 }), {}).main, /empieza en 5 s/);
  const j = metaActual(snap({ wave: 8, boss: { name: 'El Mandinga', hp: 500, max: 1000 } }), {});
  assert.equal(j.kind, 'jefe'); assert.match(j.main, /Derrotá a El Mandinga \(50 %/);
  assert.match(metaActual(snap({ phase: 'intermission', wave: 7 }), {}).main, /viene el jefe/);
  assert.equal(metaActual(snap({ state: 'won' }), {}), null);
});
test('textoMision y metaMapa: textos en español con premio', () => {
  assert.equal(textoMision(null), null);
  assert.match(textoMision({ k: 'melee', n: 4, p: 1, st: 'active', rc: 16 }).txt, /matá 4 con melé \(1\/4\).*\+16 núcleos/);
  assert.equal(textoMision({ k: 'intacto', n: 1, p: 1, st: 'done', rc: 20 }).cls, 'done');
  assert.equal(textoMision({ k: 'elite', n: 1, p: 0, st: 'failed', rc: 20 }).cls, 'fail');
  for (const t of TERRITORIO_IDS) { const m = metaMapa(t); assert.match(m.texto, /bendición/); assert.equal(m.bendiciones.length, 2); }
  assert.equal(metaMapa('zz'), null);
  assert.equal(textoObjetivo(null), ''); assert.equal(PASOS_GUIA.length, 4);
});
