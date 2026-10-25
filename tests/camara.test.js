// Regresión: el snapshot trae un «arriba» válido por jugador (antes se pisaba con las mejoras de armas → cámara degenerada / pantalla negra al elegir tarjetas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { startServer } from '../server/server.js';

import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();

test('snapshot: up es un vector unitario y las mejoras viajan en ug', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer('t'); p.upg[p.slots[1]] = { dmg: 1, rate: 0, mag: 0, mod: 'cadena', mut: 'sinapsis' };
  const s = g.snapshot().players[0]; assert.equal(s.up.length, 3); assert.ok(Math.abs(Math.hypot(...s.up) - 1) < 0.01, 'up unitario'); assert.ok(Array.isArray(s.ug) && s.ug.length === 5);
  assert.equal(s.ug[1][4], 'sinapsis');
});

test('navegador: cámara finita y unitaria; apuntar arriba/abajo mueve la mira; elegir tarjeta de evolución no deja la pantalla negra', { skip: !hasChromium, timeout: 120000 }, async () => {
  const { launch } = await import('../tools/browser.js'); const { devices } = await import('playwright-core');
  const srv = await startServer({ port: 0 }); const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
    await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
    await pg.waitForTimeout(800);
    const cam = () => pg.evaluate(() => { const R = window.__api.renderer, q = R.camera.quaternion; return { p: R.camera.position.toArray(), n: Math.hypot(q.x, q.y, q.z, q.w), aimY: R.aim ? R.aim.y : null }; });
    const c0 = await cam(); assert.ok(c0.p.every(Number.isFinite) && Math.abs(c0.n - 1) < 1e-3, `cámara válida ${JSON.stringify(c0)}`);
    const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
    await T('touchStart', [{ x: 600, y: 250, id: 1 }]); for (let i = 1; i <= 10; i++) { await T('touchMove', [{ x: 600, y: 250 - i * 14, id: 1 }]); await pg.waitForTimeout(25); } await T('touchEnd', []); await pg.waitForTimeout(500);
    const up = await cam(); await T('touchStart', [{ x: 600, y: 100, id: 2 }]); for (let i = 1; i <= 14; i++) { await T('touchMove', [{ x: 600, y: 100 + i * 14, id: 2 }]); await pg.waitForTimeout(25); } await T('touchEnd', []); await pg.waitForTimeout(500);
    const down = await cam(); assert.ok(up.aimY > c0.aimY + 0.1, `deslizar hacia arriba mira arriba (${c0.aimY} → ${up.aimY})`); assert.ok(down.aimY < up.aimY - 0.1, 'hacia abajo mira abajo');
    await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0], w = p.slots[1]; p.upg[w] = { dmg: 2, rate: 1, mag: 0, mod: 'cadena', mut: null }; p.cards = [{ w, k: 'mut', mod: 'cadena', mut: 'sinapsis' }, { w, k: 'mut', mod: 'cadena', mut: 'tormenta' }, { w: p.slots[2], k: 'dmg' }]; g.phase = 'intermission'; g.phaseT = 30; });
    await pg.waitForTimeout(1200); assert.equal(await pg.locator('#cardlist .ucard').count(), 3);
    await pg.locator('#cardlist .ucard').first().dispatchEvent('pointerdown'); await pg.waitForTimeout(2000);
    const after = await cam(); assert.ok(after.p.every(Number.isFinite) && Math.abs(after.n - 1) < 1e-3, 'tras elegir la tarjeta la cámara sigue válida (no pantalla negra)');
    assert.equal(await pg.evaluate(() => { const p = window.__api.session.game.players[0]; return p.upg[p.slots[1]].mut; }), 'sinapsis');
    assert.deepEqual(errs, [], errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});

test('navegador: todos los tipos de tarjeta (mejora, mutación, órgano de arma, órgano de cuerpo) se muestran sin error', { skip: !hasChromium, timeout: 120000 }, async () => {
  const { launch } = await import('../tools/browser.js'); const { devices } = await import('playwright-core');
  const srv = await startServer({ port: 0 }); const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
    await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
    await pg.waitForTimeout(800);
    const sets = [
      (p) => [{ w: p.slots[1], k: 'organ', t: 'w', id: 'glandula_osea' }, { w: p.slots[0], k: 'organ', t: 'c', id: 'placas' }, { w: p.slots[2], k: 'dmg' }],
      (p) => [{ w: p.slots[1], k: 'forma', forma: 'alba' }, { w: p.slots[1], k: 'forma', forma: 'ocaso' }, { w: p.slots[2], k: 'dmg' }],
      (p) => [{ w: p.slots[1], k: 'mod', mod: 'cadena' }, { w: p.slots[2], k: 'rate' }, { w: p.slots[3], k: 'mag' }],
    ];
    for (const mk of sets) {
      await pg.evaluate((src) => { const g = window.__api.session.game, p = g.players[0]; p.ess = { carne: 50, cristal: 50, ojo: 50, vacio: 50 }; p.cards = eval('(' + src + ')')(p).map((c) => ({ ...c, mod: c.forma || c.mod })); g.phase = 'intermission'; g.phaseT = 30; }, mk.toString());
      await pg.waitForTimeout(1200); assert.equal(await pg.locator('#cardlist .ucard').count(), 3); assert.equal(await pg.evaluate(() => (window.__hudErr ? String(window.__hudErr) : null)), null);
      await pg.locator('#cardlist .ucard').first().dispatchEvent('pointerdown'); await pg.waitForTimeout(1500);
    }
    assert.deepEqual(errs, [], errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});
