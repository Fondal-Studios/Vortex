// Ledger de recompensas, regla de recompensas y esquema/copia del perfil (Sprint 1, AC-09). Módulos puros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nuevoMatchId, matchIdValido, evaluar, agregar, limpiarLedger, encolar, limpiarCola, quitarDeCola, hashResultado, LEDGER_MAX, COLA_MAX } from '../src/sim/ledger.js';
import { reglaDe, filtrarBotin, ajustarCores, repartoCoop, aporteMinimo, REGLAS } from '../src/sim/recompensas.js';
import { migrarEsquema, empaquetar, desempaquetar, ESQUEMA } from '../src/sim/perfil-esquema.js';

test('matchId: válido, único y estable en el hash', () => {
  const ids = new Set(Array.from({ length: 500 }, () => nuevoMatchId())); assert.equal(ids.size, 500);
  for (const id of ids) assert.ok(matchIdValido(id));
  for (const mal of ['', 'corto', null, 'a b c d e f g h', 'x'.repeat(65)]) assert.equal(matchIdValido(mal), false);
  assert.equal(hashResultado({ a: 1, b: [1, 2] }), hashResultado({ b: [1, 2], a: 1 }));
  assert.notEqual(hashResultado({ a: 1 }), hashResultado({ a: 2 }));
});
test('ledger: el mismo matchId no se acredita dos veces; conflicto de huella se detecta; tope de 50', () => {
  let L = []; const id = nuevoMatchId();
  assert.equal(evaluar(L, id, 'h1').accion, 'acreditar');
  L = agregar(L, { id, h: 'h1', at: 1 });
  assert.equal(evaluar(L, id, 'h1').accion, 'duplicado');
  assert.equal(evaluar(L, id, 'h1').conflicto, false);
  assert.equal(evaluar(L, id, 'OTRA').conflicto, true);
  assert.equal(evaluar(L, 'no valido', 'h').accion, 'invalido');
  for (let i = 0; i < 80; i++) L = agregar(L, { id: nuevoMatchId(() => i / 80, () => i), h: 'x', at: i });
  assert.equal(L.length, LEDGER_MAX);
  assert.deepEqual(limpiarLedger([{ id: 'abcdefgh' }, { id: 'abcdefgh' }, { id: 'x' }, null, 5]).map((r) => r.id), ['abcdefgh']);
});
test('cola de pendientes: sin repetidos, acotada, se limpia', () => {
  const e = (i) => ({ matchId: 'partida' + String(i).padStart(4, '0'), char: 'axioma', jugador: { co: i }, info: {}, at: i });
  let c = []; c = encolar(c, e(1)); c = encolar(c, e(1)); assert.equal(c.length, 1);
  for (let i = 2; i < 60; i++) c = encolar(c, e(i)); assert.equal(c.length, COLA_MAX);
  assert.equal(quitarDeCola(c, c[0].matchId).length, COLA_MAX - 1);
  assert.deepEqual(limpiarCola([{ matchId: 'malo' }, { matchId: 'partida0001', char: 'a', jugador: null }]), []);
});

test('regla: victoria paga todo; derrota paga parte y NUNCA lo de sólo-victoria', () => {
  const v = reglaDe(true, { etapas: 5, total: 5 });
  assert.deepEqual([v.cores, v.xp, v.arbol, v.recursos, v.equipo, v.planos, v.firma, v.campana, v.desbloqueos], [1, 1, 1, 1, true, true, true, true, true]);
  const d0 = reglaDe(false, { etapas: 0, total: 5 }), d4 = reglaDe(false, { etapas: 4, total: 5, hitos: { obj: 3, sec: 2, elite: 1 } });
  assert.equal(d0.cores, REGLAS.derrota.cores[0]); assert.equal(d0.recursos, 0);
  assert.ok(d4.cores > d0.cores && d4.cores < 1 && d4.recursos < 1 && d4.xpHitos > 0);
  for (const d of [d0, d4]) assert.deepEqual([d.equipo, d.planos, d.firma, d.campana, d.desbloqueos, d.won], [false, false, false, false, false, false]);
  assert.ok(reglaDe(false, { etapas: 99, total: 5 }).cores <= REGLAS.derrota.cores[1], 'jamás se llega al total perdiendo');
  assert.equal(ajustarCores(300, d0), Math.floor(300 * 0.25)); assert.equal(ajustarCores(300, v), 300); assert.equal(ajustarCores(-5, v), 0);
});
test('regla: el botín de una derrota sólo conserva materiales y semillas (parte); la victoria lo conserva entero', () => {
  const bag = [{ id: 'mat:hueso', q: 1, n: 4 }, { id: 'semilla:flor_luz', q: 0, n: 1 }, { id: 'plano:cuchilla_hueso', q: 1, n: 1 }, { id: 'cuchilla_hueso', q: 0.5, n: 1, r: 3 }];
  const d = filtrarBotin(bag, reglaDe(false, { etapas: 3, total: 5 }));
  assert.deepEqual(d.bag.map((x) => x.id), ['mat:hueso', 'semilla:flor_luz']); assert.ok(d.bag[0].n < 4 && d.bag[0].n >= 1);
  assert.equal(d.perdido.some((x) => x.id === 'plano:cuchilla_hueso'), true);
  assert.deepEqual(filtrarBotin(bag, reglaDe(true, { etapas: 5, total: 5 })).bag, bag);
  assert.deepEqual(filtrarBotin(bag, reglaDe(false, { etapas: 0, total: 5 })).bag, [], 'sin etapas superadas no hay recursos');
});
const J = (id, st, extra = {}) => ({ id, nombre: 'J' + id, bajas: 0, t: 300, st: { dmg: 0, obj: 0, sup: 0, rev: 0, elite: 0, ...st }, ...extra });
test('coop: base para todos, bono moderado, el apoyo rinde igual que el daño, AFK sin bono', () => {
  const r = repartoCoop([J(1, { dmg: 5000 }), J(2, { sup: 10, rev: 3 }), J(3, {}), J(4, { dmg: 2500, obj: 1 })]);
  assert.equal(r[1].base, 1); assert.ok(r[1].bono > 0 && r[1].bono <= REGLAS.coop.bonoMax);
  assert.ok(Math.abs(r[1].bono - r[2].bono) < 0.06, 'quien apoya/reanima no queda por debajo de quien hace daño: ' + r[1].bono + ' vs ' + r[2].bono);
  assert.equal(r[3].afk, true); assert.equal(r[3].bono, 0); assert.equal(r[3].base, REGLAS.coop.afkBase); assert.ok(r[3].mult < r[1].mult);
  assert.ok(r[4].mult > 1 && r[4].mult <= 1 + REGLAS.coop.bonoMax);
  assert.equal(repartoCoop([J(1, { dmg: 9999 })])[1].mult, 1, 'solo: sin bono');
  assert.equal(aporteMinimo(J(1, { dmg: 9999 }, { t: 5 })), false, 'entrar y salir no cuenta');
});

test('esquema: perfiles viejos migran sin perder nada; el futuro no se toca', () => {
  const viejo = migrarEsquema({ cores: '120', inv: [{ u: 1 }], evo: { axioma: 2 } });
  assert.equal(viejo.desde, 0); assert.equal(viejo.hasta, ESQUEMA); assert.equal(viejo.perfil.cores, 120); assert.deepEqual(viejo.perfil.inventario, [{ u: 1 }]); assert.deepEqual(viejo.perfil.evo, { axioma: 2 }); assert.deepEqual(viejo.perfil.ledger, []);
  for (const raro of [null, 5, 'x', [], undefined]) assert.equal(migrarEsquema(raro).perfil.esq, ESQUEMA);
  const fut = migrarEsquema({ esq: ESQUEMA + 3, cores: 9 }); assert.equal(fut.futuro, true); assert.equal(fut.perfil.esq, ESQUEMA + 3);
  assert.equal(migrarEsquema(viejo.perfil).desde, ESQUEMA, 'migrar dos veces es inocuo');
});
test('copia de seguridad: ida y vuelta, y rechaza texto cortado, editado o ajeno', () => {
  const perfil = { cores: 77, nombre: 'Ñandú ✓', ledger: [], esq: ESQUEMA }, cola = [{ matchId: 'partida0001', char: 'axioma', jugador: { co: 3 }, info: {}, at: 1 }];
  const t = empaquetar(perfil, cola, 5), d = desempaquetar(t);
  assert.equal(d.ok, true); assert.deepEqual(d.perfil, perfil); assert.equal(d.cola.length, 1);
  assert.equal(desempaquetar(t.slice(0, -12)).ok, false); assert.equal(desempaquetar('hola').ok, false); assert.equal(desempaquetar('').ok, false);
  const b = Buffer.from(t.split(':')[1], 'base64').toString().replace('"cores":77', '"cores":99999'); assert.equal(desempaquetar(t.split(':')[0] + ':' + Buffer.from(b).toString('base64')).ok, false);
});
