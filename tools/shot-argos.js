// Capturas de Argos y del ojo orbital: node tools/shot-argos.js [carpeta=/tmp/argos] [calidad=high] [ancho=900] [alto=560]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const out = process.argv[2] || '/tmp/argos', Q = process.argv[3] || 'high', W = +process.argv[4] || 900, H = +process.argv[5] || 560;
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch();
const shots = [['reposo', 's=idle&sd=1', 40], ['mirada', 's=gaze&sd=1', 70], ['aturdido', 's=stagger&sd=0', 60], ['sin-escudo', 's=idle&sd=0', 40], ['fase3', 's=idle&sd=1&hp=0.2', 60], ['ojos', 'ojo=1', 20]];
for (const [name, qs, frames] of shots) {
  const pg = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/public/viewer-argos.html?cap=1&q=${Q}&${qs}`);
  await pg.waitForFunction(() => window.__viewerReady, null, { timeout: 120000 });
  const info = await pg.evaluate((n) => { for (let i = 0; i < n; i++) window.__vframe(50, i === n - 1); return window.__info(); }, frames);
  await pg.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  console.log(name, JSON.stringify(info), errs.slice(0, 4)); await pg.close();
}
await b.close(); await srv.close();
