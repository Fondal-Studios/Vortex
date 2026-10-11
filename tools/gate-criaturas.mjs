// Capturas del visor para el ART GATE de criaturas. Uso: node tools/gate-criaturas.mjs <salida> "k=graviton&q=low&dist=6&s=charge" ... (una captura por argumento)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const out = process.argv[2]; const specs = process.argv.slice(3);
const srv = await startServer({ port: 0 }); const b = await launch();
const wait = +process.env.WAIT || 3500;
for (const spec of specs) {
  const pg = await b.newPage({ viewport: { width: +process.env.W || 800, height: +process.env.H || 600 } });
  const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/public/viewer.html?${spec}`);
  await pg.waitForTimeout(wait);
  const name = spec.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
  await pg.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85 });
  const info = await pg.evaluate(() => window.__info || null);
  console.log(name, errs.slice(0, 3).join(' | '), info ? JSON.stringify(info) : '');
  await pg.close();
}
await b.close(); await srv.close();
