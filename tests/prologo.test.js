// Prólogo «La Estación»: recorre las 5 escenas en Chromium real con reloj determinista (tick/step manual), comprueba que el
// tren y la caída existen, que el disparo funciona, que no hay errores de consola y que al final se entrega el control al juego.
//   node --test tests/prologo.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const URL_BASE = '?prologo=1&prologo_manual=1&q=low&autoq=0&nolock=1';

async function abrir(srv, extra = URL_BASE) {
  const { launch } = await import('../tools/browser.js');
  const b = await launch(); const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto(`http://localhost:${srv.port}/${extra}`);
  return { b, pg, errs };
}

test('prólogo 3D: las 5 escenas se recorren jugando (bot) y al final se llama onDone', { skip: !hasChromium, timeout: 280000 }, async () => {
  const srv = await startServer({ port: 0 }); const { b, pg, errs } = await abrir(srv);
  try {
    await pg.waitForFunction(() => window.__prologo && window.__api && window.__api.session && window.__api.session.prologo, null, { timeout: 30000 });
    const out = await pg.evaluate(() => {
      const P = window.__prologo, log = [], seen = { fall: new Set(), trainMax: -999, trainSeen: false, warpMax: 0, growMax: 0, scenes: new Set(), objectives: new Set(), hitsMax: 0 };
      const S = () => P.state(), wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const note = () => { const s = S(); seen.scenes.add(s.scene); seen.objectives.add(s.objective); seen.fall.add(s.fall); if (s.trainOn) { seen.trainSeen = true; seen.trainMax = Math.max(seen.trainMax, s.trainX); } seen.warpMax = Math.max(seen.warpMax, s.warp); seen.growMax = Math.max(seen.growMax, s.grow); seen.hitsMax = Math.max(seen.hitsMax, s.hits); };
      const step = (dt = 1 / 30) => { P.step(dt); note(); };
      /** camina hacia la marca (wp) del objetivo actual hasta que cambia la condición `until` */
      const walk = (until, maxS = 90) => { let t = 0; while (t < maxS && !until(S())) { const s = S(); if (s.wp) { const dx = s.wp[0] - s.pos[0], dz = s.wp[1] - s.pos[1], want = Math.atan2(-dx, -dz), err = wrap(want - s.yaw); P.setInput({ dyaw: -Math.max(-0.2, Math.min(0.2, err)), mz: Math.abs(err) < 0.5 ? 1 : 0 }); } else P.setInput({ mz: 0 }); step(); t += 1 / 30; } P.setInput({ mz: 0, mx: 0 }); return t; };
      const until = (fn, maxS = 60) => { let t = 0; while (t < maxS && !fn(S())) { step(); t += 1 / 30; } return t; };
      // ESCENA 1: mirar (el giro del ratón) y caminar hasta el cartel
      log.push(['s1 inicio', S().scene, S().objective]);
      P.setInput({ dyaw: 0.4 }); for (let i = 0; i < 8; i++) { step(); P.setInput({ dyaw: 0.4 }); } P.setInput({ dyaw: 0 });
      log.push(['s1 tras mirar', S().objective]);
      walk((s) => s.scene === 1);
      log.push(['s2 inicio', S().scene, S().objective]);
      // ESCENA 2: tren + caída en cámara
      until((s) => s.fall === 'fall', 20); const trainWhenFall = S().trainOn; step();
      until((s) => s.fall === 'lie', 10);
      log.push(['s2 caída lista', S().fall, S().objective]);
      walk((s) => s.scene === 2, 40);
      // ESCENA 3: ruptura
      log.push(['s3 inicio', S().scene, S().objective]); const camAntes = P.parts.st.U.uWarp.value;
      until((s) => s.scene === 3, 30);
      // ESCENA 4: primer contacto (organismo en la mano + disparo al blanco inmóvil)
      log.push(['s4 inicio', S().scene, S().objective]);
      until((s) => s.weaponReady, 30);
      const bio = P.parts.bio; let shots = 0;
      for (let k = 0; k < 400 && S().hits < 3; k++) {
        const s = S(), t = bio.target.position, dx = t.x - s.pos[0], dy = t.y - 1.6, dz = t.z - s.pos[1];
        P.setPlayer(s.pos[0], s.pos[1], Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        if (k % 20 === 0) { P.fire(); shots++; } else P.releaseFire(); step();
      }
      P.releaseFire(); log.push(['s4 disparos', S().hits, shots, S().objective]);
      until((s) => s.scene === 4, 10);
      // ESCENA 5: mecanismo + umbral
      log.push(['s5 inicio', S().scene, S().objective]);
      walk((s) => /umbral/i.test(s.objective) === false ? false : true, 40); // llega al pedestal ("Activá")... hasta que cambie
      return { log, seen: { ...seen, fall: [...seen.fall], scenes: [...seen.scenes], objectives: [...seen.objectives] }, trainWhenFall, state: S() };
    }).catch((e) => ({ error: String(e) }));
    assert.ok(!out.error, out.error);
    assert.deepEqual(out.seen.scenes.slice(0, 5), [0, 1, 2, 3, 4], 'pasó por las 5 escenas: ' + JSON.stringify(out.log));
    assert.ok(out.seen.trainSeen && out.seen.trainMax > -30, 'el tren existe y avanza por la estación (x máx ' + out.seen.trainMax + ')');
    assert.ok(out.trainWhenFall, 'el tren está en pantalla cuando cae la persona');
    for (const ph of ['sway', 'fall', 'lie']) assert.ok(out.seen.fall.includes(ph), 'caída: falta la fase ' + ph);
    assert.ok(out.seen.warpMax > 0.5 && out.seen.growMax > 0.5, 'la ruptura deforma la geometría y crece el tejido vivo');
    assert.equal(out.seen.hitsMax, 3, 'el blanco inmóvil recibe 3 impactos');
    assert.ok(out.seen.objectives.length >= 8, 'cada escena muestra objetivos distintos: ' + out.seen.objectives.join(' | '));
    // el mecanismo: está en la escena 5; se activa con «usar» y luego se cruza el umbral → onDone
    const fin = await pg.evaluate(() => {
      const P = window.__prologo, wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const S = () => P.state();
      const goto = (stop, maxS = 40) => { let t = 0; while (t < maxS && !stop(S()) && !P.finished) { const s = S(); if (s.wp) { const dx = s.wp[0] - s.pos[0], dz = s.wp[1] - s.pos[1], err = wrap(Math.atan2(-dx, -dz) - s.yaw); P.setInput({ dyaw: -Math.max(-0.2, Math.min(0.2, err)), mz: Math.abs(err) < 0.5 ? 1 : 0 }); } P.step(1 / 30); t += 1 / 30; } P.setInput({ mz: 0 }); };
      goto((s) => Math.hypot(s.pos[0] + 15.5, s.pos[1] - 2.0) < 2.2, 40);
      const antes = S().objective; P.use(); P.step(1 / 30); const despues = S().objective;
      goto((s) => false, 40);
      return { antes, despues, finished: P.finished, stopped: P.stopped, sceneAfter: window.__api.session.prologo === null, intro: window.__api.session.intro, wake: window.__api.renderer.wakeDur };
    });
    assert.match(fin.antes, /mecanismo/i); assert.match(fin.despues, /umbral/i, 'activar el mecanismo cambia el objetivo a atravesar el umbral');
    assert.ok(fin.finished && fin.stopped, 'el prólogo terminó al cruzar el umbral');
    assert.ok(fin.sceneAfter, 'se llamó onDone: el juego tomó el control (session.prologo = null)');
    assert.ok(fin.intro, 'tras el prólogo sigue el despertar (WAKE)'); assert.ok(fin.wake > 0, 'arrancó el despertar en el Vórtice');
    assert.deepEqual(errs, [], 'sin errores de consola: ' + errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});

test('prólogo 3D: presupuesto en calidad Baja (≤120 draw calls, ≤60k triángulos) en cada escena', { skip: !hasChromium, timeout: 200000 }, async () => {
  const srv = await startServer({ port: 0 }); const { b, pg, errs } = await abrir(srv);
  try {
    await pg.waitForFunction(() => window.__prologo, null, { timeout: 30000 });
    const rows = await pg.evaluate(() => { const P = window.__prologo, out = []; for (let i = 0; i < 5; i++) { P.skipTo(i); for (let k = 0; k < 150; k++) P.step(1 / 30); P.tick(0); out.push({ scene: i, ...P.info() }); } return out; });
    for (const r of rows) { assert.ok(r.calls > 0 && r.calls <= 120, `escena ${r.scene}: ${r.calls} draw calls`); assert.ok(r.triangles <= 60000, `escena ${r.scene}: ${r.triangles} triángulos`); }
    console.log('medidas (Baja):', JSON.stringify(rows));
    assert.deepEqual(errs, []);
  } finally { await b.close(); await srv.close(); }
});

test('prólogo 3D: «Saltar prólogo» (botón) entrega el control y ?skipprologo=1 no lo arranca', { skip: !hasChromium, timeout: 120000 }, async () => {
  const srv = await startServer({ port: 0 }); let { b, pg, errs } = await abrir(srv);
  try {
    await pg.waitForFunction(() => window.__prologo && window.__api.session && window.__api.session.prologo, null, { timeout: 30000 });
    assert.match(await pg.textContent('#pg-skip'), /Saltar prólogo/);
    await pg.click('#pg-skip');
    await pg.waitForFunction(() => window.__api.session.prologo === null && window.__prologo.stopped, null, { timeout: 5000 });
    assert.equal(await pg.evaluate(() => window.__api.session.intro), null, 'tras saltar no queda intro activa');
    assert.equal(await pg.evaluate(() => !!document.getElementById('pg-ui')), false, 'la interfaz del prólogo se limpia');
    assert.deepEqual(errs, []);
    await b.close();
    ({ b, pg, errs } = await abrir(srv, '?prologo=1&skipprologo=1&q=low&autoq=0&nolock=1'));
    await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.intro, null, { timeout: 30000 });
    assert.equal(await pg.evaluate(() => !!window.__prologo), false, '?skipprologo=1 no crea el prólogo');
    assert.deepEqual(errs, []);
  } finally { await b.close(); await srv.close(); }
});
