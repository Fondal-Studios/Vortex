import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Pantalla «Gráficos» en un navegador real (Chromium por software): se llega desde el menú principal, los presets y la resolución se aplican EN VIVO,
// lo elegido se recuerda al recargar, Automático se puede apagar, el medidor de FPS aparece y el botón de la Pausa abre el mismo panel.
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });
const nueva = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 }, ...opts }), pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errores.push(m.text().slice(0, 200)); });
  return { ctx, pg, errores };
};

test('menú principal › Gráficos: presets, resolución y efectos se aplican en vivo y se recuerdan', { skip: !hasChromium, timeout: 400000 }, async () => {
  const { ctx, pg, errores } = await nueva();
  await pg.goto(`${base}/?autoq=0&nolock=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });   // (sin ?q= para que mande lo guardado)
  await pg.waitForFunction('window.__api && window.__api.ui', null, { timeout: 300000 });
  await pg.evaluate(() => { window.__api.ui.confirmTitle(); });
  const item = pg.locator('#mainlist [data-go=graficos]'); await item.waitFor({ timeout: 20000 }); assert.match(await item.innerText(), /gráficos/i);
  await item.click(); await pg.waitForSelector('#graficos.on .gr-card', { timeout: 20000 });
  // 4 tarjetas con para quién sirve
  const cards = await pg.$$eval('#graficos .gr-card', (c) => c.map((x) => x.innerText));
  assert.equal(cards.length, 4); assert.ok(cards.some((t) => /iPhone/.test(t)), 'dice para qué equipo sirve'); assert.ok(cards.every((t) => /\w{20}/.test(t)));
  assert.ok(await pg.locator('#graficos .gr-tag:visible').count() >= 1, 'marca el recomendado');
  const pr = () => pg.evaluate(() => window.__api.renderer.gl.getPixelRatio());
  const nivel = () => pg.evaluate(() => window.__api.level);
  await pg.click('#graficos [data-preset=baja]'); assert.equal(await nivel(), 'low');
  const prBaja = await pr();
  await pg.click('#graficos [data-preset=alta]'); assert.equal(await nivel(), 'high'); assert.ok(await pr() >= prBaja, 'Alta ≥ resolución de Baja');
  assert.equal(await pg.evaluate(() => window.__api.renderer.gl.shadowMap.enabled), true, 'Alta enciende las sombras');
  await pg.click('#graficos [data-preset=baja]');
  // interruptor suelto: sombras en Baja, en vivo
  await pg.click('#graficos [data-op=sombras][data-v=true]'); assert.equal(await pg.evaluate(() => window.__api.renderer.gl.shadowMap.enabled), true);
  await pg.click('#graficos [data-op=sombras][data-v=false]'); assert.equal(await pg.evaluate(() => window.__api.renderer.gl.shadowMap.enabled), false);
  // resolución: el slider baja la resolución interna sin reconstruir
  const p100 = await pr(); await pg.evaluate(() => { window.__marca = 1; });
  await pg.click('#graficos [data-esc="-1"]'); await pg.click('#graficos [data-esc="-1"]');
  assert.ok(await pr() <= p100 * 0.95 + 1e-6, 'bajó la resolución'); assert.equal(await pg.textContent('#graficos [data-esc-out]'), '90 %');
  assert.match(await pg.textContent('#graficos [data-sum]'), /90 %/);
  await pg.fill('#graficos .gr-range', '150'); await pg.dispatchEvent('#graficos .gr-range', 'input'); assert.ok(await pr() > p100 * 1.2, '150 % = más resolución');
  // FPS 30 + medidor + automático
  await pg.click('#graficos [data-op=fps][data-i="0"]'); assert.equal(await pg.evaluate(() => window.__api.renderer.level && JSON.parse(localStorage.getItem('cristal.graficos.v1')).ajustes.fps), 30);
  await pg.click('#graficos [data-med=true]'); await pg.waitForSelector('#fpsmeter', { timeout: 5000 }); assert.match(await pg.textContent('#fpsmeter'), /FPS/);
  await pg.click('#graficos [data-auto=false]'); assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem('cristal.graficos.v1')).auto), false);
  // se recuerda al recargar
  await pg.reload(); await pg.waitForFunction('window.__api && window.__api.ui', null, { timeout: 300000 });
  const g = await pg.evaluate(() => JSON.parse(localStorage.getItem('cristal.graficos.v1')));
  assert.equal(g.preset, 'baja'); assert.equal(g.ajustes.escala, 150); assert.equal(g.ajustes.fps, 30); assert.equal(g.medidor, true); assert.equal(g.auto, false);
  assert.ok(await pg.locator('#fpsmeter').count() === 1, 'el medidor sigue prendido');
  assert.equal(await pg.evaluate(() => window.__api.level), 'low'); assert.ok(Math.abs(await pr() - 1.5) < 0.01, 'resolución 150 % recordada');
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.locator('#mainlist [data-go=graficos]').click();
  await pg.click('#graficos [data-reset]'); assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem('cristal.graficos.v1')).preset), 'auto');
  assert.deepEqual(errores, []); await ctx.close();
});

test('?q=low manda sobre lo guardado (herramientas y pruebas) y el botón de la Pausa abre el mismo panel dentro de la partida', { skip: !hasChromium, timeout: 400000 }, async () => {
  const { ctx, pg, errores } = await nueva();
  await pg.addInitScript(() => { try { if (!localStorage.getItem('cristal.graficos.v1')) localStorage.setItem('cristal.graficos.v1', JSON.stringify({ preset: 'alta', auto: true, medidor: false, ajustes: { escala: 150 } })); } catch { /* ok */ } });
  await pg.goto(`${base}/?auto=m1&bot=1&god=1&q=low&autoq=0&nolock=1&skipintro=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 300000 });
  assert.equal(await pg.evaluate(() => window.__api.level), 'low'); assert.ok(await pg.evaluate(() => window.__api.renderer.gl.getPixelRatio()) <= 1.0001, '?q=low ignora el 150 % guardado');
  await pg.evaluate(() => { document.getElementById('pause').classList.remove('hidden'); });
  await pg.click('#gfxopen'); await pg.waitForSelector('#graf-over .gr-card', { timeout: 10000 });
  await pg.click('#graf-over [data-preset=media]'); assert.equal(await pg.evaluate(() => window.__api.level), 'medium');
  await pg.keyboard.press('Escape'); assert.equal(await pg.locator('#graf-over').count(), 0, 'Esc cierra el panel');
  assert.ok(await pg.locator('#pause:not(.hidden)').count() === 1, 'la pausa sigue ahí');
  assert.deepEqual(errores, []); await ctx.close();
});

test('en un teléfono táctil (iPhone, apaisado) el panel cabe sin desbordar y los botones son grandes', { skip: !hasChromium, timeout: 400000 }, async () => {
  const { ctx, pg, errores } = await nueva({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await pg.goto(`${base}/?autoq=0&nolock=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await pg.waitForFunction('window.__api && window.__api.ui', null, { timeout: 300000 });
  assert.equal(await pg.evaluate(() => window.__api.level), 'low', 'iPhone ⇒ Baja por defecto');
  await pg.evaluate(() => { window.__api.ui.confirmTitle(); window.__api.ui.show('graficos'); }); await pg.waitForSelector('#graficos.on .gr-card');
  const m = await pg.evaluate(() => {
    const r = document.querySelector('#graficos'), btns = [...r.querySelectorAll('.gr-opt, .gr-card, .gr-step')].filter((b) => b.offsetParent);
    return { dx: r.scrollWidth - r.clientWidth, chicos: btns.filter((b) => b.getBoundingClientRect().height < 40).length, total: btns.length };
  });
  assert.ok(m.dx <= 2, `sin desborde horizontal (${m.dx})`); assert.equal(m.chicos, 0, 'botones táctiles ≥ 40 px'); assert.ok(m.total > 20);
  await pg.tap('#graficos [data-preset=media]'); assert.equal(await pg.evaluate(() => window.__api.level), 'medium');
  assert.deepEqual(errores, []); await ctx.close();
});
