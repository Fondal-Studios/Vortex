// Captura la PAUSA simple de una partida (Continuar · Modo · Gráficos · Controles y cámara · Salir) en celular horizontal y PC (en vertical el juego pide girar el teléfono). Uso: node tools/shot-pausa.js <carpeta>
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/menu5'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
for (const [vn, w, h, touch] of [['movilH', 844, 390, true], ['pc', 1280, 720, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`)); pg.setDefaultTimeout(120000);
  await pg.goto(`${base}/?q=low&autoq=0&skipintro=1`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui);
  await pg.evaluate(() => { window.__api.ui.confirmTitle(); window.__api.ui.actions.arena('practica'); });
  await pg.waitForFunction(() => window.__api.session && window.__api.session.game, null, { timeout: 120000 }); await pg.waitForTimeout(2500);
  if (touch) await pg.evaluate(() => { const p = document.getElementById('pause'); p.classList.remove('hidden'); window.__api.ui.active = false; });
  await pg.evaluate(() => document.getElementById('pause').classList.remove('hidden')); await pg.waitForSelector('#pause:not(.hidden)'); await pg.waitForTimeout(500);
  const abiertos = await pg.evaluate(() => [...document.querySelectorAll('#pause .pbox > .list > *')].filter((e) => e.getClientRects().length).map((e) => (e.id || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)));
  console.log(vn, 'entradas visibles de la pausa:', abiertos.join(' '));
  await pg.screenshot({ path: `${OUT}/${vn}-pausa.jpg`, type: 'jpeg', quality: 72 });
  await pg.evaluate(() => { document.getElementById('pmas').open = true; }); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/${vn}-pausa-controles.jpg`, type: 'jpeg', quality: 72 });
  await ctx.close();
}
console.log(errors.length ? 'ERRORES JS:\n' + errors.join('\n') : 'sin errores JS'); await b.close(); await srv.close(); process.exit(errors.length ? 1 : 0);
