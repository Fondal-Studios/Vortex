// Captura la hoja de Huéspedes (public/huesped-sheet.html) con los parámetros dados. Uso: node tools/shot-sheet.mjs <salida.jpg> "<query>" [espera_ms=2500]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [, , out, query = '', wait = '2500'] = process.argv; const srv = await startServer({ port: 0 }), b = await launch(), errs = [];
const pg = await (await b.newContext({ viewport: { width: +(process.env.W || 1500), height: +(process.env.H || 560) } })).newPage(); pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/huesped-sheet.html?${query}`, { timeout: 180000 }); await pg.waitForFunction(() => window.__sheet && window.__sheet.t > 1.5, null, { timeout: 180000, polling: 500 }); await pg.waitForTimeout(+wait);
console.log(JSON.stringify(await pg.evaluate(() => window.__sheet))); await pg.screenshot({ path: out, type: 'jpeg', quality: 88, timeout: 180000 }); console.log(errs.slice(0, 5).join('\n') || 'sin errores'); await b.close(); await srv.close();
