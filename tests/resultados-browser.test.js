// E2E (Chromium real, WebGL por software): derrota/victoria → pantalla de resultados → guardado → recarga → progreso conservado y SIN duplicar,
// aviso y recuperación cuando el almacenamiento falla, y botones Reintentar / Menú. Una sola prueba larga (la máquina es lenta):
//   node --test tests/resultados-browser.test.js        (REQUIRE_BROWSER=1 en CI: sin Chromium FALLA en vez de omitir)
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/server.js';
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();

test('resultados en navegador: derrota parcial, victoria, recarga sin duplicar, almacenamiento lleno con recuperación, Reintentar y Menú', { skip: hasChromium ? false : 'FALTA Chromium/WebGL en esta máquina: prueba E2E NO ejecutada', timeout: 600000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0, silencio: true }); const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 900, height: 500 } }), pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  const URL_ = `http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low`, G = { waitUntil: 'domcontentloaded', timeout: 240000 };
  const abrir = async () => { await pg.goto(URL_, G); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 120000 }); await pg.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(50); }); };
  const terminar = async (estado, cores = 300) => {
    await pg.evaluate(([e, c]) => { const g = window.__api.session.game; g.players[0].cores = c; g.players[0].kills = 20; g.wave = Math.max(g.wave, 3); g.state = e; for (let i = 0; i < 80 && !window.__ended; i++) window.__step(50); }, [estado, cores]);
    await pg.waitForSelector('#endres', { timeout: 15000 });
  };
  const perfil = () => pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('cristal.perfil.v1') || '{}'); return { cores: p.cores || 0, ledger: (p.ledger || []).map((r) => r.id), xp: Object.values(p.mae || {}).reduce((a, m) => a + m.xp, 0) }; });
  try {
    // 1) DERROTA: pantalla de resultados con recompensa PARCIAL y un recibo
    await abrir(); const id1 = await pg.evaluate(() => window.__api.session.matchId); assert.match(id1, /^[A-Za-z0-9_-]{8,64}$/);
    await terminar('lost');
    assert.equal(await pg.getAttribute('#endres', 'data-tono'), 'derrota'); assert.match(await pg.textContent('#endtitle'), /FALLIDA/);
    assert.match(await pg.textContent('#endres'), /Oleada|Etapa/); assert.match(await pg.textContent('#endres'), /Recompensa parcial/); assert.match(await pg.textContent('#endres'), /completar la misión/);
    assert.equal(await pg.isVisible('#endres .er-aviso.grave'), false);
    let p1 = await perfil(); assert.ok(p1.cores > 0 && p1.cores < 300, 'núcleos parciales: ' + p1.cores); assert.deepEqual(p1.ledger, [id1]);
    // 2) RECARGA: el progreso sigue y volver a cobrar el mismo matchId no suma
    await pg.reload(G); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
    assert.deepEqual(await perfil(), p1, 'progreso conservado tras recargar');
    const dup = await pg.evaluate(async (id) => { const P = await import('/src/client/perfil.js'); const r = P.cerrarPartida('axioma', { co: 300, kills: 20 }, { matchId: id, wave: 3, won: false }); return { dup: r.duplicado, cores: P.perfil().cores }; }, id1);
    assert.equal(dup.dup, true); assert.equal(dup.cores, p1.cores);
    // 3) VICTORIA: recompensa completa
    await abrir(); const id2 = await pg.evaluate(() => window.__api.session.matchId); assert.notEqual(id2, id1);
    await terminar('won'); assert.equal(await pg.getAttribute('#endres', 'data-tono'), 'victoria'); assert.match(await pg.textContent('#endtitle'), /COMPLETADA/); assert.doesNotMatch(await pg.textContent('#endres'), /Recompensa parcial/);
    const p2 = await perfil(); assert.equal(p2.cores - p1.cores, 300, 'victoria: núcleos completos'); assert.deepEqual(p2.ledger, [id1, id2]);
    await pg.click('#endres summary'); assert.equal(await pg.isVisible('#er-detalle .er-sec'), true, 'detalle expandible');
    // 4) ALMACENAMIENTO LLENO: aviso claro, nada a medias, Reintentar lo recupera una sola vez
    await abrir(); const id3 = await pg.evaluate(() => window.__api.session.matchId);
    await pg.evaluate(() => { window.__setItem0 = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('cuota'); e.name = 'QuotaExceededError'; throw e; }; });
    await terminar('won'); assert.equal(await pg.isVisible('#endres .er-aviso.grave'), true, 'aviso visible'); assert.match(await pg.textContent('#endres .er-aviso'), /lleno|NO se guardó/);
    for (const id of ['#er-reintentar', '#er-descargar', '#er-copiar']) assert.equal(await pg.isVisible(id), true, id);
    assert.deepEqual(await perfil(), p2, 'con el almacenamiento lleno no queda nada a medias en disco');
    await pg.evaluate(() => { Storage.prototype.setItem = window.__setItem0; });   // vuelve el espacio
    await pg.click('#er-reintentar'); await pg.waitForFunction(() => /Listo/.test(document.querySelector('.er-msg').textContent), null, { timeout: 10000 });
    const p3 = await perfil(); assert.equal(p3.cores - p2.cores, 300); assert.deepEqual(p3.ledger, [id1, id2, id3]);
    await pg.click('#er-reintentar'); assert.deepEqual(await perfil(), p3, 'reintentar otra vez no duplica');
    await pg.reload(G); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); assert.deepEqual(await perfil(), p3, 'recarga: sigue igual');
    // 5) BOTONES: Reintentar arranca una partida nueva (otro matchId); Menú vuelve al menú
    await abrir(); const id4 = await pg.evaluate(() => window.__api.session.matchId); await terminar('lost');
    await pg.click('#again'); await pg.waitForFunction((prev) => window.__api.session && !window.__api.session.ended && window.__api.session.matchId !== prev && document.getElementById('end').classList.contains('hidden'), id4, { timeout: 60000 });
    await terminar('lost'); await Promise.all([pg.waitForNavigation({ ...G }), pg.click('#tomenu')]);
    await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
    assert.deepEqual(errs.filter((e) => !/WebGL|GPU|ResizeObserver/i.test(e)), [], 'sin errores de página');
  } finally { await b.close(); await srv.close(); }
});
