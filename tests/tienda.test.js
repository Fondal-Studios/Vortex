import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, HOST_IDS } from '../src/sim/data.js';
import { ITEMS, MAT_STOCK_MAX, LIMITE_INVENTARIO, MATERIAL_IDS } from '../src/sim/items.js';
import * as T from '../src/sim/tienda.js';
import { nodosDe } from '../src/sim/progresion.js';
import { Game } from '../src/sim/game.js';

// Tienda del Cambista (docs/TIENDA.md): precios fijos, stock rotativo determinista, compras que nunca dejan núcleos negativos y migración de perfiles previos.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const KEY = 'cristal.perfil.v1';
const PM = await import('../src/client/perfil.js'), TM = await import('../src/client/tienda.js');
const reset = (obj = {}) => { mem.clear(); mem.set(KEY, JSON.stringify(obj)); /* fuerza recarga del caché */ PM.recargar(); return PM.perfil(); };

test('catálogo: iniciales = Axioma, Vesper y Micelio; el resto de los Huéspedes se compra y tiene precio', () => {
  assert.deepEqual(T.HUESPEDES_INICIALES, ['axioma', 'vesper', 'micelio']);
  for (const id of HOST_IDS) if (!T.esInicial(id)) { assert.ok(T.precioHuesped(id) > 0, id); assert.ok(T.HUESPEDES_TIENDA.includes(id)); }
  assert.deepEqual([...T.HUESPEDES_TIENDA].sort(), ['colmena', 'danzante', 'seraf', 'singular', 'umbra']);
  assert.equal(T.precioHuesped('colmena'), 600); assert.equal(T.precioHuesped('singular'), 750);
});
test('stock rotativo: determinista, cambia con el día y con las partidas, precios coherentes', () => {
  const a = T.oferta(20000, 3), b = T.oferta(20000, 3);
  assert.deepEqual(a, b, 'mismos números = misma oferta');
  assert.notDeepEqual(T.oferta(20001, 3), a); assert.notDeepEqual(T.oferta(20000, 4), a);
  assert.equal(a.materiales.length, 4); assert.equal(a.planos.length, 2); assert.equal(a.objetos.length, 3);
  for (let dia = 20000; dia < 20060; dia++) {
    const o = T.oferta(dia, dia % 7); const ids = new Set(o.planos.map((x) => x.id)); assert.equal(ids.size, 2, 'sin planos repetidos');
    for (const r of [...o.materiales, ...o.planos, ...o.objetos]) { assert.ok(Number.isInteger(r.precio) && r.precio >= 1, 'precio entero positivo'); assert.ok(r.precio <= r.base); assert.ok(r.desc >= 0 && r.desc <= 60); }
    for (const r of o.planos) { assert.ok(!ITEMS[r.id].host, 'las armas firma sólo las suelta el jefe'); assert.ok(ITEMS[r.id].r >= 1); }
    for (const r of o.objetos) assert.ok(ITEMS[r.id].r <= 1 && !ITEMS[r.id].host);
    assert.ok([...o.materiales, ...o.planos, ...o.objetos].some((r) => r.especial && r.desc >= 25), 'hay una oferta del día');
  }
});
test('precios: la rareza y la calidad suben el precio; vender paga menos que comprar', () => {
  for (const m of MATERIAL_IDS) { for (let c = 0; c < 3; c++) assert.ok(T.precioMat(m, c + 1) > T.precioMat(m, c)); for (let c = 0; c < 4; c++) assert.ok(T.ventaMat(m, c) < T.precioMat(m, c)); }
  const comun = Object.keys(ITEMS).find((i) => ITEMS[i].r === 0 && !ITEMS[i].host), rara = Object.keys(ITEMS).find((i) => ITEMS[i].r === 1 && !ITEMS[i].host);
  assert.ok(T.precioObjeto(rara, 0.5) > T.precioObjeto(comun, 0.5)); assert.ok(T.precioObjeto(comun, 1) > T.precioObjeto(comun, 0));
  assert.equal(T.conDescuento(100, 25), 75); assert.equal(T.conDescuento(1, 60), 1);
  assert.ok(T.precioReroll(2) > T.precioReroll(0));
});
test('migración: quien ya usaba un Huésped lo conserva; el resto de los pagos queda cerrado', () => {
  assert.deepEqual(T.migrarHuespedes({}), []);
  assert.deepEqual(T.migrarHuespedes({ mae: { umbra: { xp: 10, partidas: 1 } }, evo: { seraf: 2 }, path: { singular: ['x'] } }, 'danzante').sort(), ['danzante', 'seraf', 'singular', 'umbra']);
  assert.deepEqual(T.migrarHuespedes({ mae: { axioma: { xp: 500, partidas: 9 } } }), [], 'los iniciales no hace falta anotarlos');
  assert.deepEqual(T.migrarHuespedes({ huespedes: ['colmena', 'axioma', 'zzz'] }), ['colmena'], 'si ya hay lista se respeta y se sanea');
});
test('requisitos: Colmena pide rango 3 con otro Huésped; Singular también; Danzante no pide nada', () => {
  const p = { cores: 5000, huespedes: [], mae: {} };
  assert.equal(T.estadoHuesped(p, 'colmena'), 'falta requisito'); assert.equal(T.estadoHuesped(p, 'danzante'), 'comprable'); assert.equal(T.estadoHuesped(p, 'axioma'), 'poseido');
  p.mae.vesper = { xp: 260, partidas: 3 }; assert.equal(T.estadoHuesped(p, 'colmena'), 'comprable'); assert.equal(T.estadoHuesped(p, 'singular'), 'comprable');
  p.mae = { colmena: { xp: 999, partidas: 9 } }; assert.equal(T.estadoHuesped(p, 'colmena'), 'falta requisito', 'el rango propio no cuenta: tiene que ser con OTRO Huésped');
  p.cores = 10; p.mae = { vesper: { xp: 999 } }; assert.equal(T.estadoHuesped(p, 'danzante'), 'sin nucleos');
});

test('perfil: un perfil previo con maestría abre con ese Huésped incluido; uno nuevo no posee ninguno hasta elegir su primer Huésped', () => {
  const p = reset({ cores: 40, mae: { umbra: { xp: 30, partidas: 1, kills: 4, oleada: 2 } } });
  assert.equal(TM.poseeHuesped('umbra'), true); assert.equal(TM.poseeHuesped('seraf'), false); assert.equal(TM.poseeHuesped('micelio'), true);
  assert.deepEqual(p.huespedes, ['vesper', 'micelio', 'umbra'], 'veterano: conserva los iniciales (axioma es su inicial) y lo que usaba');
  const q = reset({}); assert.deepEqual(q.huespedes, []); assert.equal(TM.poseeHuesped('axioma'), false, 'Sprint 1: sin Huésped inicial elegido no hay ninguno'); assert.equal(TM.poseeHuesped('colmena'), false); assert.equal(TM.poseeHuesped('nova'), true, 'los veteranos no se compran');
});
test('comprar Huésped: gasta el precio justo, no se repite, respeta el requisito y nunca deja núcleos negativos', () => {
  const p = reset({ cores: 700 });
  let r = TM.comprarHuesped('colmena'); assert.equal(r.ok, false); assert.match(r.motivo, /rango|Rango/); assert.equal(p.cores, 700);
  r = TM.comprarHuesped('danzante'); assert.equal(r.ok, true); assert.equal(PM.perfil().cores, 100); assert.ok(TM.poseeHuesped('danzante'));
  r = TM.comprarHuesped('danzante'); assert.equal(r.ok, false); assert.equal(PM.perfil().cores, 100);
  r = TM.comprarHuesped('umbra'); assert.equal(r.ok, false); assert.match(r.motivo, /núcleos/); assert.equal(PM.perfil().cores, 100);
  assert.equal(TM.comprarHuesped('axioma').ok, false); assert.equal(TM.comprarHuesped('no_existe').ok, false); assert.equal(TM.comprarHuesped('nova').ok, false);
  assert.ok(PM.perfil().cores >= 0);
  // persiste en el guardado
  assert.ok(JSON.parse(mem.get(KEY)).huespedes.includes('danzante'));
});
test('renglones: materiales, planos y objetos llegan al perfil; cada renglón se compra una vez por tanda', () => {
  const ahora = 20000 * 86400000 + 5000, of0 = T.oferta(20000, 0);
  const p = reset({ cores: 100000 });
  const m = of0.materiales[0], antes = p.materiales[m.mat][m.cal];
  let r = TM.comprarRenglon('materiales', 'm0', ahora); assert.equal(r.ok, true); assert.equal(PM.perfil().materiales[m.mat][m.cal], antes + m.n); assert.equal(PM.perfil().cores, 100000 - m.precio);
  r = TM.comprarRenglon('materiales', 'm0', ahora); assert.equal(r.ok, false, 'ya comprado');
  const pl = of0.planos[0]; r = TM.comprarRenglon('planos', 'p0', ahora); assert.equal(r.ok, true); assert.ok(PM.conoce(pl.id));
  const ob = of0.objetos[0]; const n0 = PM.perfil().inventario.length; r = TM.comprarRenglon('objetos', 'o0', ahora); assert.equal(r.ok, true); assert.equal(PM.perfil().inventario.length, n0 + 1); assert.equal(PM.perfil().inventario.at(-1).id, ob.id);
  assert.equal(TM.comprarRenglon('objetos', 'o9', ahora).ok, false, 'renglón inexistente');
  // otra tanda (otro día): se pueden comprar de nuevo
  const ahora2 = 20001 * 86400000 + 5; assert.equal(TM.ofertaActual(ahora2).materiales[0].comprado, false);
  assert.ok(PM.perfil().cores >= 0);
});
test('renglones: sin núcleos no se compra, con el depósito lleno o el inventario lleno tampoco, y no se cobra', () => {
  const ahora = 20000 * 86400000, of0 = T.oferta(20000, 0), m = of0.materiales[1];
  let p = reset({ cores: m.precio - 1 }); let r = TM.comprarRenglon('materiales', 'm1', ahora); assert.equal(r.ok, false); assert.equal(PM.perfil().cores, m.precio - 1);
  p = reset({ cores: 99999, materiales: { [m.mat]: [0, 0, 0, 0].map((_, c) => (c === m.cal ? MAT_STOCK_MAX : 0)) } }); r = TM.comprarRenglon('materiales', 'm1', ahora); assert.equal(r.ok, false); assert.equal(PM.perfil().cores, 99999);
  const comun = Object.keys(ITEMS).find((i) => ITEMS[i].r === 0 && !ITEMS[i].host);
  p = reset({ cores: 99999, inventario: Array.from({ length: LIMITE_INVENTARIO }, (_, i) => ({ u: 'x' + i, id: comun, q: 0.5 })) });
  assert.equal(PM.perfil().inventario.length, LIMITE_INVENTARIO); r = TM.comprarRenglon('objetos', 'o0', ahora); assert.equal(r.ok, false); assert.equal(PM.perfil().cores, 99999);
});
test('servicios: botiquín (tope 5), reinicio de árbol completo, retirada de tirada, cambio de esencias', () => {
  const p = reset({ cores: 1000, inventario: [{ u: 'a1', id: Object.keys(ITEMS).find((i) => ITEMS[i].r === 1 && !ITEMS[i].host), q: 0.5 }], ess: { carne: 3, cristal: 0, ojo: 0, vacio: 0 } });
  for (let i = 0; i < 5; i++) assert.equal(TM.comprarBotiquin().ok, true); assert.equal(TM.comprarBotiquin().ok, false); assert.equal(TM.botiquines(), 5); assert.equal(PM.perfil().cores, 1000 - 5 * T.SERVICIOS.botiquin.precio);
  assert.equal(TM.usarBotiquin(), 1); assert.equal(TM.botiquines(), 4);
  const c0 = PM.perfil().cores; const r = TM.retirarTirada('a1'); assert.equal(r.ok, true); assert.equal(PM.perfil().cores, c0 - T.precioReroll(1)); assert.ok(r.despues >= 0.15 && r.despues <= 1);
  assert.equal(TM.retirarTirada('zz').ok, false);
  assert.equal(TM.cambiarEsencia('cristal', 1).ok, true); assert.equal(PM.perfil().ess.cristal, 1); assert.equal(TM.cambiarEsencia('carne', -1).ok, true); assert.equal(PM.perfil().ess.carne, 2); assert.equal(TM.cambiarEsencia('ojo', -1).ok, false);
  // reinicio: devuelve todos los puntos (sin el 25 % de pérdida)
  const prog = reset({ cores: 500, arb: { axioma: { combo: { pc: 10, nodos: [] } } } });
  assert.equal(TM.comprarReinicio('axioma', 'combo').ok, false, 'sin nodos no hay nada que reiniciar'); assert.equal(PM.perfil().cores, 500);
  const n1 = nodosDe('combo', 'axioma').find((n) => n.nivel === 1);
  reset({ cores: 500, arb: { axioma: { combo: { pc: 10, nodos: [n1.id] } } } });
  const libres0 = PM.arbol('axioma', 'combo').libres, g = PM.arbol('axioma', 'combo').gastado; assert.ok(g > 0);
  const rr = TM.comprarReinicio('axioma', 'combo'); assert.equal(rr.ok, true); assert.equal(PM.perfil().cores, 500 - T.SERVICIOS.reinicio.precio);
  assert.equal(PM.arbol('axioma', 'combo').libres, libres0 + g, 'devuelve TODOS los puntos'); assert.deepEqual(PM.arbol('axioma', 'combo').nodos, []);
});
test('vender: materiales al 35 %, sobrantes sin tocar lo protegido, y no se puede vender lo que no se tiene', () => {
  const comun = Object.keys(ITEMS).find((i) => ITEMS[i].r === 0 && !ITEMS[i].host);
  reset({ cores: 10, materiales: { hueso: [5, 0, 0, 0] }, inventario: [{ u: 'a1', id: comun, q: 0.5 }, { u: 'a2', id: comun, q: 0.5, lk: true }, { u: 'a3', id: comun, q: 0.5, fv: true }] });
  assert.equal(TM.venderMat('hueso', 0, 9).ok, false); assert.equal(PM.perfil().materiales.hueso[0], 5);
  const r = TM.venderMat('hueso', 0, 3); assert.equal(r.ok, true); assert.equal(PM.perfil().cores, 10 + 3 * T.ventaMat('hueso', 0)); assert.equal(PM.perfil().materiales.hueso[0], 2);
  assert.equal(TM.previewSobrantes(0).n, 1); const s = TM.venderSobrantes(0); assert.equal(s.ok, true); assert.equal(s.n, 1); assert.deepEqual(PM.perfil().inventario.map((x) => x.u).sort(), ['a2', 'a3']);
  assert.equal(TM.venderSobrantes(0).ok, false);
  assert.equal(TM.venderMat('hueso', 0, -2).ok, false); assert.equal(TM.venderMat('nada', 0, 1).ok, false);
});
test('cada partida terminada cambia el stock; el Huésped elegido de antes de la tienda se conserva', () => {
  const p = reset({}); const k0 = TM.ofertaActual(20000 * 86400000).clave; p.tienda.rot++; assert.notEqual(TM.ofertaActual(20000 * 86400000).clave, k0);
  mem.clear(); mem.set('cristal.huesped.v1', 'seraf'); PM.recargar(); assert.ok(TM.poseeHuesped('seraf'), 'lo usabas: sigue siendo tuyo');
  mem.clear(); PM.recargar(); assert.ok(!TM.poseeHuesped('seraf'));
});
test('botiquín en la simulación: la primera caída te levanta con la mitad de la vida; la segunda ya no', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer('t', null, { char: 'axioma', kit: 1 }); g.phaseT = 1e9;
  assert.equal(p.kit, 1); g.hurtPlayer(p, 1e6, true); assert.equal(p.dead, false); assert.ok(p.hp >= 40 && p.kit === 0);
  g.time += 5; g.hurtPlayer(p, 1e6, true); assert.equal(p.dead, true);
  const q = new Game({ mapId: 'm1', seed: 1 }).addPlayer('t', null, { char: 'axioma' }); assert.equal(q.kit, 0);
});
test('un Huésped que no es tuyo no evoluciona ni gasta puntos de árbol; el que sí es tuyo sí', () => {
  reset({ cores: 1000 }); assert.equal(PM.evolucionar('seraf'), false); assert.equal(PM.perfil().cores, 1000); assert.match(PM.comprarNodo('seraf', 'combo', 'x'), /Tienda/);
  assert.equal(PM.evolucionar('axioma'), true, 'los iniciales evolucionan'); assert.ok(PM.perfil().cores < 1000);
  reset({ cores: 1000, huespedes: ['seraf'] }); assert.equal(PM.evolucionar('seraf'), true);
});
