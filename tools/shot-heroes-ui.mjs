// Capturas de la pantalla de héroes (menú Equipo) en PC (1280×720) y celular horizontal táctil (844×390).
// Uso: node tools/shot-heroes-ui.mjs [salida=shots/gate/heroes] [pc|movil] [heroes: egida,lumen,...]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const out = process.argv[2] || 'shots/gate/heroes', only = process.argv[3] || '', heroes = (process.argv[4] || 'egida,lumen,forja,vigia,nova,umbra').split(',');
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const VIEWS = [['pc', { width: 1280, height: 720 }, false], ['movil', { width: 844, height: 390 }, true]].filter((v) => !only || v[0] === only);
for (const [name, vp, touch] of VIEWS) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 }); const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`${name}: ${m.text()}`); }); pg.on('pageerror', (e) => errors.push(`${name}: PAGEERR ${e.message}`));
  await pg.goto(`${base}/?q=low&autoq=0`); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const a = window.__api; a.ui.confirmTitle(); a.ui.show('loadout'); });
  await pg.waitForTimeout(800);
  for (const h of heroes) {
    await pg.evaluate((h) => { document.querySelector(`.hx-hero[data-ch="${h}"]`).click(); }, h);
    const fr = pg.frames().find((f) => f.url().includes('hero-view'));
    if (fr) { try { await fr.waitForFunction(() => window.__heroReady, null, { timeout: 90000 }); } catch (e) { errors.push(name + ' hero-view no listo: ' + e.message.slice(0, 80)); } }
    await pg.waitForTimeout(touch ? 2500 : 1800);
    await pg.screenshot({ path: `${out}/heroes-${name}-${h}.jpg`, type: 'jpeg', quality: 86 });
  }
  // pestaña de armas
  await pg.evaluate(() => document.querySelector('.hx-tab[data-tab="wp"]').click()); await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${out}/heroes-${name}-armas.jpg`, type: 'jpeg', quality: 86 });
  await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
