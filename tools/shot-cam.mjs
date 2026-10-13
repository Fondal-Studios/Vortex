// Capturas de la cámara en 3ª persona (por defecto), con apuntado, y comprobación del botón de cámara.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const out = process.argv[2] || 'shots/cam'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const { devices } = await import('playwright-core');
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
await pg.waitForTimeout(2500);
const info = () => pg.evaluate(() => { const R = window.__api.renderer, g = window.__api.session.game, p = g.players[0]; return { third: R.third, cam: R.camera.position.toArray().map((x) => +x.toFixed(2)), pos: [p.pos.x, p.pos.y, p.pos.z].map((x) => +x.toFixed(2)), fov: +R.camera.fov.toFixed(1), camT: R.camT }; });
console.log('inicio', JSON.stringify(await info())); await pg.screenshot({ path: `${out}/3p-inicio.png` });
await pg.evaluate(() => { const g = window.__api.session.game; const p = g.players[0]; g.spawnMonster('astilla', { x: p.pos.x - 0.5, y: p.pos.y, z: p.pos.z - 14 }); });
await pg.waitForTimeout(1200); await pg.screenshot({ path: `${out}/3p-enemigo.png` });
await pg.evaluate(() => window.__setCam(false)); await pg.waitForTimeout(800); console.log('1ª', JSON.stringify(await info())); await pg.screenshot({ path: `${out}/1p.png` });
console.log('errores', JSON.stringify(errs));
await b.close(); await srv.close();
