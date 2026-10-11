// Hoja de contacto de manos. Uso: node tools/shot-hands.js salida_dir "w=0&q=high&view=close&a=25" "otro query" ... [--step=n:dt:disparos] [--size=WxH]
// Un solo Chromium; cada consulta es una captura <dir>/<n>.jpg (y el JSON de costos en stdout).
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const args = process.argv.slice(2), dir = args.shift(); const opts = {}; const queries = [];
for (const a of args) { if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); opts[k] = v; } else queries.push(a); }
const [W, H] = (opts.size || '960x600').split('x').map(Number); fs.mkdirSync(dir, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const results = [];
for (let i = 0; i < queries.length; i++) {
  const [q, stepArg] = queries[i].split('@'); const pg = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&${q}`);
  await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
  const [n, dt, shots] = (stepArg || opts.step || '40:0.016:').split(':'); const list = (shots || '').split(',').filter(Boolean).map(Number);
  await pg.evaluate(([n, dt, list]) => window.__step(n, dt, list), [+n, +dt, list]); await pg.waitForTimeout(100);
  const st = await pg.evaluate(() => window.__stats()); const file = `${dir}/${i}.jpg`; await pg.screenshot({ path: file, type: 'jpeg', quality: 88 });
  results.push({ i, q, ...st, errs: errs.slice(0, 4) }); await pg.close();
}
console.log(JSON.stringify(results)); await b.close(); await srv.close();
