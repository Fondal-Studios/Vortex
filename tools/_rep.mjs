import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const srv = await startServer({ port: 0 }); const b = await launch(); const { devices } = await import('playwright-core');
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); });
try { await pg.getByText('Entendido').tap({ timeout: 3000 }); } catch {}
await pg.waitForTimeout(1000);
const px = async (name) => { await pg.screenshot({ path: `/tmp/${name}.png` }); };
await px('rep0');
// forzar fin de oleada
await pg.evaluate(() => { const g = window.__api.session.game; g.queue = []; g.omens = []; for (const m of g.monsters) m.dead = true; });
await pg.waitForTimeout(2500); await px('rep1');
console.log(await pg.evaluate(() => ({ phase: window.__api.session.game.phase, cards: window.__api.session.game.players[0].cards.length, cardsVisible: !document.getElementById('cards')?.classList.contains('hidden'), lost: window.__api.renderer.lost, cam: window.__api.renderer.camera.position.toArray(), q: window.__api.renderer.camera.quaternion.toArray() })));
const card = pg.locator('#cards .card, #cards button, #cards > *').first();
console.log('cardcount', await pg.locator('#cards .card').count());
try { await card.tap({ timeout: 3000 }); } catch (e) { console.log('tap fail', e.message.slice(0, 80)); }
await pg.waitForTimeout(2500); await px('rep2');
console.log(await pg.evaluate(() => ({ phase: window.__api.session.game.phase, lost: window.__api.renderer.lost, cam: window.__api.renderer.camera.position.toArray(), q: window.__api.renderer.camera.quaternion.toArray(), fov: window.__api.renderer.camera.fov })));
console.log(JSON.stringify(errs));
await b.close(); await srv.close();
