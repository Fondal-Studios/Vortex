// Hoja de contacto de la armería (ids 0..14). Uso:
//   node tools/armeria-sheet.js <ids "0,1,2" | all> <calidades "low,high"> <carpeta> [vistas "fp,fire,close"]
// Un solo Chromium y un solo servidor para todas las capturas. Imprime draw calls / triángulos por arma.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const [, , idsArg = 'all', qArg = 'low,high', dir = 'shots/gate/armas', viewsArg = 'fp,fire,close', W = '960', H = '540'] = process.argv;
const ids = idsArg === 'all' ? [...Array(15).keys()] : idsArg.split(',').map(Number);
const NAMES = ['haz', 'prisma', 'rafaga', 'nova', 'aguja', 'pulso', 'gemelas', 'solar', 'fractal', 'enjambre', 'cometa', 'vortice', 'lanza', 'cetro', 'eclipse'];
fs.mkdirSync(dir, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const out = [];
for (const w of ids) for (const q of qArg.split(',')) for (const v of viewsArg.split(',')) {
  const pg = await b.newPage({ viewport: { width: +W, height: +H } }); const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  const query = `w=${w}&q=${q}&view=${v === 'close' ? 'close' : 'fp'}` + (v === 'fire' ? '&fire=0' : '');
  try {
    await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&${query}`);
    await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
    const shots = v === 'fire' ? [30] : [];
    await pg.evaluate(([n, dt, list]) => window.__step(n, dt, list), [v === 'fire' ? 33 : 60, 1 / 60, shots]);
    await pg.waitForTimeout(100);
    const st = await pg.evaluate(() => window.__stats());
    const f = `${dir}/${String(w).padStart(2, '0')}-${NAMES[w]}-${q}-${v}.jpg`;
    await pg.screenshot({ path: f, type: 'jpeg', quality: 88 });
    out.push({ w, q, v, ...st, errs: errs.slice(0, 3) }); console.log(f, JSON.stringify(st), errs.slice(0, 3).join('|'));
  } catch (e) { console.log('FALLO', w, q, v, e.message); }
  await pg.close();
}
fs.writeFileSync(`${dir}/stats.json`, JSON.stringify(out, null, 1));
await b.close(); await srv.close();
