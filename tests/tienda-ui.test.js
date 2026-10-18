import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Pantalla Tienda y menú en 4 puertas (src/client/tienda-ui.js, menu-hubs.js): navegación, compra con confirmación, Esc, migas, sin desbordes en 4 tamaños.
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const KEY = 'cristal.perfil.v1';
const SIZES = [['390x844', 390, 844, true], ['844x390', 844, 390, true], ['820x1180', 820, 1180, true], ['1280x720', 1280, 720, false]];
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

async function abrir(w, h, touch, perfil, errors) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|favicon/i.test(m.text())) errors.push(`console: ${m.text()}`); });
  pg.setDefaultTimeout(120000);
  await pg.addInitScript(([k, p]) => { try { if (!sessionStorage.getItem('tn-seed')) { localStorage.setItem(k, JSON.stringify(p)); sessionStorage.setItem('tn-seed', '1'); } } catch { /* ok */ } }, [KEY, perfil]);
  await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.addStyleTag({ content: '#menu *, #menu { transition: none !important; animation: none !important; }' });
  await pg.evaluate(() => window.__api.ui.confirmTitle());
  return { ctx, pg };
}
const perfil = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

test('menú: 4 puertas + Continuar; Mundo › Tienda con migas y Esc que vuelve de a un paso', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], { ctx, pg } = await abrir(1280, 720, false, { cores: 700 }, errors);
  assert.equal(await pg.locator('#mainlist .door').count(), 4); assert.ok(await pg.locator('#continuar').isVisible(), 'Continuar siempre visible');
  assert.match(await pg.textContent('#continuar'), /Jugar|Continuar/); assert.equal(await pg.title(), 'PACTO PSICO');
  await pg.click('#mainlist [data-door=mundo]'); await pg.waitForSelector('#hub-mundo.on');
  assert.deepEqual(await pg.locator('#hub-mundo .hubcard').allInnerTexts().then((a) => a.map((t) => t.split('\n')[0].trim())), ['TERRITORIOS', 'BESTIARIO', 'TIENDA']);
  assert.match(await pg.textContent('#hub-mundo [data-go=tienda]'), /700 núcleos/, 'la tarjeta de la Tienda muestra el saldo');
  await pg.click('#hub-mundo [data-go=tienda]'); await pg.waitForSelector('#tienda.on .tn-tab');
  assert.equal((await pg.textContent('#crumbs')).replace(/\s+/g, ' ').trim(), 'Inicio › Mundo › Tienda');
  assert.match(await pg.textContent('#tnsaldo'), /700/);
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#hub-mundo.on'); await pg.keyboard.press('Escape'); await pg.waitForSelector('#main.on');
  // teclado: Enter sobre la puerta enfocada abre su hub; flechas mueven al vecino
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Enter'); await pg.waitForSelector('#hub-huesped.on', { timeout: 20000 });
  assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
});

test('Tienda: comprar un Huésped pide confirmación, descuenta núcleos, lo vuelve tuyo y lo deja elegir; sin núcleos no deja', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], { ctx, pg } = await abrir(1280, 720, false, { cores: 650 }, errors);
  await pg.evaluate(() => window.__api.ui.show('tienda')); await pg.waitForSelector('#tienda.on [data-host=danzante]');
  await pg.click('[data-host=danzante]'); assert.match(await pg.textContent('#tnbody .tn-info h2'), /Danzante/i);
  await pg.click('[data-comprar-host=danzante]'); assert.ok(await pg.locator('#tnmodal').isVisible(), 'pide confirmación'); assert.equal((await perfil(pg)).cores, 650, 'todavía no cobró');
  await pg.click('#tnno'); assert.ok(!(await pg.locator('#tnmodal').isVisible())); assert.equal((await perfil(pg)).cores, 650);
  await pg.click('[data-comprar-host=danzante]'); await pg.click('#tnyes'); await pg.waitForSelector('#tntoast:not([hidden])');
  assert.match(await pg.textContent('#tntoast'), /Comprado/); const p = await perfil(pg); assert.equal(p.cores, 50); assert.ok(p.huespedes.includes('danzante'));
  assert.match(await pg.textContent('#tnsaldo'), /50/);
  // ahora no alcanzan los núcleos para otro
  await pg.click('[data-host=umbra]'); assert.match(await pg.textContent('[data-comprar-host=umbra]'), /No alcanzan núcleos/); await pg.click('[data-comprar-host=umbra]');
  assert.ok(!(await pg.locator('#tnmodal').isVisible()), 'sin núcleos no abre la confirmación'); assert.equal((await perfil(pg)).cores, 50);
  // Colmena pide rango 3 con otro Huésped: dice «Falta requisito»
  await pg.click('[data-host=colmena]'); assert.match(await pg.textContent('[data-comprar-host=colmena]'), /Falta requisito|No alcanzan/);
  // el Huésped comprado se puede elegir en la pantalla de Huésped
  await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForSelector('#huesped.on'); await pg.click('.hs-chip[data-id="danzante"]');
  assert.equal(await pg.textContent('#hspick'), 'Elegir'); await pg.click('#hspick'); assert.equal(await pg.evaluate(() => localStorage.getItem('cristal.huesped.v1')), 'danzante');
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
    for (const [s, tab] of [['main'], ['hub-jugar'], ['hub-huesped'], ['hub-mundo'], ['hub-ajustes'], ['tienda', 'hue'], ['tienda', 'pla'], ['tienda', 'obj'], ['tienda', 'ser']]) {
      await pg.evaluate(([s, tab]) => { window.__api.ui.show(s); if (tab) window.__api.ui.tn.setTab(tab); }, [s, tab]); await pg.waitForTimeout(500);
      const bad = await pg.evaluate(() => {
        const sc = document.querySelector('.screen.on'), vw = innerWidth, out = [], vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        for (const e of sc.querySelectorAll('button, .door, .hubcard, h3, .tn-saldo')) { if (!vis(e) || e.closest('.tn-rail')) continue; const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) out.push(`fuera: ${e.className} ${e.textContent.trim().slice(0, 18)}`); if (r.width && /door|hubcard|continuar|tn-btn|tn-tab/.test(e.className) && r.height < 43) out.push(`chico: ${e.className} ${Math.round(r.height)}`); }
        if (sc.scrollWidth - sc.clientWidth > 1) out.push('scroll horizontal');
        const cr = document.querySelector('#crumbs:not([hidden])'), bk = document.querySelector('.screen.on .backbtn'), sl = document.querySelector('#saldo:not([hidden])'), R = (e) => e && e.getBoundingClientRect(), hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        if (hit(R(cr), R(bk))) out.push('migas pisan Volver'); if (hit(R(cr), R(sl))) out.push('migas pisan saldo');
        return out;
      });
      assert.deepEqual(bad, [], `${vn} ${s} ${tab || ''}: ${bad.join(' | ')}`);
    }
    assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
  });
}
