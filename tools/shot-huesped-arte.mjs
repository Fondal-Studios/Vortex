// Capturas del visor de arte de los Huéspedes: node tools/shot-huesped-arte.mjs <carpeta> "<consulta1>" "<consulta2>" …  (cada consulta = parámetros de public/huesped-arte.html)
// Ej.: node tools/shot-huesped-arte.mjs shots/huespedes-arte "char=axioma&q=low&cam=full" "char=axioma&q=high&cam=q34&evo=4&pth=coraza,resonancia,simbiosis,apoteosis"
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [, , out, ...queries] = process.argv; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`;
let i = 0;
for (const q of queries) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } }), pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const name = (q.match(/(?:^|&)n=([^&]+)/) || [])[1] || String(i + 1);
  await pg.goto(`${base}/huesped-arte.html?frozen=1&w=900&h=900&${q}`, { waitUntil: 'domcontentloaded' });
  try { await pg.waitForFunction(() => window.__ready, null, { timeout: 90000 }); } catch (e) { console.log('NO LISTO', q, errs.slice(0, 5)); }
  await pg.waitForTimeout(2500); await pg.evaluate(() => { window.__advance(0.05); window.__render(); }); await pg.waitForTimeout(200);
  const info = await pg.evaluate(() => window.__info && window.__info()).catch(() => null);
  await pg.screenshot({ path: `${out}/${name}.png` }); i++;
  console.log(`${name}.png`, q, JSON.stringify(info && { calls: info.calls, tris: info.tris, kit: info.meshes && info.meshes.map((m) => m.join(':')).join(' ') }), errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : '');
  await ctx.close();
}
await b.close(); await srv.close();
