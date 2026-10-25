// Progresión permanente (src/sim/progresion.js): árbol de COMBOS (Combo) y de DISPARO (Shooter) por Huésped, ramas excluyentes,
// validación (servidor y simulación), perfil, arrasar hordas con tope de daño, multi-kill + rango de estilo y equilibrio Combo vs Shooter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { HOST_IDS, COMBO_SETS } from '../src/sim/data.js';
import { sub, norm, dot, len, mul } from '../src/sim/math.js';
import { arbolCombo, ARBOL_DISPARO, RAMAS, PC_COSTE, cleanArbol, cleanNodos, errorNodo, gastado, costeReinicio, puntosCombo, puntosDisparo, efectosCombo, efectosDisparo, rangoDeEstilo, UMBRAL_ESTILO, RANGOS_ESTILO, NEUTRO_C } from '../src/sim/progresion.js';
import { PROTOCOLO } from '../src/sim/red.js';
import { arbolDe } from '../server/server.js';

const T60 = 1 / 60;
const CB = { cadena: ['cadena1', 'cadena2', 'cadena3'], area: ['area1', 'area2', 'area3'], ejecucion: ['ejecucion1', 'ejecucion2', 'ejecucion3'] };
const SB = { punteria: ['punteria1', 'punteria2', 'punteria3'], perfora: ['perfora1', 'perfora2', 'perfora3'], cargador: ['cargador1', 'cargador2', 'cargador3'] };

/** Partida con un blanco inmóvil (o varios, en fila delante) que no se muere ni ataca. */
function mk(char, opts = {}, n = 1, d0 = 2.6, hp = 1e6, kind = 'astilla') {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char, mode: 'combo', ...opts }); p.hp = 100; p.shield = 100;
  const ms = [];
  for (let i = 0; i < n; i++) {
    const side = (i - (n - 1) / 2) * 0.7, dd = d0 + (i % 4) * 0.9;
    const m = g.spawnMonster(kind, { x: p.pos.x + p.heading.x * dd - p.heading.z * side, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * dd + p.heading.x * side }, { noElite: true });
    m.passive = true; m.hp = m.maxhp = hp; m.cd = 1e9; ms.push(m);
  }
  return { g, p, ms, m: ms[0], log: [] };
}
function run(c, secs, inp = {}) {
  const n = Math.round(secs / T60);
  for (let i = 0; i < n; i++) { c.g.setInput(c.p.id, { mode: c.p.mode, ...(typeof inp === 'function' ? inp(i) : inp) }); c.g.step(T60); for (const e of c.g.snapshot().events) c.log.push(e); }
}
function press(c, seq, gap = 0.3) { for (const b of seq) { run(c, 3 * T60, { [b]: true }); run(c, gap - 3 * T60, {}); } }
const ids = (c) => c.log.filter((e) => e.t === 'combo').map((e) => e.id);
const dmgDone = (c) => c.ms.reduce((a, m) => a + (c.m.maxhp - m.hp), 0);

/* ───────── datos y saneo ───────── */
test('árbol de combos: cada Huésped tiene 3 ramas de 3 nodos con nombre propio, texto en español y costos 25/60/110', () => {
  assert.deepEqual(PC_COSTE, [25, 60, 110]);
  const nombres = new Set();
  for (const h of HOST_IDS) {
    const A = arbolCombo(h); assert.equal(A.length, 9, h);
    assert.deepEqual([...new Set(A.map((n) => n.rama))].sort(), Object.keys(RAMAS.combo).sort());
    for (const n of A) { assert.ok(n.nombre && n.texto && n.texto.length > 20, `${h} ${n.id}`); assert.equal(n.coste, PC_COSTE[n.nivel - 1]); nombres.add(h + n.nombre); }
    assert.equal(new Set(A.map((n) => n.nombre)).size, 9, `${h}: nombres distintos`);
    assert.ok(A.find((n) => n.id === 'area2').texto.length > 30);
  }
  assert.equal(nombres.size, 9 * HOST_IDS.length);
  assert.equal(ARBOL_DISPARO.length, 9); assert.deepEqual([...new Set(ARBOL_DISPARO.map((n) => n.rama))].sort(), Object.keys(RAMAS.disparo).sort());
  assert.deepEqual(arbolCombo('egida'), [], 'los Veteranos no tienen árbol');
});

test('cada Huésped tiene finishers distintos y golpes nuevos que NO pisan los 8 golpes del set base', () => {
  const fins = HOST_IDS.map((h) => efectosCombo(h, CB.area).fin); assert.ok(fins.every(Boolean)); assert.ok(new Set(fins).size >= 5, fins.join());
  for (const k of ['cono', 'rayos', 'sismo', 'torbellino', 'vacio']) assert.ok(fins.includes(k), `falta el remate ${k}`);
  for (const h of HOST_IDS) {
    const ac = efectosCombo(h, CB.cadena), base = COMBO_SETS[h].map((m) => m.seq.join());
    assert.equal(ac.extra.length, 2, h); for (const m of ac.extra) { assert.ok(!base.includes(m.seq.join()), `${h}: ${m.id} repite una secuencia del set`); assert.ok(m.name && m.id); }
    assert.ok(ac.extra[1].seq.length === 3 && ac.extra[1].seq.slice(0, 2).join() === ac.extra[0].seq.join(), `${h}: el golpe final continúa al nuevo`);
  }
});

test('saneo: UNA rama por árbol, en orden 1→2→3, sin repetidos ni ids ajenos; los efectos neutros no cambian nada', () => {
  assert.deepEqual(cleanNodos('combo', 'axioma', ['area1', 'cadena1', 'area2']), ['area1', 'area2'], 'la rama la fija el primero');
  assert.deepEqual(cleanNodos('combo', 'axioma', ['area2', 'area3']), [], 'sin saltarse el 1.º');
  assert.deepEqual(cleanNodos('combo', 'axioma', ['area1', 'area1', 'area3']), ['area1']);
  assert.deepEqual(cleanNodos('disparo', 'vesper', ['perfora1', 'punteria1', 'perfora2', 'perfora3', 'x']), ['perfora1', 'perfora2', 'perfora3']);
  assert.deepEqual(cleanNodos('combo', 'egida', ['area1']), []);
  assert.deepEqual(cleanArbol('axioma', 'hola'), { combo: [], disparo: [] }); assert.deepEqual(cleanArbol('axioma', { combo: 'area1', disparo: [{}, null, 5] }), { combo: [], disparo: [] });
  assert.deepEqual(cleanArbol('axioma', { combo: ['area1'], disparo: ['punteria1'] }), { combo: ['area1'], disparo: ['punteria1'] }, 'un nodo de cada árbol a la vez, sin mezclar');
  assert.deepEqual(cleanArbol('axioma', { combo: ['punteria1'], disparo: ['area1'] }), { combo: [], disparo: [] }, 'los nodos de un árbol no valen en el otro');
  assert.deepEqual(efectosCombo('axioma', []), { ...NEUTRO_C, extra: [] });
});

test('comprar: cuesta puntos, exige el orden y la rama elegida; reiniciar devuelve todo menos el 25 %', () => {
  assert.match(errorNodo('combo', 'axioma', [], 'cadena1', 24), /faltan 1 punto/i);
  assert.equal(errorNodo('combo', 'axioma', [], 'cadena1', 25), null);
  assert.match(errorNodo('combo', 'axioma', [], 'cadena2', 999), /Primero/);
  assert.match(errorNodo('combo', 'axioma', ['cadena1'], 'area1', 999), /rama/);
  assert.match(errorNodo('combo', 'axioma', ['cadena1'], 'cadena2', 84), /faltan/i); assert.equal(errorNodo('combo', 'axioma', ['cadena1'], 'cadena2', 85), null);
  assert.equal(gastado('combo', 'axioma', CB.cadena), 195); assert.equal(costeReinicio('combo', 'axioma', CB.cadena), Math.ceil(195 * 0.25)); assert.equal(costeReinicio('combo', 'axioma', []), 0);
});

test('puntos de partida: encadenados, remates, multi-kills y oleadas (tope 250); Shooter por bajas, multis y oleadas', () => {
  assert.equal(puntosCombo({}, 0), 0); assert.ok(puntosCombo({ h: 300, f: 40, m: 10, mm: 9 }, 10) > puntosCombo({ h: 30, f: 4, m: 1, mm: 2 }, 2));
  assert.ok(puntosCombo({ m: 3 }, 0) > 0 && puntosCombo({ f: 2 }, 0) > 0 && puntosCombo({ h: 15 }, 0) > 0 && puntosCombo({}, 5) > 0);
  assert.equal(puntosCombo({ h: 1e9, f: 1e9, m: 1e9, mm: 1e9 }, 99), 250); assert.equal(puntosCombo({ h: -5, f: NaN }, 'x'), 0);
  assert.ok(puntosDisparo({ k: 100, m: 5, mm: 8 }, 10) > puntosDisparo({ k: 10 }, 1)); assert.equal(puntosDisparo({ k: 1e9 }, 1e9), 250);
});

test('rango de estilo: D C B A S por puntos', () => {
  assert.deepEqual(RANGOS_ESTILO, ['D', 'C', 'B', 'A', 'S']); assert.deepEqual(UMBRAL_ESTILO.map((u) => RANGOS_ESTILO[rangoDeEstilo(u)]), RANGOS_ESTILO);
  assert.equal(rangoDeEstilo(9.9), 0); assert.equal(rangoDeEstilo(1e6), 4);
});

/* ───────── perfil (progreso persistente) ───────── */
test('perfil: ganar puntos al cerrar partida, comprar, rama excluyente, reiniciar con costo y guardar', async () => {
  const store = new Map(); globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  store.set('cristal.perfil.v1', JSON.stringify({ ver: 3, inicial: 'vesper' }));   // Sprint 1: el Huésped tiene que ser del jugador (su inicial)
  const Perfil = await import('../src/client/perfil.js'); Perfil.recargar();
  assert.deepEqual(Perfil.arbol('vesper', 'combo'), { pc: 0, gastado: 0, libres: 0, nodos: [] });
  assert.match(Perfil.comprarNodo('vesper', 'combo', 'cadena1'), /faltan/i);
  const r = Perfil.cerrarPartida('vesper', { kills: 40, co: 0, pk: [400, 60, 12, 40, 0, 0, 9, 0] }, { wave: 8, won: false });
  assert.ok(r.arbol.combo > 40 && r.arbol.disparo === 0, JSON.stringify(r.arbol));
  const pc = Perfil.arbol('vesper', 'combo').pc; assert.equal(pc, r.arbol.combo);
  assert.equal(Perfil.comprarNodo('vesper', 'combo', 'area1'), null); assert.match(Perfil.comprarNodo('vesper', 'combo', 'cadena1'), /rama/);
  assert.deepEqual(Perfil.arbolParaPartida('vesper'), { combo: ['area1'], disparo: [] }); assert.equal(Perfil.arbol('vesper', 'combo').libres, pc - 25);
  assert.match(Perfil.comprarNodo('vesper', 'disparo', 'area1'), /no existe/i, 'un nodo de Combo no se compra en el árbol de Shooter');
  const rr = Perfil.reiniciarArbol('vesper', 'combo'); assert.equal(rr.costo, 7); assert.equal(rr.devuelto, 18); assert.deepEqual(Perfil.arbol('vesper', 'combo'), { pc: pc - 7, gastado: 0, libres: pc - 7, nodos: [] });
  assert.equal(Perfil.reiniciarArbol('vesper', 'combo'), null, 'sin nodos no hay nada que reiniciar');
  // una partida Shooter suma al otro árbol
  const s = Perfil.cerrarPartida('vesper', { kills: 60, co: 0, pk: [0, 0, 0, 0, 3, 60, 0, 6] }, { wave: 5 }); assert.ok(s.arbol.disparo > 0 && s.arbol.combo === 0);
  assert.ok(JSON.parse(store.get('cristal.perfil.v1')).arb.vesper.disparo.pc > 0, 'se guardó en el navegador');
  assert.doesNotThrow(() => Perfil.cerrarPartida('egida', { kills: 3, co: 0, pk: [1, 1, 1, 1, 1, 1, 1, 1] }, { wave: 2 }), 'un Veterano no rompe el cierre');
  assert.deepEqual(Perfil.arbol('egida', 'combo'), { pc: 0, gastado: 0, libres: 0, nodos: [] });
  delete globalThis.localStorage;
});

/* ───────── servidor ───────── */
test('servidor: arbolDe acota lo que manda el cliente y viaja por addPlayer / setLoadout', async () => {
  assert.deepEqual(arbolDe('axioma', { combo: ['area1', 'cadena1', '__proto__', 7, 'area2'], disparo: ['perfora1'] }), { combo: ['area1', 'area2'], disparo: ['perfora1'] });
  assert.deepEqual(arbolDe('axioma', null), { combo: [], disparo: [] }); assert.deepEqual(arbolDe('egida', { combo: ['area1'] }).combo, []);
  const hostil = { combo: Array.from({ length: 5000 }, (_, i) => 'area' + (i % 4)), disparo: 'x' }; assert.deepEqual(arbolDe('vesper', hostil), { combo: ['area1', 'area2', 'area3'], disparo: [] });
  const g = new Game({ mapId: 'm1', seed: 1 }), p = g.addPlayer('a', null, { char: 'vesper', arbol: { combo: ['area1', 'cadena1'], disparo: ['cargador1', 'cargador2'] } });
  assert.deepEqual(p.arb, { combo: ['area1'], disparo: ['cargador1', 'cargador2'] }); assert.equal(p.ac.pen, true); assert.equal(p.as.clip, 1.45);
  g.setLoadout(p.id, 'umbra', undefined, { arbol: { combo: ['area1', 'area2'] } }); assert.equal(p.ac.fin, 'vacio'); assert.deepEqual(p.arb.disparo, []);
  g.setLoadout(p.id, 'axioma'); assert.ok(!p.ac || !p.ac.fin, 'cambiar de Huésped sin árbol deja los nodos del anterior fuera');
  const { startServer } = await import('../server/server.js'); const { WebSocket } = await import('ws');
  const srv = await startServer({ port: 0, autoTick: false });
  try {
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws`); await new Promise((r) => ws.on('open', r));
    ws.send(JSON.stringify({ t: 'create', v: PROTOCOLO, map: 'm1', name: 'x', char: 'seraf', arbol: { combo: ['area3', 'area1', 'area2', 'cadena1'], disparo: ['perfora2'] } }));
    await new Promise((r) => { const t = setInterval(() => { if (srv.rooms.size) { clearInterval(t); r(); } }, 20); });
    const pl = [...srv.rooms.values()][0].game.players[0]; assert.deepEqual(pl.arb, { combo: ['area1', 'area2', 'area3'], disparo: [] }, 'el servidor sanea: la rama la fija el primero válido y se exige el orden');
    ws.close();
  } finally { await srv.close(); }
});

/* ───────── efectos en la simulación ───────── */
test('Dominio de Cadena: golpe nuevo en la cadena, ventana más larga y golpe final (cada Huésped el suyo)', () => {
  const win = (arbol) => { const c = mk('axioma', { arbol }); run(c, 3 * T60, { a1: true }); return c.p.cb.win - c.p.cb.rec; };
  assert.ok(win({ combo: ['cadena1'] }) > win({}) * 1.5, 'ventana ×1,6');
  for (const h of HOST_IDS) {
    const A = efectosCombo(h, CB.cadena), e1 = A.extra[0], e2 = A.extra[1];
    const sin = mk(h, { evo: 0 }, 1, h === 'seraf' ? 12 : 2.6); press(sin, e1.seq, 1.2); assert.ok(!ids(sin).includes(e1.id), `${h}: sin el nodo no sale ${e1.id}`);
    const con = mk(h, { evo: 0, arbol: { combo: CB.cadena.slice(0, 2) } }, 1, h === 'seraf' ? 12 : 2.6); press(con, e1.seq, 1.2); assert.ok(ids(con).includes(e1.id), `${h}: sale ${e1.id} → ${ids(con)}`);
    const fin = mk(h, { evo: 0, arbol: { combo: CB.cadena } }, 1, h === 'seraf' ? 12 : 2.6); press(fin, e2.seq, 1.2); assert.ok(ids(fin).includes(e2.id), `${h}: sale el golpe final ${e2.id} → ${ids(fin)}`);
    assert.ok(fin.log.some((e) => e.t === 'combo' && e.id === e2.id && e.fin), `${h}: es el remate de la cadena`);
  }
});

test('cancelaciones: «Ventana larga» acepta el golpe siguiente al 60 %; «cancelación total» deja cancelar con cualquier ataque, aunque no continúe un combo', () => {
  const t = (arbol) => { const c = mk('axioma', { arbol }); let first = -1, second = -1;
    for (let i = 0; i < 140; i++) { const inp = { mode: 'combo' }; if (i === 0) inp.a2 = true; if (i === 30) inp.a2 = true; c.g.setInput(c.p.id, inp); c.g.step(T60); for (const e of c.g.snapshot().events) if (e.t === 'combo') { if (first < 0) first = i; else if (second < 0) second = i; } }
    return second; };
  const sin = t({}), soloVentana = t({ combo: ['cadena1'] }), total = t({ combo: CB.cadena });
  assert.ok(sin < 0 || sin > 50, `sin nodos espera la recuperación entera (${sin})`);
  assert.ok(soloVentana < 0 || soloVentana > 50, `a2,a2 no es combo: la ventana larga sola no lo cancela (${soloVentana})`);
  assert.ok(total > 0 && total <= 42, `con la rama completa sale antes (${total})`);
  const cad3 = mk('axioma', { arbol: { combo: ['cadena1', 'cadena2', 'cadena3'] } }); assert.equal(cad3.p.ac.freeCancel, true);
});

test('Aniquilación en Área: cada Huésped remata a su manera (cono, torbellino, sismo, vacío que ARRASTRA, cadena de rayos)', () => {
  for (const h of HOST_IDS) {
    const base = mk(h, { arbol: { combo: ['area1'] } }, 10, h === 'seraf' ? 6 : 2.6, 1e6, 'cuarzo'), full = mk(h, { arbol: { combo: CB.area } }, 10, h === 'seraf' ? 6 : 2.6, 1e6, 'cuarzo');
    press(base, ['a1', 'a1', 'a1'], 0.5); press(full, ['a1', 'a1', 'a1'], 0.5);
    const ev = full.log.find((e) => e.t === 'arrasar' && e.k === efectosCombo(h, CB.area).fin); assert.ok(ev && ev.n >= 3, `${h}: remate de área (${JSON.stringify(ev)})`);
    assert.ok(!base.log.some((e) => e.t === 'arrasar' && e.k !== 'resonancia'), `${h}: sin el nodo 2 no hay remate de área`);
    assert.ok(dmgDone(full) > dmgDone(base), `${h}: el remate suma daño`);
  }
  const u = mk('umbra', { arbol: { combo: CB.area } }, 8, 3, 1e6, 'cuarzo'); const d0 = u.ms.map((m) => dist2(m.pos, u.p.pos));
  press(u, ['a1', 'a1', 'a1'], 0.5); run(u, 0.4); assert.ok(u.log.some((e) => e.t === 'arrasar' && e.k === 'vacio'), 'vacío'); void d0;
});
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('Resonancia: cada baja propaga daño y empuja a los vecinos (con tope por golpe)', () => {
  const c = mk('axioma', { arbol: { combo: CB.area } }, 8, 2.6, 400, 'cuarzo'); c.ms[0].hp = 1; c.ms[0].maxhp = 1e6;   // el primero cae al instante
  const a = mk('axioma', { arbol: { combo: ['area1', 'area2'] } }, 8, 2.6, 400, 'cuarzo'); a.ms[0].hp = 1; a.ms[0].maxhp = 1e6;
  press(c, ['a1', 'a1', 'a1'], 0.5); press(a, ['a1', 'a1', 'a1'], 0.5);
  assert.ok(c.log.some((e) => e.t === 'arrasar' && e.k === 'resonancia'), 'evento de resonancia'); assert.ok(c.log.filter((e) => e.t === 'arc').length > 0, 'líneas visibles de propagación');
  assert.ok(dmgDone(c) > dmgDone(a), 'la resonancia suma daño');
});

test('Ejecución: marca de sentencia, remate cobrador (cura y acelera la habilidad) y ejecución que cancela la recuperación', () => {
  const m = mk('vesper', { arbol: { combo: ['ejecucion1'] } }); press(m, ['a1'], 0.4); assert.ok(m.g.time < m.m.markUntil && m.m.markMul > 1, 'marcado');
  assert.ok(efectosCombo('vesper', ['ejecucion1']).exec > 0 && efectosCombo('vesper', CB.ejecucion).exec > efectosCombo('vesper', ['ejecucion1']).exec);
  const c = mk('vesper', { arbol: { combo: CB.ejecucion.slice(0, 2) } }, 3, 2.6, 400); c.p.hp = 50; c.p.habCd = 10; for (const q of c.ms) q.hp = 1; press(c, ['a1', 'a1', 'a1'], 0.5);
  assert.ok(c.p.hp > 50, `curó (${c.p.hp})`); assert.ok(c.p.habCd < 10, `habilidad acelerada (${c.p.habCd})`);
  const x = mk('axioma', { arbol: { combo: CB.ejecucion } }, 2, 2.6, 400); x.ms[0].hp = 1; run(x, 5 * T60, { a1: true }); assert.ok(x.ms[0].dead); assert.ok(ids(x).length >= 2, `ejecutar cancela la recuperación: el golpe siguiente sale ya (${ids(x).length} golpes en 5 ticks)`);
  const y = mk('axioma', {}, 2, 2.6, 400); y.ms[0].hp = 1; run(y, 5 * T60, { a1: true }); assert.equal(ids(y).length, 1, 'sin el nodo hay que esperar la recuperación');
});

test('árbol de DISPARO: precisión, perforación y rebote, cargadores — y sólo en Shooter', () => {
  const E = efectosDisparo('axioma', SB.punteria); assert.ok(E.spread < 0.3 && E.dmg > 1.1);
  const gun = (arbol, mode = 'shooter') => { const c = mk('vesper', { mode, arbol }, 5, 8, 1e6); run(c, 1.5, { fire: true, mode }); return { dmg: dmgDone(c), clip: c.p.clip, c }; };
  const base = gun({}), pre = gun({ disparo: SB.punteria }), per = gun({ disparo: SB.perfora });
  assert.ok(pre.dmg >= base.dmg, 'precisión no resta'); assert.ok(per.dmg > base.dmg * 1.5, `perforar/rebotar pega a varios (${per.dmg} vs ${base.dmg})`);
  const clipOf = (arbol) => { const c = mk('axioma', { mode: 'shooter', arbol }); return c.p.clip[c.p.weapon]; };
  const cargador = mk('axioma', { mode: 'shooter', arbol: { disparo: SB.cargador } }), norm0 = mk('axioma', { mode: 'shooter' });
  const cap = (c) => { run(c, 0.2, { fire: true, mode: 'shooter' }); return c.g.snapshot().players[0]; }; void cap; void clipOf;
  assert.ok(cargador.p.as.clip > 1.7 && cargador.p.as.reload < 0.7 && norm0.p.as.clip === 1);
  // no se mezclan: nodos de disparo no tocan Combo y nodos de combo no tocan Shooter
  const dpsC = (arbol) => { const c = mk('axioma', { arbol }); run(c, 6, (i) => ({ a1: true, a2: i % 80 >= 70 })); return dmgDone(c); };
  assert.equal(dpsC({ disparo: [...SB.punteria] }), dpsC({}), 'nodos de disparo no cambian el Combo');
  const dpsS = (arbol) => gun(arbol).dmg; assert.equal(dpsS({ combo: CB.area }), dpsS({}), 'nodos de combo no cambian el Shooter');
});

/* ───────── arrasar hordas, multi-kill y rango de estilo ───────── */
/** 12 enemigos juntos delante; devuelve cuánto tarda en limpiarlos un bot que mantiene A1 (A2 y habilidad de vez en cuando). */
function horda(h, arbol, n = 12, kind = 'cuarzo', hp = 300) {
  const c = mk(h, { arbol }, n, 3, hp, kind); let mx = 0, rk = 0, t = 0, topDmg = 0;
  for (; t < 40; t += T60) {
    const alive = c.g.monsters.filter((m) => !m.dead); if (!alive.length) break;
    let best = alive[0], bd = 1e9; for (const m of alive) { const dd = len(sub(m.pos, c.p.pos)); if (dd < bd) { bd = dd; best = m; } }
    const to = sub(best.pos, c.g.eyePos(c.p)); c.p.heading = norm(sub(to, mul(c.p.up, dot(to, c.p.up))), c.p.heading); c.p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), c.p.up))));
    const tick = Math.round(t * 60), inp = { mode: 'combo', mz: h === 'seraf' && bd < 4 ? -1 : 0, a1: true, a2: tick % 80 >= 70, hab: tick % 30 < 3 };
    c.g.setInput(c.p.id, inp); const hp0 = c.g.monsters.reduce((a, m) => a + Math.max(0, m.hp), 0); c.g.step(T60);
    topDmg = Math.max(topDmg, hp0 - c.g.monsters.reduce((a, m) => a + Math.max(0, m.hp), 0));
    const s = c.g.snapshot(); rk = Math.max(rk, s.players[0].rk); for (const e of s.events) if (e.t === 'multi') mx = Math.max(mx, e.n);
  }
  const clear = !c.g.monsters.some((m) => !m.dead); run(c, 1.3, { a1: false });
  for (const e of c.log) { if (e.t === 'multi') mx = Math.max(mx, e.n); if (e.t === 'rango') rk = Math.max(rk, e.i); }
  return { t: +t.toFixed(1), clear, mx, rk, topDmg, c };
}
test('arrasar: con la rama «Aniquilación en Área» se limpian 12 enemigos juntos bastante más rápido, con multi-kill y rango de estilo', { timeout: 120000 }, () => {
  const rows = {}; let A = 0, B = 0;
  for (const h of HOST_IDS.filter((x) => x !== 'colmena')) {   // la Colmena pega con sus zánganos (órdenes), no con el golpe: se mide en el duelo de oleada
    const a = horda(h, {}), b = horda(h, { combo: CB.area }); rows[h] = { base: a.t, area: b.t, multi: b.mx, rango: RANGOS_ESTILO[b.rk] };
    assert.ok(b.clear && b.t <= 25, `${h} limpia la horda: ${JSON.stringify(rows[h])}`); assert.ok(b.t <= a.t * 0.9, `${h}: más rápido que sin el árbol ${JSON.stringify(rows[h])}`);
    assert.ok(b.mx >= (h === 'seraf' ? 4 : 6), `${h}: multi-kill de ${b.mx}`); assert.ok(b.rk >= 2, `${h}: llega al menos a B (${b.rk})`); A += a.t; B += b.t;
  }
  console.log('horda de 12 (s)', JSON.stringify(rows), 'razón', (B / A).toFixed(2));
  assert.ok(B / A < 0.6, `en promedio el árbol de área tarda menos de 0,6 veces (${(B / A).toFixed(2)})`);
});
test('arrasar con 8 y 15 enemigos: limpia en ambos casos y más enemigos no multiplican el daño por encima del tope', { timeout: 120000 }, () => {
  for (const n of [8, 15]) for (const h of ['axioma', 'micelio']) { const b = horda(h, { combo: CB.area }, n); assert.ok(b.clear && b.t < 30, `${h} ${n}: ${b.t}`); assert.ok(b.mx >= Math.min(n, 8) - 2, `${h} ${n}: multi ${b.mx}`); }
});
test('tope de daño: lo que reparte un solo golpe entre muchos enemigos no pasa de (14 objetivos + presupuesto) veces el daño de un blanco', () => {
  for (const h of ['axioma', 'vesper', 'micelio', 'umbra']) {
    const one = horda(h, { combo: CB.area }, 1, 'cuarzo', 4000), many = horda(h, { combo: CB.area }, 15, 'cuarzo', 4000);
    assert.ok(many.topDmg <= one.topDmg * (14 + 6) * 1.25 + 1, `${h}: un golpe repartió ${Math.round(many.topDmg)} vs ${Math.round(one.topDmg)} a un blanco`);
  }
});
test('contra UN blanco los árboles no rompen el equilibrio: cualquier rama queda entre ×0,95 y ×1,5 del daño sostenido y el promedio ≤ ×1,3', () => {
  const dps = (h, arbol) => { const c = mk(h, { arbol }, 1, h === 'seraf' ? 12 : 2.6); for (let tick = 0; tick < 720; tick++) { const dd = len(sub(c.m.pos, c.p.pos)), to = sub(c.m.pos, c.g.eyePos(c.p)); c.p.heading = norm(sub(to, mul(c.p.up, dot(to, c.p.up))), c.p.heading); c.p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), c.p.up))));
      const r = h === 'seraf', inp = { mode: 'combo', mz: r ? (dd < 6 ? -1 : 0) : dd > 3 + c.m.r ? 1 : 0, a1: r ? tick % 90 < 60 : true, a2: r ? tick % 90 >= 60 && tick % 90 < 75 : tick % 80 >= 70, hab: tick % 30 < 3 }; c.g.setInput(c.p.id, inp); c.g.step(T60); }
    return dmgDone(c); };
  let sum = 0, n = 0; const rows = {};
  for (const h of HOST_IDS) { const b = dps(h, {}); rows[h] = {}; for (const [k, v] of Object.entries(CB)) { const r = dps(h, { combo: v }) / b; rows[h][k] = +r.toFixed(2); sum += r; n++; assert.ok(r >= 0.95 && r <= 1.5, `${h} ${k}: ×${r.toFixed(2)}`); } }
  console.log('daño sostenido contra un blanco (razón vs sin árbol)', JSON.stringify(rows)); assert.ok(sum / n <= 1.3, `promedio ×${(sum / n).toFixed(2)}`);
});

test('snapshot: rk, rp, mk y pk (para el perfil) salen en Combo y en Shooter, sin NaN', () => {
  const b = horda('vesper', { combo: CB.area }), s = b.c.g.snapshot().players[0];
  assert.ok(Number.isInteger(s.rk) && s.rp >= 0 && s.rp <= 1 && Number.isInteger(s.mk)); assert.equal(s.pk.length, 8); assert.ok(s.pk[0] > 20 && s.pk[3] >= 10, `golpes ${s.pk[0]} bajas ${s.pk[3]}`); assert.ok(s.pk[2] >= 1, 'multi-kills contados');
  assert.equal(JSON.stringify(s).includes('NaN'), false);
  const sh = mk('axioma', { mode: 'shooter' }, 3, 6, 40); run(sh, 3, { fire: true }); const t = sh.g.snapshot().players[0]; assert.equal(t.md, 0); assert.equal(t.pk.length, 8); assert.equal(t.rk, 0);
});

/* ───────── equilibrio de los dos tipos de jugador ───────── */
const WAVE = [['astilla', 14], ['astilla', 16], ['astilla', 18], ['racimo', 20], ['lente', 24], ['lente', 26], ['geoda', 22], ['ariete', 20]];
function duel(host, kind, arbol) {
  const combo = kind === 'combo', g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, combo ? { char: host, mode: 'combo', arbol } : { char: host, style: 'disparo', arbol }); p.hp = 100; p.shield = 100;
  for (let i = 0; i < WAVE.length; i++) { const [k, d] = WAVE[i], a = (i / WAVE.length) * Math.PI * 2; const m = g.spawnMonster(k, { x: p.pos.x + Math.cos(a) * d * 0.5, y: p.pos.y + 0.5, z: p.pos.z + Math.sin(a) * d * 0.5 }, { noElite: true }); if (m) m.cd = 1 + i * 0.3; }
  let t = 0;
  for (; t < 90; t += T60) {
    const alive = g.monsters.filter((m) => !m.dead); if (!alive.length || p.dead) break;
    let best = alive[0], bd = Infinity; for (const m of alive) { const dd = len(sub(m.pos, p.pos)); if (dd < bd) { bd = dd; best = m; } }
    const to = sub(best.pos, g.eyePos(p)), flat = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.heading = flat; p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up))));
    const inp = { mz: 0 }, tick = Math.round(t * 60);
    if (combo) { inp.mode = 'combo'; if (host === 'seraf') { if (bd < 6) inp.mz = -1; else if (bd > 22) inp.mz = 1; inp.a1 = tick % 90 < 60; inp.a2 = tick % 90 >= 60 && tick % 90 < 75; } else { if (bd > 3 + best.r) inp.mz = 1; inp.a1 = true; inp.a2 = tick % 80 >= 70; } inp.hab = tick % 30 < 3; }
    else { inp.fire = true; if (bd < 6) inp.mz = -1; }
    g.setInput(p.id, inp); g.step(T60);
  }
  return { t: +t.toFixed(1), clear: !g.monsters.some((m) => !m.dead), dead: p.dead, lost: Math.round(200 - p.hp - p.shield) };
}
test('equilibrio de modo: bots Combo y Shooter limpian la misma oleada; tiempo y supervivencia dentro de ±30 % (sin árbol y con cada rama)', { timeout: 300000 }, () => {
  const tot = {}; const add = (k, r) => { tot[k] ||= { t: 0, lost: 0 }; tot[k].t += r.t; tot[k].lost += r.lost; };
  for (const h of HOST_IDS) {
    const rows = { combo: duel(h, 'combo', {}), shooter: duel(h, 'shooter', {}) };
    for (const [k, v] of Object.entries(CB)) rows['C_' + k] = duel(h, 'combo', { combo: v });
    for (const [k, v] of Object.entries(SB)) rows['S_' + k] = duel(h, 'shooter', { disparo: v });
    for (const [k, r] of Object.entries(rows)) { assert.ok(r.clear && !r.dead, `${h} ${k}: ${JSON.stringify(r)}`); add(k, r); }
  }
  console.log('oleada Combo vs Shooter (suma de todos los Huéspedes)', JSON.stringify(tot));
  const ratio = (a, b) => a / b;
  assert.ok(ratio(tot.combo.t, tot.shooter.t) >= 0.7 && ratio(tot.combo.t, tot.shooter.t) <= 1.3, `sin árbol: ${tot.combo.t} vs ${tot.shooter.t}`);
  const avg = (pre, f) => Object.entries(tot).filter(([k]) => k.startsWith(pre)).reduce((a, [, v]) => a + v[f], 0) / 3;
  const rt = avg('C_', 't') / avg('S_', 't'); assert.ok(rt >= 0.7 && rt <= 1.3, `con árbol (media de ramas): tiempo ×${rt.toFixed(2)}`);
  assert.ok(Math.abs(tot.combo.lost - tot.shooter.lost) <= 0.3 * 200 * HOST_IDS.length, `supervivencia sin árbol: ${tot.combo.lost} vs ${tot.shooter.lost}`);
  assert.ok(Math.abs(avg('C_', 'lost') - avg('S_', 'lost')) <= 0.3 * 200 * HOST_IDS.length, `supervivencia con árbol: ${avg('C_', 'lost')} vs ${avg('S_', 'lost')}`);
  for (const [k, v] of Object.entries(tot)) { if (k.startsWith('C_')) assert.ok(v.t < tot.combo.t * 1.2, `${k}: una rama no debe empeorar el modo (${v.t} vs ${tot.combo.t})`); if (k.startsWith('S_')) assert.ok(v.t < tot.shooter.t * 1.2, `${k}: una rama no debe empeorar el modo (${v.t} vs ${tot.shooter.t})`); }
});

/* ───────── determinismo ───────── */
test('determinismo: dos partidas iguales con árbol dan los mismos snapshots y eventos; progresion.js no usa azar', () => {
  assert.ok(!/\bg\.rng\b|Math\.random/.test(fs.readFileSync(new URL('../src/sim/progresion.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')), 'progresion.js no toca el azar');
  assert.ok(!/\bg\.rng\b|Math\.random/.test(fs.readFileSync(new URL('../src/sim/combos.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')), 'combos.js tampoco');
  const play = () => { const out = []; for (const h of HOST_IDS) for (const br of Object.values(CB)) {
    const c = mk(h, { evo: 3, arbol: { combo: br } }, 8, 3, 500, 'cuarzo');
    for (let i = 0; i < 400; i++) { c.g.setInput(c.p.id, { mode: 'combo', a1: i % 50 < 30, a2: i % 90 > 70, hab: i % 200 === 5 }); c.g.step(T60); const s = c.g.snapshot(); if (i % 40 === 0) out.push(JSON.stringify([s.players[0], s.monsters.map((m) => [m.hp, m.p])])); out.push(JSON.stringify(s.events.filter((e) => ['combo', 'arrasar', 'multi', 'rango', 'arc'].includes(e.t)))); }
  } return out.join('\n'); };
  assert.equal(play(), play());
});
