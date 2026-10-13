import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Evolución y armas cuerpo a cuerpo (src/client/evolucion-ui.js, huespedes-evo.js, melee-models.js, hud-evolucion.js, perfil.js):
// pantalla sin errores ni recortes en 4 tamaños · comprar / equipar / evolucionar con núcleos de prueba cambia el perfil y persiste ·
// el Huésped llega a la partida con el arma y el nivel elegidos · la tecla de evolucionar funciona en partida · presupuesto 3D en Baja.
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const SIZES = [['844x390', 844, 390, true], ['667x375', 667, 375, true], ['390x844', 390, 844, true], ['1280x720', 1280, 720, false]];
const KEY = 'cristal.perfil.v1';
const SEED = { cores: 500, evo: { axioma: 1, seraf: 3 }, melee: {}, owned: ['sable_plasma'] };

let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

/** Abre la pantalla Evolución con un perfil de prueba (sólo la primera vez: así sobrevive a recargar). */
async function openPage(w, h, touch, errors, seed = SEED, query = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  if (seed) await pg.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } } catch { /* ok */ } }, [KEY, seed]);
  pg.setDefaultTimeout(120000); await pg.goto(`${base}/?q=low&autoq=0${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); await pg.waitForTimeout(500);
  return { ctx, pg };
}
const openEv = async (pg) => { await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.evaluate(() => window.__api.ui.show('evolucion')); await pg.waitForFunction(() => window.__api.ui.ev && window.__api.ui.ev.host && window.__api.ui.ev.prev, null, { timeout: 120000 }); await pg.waitForTimeout(600); };
const perfil = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

// Mide cada bloque visible: ¿cabe en pantalla? ¿se superpone con otro? ¿hay texto cortado?
const measure = () => {
  const vw = innerWidth, vh = innerHeight, R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const root = document.querySelector('#evolucion'), visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const blocks = { back: root.querySelector('.backbtn'), rail: root.querySelector('#evrail'), head: root.querySelector('#evhead'), stage: root.querySelector('#evstage'), evolve: root.querySelector('#evevolve'), panel: root.querySelector('#evpanel') };
  const out = { problems: [] }, rects = {};
  for (const [k, e] of Object.entries(blocks)) { if (!e || !visible(e)) { out.problems.push(`falta o está oculto: ${k}`); continue; } rects[k] = R(e); const r = rects[k]; if (r.x < -1 || r.y < -1 || r.r > vw + 1 || r.b > vh + 1) out.problems.push(`${k} fuera del viewport (${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.r)},${Math.round(r.b)}) en ${vw}x${vh}`); }
  const keys = Object.keys(rects);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = rects[keys[i]], b = rects[keys[j]]; if (a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1) out.problems.push(`se superponen ${keys[i]} y ${keys[j]}`); }
  // dentro del panel con scroll: nada se sale a los lados; el botón de acción y el precio no se superponen
  for (const e of root.querySelectorAll('*')) { if (!visible(e) || e.closest('canvas')) continue; const r = R(e); if (r.r > vw + 1 || r.x < -1) out.problems.push(`desborde horizontal: <${e.tagName.toLowerCase()} class="${e.className}"> ${Math.round(r.x)}..${Math.round(r.r)}`); }
  for (const e of root.querySelectorAll('.ev-chip, .ev-btn, .ev-tab, .ev-tag, .ev-head h2, .ev-tier, .ev-cn b, .ev-cn small, .ev-core-n, .ev-w b, .ev-w small, .ev-price')) if (visible(e) && e.scrollWidth > e.clientWidth + 1) out.problems.push(`texto cortado: "${e.textContent.trim().slice(0, 30)}" (${e.scrollWidth}>${e.clientWidth})`);
  const a = root.querySelector('#evaction'), p = root.querySelector('#evprice'); if (visible(a) && visible(p)) { const ra = R(a), rp = R(p); if (ra.x < rp.r - 1 && rp.x < ra.r - 1 && ra.y < rp.b - 1 && rp.y < ra.b - 1) out.problems.push('el precio y el botón de acción se superponen'); }
  for (const id of ['#evbtn', '#evaction']) { const e = root.querySelector(id), r = R(e); if (r.h < 36) out.problems.push(`${id} muy bajo para tocar (${Math.round(r.h)} px)`); }
  // el botón de acción debe verse (no tapado por el borde del panel)
  const pr = rects.panel, ar = R(a); if (pr && (ar.b > pr.b + 1 || ar.y < pr.y - 1)) out.problems.push('el botón de acción queda fuera del panel');
  out.stage = rects.stage; out.prev = R(root.querySelector('#evprev')); return out;
};

for (const [vn, w, h, touch] of SIZES) {
  test(`pantalla Evolución ${vn}: sin errores, sin cortes ni solapes (5 Huéspedes × 6 pestañas)`, { skip: !hasChromium, timeout: 900000 }, async () => {
    const errors = [], { ctx, pg } = await openPage(w, h, touch, errors); await openEv(pg);
    for (const id of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) {
      await pg.click(`.ev-chip[data-id="${id}"]`); await pg.waitForTimeout(350);
      const m = await pg.evaluate(measure); assert.deepEqual(m.problems, [], `${vn} ${id}: ${m.problems.join(' | ')}`);
      assert.ok(m.stage.w > 150 && m.stage.h > 100, `${vn} ${id}: el escenario es muy chico (${Math.round(m.stage.w)}x${Math.round(m.stage.h)})`);
      assert.ok(m.prev.w > 70 && m.prev.h > 80, `${vn} ${id}: el recuadro del arma es muy chico (${Math.round(m.prev.w)}x${Math.round(m.prev.h)})`);
      assert.match(await pg.textContent('#evname'), new RegExp(id, 'i'));
    }
    for (const tab of ['espada', 'hacha', 'martillo', 'lanza', 'daga', 'innata']) {
      await pg.click(`.ev-tab[data-tab="${tab}"]`); await pg.waitForTimeout(250);
      const m = await pg.evaluate(measure); assert.deepEqual(m.problems, [], `${vn} pestaña ${tab}: ${m.problems.join(' | ')}`);
      assert.ok(await pg.locator('.ev-w').count() >= 3, `la pestaña ${tab} lista sus armas`);
      await pg.locator('.ev-w').last().click(); await pg.waitForTimeout(250);
      const m2 = await pg.evaluate(measure); assert.deepEqual(m2.problems, [], `${vn} arma de ${tab}: ${m2.problems.join(' | ')}`);
    }
    await pg.click('.ev-chip[data-id="seraf"]'); await pg.waitForTimeout(300); await pg.click('#evpeek'); await pg.waitForTimeout(300);
    const m3 = await pg.evaluate(measure); assert.deepEqual(m3.problems, [], `${vn} vista previa: ${m3.problems.join(' | ')}`);
    await pg.screenshot({ path: `shots/evolucion/test-${vn}.png` });
    assert.deepEqual(errors, [], 'errores de consola:\n' + errors.join('\n'));
    await ctx.close();
  });
}

test('comprar, equipar y evolucionar cambia el perfil y persiste tras recargar; llega a la partida (players[0].melee/evo)', { skip: !hasChromium, timeout: 900000 }, async () => {
  const errors = [], { ctx, pg } = await openPage(1280, 720, false, errors, SEED, '&skipintro=1');
  await openEv(pg);
  assert.equal(await pg.getAttribute('#evolucion', 'data-sel'), 'axioma');
  assert.equal(await pg.textContent('#evcores'), '500');
  // evolver: Axioma 1 → 2 (cuesta 90)
  await pg.click('#evbtn'); await pg.waitForTimeout(400);
  let p = await perfil(pg); assert.equal(p.evo.axioma, 2, 'sube de nivel'); assert.equal(p.cores, 410, 'gasta 90 núcleos');
  assert.match(await pg.textContent('#evtier'), /Nivel\s*2/); assert.equal(await pg.evaluate(() => window.__api.ui.ev.host.evo), 2, 'el modelo 3D pasa al nivel 2');
  // comprar el hacha de quitina (40) y equiparla
  await pg.click('.ev-tab[data-tab="hacha"]'); await pg.click('.ev-w[data-id="hacha_quitina"]');
  assert.equal(await pg.getAttribute('#evaction', 'data-state'), 'comprable');
  await pg.click('#evaction'); await pg.waitForTimeout(300);
  p = await perfil(pg); assert.ok(p.owned.includes('hacha_quitina'), 'compra el arma'); assert.equal(p.cores, 370, 'gasta 40 núcleos');
  assert.equal(await pg.getAttribute('#evaction', 'data-state'), 'tuya');
  await pg.click('#evaction'); await pg.waitForTimeout(400);
  p = await perfil(pg); assert.equal(p.melee.axioma, 'hacha_quitina', 'equipa el arma');
  assert.equal(await pg.evaluate(() => window.__api.ui.ev.host.melee), 'hacha_quitina', 'el modelo 3D lleva el arma fusionada');
  // dejamos 10 núcleos (menos que cualquier arma cara) y recargamos: todo persiste
  await pg.evaluate(() => { const k = 'cristal.perfil.v1', o = JSON.parse(localStorage.getItem(k)); o.cores = 10; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload(); await pg.waitForFunction(() => window.__api && window.__api.ui); await pg.waitForTimeout(500);
  p = await perfil(pg); assert.equal(p.evo.axioma, 2); assert.equal(p.melee.axioma, 'hacha_quitina'); assert.ok(p.owned.includes('hacha_quitina')); assert.equal(p.cores, 10);
  await openEv(pg); assert.match(await pg.textContent('#evtier'), /Nivel\s*2/);
  assert.equal(await pg.locator('.ev-w.eq[data-id="hacha_quitina"]').count(), 1, 'tras recargar sigue equipada');
  await pg.click('.ev-tab[data-tab="martillo"]'); await pg.click('.ev-w[data-id="yunque_vital"]');
  assert.ok(await pg.isDisabled('#evaction'), 'sin núcleos suficientes el botón de comprar está desactivado');
  assert.ok(await pg.isDisabled('#evbtn'), 'sin núcleos suficientes no se puede evolucionar');
  // volver a la innata
  await pg.click('.ev-tab[data-tab="innata"]'); await pg.click('.ev-w[data-id="cuchillas"]'); await pg.click('#evaction'); await pg.waitForTimeout(300);
  p = await perfil(pg); assert.equal(p.melee.axioma, undefined, 'la innata deja al Huésped sin arma del catálogo');
  await pg.click('.ev-tab[data-tab="hacha"]'); await pg.click('.ev-w[data-id="hacha_quitina"]'); await pg.click('#evaction'); await pg.waitForTimeout(300);
  // jugar: el arma y el nivel llegan a la simulación
  await pg.evaluate(() => window.__api.ui.actions.arena('m1'));
  await pg.waitForFunction(() => window.__api.session && window.__api.session.game, null, { timeout: 120000 });
  const pl = await pg.evaluate(() => { const q = window.__api.session.game.players[0]; return { char: q.char, melee: q.melee, evo: q.evo }; });
  assert.deepEqual(pl, { char: 'axioma', melee: 'hacha_quitina', evo: 2 }, 'el Huésped llega con el arma y la evolución elegidas');
  await pg.waitForTimeout(1500);
  assert.deepEqual(errors, [], 'errores de consola:\n' + errors.join('\n'));
  await ctx.close();
});

test('en partida: contador de núcleos, aviso «¡Podés evolucionar!», tecla N y botón evolucionan; al salir los núcleos van al perfil', { skip: !hasChromium, timeout: 900000 }, async () => {
  const errors = [], { ctx, pg } = await openPage(1280, 720, false, errors, { cores: 5, evo: {}, melee: {}, owned: [] }, '&skipintro=1');
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.evaluate(() => window.__api.ui.actions.arena('m1'));
  await pg.waitForFunction(() => window.__api.session && window.__api.session.game, null, { timeout: 120000 }); await pg.waitForTimeout(1200); await pg.getByText('Entendido').click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(500);
  assert.ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#evohud')).display !== 'none'), 'el contador de núcleos se ve');
  assert.equal(await pg.locator('#evohud.ready').count(), 0, 'sin núcleos suficientes no hay aviso');
  await pg.evaluate(() => { const q = window.__api.session.game.players[0]; q.cores = 100; }); await pg.waitForSelector('#evohud.ready', { timeout: 15000 }).catch(() => {});
  assert.equal(await pg.locator('#evohud.ready').count(), 1, 'con núcleos suficientes aparece el aviso');
  assert.ok(await pg.isVisible('#evohud .eh-go'), 'el botón se ve'); assert.match(await pg.textContent('#evohud .eh-go'), /evolucionar/i);
  await pg.keyboard.down('KeyN'); await pg.waitForTimeout(300); await pg.keyboard.up('KeyN'); await pg.waitForTimeout(500);
  let q = await pg.evaluate(() => { const x = window.__api.session.game.players[0]; return { evo: x.evo, co: x.cores }; });
  assert.equal(q.evo, 1, 'la tecla N evoluciona'); assert.equal(q.co, 60, 'gasta 40 núcleos');
  assert.ok(await pg.evaluate(() => document.querySelector('#evofx').classList.contains('on')), 'efecto de evolución en pantalla');
  assert.match(await pg.textContent('#evofx'), /EVOLUCI[ÓO]N: Despertar/);
  assert.equal(await pg.locator('#evohud.ready').count(), 0, 'con 60 núcleos y costo 90 ya no hay aviso');
  await pg.evaluate(() => { window.__api.session.game.players[0].cores = 100; }); await pg.waitForTimeout(500);
  await pg.click('#evohud .eh-go'); await pg.waitForTimeout(500);
  q = await pg.evaluate(() => { const x = window.__api.session.game.players[0]; return { evo: x.evo, co: x.cores }; });
  assert.equal(q.evo, 2, 'el botón también evoluciona'); assert.equal(q.co, 10, 'gasta 90 núcleos');
  // al salir (cerrarPartida) los núcleos sobrantes y la evolución pasan al perfil: 5 del banco + 33 sobrantes
  await pg.evaluate(() => { window.__api.session.game.players[0].cores = 33; }); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.getElementById('quit').click());
  await pg.waitForFunction(() => window.__api && window.__api.ui && !window.__api.session, null, { timeout: 120000 }); await pg.waitForTimeout(400);
  const pf = await perfil(pg); assert.equal(pf.cores, 38, 'los núcleos de la partida suman al banco'); assert.equal(pf.evo.axioma, 2, 'se guarda la evolución alcanzada');
  assert.deepEqual(errors, [], 'errores de consola:\n' + errors.join('\n'));
  await ctx.close();
});

test('presupuesto 3D en Baja: armas ≤ 14 llamadas y ≤ 6 000 triángulos; Huéspedes evolucionados (renderer.info)', { skip: !hasChromium, timeout: 900000 }, async () => {
  const errors = [], ctx = await browser.newContext({ viewport: { width: 400, height: 400 } }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(e.message)); await pg.goto(`${base}/public/hero-view.html?char=egida&q=low&frozen=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const res = await pg.evaluate(async () => {
    const THREE = await import('three'), M = await import('/src/client/melee-models.js'), E = await import('/src/client/huespedes-evo.js');
    const gl = new THREE.WebGLRenderer({ antialias: false }); gl.setSize(256, 256); const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80); cam.position.set(0, 1.2, 9); scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2));
    const measure = (obj) => { scene.add(obj.group); let worst = { calls: 0, triangles: 0 }; for (let i = 0; i < 6; i++) { obj.update(0.05); gl.info.reset(); gl.render(scene, cam); worst = { calls: Math.max(worst.calls, gl.info.render.calls), triangles: Math.max(worst.triangles, gl.info.render.triangles) }; } scene.remove(obj.group); return worst; };
    const out = { armas: {}, hosts: {} };
    for (const id of M.MELEE_MODEL_IDS) { let w = { calls: 0, triangles: 0 }; for (let t = 0; t <= 4; t++) { const m = M.buildMelee(THREE, id, { tier: t, quality: 'low', color: 0x3aa8ff }), r = measure(m); w = { calls: Math.max(w.calls, r.calls), triangles: Math.max(w.triangles, r.triangles) }; m.dispose(); } out.armas[id] = w; }
    const WEAP = { axioma: 'sable_plasma', vesper: 'colmillo', micelio: 'martillo_sismico', umbra: 'pica_cristal', seraf: 'lanza_sinaptica' };
    for (const id of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) { let w = { calls: 0, triangles: 0 }; for (let t = 0; t <= 4; t++) { const h = E.buildHostEvo(THREE, id, { evo: t, melee: WEAP[id], quality: 'low' }); for (const p of ['idle', 'melee', 'skill']) { h.pose(p); const r = measure(h); w = { calls: Math.max(w.calls, r.calls), triangles: Math.max(w.triangles, r.triangles) }; } h.dispose(); } out.hosts[id] = w; }
    return out;
  });
  console.log('presupuesto armas (Baja, peor de los 5 niveles):', JSON.stringify(res.armas)); console.log('presupuesto Huéspedes evolucionados con arma (Baja, peor nivel):', JSON.stringify(res.hosts));
  for (const [id, r] of Object.entries(res.armas)) { assert.ok(r.calls <= 14, `${id}: ${r.calls} llamadas de dibujo`); assert.ok(r.triangles <= 6000, `${id}: ${r.triangles} triángulos`); assert.ok(r.calls >= 2 && r.triangles > 100, `${id}: no dibujó nada`); }
  for (const [id, r] of Object.entries(res.hosts)) { assert.ok(r.calls <= 70, `${id}: ${r.calls} llamadas de dibujo`); assert.ok(r.triangles <= 20000, `${id}: ${r.triangles} triángulos`); }
  assert.deepEqual(errors, []); await ctx.close();
});
