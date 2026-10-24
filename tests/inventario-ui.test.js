// Pantalla «Inventario» (src/client/inventario-ui.js) y aspecto del equipo (src/client/items-vis.js) en navegador (Chromium por software):
// sin errores, sin desbordes en 4 tamaños, flujo equipar/forjar desde la interfaz, y presupuesto de Baja del cuerpo con equipo (≤ 45 llamadas / ≤ 20 000 triángulos).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { SETS, RECETAS } from '../src/sim/items.js';

import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const KEY = 'cristal.perfil.v1';
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

const inv = [...SETS.vacio.items, 'gemelas_axioma', 'fusil_hueso', 'casco_hueso', 'cuchilla_hueso'].map((id, i) => ({ u: 'u' + i, id, q: 0.6, k: i * 30, lk: false, fv: false, t: 1 }));
const PERFIL = { ver: 2, cores: 300, inventario: inv, eq: { axioma: { head: 'u0', melee: 'u4' } }, nu: 20, materiales: { hueso: [6, 2, 0, 0] }, planos: [] };

async function abrir(w, h, touch, errors, perfil = PERFIL) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  await pg.addInitScript(([k, p]) => { try { if (!sessionStorage.getItem('iv-seed')) { localStorage.setItem(k, JSON.stringify(p)); sessionStorage.setItem('iv-seed', '1'); } } catch { /* ok */ } }, [KEY, perfil]);
  pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  pg.setDefaultTimeout(120000); await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.evaluate(() => window.__api.ui.show('inventario')); await pg.waitForTimeout(1500);
  return { ctx, pg };
}
const medir = () => {
  const vw = innerWidth, vh = innerHeight, root = document.querySelector('#inventario'), out = [];
  const visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  for (const sel of ['.backbtn', '#ivrail', '#ivstage', '#ivslots', '#ivtabs', '#ivbody']) { const e = sel === '.backbtn' ? root.querySelector(sel) : root.querySelector(sel); if (!e || !visible(e)) { out.push('falta ' + sel); continue; } const r = e.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) out.push(`${sel} fuera de la pantalla`); }
  for (const e of root.querySelectorAll('.iv-tab, .iv-chip, .iv-btn, .iv-f')) { if (!visible(e)) continue; const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.height < 30) out.push(`botón bajo: ${e.className} ${Math.round(r.height)} px`); }
  if (root.scrollWidth > vw + 2) out.push('desborde horizontal de la pantalla');
  return out;
};

test('Inventario: abre sin errores, muestra objetos y se maneja en 4 tamaños sin desbordes', { skip: !hasChromium, timeout: 600000 }, async () => {
  for (const [w, h, touch] of [[1280, 720, false], [844, 390, true], [667, 375, true], [390, 844, true]]) {
    const errors = [], { ctx, pg } = await abrir(w, h, touch, errors);
    assert.ok(await pg.locator('.iv-cell').count() >= 8, `${w}x${h}: hay objetos`);
    for (const t of ['mat', 'pla', 'for', 'set', 'obj']) { await pg.click(`.iv-tab[data-t=${t}]`); await pg.waitForTimeout(150); const p = await pg.evaluate(medir); assert.deepEqual(p, [], `${w}x${h} pestaña ${t}: ${p.join('; ')}`); }
    await pg.click('.iv-cell >> nth=2'); await pg.waitForTimeout(200); assert.ok(await pg.locator('.iv-card h4').count() === 1, 'ficha del objeto'); assert.ok((await pg.locator('.iv-card').innerText()).length > 80);
    assert.deepEqual(errors.filter((e) => !/WebGL|GPU|ReadPixels/i.test(e)), [], `${w}x${h}`); await ctx.close();
  }
});
test('Inventario: equipar, bloquear, desguazar y forjar desde la interfaz actualizan el perfil', { skip: !hasChromium, timeout: 300000 }, async () => {
  const errors = [], { ctx, pg } = await abrir(1280, 720, false, errors); const perfil = () => pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  // equipar el fusil (u6, arma de disparo) a Axioma
  await pg.click('.iv-cell[data-u=u6]'); await pg.click('.iv-acts [data-a=poner]'); await pg.waitForTimeout(200); assert.equal((await perfil()).eq.axioma.gun, 'u6');
  await pg.click('.iv-cell[data-u=u7]'); await pg.click('.iv-acts [data-a=lock]'); await pg.waitForTimeout(100); assert.equal((await perfil()).inventario.find((i) => i.u === 'u7').lk, true);
  await pg.click('.iv-cell[data-u=u8]'); await pg.click('.iv-acts [data-a=desguazar]'); await pg.waitForTimeout(100); const p2 = await perfil(); assert.ok(!p2.inventario.some((i) => i.u === 'u8') && p2.cores > 300 && p2.materiales.hueso.some((n, c) => n > [6, 2, 0, 0][c]), 'desguazar da núcleos y materiales');
  // la Forja: la Cuchilla de Hueso es una receta Común (plano conocido de entrada): 3 de hueso + 15 núcleos
  await pg.click('.iv-tab[data-t=for]'); await pg.click('.iv-plan[data-id=cuchilla_hueso]'); await pg.click('.iv-acts [data-a=forjar]'); await pg.waitForTimeout(200);
  const p3 = await perfil(); assert.ok(p3.cultivo && p3.cultivo.item === 'cuchilla_hueso', 'cultiva'); assert.equal(p3.cores, p2.cores - RECETAS.cuchilla_hueso.cores);
  await pg.waitForSelector('.iv-acts [data-a=recoger]', { timeout: 60000 }); await pg.click('.iv-acts [data-a=recoger]'); await pg.waitForTimeout(200);
  const p4 = await perfil(); assert.equal(p4.cultivo, null); assert.ok(p4.inventario.filter((i) => i.id === 'cuchilla_hueso').length >= 1);
  assert.deepEqual(errors.filter((e) => !/WebGL|GPU|ReadPixels/i.test(e)), []); await ctx.close();
});
test('cuerpo con equipo: set completo en cada Huésped dentro del presupuesto de Baja (≤ 45 llamadas, ≤ 20 000 triángulos) y sin errores', { skip: !hasChromium, timeout: 1500000 }, async () => {
  const HOSTS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf'], SETLIST = Object.keys(SETS), res = {}, errors = [];
  for (const [i, id] of HOSTS.entries()) {
    const sid = SETLIST[(i * 2) % SETLIST.length], eq = [...SETS[sid].items.filter((x) => !/(cuchilla|hacha|maza|pica|cercenadora|aguja|filo)/.test(x)), SETS[sid].items.find((x) => /(cuchilla|hacha|maza|pica|cercenadora|aguja|filo)/.test(x))].map((x) => `${x}.3`).join(',');
    const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } }), pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(`${id}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Armadura|armor/i.test(m.text()))) errors.push(`${id}: ${m.text()}`); });
    await pg.goto(`${base}/huesped-arte.html?frozen=1&w=400&h=400&q=low&char=${id}&evo=4&pth=${i % 2 ? 'coraza,resonancia,simbiosis,apoteosis' : 'depredador,velocidad,artilleria,anomalia'}&eq=${eq}&t=1`, { waitUntil: 'domcontentloaded', timeout: 400000 });
    await pg.waitForFunction(() => window.__ready, null, { timeout: 400000 });
    res[`${id}|${sid}`] = await pg.evaluate(() => { const gl = window.__gl, sc = window.__scene; sc.children.forEach((o) => { if (o.type === 'Mesh' && !o.isSkinnedMesh && o.geometry && o.geometry.type === 'CircleGeometry') o.visible = false; if (o.geometry && o.geometry.type === 'RingGeometry') o.visible = false; });
      let worst = { calls: 0, triangles: 0 }; for (let k = 0; k < 20; k++) { window.__advance(0.1); gl.info.reset(); gl.render(sc, window.__cam); worst = { calls: Math.max(worst.calls, gl.info.render.calls), triangles: Math.max(worst.triangles, gl.info.render.triangles) }; } return worst; });
    await ctx.close();
  }
  console.log('presupuesto con equipo (renderer.info, Baja):', JSON.stringify(res));
  for (const [k, r] of Object.entries(res)) { assert.ok(r.calls <= 45, `${k}: ${r.calls} llamadas`); assert.ok(r.triangles <= 20000, `${k}: ${r.triangles} triángulos`); assert.ok(r.calls > 8 && r.triangles > 3000, `${k}: no dibujó`); }
  assert.deepEqual(errors, []);
});
