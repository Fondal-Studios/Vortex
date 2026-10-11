// uso: node tools/shot-mine.mjs out1.jpg "k=ariete&..."  out2.jpg "..."  (un solo Chromium)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const errs = [];
for (let i = 2; i < process.argv.length; i += 2) {
  const b = await launch(); const pg = await b.newPage({ viewport: { width: 960, height: 600 } });
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  try {
  await pg.goto(`http://localhost:${srv.port}/public/viewer-mine.html?${process.argv[i + 1]}`, { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForFunction(() => window.__viewerReady, null, { timeout: 240000 }).catch(() => {});
  await pg.waitForTimeout(800);
  console.log(process.argv[i], JSON.stringify(await pg.evaluate(() => window.__info)));
  await pg.screenshot({ path: process.argv[i], type: 'jpeg', quality: 82 });
  } catch (e) { console.log('FALLO', process.argv[i], String(e).slice(0, 120)); }
  await b.close();
}
console.log(errs.slice(0, 6)); await srv.close();
