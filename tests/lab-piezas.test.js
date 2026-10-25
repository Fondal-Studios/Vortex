import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, browserAvailable } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { PARTES, ORDEN_PARTES, COSMETICAS, FUNCIONALES, instancias } from '../src/shared/host-build.js';
import { medirPiezas, disenoDe } from '../tools/lab-medir.mjs';

// EH-02: las 20 piezas del catálogo v1 (12 cosméticas + 8 funcionales) se dibujan en Baja, Media y Alta, en cada ancla permitida y en los extremos de sus límites,
// sin errores, sin números inválidos, con los triángulos del catálogo (±12 % en Baja) y con los materiales que declara la tabla. Una prueba a la vez (Chromium).
const hasChromium = browserAvailable();
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('el catálogo trae 12 piezas cosméticas y 8 funcionales', () => { assert.equal(COSMETICAS.length, 12); assert.equal(FUNCIONALES.length, 8); assert.equal(ORDEN_PARTES.length, 20); });

const medidas = {};
for (const q of ['low', 'medium', 'high']) {
  test(`20 piezas × anclas × extremos en ${q}: sin errores y sin números inválidos`, { skip: !hasChromium, timeout: 900000 }, async () => {
    const m = medidas[q] = await medirPiezas(browser, base, q);
    assert.deepEqual(m.__errores, [], 'consola limpia');
    for (const id of ORDEN_PARTES) for (const c of m[id].casos) {
      assert.ok(c.finito, `${id} ${c.nombre}: coordenadas no finitas`); assert.ok(c.tris > 50, `${id} ${c.nombre}: no dibujó nada (${c.tris})`);
      assert.ok(c.rad < 3.2, `${id} ${c.nombre}: se fue lejos del cuerpo (${c.rad} m)`); assert.equal(c.proxies, c.esperadas, `${id} ${c.nombre}: zonas de selección`);
    }
  });
}
test('Baja: triángulos por pieza dentro de ±12 % de la tabla del catálogo y llamadas EXACTAS (materiales declarados)', { skip: !hasChromium }, () => {
  const m = medidas.low; assert.ok(m, 'corrió la medición de Baja');
  for (const id of ORDEN_PARTES) {
    const n = instancias(disenoDe(id, PARTES[id].anclas[0])).length, real = m[id].tris / n, tabla = PARTES[id].tris.low;
    assert.ok(Math.abs(real / tabla - 1) <= 0.12, `${id}: medido ${real} vs tabla ${tabla}`);
    const declarados = new Set([PARTES[id].variantesMat[0], ...PARTES[id].mats.slice(1)]); assert.deepEqual([...new Set(m[id].mats)].sort(), [...declarados].sort(), `${id}: materiales`);
  }
});
test('más calidad = más triángulos (Baja < Media < Alta) en cada pieza', { skip: !hasChromium }, () => {
  for (const id of ORDEN_PARTES) { assert.ok(medidas.low[id].tris < medidas.medium[id].tris && medidas.medium[id].tris < medidas.high[id].tris, `${id}: ${medidas.low[id].tris} ${medidas.medium[id].tris} ${medidas.high[id].tris}`); }
});
test('tools/lab-costes.json (medición fijada en el repo) coincide con la medición actual ±3 %', { skip: !hasChromium }, () => {
  const fijo = JSON.parse(fs.readFileSync(new URL('../tools/lab-costes.json', import.meta.url), 'utf8'));
  for (const id of ORDEN_PARTES) for (const q of ['low', 'medium', 'high']) { const n = instancias(disenoDe(id, PARTES[id].anclas[0])).length, real = medidas[q][id].tris / n; assert.ok(Math.abs(real / fijo[id][q] - 1) <= 0.03, `${id} ${q}: ${real} vs fijado ${fijo[id][q]} (corré node tools/lab-costes.mjs --escribir)`); }
});
