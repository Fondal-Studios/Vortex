// Prueba de extremo a extremo en Chromium real: ruta de entrada humana (teclado + ratón), HUD y sin errores de consola.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';

/** Espera tiempo de SIMULACIÓN (no de reloj): el render por software puede ir lento. */
const simWait = (pg, secs) => pg.evaluate((d) => new Promise((r) => { const g = window.__api.session.game, t0 = g.time; const iv = setInterval(() => { if (g.time - t0 >= d) { clearInterval(iv); r(); } }, 30); }), secs);
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();

test('e2e: un humano (teclas + ratón) se mueve, apunta, cambia de arma, dispara y el HUD responde', { skip: !hasChromium, timeout: 90000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&nolock=1&seed=2&q=low&autoq=0`);
    await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 15000 });
    const me = () => pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { pos: { ...p.pos }, h: { ...p.heading }, w: p.weapon, kills: p.kills, ammo: [...p.ammo].map((a) => (a === Infinity ? -1 : a)), shots: g.stats.spawned }; });
    const a = await me();
    await pg.keyboard.down('KeyW'); await simWait(pg, 1.2); await pg.keyboard.up('KeyW');
    const b1 = await me();
    assert.ok(Math.hypot(b1.pos.x - a.pos.x, b1.pos.z - a.pos.z) > 4, 'W mueve al jugador');
    await pg.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 300, movementY: 0 })));
    await simWait(pg, 0.3);
    const c = await me(); assert.ok(Math.hypot(c.h.x - b1.h.x, c.h.z - b1.h.z) > 0.3, 'el ratón gira la vista');
    await pg.keyboard.press('Digit3'); await simWait(pg, 0.4); assert.equal((await me()).w, 2, 'tecla 3 = Ráfaga');
    assert.match(await pg.textContent('#w2'), /Ráfaga/); assert.ok((await pg.getAttribute('#w2', 'class')).includes('sel'));
    await pg.keyboard.down('Space'); await pg.waitForTimeout(100); await pg.keyboard.up('Space');
    await pg.mouse.down(); await simWait(pg, 2.5); await pg.mouse.up();
    const d = await me(); assert.ok(d.ammo[2] < c.ammo[2], 'disparar gasta munición');
    assert.match(await pg.textContent('#wave'), /OLEADA|PREPARATE|RESPIRO/);
    assert.match(await pg.textContent('#hpnum'), /Vida \d+/);
    assert.deepEqual(errs, [], 'sin errores de consola/JS: ' + errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});

test('e2e coop: dos navegadores reales (crear sala / unirse con código) comparten partida y se ven en el HUD', { skip: !hasChromium, timeout: 90000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0 }); const b = await launch();
  const mk = async () => { const pg = await b.newPage({ viewport: { width: 800, height: 450 } }); pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message)); return pg; };
  try {
    const A = await mk(), B = await mk();
    const U = `http://localhost:${srv.port}/?q=low&skipintro=1&autoq=0`, G = { waitUntil: 'domcontentloaded', timeout: 60000 }; await A.goto(U, G); await B.goto(U, G); await A.waitForFunction(() => window.__ui, null, { timeout: 60000 }); await B.waitForFunction(() => window.__ui, null, { timeout: 60000 });
    const openCoop = async (pg) => { await pg.evaluate(() => { window.__ui.act('ok'); window.__ui.go('coop'); }); await pg.waitForTimeout(800); };
    await openCoop(A); await openCoop(B);
    await A.selectOption('#coopmap', 'm2'); await A.click('#mkroom');
    await A.waitForFunction(() => window.__coop && window.__coop.net && window.__coop.net.room, null, { timeout: 25000 });
    const code = await A.evaluate(() => window.__coop.net.room);
    await B.fill('#roomcode', code); await B.click('#joinroom');
    await B.waitForFunction(() => window.__coop.net && window.__coop.net.lobby && window.__coop.net.lobby.players.length === 2, null, { timeout: 25000 });
    await B.click('#lbready'); await A.waitForFunction(() => window.__coop.net.lobby.players[1] && window.__coop.net.lobby.players[1].ready, null, { timeout: 10000 });
    await A.click('#lbstart');   // sala de espera → cuenta regresiva → los dos entran a la vez
    await A.waitForFunction(() => window.__api.session && window.__api.session.net && window.__api.session.net.pid, null, { timeout: 25000 });
    await B.waitForFunction(() => window.__api.session && window.__api.session.net && window.__api.session.net.pid, null, { timeout: 25000 });
    await A.waitForFunction(() => /Pasajero/.test(document.getElementById('coop').textContent) && document.getElementById('coop').textContent.split('Pasajero').length >= 3, null, { timeout: 25000 });
    await B.waitForFunction(() => document.getElementById('coop').textContent.split('Pasajero').length >= 3, null, { timeout: 25000 });
    assert.equal(await B.evaluate(() => window.__api.session.net.map), 'm2', 'B recibe el mapa de la sala');
    assert.deepEqual([...A.errs, ...B.errs], []);
  } finally { await b.close(); await srv.close(); }
});

test('e2e iPhone (emulado): calidad Baja automática, palanca, mirar, disparar, cambiar de arma y pausa con controles táctiles', { skip: !hasChromium, timeout: 120000 }, async () => {
  const { launch } = await import('../tools/browser.js'); const { devices } = await import('playwright-core');
  const srv = await startServer({ port: 0 }); const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0`); await pg.waitForFunction(() => window.__api && window.__api.session);
    assert.equal(await pg.evaluate(() => window.__api.level), 'low', 'en teléfono la calidad inicial es Baja');
    await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); }); await simWait(pg, 0.3);
    const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
    const me = () => pg.evaluate(() => { const p = window.__api.session.game.players[0]; return { x: p.pos.x, z: p.pos.z, h: { ...p.heading }, w: p.weapon, a: [...p.ammo].map((v) => (v === Infinity ? -1 : v)) }; });
    const a = await me();
    await T('touchStart', [{ x: 140, y: 280, id: 1 }]); for (let i = 1; i <= 6; i++) { await T('touchMove', [{ x: 140, y: 280 - i * 10, id: 1 }]); await pg.waitForTimeout(60); } await simWait(pg, 0.8); await T('touchEnd', []);
    const b1 = await me(); assert.ok(Math.hypot(b1.x - a.x, b1.z - a.z) > 3, 'la palanca mueve al jugador');
    await T('touchStart', [{ x: 650, y: 150, id: 2 }]); for (let i = 1; i <= 8; i++) { await T('touchMove', [{ x: 650 + i * 12, y: 150, id: 2 }]); await pg.waitForTimeout(30); } await T('touchEnd', []); await simWait(pg, 0.3);
    const c = await me(); assert.ok(Math.hypot(c.h.x - b1.h.x, c.h.z - b1.h.z) > 0.2, 'arrastrar a la derecha gira la vista');
    const box = await pg.locator('#weapons div[data-i="1"]').boundingBox(); await pg.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await simWait(pg, 0.4);
    assert.equal((await me()).w, 1, 'tocar la barra de armas pasa al arma 2');
    for (const k of ['fire', 'reload', 'melee', 'jump']) assert.ok(await pg.locator('.tc-' + k).isVisible(), 'botón básico visible: ' + k);
    for (const k of ['mov', 'esp', 's3', 'ads', 'crouch']) assert.ok(!(await pg.locator('.tc-' + k).isVisible()), 'el modo básico esconde ' + k);
    await pg.evaluate(() => { window.__api.session.game.players[0].ammo[1] = 20; });
    const f = await pg.locator('.tc-fire').boundingBox(); await T('touchStart', [{ x: f.x + 40, y: f.y + 40, id: 3 }]); await simWait(pg, 1.5); await T('touchEnd', []);
    assert.ok((await me()).a[1] < 20, 'el botón DISPARO dispara');
    await pg.evaluate(() => window.__api.setQuality('high')); await pg.waitForTimeout(1500);
    assert.equal(await pg.evaluate(() => window.__api.level), 'high'); await pg.evaluate(() => window.__api.setQuality('low')); await pg.waitForTimeout(800);
    assert.deepEqual(errs, [], 'sin errores: ' + errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});
