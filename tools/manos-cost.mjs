// Costo de manos+brazos por arma (Baja y Alta): diferencia de draw calls y triángulos entre el arma con y sin manos (visor "close").
// Uso: node tools/manos-cost.mjs [ids ej. 0,1,2,...] [calidades ej. low,high]  → imprime una tabla y escribe shots/gate/manos/costos.json
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const ids = (process.argv[2] || [...Array(25).keys()].join(',')).split(',').map(Number), quals = (process.argv[3] || 'low,high').split(',');
const srv = await startServer({ port: 0 }), b = await launch(), res = {};
async function measure(w, q, h) {
  const pg = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&w=${w}&q=${q}&view=close&h=${h}`, { timeout: 180000 });
  await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
  await pg.evaluate(() => window.__step(8, 0.016, [])); const st = await pg.evaluate(() => window.__stats()); await pg.close(); return { ...st, errs };
}
for (const q of quals) for (const w of ids) {
  const a = await measure(w, q, 0), c = await measure(w, q, 1);
  res[`${q}_${w}`] = { calls: c.calls - a.calls, tris: c.tris - a.tris, errs: c.errs.slice(0, 2) };
  console.log(q, String(w).padStart(2), `+${c.calls - a.calls} calls  +${c.tris - a.tris} tris`, c.errs.length ? 'ERR ' + c.errs[0] : '');
}
fs.mkdirSync('shots/gate/manos', { recursive: true }); fs.writeFileSync('shots/gate/manos/costos.json', JSON.stringify(res, null, 1));
await b.close(); await srv.close();
