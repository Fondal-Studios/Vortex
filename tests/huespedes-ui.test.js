import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Pantalla «Elegí tu Huésped» (src/client/huespedes-ui.js): sin errores, elección persistida, sin cortes ni solapes en 4 tamaños,
// presupuesto 3D por Huésped (≤ 40 llamadas de dibujo y ≤ 15 000 triángulos en Baja) y el Huésped llega a la partida.
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const HOSTS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf'];
const SIZES = [['844x390', 844, 390, true], ['667x375', 667, 375, true], ['390x844', 390, 844, true], ['1280x720', 1280, 720, false]];
const KEY = 'cristal.huesped.v1';

let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

async function openPage(w, h, touch, errors) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  pg.setDefaultTimeout(120000); await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForTimeout(900);
  return { ctx, pg };
}

// Mide cada bloque visible: ¿cabe en pantalla? ¿se superpone con otro? ¿hay texto cortado?
const measure = () => {
  const vw = innerWidth, vh = innerHeight, R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const root = document.querySelector('#huesped'), visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const blocks = { back: document.querySelector('#huesped .backbtn') || document.querySelector('.screen.on .backbtn'), rail: root.querySelector('#hsrail'), head: root.querySelector('.hs-head'), stage: root.querySelector('#hsstage'), demo: root.querySelector('#hsdemo'), pick: root.querySelector('#hspick'), info: root.querySelector('#hsinfo') };
  const out = { problems: [] }, rects = {};
  for (const [k, e] of Object.entries(blocks)) { if (!e || !visible(e)) { out.problems.push(`falta o está oculto: ${k}`); continue; } rects[k] = R(e); const r = rects[k]; if (r.x < -1 || r.y < -1 || r.r > vw + 1 || r.b > vh + 1) out.problems.push(`${k} fuera del viewport (${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.r)},${Math.round(r.b)}) en ${vw}x${vh}`); }
  const keys = Object.keys(rects);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = rects[keys[i]], b = rects[keys[j]]; if (a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1) out.problems.push(`se superponen ${keys[i]} y ${keys[j]}`); }
  const railR = rects.rail || R(root.querySelector('#hsrail')); // el riel tiene scroll interno: sólo cuenta lo que se ve dentro de él
  const clip = (r) => ({ x: Math.max(r.x, railR.x), y: Math.max(r.y, railR.y), r: Math.min(r.r, railR.r), b: Math.min(r.b, railR.b) });
  const chips = [], cr = []; for (const c of root.querySelectorAll('.hs-chip')) { if (!visible(c)) continue; const q = clip(R(c)); if (q.b - q.y < 2 || q.r - q.x < 2) continue; chips.push(c); cr.push(q); }
  chips.forEach((c, i) => { const r = cr[i]; if (r.x < -1 || r.r > vw + 1 || r.y < -1 || r.b > vh + 1) out.problems.push(`chip ${c.dataset.id} fuera del viewport`); for (let j = i + 1; j < chips.length; j++) { const s = cr[j]; if (r.x < s.r - 1 && s.x < r.r - 1 && r.y < s.b - 1 && s.y < r.b - 1) out.problems.push(`chips ${c.dataset.id}/${chips[j].dataset.id} superpuestos`); } if (rects.back && r.x < rects.back.r - 1 && rects.back.x < r.r - 1 && r.y < rects.back.b - 1 && rects.back.y < r.b - 1) out.problems.push(`chip ${c.dataset.id} bajo el botón Volver`); });
  // nada se sale a los lados dentro de la pantalla, y ningún texto queda cortado
  for (const e of root.querySelectorAll('*')) { if (!visible(e) || e.closest('canvas, iframe')) continue; const r = R(e); if (r.r > vw + 1 || r.x < -1) out.problems.push(`desborde horizontal: <${e.tagName.toLowerCase()} class="${e.className}"> ${Math.round(r.x)}..${Math.round(r.r)}`); }
  for (const e of root.querySelectorAll('.hs-chip, .hs-btn, .hs-tag, .hs-head h2, .hs-title, .hs-vettoggle, .hs-cn b, .hs-cn small')) if (visible(e) && e.scrollWidth > e.clientWidth + 1) out.problems.push(`texto cortado: "${e.textContent.trim().slice(0, 30)}" (${e.scrollWidth}>${e.clientWidth})`);
  const info = root.querySelector('#hsinfo'); if (info.scrollWidth > info.clientWidth + 1) out.problems.push(`el panel de info desborda a los lados (${info.scrollWidth}>${info.clientWidth})`);
  const back = blocks.back && R(blocks.back); out.stage = rects.stage; out.hasBack = !!back; return out;
};

for (const [vn, w, h, touch] of SIZES) {
  test(`pantalla de Huésped ${vn}: 5 Huéspedes sin errores, sin cortes ni solapes`, { skip: !hasChromium, timeout: 600000 }, async () => {
    const errors = [], { ctx, pg } = await openPage(w, h, touch, errors);
    for (const id of HOSTS) {
      await pg.click(`.hs-chip[data-id="${id}"]`); await pg.waitForTimeout(450);
      const m = await pg.evaluate(measure);
      assert.deepEqual(m.problems, [], `${vn} ${id}: ${m.problems.join(' | ')}`);
      assert.ok(m.stage.w > 150 && m.stage.h > 110, `${vn} ${id}: el escenario 3D es muy chico (${Math.round(m.stage.w)}x${Math.round(m.stage.h)})`);
      const nombre = await pg.textContent('#hsname'); assert.match(nombre, new RegExp(id, 'i'));
      assert.equal(await pg.locator('.hs-ab').count(), 6, 'hab.1, hab.2, hab.3, definitiva, pasiva y melee');
      assert.equal(await pg.locator('.hs-stat').count(), 6, 'las 6 estadísticas');
    }
    // los veteranos están en una sección secundaria y no rompen el diseño
    await pg.click('#hsvettoggle'); await pg.waitForTimeout(300); await pg.click('.hs-chip[data-id="egida"]'); await pg.waitForTimeout(500);
    const mv = await pg.evaluate(measure); assert.deepEqual(mv.problems, [], `${vn} veteranos: ${mv.problems.join(' | ')}`);
    await pg.screenshot({ path: `shots/huespedes/test-${vn}-veteranos.png` });
    await pg.click('.hs-chip[data-id="seraf"]'); await pg.click('#hsdemo'); await pg.waitForTimeout(400);
    assert.deepEqual(errors, [], 'errores de consola:\n' + errors.join('\n'));
    await ctx.close();
  });
}

test('el Huésped elegido se guarda, sobrevive a recargar y llega a la partida (players[0].char)', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], { ctx, pg } = await openPage(1280, 720, false, errors);
  await pg.click('.hs-chip[data-id="vesper"]'); await pg.click('#hspick'); await pg.waitForTimeout(700);
  assert.equal(await pg.evaluate((k) => localStorage.getItem(k), KEY), 'vesper', 'se guarda en cristal.huesped.v1');
  await pg.reload(); await pg.waitForFunction(() => window.__api && window.__api.ui); await pg.waitForTimeout(500);
  assert.equal(await pg.evaluate((k) => localStorage.getItem(k), KEY), 'vesper', 'persiste tras recargar');
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForTimeout(800);
  assert.equal(await pg.getAttribute('#huesped', 'data-sel'), 'vesper', 'la pantalla abre en el Huésped guardado');
  assert.ok(await pg.locator('.hs-chip.chosen[data-id="vesper"]').count(), 'marcado como elegido');
  // jugar: el Huésped llega al juego
  await pg.evaluate(() => window.__api.ui.actions.arena('m1'));
  await pg.waitForFunction(() => window.__api.session && window.__api.session.game, null, { timeout: 120000 });
  const ch = await pg.evaluate(() => window.__api.session.game.players[0].char); assert.equal(ch, 'vesper');
  await pg.waitForTimeout(1500);
  assert.deepEqual(errors, [], 'errores de consola:\n' + errors.join('\n'));
  await ctx.close();
});

test('presupuesto 3D en Baja: ≤ 40 llamadas de dibujo y ≤ 15 000 triángulos por Huésped (renderer.info)', { skip: !hasChromium, timeout: 600000 }, async () => {
  const errors = [], ctx = await browser.newContext({ viewport: { width: 400, height: 400 } }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(e.message)); await pg.goto(`${base}/public/hero-view.html?char=egida&q=low&frozen=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const res = await pg.evaluate(async () => {
    const THREE = await import('three'), { buildHost } = await import('/src/client/huespedes-view.js');
    const gl = new THREE.WebGLRenderer({ antialias: false }); gl.setSize(256, 256); const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 1.2, 8); scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2));
    const out = {};
    for (const id of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) {
      const h = buildHost(THREE, id, 'low'); scene.add(h.group); let worst = { calls: 0, triangles: 0 };
      for (const p of ['idle', 'melee', 'skill']) { h.pose(p); for (let i = 0; i < 40; i++) { h.update(0.03); gl.info.reset(); gl.render(scene, cam); worst = { calls: Math.max(worst.calls, gl.info.render.calls), triangles: Math.max(worst.triangles, gl.info.render.triangles) }; } }
      out[id] = worst; scene.remove(h.group); h.dispose();
    }
    return out;
  });
  console.log('presupuesto (renderer.info, Baja):', JSON.stringify(res));
  for (const [id, r] of Object.entries(res)) { assert.ok(r.calls <= 40, `${id}: ${r.calls} llamadas de dibujo`); assert.ok(r.triangles <= 15000, `${id}: ${r.triangles} triángulos`); assert.ok(r.calls > 5 && r.triangles > 500, `${id}: no dibujó nada`); }
  assert.deepEqual(errors, []); await ctx.close();
});
