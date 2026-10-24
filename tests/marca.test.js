import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARCA, aplicarMarca } from '../src/client/marca.js';
import { migas, migasTexto, PANTALLAS, SECCIONES, SECCION_DE, PUERTAS, tabActiva, avisosPuertas, continuarDe, avisos, rutaObjetivos } from '../src/client/menu-nav.js';

// El título del juego vive en UNA constante (src/client/marca.js) y no quedan restos del nombre viejo en lo que ve el jugador.
const leer = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('marca: el nombre es VORTEX y el logo se arma con las mismas palabras', () => {
  assert.equal(MARCA.nombre, 'VORTEX'); assert.equal(MARCA.logo.join(''), MARCA.nombre); assert.equal(MARCA.mundo, 'el Vórtice');
  assert.ok(MARCA.subtitulo.length > 10 && !/shooter/i.test(MARCA.subtitulo + MARCA.legal + MARCA.descripcion));
});
test('marca: index, tarjeta final y manifest dicen lo mismo que la constante y no queda el nombre viejo', () => {
  const html = leer('public/index.html'), end = leer('public/endcard.html'), man = JSON.parse(leer('public/manifest.webmanifest'));
  assert.match(html, new RegExp(`<title>${MARCA.nombre}</title>`)); assert.match(html, new RegExp(`apple-mobile-web-app-title" content="${MARCA.corto}"`));
  assert.equal(man.name, MARCA.nombre); assert.equal(man.short_name, MARCA.corto); assert.equal(man.description, MARCA.descripcion);
  for (const [n, t] of [['index.html', html], ['endcard.html', end], ['manifest', JSON.stringify(man)]]) assert.doesNotMatch(t, /cristal\s*v[óo]rtice|shower\s*psico|pacto\s*psico/i, n);
  assert.match(end, /VORTEX/);
  // el texto visible del título/carga sale de la constante (data-marca), no está repetido a mano en otro lado del JS del menú
  for (const f of ['src/client/ui.js', 'src/client/menu-hubs.js', 'src/client/tienda-ui.js']) assert.doesNotMatch(leer(f), /CRISTAL|VORTEX/, f);
});
test('marca: aplicarMarca escribe título, logo, subtítulo y carga en el documento', () => {
  const els = { logo1: { textContent: '' }, logo2: { textContent: '' }, nombre: { textContent: '' }, subtitulo: { textContent: '' }, legal: { textContent: '' } }; const meta = { c: '', setAttribute(k, v) { this.c = v; } };
  const doc = { title: '', querySelectorAll: (sel) => { const m = /data-marca="(\w+)"/.exec(sel); if (m) return [els[m[1]]]; return sel.includes('apple-mobile-web-app-title') ? [meta] : []; } };
  aplicarMarca(doc); assert.equal(doc.title, 'VORTEX'); assert.equal(els.logo2.textContent, 'VORTEX'); assert.equal(els.nombre.textContent, 'VORTEX'); assert.equal(els.subtitulo.textContent, MARCA.subtitulo); assert.equal(meta.c, 'Vortex');
});
test('menú: 5 puertas, 4 secciones con pestañas, cada pantalla a ≤ 2 pasos del inicio (docs/MENU.md)', () => {
  assert.deepEqual(PUERTAS.map((d) => d.id), ['base', 'huespedes', 'coleccion', 'coop', 'ajustes']);
  assert.ok(PUERTAS.length <= 5, 'como máximo 5 puertas secundarias');
  assert.equal(migasTexto('inventario'), 'Inicio › Huéspedes'); assert.equal(migasTexto('tienda'), 'Inicio › Huéspedes'); assert.equal(migasTexto('main'), 'Inicio'); assert.deepEqual(migas('title'), []);
  // cada pantalla del menú se alcanza desde una puerta (data-go) o desde una pestaña de la sección de esa puerta
  const destinos = new Set([...PUERTAS.map((d) => d.go), 'arenas', ...Object.values(SECCIONES).flatMap((S) => S.tabs.map((t) => t.go))]);
  for (const d of ['story', 'arenas', 'coop', 'huesped', 'evolucion', 'inventario', 'loadout', 'territorios', 'bestiary', 'tienda', 'graficos', 'options', 'base']) assert.ok(destinos.has(d), `${d} se alcanza desde el inicio o una pestaña`);
  for (const [sid, S] of Object.entries(SECCIONES)) { assert.ok(S.tabs.length >= 2 && S.tabs.length <= 6, sid); for (const t of S.tabs) { assert.ok(PANTALLAS[t.go], `${sid}/${t.t}: pantalla ${t.go} existe`); assert.ok(t.t.length <= 20, 'rótulo corto: ' + t.t); } }
  for (const p of Object.keys(PANTALLAS)) if (p !== 'main') { assert.equal(PANTALLAS[p].padre, 'main', p + ' cuelga del inicio (un solo nivel)'); assert.ok(SECCION_DE[p], p + ' pertenece a una sección con pestañas'); }
  for (const d of PUERTAS) { assert.ok(d.desc.length > 15 && d.desc.length < 60, 'una línea de ayuda: ' + d.id); assert.ok(d.icono && d.color, d.id); }
  // pestaña activa: Inventario y Forja comparten pantalla; Criaturas / Fauna / Herbario también
  assert.equal(SECCIONES.huespedes.tabs[tabActiva('inventario', { ivtab: 'obj' })].t, 'Inventario'); assert.equal(SECCIONES.huespedes.tabs[tabActiva('inventario', { ivtab: 'for' })].t, 'Forja');
  assert.equal(SECCIONES.coleccion.tabs[tabActiva('bestiary', { btab: 'h' })].t, 'Herbario'); assert.equal(SECCIONES.coleccion.tabs[tabActiva('bestiary', {})].t, 'Criaturas'); assert.equal(tabActiva('main'), -1);
  assert.equal(SECCIONES.partidas.tabs[tabActiva('coop')].t, 'Cooperativo');
});
test('menú: los puntitos sólo salen donde hay una acción útil', () => {
  const p = { cores: 700, inventario: [{ u: 'u5' }], menu: { iv: 0 }, terr: { m1: { bend: null } }, arb: {} };
  const v = avisosPuertas(avisos(p)); assert.ok(v.huespedes >= 1 && v.coleccion === 1, JSON.stringify(v)); assert.equal(v.coop, 0); assert.equal(v.ajustes, 0);
  assert.deepEqual(avisosPuertas(avisos({ cores: 0, inventario: [], menu: { iv: 0, tv: '' }, terr: {}, arb: {} })).coleccion, 0);
});
test('menú: Continuar y avisos salen del perfil', () => {
  assert.deepEqual(continuarDe(null, 'Axioma'), { tipo: 'modes', titulo: 'Jugar', sub: 'Campaña o misiones individuales · con Axioma' });
  assert.equal(continuarDe({ k: 'arena', id: 'm3' }).id, 'm3'); assert.equal(continuarDe({ k: 'arena', id: 'zzz' }).tipo, 'modes');
  const a = avisos({ cores: 700, inventario: [{ u: 'u5' }, { u: 'u2' }], menu: { iv: 4 }, terr: { m1: { bend: null } }, arb: { axioma: { combo: { pc: 5, nodos: [] } } } });
  assert.equal(a.botin, 1, 'sólo lo que llegó después de abrir el Inventario'); assert.equal(a.puntos, 1); assert.ok(a.huesped >= 1, 'hay un Huésped comprable'); assert.equal(a.bendicion, 1);
  assert.equal(avisos({ cores: 0, menu: { iv: 0, tv: '' } }).huesped, 0);
  const r = rutaObjetivos({}); assert.equal(r[0].hecho, false); assert.ok(r.length <= 4);
});
