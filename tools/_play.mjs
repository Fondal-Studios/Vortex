import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }), b = await launch(); const errs = [];
for (const id of ['m5', 'm6']) {
  const pg = await b.newPage({ viewport: { width: 640, height: 360 } });
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(id + ' ' + m.text().slice(0, 200)); }); pg.on('pageerror', (e) => errs.push(id + ' PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/?auto=${id}&bot=1&seed=3&q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 120000 });
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 90000 });
  await pg.waitForTimeout(25000);
  console.log(id, await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return JSON.stringify({ t: g.time.toFixed(1), wave: g.wave, monstruos: g.monsters.length, hp: p.hp, pos: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)), mapa: window.__api.renderer.mapId }); }));
  await pg.close();
}
const pg = await b.newPage(); pg.on('pageerror', (e) => errs.push('lobby ' + e.message));
await pg.goto(`http://localhost:${srv.port}/`, { timeout: 120000 }); await pg.waitForTimeout(3000);
console.log(await pg.evaluate(() => [...document.querySelectorAll('[data-start]')].map((e) => e.dataset.start + ':' + (e.querySelector('b') || {}).textContent).join(' | ') + ' || ' + [...document.querySelectorAll('#coopmap option')].map((o) => o.textContent).join(',')));
console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
await b.close(); process.exit(0);
