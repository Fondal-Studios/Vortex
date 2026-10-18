// Territorios y bendiciones: datos, efectos deterministas en la simulación y reglas del perfil (liberar, elegir una de dos, excluyentes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cdMul } from '../src/sim/huespedes.js';
import { Game } from '../src/sim/game.js';
import { WAVE_PLANS } from '../src/sim/data.js';
import { TERRITORIOS, TERRITORIO_IDS, BENDICIONES, BENDICION_IDS, bendicionesDe, hermana, cleanBend, bendMods, BN_NEUTRO } from '../src/sim/bendiciones.js';

// perfil.js usa localStorage del navegador: un reemplazo mínimo en memoria
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const reload = async () => { const m = await import('../src/client/perfil.js?' + Math.random()); return m; };

test('datos: 6 territorios (uno por mapa) y 12 bendiciones, 2 por territorio, con efectos pequeños', () => {
  assert.deepEqual(TERRITORIO_IDS.sort(), Object.keys(WAVE_PLANS).sort());
  assert.equal(BENDICION_IDS.length, 12);
  for (const t of TERRITORIO_IDS) {
    assert.equal(bendicionesDe(t).length, 2, t); const [a, b] = bendicionesDe(t); assert.equal(hermana(a), b); assert.equal(hermana(b), a);
    assert.ok(TERRITORIOS[t].folclore.length > 20 && TERRITORIOS[t].nombre);
    for (const r of TERRITORIOS[t].requiere) assert.ok(TERRITORIOS[r], 'requisito existente');
  }
  assert.deepEqual(TERRITORIOS.m1.requiere, [], 'hay un territorio inicial');
  for (const b of Object.values(BENDICIONES)) for (const [k, v] of Object.entries(b.fx)) {
    assert.ok(k in BN_NEUTRO, k);
    if (k === 'heal') assert.ok(v > 0 && v <= 12); else if (k === 'kheal') assert.ok(v > 0 && v <= 2); else assert.ok(Math.abs(v - 1) > 0 && Math.abs(v - 1) <= 0.25, `${b.id} ${k}=${v} fuera de rango`);
    assert.match(b.desc, /\S/);
  }
});

test('cleanBend: ignora ids falsos, repetidos y la segunda bendición del mismo territorio; orden estable', () => {
  assert.deepEqual(cleanBend(['eco', 'espejo']), ['eco'], 'excluyentes: queda la primera');
  assert.deepEqual(cleanBend(['hambre', 'nada', 'hambre', 'pie_ligero']), ['pie_ligero', 'hambre']);
  assert.deepEqual(cleanBend(null), []); assert.deepEqual(cleanBend('eco'), []);
  assert.deepEqual(bendMods([]), BN_NEUTRO);
  const all = cleanBend(TERRITORIO_IDS.map((t) => bendicionesDe(t)[0])); assert.equal(all.length, 6);
});

const mk = (bend, seed = 7) => { const g = new Game({ mapId: 'm1', seed, magazines: true }); g.phaseT = 1e9; const p = g.addPlayer('t', null, { char: 'axioma', bend }); p.hp = 100; p.shield = 100; return { g, p }; };

test('sin bendiciones el jugador queda neutro y con bendiciones lleva p.bn', () => {
  const { p } = mk(); assert.deepEqual(p.bend, []); assert.deepEqual(p.bn, BN_NEUTRO);
  const q = mk(['eco', 'hambre']).p; assert.deepEqual(q.bend, ['eco', 'hambre']); assert.equal(q.bn.skill, 1.10); assert.equal(q.bn.ess, 1.25);
});

test('Hambre: +25 % de esencias al matar (hostKill → absorb)', () => {
  const run = (bend) => { const { g, p } = mk(bend); const m = g.spawnMonster('astilla', { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z - 4 }); const s0 = Object.values(p.ess).reduce((a, b) => a + b, 0); g.killMonster(m, p); return Object.values(p.ess).reduce((a, b) => a + b, 0) - s0; };
  const base = run([]), con = run(['hambre']); assert.ok(base > 0); assert.ok(Math.abs(con - base * 1.25) < 1e-9, `${con} vs ${base}`);
});

test('Espejo y Eco: menos daño recibido y más daño de habilidades', () => {
  const dmg = (bend) => { const { g, p } = mk(bend); p.shield = 0; g.hurtPlayer(p, 20, true); return 100 - p.hp; };
  assert.ok(Math.abs(dmg(['espejo']) - dmg([]) * 0.95) < 1e-6);
  const out = (bend, src) => { const { g, p } = mk(bend); g.dmgSrc = src; return g.damageMonster ? (() => { const m = g.spawnMonster('geoda', { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z - 6 }); m.open = true; m.hp = m.maxhp = 1e6; g.damageMonster(m, 100, p); return 1e6 - m.hp; })() : 0; };
  assert.ok(out(['eco'], 'skill') > out([], 'skill') * 1.09 && out(['eco'], 'skill') < out([], 'skill') * 1.11);
  assert.ok(Math.abs(out(['eco'], 'gun') - out([], 'gun')) < 1e-6, 'Eco no toca el disparo');
});

test('Pie de Isla, Farol, Canto, Hora Detenida y Descanso Ajeno aplican su número', () => {
  const sp = (b) => { const { g, p } = mk(b); g.step(1 / 60); return p.spdMul; };
  assert.ok(Math.abs(sp(['pie_ligero']) / sp([]) - 1.04) < 1e-9);
  const co = (b) => { const { g, p } = mk(b); const c0 = p.cores; g.killMonster(g.spawnMonster('ariete', { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z - 5 }), p); return p.cores - c0; };
  assert.ok(co(['farol']) >= co([]) && co(['farol']) <= Math.ceil(co([]) * 1.1) + 1);
  const sh = (b) => { const { g, p } = mk(b); p.shield = 0; p.lastHurt = -99; for (let i = 0; i < 60; i++) g.step(1 / 60); return p.shield; };
  assert.ok(sh(['canto']) > sh([]) * 1.15);
  assert.ok(Math.abs(cdMul(mk(['hora_detenida']).p) / cdMul(mk().p) - 0.94) < 1e-9, 'Hora Detenida');
  const { g, p } = mk(['descanso_ajeno']); p.hp = 50; g.killMonster(g.spawnMonster('astilla', { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z - 4 }), p); assert.equal(p.hp, 51);
});

test('determinismo: misma semilla y mismas bendiciones → mismo estado; setLoadout también las aplica', () => {
  const sim = () => { const { g, p } = mk(['luz_mala', 'espejo', 'hambre'], 11); for (let i = 0; i < 300; i++) g.step(1 / 60); return JSON.stringify([p.pos, p.hp, p.shield, p.ess, g.monsters.length]); };
  assert.equal(sim(), sim());
  const { g, p } = mk(); g.setLoadout(p.id, 'axioma', null, { bend: ['canto', 'raiz'] }); assert.deepEqual(p.bend, ['canto', 'raiz']);
});

test('perfil: cadena de desbloqueo, liberar una vez, elegir UNA de dos y no poder cambiar', async () => {
  mem.clear(); const P = await reload();
  assert.equal(P.estadoTerritorio('m1'), 'disponible'); assert.equal(P.estadoTerritorio('m2'), 'bloqueado'); assert.equal(P.estadoTerritorio('m6'), 'bloqueado');
  assert.equal(P.liberarTerritorio('m2'), false, 'no se salta la cadena'); assert.equal(P.liberarTerritorio('zzz'), false);
  assert.equal(P.elegirBendicion('m1', 'pie_ligero'), false, 'sin liberar no se elige');
  assert.equal(P.liberarTerritorio('m1'), true); assert.equal(P.liberarTerritorio('m1'), false, 'no se libera dos veces');
  assert.equal(P.estadoTerritorio('m1'), 'liberado'); assert.equal(P.estadoTerritorio('m2'), 'disponible'); assert.equal(P.estadoTerritorio('m5'), 'disponible');
  assert.deepEqual(P.bendicionPendiente(), ['m1']); assert.deepEqual(P.paraPartida('axioma').bend, []);
  assert.equal(P.estadoBendicion('luz_mala'), 'elegible');
  assert.equal(P.elegirBendicion('m1', 'eco'), false, 'de otro territorio');
  assert.equal(P.elegirBendicion('m1', 'luz_mala'), true);
  assert.equal(P.elegirBendicion('m1', 'pie_ligero'), false, 'la hermana quedó cerrada'); assert.equal(P.estadoBendicion('pie_ligero'), 'cerrada'); assert.equal(P.estadoBendicion('luz_mala'), 'elegida');
  assert.equal(P.bendicionElegida('m1'), 'luz_mala'); assert.deepEqual(P.bendicionPendiente(), []);
  assert.deepEqual(P.paraPartida('axioma').bend, ['luz_mala']); assert.equal(P.estadoBendicion('hambre'), 'bloqueada');
});

test('perfil: persiste, se sanea al cargar y la bendición llega a la partida del sim', async () => {
  mem.clear(); let P = await reload(); P.liberarTerritorio('m1'); P.elegirBendicion('m1', 'pie_ligero'); P.liberarTerritorio('m5'); P.elegirBendicion('m5', 'farol');
  P = await reload(); assert.equal(P.bendicionElegida('m1'), 'pie_ligero'); assert.deepEqual(P.paraPartida('vesper').bend, ['pie_ligero', 'farol']);
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer('t', null, { char: 'vesper', ...P.paraPartida('vesper') }); assert.deepEqual(p.bend, ['pie_ligero', 'farol']);
  mem.set('cristal.perfil.v1', JSON.stringify({ terr: { m1: { bend: 'eco' }, m2: { bend: 'eco' }, m9: {}, m3: 5 } })); P = await reload();
  assert.equal(P.bendicionElegida('m1'), null, 'bendición de otro territorio descartada'); assert.equal(P.bendicionElegida('m2'), 'eco'); assert.equal(P.liberado('m9'), false); assert.equal(P.liberado('m3'), false);
});
