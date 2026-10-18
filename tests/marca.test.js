import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARCA, aplicarMarca } from '../src/client/marca.js';
import { migas, migasTexto, PANTALLAS, HUBS, PUERTAS, continuarDe, avisos, rutaObjetivos } from '../src/client/menu-nav.js';

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
test('menú: 4 puertas, cada pantalla colgada de un hub, migas «Inicio › Mi Huésped › Inventario»', () => {
  assert.deepEqual(PUERTAS.map((d) => d.id), ['jugar', 'huesped', 'mundo', 'ajustes']);
  assert.equal(migasTexto('inventario'), 'Inicio › Mi Huésped › Inventario'); assert.equal(migasTexto('tienda'), 'Inicio › Mundo › Tienda'); assert.equal(migasTexto('main'), 'Inicio'); assert.deepEqual(migas('title'), []);
  const destinos = Object.values(HUBS).flatMap((h) => h.items.map((i) => i.go));
  for (const d of ['story', 'arenas', 'coop', 'huesped', 'evolucion', 'inventario', 'loadout', 'territorios', 'bestiary', 'tienda', 'graficos', 'options']) assert.ok(destinos.includes(d), `${d} se alcanza desde un hub`);
  assert.equal(new Set(destinos).size, destinos.length, 'sin duplicados entre hubs');
  for (const [id, h] of Object.entries(HUBS)) { assert.equal(PANTALLAS[id].padre, 'main'); for (const it of h.items) { assert.equal(PANTALLAS[it.go].padre, id, it.go); assert.ok(it.desc.length > 15, 'cada tarjeta explica qué hace'); } }
  for (const d of PUERTAS) assert.ok(fs.existsSync(new URL('../' + d.art.replace('./', ''), import.meta.url)), d.art);
});
test('menú: Continuar y avisos salen del perfil', () => {
  assert.deepEqual(continuarDe(null, 'Axioma'), { tipo: 'story', titulo: 'Jugar', sub: 'Empezar la Historia · con Axioma' });
  assert.equal(continuarDe({ k: 'arena', id: 'm3' }).id, 'm3'); assert.equal(continuarDe({ k: 'arena', id: 'zzz' }).tipo, 'story');
  const a = avisos({ cores: 700, inventario: [{ u: 'u5' }, { u: 'u2' }], menu: { iv: 4 }, terr: { m1: { bend: null } }, arb: { axioma: { combo: { pc: 5, nodos: [] } } } });
  assert.equal(a.botin, 1, 'sólo lo que llegó después de abrir el Inventario'); assert.equal(a.puntos, 1); assert.ok(a.huesped >= 1, 'hay un Huésped comprable'); assert.equal(a.bendicion, 1);
  assert.equal(avisos({ cores: 0, menu: { iv: 0, tv: '' } }).huesped, 0);
  const r = rutaObjetivos({}); assert.equal(r[0].hecho, false); assert.ok(r.length <= 4);
});
