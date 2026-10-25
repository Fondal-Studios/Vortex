// COLMENA (sexto Huésped, invocador de enjambre): datos, límites de invocaciones, caminos propios, efectos de cada camino, modo Combo y determinismo.
// Lógica: src/sim/enjambre.js · datos: src/sim/colmena-data.js · contrato: docs/HUESPEDES.md → «Colmena».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { CHARACTERS, HOST_IDS, EVO_PATHS, evoPathsFor, LIMITS, COMBO_SETS, HABILIDADES } from '../src/sim/data.js';
import { unitsOf, unitCap, spawnUnit, spawnUnits, plantNest } from '../src/sim/enjambre.js';
import { BF } from '../src/sim/huespedes.js';

const T60 = 1 / 60;
function mk(opts = {}, dummyAt = 8) {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char: 'colmena', ...opts }); p.hp = 100; p.shield = 100;
  let m = null;
  if (dummyAt) { m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * dummyAt, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * dummyAt }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9; }
  return { g, p, m };
}
const run = (c, secs, inp = {}) => { for (let i = 0, n = Math.round(secs / T60); i < n; i++) { c.g.setInput(c.p.id, { ...(typeof inp === 'function' ? inp(i) : inp) }); c.g.step(T60); } };
const dmg = (c) => 1e6 - c.m.hp;

test('Colmena: ficha completa (invocadora, 6.º Huésped), se COMPRA en la tienda y no es inicial', () => {
  const C = CHARACTERS.colmena;
  assert.ok(C && C.host && HOST_IDS.includes('colmena') && C.role === 'invocador' && C.name === 'Colmena');
  assert.equal(C.starter, false); assert.ok(C.unlock && C.unlock.precio > 0, 'unlock.precio en núcleos');
  for (const k of ['mov', 'esp', 's3']) assert.ok(C[k].id && C[k].name && C[k].cd > 0 && C[k].desc, k);
  assert.ok(C.ult.id === 'marabunta' && C.ult.cd > 0 &&   /* las definitivas se recargan por TIEMPO (ultimate-cooldown.js), ya no por carga 0-100 */ C.passive.id && C.story && C.title && C.desc && C.melee.heavy.dmg > C.melee.light.dmg);
  for (const s of ['dano', 'resistencia', 'movilidad', 'control', 'utilidad', 'dificultad']) assert.ok(C.stats[s] >= 0 && C.stats[s] <= 10);
  assert.equal(COMBO_SETS.colmena.length, 8); assert.ok(HABILIDADES.colmena.name && HABILIDADES.colmena.cd > 5);
});

test('evolución: 4 niveles × 2 caminos excluyentes PROPIOS (ids nuevas); el perfil sólo vale con sus ids', () => {
  const EP = evoPathsFor('colmena'); assert.notEqual(EP, EVO_PATHS); assert.equal(EP.length, 5);
  const ids = new Set(); for (let n = 1; n <= 4; n++) { assert.equal(EP[n].length, 2); for (const o of EP[n]) { assert.ok(o.id && o.name && o.desc && o.vis); assert.ok(!ids.has(o.id), o.id); ids.add(o.id); assert.ok(!EVO_PATHS[n].some((x) => x.id === o.id), 'no choca con los comunes'); } }
  assert.equal(evoPathsFor('axioma'), EVO_PATHS);
  const g = new Game({ mapId: 'm1', seed: 2 });
  assert.deepEqual(g.addPlayer('x', null, { char: 'colmena', evo: 3, path: ['criador', 'nube', 'detonador'] }).path, ['criador', 'nube', 'detonador']);
  assert.deepEqual(g.addPlayer('y', null, { char: 'colmena', evo: 3, path: ['coraza', 'nube', 'detonador'] }).path, [], 'una id de otro Huésped no vale');
  assert.deepEqual(g.addPlayer('z', null, { char: 'axioma', evo: 1, path: ['criador'] }).path, [], 'y al revés');
  // evolucionar por la entrada: el camino 2 de cada nivel cierra el 1
  const { g: g2, p } = mk({}, 0); p.cores = 1000;
  for (const pick of [2, 1, 2, 1]) { g2.setInput(p.id, { evo: pick }); g2.step(T60); g2.setInput(p.id, { evo: 0 }); g2.step(T60); }
  assert.equal(p.evo, 4); assert.deepEqual(p.path, ['aguijon', 'nidos', 'detonador', 'reina']);
});

test('invocaciones con LÍMITE: zánganos por jugador y en total, nidos por jugador; el snapshot queda acotado', () => {
  const { g, p } = mk({}, 0);
  for (let i = 0; i < 40; i++) spawnUnit(g, p, {}); assert.equal(unitsOf(g, p).length, unitCap(p)); assert.equal(unitCap(p), 4);
  p.path = ['criador', 'nidos', 'cohabita', 'plaga']; p.evo = 4; assert.equal(unitCap(p), Math.min(LIMITS.units, 10)); for (let i = 0; i < 40; i++) spawnUnit(g, p, {}); assert.ok(unitsOf(g, p).length <= LIMITS.units);
  for (let i = 0; i < 6; i++) plantNest(g, p, p.pos); assert.equal(g.objects.filter((o) => o.type === 'nido').length, LIMITS.nests);
  const g2 = new Game({ mapId: 'm1', seed: 5 }); const ps = [0, 1, 2, 3].map((i) => g2.addPlayer('p' + i, null, { char: 'colmena', evo: 4, path: ['criador', 'nube', 'cohabita', 'plaga'] }));
  for (const q of ps) spawnUnits(g2, q, 20, {}); assert.ok(g2.objects.filter((o) => o.type === 'zangano').length <= LIMITS.unitsTotal, 'tope global');
  const snap = g2.snapshot(), bytes = JSON.stringify(snap.objs).length; assert.ok(bytes < 4000, `objs ${bytes} bytes`);
  const s0 = snap.players[0]; assert.ok(s0.un >= 1 && s0.uc >= 4 && s0.fz === 0);
  assert.equal(JSON.stringify(snap).includes('NaN'), false);
});

test('los zánganos atacan SOLOS, el daño cuenta como del dueño y NO carga su definitiva', () => {
  const c = mk(); spawnUnits(c.g, c.p, 3, {}); run(c, 4); assert.ok(dmg(c) > 60, `daño de las unidades ${dmg(c)}`); assert.equal(c.p.ul, undefined, 'ya no existe la barra de carga de la definitiva');
  // Equivalente actual de «NO carga su definitiva»: el daño de los zánganos no acorta la recarga de la definitiva (solo corre el reloj normal)
  { const d = mk(); d.p.ultCd = 50; d.p.ultCdMax = 50; d.p.ultRefundBudget = 0; spawnUnits(d.g, d.p, 3, {}); run(d, 4); assert.ok(dmg(d) > 60 && d.p.ultCd > 50 - 4 - 0.6, `la definitiva no se reembolsa por daño de zánganos (${d.p.ultCd})`); }
  const lost = c.g.snapshot().events.filter((e) => e.t === 'tshot').length; void lost;
  const far = mk({}, 80); spawnUnits(far.g, far.p, 3, {}); run(far, 3); assert.equal(dmg(far), 0, 'fuera de alcance no atacan');
});

test('Cría viva (pasiva): nace un zángano gratis cada 6 s (hasta 2) y cada uno suma +3 % de daño', () => {
  const c = mk({}, 0); run(c, 20); assert.equal(unitsOf(c.g, c.p).length, 2);
  const a = mk({}, 3); const b = mk({}, 3); spawnUnits(b.g, b.p, 4, {}); b.p.nUnits = 4; a.p.nUnits = 0;
  const hit = (q) => { const m0 = q.m.hp; q.g.damageMonster(q.m, 100, q.p, q.m.pos); return m0 - q.m.hp; };
  assert.ok(hit(b) > hit(a) * 1.1, 'más daño con zánganos');
});

test('caminos: Criador +2 límite, Plaga +4 y cría al matar, Aguijón envenena y pega más, Cohabitación, Nidos vivos, la Reina', () => {
  assert.equal(unitCap(mk({ evo: 1, path: ['criador'] }, 0).p), 6);
  { const c = mk({ evo: 4, path: ['criador', 'nidos', 'cohabita', 'plaga'] }, 0); assert.equal(unitCap(c.p), 10); const k = c.g.spawnMonster('astilla', { x: c.p.pos.x + 4, y: c.p.pos.y + 0.5, z: c.p.pos.z }, { noElite: true }); const n0 = unitsOf(c.g, c.p).length; c.g.killMonster(k, c.p); assert.equal(unitsOf(c.g, c.p).length, n0 + 1, 'Plaga: la baja cría'); }
  { const a = mk({ evo: 1, path: ['aguijon'] }), b = mk({ evo: 1, path: ['criador'] }); for (const c of [a, b]) { spawnUnits(c.g, c.p, 3, {}); run(c, 3); } assert.ok(dmg(a) > dmg(b) * 1.2, 'Aguijón pega más'); assert.ok(a.m.dotKind === 'poison' || a.m.dotUntil > 0, 'envenena'); }
  { const c = mk({ evo: 3, path: ['criador', 'nidos', 'cohabita'] }, 0); spawnUnits(c.g, c.p, 4, {}); run(c, 0.2); const f = (path) => { const q = mk({ evo: 3, path }, 0); spawnUnits(q.g, q.p, 4, {}); run(q, 0.2); q.g.hurtPlayer(q.p, 40, true); return 200 - q.p.hp - q.p.shield; }; assert.ok(f(['criador', 'nidos', 'cohabita']) < f(['criador', 'nidos', 'detonador']), 'Cohabitación: menos daño recibido'); }
  { const c = mk({ evo: 2, path: ['criador', 'nidos'] }); run(c, 6); assert.ok(c.g.objects.some((o) => o.type === 'nido'), 'Nidos vivos: brota solo'); }
  { const c = mk({ evo: 4, path: ['criador', 'nidos', 'cohabita', 'reina'] }); run(c, 3); assert.equal(c.g.objects.filter((o) => o.type === 'reina').length, 1); assert.ok(dmg(c) > 0); }
  { const c = mk({ evo: 3, path: ['criador', 'nidos', 'detonador'] }, 6); spawnUnits(c.g, c.p, 2, { life: 0.5 }); const h0 = c.m.hp; run(c, 2); assert.ok(1e6 - c.m.hp > 0 && h0 >= c.m.hp, 'kamikaze: al caducar estallan'); }
});

test('Marabunta (definitiva): frenesí del enjambre, más límite, un zángano por segundo y −20 % de daño recibido', () => {
  const c = mk(); c.p.ul = 100; run(c, 0.1, { ult: true }); run(c, 0.1, { ult: false }); assert.equal(c.p.ultId, 'marabunta'); const s = c.g.snapshot().players[0]; assert.ok(s.bf & BF.swarm, 'bit de frenesí'); assert.equal(s.fz, 1);
  run(c, 4); assert.ok(unitsOf(c.g, c.p).length >= 4 && unitCap(c.p) === 8, `zánganos ${unitsOf(c.g, c.p).length}`);
  const hp0 = c.p.hp + c.p.shield; c.g.hurtPlayer(c.p, 40, true); const lost = hp0 - c.p.hp - c.p.shield; const d = mk(); const h1 = d.p.hp + d.p.shield; d.g.hurtPlayer(d.p, 40, true); assert.ok(lost < (h1 - d.p.hp - d.p.shield) * 0.9, 'recibe menos');
  run(c, 10); assert.equal(c.p.ultId, ''); assert.equal(unitCap(c.p), 4);
});

test('habilidades del modo Shooter: Zumbido, Criar enjambre y Nido-torreta', () => {
  const c = mk(); const x0 = c.p.pos.x * 0 + 0; void x0;
  run(c, 0.05, { mov: true }); run(c, 0.1, {}); assert.ok(c.p.invulUntil > c.g.time, 'Zumbido: invulnerable'); assert.ok(unitsOf(c.g, c.p).length >= 1);
  const d = mk(); run(d, 0.05, { esp: true }); run(d, 0.05, {}); assert.ok(unitsOf(d.g, d.p).length >= 3, 'Criar: 3 zánganos');
  const e = mk(); run(e, 0.05, { s3: true }); run(e, 0.05, {}); assert.equal(e.g.objects.filter((o) => o.type === 'nido').length, 1); run(e, 3); assert.ok(dmg(e) > 0, 'el nido dispara');
  assert.ok(e.p.s3Cd > 10 && d.p.espCd > 8 && c.p.movCd > 4, 'enfriamientos');
});

test('modo Combo: los golpes con fx «orden» mandan atacar al enjambre y la habilidad «Llamado» lo hace brotar y lo enfurece', () => {
  const hit = (units) => { const c = mk({ mode: 'combo' }, 2.6); if (units) spawnUnits(c.g, c.p, 4, {}); run(c, 0.25, { mode: 'combo', a1: true }); run(c, 0.3, { mode: 'combo' }); return dmg(c); };
  assert.ok(hit(true) > hit(false) * 1.25, 'el enjambre cuenta en el combo');
  const c = mk({ mode: 'combo' }, 3); run(c, 0.05, { mode: 'combo', hab: true }); run(c, 0.9, { mode: 'combo' });
  assert.ok(unitsOf(c.g, c.p).length >= 3, 'Llamado: zánganos'); const s = c.g.snapshot().players[0]; assert.equal(s.fz, 1); assert.ok(s.hc > 10 && s.md === 1);
  const ids = []; const d = mk({ mode: 'combo', evo: 4, path: ['criador', 'nidos', 'cohabita', 'reina'] }, 3); for (let i = 0; i < 400; i++) { d.g.setInput(d.p.id, { mode: 'combo', a1: true }); d.g.step(T60); for (const e of d.g.snapshot().events) if (e.t === 'combo') ids.push(e.id); }
  assert.ok(ids.includes('aguijonada') && ids.includes('picotazo'), 'cadena propia'); assert.ok(d.m.hp < 1e6);
});

test('Colmena cambia de Huésped o muere: no deja unidades huérfanas', () => {
  const c = mk({}, 0); spawnUnits(c.g, c.p, 3, {}); plantNest(c.g, c.p, c.p.pos); c.g.setLoadout(c.p.id, 'axioma'); run(c, 0.1);
  assert.equal(c.g.objects.filter((o) => ['zangano', 'nido', 'reina'].includes(o.type)).length, 0);
  const d = mk({}, 0); spawnUnits(d.g, d.p, 3, {}); d.p.dead = true; run(d, 0.1); assert.equal(unitsOf(d.g, d.p).length, 0);
});

test('determinismo: dos partidas iguales dan los mismos snapshots y enjambre.js no usa g.rng ni Math.random', () => {
  const src = fs.readFileSync(new URL('../src/sim/enjambre.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, ''); assert.ok(!/\bg\.rng\b|Math\.random/.test(src));
  const play = () => {
    const out = [], c = mk({ mode: 'combo', evo: 4, path: ['criador', 'nidos', 'cohabita', 'plaga'] }, 4);
    for (let i = 0; i < 900; i++) { c.g.setInput(c.p.id, { mode: 'combo', a1: i % 50 < 30, a2: i % 90 > 70, hab: i % 300 === 5, ult: i === 400 }); c.p.ul = Math.max(c.p.ul, i === 399 ? 100 : 0); c.g.step(T60); const s = c.g.snapshot(); if (i % 30 === 0) out.push(JSON.stringify([s.players[0], s.objs, s.monsters.map((m) => [m.hp, m.p])])); }
    return out.join('\n');
  };
  assert.equal(play(), play());
});

test('bot de partidas con Colmena (evolucionada al máximo): 90 s sin caídas, con las unidades y el snapshot siempre acotados', { timeout: 120000 }, async () => {
  const { makeBot } = await import('../src/sim/bot.js');
  const g = new Game({ mapId: 'm1', seed: 4, difficulty: 1 }), p = g.addPlayer('bot', null, { char: 'colmena', evo: 4, path: ['criador', 'nube', 'cohabita', 'plaga'] }), think = makeBot(g, p.id, { seed: 4, skill: 1 });
  let maxU = 0, maxObjs = 0, maxBytes = 0;
  for (let i = 0; i < 60 * 90 && g.state === 'playing'; i++) {
    const inp = think(T60); inp.ult = i % 600 === 500; p.ul = i % 600 === 499 ? 100 : p.ul; g.setInput(p.id, inp); g.step(T60);
    if (i % 30 === 0) { const s = g.snapshot(); maxU = Math.max(maxU, s.players[0].un); maxObjs = Math.max(maxObjs, s.objs.length); maxBytes = Math.max(maxBytes, JSON.stringify(s).length); if (!Number.isFinite(p.pos.x)) assert.fail('NaN'); } else g.events.length = 0;
  }
  assert.ok(maxU >= 4 && maxU <= LIMITS.units, `zánganos máx. ${maxU}`); assert.ok(maxObjs <= 40, `objetos ${maxObjs}`); assert.ok(maxBytes < 30000, `snapshot ${maxBytes} B`);
});
