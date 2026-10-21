import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { debeSaludar, PASOS } from '../src/client/menu-bienvenida.js';

// «Recorrido»: desde el inicio, llegar a CADA función contando los toques/clics reales (docs/MENU.md). Lo frecuente (jugar, cambiar de Huésped, Tienda, Inventario/Forja) en ≤ 2.
// Se corre en celular horizontal (táctil) y en PC; los toques son clics de verdad sobre los botones visibles (nada de ui.show a mano).
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const KEY = 'cristal.perfil.v1';
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

// cada función: cómo llegar (lista de selectores a tocar, en orden), cuántos toques como máximo, y cómo comprobar que se llegó
const RUTAS = [
  { f: 'Jugar (Continuar)', max: 1, toques: ['#continuar'], ok: () => window.__llamo === 'story' },
  { f: 'Elegir otra arena', max: 2, toques: ['#elegir', '[data-start=m3]'], ok: () => window.__llamo === 'arena:m3' },
  { f: 'Historia', max: 2, toques: ['#elegir', '#tbtabs .tb-tab:has-text("Historia")'], ok: () => document.querySelector('#story.on') },
  { f: 'La Base', max: 1, toques: ['#mainlist [data-door=base]'], ok: () => window.__llamo === 'base' },
  { f: 'Cambiar de Huésped', max: 2, toques: ['#mainlist [data-door=huespedes]', '.hs-chip[data-id=vesper]'], ok: () => localStorage.getItem('cristal.huesped.v1') === 'vesper' },
  { f: 'Evolución', max: 2, toques: ['#mainlist [data-door=huespedes]', '#tbtabs .tb-tab:has-text("Evolución")'], ok: () => document.querySelector('#evolucion.on') },
  { f: 'Inventario', max: 2, toques: ['#mainlist [data-door=huespedes]', '#tbtabs .tb-tab:has-text("Inventario")'], ok: () => document.querySelector('#inventario.on') && window.__api.ui.iv.tab === 'obj' },
  { f: 'Forja', max: 2, toques: ['#mainlist [data-door=huespedes]', '#tbtabs .tb-tab:has-text("Forja")'], ok: () => document.querySelector('#inventario.on') && window.__api.ui.iv.tab === 'for' },
  { f: 'Tienda (núcleos de la barra)', max: 1, toques: ['#saldo'], ok: () => document.querySelector('#tienda.on') },
  { f: 'Tienda (pestaña)', max: 2, toques: ['#mainlist [data-door=huespedes]', '#tbtabs .tb-tab:has-text("Tienda")'], ok: () => document.querySelector('#tienda.on') },
  { f: 'Equipo', max: 2, toques: ['#mainlist [data-door=huespedes]', '#tbtabs .tb-tab:has-text("Equipo")'], ok: () => document.querySelector('#loadout.on') },
  { f: 'Bestiario (Criaturas)', max: 1, toques: ['#mainlist [data-door=coleccion]'], ok: () => document.querySelector('#bestiary.on') },
  { f: 'Fauna', max: 2, toques: ['#mainlist [data-door=coleccion]', '#tbtabs .tb-tab:has-text("Fauna")'], ok: () => document.querySelector('#bestiary.on') && window.__api.ui.btab === 'f' },
  { f: 'Herbario', max: 2, toques: ['#mainlist [data-door=coleccion]', '#tbtabs .tb-tab:has-text("Herbario")'], ok: () => document.querySelector('#bestiary.on') && window.__api.ui.btab === 'h' },
  { f: 'Territorios', max: 2, toques: ['#mainlist [data-door=coleccion]', '#tbtabs .tb-tab:has-text("Territorios")'], ok: () => document.querySelector('#territorios.on') },
  { f: 'Cooperativo', max: 1, toques: ['#mainlist [data-door=coop]'], ok: () => document.querySelector('#coopscr.on') },
  { f: 'Controles y sonido', max: 1, toques: ['#mainlist [data-door=ajustes]'], ok: () => document.querySelector('#options.on') },
  { f: 'Gráficos (engranaje)', max: 1, toques: ['#tbgfx'], ok: () => document.querySelector('#graficos.on') },
  { f: 'Gráficos (Ajustes › pestaña)', max: 2, toques: ['#mainlist [data-door=ajustes]', '#tbtabs .tb-tab:has-text("Gráficos")'], ok: () => document.querySelector('#graficos.on') },
  { f: 'Modo Shooter/Melé', max: 1, toques: ['#modeitem'], ok: () => window.__api.settings().mode === 'combo' },
];

for (const [vn, w, h, touch] of [['844x390 táctil', 844, 390, true], ['1280x720 PC', 1280, 720, false], ['390x844 táctil', 390, 844, true]]) {
  test(`recorrido ${vn}: cada función a ≤ 2 toques desde el inicio (y Esc/Volver vuelve en 1)`, { skip: !hasChromium, timeout: 900000 }, async () => {
    const errors = [], ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|favicon|Failed to load/i.test(m.text())) errors.push(`console: ${m.text()}`); });
    pg.setDefaultTimeout(120000);
    await pg.addInitScript(([k, p]) => { try { if (window.top !== window) return; if (!sessionStorage.getItem('rc-seed')) { localStorage.setItem(k, JSON.stringify(p)); sessionStorage.setItem('rc-seed', '1'); } } catch { /* ok */ } }, [KEY, { cores: 700, mae: { axioma: { xp: 300, partidas: 3, kills: 3, oleada: 2 } } }]);
    await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
    await pg.addStyleTag({ content: '#menu *, #menu { transition: none !important; animation: none !important; }' });
    await pg.evaluate(() => { const A = window.__api.ui.actions; A.story = () => { window.__llamo = 'story'; }; A.arena = (m) => { window.__llamo = 'arena:' + m; }; A.base = () => { window.__llamo = 'base'; }; window.__api.ui.confirmTitle(); });
    const tabla = [];
    for (const r of RUTAS) {
      await pg.evaluate(() => { window.__llamo = ''; const u = window.__api.ui; u.stack = []; u.show('main', false); const s = window.__api.settings(); if (s.mode === 'combo') window.__api.setSetting && window.__api.setSetting('mode', 'shooter'); });
      await pg.waitForSelector('#main.on');
      let n = 0;
      for (const sel of r.toques) { const b = pg.locator(sel).first(); await b.waitFor({ state: 'visible', timeout: 20000 }); await b.click(); n++; await pg.waitForTimeout(80); }
      await pg.waitForFunction(r.ok, null, { timeout: 20000 }).catch(() => { throw new Error(`${vn}: «${r.f}» no se alcanzó con ${n} toques`); });
      assert.ok(n <= r.max && n <= 2, `${r.f}: ${n} toques (máximo ${r.max})`); tabla.push(`${r.f.padEnd(32)} ${n}`);
      // volver: un solo Esc (salvo cuando la función ya arrancó una partida / la Base, que son acciones y no pantallas)
      if (!/Jugar|arena|Elegir otra|Base$|^La Base/.test(r.f) && !(await pg.evaluate(() => window.__llamo))) {
        await pg.keyboard.press('Escape'); await pg.waitForSelector('#main.on', { timeout: 10000 }).catch(() => { throw new Error(`${vn}: Esc desde «${r.f}» no volvió al inicio en 1 paso`); });
      }
    }
    console.log(`\nRecorrido ${vn} (toques desde el inicio)\n` + tabla.join('\n'));
    // sólo 5 puertas y botones grandes
    const info = await pg.evaluate(() => { window.__api.ui.show('main', false); return { puertas: document.querySelectorAll('#mainlist .door').length, chicos: [...document.querySelectorAll('#main button, #topbar button')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 43).map((b) => b.id || b.className) }; });
    assert.equal(info.puertas, 5); assert.deepEqual(info.chicos, [], 'botones del inicio y de la barra ≥ 44 px');
    assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
  });
}

test('teclado y mando: Q/E cambian de pestaña dentro de la sección, Esc vuelve; foco visible', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(e.message)); pg.setDefaultTimeout(120000);
  await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.waitForSelector('#main.on');
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); assert.ok(await pg.locator('#main .focus').count() >= 1, 'hay un elemento con foco visible');
  await pg.click('#mainlist [data-door=huespedes]'); await pg.waitForSelector('#huesped.on');
  const orden = ['evolucion', 'inventario', 'inventario', 'tienda', 'loadout'];
  for (const id of orden) { await pg.keyboard.press('KeyE'); await pg.waitForSelector(`#${id}.on`); await pg.waitForTimeout(150); }
  await pg.keyboard.press('KeyQ'); await pg.waitForSelector('#tienda.on');
  assert.equal(await pg.locator('#tbtabs .tb-tab.on').innerText(), 'Tienda');
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#main.on');
  // el mando: LB / RB llegan como acciones tabprev / tabnext
  await pg.evaluate(() => { window.__api.ui.show('main', false); window.__api.ui.go('coleccion' === 'x' ? 'x' : 'bestiary'); });
  await pg.evaluate(() => window.__api.ui.act('tabnext')); await pg.waitForFunction(() => window.__api.ui.btab === 'f'); await pg.evaluate(() => window.__api.ui.act('tabnext')); await pg.waitForFunction(() => window.__api.ui.btab === 'h');
  await pg.evaluate(() => window.__api.ui.act('tabnext')); await pg.waitForSelector('#territorios.on');
  assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
});

test('bienvenida de la primera vez: 3 pasos, se salta y no vuelve', { skip: !hasChromium, timeout: 600000 }, async () => {
  assert.equal(PASOS.length, 3); assert.deepEqual(PASOS.map((p) => p.titulo), ['Elegí tu Huésped', 'Jugá', 'Volvé a la Base']);
  assert.equal(debeSaludar('', true), false, 'ya la vio: no sale'); assert.equal(debeSaludar('?bienvenida=1', true), true, '?bienvenida=1 la fuerza'); assert.equal(debeSaludar('?bienvenida=0', false), false);
  const errors = [], ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(e.message)); pg.setDefaultTimeout(120000);
  await pg.goto(`${base}/?q=low&autoq=0&bienvenida=1`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.addStyleTag({ content: '#menu *, #menu { transition: none !important; animation: none !important; }' });
  assert.equal(await pg.locator('#bienvenida').isVisible(), false, 'en el título no sale'); await pg.evaluate(() => window.__api.ui.confirmTitle());
  await pg.waitForSelector('#bienvenida:not([hidden])'); assert.match(await pg.textContent('#bvt'), /Elegí tu Huésped/);
  await pg.click('#bvnext'); assert.match(await pg.textContent('#bvt'), /Jugá/); await pg.click('#bvnext'); assert.match(await pg.textContent('#bvt'), /Base/); assert.match(await pg.textContent('#bvnext'), /Listo/);
  await pg.click('#bvnext'); assert.equal(await pg.locator('#bienvenida').isVisible(), false); assert.equal(await pg.evaluate(() => localStorage.getItem('vortex.bienvenida.v1')), '1', 'se recuerda');
  // «Saltar» y Esc también la cierran (y quedan marcadas)
  await pg.evaluate(() => { localStorage.removeItem('vortex.bienvenida.v1'); window.__api.ui.bv.abrir(); }); await pg.click('#bvskip'); assert.equal(await pg.locator('#bienvenida').isVisible(), false);
  await pg.evaluate(() => window.__api.ui.bv.abrir()); await pg.keyboard.press('Escape'); assert.equal(await pg.locator('#bienvenida').isVisible(), false); assert.equal(await pg.locator('#main.on').count(), 1, 'Esc cierra la bienvenida y NO sale del inicio');
  assert.deepEqual(errors, [], errors.join('\n')); await ctx.close();
});

test('pausa simple: Continuar · Modo · Gráficos · Controles y cámara · Salir (los ids que usa main.js siguen)', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), pausa = html.slice(html.indexOf('<div id="pause"'), html.indexOf('<div id="end"'));
  const dentro = pausa.slice(pausa.indexOf('<div class="list">'));
  const primeros = []; let nivel = 0;
  for (const m of dentro.matchAll(/<(\/?)(details|button|label)\b([^>]*)>/g)) { const id = (/id="(\w+)"/.exec(m[3]) || [])[1]; if (m[2] === 'details') { nivel += m[1] ? -1 : 1; if (!m[1] && nivel === 1) primeros.push(id); continue; } if (nivel === 0 && !m[1]) primeros.push(id || m[2]); }
  assert.deepEqual(primeros.slice(0, 6), ['resume', 'modetoggle', 'gfxopen', 'pmas', 'pbase', 'quit'], 'seis entradas a la vista: ' + primeros.join(','));
  for (const id of ['showctl', 'editctl', 'camtoggle', 'claridad', 'camside', 'camdist', 'camfov', 'styletoggle', 'simpletoggle', 'advtoggle', 'sens', 'evoopen', 'qsel2']) assert.ok(new RegExp(`id="${id}"`).test(pausa), `${id} sigue existiendo`);
  assert.ok(pausa.indexOf('id="pmas"') < pausa.indexOf('id="camtoggle"') && pausa.indexOf('id="camtoggle"') < pausa.indexOf('id="pbase"'), 'lo demás cuelga de «Controles y cámara»');
});
