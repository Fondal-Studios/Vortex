// LA BASE en el navegador (Chromium por software, una página a la vez; docs/BASE.md): presupuesto de dibujo en Baja, recorrido real
// USAR → pantalla del menú → Volver, mini-menús, panel del Jardín con reloj, frase de un personaje, avisos en las cubas y capturas.
// Se corre sola: node --test tests/base-render.test.js   (≈ 1–3 min con la máquina libre; las capturas van a la carpeta temporal, o a BASE_SHOTS=<carpeta>)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const PRESUPUESTO = { calls: 60, tris: 40000 };   // escenario de Baja (mapa + NPC), sin el Huésped
const OUT = process.env.BASE_SHOTS || fs.mkdtempSync(`${os.tmpdir()}/base-`);
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('La Base en Baja: presupuesto, estaciones que abren sus pantallas, jardín, frases, avisos y capturas (844×390 y 1280×720)', { skip: !hasChromium, timeout: 1800000 }, async () => {
  const errores = [];
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
  pg.on('pageerror', (e) => errores.push(`PAGEERR ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errores.push(m.text().slice(0, 300)); });
  await pg.goto(`${base}/?state=base&q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 180000 });
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game && window.__api.session.base', null, { timeout: 120000 });
  await pg.waitForFunction('window.__renderer && window.__renderer.baseFx', null, { timeout: 120000, polling: 500 });   // el entorno se arma en una importación asíncrona
  await pg.waitForTimeout(2500);

  const tp = (x, z, rumbo = 0) => pg.evaluate(([x, z, r]) => { const p = window.__session.game.players[0], a = r * Math.PI / 180; p.pos.x = x; p.pos.z = z; p.pos.y = 0.9; p.vel = { x: 0, y: 0, z: 0 }; p.heading = { x: Math.sin(a), y: 0, z: -Math.cos(a) }; window.__renderer.camInit = false; }, [x, z, rumbo]);
  const usos = () => pg.evaluate(() => { const b = window.__session.game.base; return Object.values(b.visitas).reduce((x, y) => x + y, 0) + Object.values(b.habla).reduce((x, y) => x + y, 0); });
  // (por software cada cuadro tarda: se mantiene E hasta que la simulación registra el uso; si no hay nada a mano se suelta a los 45 s)
  const usar = async () => { const n = await usos(); await pg.keyboard.down('KeyE'); await pg.waitForFunction((n0) => { const b = window.__session.game.base; return Object.values(b.visitas).reduce((x, y) => x + y, 0) + Object.values(b.habla).reduce((x, y) => x + y, 0) > n0; }, n, { timeout: 45000, polling: 100 }).catch(() => {}); await pg.keyboard.up('KeyE'); await pg.waitForFunction(() => { const p = window.__session.game.players[0]; return !p.input.interact && !p.interactPrev; }, null, { timeout: 15000, polling: 100 }).catch(() => {}); await pg.waitForTimeout(300); };
  const pantalla = () => pg.evaluate(() => ({ menu: !document.getElementById('menu').classList.contains('hidden'), screen: window.__ui.screen, tab: window.__ui.iv && window.__ui.iv.tab, abierta: window.__session.menuAbierto, panel: !document.getElementById('bhpanel').hidden && window.__ui && document.getElementById('bhpanel').querySelector('h3') ? document.getElementById('bhpanel').querySelector('h3').textContent : '' }));
  const esperar = async (screen) => { await pg.waitForFunction((n) => !document.getElementById('menu').classList.contains('hidden') && window.__ui.screen === n, screen, { timeout: 60000, polling: 500 }).catch(() => {}); return pantalla(); };
  const volver = async () => { await pg.evaluate(() => window.__ui.back()); await pg.waitForTimeout(400); };

  // tutorial de la primera visita: se cierra y queda marcado en el perfil
  assert.ok(await pg.evaluate(() => !!document.getElementById('bhtutok')), 'tutorial de la Base en la primera visita');
  await pg.click('#bhtutok'); await pg.waitForTimeout(300);
  assert.equal(await pg.evaluate(async () => (await import('/src/client/perfil.js')).tutorialBaseVisto()), true);

  // presupuesto: escenario (mapa + NPC, sin el Huésped) en Baja, desde varias vistas
  const medidas = [];
  for (const [x, z, r] of [[0, 34, 0], [0, 8, 0], [0, -24, 0], [22, 2, 90], [24, -14, 0], [-16, 4, 280]]) {
    await tp(x, z, r); await pg.waitForTimeout(1200);
    medidas.push(await pg.evaluate(() => new Promise((ok) => requestAnimationFrame(() => {
      const R = window.__renderer, i = R.gl.info; R.entRoot.visible = false; i.reset(); window.__step(16); const e = { calls: i.render.calls, tris: i.render.triangles }; R.entRoot.visible = true; ok(e);
    }))));
  }
  const mx = { calls: Math.max(...medidas.map((m) => m.calls)), tris: Math.max(...medidas.map((m) => m.tris)) };
  console.log(`# escenario de la Base en Baja (máx. de ${medidas.length} vistas): ${mx.calls} llamadas, ${mx.tris} triángulos (presupuesto ${PRESUPUESTO.calls} / ${PRESUPUESTO.tris})`);
  assert.ok(mx.calls <= PRESUPUESTO.calls, `llamadas ${mx.calls}`); assert.ok(mx.tris <= PRESUPUESTO.tris, `triángulos ${mx.tris}`);

  // HUD mínimo: saldo, objetivo sugerido y los tres botones
  await tp(0, 30, 0); await pg.waitForTimeout(900);
  const hud = await pg.evaluate(() => ({ saldo: document.getElementById('bhcores').textContent, obj: document.getElementById('bhobj').textContent, btns: ['bhjugar', 'bhmenu', 'bhsalir'].map((id) => !!document.getElementById(id)), hudCombate: getComputedStyle(document.getElementById('hud')).display }));
  assert.match(hud.saldo, /núcleos/); assert.match(hud.obj, /Objetivo/); assert.deepEqual(hud.btns, [true, true, true]); assert.equal(hud.hudCombate, 'none', 'el HUD de partida no se muestra en la Base');
  await pg.screenshot({ path: `${OUT}/base-hud-1280x720.png` });

  // La Forja: USAR → Inventario en la pestaña Forja; Volver regresa al mapa
  await tp(0, -26, 0); await usar();
  let s = await esperar('inventario'); assert.equal(s.menu, true, JSON.stringify(s)); assert.equal(s.screen, 'inventario'); assert.equal(s.tab, 'for'); assert.equal(s.abierta, true);
  await pg.screenshot({ path: `${OUT}/base-forja-pantalla-1280x720.png` });
  await volver(); s = await pantalla(); assert.equal(s.menu, false); assert.equal(s.abierta, false, 'Volver cierra el menú y regresa a la Base');
  // El Cambista → Tienda
  await tp(-24, -4, 270); await usar(); s = await esperar('tienda'); assert.equal(s.screen, 'tienda', JSON.stringify(s) + ' ' + JSON.stringify(errores) + ' ' + JSON.stringify(await pg.evaluate(() => ({ v: window.__session.game.base.visitas, i: window.__session.game.players[0].input.interact, ip: window.__session.game.players[0].interactPrev, pos: window.__session.game.players[0].pos, open: window.__session.menuAbierto, paused: window.__session.paused })))); await volver();
  // Los Capullos → mini-menú; la tecla 2 abre Evolución
  await tp(22, 0, 90); await usar(); s = await pantalla(); assert.equal(s.menu, false); assert.match(s.panel, /Capullos/);
  await pg.keyboard.press('Digit2'); s = await esperar('evolucion'); assert.equal(s.screen, 'evolucion'); await volver();
  // Mesa de Territorios → mini-menú; la 1 abre las Arenas
  await tp(0, 5, 0); await usar(); s = await pantalla(); assert.match(s.panel, /Mesa de Territorios/);
  await pg.keyboard.press('Digit1'); s = await esperar('arenas'); assert.equal(s.screen, 'arenas'); await volver();
  // Faunario → Bestiario · Trofeos → mini-menú · Coop → pantalla Cooperativo
  await tp(26, -34, 0); await usar(); s = await esperar('bestiary'); assert.equal(s.screen, 'bestiary'); await volver();
  await tp(-24, -24, 0); await usar(); s = await pantalla(); assert.match(s.panel, /Trofeos/); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  await tp(-28, 28, 270); await usar(); s = await esperar('coop'); assert.equal(s.screen, 'coop'); await volver();

  // Jardín: sembrar (gasta núcleos), esperar (reloj real simulado) y cosechar (suma el material)
  await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'); P.perfil().cores = 500; P.guardar(); });
  await tp(26, -17, 0); await usar(); s = await pantalla(); assert.match(s.panel, /Jardín/);
  await pg.screenshot({ path: `${OUT}/base-jardin-panel-1280x720.png` });
  await pg.click('[data-s="0"]'); await pg.waitForTimeout(300);
  const sem = await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'); const j = P.jardinEstado()[0]; return { estado: j.estado, cores: P.perfil().cores, planta: j.planta && j.planta.id, mat: j.planta && j.planta.mat }; });
  assert.equal(sem.estado, 'crece'); assert.ok(sem.cores < 500);
  const antes = await pg.evaluate(async ([m]) => (await import('/src/client/perfil.js')).stockMin(m, 0), [sem.mat]);
  await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'); P.perfil().base.jardin[0].t0 -= 3 * 3600 * 1000; });   // «pasaron 3 horas»
  await pg.waitForSelector('[data-c="0"]', { timeout: 5000 }); await pg.click('[data-c="0"]'); await pg.waitForTimeout(300);
  const desp = await pg.evaluate(async ([m]) => { const P = await import('/src/client/perfil.js'); return { n: P.stockMin(m, 0), estado: P.jardinEstado()[0].estado }; }, [sem.mat]);
  assert.ok(desp.n > antes, 'la cosecha suma materiales'); assert.equal(desp.estado, 'vacia');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);

  // La Guía habla (frase corta, en español) y la cuba grande avisa cuando el cultivo termina
  await tp(5, 24, 0); await usar();
  const frase = await pg.evaluate(() => { const e = document.getElementById('bhhabla'); return { on: e.classList.contains('on'), t: e.textContent }; }); assert.ok(frase.on && /Guía/.test(frase.t) && frase.t.length < 200, frase.t);
  await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'), it = Object.keys((await import('/src/sim/items.js')).ITEMS)[0]; P.perfil().cultivo = { item: it, listo: Date.now() - 1000, dur: 60, q: 0.5 }; P.guardar(); });
  await pg.waitForTimeout(1600);
  const cuba = await pg.evaluate(() => { const d = window.__renderer.baseFx.datos, a = d.avisos || {}; return { aviso: a.forja, prog: d.cultivo && d.cultivo.prog }; }); assert.equal(cuba.aviso, 1); assert.equal(cuba.prog, 1);
  await tp(0, -24, 0); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${OUT}/base-forja-lista-1280x720.png` });
  await tp(0, 12, 0); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${OUT}/base-hub-1280x720.png` });

  // el panel de combate del Huésped no actúa: disparar y habilidades no producen proyectiles
  await pg.evaluate(() => { window.__api.session.game.setInput(1, { fire: true, ability: true, mov: true }); });
  await pg.waitForTimeout(800);
  assert.equal(await pg.evaluate(() => window.__session.game.projectiles.length), 0);

  // móvil apaisado 844×390: HUD legible, sin desbordes
  await pg.setViewportSize({ width: 844, height: 390 }); await tp(0, 12, 0); await pg.waitForTimeout(2500);
  const caja = await pg.evaluate(() => { const r = document.querySelector('.bh-top').getBoundingClientRect(), b = [...document.querySelectorAll('.bh-btn')].map((e) => e.getBoundingClientRect()); return { w: innerWidth, right: r.right, alto: r.height, btnMin: Math.min(...b.map((x) => x.height)), fuera: b.some((x) => x.right > innerWidth + 1 || x.left < -1), scroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
  assert.ok(!caja.fuera && !caja.scroll, JSON.stringify(caja)); assert.ok(caja.btnMin >= 36, 'botones tocables'); assert.ok(caja.alto < 130, 'la barra de arriba no tapa media pantalla: ' + caja.alto);
  await pg.screenshot({ path: `${OUT}/base-hud-844x390.png` });
  await tp(0, -24, 0); await pg.waitForTimeout(1800); await pg.screenshot({ path: `${OUT}/base-forja-844x390.png` });
  await tp(26, -17, 0); await usar(); await pg.screenshot({ path: `${OUT}/base-jardin-844x390.png` });
  const panel = await pg.evaluate(() => { const r = document.getElementById('bhpanel').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; }); assert.ok(panel.h <= 390 && panel.top >= -1 && panel.bottom <= 391, 'el panel del jardín cabe en 844×390: ' + JSON.stringify(panel));

  assert.deepEqual(errores.filter((e) => !/toNonIndexed|PCFSoftShadowMap/.test(e)), [], 'sin errores de consola');
  console.log(`# capturas en ${OUT}`);
  } finally { await pg.close(); }
});

test('La Base: «Entrar a la Base» al terminar una partida y el ajuste de Opciones; la tarjeta del menú entra al mapa', { skip: !hasChromium, timeout: 900000 }, async () => {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  try {
  await pg.goto(`${base}/?q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 180000 });
  await pg.waitForFunction('window.__ui && window.__api', null, { timeout: 120000 });
  // el menú: Jugar › La Base entra al mapa
  const r = await pg.evaluate(() => { const u = window.__ui; u.show('hub-jugar'); const card = [...document.querySelectorAll('#hub-jugar .hubcard')].find((c) => c.dataset.go === 'base'); return { hay: !!card, titulo: card && card.textContent }; });
  assert.ok(r.hay && /Base/.test(r.titulo));
  await pg.evaluate(() => document.querySelector('#hub-jugar .hubcard[data-go="base"]').click());
  await pg.waitForFunction('window.__api.session && window.__api.session.base', null, { timeout: 120000 });
  assert.equal(await pg.evaluate(() => document.body.classList.contains('en-base')), true);
  // el ajuste (por defecto «sí») muestra u oculta el botón del final de partida
  assert.equal(await pg.evaluate(() => window.__api.settings().baseAlTerminar), true);
  assert.equal(await pg.evaluate(() => document.getElementById('basesel').value), '1');
  assert.deepEqual(errores, []);
  } finally { await pg.close(); }
});
