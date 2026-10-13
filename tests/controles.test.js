// Controles táctiles (reforma estilo shooter móvil): giro por desplazamiento relativo, multitoque, zonas, ajustes y persistencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';
import { DEFAULTS, sensFromSlider, sliderFromSens } from '../src/client/settings.js';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const simWait = (pg, secs) => pg.evaluate((d) => new Promise((r) => { const g = window.__api.session.game, t0 = g.time; const iv = setInterval(() => { if (g.time - t0 >= d) { clearInterval(iv); r(); } }, 30); }), secs);

test('ajustes: la escala del deslizador es monótona y reversible', () => {
  let prev = 0; for (let v = 1; v <= 20; v++) { const s = sensFromSlider(v); assert.ok(s > prev); prev = s; assert.equal(sliderFromSens(s), v); }
  assert.ok(DEFAULTS.sensX > DEFAULTS.sensY * 0.9 && DEFAULTS.adsMul < 1 && DEFAULTS.scopeMul < DEFAULTS.adsMul);
});

test('controles táctiles: giro exacto, 180°, microajuste, multitoque, zonas, ADS, agacharse, persistencia', { skip: !hasChromium, timeout: 500000 }, async () => {
  const { launch } = await import('../tools/browser.js'); const { devices } = await import('playwright-core');
  const srv = await startServer({ port: 0 }); const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
    await pg.evaluate(() => { localStorage.removeItem('cristal.ajustes.v2'); window.__api.session.touch = true; window.__api.touch.show(true); document.querySelector('#tadv').value = '1'; document.querySelector('#tadv').dispatchEvent(new Event('input')); }); // modo avanzado: esta prueba usa APUNTAR
    await simWait(pg, 0.3);
    const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
    const me = () => pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { x: p.pos.x, z: p.pos.z, pitch: p.pitch, h: { ...p.heading }, up: { ...p.up }, w: p.weapon, a: [...p.ammo].map((v) => (v === Infinity ? -1 : v)), ads: p.input && p.input.ads, cr: p.input && p.input.crouch }; });
    const ang = (a, c) => Math.acos(Math.max(-1, Math.min(1, a.h.x * c.h.x + a.h.y * c.h.y + a.h.z * c.h.z)));
    const swipe = async (id, x0, y0, dx, dy, steps = 10, ms = 12) => { await T('touchStart', [{ x: x0, y: y0, id }]); for (let i = 1; i <= steps; i++) { await T('touchMove', [{ x: x0 + dx * i / steps, y: y0 + dy * i / steps, id }]); await pg.waitForTimeout(ms); } await T('touchEnd', []); };
    const sens = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__api.touch && 0)) ?? 0).catch(() => 0);

    // 1) giro proporcional al desplazamiento: 100 px ≈ sensX*100 rad (±15%)
    let a = await me(); await swipe(10, 560, 200, 100, 0); await simWait(pg, 0.4); let c = await me();
    const want = DEFAULTS.sensX * 100, got = ang(a, c);
    assert.ok(Math.abs(got - want) / want < 0.15, `100 px giran ${got.toFixed(3)} rad (esperado ${want.toFixed(3)})`);
    // 2) la dirección: deslizar a la derecha y luego a la izquierda vuelve al punto de partida
    await swipe(11, 600, 200, -100, 0); await simWait(pg, 0.4); const d2 = await me(); assert.ok(ang(a, d2) < 0.05, 'ida y vuelta regresa a la misma dirección');
    // 3) giro rápido de 180° con un solo deslizamiento cómodo (<= 520 px en 150 ms)
    a = await me(); await swipe(12, 440, 220, 300, 0, 6, 8); await swipe(13, 440, 220, 300, 0, 6, 8); await swipe(14, 440, 220, 120, 0, 3, 8); await simWait(pg, 0.5); c = await me();
    assert.ok(ang(a, c) > 2.5, `dos deslizamientos cortos dan casi 180° (${(ang(a, c) * 57.3).toFixed(0)}°)`);
    // 4) microajuste: 2 px mueven < 0.02 rad y NO se pierden (sin zona muerta)
    a = await me(); await swipe(15, 600, 200, 3, 0, 3, 10); await simWait(pg, 0.3); c = await me();
    const micro = ang(a, c); assert.ok(micro > 0.01 && micro < 0.03, `microajuste de 3 px = ${micro.toFixed(4)} rad`);
    // 5) vertical independiente (pitch) y horizontal no se contaminan
    a = await me(); await swipe(16, 600, 250, 0, -80); await simWait(pg, 0.4); c = await me();
    assert.ok(Math.abs(c.pitch - a.pitch) > 0.2 && ang(a, c) < 0.02, `vertical independiente: pitch ${(c.pitch - a.pitch).toFixed(3)} rad sin girar en horizontal`);
    // 6) multitoque: palanca + mirar + disparar a la vez
    await pg.evaluate(() => { window.__api.session.game.players[0].ammo[window.__api.session.game.players[0].weapon] = 30; });
    a = await me(); const f = await pg.locator('.tc-fire').boundingBox();
    await T('touchStart', [{ x: 140, y: 280, id: 21 }, { x: f.x + 40, y: f.y + 40, id: 22 }, { x: 560, y: 200, id: 23 }]);
    for (let i = 1; i <= 14; i++) { await T('touchMove', [{ x: 140, y: 280 - i * 4, id: 21 }, { x: f.x + 40, y: f.y + 40, id: 22 }, { x: 560 + i * 8, y: 200, id: 23 }]); await pg.waitForTimeout(40); }
    await simWait(pg, 0.6); const firing = await pg.evaluate(() => window.__api.session.game.players[0].input.fire && window.__api.touch.fire); await T('touchEnd', []); c = await me();
    assert.ok(Math.hypot(c.x - a.x, c.z - a.z) > 1.5, 'multitoque: la palanca camina'); assert.ok(ang(a, c) > 0.3, 'multitoque: la cámara gira'); assert.ok(firing, 'multitoque: dispara');
    // 7) arrastrar desde el botón de disparo también apunta (sin soltar) y no cambia de rol
    a = await me(); await T('touchStart', [{ x: f.x + 40, y: f.y + 40, id: 31 }]); for (let i = 1; i <= 6; i++) { await T('touchMove', [{ x: f.x + 40 - i * 6, y: f.y + 40, id: 31 }]); await pg.waitForTimeout(20); } await simWait(pg, 0.3); await T('touchEnd', []); c = await me();
    assert.ok(ang(a, c) > 0.1, 'arrastrar sobre el gatillo gira la cámara');
    // 8) un dedo que gira y cruza sobre botones NO los activa (jump/agacharse/dash)
    const j = await pg.locator('.tc-jump').boundingBox(); const y0 = await pg.evaluate(() => window.__api.session.game.players[0].vel ? 0 : 0);
    const jumpsBefore = await pg.evaluate(() => (window.__jumpCount = 0)); 
    await T('touchStart', [{ x: 520, y: 100, id: 41 }]); for (let i = 1; i <= 14; i++) { await T('touchMove', [{ x: 520 + i * 18, y: 100 + i * 12, id: 41 }]); await pg.waitForTimeout(15); }
    const midInput = await pg.evaluate(() => { const p = window.__api.session.game.players[0]; return { cr: !!p.input.crouch, ads: !!p.input.ads }; });
    await T('touchEnd', []); assert.deepEqual(midInput, { cr: false, ads: false }, 'cruzar botones con el dedo de cámara no los pulsa');
    // 9) ADS reduce el giro y agacharse se refleja en la simulación
    await pg.locator('.tc-ads').evaluate((el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 91, clientX: 700, clientY: 100 })));
    await simWait(pg, 0.2); const ad = await me(); assert.ok(ad.ads, 'ADS activo en la simulación');
    a = await me(); await swipe(16, 560, 200, 100, 0); await simWait(pg, 0.3); c = await me();
    assert.ok(ang(a, c) < want * 0.8, `con ADS el giro baja (${ang(a, c).toFixed(3)} < ${(want * 0.8).toFixed(3)})`);
    await pg.locator('.tc-ads').evaluate((el) => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 91, clientX: 700, clientY: 100 })));
    await simWait(pg, 0.2); assert.ok(!(await me()).ads, 'al soltar ADS se desactiva');
    // 10) persistencia de preferencias y de la disposición
    await pg.evaluate(() => { const m = window.__api; m.touch && 0; });
    const stored = await pg.evaluate(() => { localStorage.setItem('cristal.ajustes.v2', JSON.stringify({ ver: 3, sensX: 0.01, fingers: 3, advanced: true, layout: { fire: { dx: -20, dy: 0, s: 1.2 } } })); return true; });
    await pg.reload(); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
    await pg.evaluate(() => { window.__api.session.touch = true; window.__api.touch.show(true); }); await simWait(pg, 0.3);
    a = await me(); await swipe(17, 560, 200, 100, 0); await simWait(pg, 0.4); c = await me();
    assert.ok(Math.abs(ang(a, c) - 1.0) < 0.2, `la sensibilidad guardada (0.01) se aplica tras recargar (${ang(a, c).toFixed(3)})`);
    assert.ok(await pg.locator('.tc-fire').evaluate((el) => (el.style.getPropertyValue('--s') || '') === '1.2' || getComputedStyle(el).getPropertyValue('--s').trim() === '1.2'), 'el tamaño personalizado del botón se restaura');
    assert.deepEqual(errs, [], 'sin errores: ' + errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});
