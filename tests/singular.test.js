// SINGULAR (docs/HUESPEDES.md → «Singular»): pozos de gravedad, satélites, Horizonte (inmune a la inversión y fuerte con la Marea), evoluciones, Combo y límites.
// Sólo simulación (sin navegador). La parte visual se prueba en tests/huesped-cuerpo.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, ahead, hash } from './helpers.js';
import { dist } from '../src/sim/math.js';
import { CHARACTERS, HOST_IDS, LIMITS, COMBO_SETS, HABILIDADES, EVO_PATHS } from '../src/sim/data.js';
import { Game } from '../src/sim/game.js';
import { iniciarEvento } from '../src/sim/eventos.js';
import { SING, orbN, orbPos } from '../src/sim/singular.js';

const target = (g, p, d = 3, hp = 5000, kind = 'astilla') => { const m = g.spawnMonster(kind, ahead(p, d)); m.cd = 1e9; m.open = true; m.hp = m.maxhp = hp; m.passive = true; return m; };
const tap = (g, p, k, secs = 0.05) => { g.setInput(p.id, { [k]: true }); run(g, secs); g.setInput(p.id, { [k]: false }); run(g, 0.05); };
const mk = (opts = {}) => { const { g, p } = arena('m1', { seed: 4 }); g.setLoadout(p.id, 'singular'); Object.assign(p, opts); return { g, p }; };
/** Fase de oleada con una criatura lejana inmóvil (los eventos sólo corren en fase 'wave'). */
const enOleada = (g, p) => { g.phase = 'wave'; g.wave = 4; g.queue = []; g.spawnT = 99; g.curTypes = ['astilla', 'racimo']; const d = g.spawnMonster('geoda', ahead(p, 22)); d.passive = true; d.cd = 1e9; d.hp = d.maxhp = 1e9; };
const pozos = (g) => g.objects.filter((o) => o.type === 'pozo');
const dc = (m, p) => Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z);

test('Singular está completo: datos, tienda y rol de gravedad', () => {
  const C = CHARACTERS.singular; assert.ok(C && C.host && HOST_IDS.includes('singular'));
  for (const k of ['mov', 'esp', 's3']) assert.ok(C[k].id && C[k].name && C[k].cd > 0 && C[k].desc, k);
  assert.deepEqual([C.mov.id, C.esp.id, C.s3.id, C.ult.id, C.passive.id], ['honda', 'pozo', 'reflujo', 'supernova', 'horizonte']);
  assert.ok(C.ult.charge === 100 && C.story && C.title && C.extra && C.extra.desc && C.melee.heavy.dmg > C.melee.light.dmg);
  assert.equal(C.starter, false, 'no es inicial'); assert.ok(C.unlock && C.unlock.precio > 0, 'se compra en la tienda con núcleos');
  assert.ok(C.melee.heavy.knock < 0 && C.melee.light.knock < 0, 'sus golpes ARRASTRAN en vez de empujar');
  assert.equal(COMBO_SETS.singular.length, 8); assert.equal(HABILIDADES.singular.id, 'gravedad');
  assert.ok(EVO_PATHS.length === 5 && EVO_PATHS.slice(1).every((n) => n.length === 2), '4 niveles × 2 caminos excluyentes');
});

test('Pozo gravitatorio: tira de las criaturas hacia el centro, las daña, se acota a 3 y colapsa al terminar', () => {
  const { g, p } = mk(); const ms = []; for (let i = 0; i < 5; i++) { const m = target(g, p, 14 + i * 1.5, 5000); m.passive = false; m.def = { ...m.def, speed: 0 }; ms.push(m); }
  tap(g, p, 'esp'); assert.equal(pozos(g).length, 1); const c = pozos(g)[0], d0 = ms.reduce((a, m) => a + dist(m.pos, c.pos), 0); run(g, 2);
  const d1 = ms.reduce((a, m) => a + dist(m.pos, c.pos), 0); assert.ok(d1 < d0 * 0.8, `se juntan en el centro (${d0.toFixed(1)} → ${d1.toFixed(1)})`);
  run(g, 1); assert.ok(ms.some((m) => m.hp < 5000), 'daña');
  const h1 = ms.map((m) => m.hp); run(g, 4); assert.equal(pozos(g).length, 0, 'se cierra solo'); assert.ok(ms.some((m, i) => m.hp < h1[i]), 'la implosión daña');
  const e = mk(); for (let i = 0; i < 12; i++) { e.p.cd = 0; e.p.espCd = 0; tap(e.g, e.p, 'esp'); } assert.ok(pozos(e.g).length <= LIMITS.pozos, `máx ${LIMITS.pozos} pozos`);
  const f = mk({ evo: 4, path: ['depredador', 'velocidad', 'simbiosis', 'apoteosis'] }); for (let i = 0; i < 12; i++) { f.p.espCd = 0; tap(f.g, f.p, 'esp'); } assert.equal(pozos(f.g).length, LIMITS.pozos + 1, 'Apoteosis suma uno');
});

test('Pozo: se come los proyectiles enemigos y lo de adentro recibe +20 % de daño', () => {
  const { g, p } = mk(); tap(g, p, 'esp'); const c = pozos(g)[0];
  g.addProjectile({ owner: 'm', kind: 'orb', pos: { ...c.pos }, vel: { x: 0, y: 0, z: 0.1 }, dmg: 50, r: 0.3, life: 5 }); run(g, 0.2);
  assert.equal(g.projectiles.filter((q) => q.owner === 'm').length, 0, 'el proyectil enemigo desaparece');
  const m = g.spawnMonster('astilla', { ...c.pos }); m.cd = 1e9; m.hp = m.maxhp = 5000; m.passive = true;
  const a = m.hp; g.damageMonster(m, 100, p, m.pos); const inside = a - m.hp;
  const m2 = g.spawnMonster('astilla', ahead(p, -20)); m2.cd = 1e9; m2.hp = m2.maxhp = 5000; m2.passive = true; const b = m2.hp; g.damageMonster(m2, 100, p, m2.pos);
  assert.ok(inside > (b - m2.hp) * 1.15, `adentro ${inside} vs afuera ${b - m2.hp}`);
});

test('Honda gravitatoria: sin pozo salta y deja uno chico; con pozo lo rodea y le da cuerda', () => {
  let { g, p } = mk(); tap(g, p, 'mov'); assert.deepEqual(pozos(g).map((o) => o.kind), ['mini'], 'pozo chico detrás');
  ({ g, p } = mk()); tap(g, p, 'esp'); const w = pozos(g)[0], l0 = w.life; const x0 = { ...p.pos }; p.movCd = 0; tap(g, p, 'mov'); run(g, 0.4);
  assert.ok(dist(p.pos, x0) > 4, 'salió disparado'); assert.ok(w.life > l0 - 0.3, 'le dio cuerda al pozo'); assert.equal(pozos(g).length, 1, 'no deja otro pozo');
});

test('Reflujo de marea: los pozos escupen hacia afuera (empuja, daña y frena); sin pozos, onda alrededor', () => {
  const { g, p } = mk(); tap(g, p, 'esp'); const c = pozos(g)[0]; const m = g.spawnMonster('astilla', { x: c.pos.x + 3, y: c.pos.y, z: c.pos.z }); m.cd = 1e9; m.hp = m.maxhp = 5000; m.passive = true; m.vel = { x: 0, y: 0, z: 0 };
  const d0 = dist(m.pos, c.pos), h0 = m.hp; tap(g, p, 's3'); run(g, 0.2); assert.ok(m.hp < h0, 'daña'); assert.ok(m.slowUntil > g.time, 'frena');
  const s = mk(); const n = target(s.g, s.p, 3); n.passive = false; n.vel = { x: 0, y: 0, z: 0 }; const e0 = dist(n.pos, s.p.pos); tap(s.g, s.p, 's3'); run(s.g, 0.15); assert.ok(n.hp < 5000 && dist(n.pos, s.p.pos) > e0, 'sin pozos: onda que empuja'); void d0;
});

test('Satélites: giran alrededor, golpean lo que cruzan, crecen con la evolución y Coraza frena proyectiles', () => {
  const { g, p } = mk(); assert.equal(orbN(p), 3); const a = orbPos(g, p, 0, 3), b = orbPos(g, p, 1, 3); assert.ok(dist(a, p.pos) > 2 && dist(a, b) > 3, 'órbita alrededor del jugador');
  const m = g.spawnMonster('astilla', { ...orbPos(g, p, 0, 3) }); m.cd = 1e9; m.hp = m.maxhp = 5000; m.passive = true; run(g, 2); assert.ok(m.hp < 5000, 'un satélite lo golpeó');
  const e = mk({ evo: 3, path: ['depredador', 'velocidad', 'simbiosis'] }); assert.equal(orbN(e.p), 5, '+1 Depredador, +1 Simbiosis');
  assert.equal(e.g.snapshot().players[0].so[0], 5);
  const c = mk({ evo: 1, path: ['coraza'] }); c.p.hp = 100; let blocked = 0;
  for (let i = 0; i < 40; i++) { const o = orbPos(c.g, c.p, 0, 3); c.g.addProjectile({ owner: 'm', kind: 'orb', pos: { ...o }, vel: { x: 0, y: 0, z: 0.1 }, dmg: 30, r: 0.3, life: 5 }); run(c.g, 0.05); } blocked = c.g.projectiles.filter((q) => q.owner === 'm').length;
  assert.ok(blocked < 8, `Coraza: los satélites se comen proyectiles (quedan ${blocked})`);
});

test('Supernova: un pozo enorme que te sigue, satélites ×2, −25 % de daño y estalla al terminar', () => {
  const { g, p } = mk(); const m = target(g, p, 12); m.passive = false; p.ul = 100; tap(g, p, 'ult'); run(g, 1);
  assert.equal(p.ultId, 'supernova'); const big = pozos(g).find((o) => o.big); assert.ok(big && big.r >= 17, 'pozo enorme'); assert.ok(dist(big.pos, p.pos) < 3, 'te sigue');
  assert.equal(orbN(p), 6, 'satélites ×2'); const s = g.snapshot().players[0]; assert.ok(s.ua > 0 && s.so[0] === 6);
  p.shield = 0; p.hp = 100; p.lastHurt = -99; g.hurtPlayer(p, 40, true); assert.ok(100 - p.hp < 40 * 0.9, 'menos daño');
  const h = m.hp; run(g, 9); assert.equal(p.ultId, ''); assert.equal(pozos(g).length, 0); assert.ok(m.hp < h, 'daño total');
});

test('Horizonte: la gravedad no se le invierte en la Marea; la Marea refuerza pozos y satélites; los demás sí se invierten', () => {
  const { g, p } = mk(); enOleada(g, p); const q = g.addPlayer('otro', null, { char: 'axioma' }); iniciarEvento(g, 'marea_gravedad', { aviso: 0 });
  let flipS = false, flipQ = false; for (let i = 0; i < 60 * 12; i++) { g.step(1 / 60); if (g.time < p.flipUntil) flipS = true; if (g.time < q.flipUntil) flipQ = true; }
  assert.equal(flipS, false, 'Singular NO se invierte'); assert.equal(flipQ, true, 'Axioma sí');
  const { g: g2, p: p2 } = mk(); tap(g2, p2, 'esp'); const r0 = pozos(g2)[0].r; const { g: g3, p: p3 } = mk(); enOleada(g3, p3); iniciarEvento(g3, 'marea_gravedad', { aviso: 0 }); run(g3, 4); assert.equal(g3.snapshot().players[0].sm, 1, 'sm = Marea encendida');
  p3.espCd = 0; tap(g3, p3, 'esp'); const r1 = pozos(g3)[0].r; assert.ok(r1 > r0 * 1.3, `pozo más grande con la Marea (${r0} → ${r1})`);
  assert.ok(Math.abs(SING.marea - 1.35) < 1e-9);
});

test('Anomalía: cada baja tira de los vecinos hacia el cadáver (sin azar)', () => {
  const { g, p } = mk({ evo: 4, path: ['depredador', 'velocidad', 'simbiosis', 'anomalia'] }); const a = target(g, p, 6, 5000), b = g.spawnMonster('astilla', { x: a.pos.x + 5, y: a.pos.y, z: a.pos.z }); b.cd = 1e9; b.hp = b.maxhp = 5000; b.vel = { x: 0, y: 0, z: 0 };
  const d0 = dist(a.pos, b.pos); g.killMonster(a, p); run(g, 0.1); assert.ok(dist(a.pos, b.pos) < d0, 'el vecino fue hacia la baja');
});

test('Combo: el set de 8 golpes, ARRASTRA con A1 y la habilidad Colapso gravitatorio abre un pozo', () => {
  const g = new Game({ mapId: 'm1', seed: 4 }); g.phaseT = 1e9; const p = g.addPlayer('t', null, { char: 'singular', mode: 'combo' }); p.hp = 1e6; p.shield = 100;
  const m = target(g, p, 8, 1e6); m.passive = false; m.def = { ...m.def, speed: 0 }; const d0 = dc(m, p);
  for (let i = 0; i < 100; i++) { g.setInput(p.id, { mode: 'combo', a1: i % 30 < 15 }); g.step(1 / 60); } g.setInput(p.id, { mode: 'combo' });
  assert.ok(dc(m, p) < d0 - 2, `A1 arrastra (${d0.toFixed(1)} → ${dc(m, p).toFixed(1)})`);
  const log = []; g.setInput(p.id, { mode: 'combo', hab: true }); g.step(1 / 60); g.setInput(p.id, { mode: 'combo' }); for (let i = 0; i < 60; i++) { g.step(1 / 60); log.push(...g.events); }
  const h = pozos(g).find((o) => o.kind === 'hab'); assert.ok(h, 'pozo de la habilidad'); assert.ok(h.r >= 9, 'radio de la habilidad');
  assert.ok(g.snapshot().players[0].hx > 10, 'enfriamiento visible');
});

test('determinismo y límites: dos partidas iguales dan lo mismo; los objetos no pasan de 40 y no hay NaN', () => {
  const play = () => {
    const { g, p } = mk({ evo: 4, path: ['depredador', 'velocidad', 'simbiosis', 'anomalia'] }); const out = [];
    for (let i = 0; i < 6; i++) target(g, p, 8 + i * 2, 2000).passive = false;
    for (let i = 0; i < 900; i++) { g.setInput(p.id, { esp: i % 40 < 3, s3: i % 200 === 100, mov: i % 150 === 50, ult: i === 400, melee: i % 30 < 10, mz: i % 100 < 30 ? 1 : 0 }); g.step(1 / 60); p.ul = i < 380 ? 100 : p.ul; if (i % 100 === 0) out.push(hash(g.snapshot())); if (i % 60 === 0) { assert.ok(g.objects.length <= 40); assert.ok(pozos(g).filter((o) => !o.big).length <= LIMITS.pozos + 1); } }
    assert.equal(JSON.stringify(g.snapshot()).includes('NaN'), false); return out.join();
  };
  assert.equal(play(), play());
  const fs = import('node:fs'); void fs;
});
