// Captura rápida de un diseño de ejemplo: node tools/_lab-shot.mjs <ejemplo> <salida.jpg> [calidad] [cam] [clip]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import { codificar } from '../src/shared/host-build.js';
import { EJEMPLOS } from './_lab-ejemplos.mjs';
const [, , ej = 'media', out = '/tmp/claude-0/-home-user/4714e0e1-9d6d-5a05-870c-820a59c72dd7/scratchpad/lab.jpg', q = 'low', cams = 'full,q34,side,back', evo = '0'] = process.argv;
const srv = await startServer({ port: 0 }), br = await launch(), errs = [];
const vb = encodeURIComponent(codificar(EJEMPLOS[ej] || JSON.parse(ej)));
const imgs = [];
for (const cam of cams.split(',')) {
  const pg = await (await br.newContext({ viewport: { width: 480, height: 480 } })).newPage();
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  await pg.goto(`http://localhost:${srv.port}/huesped-arte.html?frozen=1&w=480&h=480&q=${q}&char=laboratorio&lab=${vb}&cam=${cam}&evo=${evo}&t=2`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  imgs.push(await pg.evaluate(() => { window.__render(); const s = window.__body.stats(); return { s, i: window.__info(), u: document.getElementById('c').toDataURL('image/jpeg', 0.9) }; }));
  console.log(cam, JSON.stringify(imgs.at(-1).s.meshes ? { calls: imgs.at(-1).s.calls, tris: imgs.at(-1).s.tris } : imgs.at(-1).s), JSON.stringify({ calls: imgs.at(-1).i.calls, tris: imgs.at(-1).i.tris }));
  await pg.close();
}
const sharp = null; void sharp;
imgs.forEach((x, i) => fs.writeFileSync(out.replace('.jpg', `-${i}.jpg`), Buffer.from(x.u.split(',')[1], 'base64')));
console.log('errores:', errs.slice(0, 8));
await br.close(); await srv.close();
