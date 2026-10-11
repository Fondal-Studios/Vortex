// Capturas del menú de Equipo (PC y celular) y de la elección de mejoras.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
fs.mkdirSync('shots', { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
for (const [name, vp, touch] of [['equipo-pc', { width: 1280, height: 720 }, false], ['equipo-movil', { width: 844, height: 390 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); }); pg.on('pageerror', (e) => errors.push(`${name}: PAGEERR ${e.message}`));
  await pg.goto(`${base}/?q=low&autoq=0`); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const a = window.__api; a.ui.confirmTitle(); a.ui.show('loadout'); });
  await pg.waitForTimeout(3500); await pg.screenshot({ path: `shots/${name}.jpg`, type: 'jpeg', quality: 80 }); await ctx.close();
}
// elección de mejoras en partida
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const pg = await ctx.newPage();
pg.on('pageerror', (e) => errors.push('cards PAGEERR ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push('cards: ' + m.text()); });
await pg.goto(`${base}/?auto=m1&god=1&seed=3&q=low&autoq=0&nolock=1`); await pg.waitForTimeout(2500);
await pg.evaluate(() => { const g = window.__api.session.game; g.queue = []; for (const m of g.monsters) g.damageMonster(m, 1e9, g.players[0]); g.wave = 1; g.phase = 'wave'; });
await pg.waitForTimeout(3000); await pg.screenshot({ path: 'shots/mejoras.jpg', type: 'jpeg', quality: 80 });
console.log(errors.length ? errors.join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
