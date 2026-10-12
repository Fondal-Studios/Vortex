// Capturas de la pantalla «Elegí tu Huésped» para los 5 Huéspedes (+ un veterano) en 4 tamaños. Uso: node tools/shot-huespedes.js [carpeta]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/huespedes'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const VPS = [['844x390', 844, 390, true], ['667x375', 667, 375, true], ['390x844', 390, 844, true], ['1280x720', 1280, 720, false]];
const IDS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'egida'];
for (const [vn, w, h, touch] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${vn}: ${m.text()}`); });
  await pg.goto(`${base}/?q=low&autoq=0`); await pg.waitForTimeout(1200); await pg.evaluate(() => window.__api.ui.confirmTitle());
  await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForTimeout(1500);
  for (const id of IDS) {
    await pg.evaluate((id) => window.__api.ui.hs.select(id, true), id); await pg.waitForTimeout(id === 'egida' ? 2500 : 900);
    await pg.screenshot({ path: `${OUT}/${vn}-${id}.png` });
  }
  await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores JS'); await b.close(); await srv.close();
