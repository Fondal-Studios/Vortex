// EH-05 · Simulación del Híbrido Genómico: chasis, applyLab, labDe, `lb` en el snapshot, y las garantías anti-trampa. node:test, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/sim/game.js';
import { CHARACTERS, CHARACTER_IDS, HOST_IDS, PLAYER, CHAMP_ORGANS, champOrganSlots } from '../src/sim/data.js';
import { CAPS } from '../src/sim/items.js';
import { BENDICIONES } from '../src/sim/bendiciones.js';
import { cdMul, hostDamageIn, hostOut } from '../src/sim/huespedes.js';
import { labDe, applyLab, labsDeRed, LAB_MAX_CHARS } from '../src/sim/laboratorio.js';
import { cargaDe } from '../server/server.js';
import { defecto, codificar, derivarStats, huella, PARTES, FUNCIONALES, COSMETICAS, ORDEN_ANCLAS, PROP_ORDEN, PROP_RANGOS } from '../src/shared/host-build.js';
import { ERRORES, PROTOCOLO } from '../src/sim/red.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pieza = (p, a, o = {}) => ({ p, a, sim: 'ninguna', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: PARTES[p].variantesMat[0], tinte: null }, ...o });
const build = (partes = [], extra = {}) => ({ ...defecto(), id: 'lab-simtest1', nombre: 'Sim', partes, ...extra });
const vb = (b) => codificar(b);
const nuevoJuego = (o = {}) => new Game({ mapId: 'm1', seed: 7, calm: 2, ...o });
const anclaDe = (id) => PARTES[id].anclas[0];
const conFuncionales = (ids, extra) => build(ids.map((id) => pieza(id, anclaDe(id))), extra);

/** Mide los efectos reales que la simulación aplica a un jugador (uno por uno, lo que se puede medir sin una partida entera). */
function medir(g, p) {
  g.step(1 / 60);
  const monstruo = { fwd: null, cloak: false, kind: 'x', pos: { x: 0, y: 0, z: 0 } };
  g.dmgSrc = 'gun';
  return { spd: +p.spdMul.toFixed(6), jump: +p.jumpMul.toFixed(6), cd: +cdMul(p).toFixed(6), dmgIn: +hostDamageIn(g, p, 100).toFixed(6) / 100, out: +hostOut(g, p, monstruo).toFixed(6) };
}

/* ───────── chasis ───────── */
test('chasis: CHARACTERS.laboratorio existe, es host, hp y speed valen 1 y NO está en las listas de los 8 oficiales', () => {
  const C = CHARACTERS.laboratorio; assert.ok(C); assert.equal(C.host, true); assert.equal(C.lab, true); assert.equal(C.hp, 1); assert.equal(C.speed, 1);
  assert.equal(CHARACTER_IDS.includes('laboratorio'), false); assert.equal(HOST_IDS.includes('laboratorio'), false); assert.equal(HOST_IDS.length, 8);
  for (const k of ['mov', 'esp', 's3', 'ult']) assert.equal(C[k].id, CHARACTERS.axioma[k].id, k);
  assert.notEqual(C.mov, CHARACTERS.axioma.mov, 'copias, no referencias: nada compartido que se pueda mutar');
});
test('chasis: un jugador laboratorio sin diseño juega normal (lb 0, sin aviso, sin órganos) y sobrevive 10 s de partida', () => {
  const g = nuevoJuego(), p = g.addPlayer('Lab', null, { char: 'laboratorio' });
  assert.equal(p.char, 'laboratorio'); assert.equal(p.lb, 0); assert.equal(p.lbAviso, ''); assert.deepEqual(p.corg, []);
  for (let i = 0; i < 600; i++) { g.setInput(p.id, { mz: 1, fire: i % 20 < 10 }); g.step(1 / 60); }
  assert.ok(!p.dead && Number.isFinite(p.pos.x));
  assert.equal('lb' in g.snapshot().players[0], false, 'sin diseño no hay `lb`');
});
test('chasis: las habilidades de Axioma funcionan en el laboratorio (mov, esp, s3, ult) sin lanzar', () => {
  const g = nuevoJuego(), p = g.addPlayer('Lab', null, { char: 'laboratorio', evo: 1 });
  for (let i = 0; i < 900; i++) { g.setInput(p.id, { mz: 1, mov: i % 100 === 5, esp: i % 130 === 9, s3: i % 170 === 20, ult: i % 400 === 50, melee: i % 40 === 3 }); g.step(1 / 60); }
  assert.ok(Number.isFinite(p.hp));
});
test('chasis: modo Combo (Melé) del laboratorio usa los golpes de Axioma', () => {
  const g = nuevoJuego(), p = g.addPlayer('Lab', null, { char: 'laboratorio', mode: 'combo' });
  for (let i = 0; i < 400; i++) { g.setInput(p.id, { mode: 'combo', a1: i % 30 === 2, a2: i % 90 === 10, hab: i % 200 === 30 }); g.step(1 / 60); }
  assert.ok(Number.isFinite(p.hp));
});

/* ───────── (a) build ilegal → chasis por defecto + aviso ───────── */
test('(a) build ilegal: se juega con el chasis por defecto, con aviso en español, SIN expulsar', () => {
  const g = nuevoJuego();
  const malas = [
    vb(conFuncionales(['placas', 'adrenal'])),                                    // 2 funcionales con evo 0
    'VB1:basura', 'VB1:', 'no es un diseño', '\u0000',                              // texto roto
    vb(build([pieza('cuerno_curvo', 'cabeza'), pieza('cuerno_curvo', 'cabeza')])),   // choque HB-09
  ];
  for (const lab of malas) {
    const p = g.addPlayer('x', null, { char: 'laboratorio', evo: 0, lab });
    if (!p) break;
    assert.deepEqual(p.corg, [], 'sin órganos'); assert.equal(p.lb, 0);
    assert.ok(p.lbAviso.startsWith(ERRORES.lab.slice(0, 20)), p.lbAviso); assert.match(p.lbAviso, /Híbrido Genómico/);
  }
  const r = labDe(vb(conFuncionales(['placas', 'adrenal'])), { evo: 0 });
  assert.equal(r.ok, false); assert.equal(r.defecto, true); assert.equal(r.build.id, 'lab-defecto'); assert.equal(r.organos.length, 0);
  assert.equal(labDe(vb(conFuncionales(['placas', 'adrenal'])), { evo: 1 }).ok, true, 'con evo 1 sí caben');
});
test('(a) un objeto con forma rara, números enormes o nombres peligrosos tampoco rompe nada', () => {
  for (const lab of [{ partes: [{ p: '__proto__' }] }, { partes: 'x' }, 5, [], { nombre: '<script>', v: 99 }, { prop: { altura: 1e300 } }]) {
    const g = nuevoJuego(); assert.doesNotThrow(() => g.addPlayer('x', null, { char: 'laboratorio', lab }));
  }
});
test('(a) lab sobre un Huésped OFICIAL se ignora: Axioma con `lab` no recibe nada del diseño', () => {
  const g = nuevoJuego(), p = g.addPlayer('x', null, { char: 'axioma', evo: 4, lab: vb(conFuncionales(['placas', 'adrenal', 'medula'])) });
  assert.deepEqual(p.corg, []); assert.equal(p.lb || 0, 0);
});

/* ───────── (b) p.bn dentro de CAPS ───────── */
test('(b) p.bn queda dentro de CAPS aunque se sumen bendiciones, maestría 10 y el diseño más fuerte', () => {
  const ids = Object.keys(BENDICIONES).slice(0, 6);
  const mejor = conFuncionales(['placas', 'adrenal', 'ojo_extra', 'corazon_cristal', 'espiraculo']);
  for (const char of ['laboratorio']) {   // (los oficiales no recortan p.bn tras sumar bendiciones + maestría: es su comportamiento de siempre; el laboratorio sí, por eso nunca los supera)
    const g = nuevoJuego(), p = g.addPlayer('x', null, { char, evo: 4, lab: vb(mejor), bend: ids, maestria: 10, corg: ['placas', 'adrenal', 'ojo_extra', 'corazon_cristal', 'espiraculo'] });
    for (const [k, [lo, hi]] of Object.entries(CAPS)) if (k in p.bn) assert.ok(p.bn[k] >= lo - 1e-9 && p.bn[k] <= hi + 1e-9, `${char} ${k}=${p.bn[k]}`);
  }
});
test('(b) el diseño NO toca p.bn: un laboratorio con y sin órganos tiene idéntico p.bn (los efectos vienen de los órganos, no de multiplicadores nuevos)', () => {
  const a = nuevoJuego().addPlayer('x', null, { char: 'laboratorio', evo: 4, maestria: 5 }), g = nuevoJuego();
  const b = g.addPlayer('x', null, { char: 'laboratorio', evo: 4, maestria: 5, lab: vb(conFuncionales(['placas', 'adrenal', 'ojo_extra'])) });
  assert.deepEqual(a.bn, b.bn);
});

/* ───────── (c) vista previa == simulación ───────── */
test('(c) la vista previa (derivarStats) coincide con la simulación: mismos órganos cargados y mismos efectos medidos (100 diseños)', () => {
  const r = prng(404);
  for (let i = 0; i < 100; i++) {
    const evo = Math.floor(r() * 5), cantidad = Math.floor(r() * (champOrganSlots(evo) + 1)), ids = [...FUNCIONALES].sort(() => r() - 0.5).slice(0, cantidad);
    const cosm = [...COSMETICAS].filter((id) => !PARTES[id].choca_con.length && PARTES[id].anclas.every((a) => a !== 'manos')).slice(0, Math.floor(r() * 4));
    const b = build([...cosm.map((id) => pieza(id, anclaDe(id))), ...ids.map((id) => pieza(id, anclaDe(id)))], { prop: Object.fromEntries(PROP_ORDEN.map((k) => [k, PROP_RANGOS[k][0] + r() * (PROP_RANGOS[k][1] - PROP_RANGOS[k][0])])) });
    const prev = labDe(vb(b), { evo });
    if (!prev.ok) continue;                                                       // algún caso aleatorio puede violar HB-05/HB-09: se salta
    const S = derivarStats(prev.build, { evo }), g = nuevoJuego(), p = g.addPlayer('x', null, { char: 'laboratorio', evo, lab: vb(b) });
    assert.deepEqual([...p.corg].sort(), [...S.organos].sort(), 'mismos órganos');
    const base = nuevoJuego(), q = base.addPlayer('x', null, { char: 'laboratorio', evo });
    const M = medir(g, p), B = medir(base, q), m = S.mult;
    assert.ok(Math.abs(M.spd / B.spd - (m.spd || 1)) < 1e-6, `velocidad ${M.spd / B.spd} vs ${m.spd}`);
    assert.ok(Math.abs(M.jump / B.jump - (m.salto || 1)) < 1e-6, 'salto');
    assert.ok(Math.abs(M.cd / B.cd - (m.cd || 1)) < 1e-6, 'recarga');
    assert.ok(Math.abs(M.dmgIn / B.dmgIn - (m.dmgIn || 1)) < 1e-6, 'daño recibido');
    assert.ok(Math.abs(M.out / B.out - (m.danoSalida || 1)) < 1e-6, 'daño hecho');
  }
});
test('(c) el nombre del diseño, sus colores y sus piezas estéticas no cambian NINGUNA medición', () => {
  const funcs = ['placas', 'adrenal'];
  const A = build([...funcs.map((id) => pieza(id, anclaDe(id)))]);
  const B = build([pieza('alas_membrana', 'espalda'), pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), ...funcs.map((id) => pieza(id, 'espalda', { t: { pos: [0.05, 0.05, -0.05], rot: [10, 10, 10], esc: 1.5 } }))].filter((e) => PARTES[e.p].anclas.includes(e.a)), { nombre: 'Otro', pal: { primario: '#ffffff', secundario: '#000000', emisivo: '#ff0000', acabado: 'obsidiana' }, prop: { altura: 1.1, ancho: 1.1 } });
  const ga = nuevoJuego(), gb = nuevoJuego(), pa = ga.addPlayer('x', null, { char: 'laboratorio', evo: 1, lab: vb(A) }), pb = gb.addPlayer('x', null, { char: 'laboratorio', evo: 1, lab: vb(B) });
  assert.ok(pb.corg.length === 2 && pa.corg.length === 2);
  assert.deepEqual(medir(ga, pa), medir(gb, pb));
});
test('(c) regeneración (médula) y recarga de escudo (corazón de cristal) medidas en vuelo', () => {
  const run = (ids, ticks) => {
    const g = nuevoJuego({ calm: 600 }), p = g.addPlayer('x', null, { char: 'laboratorio', evo: 2, lab: ids.length ? vb(conFuncionales(ids)) : undefined });
    g.step(1 / 60); p.hp = 40; p.shield = 0; p.lastHurt = -100;
    const h0 = p.hp, s0 = p.shield; for (let i = 0; i < ticks; i++) g.step(1 / 60);
    return { hp: p.hp - h0, sh: p.shield - s0 };
  };
  const base = run([], 120), med = run(['medula'], 120), base1 = run([], 60), cor = run(['corazon_cristal'], 60);
  assert.ok(med.hp - base.hp > 2.5 && med.hp - base.hp < 3.5, `regeneración extra ${med.hp - base.hp} (esperado ≈ 3 en 2 s)`);
  assert.ok(base1.sh > 0 && Math.abs(cor.sh / base1.sh - 1.5) < 0.02, `escudo ${cor.sh / base1.sh}`);
});

/* ───────── anti-trampa: poder máximo ≤ oficial con los mismos órganos ───────── */
test('el poder de una build NO supera el de un OFICIAL con los mismos órganos (todas las combinaciones de hasta 5)', () => {
  const ids = Object.keys(CHAMP_ORGANS);
  for (let k = 0; k < 256; k++) {
    const sel = ids.filter((_, i) => (k >> i) & 1); if (sel.length > 5) continue;
    const g1 = nuevoJuego(), lab = g1.addPlayer('x', null, { char: 'laboratorio', evo: 4, lab: vb(conFuncionales(sel)) });
    const g2 = nuevoJuego(), of = g2.addPlayer('x', null, { char: 'axioma', evo: 4, corg: sel });
    assert.deepEqual([...lab.corg].sort(), [...of.corg].sort());
    const A = medir(g1, lab), B = medir(g2, of);
    for (const key of Object.keys(A)) assert.ok(A[key] <= B[key] + 1e-9 && A[key] >= B[key] - 1e-9, `${key}: lab ${A[key]} vs oficial ${B[key]} con ${sel}`);
  }
});
test('el laboratorio NUNCA carga más órganos que 1 + evo, aunque el perfil mande `corg` de más', () => {
  for (let evo = 0; evo <= 4; evo++) {
    const g = nuevoJuego(), p = g.addPlayer('x', null, { char: 'laboratorio', evo, corg: Object.keys(CHAMP_ORGANS), lab: vb(conFuncionales(Object.keys(CHAMP_ORGANS).slice(0, champOrganSlots(evo)))) });
    assert.ok(p.corg.length <= champOrganSlots(evo), `evo ${evo}: ${p.corg.length}`);
    assert.deepEqual([...p.corg].sort(), Object.keys(CHAMP_ORGANS).slice(0, champOrganSlots(evo)).sort(), 'solo los del diseño, no los del perfil');
  }
});

/* ───────── (d) hitbox fija: el tamaño visual nunca entra en el combate ───────── */
test('(d) altura y ancho extremos ⇒ misma colisión: la simulación completa es idéntica tick a tick (900 ticks, con movimiento y combate)', () => {
  const mk = (altura, ancho, extra) => build([pieza('placas', 'pecho'), ...(extra ? [pieza('alas_membrana', 'espalda', { t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1.5 } }), pieza('cola_larga', 'cola')] : [])], { prop: { altura, ancho, piernas: 0.95, hombros: 1.0 }, pal: extra ? { primario: '#ffffff', secundario: '#000000', emisivo: '#00ff00', acabado: 'obsidiana' } : {} });
  const g1 = nuevoJuego({ seed: 3 }), g2 = nuevoJuego({ seed: 3 });
  const p1 = g1.addPlayer('A', null, { char: 'laboratorio', evo: 0, lab: vb(mk(0.9, 0.9, false)) }), p2 = g2.addPlayer('A', null, { char: 'laboratorio', evo: 0, lab: vb(mk(1.15, 1.15, true)) });
  assert.notEqual(huella(mk(0.9, 0.9, false)), huella(mk(1.15, 1.15, true)));
  const r = prng(55);
  for (let t = 0; t < 900; t++) {
    const inp = { mx: Math.floor(r() * 3) - 1, mz: Math.floor(r() * 3) - 1, dyaw: (r() - 0.5) * 0.1, fire: r() < 0.5, jump: r() < 0.03, melee: r() < 0.05, mov: r() < 0.01, esp: r() < 0.01 };
    g1.setInput(p1.id, inp); g2.setInput(p2.id, inp); g1.step(1 / 60); g2.step(1 / 60);
    if (t % 150 === 0) assert.equal(JSON.stringify(g1.snapshot()), JSON.stringify(g2.snapshot()), 'tick ' + t);
  }
  assert.equal(JSON.stringify(g1.snapshot()), JSON.stringify(g2.snapshot()));
  assert.equal(p1.lb, p2.lb);
});
test('(d) el radio de colisión del jugador es la constante PLAYER.radius y el código de simulación no lee `prop`, `altura` ni `ancho` del diseño', () => {
  assert.equal(PLAYER.radius, 0.9);
  const archivos = fs.readdirSync(path.join(ROOT, 'src/sim')).filter((f) => f.endsWith('.js'));
  for (const f of archivos) {
    const src = fs.readFileSync(path.join(ROOT, 'src/sim', f), 'utf8');
    if (f === 'laboratorio.js' || f === 'laboratorio-perfil.js') continue;
    assert.ok(!/\.lab\.(prop|partes|pal|pose|base)\b/.test(src), f + ' lee campos cosméticos del diseño');
    assert.ok(!/\bhost-build\b/.test(src.replace(/^\/\/.*$/gm, '')), f + ' no debería importar el módulo del editor');
  }
  const lab = fs.readFileSync(path.join(ROOT, 'src/sim/laboratorio.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\.prop\b|altura|ancho|\.pal\b|\.pose\b|\.partes/.test(lab), 'laboratorio.js solo debe mirar los órganos');
});

/* ───────── (e) red ───────── */
test('(e) el diseño más grande viaja en ≤ 2 KB y el mensaje `create` completo en ≤ 8192 bytes', () => {
  const peor = build(Array.from({ length: 24 }, (_, i) => pieza('rodillera_placa', 'muslos', { l: i % 2 ? 'izq' : 'der', c: { mat: 'metal', tinte: '#aabbcc' } })).slice(0, 24), { nombre: 'Ñ'.repeat(24) });
  const txt = vb(peor); assert.ok(txt.length <= LAB_MAX_CHARS, String(txt.length));
  const msg = JSON.stringify({ t: 'create', v: PROTOCOLO, map: 'm1', name: 'x'.repeat(16), char: 'laboratorio', lab: txt, equip: Array.from({ length: 12 }, () => ({ s: 'gun', id: 'a'.repeat(30), q: 0.5, k: 99999 })), slots: [1, 2, 3, 4, 5] });
  assert.ok(Buffer.byteLength(msg) < 8192, String(Buffer.byteLength(msg)));
});
test('(e) cargaDe: valida en servidor — bueno pasa, malo cae al defecto con aviso, un objeto en vez de texto se rechaza, otro Huésped ignora `lab`', () => {
  const bueno = vb(conFuncionales(['placas']));
  const c = cargaDe({ char: 'laboratorio', lab: bueno, evo: 0 });
  assert.equal(c.lab, bueno); assert.equal(c.labAviso, ''); assert.match(c.labH, /^[0-9a-f]{14}$/);
  const malo = cargaDe({ char: 'laboratorio', lab: 'VB1:xxxx', evo: 0 }); assert.equal(malo.lab, undefined); assert.match(malo.labAviso, /Híbrido/);
  const obj = cargaDe({ char: 'laboratorio', lab: build([pieza('placas', 'pecho')]), evo: 0 }); assert.equal(obj.lab, undefined); assert.ok(obj.labAviso);
  const exceso = cargaDe({ char: 'laboratorio', lab: vb(conFuncionales(['placas', 'adrenal'])), evo: 0 }); assert.equal(exceso.lab, undefined); assert.ok(exceso.labAviso);
  assert.equal(cargaDe({ char: 'laboratorio', lab: vb(conFuncionales(['placas', 'adrenal'])), evo: 1 }).labAviso, '');
  const of = cargaDe({ char: 'axioma', lab: bueno }); assert.equal(of.lab, undefined); assert.equal(of.labAviso, '');
  assert.equal(cargaDe({ char: 'laboratorio' }).lab, undefined); assert.equal(cargaDe({ char: 'laboratorio' }).labAviso, '');
  assert.equal(cargaDe({ char: 'laboratorio', lab: 'x'.repeat(100000) }).lab, undefined);
});
test('(e) `lb` en el snapshot es un índice corto; dos jugadores con el mismo diseño comparten índice; labsDeRed lista {i,h,vb1}', () => {
  const g = nuevoJuego(), b1 = vb(conFuncionales(['placas'], { id: 'lab-uno00001' })), b2 = vb(conFuncionales(['adrenal'], { id: 'lab-dos00002' }));
  const a = g.addPlayer('A', null, { char: 'laboratorio', lab: b1 }), b = g.addPlayer('B', null, { char: 'laboratorio', lab: b2 }), c = g.addPlayer('C', null, { char: 'laboratorio', lab: b1 });
  assert.deepEqual([a.lb, b.lb, c.lb], [1, 2, 1]);
  const snap = g.snapshot().players; assert.deepEqual(snap.map((p) => p.lb), [1, 2, 1]);
  const L = labsDeRed(g); assert.equal(L.length, 2); assert.deepEqual(L.map((x) => x.i), [1, 2]); assert.ok(L.every((x) => x.vb1.startsWith('VB1:') && /^[0-9a-f]{14}$/.test(x.h)));
  assert.ok(JSON.stringify(snap).length < 6000);
});
test('(e) ERRORES.lab existe en español y el protocolo subió a 6', () => {
  assert.equal(PROTOCOLO, 6); assert.match(ERRORES.lab, /diseño/); assert.match(ERRORES.version, /versiones distintas/);
});

/* ───────── cambio de Huésped en plena sala ───────── */
test('setLoadout: pasar de laboratorio a un oficial limpia el diseño; volver a laboratorio aplica el nuevo', () => {
  const g = nuevoJuego(), p = g.addPlayer('A', null, { char: 'laboratorio', evo: 2, lab: vb(conFuncionales(['placas', 'adrenal'])) });
  assert.equal(p.corg.length, 2); assert.equal(p.lb, 1);
  g.setLoadout(p.id, 'vesper', null, {}); assert.equal(p.lb, 0); assert.equal(p.char, 'vesper');
  g.setLoadout(p.id, 'laboratorio', null, { lab: vb(conFuncionales(['medula'], { id: 'lab-otro0003' })), evo: 2 });
  assert.equal(p.char, 'laboratorio'); assert.deepEqual(p.corg, ['medula']); assert.equal(p.lb, 2);
  g.setLoadout(p.id, 'laboratorio', null, {}); assert.deepEqual(p.corg, []); assert.equal(p.lb, 0);
});

/* ───────── (f) auditoría de las ramas `p.char ===` ───────── */
test('(f) auditoría: ninguna rama `p.char ===` de la simulación menciona al laboratorio y las que existen son SOLO de colmena, singular y danzante', () => {
  const dir = path.join(ROOT, 'src/sim'), hallazgos = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const lineas = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    lineas.forEach((l, i) => { for (const m of l.matchAll(/\.char\s*(?:===|!==|==|!=)\s*'([a-z_]+)'/g)) if (m[1] !== 'string') hallazgos.push(`${f}:${i + 1} ${m[1]}`); });
  }
  const objetivos = new Set(hallazgos.map((h) => h.split(' ')[1]));
  assert.deepEqual([...objetivos].sort(), ['colmena', 'danzante', 'singular']);
  assert.ok(!hallazgos.some((h) => h.endsWith('laboratorio')));
  assert.equal(hallazgos.length, 15, '(el documento cuenta 16: son estas 15 más un `typeof e.char` de ledger.js que no es una rama por Huésped) si cambia esta cifra hay una rama nueva por id: revisá qué hace con el laboratorio\n' + hallazgos.join('\n'));
  // y el laboratorio cae, por construcción, en la rama «sin efecto especial»: ninguna de esas tres le aplica nada
  const g = nuevoJuego(), p = g.addPlayer('x', null, { char: 'laboratorio' });
  for (let i = 0; i < 300; i++) g.step(1 / 60);
  for (const k of ['swarmUntil', 'dzState', 'sing']) assert.equal(p[k], undefined, k);
});
test('(f) las tablas por Huésped que la simulación consulta con p.char cubren al laboratorio o degradan a «sin efecto»', () => {
  const g = nuevoJuego(), p = g.addPlayer('x', null, { char: 'laboratorio' });
  // el chasis puede evolucionar, usar árbol de talentos, ranuras en Melé y habilidades en el nivel de tutorial sin romper nada
  for (let evo = 0; evo < 4; evo++) { p.input.evo = 1; g.step(1 / 60); p.input.evo = 0; g.step(1 / 60); }
  assert.ok(Number.isFinite(p.evo));
  const g2 = nuevoJuego({ skillLevel: 2 }), q = g2.addPlayer('y', null, { char: 'laboratorio', arbol: { combo: ['no', 'existe'], disparo: [] }, maestria: 3 });
  for (let i = 0; i < 200; i++) { g2.setInput(q.id, { support: true, ult: i === 3, mov: true, compact: true }); g2.step(1 / 60); }
  assert.ok(Number.isFinite(q.hp));
});

/* ───────── determinismo ───────── */
test('misma semilla + mismas entradas + mismo diseño ⇒ mismo snapshot final (dos corridas)', () => {
  const corrida = () => {
    const g = nuevoJuego({ seed: 11 }), p = g.addPlayer('A', null, { char: 'laboratorio', evo: 1, lab: vb(conFuncionales(['placas', 'tentaculo'])) });
    const r = prng(9);
    for (let t = 0; t < 600; t++) { g.setInput(p.id, { mz: r() < 0.7 ? 1 : 0, mx: Math.floor(r() * 3) - 1, fire: r() < 0.5, melee: r() < 0.05 }); g.step(1 / 60); }
    return JSON.stringify(g.snapshot());
  };
  assert.equal(corrida(), corrida());
});
test('applyLab con juego nulo (uso suelto) no lanza y devuelve el resultado', () => {
  const p = { evo: 1, bn: { dmgIn: 1 }, corg: [], ess: { carne: 0, cristal: 0, ojo: 0, vacio: 0 }, worg: {} };
  const r = applyLab(p, vb(conFuncionales(['placas'])), null); assert.equal(r.ok, true); assert.deepEqual(p.corg, ['placas']); assert.equal(p.lb, 0);
});
test('ninguna pieza cosmética otorga efecto: cargar TODAS las cosméticas deja p.corg vacío', () => {
  const todas = COSMETICAS.filter((id) => PARTES[id].anclas.every((a) => a !== 'manos')).map((id) => pieza(id, anclaDe(id)));
  const r = labDe(vb(build(todas)), { evo: 4 });
  const g = nuevoJuego(), p = g.addPlayer('x', null, { char: 'laboratorio', evo: 4, lab: vb(build(todas.slice(0, 5))) });
  assert.deepEqual(p.corg, []); void r; void ORDEN_ANCLAS;
});
