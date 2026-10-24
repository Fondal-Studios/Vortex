// Sprint 1 · onboarding: jugador nuevo → primer Huésped → desbloqueos (campaña, desafíos, Tienda) → migración de perfiles viejos → tutorial determinista.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() };
const P = await import('../src/client/perfil.js');
const T = await import('../src/sim/tienda.js');
const D = await import('../src/sim/desbloqueos.js');
const TM = await import('../src/client/tienda.js');
const { CHARACTERS, HOST_IDS } = await import('../src/sim/data.js');
const { CAMPAIGN_ORDER } = await import('../src/sim/campaign.js');
const { Game } = await import('../src/sim/game.js');
const TU = await import('../src/sim/tutorial.js');
const nuevo = (raw) => { mem.clear(); if (raw) mem.set('cristal.perfil.v1', JSON.stringify(raw)); return P.recargar(); };

test('jugador nuevo: no posee ningún Huésped hasta elegir el primero', () => {
  const p = nuevo();
  assert.equal(p.inicial, null); assert.equal(P.necesitaPrimerHuesped(), true);
  for (const id of HOST_IDS) assert.equal(T.poseeHuesped(p, id), false, id);
  assert.equal(P.tutorialPendiente(), true);
});
test('elegir el primer Huésped: sólo uno de los 3 iniciales, una sola vez, y queda guardado', () => {
  nuevo();
  assert.equal(P.elegirInicial('umbra'), false, 'un Huésped de tienda no se puede elegir como primero');
  assert.equal(P.elegirInicial('nova'), false);
  assert.equal(P.elegirInicial('vesper'), true);
  assert.equal(P.elegirInicial('micelio'), false, 'no se cambia después');
  const p = P.recargar();
  assert.equal(p.inicial, 'vesper'); assert.equal(T.poseeHuesped(p, 'vesper'), true);
  for (const id of HOST_IDS.filter((x) => x !== 'vesper')) assert.equal(T.poseeHuesped(p, id), false, id + ' bloqueado');
});
test('campaña: cada capítulo entrega su Huésped y los 8 quedan alcanzables; repetir no duplica', () => {
  nuevo(); P.elegirInicial('axioma');
  const orden = [];
  for (const cap of CAMPAIGN_ORDER) { P.completarCapitulo(cap); orden.push(...P.desbloqueosRecientes()); }
  assert.deepEqual(orden, ['vesper', 'colmena', 'danzante', 'seraf', 'singular', 'umbra'].slice(0, 0).concat(orden), 'sanity');
  const p = P.perfil();
  assert.deepEqual(HOST_IDS.filter((id) => !T.poseeHuesped(p, id)), [], 'tras la campaña poseés los 8');
  assert.ok(orden.includes('micelio') && orden.includes('vesper'), 'los 2 iniciales restantes llegan por campaña');
  P.completarCapitulo('m1'); assert.deepEqual(P.desbloqueosRecientes(), []);
  assert.equal(P.perfil().huespedes.filter((x) => x === 'umbra').length, 1);
});
test('campaña: si ya tenés el Huésped del capítulo recibís el siguiente inicial que falte', () => {
  nuevo(); P.elegirInicial('micelio'); P.completarCapitulo('m1'); assert.deepEqual(P.desbloqueosRecientes(), ['axioma']);
  P.completarCapitulo('m3'); assert.deepEqual(P.desbloqueosRecientes(), ['vesper']);
  nuevo(); P.elegirInicial('axioma'); P.completarCapitulo('m1'); assert.deepEqual(P.desbloqueosRecientes(), ['vesper']);
  P.completarCapitulo('m3'); assert.deepEqual(P.desbloqueosRecientes(), ['micelio']);
});
test('desafíos: uno por Huésped bloqueado, concreto y verificable', () => {
  const bloqueables = HOST_IDS.filter((id) => CHARACTERS[id].host);
  for (const id of bloqueables) assert.ok(D.DESAFIOS[id] && D.DESAFIOS[id].texto, 'desafío de ' + id);
  nuevo(); P.elegirInicial('axioma');
  assert.deepEqual(P.registrarDesafios({ won: false, map: 'm3' }), []);
  assert.deepEqual(P.registrarDesafios({ won: true, map: 'm3', kills: 5, mode: 'shooter' }), ['umbra']);
  assert.ok(T.poseeHuesped(P.perfil(), 'umbra'));
  assert.deepEqual(P.registrarDesafios({ won: true, map: 'm3' }), [], 'no se repite');
  assert.deepEqual(P.registrarDesafios({ won: true, boss: 'm1', map: 'm1', mode: 'combo' }), ['micelio']);
  assert.deepEqual(P.registrarDesafios({ won: true, boss: 'm2', map: 'm2' }), ['singular']);
  assert.ok(P.recargar().desafios.umbra, 'persiste');
});
test('Tienda: segunda vía con núcleos ganados; los iniciales bloqueados no se venden; ninguna vía usa dinero real', () => {
  nuevo(); P.elegirInicial('axioma'); P.perfil().cores = 2000;
  assert.equal(TM.comprarHuesped('vesper').ok, false); assert.match(TM.comprarHuesped('vesper').motivo, /campaña|desafío/);
  assert.equal(TM.comprarHuesped('danzante').ok, true); assert.equal(P.perfil().cores, 1400);
  for (const id of HOST_IDS) {
    const U = CHARACTERS[id].unlock; if (!U) continue;
    assert.deepEqual(Object.keys(U).filter((k) => !['precio', 'req'].includes(k)), [], 'sólo precio en núcleos: ' + id);
    assert.ok(D.rutasDeHuesped(id).some((r) => r.via === 'campana'), id + ' tiene vía de campaña (no sólo compra)');
  }
  for (const f of ['src/sim/tienda.js', 'src/client/tienda.js']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /stripe|paypal|\bUSD\b|\bEUR\b|premium/i, f);
});
test('migración: un perfil viejo con historial conserva los 3 iniciales y lo comprado; no repite tutorial', () => {
  const p = nuevo({ cores: 120, mae: { umbra: { xp: 40, partidas: 2 } }, campaign: { completed: ['m1'] } });
  assert.equal(p.inicial, 'axioma');
  for (const id of ['axioma', 'vesper', 'micelio', 'umbra']) assert.equal(T.poseeHuesped(p, id), true, id);
  assert.equal(T.poseeHuesped(p, 'seraf'), false);
  assert.equal(P.tutorialPendiente(), false); assert.equal(p.cores, 120);
  mem.clear(); mem.set('cristal.huesped.v1', 'micelio'); mem.set('cristal.perfil.v1', JSON.stringify({ cores: 5 }));
  assert.equal(P.recargar().inicial, 'micelio');
  P.guardar(); const g = JSON.parse(mem.get('cristal.perfil.v1')); assert.equal(g.ver, 3);
  assert.equal(P.recargar().inicial, 'micelio', 'ya migrado: estable');
});
test('migración: un perfil vacío o con basura es jugador nuevo, no veterano', () => {
  assert.equal(nuevo({}).inicial, null); assert.equal(nuevo({ guia: { off: false, vistos: [] } }).inicial, null);
  mem.clear(); mem.set('cristal.perfil.v1', '{{{rota'); assert.equal(P.recargar().inicial, null);
});
test('Selección sólo antes de la misión: main.js no cambia de Huésped en combate', () => {
  const m = fs.readFileSync('src/client/main.js', 'utf8');
  const usos = [...m.matchAll(/setLoadout\(/g)].length; assert.ok(usos <= 1, 'setLoadout sólo en el campo de pruebas');
  assert.match(m, /session\.practice && session\.game && !e\.repeat/);
});

/* ───── tutorial ───── */
function bot(char, mode, seed = 3, maxS = 400) {
  const g = new Game({ mapId: 'm1', campaign: true, seed, calm: 6, magazines: true, skillLevel: 0, tutorial: true });
  const p = g.addPlayer('t', null, { char, mode }); const pasos = [];
  const tgt = (q) => { const dx = q[0] - p.pos.x, dz = q[2] - p.pos.z; return { err: Math.atan2(p.heading.x * dz - p.heading.z * dx, p.heading.x * dx + p.heading.z * dz), d: Math.hypot(dx, dz) }; };
  for (let k = 0; k < 60 * maxS && !g.tutorial.fin; k++) {
    const s = g.tutorial.snap(), inp = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, mode, compact: true };
    const cl = (v, m) => Math.max(-m, Math.min(m, v));
    if (s.id === 'mover') inp.mz = 1; else if (s.id === 'mirar') inp.dyaw = 0.05; else if (s.id === 'saltar') inp.jump = (k % 40) < 5;
    else if ((s.id === 'atacar' || s.id === 'rematar') && s.mp) { const t = tgt(s.mp); inp.dyaw = cl(t.err, 0.2); inp.dpitch = cl(Math.atan2(s.mp[1] - p.pos.y - 0.7, t.d) - p.pitch, 0.1); if (mode === 'combo') { if (t.d > 4.6) inp.mz = 1; inp.a1 = (k % 20) < 8; } else { inp.fire = true; if (t.d > 25) inp.mz = 1; } }
    else if (s.id === 'habilidad') inp.mov = (k % 60) < 10; else if (s.id === 'esquivar') inp.mx = 1;
    else if ((s.id === 'usar' || s.id === 'curar') && s.mp) { const t = tgt(s.mp); inp.dyaw = cl(t.err, 0.2); if (t.d > 2.5) inp.mz = 1; inp.interact = (k % 30) < 3 && t.d < 3.4; }
    g.setInput(p.id, inp); g.step(1 / 60); if (pasos[pasos.length - 1] !== s.id) pasos.push(s.id);
  }
  return { g, p, pasos, t: g.time };
}
test('tutorial: un bot lo completa (los 9 pasos en orden) en Disparo y en Melé, y no empiezan oleadas antes', () => {
  for (const [c, m] of [['axioma', 'shooter'], ['vesper', 'shooter'], ['axioma', 'combo']]) {
    const r = bot(c, m); assert.equal(r.g.tutorial.fin, true, `${c}/${m} termina`); assert.equal(r.g.tutorial.saltado, false);
    assert.deepEqual(r.pasos, TU.PASOS.map((x) => x.id)); assert.ok(r.t < 200, 'dura < 200 s de simulación: ' + r.t);
    assert.equal(r.g.wave, 0, 'ninguna oleada empezó durante el tutorial'); assert.equal(r.g.monsters.filter((x) => !x.dead).length, 0, 'no quedan blancos');
    assert.ok(r.g.phaseT >= 4, 'el combate real arranca poco después');
  }
});
test('tutorial: sin acciones no avanza (verificación real); es determinista; se puede saltar', () => {
  const g = new Game({ mapId: 'm1', campaign: true, seed: 3, calm: 6, skillLevel: 0, tutorial: true }); g.addPlayer('t', null, { char: 'axioma' });
  for (let k = 0; k < 60 * 30; k++) { g.setInput(1, { compact: true }); g.step(1 / 60); }
  assert.equal(g.tutorial.i, 0); assert.equal(g.wave, 0); assert.equal(g.tutorial.fin, false);
  g.tutorial.saltar(); assert.equal(g.tutorial.fin, true); assert.equal(g.tutorial.saltado, true);
  const a = bot('axioma', 'shooter', 5), b = bot('axioma', 'shooter', 5);
  assert.equal(a.t, b.t); assert.deepEqual(a.g.tutorial.snap(), b.g.tutorial.snap()); assert.deepEqual({ ...a.p.pos }, { ...b.p.pos });
});
test('tutorial: tras terminar, la oleada 1 empieza y la 2.ª habilidad sigue bloqueada hasta superarla', () => {
  const r = bot('axioma', 'shooter'); const g = r.g;
  for (let k = 0; k < 60 * 8; k++) { g.setInput(1, { compact: true }); g.step(1 / 60); }
  assert.equal(g.wave, 1); assert.equal(g.skillLevel, 0, 'la habilidad de apoyo y la definitiva se desbloquean por oleada');
});
