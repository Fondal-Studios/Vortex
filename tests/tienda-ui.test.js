import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Pantalla Tienda y menú en 4 puertas (src/client/tienda-ui.js, menu-hubs.js): navegación, compra con confirmación, Esc, migas, sin desbordes en 4 tamaños.
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const KEY = 'cristal.perfil.v1';
const SIZES = [['390x844', 390, 844, true], ['844x390', 844, 390, true], ['820x1180', 820, 1180, true], ['1280x720', 1280, 720, false]];
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

async function abrir(w, h, touch, perfil, errors) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|favicon/i.test(m.text())) errors.push(`console: ${m.text()}`); });
  pg.setDefaultTimeout(120000);
  await pg.addInitScript(([k, p]) => { try { if (window.top !== window) return; /* (el retrato 3D es un iframe del mismo origen: no se vuelve a sembrar) */ if (!sessionStorage.getItem('tn-seed')) { localStorage.setItem(k, JSON.stringify(p)); sessionStorage.setItem('tn-seed', '1'); } } catch { /* ok */ } }, [KEY, perfil]);
  await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.addStyleTag({ content: '#menu *, #menu { transition: none !important; animation: none !important; }' });
  await pg.evaluate(() => window.__api.ui.confirmTitle());
  return { ctx, pg };
}
const perfil = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

test('menú: 5 puertas + Continuar; Huéspedes › pestaña Tienda (o los núcleos de la barra) y Esc que vuelve al inicio', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], { ctx, pg } = await abrir(1280, 720, false, { cores: 700 }, errors);
  assert.equal(await pg.locator('#mainlist .door').count(), 5); assert.ok(await pg.locator('#continuar').isVisible(), 'Continuar siempre visible');
  assert.match(await pg.textContent('#continuar'), /Jugar|Continuar/); assert.equal(await pg.title(), 'VORTEX');
  assert.deepEqual(await pg.locator('#mainlist .door b').allInnerTexts().then((a) => a.map((t) => t.trim().toUpperCase())), ['LA BASE', 'HUÉSPEDES', 'COLECCIÓN', 'COOPERATIVO', 'AJUSTES']);
  assert.match(await pg.textContent('#saldo'), /700/, 'los núcleos están siempre en la barra');
  // 1 toque a la Tienda: los núcleos de la barra
  await pg.click('#saldo'); await pg.waitForSelector('#tienda.on .tn-tab'); assert.match(await pg.textContent('#tnsaldo'), /700/);
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#main.on');
  // 2 toques: Huéspedes › Tienda (la barra superior muestra las pestañas de la sección)
  await pg.click('#mainlist [data-door=huespedes]'); await pg.waitForSelector('#huesped.on');
  assert.deepEqual(await pg.locator('#tbtabs .tb-tab').allInnerTexts().then((a) => a.map((t) => t.trim())), ['Huésped', 'Evolución', 'Inventario', 'Forja', 'Tienda', 'Equipo']);
  await pg.click('#tbtabs .tb-tab:has-text("Tienda")'); await pg.waitForSelector('#tienda.on .tn-tab'); assert.equal(await pg.locator('#tbtabs .tb-tab.on').innerText(), 'Tienda');
  assert.equal((await pg.locator('#tbsec').textContent()).trim(), 'Huéspedes');
  // las pestañas no apilan: un solo Esc vuelve al inicio
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#main.on');
  // teclado: el foco arranca en Continuar; ↓ baja a la puerta más cercana y Enter la abre; Q/E cambian de pestaña
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.screen.on:not(#main)', { timeout: 20000 });
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#main.on');
  assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
});

test('Tienda: comprar un Huésped pide confirmación, descuenta núcleos, lo vuelve tuyo y lo deja elegir; sin núcleos no deja', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], { ctx, pg } = await abrir(1280, 720, false, { cores: 650 }, errors);
  await pg.evaluate(() => window.__api.ui.show('tienda')); await pg.waitForSelector('#tienda.on [data-host=danzante]');
  await pg.click('[data-host=danzante]'); assert.match(await pg.textContent('#tnbody .tn-info h2'), /Danzante/i);
  await pg.click('[data-comprar-host=danzante]'); assert.ok(await pg.locator('#tnmodal').isVisible(), 'pide confirmación'); assert.equal((await perfil(pg)).cores, 650, 'todavía no cobró');
  await pg.click('#tnno'); assert.ok(!(await pg.locator('#tnmodal').isVisible())); assert.equal((await perfil(pg)).cores, 650);
  await pg.click('[data-comprar-host=danzante]'); await pg.click('#tnyes'); await pg.waitForFunction(() => /Comprado/.test(document.querySelector('#tntoast').textContent));   // (el aviso dura 2 s: con la máquina lenta puede esconderse antes de mirarlo)
  assert.match(await pg.textContent('#tnfrase'), /\S/, 'el Cambista contesta'); const p = await perfil(pg); assert.equal(p.cores, 50); assert.ok(p.huespedes.includes('danzante'));
  assert.match(await pg.textContent('#tnsaldo'), /50/);
  // ahora no alcanzan los núcleos para otro
  await pg.click('[data-host=umbra]'); assert.match(await pg.textContent('[data-comprar-host=umbra]'), /No alcanzan núcleos/); await pg.click('[data-comprar-host=umbra]', { force: true });   // (aria-disabled: la pantalla explica por qué no se puede, no abre el cartel)
  assert.ok(!(await pg.locator('#tnmodal').isVisible()), 'sin núcleos no abre la confirmación'); assert.equal((await perfil(pg)).cores, 50);
  // Colmena pide rango 3 con otro Huésped: dice «Falta requisito»
  await pg.click('[data-host=colmena]'); assert.match(await pg.textContent('[data-comprar-host=colmena]'), /Falta requisito|No alcanzan/);
  // el Huésped comprado se puede elegir en la pantalla de Huésped
  await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForSelector('#huesped.on'); await pg.click('.hs-chip[data-id="danzante"]');
  assert.equal(await pg.evaluate(() => localStorage.getItem('cristal.huesped.v1')), 'danzante', 'un toque en un Huésped tuyo ya lo elige'); assert.equal(await pg.textContent('#hspick'), 'Listo ✓'); await pg.click('#hspick'); await pg.waitForSelector('#huesped:not(.on)');   // «Listo» vuelve a la pantalla anterior
  assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
});

test('Huésped sin comprar: se puede mirar pero «Comprar» lleva a la Tienda y no lo elige', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], { ctx, pg } = await abrir(1280, 720, false, { cores: 10 }, errors);
  await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForSelector('#huesped.on'); await pg.click('.hs-chip[data-id="seraf"]');
  assert.ok(await pg.locator('.hs-chip[data-id="seraf"].locked').count(), 'marcado con candado'); assert.equal(await pg.textContent('#hspick'), 'Comprar');
  await pg.click('#hspick'); await pg.waitForSelector('#tienda.on'); assert.match(await pg.textContent('#tnbody .tn-info h2'), /Seraf/i);
  assert.notEqual(await pg.evaluate(() => localStorage.getItem('cristal.huesped.v1')), 'seraf');
  assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
});

for (const [vn, w, h, touch] of SIZES) {
  test(`menú y Tienda ${vn}: nada se sale de la pantalla y los botones son tocables`, { skip: !hasChromium, timeout: 900000 }, async () => {
    const errors = [], { ctx, pg } = await abrir(w, h, touch, { cores: 640, mae: { axioma: { xp: 300, partidas: 3, kills: 3, oleada: 2 } }, materiales: { hueso: [4, 2, 0, 0] } }, errors);
    for (const [s, tab] of [['main'], ['story'], ['huesped'], ['bestiary'], ['options'], ['tienda', 'hue'], ['tienda', 'pla'], ['tienda', 'obj'], ['tienda', 'ser']]) {
      await pg.evaluate(([s, tab]) => { window.__api.ui.show(s); if (tab) window.__api.ui.tn.setTab(tab); }, [s, tab]); await pg.waitForTimeout(500);
      const bad = await pg.evaluate(() => {
        const sc = document.querySelector('.screen.on'), vw = innerWidth, out = [], vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        for (const e of sc.querySelectorAll('button, .door, h3, .tn-saldo')) { if (!vis(e) || e.closest('.tn-rail, #bgrid')) continue; const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) out.push(`fuera: ${e.className} ${e.textContent.trim().slice(0, 18)}`); if (r.width && /door|continuar|tn-btn|tn-tab/.test(e.className) && r.height < 43) out.push(`chico: ${e.className} ${Math.round(r.height)}`); }
        if (sc.scrollWidth - sc.clientWidth > 1) out.push('scroll horizontal');
        const R = (e) => e && e.getBoundingClientRect(), hit = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const bk = document.querySelector('.screen.on .backbtn'), tb = document.querySelector('#tbtabs:not([hidden])'), tl = document.querySelector('.tb-tools');   // la barra única: Volver · pestañas · herramientas no se pisan
        if (hit(R(tb), R(bk))) out.push('pestañas pisan Volver'); if (hit(R(tb), R(tl))) out.push('pestañas pisan las herramientas'); if (hit(R(tl), R(bk))) out.push('herramientas pisan Volver');
        return out;
      });
      assert.deepEqual(bad, [], `${vn} ${s} ${tab || ''}: ${bad.join(' | ')}`);
    }
    assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
  });
}
