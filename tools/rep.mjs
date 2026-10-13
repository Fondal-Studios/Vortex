// Regresión: tarjetas de evolución (rama excluyente) no deben romper la interfaz ni dejar la pantalla negra.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch(); const { devices } = await import('playwright-core');
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
await pg.waitForTimeout(800);
await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0], w = p.slots[1]; p.upg[w] = { dmg: 2, rate: 1, mag: 0, mod: 'cadena', mut: null }; p.cards = [{ w, k: 'mut', mod: 'cadena', mut: 'sinapsis' }, { w, k: 'mut', mod: 'cadena', mut: 'tormenta' }, { w: p.slots[2], k: 'dmg' }]; g.phase = 'intermission'; g.phaseT = 30; });
await pg.waitForTimeout(1500);
console.log('cartas visibles:', await pg.evaluate(() => [...document.querySelectorAll('#cardlist .ucard')].map((x) => x.innerText.replace(/\n/g, ' | '))));
await pg.screenshot({ path: '/tmp/rep1.png' });
await pg.locator('#cardlist .ucard').first().dispatchEvent('pointerdown'); await pg.waitForTimeout(2500);
const r = await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { mut: p.upg[p.slots[1]].mut, phase: g.phase, cam: window.__api.renderer.camera.position.toArray().map((x) => +x.toFixed(2)), q: window.__api.renderer.camera.quaternion.toArray().map((x) => +x.toFixed(2)), hudErr: window.__hudErr ? String(window.__hudErr) : null }; });
console.log(JSON.stringify(r)); await pg.screenshot({ path: '/tmp/rep2.png' });
console.log(JSON.stringify(await pg.evaluate(() => { const R = window.__api.renderer; return { wakeT: R.wakeT, wakeDur: R.wakeDur, shake: R.shake, upSm: R.upSm && R.upSm.toArray(), comfort: R.comfort, fov: R.fovNow, camAge: R.camAge }; })));
console.log('errores:', JSON.stringify(errs));
await b.close(); await srv.close();
