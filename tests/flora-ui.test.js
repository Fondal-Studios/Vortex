import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { ESP_IDS } from '../src/sim/flora-data.js';

// Pestaña «Herbario» del Bestiario y opciones de vegetación del menú Gráficos, en un navegador real (Chromium por software).
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('Herbario: pestaña junto a Fauna, 22 casillas, descubrir una planta la revela, Forja de jardín y los hitos; opciones de vegetación en Gráficos', { skip: !hasChromium, timeout: 900000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } }), pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errores.push(m.text().slice(0, 200)); });
  await pg.addInitScript(() => { try { localStorage.setItem('cristal.perfil.v1', JSON.stringify({ ver: 2, cores: 500, materiales: { savia: [0, 9, 0, 0], fibra: [9, 0, 0, 0] }, herbario: { vistas: { flor_luz: 2, liana_ancla: 1, hongo_anima: 1 }, cosechas: { flor_luz: 3 }, hitos: [] } })); } catch { /* sin almacenamiento */ } });
  await pg.goto(`${base}/?autoq=0&nolock=1&q=low`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await pg.waitForFunction('window.__api && window.__api.ui', null, { timeout: 300000 });
  await pg.evaluate(() => { window.__api.ui.confirmTitle(); window.__api.ui.go('bestiary'); });
  await pg.waitForSelector('#btabs .bt-tab[data-t=h]', { timeout: 60000 });
  assert.equal(await pg.locator('#btabs .bt-tab').count(), 3, 'Criaturas · Fauna · Herbario');
  await pg.click('#btabs .bt-tab[data-t=h]');
  assert.equal(await pg.locator('#bgrid .bcell').count(), ESP_IDS.length, '22 casillas');
  assert.ok(await pg.locator('#hb-card').isVisible(), 'panel del Herbario');
  const txt = await pg.locator('#hb-card').innerText(); assert.match(txt, /Herbario/); assert.match(txt, /3\/22 especies/); assert.match(txt, /MEJORAS DEL HERBARIO/); assert.match(txt, /Botiquín orgánico/);
  assert.equal(await pg.locator('#bestiary #bdetail').isVisible(), false, 'oculta el panel de criaturas');
  // una descubierta muestra su ficha; una no descubierta no revela el nombre
  await pg.click('#bgrid .bcell[data-i="0"]'); const f0 = await pg.locator('#hb-card').innerText(); assert.match(f0, /Flor de Luz Mala/); assert.match(f0, /Contrajuego/); assert.match(f0, /petalo|Pétalo/i);
  await pg.click('#bgrid .bcell[data-i="10"]'); const f10 = await pg.locator('#hb-card').innerText(); assert.match(f10, /\?\?\?/); assert.doesNotMatch(f10, /Boca del Jardín/);
  // la Forja de jardín fabrica el botiquín orgánico con materiales vegetales
  await pg.click('#bgrid .bcell[data-i="21"]'); await pg.click('#btabs .bt-tab[data-t=h]');
  await pg.locator('#hb-card button.fab[data-fab=botiquin_organico]').click(); const bot = await pg.evaluate(() => JSON.parse(localStorage.getItem('cristal.perfil.v1')).consum.botiquin); assert.equal(bot, 1, 'el botiquín se sumó al perfil');
  // volver a Fauna / Criaturas limpia el Herbario
  await pg.click('#btabs .bt-tab[data-t=f]'); assert.equal(await pg.locator('#hb-card').isVisible(), false);
  await pg.click('#btabs .bt-tab[data-t=c]'); assert.equal(await pg.locator('#bestiary #bdetail').isVisible(), true);
  // opciones de vegetación en el menú Gráficos
  await pg.evaluate(() => window.__api.ui.go('graficos')); await pg.waitForSelector('#graficos.on .gr-card', { timeout: 60000 });
  assert.ok(await pg.locator('#graficos [data-op=vegetacion]').count() >= 1, 'interruptor «Vegetación decorativa»'); assert.ok(await pg.locator('#graficos [data-op=vegDens]').count() >= 3, '«Densidad de vegetación»: Poca / Normal / Mucha');
  await pg.click('#graficos [data-op=vegDens][data-i="2"]'); assert.equal(await pg.evaluate(() => window.__api.renderer.flfx.q.dens), 3, 'se aplica en vivo');
  await pg.click('#graficos [data-op=vegetacion][data-v=false]'); assert.equal(await pg.evaluate(() => window.__api.renderer.flfx.q.veg), false);
  assert.deepEqual(errores, [], 'sin errores de consola'); await ctx.close();
});
