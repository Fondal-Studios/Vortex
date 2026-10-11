// Prueba de extremo a extremo en Chromium real: ruta de entrada humana (teclado + ratón), HUD y sin errores de consola.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));

test('e2e: un humano (teclas + ratón) se mueve, apunta, cambia de arma, dispara y el HUD responde', { skip: !hasChromium, timeout: 90000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&nolock=1&seed=2`);
    await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 15000 });
    const me = () => pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { pos: { ...p.pos }, h: { ...p.heading }, w: p.weapon, kills: p.kills, ammo: [...p.ammo].map((a) => (a === Infinity ? -1 : a)), shots: g.stats.spawned }; });
    const a = await me();
    await pg.keyboard.down('KeyW'); await pg.waitForTimeout(1200); await pg.keyboard.up('KeyW');
    const b1 = await me();
    assert.ok(Math.hypot(b1.pos.x - a.pos.x, b1.pos.z - a.pos.z) > 4, 'W mueve al jugador');
    await pg.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 300, movementY: 0 })));
    await pg.waitForTimeout(200);
    const c = await me(); assert.ok(Math.hypot(c.h.x - b1.h.x, c.h.z - b1.h.z) > 0.3, 'el ratón gira la vista');
    await pg.keyboard.press('Digit3'); await pg.waitForTimeout(150); assert.equal((await me()).w, 2, 'tecla 3 = Ráfaga');
    assert.match(await pg.textContent('#w2'), /Ráfaga/); assert.ok((await pg.getAttribute('#w2', 'class')).includes('sel'));
    await pg.keyboard.down('Space'); await pg.waitForTimeout(100); await pg.keyboard.up('Space');
    await pg.mouse.down(); await pg.waitForTimeout(2500); await pg.mouse.up();
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
    await A.goto(`http://localhost:${srv.port}/`); await B.goto(`http://localhost:${srv.port}/`);
    await A.selectOption('#coopmap', 'm2'); await A.click('#mkroom');
    await A.waitForFunction(() => window.__api.session && window.__api.session.net && window.__api.session.net.room, null, { timeout: 8000 });
    const code = await A.evaluate(() => window.__api.session.net.room);
    await B.fill('#roomcode', code); await B.click('#joinroom');
    await B.waitForFunction(() => window.__api.session && window.__api.session.net && window.__api.session.net.pid, null, { timeout: 8000 });
    await A.waitForFunction(() => /Ilse/.test(document.getElementById('coop').textContent) && document.getElementById('coop').textContent.split('Ilse').length >= 3, null, { timeout: 8000 });
    await B.waitForFunction(() => document.getElementById('coop').textContent.split('Ilse').length >= 3, null, { timeout: 8000 });
    assert.equal(await B.evaluate(() => window.__api.session.net.map), 'm2', 'B recibe el mapa de la sala');
    assert.deepEqual([...A.errs, ...B.errs], []);
  } finally { await b.close(); await srv.close(); }
});
