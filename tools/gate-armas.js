// Puerta de arte de las armas 0..14: capturas en 1ª persona (idle y disparando) en Baja/Alta, 844×390 y 1280×720.
// Uso: node tools/gate-armas.js [ids ej. 0,1,2] [calidades ej. low,high] [salida]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const ids = (process.argv[2] || [...Array(15).keys()].join(',')).split(',').map(Number);
const quals = (process.argv[3] || 'low,high').split(',');
const out = process.argv[4] || 'shots/gate/armas';
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch();
const res = {};
for (const w of ids) for (const q of quals) for (const [W, H] of [[844, 390], [1280, 720]]) {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&w=${w}&q=${q}&view=fp`);
  await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
  const id = String(w).padStart(2, '0');
  for (const mode of ['idle', 'fire']) {
    await pg.evaluate(([m]) => window.__step(m === 'idle' ? 60 : 40, 0.016, m === 'idle' ? [] : [39]), [mode]);
    await pg.waitForTimeout(100);
    const st = await pg.evaluate(() => window.__stats());
    await pg.screenshot({ path: `${out}/w${id}_${q}_${W}_${mode}.jpg`, type: 'jpeg', quality: 88 });
    res[`${id}_${q}_${W}_${mode}`] = { ...st, errs: errs.slice(0, 3) };
  }
  await pg.close();
}
fs.writeFileSync(`${out}/stats.json`, JSON.stringify(res, null, 1));
console.log(Object.entries(res).filter(([k]) => k.endsWith('844_idle') || k.endsWith('1280_idle')).map(([k, v]) => `${k} ${v.calls}c ${v.tris}t ${v.errs.length ? 'ERR ' + v.errs[0] : ''}`).join('\n'));
await b.close(); await srv.close();
