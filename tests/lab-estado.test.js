import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEstado, HISTORIAL_MAX, SNAPSHOTS_MAX, presupuestoDe, CLAVE_BORRADOR } from '../src/client/lab-estado.js';
import { huella, validar, PARTES, ORDEN_PARTES, ANCLAS, limitesDe, TOPES_RENDER } from '../src/shared/host-build.js';
import { PROP_RANGOS, PROP_CLAVES, errorProp, ajustarProp, limitarProp, escalasLocales, TABLA_HUESOS } from '../src/client/lab-prop.js';
import { prng } from '../src/shared/host-build-sugeridor.js';

// Estado del editor (src/client/lab-estado.js, EH-08/09): topes duros, deshacer/rehacer, snapshots y borrador. Sin navegador.
const mk = (ctx = { evo: 4 }, extra = {}) => { let t = 1000; const E = crearEstado({ ctx: () => ctx, azar: prng(7), ahora: () => t, ...extra }); E.__t = (ms) => { t += ms; }; return E; };

test('una build nueva es válida y tiene historial vacío', () => {
  const E = mk(); assert.equal(E.validacion.ok, true); assert.equal(E.puedeUndo, false); assert.equal(E.puedeRedo, false); assert.equal(E.build.partes.length, 0);
});

test('ráfaga de slider = UN paso de deshacer; deshacer/rehacer vuelven a la misma huella', () => {
  const E = mk(); const h0 = huella(E.build);
  for (let i = 0; i < 20; i++) { E.setProp('altura', 1 + i * 0.005); E.__t(30); }   // 20 cambios seguidos de un mismo slider
  assert.equal(E.pasos.atras, 1, 'una ráfaga de slider es un solo paso');
  const h1 = huella(E.build); assert.notEqual(h1, h0);
  assert.equal(E.undo(), true); assert.equal(huella(E.build), h0);
  assert.equal(E.redo(), true); assert.equal(huella(E.build), h1);
  E.__t(2000); E.setProp('altura', 1.01); assert.equal(E.pasos.atras, 2, 'pasados 700 ms es otro paso');
});

test('begin/end agrupa un arrastre completo en un paso', () => {
  const E = mk(); const r = E.agregar('cuerno_curvo', 'cabeza'); assert.ok(r.ok); const antes = E.pasos.atras;
  E.begin('arrastre'); for (let i = 1; i <= 8; i++) E.patch(r.i, { pos: [0.002 * i, 0, 0] }); E.end();
  assert.equal(E.pasos.atras, antes + 1); assert.equal(E.build.partes[r.i].t.pos[0], 0.016);
  E.undo(); assert.equal(E.build.partes[r.i].t.pos[0], 0);
});

test('100 pasos de ida y vuelta devuelven la build idéntica (misma huella) y el historial tiene tope', () => {
  const E = mk(); const hs = [huella(E.build)];
  for (let i = 0; i < 100; i++) { E.__t(1000); const antes = E.pasos.atras; E.setProp(PROP_CLAVES[i % 9], 1 + ((i * 7) % 11 - 5) * 0.012 + i * 0.0001); if (E.pasos.atras > antes) hs.push(huella(E.build)); }
  assert.ok(hs.length > 60 && E.pasos.atras === hs.length - 1, `pasos ${E.pasos.atras} / huellas ${hs.length}`);
  for (let k = hs.length - 1; k > 0; k--) { assert.equal(huella(E.build), hs[k], `paso ${k}`); assert.equal(E.undo(), true); }
  assert.equal(huella(E.build), hs[0]); assert.equal(E.undo(), false);
  for (let k = 1; k < hs.length; k++) { assert.equal(E.redo(), true); assert.equal(huella(E.build), hs[k]); }
  for (let i = 0; i < 130; i++) { E.__t(1000); E.setProp('torso', 0.92 + (i % 18) * 0.01); }
  assert.ok(E.pasos.atras <= HISTORIAL_MAX, 'nunca más de 100 pasos');
});

test('imposible salir de los límites: valores fuera de rango se recortan y avisan', () => {
  const E = mk(); const r = E.agregar('cuerno_curvo', 'cabeza'); const lim = limitesDe('cuerno_curvo', 'cabeza');
  const o = E.patch(r.i, { pos: [9, -9, 9], rot: [999, -999, 999], esc: 50 });
  assert.equal(o.ok, true); assert.ok(o.tope.pos.every(Boolean) && o.tope.rot.every(Boolean) && o.tope.esc, 'todo toca el tope'); assert.ok(o.motivo.length > 0);
  const t = E.build.partes[r.i].t;
  assert.deepEqual(t.pos, [lim.pos[0][1], lim.pos[1][0], lim.pos[2][1]]); assert.deepEqual(t.rot, [lim.rot[0][1], lim.rot[1][0], lim.rot[2][1]]); assert.equal(t.esc, lim.esc[1]);
  assert.equal(E.validacion.ok, true);
  const p = E.setProp('altura', 99); assert.equal(E.build.prop.altura, PROP_RANGOS.altura[1]); void p;
});

test('proporciones: nunca rompen las reglas entre ellas (HB-05) y avisan del tope', () => {
  const E = mk(); E.setProp('altura', 1.15); const r = E.setProp('piernas', 1.15);
  assert.ok(E.build.prop.piernas <= 1.3 / 1.15 + 1e-9); assert.match(r.tope, /Tope/); assert.deepEqual(errorProp(E.build.prop), []);
  E.setProp('hombros', 0.92); E.setProp('brazos', 1.15); assert.ok(Math.abs(E.build.prop.brazos - E.build.prop.hombros) <= 0.15 + 1e-9);
  E.setProp('cabeza', 1.2); assert.ok(E.build.prop.cabeza <= E.build.prop.hombros * 1.2 + 1e-9);
  assert.equal(E.validacion.ok, true);
});

test('escalas de hueso: cada hueso de la tabla recibe una escala local positiva y la efectiva = local × padre', () => {
  const p = limitarProp({ torso: 1.1, brazos: 0.9, manos: 1.3, pies: 0.85, piernas: 1.15, cabeza: 1.2, hombros: 1.12 }), loc = escalasLocales(p), by = new Map(TABLA_HUESOS.map((r) => [r[0], r]));
  const eff = (h) => { const r = by.get(h); return loc[h] * (r[2] ? eff(r[2]) : 1); };
  for (const [h, g] of TABLA_HUESOS) { assert.ok(loc[h] > 0 && Number.isFinite(loc[h])); if (typeof g === 'string') assert.ok(Math.abs(eff(h) - p[g]) < 1e-9, `${h}: efectiva ${eff(h)} ≠ ${p[g]}`); }
});

test('capacidad: una pieza funcional más allá de las ranuras NO se agrega y explica por qué', () => {
  const E = mk({ evo: 0 });   // 1 ranura
  assert.equal(E.agregar('adrenal', 'cintura').ok, true);
  const r = E.agregar('placas', 'pecho'); assert.equal(r.ok, false); assert.match(r.motivo, /ranura|Evolucion/i); assert.equal(E.build.partes.length, 1);
  assert.equal(E.agregar('adrenal', 'espalda').ok, false, 'una funcional cuenta una sola vez');
});

test('pieza no poseída: se rechaza (HB-06) con un mensaje que dice que se gana jugando', () => {
  const E = mk({ evo: 4, poseidas: ['cuerno_curvo'] }); const r = E.agregar('alas_membrana', 'espalda'); assert.equal(r.ok, false); assert.equal(r.codigo, 'HB-06'); assert.match(r.motivo, /jugando/);
  assert.equal(E.agregar('cuerno_curvo', 'cabeza').ok, true);
});

test('ancla ilegal y choques: se rechazan con motivo', () => {
  const E = mk(); assert.equal(E.agregar('cuerno_curvo', 'pecho').ok, false);
  assert.equal(E.agregar('placa_pectoral', 'pecho').ok, true); const r = E.agregar('corazon_cristal', 'pecho'); assert.equal(r.ok, false); assert.match(r.motivo, /lleva|chocan|mismo lugar|no se/i);
});

test('topes duros de dibujo: se puede llenar el presupuesto pero nunca pasarlo', () => {
  const E = mk(); const rnd = prng(11); let rechazos = 0;
  for (let n = 0; n < 400; n++) { const id = ORDEN_PARTES[Math.floor(rnd() * ORDEN_PARTES.length)], d = PARTES[id], a = d.anclas[Math.floor(rnd() * d.anclas.length)]; const r = E.agregar(id, a, { sim: rnd() < 0.5 ? 'espejo' : 'ninguna' }); if (!r.ok) rechazos++; }
  assert.ok(rechazos > 50, 'hubo rechazos'); const pr = presupuestoDe(E.build);
  assert.ok(pr.tris <= TOPES_RENDER.tris && pr.llamadas <= TOPES_RENDER.llamadas, JSON.stringify(pr)); assert.equal(E.validacion.ok, true, JSON.stringify(E.validacion.errores));
});

test('FUZZ: 600 operaciones al azar (agregar, mover, escalar, espejar, quitar, deshacer) nunca dejan una build inválida', () => {
  const E = mk(); const rnd = prng(2026); const falla = [];
  for (let n = 0; n < 600; n++) {
    const op = Math.floor(rnd() * 8), N = E.build.partes.length, i = N ? Math.floor(rnd() * N) : -1; E.__t(rnd() < 0.5 ? 1000 : 10);
    if (op === 0) { const id = ORDEN_PARTES[Math.floor(rnd() * ORDEN_PARTES.length)], d = PARTES[id]; E.agregar(id, d.anclas[Math.floor(rnd() * d.anclas.length)]); }
    else if (op === 1 && i >= 0) E.patch(i, { pos: [(rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5] });
    else if (op === 2 && i >= 0) E.patch(i, { esc: 0.3 + rnd() * 3 });
    else if (op === 3 && i >= 0) E.patch(i, { rot: [(rnd() - 0.5) * 300, (rnd() - 0.5) * 300, (rnd() - 0.5) * 300] });
    else if (op === 4 && i >= 0) E.patch(i, { sim: rnd() < 0.5 ? 'espejo' : 'ninguna' });
    else if (op === 5 && i >= 0) E.quitar(i);
    else if (op === 6) E.setProp(PROP_CLAVES[Math.floor(rnd() * 9)], 0.8 + rnd() * 0.5);
    else if (op === 7) { if (rnd() < 0.6) E.undo(); else E.redo(); }
    const v = validar(E.build, { evo: 4 }); if (!v.ok) falla.push({ n, op, e: v.errores.map((x) => x.codigo + ' ' + x.msg) });
  }
  assert.deepEqual(falla.slice(0, 3), []);
});

test('simetría: un patch de una pieza espejada mueve a la pareja (una sola entrada)', () => {
  const E = mk(); const r = E.agregar('hombrera_espinas', 'hombros'); assert.equal(E.build.partes[r.i].sim, 'espejo');
  E.patch(r.i, { pos: [0.02, 0, 0] }); assert.equal(E.build.partes.length, 1); assert.equal(E.build.partes[0].t.pos[0], 0.02);
  E.patch(r.i, { sim: 'ninguna' }); assert.equal(E.build.partes[0].sim, 'ninguna'); assert.ok(['izq', 'der'].includes(E.build.partes[0].l));
});

test('snapshots: hasta 5, restaurar es un paso deshacible, viajan dentro del diseño guardado', () => {
  const E = mk(); E.agregar('cuerno_curvo', 'cabeza'); const h0 = huella(E.build); assert.equal(E.crearSnapshot('antes de las alas').ok, true);
  E.agregar('placa_pectoral', 'pecho'); E.__t(1000); E.setProp('altura', 1.1); assert.notEqual(huella(E.build), h0);
  assert.equal(E.restaurarSnapshot(0), true); assert.equal(huella(E.build), h0); assert.equal(E.undo(), true); assert.notEqual(huella(E.build), h0);
  for (let i = 0; i < 6; i++) E.crearSnapshot('x' + i); assert.equal(E.snapshots.length, SNAPSHOTS_MAX); assert.equal(E.crearSnapshot('otra').ok, false);
  const g = E.paraGuardar(); assert.equal(g.snap.length, SNAPSHOTS_MAX); const E2 = mk(); E2.cargar(g); assert.equal(E2.snapshots.length, SNAPSHOTS_MAX); assert.equal(E2.puedeUndo, false);
  assert.equal(E.borrarSnapshot(0), true); assert.equal(E.snapshots.length, SNAPSHOTS_MAX - 1);
});

test('borrador: se guarda y se recupera, y si el almacenamiento falla no pasa nada', () => {
  const mem = new Map(), alm = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null, removeItem: (k) => mem.delete(k) };
  const E = mk({ evo: 4 }, { almacen: alm }); E.agregar('cuerno_curvo', 'cabeza'); E.setNombre('Mi bicho'); assert.equal(E.guardarBorrador(), true); assert.ok(mem.has(CLAVE_BORRADOR));
  const E2 = mk({ evo: 4 }, { almacen: alm }), b = E2.leerBorrador(); assert.equal(b.build.nombre, 'Mi bicho'); assert.equal(b.build.partes.length, 1);
  const roto = mk({ evo: 4 }, { almacen: { setItem() { throw new Error('lleno'); }, getItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } } });
  assert.equal(roto.guardarBorrador(), false); assert.equal(roto.leerBorrador(), null); roto.borrarBorrador();
  mem.set(CLAVE_BORRADOR, '{no es json'); assert.equal(E2.leerBorrador(), null);
});

test('los oyentes se avisan en cada cambio y se pueden quitar', () => {
  const E = mk(); let n = 0; const off = E.on(() => { n++; }); E.agregar('cuerno_curvo', 'cabeza'); assert.ok(n >= 1); const k = n; off(); E.agregar('gorguera', 'cuello'); assert.equal(n, k);
});

test('ajustarProp es idempotente en el límite y no toca otras proporciones', () => {
  const base = limitarProp({}); const r = ajustarProp(base, 'brazos', 1.15); for (const k of PROP_CLAVES) if (k !== 'brazos') assert.equal(r.prop[k], base[k]);
});
void ANCLAS;
