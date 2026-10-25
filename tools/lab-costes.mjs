// Mide el coste REAL de cada pieza del Laboratorio (triángulos por instancia y materiales) en Baja, Media y Alta y lo compara con la tabla del catálogo
// (src/shared/host-build-catalogo.js, `tris`). Escribe tools/lab-costes.json (la medición «fijada» en el repo) y muestra las diferencias.
// Uso: node tools/lab-costes.mjs [--escribir]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import { PARTES, ORDEN_PARTES, instancias } from '../src/shared/host-build.js';
import { disenoDe, medirPiezas } from './lab-medir.mjs';
const srv = await startServer({ port: 0 }), br = await launch(), base = `http://localhost:${srv.port}`, out = {};
for (const q of ['low', 'medium', 'high']) {
  const m = await medirPiezas(br, base, q); if (m.__errores.length) console.log('errores', q, m.__errores.slice(0, 3));
  for (const id of ORDEN_PARTES) { const n = instancias(disenoDe(id, PARTES[id].anclas[0])).length; (out[id] = out[id] || {})[q] = Math.round(m[id].tris / n); out[id].mats = m[id].mats; }
}
for (const id of ORDEN_PARTES) { const t = PARTES[id].tris, o = out[id]; console.log(id.padEnd(20), ['low', 'medium', 'high'].map((q) => `${q}: tabla ${t[q]} medido ${o[q]} (${((o[q] / t[q] - 1) * 100).toFixed(0)} %)`).join(' | '), '| mats', o.mats.join(',')); }
if (process.argv.includes('--escribir')) fs.writeFileSync(new URL('./lab-costes.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
await br.close(); await srv.close();
