// El botón EVOLUCIONAR abre «Elegí tu camino»; elegir aplica ESE camino (excluyente) y la partida sigue. Habilidades 1 y 2 visibles en el HUD básico.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();

test('táctil: EVOLUC. abre la elección, elegir el 2.º camino lo aplica; habilidades visibles y usables', { skip: !hasChromium, timeout: 150000 }, async () => {
  const { launch } = await import('../tools/browser.js'); const { devices } = await import('playwright-core');
  const srv = await startServer({ port: 0 }); const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
    await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
    await pg.waitForTimeout(800);
    for (const a of ['mov', 'esp']) assert.ok(await pg.locator(`[data-a="${a}"]`).isVisible(), `habilidad ${a} visible en el HUD básico`);
    const mv = await pg.locator('[data-a="mov"]').boundingBox(); const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mv.x + mv.width / 2, y: mv.y + mv.height / 2, id: 7 }] }); await pg.waitForTimeout(250); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pg.waitForTimeout(300); assert.ok(await pg.evaluate(() => window.__api.session.game.players[0].movCd > 0), 'la habilidad 1 se usó desde el botón');
    await pg.evaluate(() => { window.__api.session.game.players[0].cores = 100; });
    const ev = pg.locator('[data-a="evo"]'); await ev.waitFor({ state: 'visible', timeout: 15000 }); assert.ok(await ev.isVisible(), 'aparece EVOLUC.');
    const eb = await ev.boundingBox(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eb.x + eb.width / 2, y: eb.y + eb.height / 2, id: 8 }] }); await pg.waitForTimeout(200); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pg.waitForTimeout(500); assert.ok(await pg.locator('#evochoice .ec-opt').first().isVisible(), 'se abre «Elegí tu camino»');
    assert.equal(await pg.evaluate(() => window.__api.session.game.players[0].evo), 0, 'abrir la elección no evoluciona solo');
    assert.equal(await pg.locator('#evochoice .ec-opt').count(), 2); await pg.screenshot({ path: '/tmp/evochoice.png' });
    console.log('opciones', await pg.evaluate(() => [...document.querySelectorAll('#evochoice .ec-opt')].map((b) => b.dataset.i + ':' + b.querySelector('b').textContent)), await pg.evaluate(() => document.querySelectorAll('#evochoice').length));
    await pg.evaluate(() => { const g = window.__api.session.game, o = g.setInput.bind(g); window.__evlog2 = []; g.setInput = (id, i) => { if (i.evo) window.__evlog2.push(i.evo); return o(id, i); }; });
    await pg.locator('#evochoice .ec-opt').nth(1).dispatchEvent('pointerdown'); await pg.waitForTimeout(1200);
    console.log('evolog', await pg.evaluate(() => JSON.stringify(window.__evlog2)));
    const p = await pg.evaluate(() => { const q = window.__api.session.game.players[0]; return { evo: q.evo, path: q.path, paused: window.__api.session.paused }; });
    assert.equal(p.evo, 1); assert.deepEqual(p.path, ['coraza'], 'se aplicó el camino elegido'); assert.equal(p.paused, false, 'la partida sigue');
    assert.deepEqual(errs, [], errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});
