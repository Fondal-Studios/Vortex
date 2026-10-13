// Comprueba el botón de cámara (1ª/3ª persona), la persistencia y saca capturas en tercera persona.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const out = process.argv[2] || 'shots/cam'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const { devices } = await import('playwright-core');
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); });
await pg.waitForTimeout(1500);
const vis = await pg.evaluate(() => !document.getElementById('camquick').classList.contains('hidden'));
try { await pg.getByText('Entendido').tap({ timeout: 3000 }); } catch {} await pg.waitForTimeout(500); await pg.locator('#camquick').tap(); await pg.waitForTimeout(1500);
const third = await pg.evaluate(() => window.__api.renderer.third); const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('cristal.ajustes.v2') || '{}').third);
await pg.screenshot({ path: `${out}/tercera.png` });
console.log(JSON.stringify({ visibleBoton: vis, tercera: third, guardado: saved, errs }));
await b.close(); await srv.close();
