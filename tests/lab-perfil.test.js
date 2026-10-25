// EH-12 · Persistencia del Laboratorio: perfil.lab, ESQUEMA 1→2, exportar/importar con huella, 8 diseños, piezas ganadas por recibos del ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const P = await import('../src/client/perfil.js');
const { migrarEsquema, empaquetar, desempaquetar, ESQUEMA, PREFIJO_COPIA } = await import('../src/sim/perfil-esquema.js');
const L = await import('../src/sim/laboratorio-perfil.js');
const { defecto, codificar, huella, PARTES, ORDEN_PARTES, PIEZAS_INICIALES, COSMETICAS, FUNCIONALES } = await import('../src/shared/host-build.js');
const { limpiarLedger } = await import('../src/sim/ledger.js');

const KEY = 'cristal.perfil.v1';
const pieza = (p, a, o = {}) => ({ p, a, sim: 'ninguna', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: PARTES[p].variantesMat[0], tinte: null }, ...o });
const build = (partes = [], extra = {}) => ({ ...defecto(), id: 'lab-perfil001', nombre: 'Perfil', partes, ...extra });
const idn = (i) => 'lab-pf' + String(i).padStart(6, '0');
const conN = (n) => { let lab = L.limpiarLab(null); for (let i = 0; i < n; i++) lab = L.guardarDiseno(lab, build([], { id: idn(i), nombre: 'D' + i })).lab; return lab; };
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const deB64 = (t) => JSON.parse(Buffer.from(t, 'base64').toString('utf8'));
const recibo = (n, extra = {}) => ({ id: 'partida-' + String(n).padStart(6, '0'), h: 'x', at: 1, won: false, ...extra });

/* ───────── limpiarLab ───────── */
test('limpiarLab(null): laboratorio vacío con las piezas iniciales y nada más', () => {
  const l = L.limpiarLab(null);
  assert.deepEqual(l, { v: 1, activo: null, slots: [], piezas: ORDEN_PARTES.filter((id) => PIEZAS_INICIALES.includes(id)), prog: { partidas: 0, victorias: 0, bajas: 0 }, rec: [] });
});
test('limpiarLab: idempotente y robusto con basura de todo tipo', () => {
  for (const x of [undefined, null, 5, 'x', [], {}, { slots: 'no' }, { slots: [null, 5, 'x', {}] }, { piezas: [1, null, 'inventada', '__proto__'] }, { prog: { partidas: -4, victorias: 'x', bajas: 1e99 } }, { activo: 42 }]) {
    const a = L.limpiarLab(x); assert.deepEqual(L.limpiarLab(a), a);
    assert.ok(a.slots.length <= L.LAB_MAX_DISENOS);
    for (const k of Object.values(a.prog)) assert.ok(Number.isInteger(k) && k >= 0);
  }
});
test('limpiarLab: tope de 8 diseños, ids únicos, `activo` solo si existe', () => {
  const muchos = Array.from({ length: 20 }, (_, i) => build([], { id: idn(i % 12) }));
  const l = L.limpiarLab({ slots: muchos, activo: idn(3) });
  assert.equal(l.slots.length, 8); assert.equal(new Set(l.slots.map((s) => s.id)).size, 8); assert.equal(l.activo, idn(3));
  assert.equal(L.limpiarLab({ slots: muchos, activo: 'lab-noexiste1' }).activo, null);
});
test('limpiarLab: las piezas siempre incluyen las iniciales, solo ids del catálogo, sin repetir y en orden', () => {
  const l = L.limpiarLab({ piezas: ['cola_larga', 'cola_larga', 'inventada', 'ojo_extra'] });
  assert.ok(PIEZAS_INICIALES.every((id) => l.piezas.includes(id)));
  assert.ok(l.piezas.includes('cola_larga') && l.piezas.includes('ojo_extra') && !l.piezas.includes('inventada'));
  assert.equal(new Set(l.piezas).size, l.piezas.length);
  assert.deepEqual(l.piezas, ORDEN_PARTES.filter((id) => l.piezas.includes(id)));
});
test('limpiarLab: cada diseño se normaliza (recorte de rangos) y lleva su huella; los snapshots son ≤ 5', () => {
  const l = L.limpiarLab({ slots: [{ ...build([pieza('cuerno_curvo', 'cabeza', { t: { pos: [9, 9, 9], rot: [0, 0, 0], esc: 99 } })], { prop: { altura: 5 } }), snap: Array.from({ length: 9 }, (_, i) => build([], { id: idn(i), etiqueta: 'antes ' + i })) }] });
  const d = l.slots[0]; assert.equal(d.prop.altura, 1.15); assert.ok(d.partes[0].t.esc <= 1.6); assert.equal(d.h, huella(d)); assert.equal(d.snap.length, 5);
  assert.ok(d.snap.every((s) => !('snap' in s) && /^[0-9a-f]{14}$/.test(s.h)));
});

/* ───────── ESQUEMA 1 → 2 ───────── */
test('ESQUEMA es 2 y un perfil v1 abre SIN pérdida: todo lo que traía sigue igual y aparece `lab`', () => {
  assert.equal(ESQUEMA, 2);
  const v1 = { esq: 1, cores: 777, evo: { axioma: 2 }, ess: { carne: 4, cristal: 0, ojo: 0, vacio: 0 }, ledger: [{ id: 'partida-000001', h: 'abc', at: 5 }], inventario: [], cosmetics: { owned: [], equipped: {} }, ver: 3, inicial: 'axioma' };
  const m = migrarEsquema(v1); assert.equal(m.desde, 1); assert.equal(m.hasta, 2); assert.equal(m.futuro, false);
  for (const k of ['cores', 'evo', 'ess', 'inicial', 'ver']) assert.deepEqual(m.perfil[k], v1[k], k);
  assert.deepEqual(m.perfil.ledger, v1.ledger); assert.equal(m.perfil.esq, 2); assert.deepEqual(m.perfil.lab, L.limpiarLab(null));
});
test('ESQUEMA: v0 pasa por los dos pasos; un perfil con `lab` sucio se sanea; uno de versión futura no se toca', () => {
  const m0 = migrarEsquema({ inv: [], cores: '9' }); assert.equal(m0.desde, 0); assert.equal(m0.perfil.esq, 2); assert.equal(m0.perfil.cores, 9); assert.ok(m0.perfil.lab.piezas.length >= 5);
  const sucio = migrarEsquema({ esq: 1, lab: { slots: [{ nombre: '<x>' }], piezas: ['inventada'] } }).perfil.lab; assert.equal(sucio.slots[0].nombre, 'x'); assert.ok(!sucio.piezas.includes('inventada'));
  const fut = { esq: 3, lab: { raro: true }, extra: 1 }; const mf = migrarEsquema(fut); assert.equal(mf.futuro, true); assert.deepEqual(mf.perfil, fut);
});
test('perfil.js: un guardado v1 en disco se abre con lab vacío, conserva núcleos y se guarda como esquema 2', () => {
  mem.clear(); mem.set(KEY, JSON.stringify({ esq: 1, cores: 321, ver: 3, inicial: 'axioma', evo: { axioma: 1 } }));
  const p = P.recargar(); assert.equal(p.cores, 321); assert.equal(p.esq, 2); assert.deepEqual(p.lab, L.limpiarLab(null)); assert.equal(p.evo.axioma, 1);
  P.guardar(); const g = JSON.parse(mem.get(KEY)); assert.equal(g.esq, 2); assert.ok(Array.isArray(g.lab.piezas));
});
test('perfil.js: guardar un diseño, recargar y encontrarlo igual (huella igual)', () => {
  mem.clear(); const p = P.recargar();
  const r = L.guardarDiseno(p.lab, build([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('placas', 'pecho')])); assert.equal(r.ok, true);
  p.lab = r.lab; P.guardar();
  const q = P.recargar(); assert.equal(q.lab.slots.length, 1); assert.equal(q.lab.slots[0].h, r.build.h); assert.equal(q.lab.activo, 'lab-perfil001');
});
test('copia de seguridad: empaquetar/desempaquetar conserva `lab`; una copia v1 antigua se restaura con lab vacío', () => {
  const lab = conN(3); lab.piezas = [...lab.piezas, 'cola_larga'];
  const t = empaquetar({ cores: 5, lab, esq: 2 }, []), d = desempaquetar(t); assert.equal(d.ok, true); assert.deepEqual(d.perfil.lab, lab);
  mem.clear(); P.recargar();
  assert.equal(P.importarProgreso(t).ok, true); assert.equal(P.perfil().lab.slots.length, 3); assert.ok(P.perfil().lab.piezas.includes('cola_larga'));
  // copia antigua hecha a mano con esquema 1 (huella válida) → restaura y migra
  const cuerpo = { perfil: { cores: 7, esq: 1 }, cola: [] };
  const old = PREFIJO_COPIA + b64({ app: 'vortex', esq: 1, at: 1, h: huellaEstable(cuerpo), ...cuerpo });
  const dv = desempaquetar(old); assert.equal(dv.ok, true);
  assert.equal(P.importarProgreso(old).ok, true); assert.equal(P.perfil().cores, 7); assert.deepEqual(P.perfil().lab.slots, []);
});
import { huella as hl, estable as es } from '../src/sim/ledger.js';
function huellaEstable(o) { return hl(es(o)); }

/* ───────── diseños: guardar / borrar / jugar ───────── */
test('guardarDiseno: reemplaza por id, el primero queda activo, y el noveno diseño se rechaza con un texto claro', () => {
  let lab = conN(8); assert.equal(lab.slots.length, 8); assert.equal(lab.activo, idn(0));
  const r = L.guardarDiseno(lab, build([], { id: idn(99) })); assert.equal(r.ok, false); assert.match(r.mensaje, /8 diseños/); assert.equal(r.lab.slots.length, 8);
  const re = L.guardarDiseno(lab, build([pieza('cresta_osea', 'cabeza')], { id: idn(2), nombre: 'Cambiado' })); assert.equal(re.ok, true); assert.equal(re.lab.slots.length, 8); assert.equal(re.lab.slots[2].nombre, 'Cambiado');
});
test('guardarDiseno: rechaza lo estructuralmente inválido con el mensaje HB-xx en español; permite guardar piezas aún no ganadas', () => {
  const choque = L.guardarDiseno(null, build([pieza('cuerno_curvo', 'cabeza'), pieza('cuerno_curvo', 'cabeza')])); assert.equal(choque.ok, false); assert.match(choque.mensaje, /chocan|mismo lugar/);
  const sinGanar = L.guardarDiseno(null, build([pieza('cola_larga', 'cola')])); assert.equal(sinGanar.ok, true);
  assert.equal(L.guardarDiseno(null, { v: 99 }).ok, false); assert.equal(L.guardarDiseno(null, 'x').ok, false);
});
test('borrarDiseno y elegirActivo: borrar el activo lo deja en null; ids inexistentes dan error', () => {
  let lab = conN(3); lab = L.elegirActivo(lab, idn(1)).lab; assert.equal(lab.activo, idn(1));
  assert.equal(L.elegirActivo(lab, 'lab-noexiste1').ok, false); assert.equal(L.borrarDiseno(lab, 'lab-noexiste1').ok, false);
  const b = L.borrarDiseno(lab, idn(1)); assert.equal(b.lab.slots.length, 2); assert.equal(b.lab.activo, null);
  assert.equal(L.elegirActivo(b.lab, null).ok, true);
});
test('disenoParaJugar: piezas no ganadas o ranuras de menos ⇒ defecto con la razón; con todo en orden ⇒ la build', () => {
  const lab0 = L.guardarDiseno(null, build([pieza('cola_larga', 'cola'), pieza('placas', 'pecho'), pieza('adrenal', 'cintura')])).lab;
  const a = L.disenoParaJugar(lab0, 0); assert.equal(a.defecto, true); assert.deepEqual(a.bloqueadas, ['cola_larga']); assert.ok(a.errores.length >= 1);
  const lab1 = { ...lab0, piezas: [...lab0.piezas, 'cola_larga'] };
  assert.equal(L.disenoParaJugar(lab1, 0).defecto, true, 'con evo 0 solo hay 1 ranura');
  const b = L.disenoParaJugar(lab1, 1); assert.equal(b.defecto, false); assert.equal(b.build.partes.length, 3);
  assert.equal(L.disenoParaJugar(L.limpiarLab(null), 4).defecto, true);
});

/* ───────── piezas por recibos ───────── */
test('reglaObtencion: toda pieza del catálogo tiene una regla entendible y un texto en español', () => {
  for (const id of ORDEN_PARTES) { const r = L.reglaObtencion(PARTES[id].obtencion); assert.ok(r, id); assert.ok(L.comoSeConsigue(id).length > 10, id); }
  assert.equal(L.reglaObtencion('comprar:5'), null); assert.equal(L.reglaObtencion(''), null);
});
test('el catálogo no vende nada: las funcionales se ganan jugando y no hay ninguna obtención de pago', () => {
  for (const id of ORDEN_PARTES) assert.ok(!/pago|dinero|premium|tienda/i.test(PARTES[id].obtencion), id);
  for (const id of FUNCIONALES) assert.ok(/^(inicial|esencia:)/.test(PARTES[id].obtencion), id);
});
test('otorgarPorRecibo: cuenta partida, victoria y bajas; es IDEMPOTENTE por matchId', () => {
  let lab = L.limpiarLab(null);
  const a = L.otorgarPorRecibo(lab, recibo(1, { won: true }), { kills: 40 }); lab = a.lab;
  assert.deepEqual(lab.prog, { partidas: 1, victorias: 1, bajas: 40 }); assert.ok(a.nuevas.includes('corona_espinas'));
  const dup = L.otorgarPorRecibo(lab, recibo(1, { won: true }), { kills: 40 }); assert.equal(dup.duplicado, true); assert.deepEqual(dup.lab, lab); assert.deepEqual(dup.nuevas, []);
  assert.equal(L.otorgarPorRecibo(lab, null).invalido, true); assert.equal(L.otorgarPorRecibo(lab, { id: 'x' }).invalido, true);
});
test('otorgarPorRecibo: cada umbral desbloquea su pieza en el momento justo (victorias, bajas, partidas, órgano crecido)', () => {
  let lab = L.limpiarLab(null); const tiene = () => new Set(lab.piezas);
  lab = L.otorgarPorRecibo(lab, recibo(1), { kills: 10 }).lab; assert.equal(tiene().has('rodillera_placa'), false, 'faltan partidas'); assert.equal(tiene().has('corona_espinas'), false);
  lab = L.otorgarPorRecibo(lab, recibo(2), { kills: 10 }).lab; assert.equal(tiene().has('rodillera_placa'), true);
  lab = L.otorgarPorRecibo(lab, recibo(3, { won: true }), { kills: 10 }).lab; assert.equal(tiene().has('corona_espinas'), true); assert.equal(tiene().has('alas_membrana'), false);
  lab = L.otorgarPorRecibo(lab, recibo(4, { won: true }), { kills: 10 }).lab; lab = L.otorgarPorRecibo(lab, recibo(5, { won: true }), { kills: 10 }).lab; assert.equal(tiene().has('alas_membrana'), true);
  assert.equal(tiene().has('cola_larga'), false); lab = L.otorgarPorRecibo(lab, recibo(6), { kills: 120 }).lab; assert.equal(tiene().has('cola_larga'), true); assert.equal(tiene().has('garras_mano'), false);
  lab = L.otorgarPorRecibo(lab, recibo(7), { kills: 200 }).lab; assert.equal(tiene().has('garras_mano'), true);
  assert.equal(tiene().has('ojo_extra'), false); const o = L.otorgarPorRecibo(lab, recibo(8), { organos: ['ojo_extra', 'inventado'] }); assert.deepEqual(o.nuevas, ['ojo_extra']); assert.equal(o.lab.piezas.includes('inventado'), false);
});
test('otorgarPorRecibo: perder también cuenta la partida y las bajas, pero no da victorias; los recibos recordados son ≤ 50', () => {
  let lab = L.limpiarLab(null); for (let i = 1; i <= 80; i++) lab = L.otorgarPorRecibo(lab, recibo(i), { kills: 1 }).lab;
  assert.equal(lab.prog.victorias, 0); assert.equal(lab.prog.partidas, 80); assert.equal(lab.rec.length, 50);
});
test('perfil.js: cerrar la misma partida 3 veces desbloquea UNA vez (el ledger y `rec` lo impiden) y sobrevive a recargar', () => {
  mem.clear(); P.recargar();
  const jug = () => ({ kills: 60, co: 100, pk: [0, 0, 0, 0, 0, 0, 0, 0], bag: [], cg: ['ojo_extra'] });
  const RES = { etapas: 5, total: 5, hitos: {} };
  for (let i = 0; i < 3; i++) P.cerrarPartida('axioma', jug(), { matchId: 'partida-lab-0001', wave: 3, won: true, resumen: RES });
  let lab = P.perfil().lab; assert.deepEqual(lab.prog, { partidas: 1, victorias: 1, bajas: 60 });
  assert.ok(lab.piezas.includes('corona_espinas') && lab.piezas.includes('ojo_extra'));
  P.recargar(); lab = P.perfil().lab; assert.deepEqual(lab.prog, { partidas: 1, victorias: 1, bajas: 60 });
  P.cerrarPartida('axioma', jug(), { matchId: 'partida-lab-0001', wave: 3, won: true, resumen: RES }); assert.equal(P.perfil().lab.prog.partidas, 1);
  P.cerrarPartida('axioma', jug(), { matchId: 'partida-lab-0002', wave: 3, won: false, resumen: RES }); assert.equal(P.perfil().lab.prog.partidas, 2);
});
test('perfil.paraPartida("laboratorio") manda el diseño activo en VB1 solo si se puede jugar; el resto de Huéspedes no lleva `lab`', () => {
  mem.clear(); const p = P.recargar();
  p.lab = L.guardarDiseno(p.lab, build([pieza('placas', 'pecho'), pieza('cresta_osea', 'cabeza')])).lab;
  assert.equal(P.paraPartida('axioma').lab, undefined);
  const pp = P.paraPartida('laboratorio'); assert.match(pp.lab, /^VB1:/);
  p.evo.laboratorio = 0; p.lab = L.guardarDiseno(p.lab, build([pieza('placas', 'pecho'), pieza('adrenal', 'cintura')])).lab;
  assert.equal(P.paraPartida('laboratorio').lab, undefined, 'dos funcionales con evo 0: se juega con el chasis por defecto');
  p.evo.laboratorio = 1; assert.match(P.paraPartida('laboratorio').lab, /^VB1:/);
});

/* ───────── exportar / importar ───────── */
test('exportar → importar: ida y vuelta con la MISMA huella; el texto empieza con VORTEX-HUESPED-1:', () => {
  const b = build([pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('placas', 'pecho')], { nombre: 'Cazador de brasas' });
  const t = L.exportar(b, 1234); assert.ok(t.startsWith('VORTEX-HUESPED-1:'));
  const r = L.importar(t, null); assert.equal(r.ok, true, r.mensaje); assert.equal(r.build.h, huella(b)); assert.equal(r.lab.slots.length, 1);
  assert.equal(r.build.id, 'lab-perfil001'); assert.equal(deB64(t.slice(17)).app, 'vortex'); assert.equal(deB64(t.slice(17)).at, 1234);
});
test('importar: texto cortado, vacío, ajeno o con base64 roto se rechaza con mensaje en español (sin lanzar)', () => {
  const t = L.exportar(build([pieza('placas', 'pecho')]));
  for (const mal of [t.slice(0, t.length - 20), t.slice(0, 25), '', null, undefined, 'hola', 'VORTEX-COPIA-1:abc', 'VORTEX-HUESPED-1:', 'VORTEX-HUESPED-1:%%%', 'VORTEX-HUESPED-1:' + b64({ app: 'otro' }), 'VORTEX-HUESPED-1:' + 'A'.repeat(30000)]) {
    const r = L.importar(mal, null); assert.equal(r.ok, false, String(mal).slice(0, 30)); assert.ok(r.mensaje.length > 10); assert.equal(r.lab.slots.length, 0);
  }
});
test('importar: un texto EDITADO a mano (cambié una proporción, una pieza o el nombre) se rechaza por la huella', () => {
  const b = build([pieza('placas', 'pecho')]), t = L.exportar(b), d = deB64(t.slice(17));
  const reempaca = (m) => 'VORTEX-HUESPED-1:' + b64(m);
  const cambios = [(x) => { x.build.prop.altura = 1.1; }, (x) => { x.build.nombre = 'Hackeado'; }, (x) => { x.build.partes.push({ p: 'adrenal', a: 'cintura' }); }, (x) => { x.build.partes[0].t.esc = 1.5; }, (x) => { x.build.pal.primario = '#000000'; }, (x) => { x.build.partes = []; }];
  for (const [i, f] of cambios.entries()) { const x = JSON.parse(JSON.stringify(d)); f(x); const r = L.importar(reempaca(x), null); assert.equal(r.ok, false, 'cambio ' + i); assert.match(r.mensaje, /huella/); }
  const sinCambio = JSON.parse(JSON.stringify(d)); assert.equal(L.importar(reempaca(sinCambio), null).ok, true);
});
test('importar: versión más nueva y diseños estructuralmente inválidos (con huella correcta) se rechazan', () => {
  const b = build([pieza('placas', 'pecho')]), d = deB64(L.exportar(b).slice(17));
  assert.equal(L.importar('VORTEX-HUESPED-1:' + b64({ ...d, esq: 99 }), null).ok, false);
  assert.match(L.importar('VORTEX-HUESPED-1:' + b64({ ...d, esq: 99 }), null).mensaje, /más nueva/);
  const mala = { ...build([pieza('cuerno_curvo', 'cabeza'), pieza('cuerno_curvo', 'cabeza')]) };
  const forzada = { app: 'vortex', esq: 1, at: 0, h: huella(mala), build: mala };
  const r = L.importar('VORTEX-HUESPED-1:' + b64(forzada), null); assert.equal(r.ok, false); assert.match(r.mensaje, /chocan|mismo lugar/);
});
test('importar NUNCA otorga piezas: las que no tenés quedan bloqueadas, el diseño se guarda pero no se puede jugar', () => {
  const b = build([pieza('cola_larga', 'cola'), pieza('alas_membrana', 'espalda'), pieza('placas', 'pecho')]), t = L.exportar(b);
  const lab0 = L.limpiarLab(null), antes = [...lab0.piezas];
  const r = L.importar(t, lab0); assert.equal(r.ok, true); assert.deepEqual([...r.bloqueadas].sort(), ['alas_membrana', 'cola_larga']);
  assert.deepEqual(r.lab.piezas, antes, 'las piezas poseídas no cambian'); assert.match(r.mensaje, /bloqueada/);
  const j = L.disenoParaJugar(r.lab, 4); assert.equal(j.defecto, true); assert.deepEqual([...j.bloqueadas].sort(), [...r.bloqueadas].sort());
  // si luego las ganás jugando, el MISMO diseño ya se puede jugar
  const lab2 = { ...r.lab, piezas: [...r.lab.piezas, 'cola_larga', 'alas_membrana'] }; assert.equal(L.disenoParaJugar(lab2, 1).defecto, false);
});
test('importar: un id repetido recibe un id nuevo (no pisa); con 8 diseños no cabe; se rechazan duplicados de huella solo por id', () => {
  const b = build([pieza('placas', 'pecho')]), t = L.exportar(b);
  const a = L.importar(t, null, () => 0.3); const b2 = L.importar(t, a.lab, () => 0.3);
  assert.equal(b2.ok, true); assert.equal(b2.lab.slots.length, 2); assert.notEqual(b2.lab.slots[0].id, b2.lab.slots[1].id); assert.match(b2.lab.slots[1].id, /^lab-[a-z0-9]{8}$/);
  const lleno = conN(8); const c = L.importar(t, lleno); assert.equal(c.ok, false); assert.match(c.mensaje, /8 diseños/);
});
test('leerExportado no modifica nada y marca bloqueadas contra lo que posees', () => {
  const t = L.exportar(build([pieza('cola_larga', 'cola')])), lab = L.limpiarLab(null), copia = JSON.stringify(lab);
  const r = L.leerExportado(t, lab); assert.equal(r.ok, true); assert.deepEqual(r.bloqueadas, ['cola_larga']); assert.equal(JSON.stringify(lab), copia);
  assert.deepEqual(L.leerExportado(t, { ...lab, piezas: [...lab.piezas, 'cola_larga'] }).bloqueadas, []);
});
test('unicode: nombres con acentos, eñes y emojis sobreviven a exportar/importar y a VB1', () => {
  const b = build([], { nombre: 'Ñandú 🐲 Ágil' }); const r = L.importar(L.exportar(b), null); assert.equal(r.ok, true); assert.equal(r.build.nombre, 'Ñandú 🐲 Ágil');
  assert.equal(codificar(b).length < 200, true);
});
test('el ledger sigue limpio: los recibos de partida no se tocan al desbloquear piezas', () => {
  mem.clear(); P.recargar(); P.cerrarPartida('axioma', { kills: 5, co: 10, pk: [0, 0, 0, 0, 0, 0, 0, 0], bag: [] }, { matchId: 'partida-ledg-01', wave: 1, won: false, resumen: { etapas: 1, total: 5, hitos: {} } });
  const led = P.perfil().ledger; assert.equal(led.length, 1); assert.deepEqual(limpiarLedger(led), led); assert.equal(led[0].id, 'partida-ledg-01');
});
void COSMETICAS;
