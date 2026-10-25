// E2E de navegador (Chromium real, WebGL por software) del Sprint 1: menú → elegir primer Huésped → cinemática (saltable) → tutorial jugable → primer combate.
// Guarda capturas reales en shots/sprint1/. Sin Chromium/WebGL la prueba FALLA con REQUIRE_BROWSER=1 y, si no, se omite AVISANDO (ver browserAvailable).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';
import { launch, browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
if (!hasChromium) console.warn('AVISO: no hay Chromium: onboarding-browser NO se ejecutó (no es un pase).');
const OUT = 'shots/sprint1/'; fs.mkdirSync(OUT, { recursive: true });

/** Piloto automático del navegador: la misma lógica que el bot de tests/onboarding.test.js, entregada por el gancho window.__botInput. */
const PILOTO = () => {
  let k = 0;
  window.__botInput = (g) => {
    const p = g.players[0], t = g.tutorial; k++; if (!t || t.fin || window.__sinPiloto) return {};
    const s = t.snap(), inp = {}, cl = (v, m) => Math.max(-m, Math.min(m, v));
    const aim = (q) => { const dx = q[0] - p.pos.x, dz = q[2] - p.pos.z; return { err: Math.atan2(p.heading.x * dz - p.heading.z * dx, p.heading.x * dx + p.heading.z * dz), d: Math.hypot(dx, dz) }; };
    if (s.id === 'mover') inp.mz = 1; else if (s.id === 'mirar') inp.dyaw = 0.05; else if (s.id === 'saltar') inp.jump = (k % 40) < 5;
    else if ((s.id === 'atacar' || s.id === 'rematar') && s.mp) { const a = aim(s.mp); inp.dyaw = cl(a.err, 0.2); inp.dpitch = cl(Math.atan2(s.mp[1] - p.pos.y - 0.7, a.d) - p.pitch, 0.1); if (p.mode === 'combo') { if (a.d > 4.6) inp.mz = 1; inp.a1 = (k % 20) < 8; } else { inp.fire = true; if (a.d > 25) inp.mz = 1; } }
    else if (s.id === 'habilidad') inp.mov = (k % 60) < 10; else if (s.id === 'esquivar') inp.mx = s.zona && Math.hypot(p.pos.x - s.zona.p[0], p.pos.z - s.zona.p[2]) < s.zona.r + 1.2 ? 1 : 0;   // sale del círculo y se detiene (no sigue hasta un portal)
    else if ((s.id === 'usar' || s.id === 'curar') && s.mp) { const a = aim(s.mp); inp.dyaw = cl(a.err, 0.2); if (a.d > 2.5) inp.mz = 1; inp.interact = (k % 30) < 3 && a.d < 3.4; }
    return inp;
  };
};

test('onboarding E2E: menú → elegir primer Huésped → cinemática saltable → tutorial → primer combate (y no se repite)', { skip: !hasChromium, timeout: 600000 }, async () => {
  const srv = await startServer({ port: 0 }), b = await launch(), pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const url = `http://localhost:${srv.port}/?q=low&autoq=0&nolock=1`;
  try {
    const webgl = await (await b.newPage()).evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
    assert.equal(webgl, true, 'WebGL disponible en este Chromium');
    await pg.goto(url); await pg.waitForFunction(() => window.__api && window.__ui, null, { timeout: 90000 });
    assert.equal(await pg.evaluate(() => localStorage.getItem('cristal.perfil.v1')), null, 'perfil nuevo');
    await pg.evaluate(() => window.__ui.confirmTitle()); await pg.waitForTimeout(1200); await pg.screenshot({ path: OUT + '01-menu.png' });
    // 1) Menú → Campaña → Comenzar: aparece «Elegí tu primer Huésped» (un jugador nuevo no tiene ninguno)
    await pg.click('#continuar'); await pg.click('#modes .card >> nth=0'); await pg.waitForSelector('#story [data-campaign]:not([hidden])');
    await pg.click('#story [data-campaign]:not([hidden]):not(:disabled) >> nth=0');
    await pg.waitForSelector('#primerhuesped'); await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '02-elegir-primer-huesped.png' });
    assert.equal(await pg.locator('#primerhuesped .ph-card').count(), 3, 'tres iniciales');
    for (const t of ['Rol', 'Estilo y arma', 'Habilidad principal', 'Su historia']) assert.ok((await pg.textContent('#primerhuesped')).includes(t), t);
    await pg.click('#primerhuesped .ph-card[data-id="vesper"]'); assert.match(await pg.textContent('#phgo'), /Vesper/);
    await pg.screenshot({ path: OUT + '03-vesper-elegida.png' });
    await pg.click('#phgo');
    // 2) el Huésped queda guardado como inicial y los otros siguen bloqueados
    const perfil = await pg.evaluate(() => JSON.parse(localStorage.getItem('cristal.perfil.v1')));
    assert.equal(perfil.inicial, 'vesper'); assert.deepEqual(perfil.huespedes, []);
    // 3) cinemática de transferencia (20–30 s) con subtítulos
    await pg.waitForSelector('#transfer', { timeout: 60000 });
    await pg.waitForFunction(() => window.__transfer && window.__transfer.t > 2.5, null, { timeout: 120000 }); await pg.screenshot({ path: OUT + '04-cinematica-vacio.png' });
    assert.ok((await pg.textContent('.comic-caption')).length > 5, 'subtítulos en pantalla');
    await pg.locator('#transfer [data-next]').click(); await pg.screenshot({ path: OUT + '05-cinematica-cuerpo.png' });
    await pg.locator('#transfer [data-next]').click(); await pg.locator('#transfer [data-next]').click();
    assert.match(await pg.locator('.comic-actor').getAttribute('src'), /vesper.png/);
    assert.equal(await pg.evaluate(() => window.__transfer.done), false, 'el cómic espera al lector'); await pg.screenshot({ path: OUT + '06-cinematica-transferencia.png' });
    assert.equal(await pg.evaluate(() => window.__transfer.kind), 'comic', 'se usa el cómic ligero con el huésped elegido');
    // saltable con confirmación mínima: el primer toque sólo pide confirmar, el segundo salta (todo en un mismo instante para no competir con el reloj)
    const salto = await pg.evaluate(() => { const bt = document.querySelector('#transfer .tr-skip'); bt.click(); const r = { pide: bt.textContent, hecho1: window.__transfer.done }; bt.click(); r.hecho2 = window.__transfer.done; r.saltado = window.__transfer.skipped; return r; });
    assert.match(salto.pide, /de nuevo/); assert.equal(salto.hecho1, false, 'un toque no salta'); assert.equal(salto.hecho2, true); assert.equal(salto.saltado, true);
    await pg.waitForFunction(() => !document.getElementById('transfer'), null, { timeout: 20000 });
    // 4) tutorial jugable dentro de Islas
    await pg.waitForSelector('#tutpanel:not([hidden])', { timeout: 60000 }); await pg.waitForFunction(() => /Caminar/.test((document.getElementById('tutpanel') || {}).textContent || ''), null, { timeout: 60000 });
    assert.equal(await pg.evaluate(() => window.__api.session.game.wave), 0, 'el combate real no empezó');
    await pg.screenshot({ path: OUT + '07-tutorial-caminar.png' });
    // entrada real de teclado: caminar con W
    await pg.keyboard.down('KeyW'); await pg.waitForFunction(() => window.__api.session.game.tutorial.snap().i >= 1 || window.__api.session.game.tutorial.snap().prog > 0.5, null, { timeout: 120000 }); await pg.keyboard.up('KeyW');
    await pg.evaluate(PILOTO);
    for (const [id, f] of [['atacar', '08-tutorial-ataque.png'], ['esquivar', '09-tutorial-esquivar.png'], ['usar', '10-tutorial-usar.png'], ['curar', '11-tutorial-curar.png']]) {
      await pg.waitForFunction((x) => { const s = window.__api.session.game.tutorial.snap(); return s.id === x && !s.ok && s.t > 1.2; }, id, { timeout: 240000 }); await pg.screenshot({ path: OUT + f });
    }
    await pg.waitForFunction(() => window.__api.session.game.tutorial.fin, null, { timeout: 240000 });
    const tut = await pg.evaluate(() => ({ ...window.__api.session.game.tutorial.snap(), perfil: JSON.parse(localStorage.getItem('cristal.perfil.v1')).tut }));
    assert.equal(tut.saltado, false, 'completado, no saltado'); assert.equal(tut.perfil.hecho, true, 'el tutorial queda guardado');
    // 5) primer combate real
    await pg.waitForFunction(() => window.__api.session.game.wave >= 1 && window.__api.session.game.monsters.length > 0, null, { timeout: 240000 }); await pg.waitForTimeout(2500);
    await pg.screenshot({ path: OUT + '12-primer-combate.png' });
    assert.match(await pg.textContent('#wave'), /OLEADA 1/);
    assert.deepEqual(errs, [], 'sin errores de consola/JS: ' + errs.join(' | '));
    // 6) segunda vez: el mismo perfil NO ve el selector, ni la cinemática, ni el tutorial
    await pg.evaluate(() => { window.__sinPiloto = true; }); await pg.goto(url); await pg.waitForFunction(() => window.__api && window.__ui, null, { timeout: 90000 });
    await pg.evaluate(() => window.__ui.confirmTitle()); await pg.waitForTimeout(800);
    await pg.click('#continuar');   // con la campaña ya empezada, «Continuar» retoma directo (sin selector ni cinemática)
    await pg.waitForFunction(() => window.__api.session && window.__api.session.game, null, { timeout: 90000 });
    assert.equal(await pg.locator('#primerhuesped').count(), 0); await pg.waitForFunction(()=>window.__transfer&&!window.__transfer.done); await pg.evaluate(()=>{const b=document.querySelector('#transfer .tr-skip');b.click();b.click();}); assert.equal(await pg.locator('#transfer').count(), 0); assert.equal(await pg.evaluate(() => !!window.__api.session.game.tutorial), false, 'sin tutorial la 2.ª vez');
    assert.equal(await pg.evaluate(() => window.__api.renderer.third), true, 'cámara en tercera persona por defecto');
    await pg.mouse.click(300, 300); await pg.waitForFunction(() => !window.__api.session.intro, null, { timeout: 60000 }); await pg.click('#tutok', { timeout: 30000 });   // se salta la intro y se cierra la tarjeta de controles (ambas pausan la simulación)   // la intro de capítulo pausa la simulación: se salta para medir que la cámara no la frena
    // cámara (AC-05 en el navegador): el botón alterna sin frenar la simulación; cambiar de modo NO fuerza la cámara salvo «Cámara automática por modo»
    const cam = await pg.evaluate(async () => {
      const A = window.__api, r = {}; r.ini = A.renderer.third; const t0 = A.session.game.time;
      window.__setCam(false); r.manual = A.renderer.third; A.setGameMode('combo'); r.modoNoForzo = A.renderer.third; A.setGameMode('shooter');
      A.setSetting('camAuto', true); A.setGameMode('combo'); r.autoMele = A.renderer.third; A.setGameMode('shooter'); r.autoDisparo = A.renderer.third; A.setSetting('camAuto', false); window.__setCam(true);
      await new Promise((ok) => setTimeout(ok, 1500)); r.avanza = A.session.game.time > t0; r.fin = A.renderer.third; return r;
    });
    assert.deepEqual(cam, { ini: true, manual: false, modoNoForzo: false, autoMele: true, autoDisparo: false, avanza: true, fin: true });
    assert.equal(await pg.evaluate(() => !!document.getElementById('tutrep') && !!document.getElementById('camautosel')), true, 'Ajustes: «Repetir tutorial» y «Cámara automática»');
    await pg.screenshot({ path: OUT + '13-segunda-vez.png' });
  } finally { await b.close(); await srv.close(); }
});
