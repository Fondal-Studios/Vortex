// Capturas de armas. Uso:
//   node tools/shot-weapons.js "w=0&q=high&view=fp" salida.jpg [paso]   (paso = "n:dt:disparos", ej. "90:0.016:60,70")
// Avanza el reloj a mano (modo cap=1) y dibuja el último cuadro.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [, , query = 'w=0&q=high', out = '/tmp/w.jpg', stepArg = '40:0.016:', W = '1280', H = '720'] = process.argv;
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&${query}`);
await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 60000 });
const [n, dt, shots] = stepArg.split(':'); const list = (shots || '').split(',').filter(Boolean).map(Number);
await pg.evaluate(([n, dt, list]) => window.__step(n, dt, list), [+n, +dt, list]);
await pg.waitForTimeout(150);
const st = await pg.evaluate(() => window.__stats());
await pg.screenshot({ path: out, type: 'jpeg', quality: 85 });
console.log(JSON.stringify(st), errs.slice(0, 8)); await b.close(); await srv.close();
