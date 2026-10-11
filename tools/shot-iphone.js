// Emulación de iPhone (horizontal, táctil) con Chromium: node tools/shot-iphone.js [salida.jpg] [url-extra]
import { chromium, devices } from 'playwright-core';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch();
const d = devices['iPhone 13 landscape'] || devices['iPhone 13'];
const ctx = await b.newContext({ ...d, viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3${process.argv[3] || ''}`);
await pg.waitForFunction(() => window.__api && window.__api.session, null, { timeout: 15000 });
await pg.evaluate(() => { const s = window.__api.session; s.touch = true; window.__api.touch.show(true); });
await pg.waitForTimeout(5000);
const cdp = await ctx.newCDPSession(pg);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
// palanca izquierda hacia adelante + mirar con el pulgar derecho + disparo
await touch('touchStart', [{ x: 150, y: 250, id: 1 }]); await touch('touchMove', [{ x: 150, y: 200, id: 1 }]);
await pg.waitForTimeout(1200);
const r1 = await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { z: p.pos.z, x: p.pos.x }; });
await touch('touchEnd', []);
await touch('touchStart', [{ x: 700, y: 200, id: 2 }]); await touch('touchMove', [{ x: 760, y: 200, id: 2 }]); await touch('touchEnd', []);
await touch('touchStart', [{ x: 760, y: 320, id: 3 }]); await pg.waitForTimeout(1200);
const info = await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; const i = window.__api.renderer.gl.info; return { level: window.__api.level, heading: p.heading, shots: g.stats.spawned, ammo: p.weapon, fps: window.__fps, calls: i.render.calls, tris: i.render.triangles, pr: window.__api.renderer.gl.getPixelRatio() }; });
await pg.screenshot({ path: process.argv[2] || 'shots/iphone.jpg', type: 'jpeg', quality: 78 });
await touch('touchEnd', []);
console.log(JSON.stringify({ moved: r1, ...info }), errs.slice(0, 5)); await b.close(); await srv.close();
