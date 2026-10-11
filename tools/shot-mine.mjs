// uso: node tools/shot-mine.mjs out1.jpg "k=ariete&..."  out2.jpg "..."  (un solo Chromium)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
for (let i = 2; i < process.argv.length; i += 2) {
  await pg.goto(`http://localhost:${srv.port}/public/viewer-mine.html?${process.argv[i + 1]}`);
  await pg.waitForFunction(() => window.__viewerReady, null, { timeout: 120000 }).catch(() => {});
  await pg.waitForTimeout(800);
  console.log(process.argv[i], JSON.stringify(await pg.evaluate(() => window.__info)));
  await pg.screenshot({ path: process.argv[i], type: 'jpeg', quality: 82 });
}
console.log(errs.slice(0, 6)); await b.close(); await srv.close();
