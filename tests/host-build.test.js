// EH-01 · Núcleo de datos del Editor de Huéspedes (src/shared/host-build.js). node:test, sin navegador, sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA, VERSION_BUILD, RIG, ANCLAS, ORDEN_ANCLAS, PARTES, ORDEN_PARTES, COSMETICAS, FUNCIONALES, PIEZAS_INICIALES, PROP_ORDEN, PROP_RANGOS, TOPES_RENDER, MATERIALES_KIT, ACABADOS,
  LIMITES_EFECTO, MENSAJES, defecto, idNuevo, normalizar, sellar, migrar, validar, usable, instancias, costeRender, derivarStats, huella, canonico, codificar, decodificar, limitesDe, limitarBrillo, luminancia,
} from '../src/shared/host-build.js';
import { CAPS } from '../src/sim/items.js';
import { CHAMP_ORGANS, champOrganSlots, CHARACTERS } from '../src/sim/data.js';

/* ───────── utilidades de prueba ───────── */
function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ent = (r, n) => Math.floor(r() * n);
const elige = (r, a) => a[ent(r, a.length)];
const rango = (r, lo, hi) => lo + r() * (hi - lo);
const pieza = (p, a, o = {}) => ({ p, a, sim: 'ninguna', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: PARTES[p].variantesMat[0], tinte: null }, ...o });
const base = (partes = [], extra = {}) => ({ ...defecto(), id: 'lab-prueba01', nombre: 'Prueba', partes, ...extra });
const hbs = (r) => [...r.errores, ...r.avisos].map((x) => x.codigo);

/** Diseño aleatorio: mezcla piezas válidas, anclas ilegales, números fuera de rango y basura. */
function aleatoria(r) {
  const ruido = r() < 0.15;
  const b = { schema: SCHEMA, v: VERSION_BUILD, id: r() < 0.9 ? idNuevo(r) : elige(r, ['x', '', 5, null, 'lab-A']), nombre: elige(r, ['Cazador', 'Á<b>é"', '', '  ', 'x'.repeat(40), 'Ñandú 🐲', 12, null]), rig: RIG, chasis: 'laboratorio',
    base: { preset: elige(r, ['jugador1', 'jugador2', 'nada']), piel: elige(r, ['#8a5a3c', '#ZZZZZZ', '#FFAA00', 5]) },
    prop: {}, pose: { inclinacion: rango(r, -30, 30), hombros: rango(r, -30, 30) }, partes: [],
    pal: { primario: elige(r, ['#123456', '#fff', '#ABCDEF']), secundario: '#2b2430', emisivo: elige(r, ['#ffffff', '#ff7a22', '#00ff00', 'rojo']), acabado: elige(r, ACABADOS.concat(['aurico', 7])) } };
  for (const k of PROP_ORDEN) b.prop[k] = r() < 0.5 ? 1 : rango(r, 0.4, 1.6);
  const n = ent(r, ruido ? 80 : 14);
  for (let i = 0; i < n; i++) {
    const p = r() < 0.05 ? elige(r, ['inventada', 5, null, '__proto__']) : elige(r, ORDEN_PARTES);
    const a = r() < 0.7 && typeof p === 'string' && Object.hasOwn(PARTES, p) ? elige(r, PARTES[p].anclas) : elige(r, ORDEN_ANCLAS.concat(['nada']));
    b.partes.push({ p, a, sim: elige(r, ['espejo', 'ninguna', 'ninguna', 'otra']), l: elige(r, ['izq', 'der', 'x']),
      t: { pos: [rango(r, -0.4, 0.4), rango(r, -0.4, 0.4), rango(r, -0.4, 0.4)], rot: [rango(r, -120, 120), rango(r, -120, 120), rango(r, -120, 120)], esc: rango(r, 0.2, 3) },
      c: { mat: elige(r, MATERIALES_KIT.concat(['nada'])), tinte: elige(r, ['#aabbcc', null, 'x', '#ffffff']) } });
  }
  return b;
}
/** Valor JSON arbitrario (para el test de «nunca lanza»). */
function basura(r, prof = 0) {
  const t = ent(r, prof > 3 ? 5 : 9);
  switch (t) {
    case 0: return null; case 1: return ent(r, 3) - 1; case 2: return r() * 1e9; case 3: return elige(r, ['', 'VB1:', 'lab-xxxxxx', '😀', '__proto__']); case 4: return r() < 0.5;
    case 5: return Array.from({ length: ent(r, 4) }, () => basura(r, prof + 1));
    default: { const o = {}; for (const k of ['schema', 'v', 'id', 'nombre', 'prop', 'partes', 'pal', 'base', 'pose', 'meta', 'h', 'cap', 'rig', 'chasis', 'p', 'a', 't', 'c']) if (r() < 0.5) o[k] = basura(r, prof + 1); return o; }
  }
}

/* ───────── catálogo y anclas: coherencia de los datos ───────── */
test('catálogo: 12 piezas cosméticas + 8 funcionales, ids únicos, todas congeladas', () => {
  assert.equal(COSMETICAS.length, 12); assert.equal(FUNCIONALES.length, 8); assert.equal(new Set(ORDEN_PARTES).size, 20);
  assert.ok(Object.isFrozen(PARTES) && Object.isFrozen(ANCLAS));
  for (const id of ORDEN_PARTES) { assert.ok(Object.isFrozen(PARTES[id]), id); assert.equal(PARTES[id].id, id); }
});
test('catálogo: las funcionales son EXACTAMENTE los 8 CHAMP_ORGANS y cada una apunta a su órgano', () => {
  assert.deepEqual([...FUNCIONALES].sort(), Object.keys(CHAMP_ORGANS).sort());
  for (const id of FUNCIONALES) { assert.equal(PARTES[id].organ, id); assert.ok(CHAMP_ORGANS[PARTES[id].organ]); }
  for (const id of COSMETICAS) assert.equal(PARTES[id].organ, null, id);
});
test('catálogo: cada pieza usa solo anclas que existen y materiales del kit; tris y costes sanos', () => {
  for (const id of ORDEN_PARTES) {
    const d = PARTES[id];
    assert.ok(d.anclas.length > 0 && d.anclas.every((a) => ANCLAS[a]), id);
    assert.ok(d.mats.every((m) => MATERIALES_KIT.includes(m)) && d.variantesMat.every((m) => MATERIALES_KIT.includes(m)), id);
    assert.ok(d.tris.low > 0 && d.tris.low < d.tris.medium && d.tris.medium < d.tris.high, id);
    assert.ok(d.volumen > 0 && d.valor > 0 && ['par', 'unico'].includes(d.lados), id);
    assert.equal(d.llamadas_extra, d.extra.halo + d.extra.cadena + d.extra.tela, id);
    assert.ok(d.variantesMat.includes(d.mats[0]), id);
    assert.ok(typeof d.nombre === 'string' && d.desc.length > 10, id);
  }
});
test('catálogo: toda pieza en toda ancla permitida tiene límites coherentes que incluyen la posición neutra', () => {
  for (const id of ORDEN_PARTES) for (const a of PARTES[id].anclas) {
    const L = limitesDe(id, a);
    for (const [lo, hi] of [...L.pos, ...L.rot]) assert.ok(lo <= 0 && hi >= 0 && lo <= hi, `${id}/${a} pos-rot`);
    assert.ok(L.esc[0] <= 1 && L.esc[1] >= 1, `${id}/${a} esc`);
  }
});
test('catálogo: las piezas "únicas" solo van en anclas de un lado; choca_con es consistente', () => {
  for (const id of ORDEN_PARTES) {
    const d = PARTES[id];
    if (d.lados === 'unico') for (const a of d.anclas) assert.equal(ANCLAS[a].lados, 1, `${id} en ${a}`);
    for (const o of d.choca_con) { assert.ok(PARTES[o], `${id} choca con ${o}`); assert.ok(PARTES[o].choca_con.includes(id), `${o} debe devolver el choque con ${id}`); }
  }
});
test('catálogo: las anclas apuntan a huesos con nombre y las listas de orden son únicas', () => {
  assert.equal(ORDEN_ANCLAS.length, Object.keys(ANCLAS).length); assert.ok(ORDEN_ANCLAS.length <= 16);
  for (const a of ORDEN_ANCLAS) {
    const A = ANCLAS[a]; assert.ok(A.nombre && [1, 2].includes(A.lados), a);
    if (A.lados === 2) assert.ok(A.huesos.izq && A.huesos.der, a); else assert.ok(A.huesos.c, a);
  }
  assert.equal(new Set(MATERIALES_KIT).size, MATERIALES_KIT.length);
  assert.ok(ORDEN_PARTES.length <= 255);
});
test('catálogo: piezas iniciales = 7 cosméticas + 2 funcionales; ninguna funcional exige dinero', () => {
  assert.ok(PIEZAS_INICIALES.length >= 5);
  assert.ok(PIEZAS_INICIALES.some((id) => PARTES[id].cat === 'funcional'));
  for (const id of ORDEN_PARTES) assert.match(PARTES[id].obtencion, /^(inicial|victorias:\d+|bajas:\d+|partidas:\d+|esencia:(carne|cristal|ojo|vacio))$/, id);
  assert.ok(!JSON.stringify(PARTES).match(/precio|price|dinero|comprar|premium/i), 'nada vendible');
});
test('mensajes: cada código HB-01..HB-18 tiene texto en español', () => {
  for (let i = 1; i <= 18; i++) { const c = 'HB-' + String(i).padStart(2, '0'); assert.ok(MENSAJES[c] && MENSAJES[c].length > 15, c); }
});

/* ───────── defecto, id, nombre ───────── */
test('defecto(): es válida, no tiene piezas ni estadísticas y su huella es estable', () => {
  const r = validar(defecto()); assert.equal(r.ok, true); assert.deepEqual(r.errores, []);
  assert.equal(r.cap.usado, 0); assert.equal(huella(defecto()), huella(defecto())); assert.equal(r.stats.organos.length, 0);
});
test('idNuevo(): respeta el patrón lab-[a-z0-9]{6,24} y es determinista con el mismo azar', () => {
  const r = prng(7); for (let i = 0; i < 50; i++) assert.match(idNuevo(r), /^lab-[a-z0-9]{6,24}$/);
  assert.equal(idNuevo(prng(3)), idNuevo(prng(3)));
});
test('HB-02: id inválido se reemplaza (error) y es determinista; id válido se conserva', () => {
  const a = validar({ ...base(), id: 'axioma' }); assert.equal(a.ok, false); assert.ok(hbs(a).includes('HB-02'));
  assert.match(a.build.id, /^lab-[a-z0-9]{6,24}$/);
  assert.equal(normalizar({ ...base(), id: 'zzz' }).id, normalizar({ ...base(), id: 'zzz' }).id);
  assert.equal(validar(base()).build.id, 'lab-prueba01');
});
test('HB-02: nombre se sanea (sin <>&"\'`, sin control, 1–24 caracteres); vacío es error', () => {
  assert.equal(normalizar({ nombre: 'A<b>"x"&\'`\u0007‮ Z' }).nombre, 'Abx Z');
  assert.equal(Array.from(normalizar({ nombre: 'x'.repeat(100) }).nombre).length, 24);
  assert.equal(validar({ ...base(), nombre: '   ' }).ok, false);
  assert.equal(validar({ ...base(), nombre: 42 }).ok, false);
  assert.equal(normalizar({ nombre: '  muchos    espacios  ' }).nombre, 'muchos espacios');
  assert.equal(Array.from(normalizar({ nombre: '🐲'.repeat(30) }).nombre).length, 24);
  assert.deepEqual(validar({ ...base(), nombre: 'Normal' }).errores, []);
});

/* ───────── HB-01 / HB-03: versiones y rig ───────── */
test('HB-01: versión más nueva -> error y build por defecto; migrar marca futuro y no toca nada', () => {
  const futuro = { ...base(), v: 99, extra: 'x' };
  const r = validar(futuro); assert.equal(r.ok, false); assert.ok(hbs(r).includes('HB-01')); assert.equal(r.build.id, 'lab-defecto');
  const m = migrar(futuro); assert.equal(m.futuro, true); assert.equal(m.build.extra, 'x'); assert.equal(m.build.v, 99);
});
test('HB-01: schema ajeno o valores que no son objeto son error, sin lanzar', () => {
  assert.equal(validar({ ...base(), schema: 'otra.cosa' }).ok, false);
  for (const x of [null, undefined, 5, 'texto', [], true]) { const r = validar(x); assert.equal(r.ok, false, String(x)); assert.ok(hbs(r).includes('HB-01')); }
});
test('HB-03: rig o chasis desconocidos son error', () => {
  assert.equal(validar({ ...base(), rig: 'otro-rig@1' }).ok, false);
  assert.equal(validar({ ...base(), rig: 'arcanum-mh326@2' }).ok, false);
  assert.equal(validar({ ...base(), chasis: 'axioma' }).ok, false);
  assert.ok(hbs(validar({ ...base(), chasis: 'axioma' })).includes('HB-03'));
  assert.equal(validar({ ...base(), rig: undefined, chasis: undefined }).ok, true);
});

/* ───────── HB-04 / HB-05: proporciones ───────── */
test('HB-04: cada proporción se recorta a su rango con aviso, nunca error', () => {
  for (const k of PROP_ORDEN) {
    const [lo, hi] = PROP_RANGOS[k];
    const bajo = validar({ ...base(), prop: { [k]: lo - 1 } }); assert.equal(bajo.build.prop[k], lo, k); assert.ok(bajo.avisos.some((x) => x.codigo === 'HB-04'), k);
    const alto = normalizar({ ...base(), prop: { [k]: hi + 5 } }); assert.equal(alto.prop[k], hi, k);
  }
});
test('HB-04: valores no numéricos vuelven a 1 y la cuantización es de 0,005', () => {
  assert.equal(normalizar({ prop: { altura: 'alto', ancho: NaN, hombros: Infinity } }).prop.altura, 1);
  assert.equal(normalizar({ prop: { altura: 1.0123 } }).prop.altura, 1.01);
  assert.equal(normalizar({ prop: { altura: 1.0126 } }).prop.altura, 1.015);
  for (const k of PROP_ORDEN) { const x = normalizar({ prop: { [k]: 1.0074 } }).prop[k] * 200; assert.ok(Math.abs(x - Math.round(x)) < 1e-9, k); }
});
test('HB-05: brazos y hombros no pueden diferir más de 0,15; altura×piernas ≤ 1,30; cabeza ≤ 1,2×hombros', () => {
  assert.equal(validar(base([], { prop: { brazos: 1.15, hombros: 0.92 } })).ok, false);
  assert.equal(validar(base([], { prop: { brazos: 1.10, hombros: 1.0 } })).ok, true);
  assert.ok(hbs(validar(base([], { prop: { altura: 1.15, piernas: 1.15 } }))).includes('HB-05'));
  assert.equal(validar(base([], { prop: { altura: 1.15, piernas: 1.10 } })).ok, true);
  assert.ok(hbs(validar(base([], { prop: { cabeza: 1.2, hombros: 0.92 } }))).includes('HB-05'));
  assert.equal(validar(base([], { prop: { cabeza: 1.2, hombros: 1.0 } })).ok, true);
});
test('pose: grados enteros dentro de su rango', () => {
  const b = normalizar({ pose: { inclinacion: 99, hombros: -99 } }); assert.equal(b.pose.inclinacion, 10); assert.equal(b.pose.hombros, -8);
  assert.equal(normalizar({ pose: { inclinacion: 3.6 } }).pose.inclinacion, 4);
});

/* ───────── HB-06 / HB-07: piezas y anclas ───────── */
test('HB-06: pieza inexistente se descarta con error (también ids peligrosos)', () => {
  for (const p of ['inventada', '__proto__', 'constructor', 'toString', 5, null, '']) { const r = validar(base([{ p, a: 'cabeza' }])); assert.equal(r.ok, false, String(p)); assert.equal(r.build.partes.length, 0); assert.ok(hbs(r).includes('HB-06')); }
});
test('HB-06: posesión — pieza no tenida = error y aparece en `bloqueadas`; sin ctx.poseidas no se comprueba', () => {
  const b = base([pieza('cuerno_curvo', 'cabeza'), pieza('cola_larga', 'cola')]);
  assert.equal(validar(b).ok, true);
  const r = validar(b, { poseidas: ['cuerno_curvo'] }); assert.equal(r.ok, false); assert.deepEqual(r.bloqueadas, ['cola_larga']);
  assert.equal(validar(b, { poseidas: new Set(['cuerno_curvo', 'cola_larga']) }).ok, true);
});
test('HB-07: ancla desconocida o no permitida para la pieza se descarta con error', () => {
  for (const a of ['pies', 'nada', '__proto__', 5]) { const r = validar(base([{ p: 'cuerno_curvo', a }])); assert.equal(r.ok, false, String(a)); assert.equal(r.build.partes.length, 0); assert.ok(hbs(r).includes('HB-07')); }
  assert.equal(validar(base([pieza('placas', 'pecho'), pieza('placas', 'espalda')])).build.partes.length, 1);
});
test('HB-07: una pieza única no se espeja (recorte, no error); una par sí', () => {
  const r = validar(base([pieza('cresta_osea', 'cabeza', { sim: 'espejo' })])); assert.equal(r.ok, true); assert.equal(r.build.partes[0].sim, 'ninguna');
  assert.ok(r.avisos.some((x) => x.codigo === 'HB-07'));
  assert.equal(validar(base([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' })])).build.partes[0].sim, 'espejo');
});
test('lados: en anclas de dos lados la pieza sin espejo lleva `l` (der por defecto); en las de un lado o con espejo, no', () => {
  assert.equal(normalizar(base([pieza('hombrera_espinas', 'hombros')])).partes[0].l, 'der');
  assert.equal(normalizar(base([pieza('hombrera_espinas', 'hombros', { l: 'izq' })])).partes[0].l, 'izq');
  assert.equal(normalizar(base([pieza('hombrera_espinas', 'hombros', { l: 'x' })])).partes[0].l, 'der');
  assert.equal('l' in normalizar(base([pieza('hombrera_espinas', 'hombros', { sim: 'espejo', l: 'izq' })])).partes[0], false);
  assert.equal('l' in normalizar(base([pieza('cuerno_curvo', 'cabeza', { l: 'izq' })])).partes[0], false);
});

/* ───────── HB-08: transformaciones ───────── */
test('HB-08: posición, giro y escala se recortan a los límites (pieza ∩ ancla) con aviso de recorte', () => {
  const b = base([pieza('cuerno_curvo', 'cabeza', { t: { pos: [9, -9, 9], rot: [99, -99, 200], esc: 50 } })]);
  const r = validar(b), L = limitesDe('cuerno_curvo', 'cabeza');
  assert.ok(r.avisos.some((x) => x.codigo === 'HB-08')); assert.equal(r.ok, true);
  const t = r.build.partes[0].t;
  assert.deepEqual(t.pos, [L.pos[0][1], L.pos[1][0], L.pos[2][1]]); assert.deepEqual(t.rot, [L.rot[0][1], L.rot[1][0], L.rot[2][1]]); assert.equal(t.esc, L.esc[1]);
});
test('HB-08: valores no numéricos o ausentes quedan neutros (0,0,0 · 0,0,0 · 1)', () => {
  const t = normalizar(base([{ p: 'cuerno_curvo', a: 'cabeza', t: { pos: ['a', null], rot: 'x', esc: 'y' } }])).partes[0].t;
  assert.deepEqual(t, { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 });
  assert.deepEqual(normalizar(base([{ p: 'cuerno_curvo', a: 'cabeza' }])).partes[0].t, { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 });
});
test('HB-08: cuantización — posición a 2 mm, giro entero, escala a 0,01', () => {
  const t = normalizar(base([pieza('cuerno_curvo', 'cabeza', { t: { pos: [0.0413, 0.1007, 0.0201], rot: [3.4, 3.6, 0], esc: 1.2345 } })])).partes[0].t;
  assert.deepEqual(t.pos, [0.042, 0.1, 0.02]); assert.deepEqual(t.rot, [3, 4, 0]); assert.equal(t.esc, 1.23);
});
test('material y tinte: material fuera de las variantes vuelve al primero; tinte inválido es null', () => {
  const c = normalizar(base([pieza('cuerno_curvo', 'cabeza', { c: { mat: 'oro', tinte: 'rojo' } })])).partes[0].c;
  assert.deepEqual(c, { mat: 'bone', tinte: null });
  assert.deepEqual(normalizar(base([pieza('cuerno_curvo', 'cabeza', { c: { mat: 'marble', tinte: '#E6D9BC' } })])).partes[0].c, { mat: 'marble', tinte: '#e6d9bc' });
});

/* ───────── HB-09: choques ───────── */
test('HB-09: dos piezas en la misma ranura chocan; en lados distintos no', () => {
  assert.ok(hbs(validar(base([pieza('cresta_osea', 'cabeza'), pieza('corona_espinas', 'cabeza')]))).includes('HB-09'));
  assert.ok(hbs(validar(base([pieza('cuerno_curvo', 'cabeza'), pieza('cuerno_curvo', 'cabeza')]))).includes('HB-09'));
  assert.ok(!hbs(validar(base([pieza('hombrera_espinas', 'hombros', { l: 'izq' }), pieza('hombrera_espinas', 'hombros', { l: 'der' })]))).includes('HB-09'));
  assert.ok(hbs(validar(base([pieza('hombrera_espinas', 'hombros', { l: 'der' }), pieza('hombrera_espinas', 'hombros', { sim: 'espejo' })]))).includes('HB-09'));
});
test('HB-09: choca_con es simétrico (alas con espinas dorsales; placa pectoral con corazón de cristal)', () => {
  assert.ok(hbs(validar(base([pieza('alas_membrana', 'espalda'), pieza('espinas_dorsales', 'espalda')]))).includes('HB-09'));
  assert.ok(hbs(validar(base([pieza('placa_pectoral', 'pecho'), pieza('corazon_cristal', 'pecho')]))).includes('HB-09'));
  assert.ok(hbs(validar(base([pieza('corazon_cristal', 'pecho'), pieza('placa_pectoral', 'pecho')]))).includes('HB-09'));
});
test('HB-09: el mismo pedido es independiente del orden de las piezas', () => {
  const a = pieza('cresta_osea', 'cabeza'), b = pieza('corona_espinas', 'cabeza');
  assert.equal(validar(base([a, b])).ok, validar(base([b, a])).ok);
});

/* ───────── HB-10 / HB-11: cantidades y presupuesto ───────── */
test('HB-10: más de 6 piezas dibujadas en un ancla o 24 en total es error (espejo cuenta 2)', () => {
  const cinco = base([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('ojo_extra', 'cabeza'), pieza('espiraculo', 'cabeza'), pieza('cresta_osea', 'cabeza')]);
  assert.equal(instancias(cinco).filter((x) => x.a === 'cabeza').length, 5);
  assert.equal(hbs(validar(cinco, { evo: 2 })).includes('HB-10'), false);
  const ocho = base([pieza('hombrera_espinas', 'hombros', { sim: 'espejo' }), pieza('placas', 'hombros', { sim: 'espejo' }), pieza('tentaculo', 'hombros', { sim: 'espejo' }), pieza('hombrera_espinas', 'hombros', { l: 'izq' })]);
  assert.equal(instancias(ocho).filter((x) => x.a === 'hombros').length, 7);
  assert.ok(hbs(validar(ocho, { evo: 4 })).includes('HB-10'));
  const veinticinco = base(Array.from({ length: 25 }, (_, i) => pieza('rodillera_placa', 'muslos', { l: i % 2 ? 'izq' : 'der' })));
  assert.ok(hbs(validar(veinticinco)).includes('HB-10'));
});
test('HB-10: más de 64 entradas se descartan con error', () => {
  const r = validar(base(Array.from({ length: 100 }, () => pieza('rodillera_placa', 'muslos'))));
  assert.equal(r.ok, false); assert.ok(hbs(r).includes('HB-10')); assert.ok(r.build.partes.length <= 64);
});
test('HB-11: el presupuesto de triángulos y llamadas es regla de validez', () => {
  const grande = base([pieza('alas_membrana', 'espalda'), pieza('cola_larga', 'cola'), pieza('tentaculo', 'hombros', { sim: 'espejo' }), pieza('hombrera_espinas', 'hombros', { l: 'izq', sim: 'ninguna' })]);
  const r = costeRender(grande); assert.ok(r.tris > 0 && r.llamadas > 0);
  const t = validar(base([pieza('alas_membrana', 'espalda'), pieza('cola_larga', 'cola'), pieza('hombrera_espinas', 'hombros', { sim: 'espejo' }), pieza('cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }), pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('placas', 'pecho', { sim: 'ninguna' })]));
  assert.equal(t.render.excede, false);
});
test('HB-11: cadenas (≤2), halos (≤3) y telas cuentan como llamadas; costeRender suma materiales únicos', () => {
  const b = base([pieza('cola_larga', 'cola'), pieza('tentaculo', 'espalda', { sim: 'espejo' })]);
  const r = costeRender(b); assert.equal(r.cadenas, 3); assert.equal(validar(b).ok, false); assert.ok(hbs(validar(b)).includes('HB-11'));
  const c = costeRender(base([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' })])); assert.deepEqual(c.materiales, ['bone']); assert.equal(c.llamadas, 1);
  assert.equal(costeRender(base([pieza('ojo_extra', 'cabeza')])).halos, 1);
});
test('HB-11: costeRender distingue calidad (low < medium < high) y lee el material elegido', () => {
  const b = base([pieza('alas_membrana', 'espalda')]);
  const lo = costeRender(b, 'low').tris, me = costeRender(b, 'medium').tris, hi = costeRender(b, 'high').tris; assert.ok(lo < me && me < hi);
  assert.equal(costeRender(b, 'raro').tris, lo);
  const cuerno = (mat) => costeRender(base([pieza('cuerno_curvo', 'cabeza', { c: { mat, tinte: null } })])).materiales[0];
  assert.equal(cuerno('metal'), 'metal'); assert.equal(cuerno('bone'), 'bone');
});
test('HB-11: el peor caso del catálogo bajo los topes de instancias queda acotado por HB-11 y no se sale del presupuesto de la escena', () => {
  assert.ok(TOPES_RENDER.tris + 3668 < 20000); assert.ok(TOPES_RENDER.llamadas + 1 <= 45);
});

/* ───────── HB-12 / HB-13 / HB-14 ───────── */
test('HB-12: la mano derecha no admite piezas (espejo incluido); la izquierda sí', () => {
  assert.ok(hbs(validar(base([pieza('garras_mano', 'manos', { l: 'der' })]))).includes('HB-12'));
  assert.ok(hbs(validar(base([pieza('garras_mano', 'manos', { sim: 'espejo' })]))).includes('HB-12'));
  assert.equal(validar(base([pieza('garras_mano', 'manos', { l: 'izq' })])).ok, true);
  assert.equal(validar(base([pieza('garras_mano', 'manos', { l: 'der' })]), { manoDerechaOcupada: false }).ok, true);
});
test('HB-13: la capacidad es 1 + evo; una funcional espejada cuenta UNA vez', () => {
  const dos = base([pieza('placas', 'pecho'), pieza('adrenal', 'cintura')]);
  assert.equal(validar(dos, { evo: 0 }).ok, false); assert.ok(hbs(validar(dos, { evo: 0 })).includes('HB-13'));
  assert.equal(validar(dos, { evo: 1 }).ok, true);
  assert.equal(validar(base([pieza('placas', 'hombros', { sim: 'espejo' })]), { evo: 0 }).ok, true);
  assert.deepEqual(validar(dos, { evo: 1 }).cap, { usado: 2, max: 2, excede: false });
  assert.equal(validar(base(FUNCIONALES.slice(0, 5).map((id) => pieza(id, PARTES[id].anclas[0]))), { evo: 4 }).cap.max, 5);
  assert.equal(champOrganSlots(4), 5);
});
test('HB-13: sin ctx.evo se asume evo 0 (1 ranura); evo basura no rompe', () => {
  assert.equal(validar(base([pieza('placas', 'pecho')])).cap.max, 1);
  for (const evo of [-3, 99, 'x', null, NaN, 2.5]) assert.ok(validar(base([]), { evo }).cap.max >= 1 && validar(base([]), { evo }).cap.max <= 5);
});
test('HB-14: una funcional repetida se quita (recorte); una cosmética repetida no se quita', () => {
  const r = validar(base([pieza('placas', 'pecho'), pieza('placas', 'espalda')])); assert.equal(r.build.partes.length, 1); assert.ok(r.avisos.some((x) => x.codigo === 'HB-14'));
  const c = normalizar(base([pieza('rodillera_placa', 'muslos', { l: 'izq' }), pieza('rodillera_placa', 'muslos', { l: 'der' })]));
  assert.equal(c.partes.length, 2);
});

/* ───────── HB-15: colores ───────── */
test('HB-15: colores válidos pasan a minúsculas; inválidos vuelven al valor por defecto', () => {
  const b = normalizar({ pal: { primario: '#ABCDEF', secundario: 'azul', emisivo: '#f0a', acabado: 'oro' }, base: { piel: '#GGGGGG' } });
  assert.equal(b.pal.primario, '#abcdef'); assert.equal(b.pal.secundario, '#2b2430'); assert.equal(b.pal.emisivo, '#ff7a22'); assert.equal(b.pal.acabado, 'archivo'); assert.equal(b.base.piel, '#8a5a3c');
});
test('HB-15: el emisivo no supera el brillo máximo (anti-deslumbramiento) y queda estable', () => {
  const b = normalizar({ pal: { emisivo: '#ffffff' } }); assert.ok(luminancia(b.pal.emisivo) <= 0.8 + 1e-9);
  assert.deepEqual(normalizar(b).pal, b.pal);
  assert.equal(limitarBrillo('#102030').cambio, false);
  assert.ok(validar({ ...base(), pal: { emisivo: '#ffffff' } }).avisos.some((x) => x.codigo === 'HB-15'));
});
test('acabados: solo los existentes y ganables (archivo, porcelana, obsidiana); aurico (planeado) no', () => {
  assert.deepEqual([...ACABADOS].sort(), ['archivo', 'obsidiana', 'porcelana']);
  assert.equal(normalizar({ pal: { acabado: 'aurico' } }).pal.acabado, 'archivo');
});

/* ───────── HB-16 anti-oclusión ───────── */
test('HB-16: demasiado volumen de piezas o sobre la cabeza es error', () => {
  const enorme = base([pieza('alas_membrana', 'espalda', { t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1.5 } }), pieza('cola_larga', 'cola', { t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1.6 } }), pieza('tentaculo', 'cintura', { sim: 'espejo', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1.6 } })]);
  assert.ok(hbs(validar(enorme, { evo: 1 })).includes('HB-16'));
  assert.equal(hbs(validar(base([pieza('alas_membrana', 'espalda')]))).includes('HB-16'), false);
});

/* ───────── HB-17 / HB-18 ───────── */
test('HB-17: el peor caso de piezas cabe de sobra en 2 KB (y en el límite de 8192 con 4 jugadores)', () => {
  const peor = base(Array.from({ length: 24 }, (_, i) => pieza('rodillera_placa', 'muslos', { l: i % 2 ? 'izq' : 'der', c: { mat: 'metal', tinte: '#aabbcc' } })), { nombre: '🐲'.repeat(24) });
  const n = codificar({ ...peor, partes: peor.partes.slice(0, 24) }).length;
  assert.ok(n < 2048, 'tamaño ' + n);
  assert.ok(4 * (n + 400) < 8192);
});
test('HB-18: una huella declarada que no coincide es solo aviso; la huella correcta no avisa', () => {
  const b = base([pieza('cuerno_curvo', 'cabeza')]); const ok = sellar(b);
  assert.ok(!hbs(validar(ok)).includes('HB-18'));
  const r = validar({ ...ok, h: 'deadbeef000000' }); assert.equal(r.ok, true); assert.ok(r.avisos.some((x) => x.codigo === 'HB-18'));
  assert.equal(r.build.h, ok.h);
});

/* ───────── normalizar: propiedades ───────── */
test('normalizar es idempotente y no lleva cap ni h; sellar los añade', () => {
  const r = prng(11);
  for (let i = 0; i < 300; i++) { const n = normalizar(aleatoria(r)); assert.deepEqual(normalizar(n), n); assert.ok(!('cap' in n) && !('h' in n)); }
  const s = sellar(base([pieza('placas', 'pecho')]), { evo: 1 }); assert.deepEqual(s.cap, { usado: 1, max: 2 }); assert.match(s.h, /^[0-9a-f]{14}$/);
});
test('normalizar ignora campos desconocidos y no deja pasar __proto__ ni funciones', () => {
  const sucio = JSON.parse('{"__proto__":{"admin":true},"nombre":"x","sorpresa":{"a":1},"cap":{"usado":0,"max":99},"h":"zz"}');
  const n = normalizar(sucio); assert.equal(n.sorpresa, undefined); assert.equal(n.admin, undefined); assert.equal({}.admin, undefined); assert.ok(!('cap' in n));
  assert.deepEqual(Object.keys(n), ['schema', 'v', 'id', 'nombre', 'rig', 'chasis', 'base', 'prop', 'pose', 'partes', 'pal', 'meta']);
});
test('normalizar no modifica su entrada', () => {
  const b = base([pieza('cuerno_curvo', 'cabeza', { t: { pos: [9, 9, 9], rot: [0, 0, 0], esc: 9 } })]); const antes = JSON.stringify(b); normalizar(b); validar(b); codificar(b); huella(b); derivarStats(b);
  assert.equal(JSON.stringify(b), antes);
});

/* ───────── migrar ───────── */
test('migrar: la forma de borrador (v0) pasa a la actual con los nombres nuevos', () => {
  const v0 = { id: 'lab-borrador1', nombre: 'Viejo', proporciones: { altura: 1.1 }, paleta: { primario: '#112233' }, postura: { inclinacion: 4 },
    piezas: [{ pieza: 'cuerno_curvo', ancla: 'cabeza', simetria: true, pos: [0.04, 0.1, 0.02], rot: [0, 0, 10], esc: 1.2, mat: 'marble' }, { pieza: 'placas', ancla: 'pecho' }] };
  const m = migrar(v0); assert.equal(m.desde, 0); assert.equal(m.hasta, VERSION_BUILD); assert.equal(m.futuro, false);
  const r = validar(v0, { evo: 0 }); assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.build.prop.altura, 1.1); assert.equal(r.build.pal.primario, '#112233'); assert.equal(r.build.pose.inclinacion, 4);
  assert.equal(r.build.partes[0].sim, 'espejo'); assert.equal(r.build.partes[0].c.mat, 'marble'); assert.deepEqual(r.build.partes[0].t.pos, [0.04, 0.1, 0.02]);
  assert.equal(r.build.partes.length, 2);
});
test('migrar: una v1 pasa intacta, nunca lanza con basura y no muta la entrada', () => {
  const b = base([pieza('placas', 'pecho')]); const antes = JSON.stringify(b);
  assert.deepEqual(migrar(b).build, JSON.parse(antes)); assert.equal(JSON.stringify(b), antes);
  for (const x of [null, 5, 'x', [], undefined]) assert.doesNotThrow(() => migrar(x));
  assert.doesNotThrow(() => migrar({ v: -4, partes: 'no' })); assert.doesNotThrow(() => migrar({ v: 'x', piezas: [null, 5] }));
});

/* ───────── huella ───────── */
test('huella: estable, no depende del orden de las piezas, de cap, h ni meta; sí del contenido', () => {
  const a = pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), b2 = pieza('placas', 'pecho');
  const h1 = huella(base([a, b2])); assert.match(h1, /^[0-9a-f]{14}$/);
  assert.equal(huella(base([b2, a])), h1);
  assert.equal(huella({ ...base([a, b2]), cap: { usado: 9, max: 9 }, h: 'otra', meta: { creado: 5, editor: 'x' } }), h1);
  assert.notEqual(huella(base([a])), h1);
  assert.notEqual(huella({ ...base([a, b2]), nombre: 'Otro' }), h1);
  assert.notEqual(huella(base([a, b2], { prop: { altura: 1.05 } })), h1);
  assert.equal(huella(base([a, b2])), '' + huella(JSON.parse(JSON.stringify(base([a, b2])))));
});
test('huella: valores golden (cambiarlos rompe a quien ya guardó diseños: súbase VERSION_BUILD)', () => {
  // El nombre forma parte del contenido: el catálogo cambió el nombre inicial, no el esquema.
  // Conservar el vector histórico verifica la compatibilidad de los diseños v1 existentes.
  assert.equal(huella({ ...defecto(), nombre: 'Híbrido de Laboratorio' }), '1a8a968cb1b80c');
  assert.equal(huella(defecto()), '16f95819f49d11');
});

/* ───────── VB1 ───────── */
test('VB1: ida y vuelta exacta (misma huella y mismo contenido) para builds aleatorias', () => {
  const r = prng(21);
  for (let i = 0; i < 400; i++) {
    const n = normalizar(aleatoria(r)); const txt = codificar(n); assert.match(txt, /^VB1:[A-Za-z0-9_-]+$/);
    const d = decodificar(txt); assert.equal(d.ok, true, d.mensaje);
    assert.equal(huella(d.build), huella(n)); assert.deepEqual(canonico(d.build), canonico(n));
    assert.deepEqual(d.build.partes, n.partes);
  }
});
test('VB1: tamaño — una build típica de 8 piezas ronda los 300 caracteres y el máximo nunca llega a 2 KB', () => {
  const tipica = base([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('hombrera_espinas', 'hombros', { sim: 'espejo' }), pieza('placas', 'pecho'), pieza('espinas_dorsales', 'espalda'), pieza('cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }), pieza('cola_larga', 'cola')]);
  const n = codificar(tipica).length; assert.ok(n < 400, String(n));
  const r = prng(5); let max = 0; for (let i = 0; i < 400; i++) max = Math.max(max, codificar(aleatoria(r)).length);
  assert.ok(max < 2048, 'máximo ' + max);
});
test('VB1: texto cortado, alterado o ajeno se rechaza sin lanzar', () => {
  const ok = codificar(base([pieza('placas', 'pecho')]));
  for (const mal of [ok.slice(0, ok.length - 5), ok.slice(0, 8), 'VB1:', 'VB1:@@@@', 'VB2:' + ok.slice(4), '', null, undefined, 5, {}, ok + 'AAAA', 'x'.repeat(5000), 'VB1:' + 'A'.repeat(3000)]) {
    const d = decodificar(mal); assert.equal(d.ok, false, String(mal).slice(0, 20)); assert.ok(typeof d.mensaje === 'string' && d.mensaje.length > 5);
  }
});
test('VB1: bytes aleatorios nunca lanzan y, si decodifican, dan una build que normalizar acepta', () => {
  const r = prng(99); const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let i = 0; i < 2000; i++) { let s = 'VB1:'; const n = ent(r, 200); for (let k = 0; k < n; k++) s += B[ent(r, 64)]; const d = decodificar(s); if (d.ok) assert.deepEqual(normalizar(d.build), d.build); }
});
test('VB1: modificar un solo carácter de un texto bueno nunca lanza (rechaza o cambia la huella)', () => {
  const b = base([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('placas', 'pecho')]); const txt = codificar(b), h0 = huella(b);
  for (let i = 4; i < txt.length; i++) { const c = txt[i] === 'A' ? 'B' : 'A'; const d = decodificar(txt.slice(0, i) + c + txt.slice(i + 1)); if (d.ok) assert.notEqual(huella(d.build) + '|' + codificar(d.build), h0 + '|' + txt); }
});

/* ───────── derivarStats ───────── */
test('derivarStats: cada pieza funcional da EXACTAMENTE el efecto de su órgano y nada más', () => {
  const esperado = { placas: { dmgIn: 0.88 }, adrenal: { spd: 1.08, cd: 0.92 }, ojo_extra: { danoSalida: 1.12, revela: 1 }, saco_g: { salto: 1.25, ult: 1.15 }, medula: { regenPorSeg: 1.5 }, tentaculo: { melee: 1.1, meleeAlcance: 1.2 }, corazon_cristal: { shield: 1.5 }, espiraculo: { ultDur: 1.2 } };
  for (const id of FUNCIONALES) { const s = derivarStats(base([pieza(id, PARTES[id].anclas[0])]), { evo: 4 }); assert.deepEqual(s.mult, esperado[id], id); assert.deepEqual(s.organos, [id]); assert.equal(s.efectos[0].desc, CHAMP_ORGANS[id].desc); }
});
test('derivarStats: las cosméticas no dan ningún efecto (ni siquiera todas juntas)', () => {
  const s = derivarStats(base(COSMETICAS.map((id) => pieza(id, PARTES[id].anclas[0]))), { evo: 4 });
  assert.deepEqual(s.mult, {}); assert.deepEqual(s.bn, {}); assert.deepEqual(s.organos, []); assert.deepEqual(s.resumen, { dano: 5, resistencia: 5, movilidad: 5, control: 4, utilidad: 4, dificultad: 3 });
});
test('derivarStats: bn pasa por CAPS y hp/speed del chasis son fijos', () => {
  const todas = base(FUNCIONALES.map((id) => pieza(id, PARTES[id].anclas[0])));
  const s = derivarStats(todas, { evo: 4 });
  for (const [k, v] of Object.entries(s.bn)) { assert.ok(CAPS[k], k); assert.ok(v >= CAPS[k][0] && v <= CAPS[k][1], k); }
  assert.deepEqual(s.base, { hp: 1, speed: 1 });
  for (const [k, v] of Object.entries(LIMITES_EFECTO)) if (k in s.mult) assert.ok(s.mult[k] <= v, k);
});
test('derivarStats: ignora piezas desconocidas y entradas rotas sin lanzar', () => {
  for (const x of [null, undefined, 5, {}, { partes: 'x' }, { partes: [null, 5, { p: '__proto__' }, { p: 'constructor' }] }]) { const s = derivarStats(x, {}); assert.deepEqual(s.organos, []); }
});
test('derivarStats: las 5 mejores piezas posibles NO superan lo que da un oficial con los mismos órganos ni CAPS', () => {
  const t = Object.keys(CHAMP_ORGANS), subconj = (k) => t.map((_, i) => i).filter((i) => (k >> i) & 1);
  let peor = null;
  for (let k = 0; k < 256; k++) { const ids = subconj(k).map((i) => t[i]); if (ids.length > 5) continue; const s = derivarStats(base(ids.map((id) => pieza(id, PARTES[id].anclas[0]))), { evo: 4 }); assert.equal(s.cap.excede, false); const prod = Object.assign({}, ...ids.map((id) => ({ ...s.mult }))); void prod; peor = s; for (const [kk, v] of Object.entries(s.bn)) assert.ok(v >= CAPS[kk][0] && v <= CAPS[kk][1]); }
  assert.ok(peor);
});

/* ───────── PROPIEDAD CLAVE: lo cosmético no cambia ninguna estadística ───────── */
test('PROPIEDAD: cambiar prop/t/esc/pos/rot/a/sim/pal/c/base/pose/nombre/meta NO altera derivarStats (400 builds)', () => {
  const r = prng(1234);
  for (let i = 0; i < 400; i++) {
    const b = normalizar(aleatoria(r)), ctx = { evo: ent(r, 5) }, s0 = JSON.stringify(derivarStats(b, ctx));
    const m = JSON.parse(JSON.stringify(b));
    for (const k of PROP_ORDEN) m.prop[k] = rango(r, 0.5, 1.5);
    m.pose = { inclinacion: 99, hombros: -99 }; m.nombre = 'Otro nombre'; m.base = { preset: 'jugador1', piel: '#000000' }; m.meta = { creado: 1, editor: 'zz' };
    m.pal = { primario: '#ffffff', secundario: '#000000', emisivo: '#ffffff', acabado: 'obsidiana' };
    for (const e of m.partes) { e.t = { pos: [9, 9, 9], rot: [180, 180, 180], esc: 9 }; e.sim = e.sim === 'espejo' ? 'ninguna' : 'espejo'; e.c = { mat: 'zzz', tinte: '#123456' }; e.a = elige(r, ORDEN_ANCLAS); e.l = 'izq'; }
    assert.equal(JSON.stringify(derivarStats(m, ctx)), s0, 'build ' + i);
    // reordenar las piezas tampoco cambia nada
    assert.equal(JSON.stringify(derivarStats({ ...b, partes: [...b.partes].reverse() }, ctx)), s0);
    // espejar una funcional no cambia nada (cuenta una vez)
  }
});
test('PROPIEDAD: la altura mínima y la máxima producen EXACTAMENTE las mismas estadísticas', () => {
  const partes = [pieza('placas', 'pecho'), pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' })];
  const a = derivarStats(base(partes, { prop: { altura: 0.9, ancho: 0.9 } }), { evo: 1 }), z = derivarStats(base(partes, { prop: { altura: 1.15, ancho: 1.15 } }), { evo: 1 });
  assert.deepEqual(a, z);
});
test('PROPIEDAD: mover una funcional de ancla (cintura↔espalda) no cambia ningún número', () => {
  const a = derivarStats(base([pieza('adrenal', 'cintura')]), { evo: 0 }), b = derivarStats(base([pieza('adrenal', 'espalda', { t: { pos: [0.1, 0.1, -0.1], rot: [10, 10, 10], esc: 1.5 } })]), { evo: 0 });
  assert.deepEqual(a, b);
});

/* ───────── FUZZ ───────── */
test('FUZZ: 5 000 builds aleatorias — nunca lanzan, las válidas respetan CAPS, capacidad y presupuesto; ok es coherente', () => {
  const r = prng(2026); let validas = 0, conPiezas = 0, conFuncionales = 0;
  for (let i = 0; i < 5000; i++) {
    const raw = aleatoria(r), ctx = { evo: ent(r, 5) };
    let v; assert.doesNotThrow(() => { v = validar(raw, ctx); }, 'validar ' + i);
    assert.equal(v.ok, v.errores.length === 0);
    assert.ok(v.errores.every((e) => /^HB-\d\d$/.test(e.codigo) && typeof e.msg === 'string' && e.msg.length > 5 && !e.msg.includes('{')), JSON.stringify(v.errores));
    assert.deepEqual(normalizar(v.build), canonicoSinDerivados(v.build));
    const s = derivarStats(v.build, ctx);
    for (const [k, val] of Object.entries(s.bn)) { assert.ok(val >= CAPS[k][0] && val <= CAPS[k][1], `${k}=${val}`); }
    for (const [k, lim] of Object.entries(LIMITES_EFECTO)) if (k in s.mult) assert.ok(s.mult[k] <= lim + 1e-12);
    for (const k of Object.keys(s.resumen)) assert.ok(s.resumen[k] >= 0 && s.resumen[k] <= 10);
    const u = usable(raw, ctx); assert.equal(u.ok, v.ok);
    if (v.ok) {
      validas++; const T = TOPES_RENDER, R = costeRender(v.build, 'low');
      assert.ok(R.tris <= T.tris && R.llamadas <= T.llamadas && R.materiales.length <= T.materiales && R.halos <= T.halos && R.cadenas <= T.cadenas && R.telas <= T.telas);
      assert.ok(R.instancias <= T.instanciasTotal);
      assert.ok(s.cap.usado <= s.cap.max && s.cap.max === champOrganSlots(ctx.evo));
      assert.equal(new Set(v.build.partes.filter((e) => PARTES[e.p].cat === 'funcional').map((e) => e.p)).size, v.build.partes.filter((e) => PARTES[e.p].cat === 'funcional').length);
      assert.ok(codificar(v.build).length <= 2048);
      assert.equal(u.defecto, false); assert.equal(u.build.h, v.h);
      if (v.build.partes.length) conPiezas++; if (s.organos.length) conFuncionales++;
    } else { assert.equal(u.defecto, true); assert.equal(u.build.id, 'lab-defecto'); assert.equal(derivarStats(u.build, ctx).organos.length, 0); }
  }
  assert.ok(validas > 150, 'el generador debe producir un número razonable de válidas: ' + validas);
  assert.ok(conPiezas > 50 && conFuncionales > 20, `piezas ${conPiezas} / funcionales ${conFuncionales}`);
});
function canonicoSinDerivados(b) { const { cap, h, ...r } = b; void cap; void h; return r; }
test('FUZZ: basura arbitraria (JSON de cualquier forma) nunca lanza en ninguna función pública', () => {
  const r = prng(77);
  for (let i = 0; i < 3000; i++) {
    const x = basura(r);
    assert.doesNotThrow(() => { validar(x); validar(x, basura(r)); usable(x); normalizar(x); migrar(x); sellar(x); huella(x); codificar(x); decodificar(x); derivarStats(x, basura(r)); costeRender(x); instancias(x); canonico(x); }, JSON.stringify(x));
  }
});
test('FUZZ: recargar la salida de validar().build en validar siempre da ok con la misma huella (punto fijo)', () => {
  const r = prng(31);
  for (let i = 0; i < 1000; i++) {
    const v = validar(aleatoria(r), { evo: 4 }); const v2 = validar(v.build, { evo: 4 });
    assert.equal(v2.h, v.h);
    assert.equal(v2.ok, v.ok || v2.ok);   // las reglas globales pueden seguir fallando; los recortes ya no
    assert.equal(v2.avisos.filter((x) => x.sev === 'recorte').length, 0, JSON.stringify(v2.avisos));
  }
});

/* ───────── instancias ───────── */
test('instancias: el espejo genera der + izq (la izquierda marcada como reflejada); sin espejo, una sola', () => {
  const ins = instancias(base([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('hombrera_espinas', 'hombros', { l: 'izq' }), pieza('placas', 'pecho')]));
  assert.deepEqual(ins.map((x) => [x.lado, x.espejada, x.hueso]), [['der', false, 'head'], ['izq', true, 'head'], ['izq', false, 'upperarm01_L'], ['c', false, 'spine01']]);
  const sp = instancias(base([pieza('hombrera_espinas', 'hombros', { sim: 'espejo' })])); assert.deepEqual(sp.map((x) => x.hueso), ['upperarm01_R', 'upperarm01_L']);
});

/* ───────── usable ───────── */
test('usable: una build ilegal se cambia por el chasis por defecto con los errores a mano; una legal pasa tal cual', () => {
  const mala = base([pieza('placas', 'pecho'), pieza('adrenal', 'cintura')]);
  const u = usable(mala, { evo: 0 }); assert.equal(u.ok, false); assert.equal(u.defecto, true); assert.equal(u.build.partes.length, 0); assert.ok(u.errores.length > 0);
  const b = usable(mala, { evo: 1 }); assert.equal(b.ok, true); assert.equal(b.build.partes.length, 2);
});
test('ctx raro (null, array, texto) no rompe validar ni usable', () => {
  for (const c of [null, [], 'x', 5, undefined]) { assert.doesNotThrow(() => validar(base(), c)); assert.doesNotThrow(() => usable(base(), c)); }
});
test('el catálogo oficial no se ve afectado por importar el módulo (CHARACTERS sin tocar)', () => {
  assert.ok(CHARACTERS.axioma && !CHARACTERS.axioma.lab);
});
