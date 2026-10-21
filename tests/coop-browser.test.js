// Cooperativo en navegadores reales (Chromium por software): enlace de invitación, lobby, latencia simulada, recarga a mitad de partida y mensajes de error.
// Una sola prueba larga a propósito (la máquina es lenta): se corre con `node --test tests/coop-browser.test.js`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));

test('cooperativo en navegador: invitar por enlace ?sala=, lobby, 200 ms de latencia, recarga y errores en español', { skip: !hasChromium, timeout: 900000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0, silencio: true }); const b = await launch();
  const base = `http://localhost:${srv.port}/?q=low&skipintro=1&autoq=0`, G = { waitUntil: 'domcontentloaded', timeout: 240000 };
  const mk = async () => { const ctx = await b.newContext({ viewport: { width: 800, height: 450 } }); const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message)); pg.on('dialog', (d) => d.dismiss()); return pg; };
  try {
    const A = await mk(); await A.goto(base, G); await A.waitForFunction(() => window.__ui && window.__coop, null, { timeout: 60000 });
    await A.evaluate(() => { window.__ui.act('ok'); window.__ui.go('coop'); });
    await A.waitForFunction(() => /Servidor encendido/.test(document.getElementById('coopstat').textContent), null, { timeout: 15000 });
    await A.click('#mkroom'); await A.waitForFunction(() => document.getElementById('lbcode').textContent.length === 4 && !document.getElementById('coopL').hidden, null, { timeout: 20000 });
    const code = await A.textContent('#lbcode'); assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/);
    await A.click('#lbinvite'); await A.waitForFunction(() => /\?sala=/.test(document.getElementById('lbmsg').textContent), null, { timeout: 5000 });
    assert.match(await A.textContent('#lbmsg'), new RegExp(`\\?sala=${code}`), 'el aviso muestra el enlace de la sala');

    // B abre el enlace de invitación (con 200 ms de latencia simulada): entra solo a la sala
    const B = await mk(); await B.goto(base + `&sala=${code}&lag=200`, G);
    await B.waitForFunction(() => window.__coop && window.__coop.net && window.__coop.net.lobby && window.__coop.net.lobby.players.length === 2, null, { timeout: 90000 });
    await A.waitForFunction(() => document.querySelectorAll('#lbplayers li:not(.vacio)').length === 2, null, { timeout: 10000 });
    assert.equal(await B.evaluate(() => document.getElementById('lbcode').textContent), code);
    // C abre un enlace con una sala que no existe: mensaje claro
    const C = await mk(); await C.goto(base + '&sala=ZZZZ', G);
    await C.waitForFunction(() => /no existe/.test(document.getElementById('coopstat').textContent), null, { timeout: 240000 });

    await B.click('#lbready'); await A.waitForFunction(() => window.__coop.net.lobby.players[1] && window.__coop.net.lobby.players[1].ready, null, { timeout: 10000 });
    await A.click('#lbstart');
    for (const pg of [A, B]) await pg.waitForFunction(() => window.__api.session && window.__api.session.net && window.__api.session.net.pid && window.__api.session.net.buf.length > 5, null, { timeout: 40000 });
    const rtt = await B.evaluate(() => new Promise((r) => setTimeout(() => r(window.__api.session.net.rtt), 3500)));
    console.log(`# navegador B con lag=200: rtt medido ${rtt} ms`); assert.ok(rtt >= 150, 'la latencia simulada se nota en el ping (con la máquina cargada puede salir mucho más)');
    assert.equal(await B.evaluate(() => window.__api.session.net.view().players.length), 2);

    // B recarga la página a mitad de partida: vuelve a su mismo jugador
    const pid = await B.evaluate(() => window.__api.session.net.pid); await B.reload(G);
    await B.waitForFunction(() => window.__api.session && window.__api.session.net && window.__api.session.net.pid && window.__api.session.net.buf.length > 3, null, { timeout: 180000 });
    assert.equal(await B.evaluate(() => window.__api.session.net.pid), pid, 'tras recargar sigue siendo el mismo jugador');
    assert.equal([...srv.rooms.values()][0].game.players.length, 2);

    // (se cierran A, B y C para aliviar la máquina antes de la última comprobación)
    const errs = [A, B, C].flatMap((pg) => pg.errs); for (const pg of [A, B, C]) await pg.context().close();
    // servidor inexistente configurado en Opciones: «Sin conexión»
    const D = await mk(); await D.goto(base, G); await D.waitForFunction(() => window.__ui && window.__coop, null, { timeout: 60000 });
    await D.evaluate(() => { window.__ui.act('ok'); window.__ui.go('options'); });
    await D.fill('#srvurl', 'http://127.0.0.1:1'); await D.dispatchEvent('#srvurl', 'change');
    await D.waitForFunction(() => /Sin conexión/.test(document.getElementById('srvstat').textContent), null, { timeout: 20000 });
    assert.deepEqual([...errs, ...D.errs], [], 'sin errores de JS: ' + [...errs, ...D.errs].join(' | '));
  } finally { await b.close(); await srv.close(); }
});
