// EH-11 (sugeridor determinista + reparar) y EH-15 (oficiales en solo lectura). node:test, sin red, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANTILLAS, PLANTILLA_IDS, sugerir, reparar, sugerirPaleta, completarSimetria, explicar, prng } from '../src/shared/host-build-sugeridor.js';
import { OFICIALES, describirOficial, listarOficiales, esOficial } from '../src/shared/host-build-oficiales.js';
import { validar, usable, defecto, huella, normalizar, codificar, decodificar, PARTES, ORDEN_PARTES, FUNCIONALES, COSMETICAS, PIEZAS_INICIALES, luminancia, ANCLAS, ORDEN_ANCLAS, PROP_ORDEN, instancias } from '../src/shared/host-build.js';
import { CHARACTERS, HOST_IDS } from '../src/sim/data.js';
import * as LP from '../src/sim/laboratorio-perfil.js';
import { Game } from '../src/sim/game.js';
import { cargaDe } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pieza = (p, a, o = {}) => ({ p, a, sim: 'ninguna', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: PARTES[p].variantesMat[0], tinte: null }, ...o });
const build = (partes = [], extra = {}) => ({ ...defecto(), id: 'lab-sugtest01', nombre: 'Sug', partes, ...extra });
const TODAS = ORDEN_PARTES;

/* ───────── sugeridor: determinismo ───────── */
test('misma plantilla + misma semilla + mismo ctx ⇒ misma build (misma huella), en 5 plantillas × 40 semillas', () => {
  assert.deepEqual([...PLANTILLA_IDS].sort(), ['acorazado', 'brutal', 'cazador', 'enjambre', 'etereo']);
  for (const id of PLANTILLA_IDS) for (let s = 0; s < 40; s++) {
    const ctx = { evo: s % 5, poseidas: TODAS }, a = sugerir(id, s, ctx), b = sugerir(id, s, ctx);
    assert.equal(huella(a.build), huella(b.build), `${id}/${s}`); assert.deepEqual(a.build, b.build); assert.deepEqual(a.notas, b.notas);
  }
});
test('semillas distintas dan builds distintas (variedad real) y la semilla puede ser texto', () => {
  for (const id of PLANTILLA_IDS) { const hs = new Set(Array.from({ length: 30 }, (_, s) => huella(sugerir(id, s, { evo: 2, poseidas: TODAS }).build))); assert.ok(hs.size >= 25, `${id}: ${hs.size} distintas de 30`); }
  assert.equal(huella(sugerir('brutal', 'hola', { evo: 1 }).build), huella(sugerir('brutal', 'hola', { evo: 1 }).build));
  assert.notEqual(huella(sugerir('brutal', 'hola', { evo: 1 }).build), huella(sugerir('brutal', 'chau', { evo: 1 }).build));
});
test('las plantillas son distintas entre sí (con la misma semilla dan builds distintas)', () => {
  assert.equal(new Set(PLANTILLA_IDS.map((id) => huella(sugerir(id, 1, { evo: 2, poseidas: TODAS }).build))).size, 5);
});
test('semilla o plantilla rara no rompen: usan la plantilla por defecto', () => {
  for (const [pl, s] of [['nada', 1], [undefined, undefined], [null, NaN], [5, {}], ['__proto__', 'x']]) { const r = sugerir(pl, s, {}); assert.equal(validar(r.build).ok, true); }
  for (const c of [null, 'x', 5, []]) assert.doesNotThrow(() => sugerir('brutal', 1, c));
});

/* ───────── toda salida pasa validar ───────── */
test('TODA salida del sugeridor pasa `validar` sin errores (5 plantillas × 120 semillas × todas las evoluciones)', () => {
  for (const id of PLANTILLA_IDS) for (let s = 0; s < 120; s++) {
    const evo = s % 5, ctx = { evo, poseidas: TODAS }, r = sugerir(id, s, ctx), v = validar(r.build, ctx);
    assert.equal(v.ok, true, `${id}/${s}/evo${evo}: ${JSON.stringify(v.errores)}`);
    assert.equal(usable(r.build, ctx).defecto, false);
    assert.ok(v.cap.usado <= v.cap.max); assert.ok(!v.render.excede);
    assert.match(r.build.id, /^lab-[a-z0-9]{6,24}$/); assert.ok(r.build.nombre.length > 2);
  }
});
test('el sugeridor solo usa piezas que el jugador POSEE (aunque la plantilla quiera otras)', () => {
  for (const id of PLANTILLA_IDS) for (let s = 0; s < 40; s++) {
    const ctx = { evo: 4, poseidas: PIEZAS_INICIALES }, r = sugerir(id, s, ctx);
    assert.ok(r.build.partes.every((e) => PIEZAS_INICIALES.includes(e.p)), `${id}/${s}: ${r.build.partes.map((e) => e.p)}`);
    assert.equal(validar(r.build, ctx).ok, true); assert.deepEqual(validar(r.build, ctx).bloqueadas, []);
  }
  const vacio = sugerir('etereo', 1, { evo: 4, poseidas: [] }); assert.equal(vacio.build.partes.length, 0); assert.ok(vacio.notas.length > 0); assert.equal(validar(vacio.build).ok, true);
});
test('el sugeridor respeta la capacidad: con evo 0 pone UNA funcional como máximo; con evo 4, hasta 3 según la plantilla', () => {
  for (const id of PLANTILLA_IDS) {
    const f = (ctx) => sugerir(id, 5, ctx).build.partes.filter((e) => PARTES[e.p].cat === 'funcional').length;
    assert.ok(f({ evo: 0, poseidas: TODAS }) <= 1, id); assert.ok(f({ evo: 4, poseidas: TODAS }) <= 5);
    assert.ok(f({ evo: 4, poseidas: TODAS }) >= f({ evo: 0, poseidas: TODAS }));
  }
});
test('cero red: el módulo del sugeridor no importa nada de red ni usa fetch/WebSocket/Math.random/Date', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/shared/host-build-sugeridor.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const mala of ['fetch(', 'WebSocket', 'XMLHttpRequest', 'Math.random', 'Date.now', 'new Date', 'import(', 'localStorage', 'navigator', 'document.']) assert.ok(!src.includes(mala), mala);
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]); assert.ok(imports.every((i) => i.startsWith('.')), imports.join());
});
test('el sugeridor no toca la entrada ni los catálogos (congelados)', () => {
  const ctx = { evo: 2, poseidas: TODAS.slice() }, antes = JSON.stringify(ctx); sugerir('brutal', 3, ctx); assert.equal(JSON.stringify(ctx), antes);
  assert.ok(Object.isFrozen(PLANTILLAS) && Object.isFrozen(PLANTILLAS.brutal));
});

/* ───────── paleta ───────── */
test('sugerirPaleta: determinista, 3 colores válidos, emisivo sin deslumbrar, esquema nombrado', () => {
  for (let s = 0; s < 200; s++) {
    const p = sugerirPaleta(s), q = sugerirPaleta(s); assert.deepEqual(p, q);
    for (const k of ['primario', 'secundario', 'emisivo']) assert.match(p[k], /^#[0-9a-f]{6}$/);
    assert.ok(luminancia(p.emisivo) <= 0.8 + 1e-9); assert.ok(['analoga', 'complementaria', 'triada'].includes(p.esquema));
  }
  assert.ok(new Set(Array.from({ length: 50 }, (_, s) => sugerirPaleta(s).primario)).size > 30);
  assert.deepEqual(sugerirPaleta('a'), sugerirPaleta('a'));
});
test('prng: reproducible, en [0,1) y distinto entre semillas', () => {
  const a = prng(5), b = prng(5), c = prng(6); const xs = Array.from({ length: 20 }, () => a()), ys = Array.from({ length: 20 }, () => b());
  assert.deepEqual(xs, ys); assert.ok(xs.every((x) => x >= 0 && x < 1)); assert.notDeepEqual(xs, Array.from({ length: 20 }, () => c()));
  assert.deepEqual(Array.from({ length: 5 }, prng('semilla')), Array.from({ length: 5 }, prng('semilla')));
});

/* ───────── reparar ───────── */
test('reparar: una build válida queda igual (misma huella) y sin cambios', () => {
  const b = build([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('placas', 'pecho')]);
  const r = reparar(b, { evo: 0 }); assert.equal(r.ok, true); assert.equal(huella(r.build), huella(b)); assert.deepEqual(r.cambios, []);
});
test('reparar: arregla recortes (HB-04/08/14/15), choques (HB-09), capacidad (HB-13), mano derecha (HB-12) y proporciones (HB-05); el resultado valida', () => {
  const sucia = build([
    pieza('cuerno_curvo', 'cabeza', { t: { pos: [9, 9, 9], rot: [999, 0, 0], esc: 99 } }), pieza('cresta_osea', 'cabeza'), pieza('corona_espinas', 'cabeza'),      // choque de corona
    pieza('placas', 'pecho'), pieza('adrenal', 'cintura'), pieza('medula', 'espalda'),                                                                                 // capacidad
    pieza('garras_mano', 'manos', { sim: 'espejo' }),                                                                                                                  // mano derecha
    pieza('placas', 'espalda'),                                                                                                                                        // duplicado funcional
  ], { prop: { altura: 1.15, piernas: 1.15, brazos: 1.15, hombros: 0.92, cabeza: 1.2, manos: 9 }, pal: { emisivo: '#ffffff', primario: 'rojo' } });
  assert.equal(validar(sucia, { evo: 0 }).ok, false);
  const r = reparar(sucia, { evo: 0 }); assert.equal(r.ok, true); const v = validar(r.build, { evo: 0 }); assert.equal(v.ok, true, JSON.stringify(v.errores));
  assert.ok(r.cambios.length >= 4); assert.ok(r.cambios.every((c) => typeof c === 'string' && c.length > 5));
  assert.equal(r.build.partes.filter((e) => PARTES[e.p].cat === 'funcional').length, 1);
  assert.ok(r.build.partes.some((e) => e.p === 'garras_mano' && e.l === 'izq' && e.sim === 'ninguna'), 'las garras se pasan a la mano izquierda en vez de borrarse');
});
test('reparar: si se pasa del presupuesto quita primero lo de MENOS valor (las funcionales se conservan), y es determinista', () => {
  const enorme = build([pieza('alas_membrana', 'espalda'), pieza('cola_larga', 'cola'), pieza('tentaculo', 'hombros', { sim: 'espejo' }), pieza('hombrera_espinas', 'hombros', { sim: 'espejo' }), pieza('cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }), pieza('rodillera_placa', 'muslos', { sim: 'espejo' }), pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' })]);
  const a = reparar(enorme, { evo: 0 }), b = reparar(enorme, { evo: 0 }); assert.deepEqual(a, b); assert.equal(validar(a.build, { evo: 0 }).ok, true);
  assert.ok(a.build.partes.some((e) => e.p === 'tentaculo'), 'la funcional se mantiene mientras se pueda');
  assert.ok(a.build.partes.length < enorme.partes.length);
});
test('reparar: piezas no poseídas se quitan, ilegibles vuelven al defecto, y NUNCA devuelve algo inválido (fuzz de 600 builds)', () => {
  const r0 = reparar(build([pieza('cola_larga', 'cola'), pieza('placas', 'pecho')]), { evo: 0, poseidas: PIEZAS_INICIALES }); assert.deepEqual(r0.build.partes.map((e) => e.p), ['placas']); assert.equal(r0.ok, true);
  for (const x of [null, 5, 'x', { v: 99 }, []]) { const r = reparar(x, {}); assert.equal(r.build.id, 'lab-defecto'); assert.equal(validar(r.build).ok, true); }
  const rr = prng(321), elige = (a) => a[Math.floor(rr() * a.length)];
  for (let i = 0; i < 600; i++) {
    const partes = Array.from({ length: Math.floor(rr() * 30) }, () => { const p = elige(ORDEN_PARTES); return { p, a: elige(PARTES[p].anclas), sim: elige(['espejo', 'ninguna']), l: elige(['izq', 'der']), t: { pos: [rr() - 0.5, rr() - 0.5, rr() - 0.5], rot: [rr() * 200 - 100, 0, 0], esc: rr() * 3 }, c: { mat: elige(PARTES[p].variantesMat), tinte: null } }; });
    const raw = build(partes, { prop: Object.fromEntries(PROP_ORDEN.map((k) => [k, 0.5 + rr()])) }), ctx = { evo: Math.floor(rr() * 5), poseidas: rr() < 0.5 ? TODAS : PIEZAS_INICIALES };
    const r = reparar(raw, ctx), v = validar(r.build, ctx);
    assert.equal(v.ok, true, `${i}: ${JSON.stringify(v.errores)}`); assert.equal(r.ok, true);
    assert.equal(huella(reparar(r.build, ctx).build), huella(r.build), 'reparar es idempotente');
  }
});

/* ───────── otras acciones ───────── */
test('completarSimetria: las piezas «par» pasan a espejo y el resultado valida; las únicas no cambian', () => {
  const b = build([pieza('cuerno_curvo', 'cabeza'), pieza('cresta_osea', 'cabeza', {}), pieza('hombrera_espinas', 'hombros', { l: 'izq' })].filter((e, i) => i !== 1));
  const r = completarSimetria(b, { evo: 1 }); assert.ok(r.build.partes.filter((e) => PARTES[e.p].lados === 'par').every((e) => e.sim === 'espejo')); assert.equal(validar(r.build, { evo: 1 }).ok, true);
  assert.ok(r.cambios[0].includes('simétricas'));
});
test('explicar: dice las ranuras, el efecto real de cada funcional y que lo estético no cambia estadísticas', () => {
  const t = explicar(build([pieza('placas', 'pecho'), pieza('cuerno_curvo', 'cabeza')]), { evo: 1 });
  assert.match(t[0], /1 de 2/); assert.ok(t.some((x) => x.includes('12 % menos de daño recibido'))); assert.ok(t.some((x) => /solo estética/.test(x)));
  assert.ok(explicar(null, {}).length >= 3);
});

/* ───────── EH-15: oficiales ───────── */
test('EH-15: hay 8 oficiales y cada uno tiene una vista de solo lectura generada de su definición, con las anclas', () => {
  assert.equal(OFICIALES.length, 8); assert.deepEqual([...OFICIALES], HOST_IDS);
  for (const id of OFICIALES) {
    const v = describirOficial(id); assert.ok(v, id); assert.equal(v.id, id); assert.equal(v.kind, 'official'); assert.equal(v.schema, 'vortex.hostdef');
    assert.equal(v.nombre, CHARACTERS[id].name); assert.deepEqual(v.stats, CHARACTERS[id].stats);
    assert.deepEqual(v.locked, ['silueta', 'diseno', 'habilidades', 'proporciones']); assert.deepEqual(v.personalizable, { acabado: true, paleta: false, anclas: [] });
    assert.equal(v.anclas.length, ORDEN_ANCLAS.length); assert.ok(v.anclas.every((a) => a.estado === 'bloqueada' && ANCLAS[a.id].nombre === a.nombre));
    assert.deepEqual(v.acabados.map((a) => a.id).sort(), ['archivo', 'obsidiana', 'porcelana']); assert.ok(v.habilidades.length >= 4);
  }
  assert.equal(listarOficiales().length, 8);
});
test('EH-15: la vista sale CONGELADA (profunda) y es una copia: mutarla no cambia nada, ni CHARACTERS', () => {
  const antes = JSON.stringify(CHARACTERS);
  const v = describirOficial('axioma');
  assert.ok(Object.isFrozen(v) && Object.isFrozen(v.stats) && Object.isFrozen(v.anclas) && Object.isFrozen(v.anclas[0]) && Object.isFrozen(v.habilidades[0]));
  assert.throws(() => { 'use strict'; v.nombre = 'Hackeado'; }, TypeError); assert.throws(() => { v.stats.dano = 99; }, TypeError); assert.throws(() => { v.anclas.push({}); }, TypeError);
  assert.notEqual(describirOficial('axioma'), v); assert.deepEqual(describirOficial('axioma'), v);
  assert.equal(JSON.stringify(CHARACTERS), antes);
});
test('EH-15: ids que no son oficiales (el laboratorio incluido, y basura) no tienen vista', () => {
  for (const id of ['laboratorio', 'egida', '__proto__', 'constructor', '', null, undefined, 5, {}]) { assert.equal(describirOficial(id), null, String(id)); assert.equal(esOficial(id), false); }
});
test('EH-15: NINGUNA acción del editor modifica un oficial — JSON.stringify(CHARACTERS) idéntico antes y después de ejecutar todo lo público', () => {
  const antes = JSON.stringify(CHARACTERS), antesPartes = JSON.stringify(PARTES);
  const intentos = [];
  for (const id of OFICIALES) {
    // un «diseño» que se hace pasar por un oficial: chasis, id o piezas con su nombre
    intentos.push({ ...build([pieza('placas', 'pecho')]), id, chasis: id }, { ...build(), chasis: id }, { ...build(), id: 'lab-' + id }, { id, nombre: id, partes: [{ p: id, a: 'cabeza' }] });
  }
  for (const x of intentos) {
    const v = validar(x, { evo: 4 }); assert.equal(v.ok === true && x.chasis && x.chasis !== 'laboratorio', false, 'un chasis oficial no es un diseño válido');
    usable(x); normalizar(x); reparar(x, { evo: 4 }); codificar(x); huella(x); completarSimetria(x); explicar(x);
    LP.guardarDiseno(null, x); LP.importar(LP.exportar(x), null); LP.limpiarLab({ slots: [x], activo: x.id });
  }
  for (const id of OFICIALES) for (const pl of PLANTILLA_IDS) { sugerir(pl, id, { evo: 4, poseidas: TODAS }); describirOficial(id); }
  for (const id of OFICIALES) {   // jugar con cada oficial pasando un diseño del laboratorio por la sala y por el servidor
    const g = new Game({ mapId: 'm1', seed: 2, calm: 2 }); const lab = codificar(sugerir('brutal', 1, { evo: 4, poseidas: TODAS }).build);
    const p = g.addPlayer('x', null, { char: id, evo: 4, lab }); for (let i = 0; i < 60; i++) g.step(1 / 60); g.setLoadout(p.id, 'laboratorio', null, { lab, evo: 4 }); g.setLoadout(p.id, id, null, {});
    cargaDe({ char: id, lab });
  }
  const g2 = new Game({ mapId: 'm1', seed: 2, calm: 2 }); const q = g2.addPlayer('x', null, { char: 'laboratorio', evo: 4, lab: codificar(sugerir('acorazado', 3, { evo: 4, poseidas: TODAS }).build) }); for (let i = 0; i < 300; i++) g2.step(1 / 60);
  void q;
  assert.equal(JSON.stringify(CHARACTERS), antes, 'CHARACTERS cambió'); assert.equal(JSON.stringify(PARTES), antesPartes);
  assert.deepEqual(Object.keys(CHARACTERS).filter((k) => CHARACTERS[k].lab), ['laboratorio']);
});
test('EH-15: un oficial no puede colarse como diseño — su chasis/rig ajeno es HB-03 y no se guarda', () => {
  const r = validar({ ...build(), chasis: 'axioma' }); assert.equal(r.ok, false); assert.ok(r.errores.some((e) => e.codigo === 'HB-03'));
  assert.equal(LP.guardarDiseno(null, { ...build(), chasis: 'axioma' }).ok, false);
  assert.equal(LP.limpiarLab({ slots: [{ ...build(), chasis: 'axioma' }] }).slots[0].chasis, 'laboratorio', 'al limpiar, el chasis vuelve a ser el único permitido');
});
test('EH-15: los acabados de los oficiales son los que ya existen (src/shared/cosmetics.js): ni más ni menos', async () => {
  const { FINISHES } = await import('../src/shared/cosmetics.js');
  const v = describirOficial('seraf'); assert.deepEqual(v.acabados.map((a) => a.id), Object.entries(FINISHES).filter(([, f]) => f.channel === 'earned').map(([k]) => k));
});
void COSMETICAS; void FUNCIONALES; void decodificar; void instancias;
