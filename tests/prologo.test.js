// Prólogo «La Estación» = CINEMÁTICA 3D realista. Se recorre entera en Chromium real con reloj determinista (step/tick manual):
// sin errores de consola, el tren y la caída existen, la cámara es LIBRE sólo en la ventana del atropello, al final se llama onDone
// (→ despertar psicodélico), y «Saltar» funciona.   node --test tests/prologo.test.js
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
  await pg.goto(`http://localhost:${srv.port}/${extra}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return { b, pg, errs };
}

test('prólogo cinematográfico: se recorre entero, la cámara es libre sólo en la ventana del atropello y al final llama onDone', { skip: !hasChromium, timeout: 280000 }, async () => {
  const srv = await startServer({ port: 0 }); const { b, pg, errs } = await abrir(srv);
  try {
    await pg.waitForFunction(() => window.__prologo && window.__api && window.__api.session && window.__api.session.prologo, null, { timeout: 120000 });
    await pg.evaluate(() => window.__prologo.ready);
    const out = await pg.evaluate(() => {
      const P = window.__prologo, S = () => P.state(), seen = { shots: new Set(), freeFlags: [], trainSeen: false, trainMax: -999, vClips: new Set(), pClips: new Set(), looksOutside: 0, looksInside: 0, objectiveUI: false, humans: 0, subs: new Set() };
      const BEATS = { FREE0: 28.3, IMPACT: 35.0 };
      let camQ0 = null;
      // sin ventana: intentar mirar no hace nada (T < 28.3)
      P.seek(10); P.setInput({ dyaw: 0.8, dpitch: 0.4 }); P.step(1 / 30); seen.looksOutside = Math.abs(S().look.yaw) + Math.abs(S().look.pitch);
      let guard = 0;
      while (!S().finished && guard++ < 3000) {
        const s = S();
        if (s.freeLook && s.T > BEATS.FREE0 + 1 && s.T < BEATS.FREE0 + 1.2) P.setInput({ dyaw: 0.9, dpitch: -0.2 });
        P.step(1 / 30); const n = S();
        seen.shots.add(n.shot); seen.freeFlags.push([n.T, n.freeLook]); if (n.trainOn) { seen.trainSeen = true; seen.trainMax = Math.max(seen.trainMax, n.trainX); }
        seen.vClips.add(n.vClip); seen.pClips.add(n.pClip); seen.humans = n.humans; if (n.sub) seen.subs.add(n.sub.replace(/\.+$/, ''));
        if (n.freeLook && Math.abs(n.look.yaw) > 0.3) seen.looksInside++;
        if (document.getElementById('pg-obj') || document.getElementById('hud') && !document.getElementById('hud').classList.contains('hidden')) seen.objectiveUI = true;
      }
      const freeT = seen.freeFlags.filter(([, f]) => f).map(([t]) => t);
      return { seen: { ...seen, shots: [...seen.shots], vClips: [...seen.vClips], pClips: [...seen.pClips], subs: [...seen.subs], freeFlags: undefined }, freeMin: Math.min(...freeT), freeMax: Math.max(...freeT), final: S(), session: { prologo: window.__api.session.prologo, intro: window.__api.session.intro, wake: window.__api.renderer.wakeDur }, lastTrainX: seen.trainMax };
    });
    assert.deepEqual(out.seen.shots.sort((a, c) => a - c), [1, 2, 3, 4, 5, 6, 7, 8], 'los 8 planos del director');
    assert.equal(out.seen.looksOutside, 0, 'fuera de la ventana el jugador NO puede mover la cámara');
    assert.ok(out.seen.looksInside > 20, 'dentro de la ventana de atropello la cámara sí responde');
    assert.ok(out.freeMin >= 28.3 - 0.05 && out.freeMax <= 35.0 + 0.05, `ventana libre = [28,3 s, 35 s]: fue [${out.freeMin.toFixed(2)}, ${out.freeMax.toFixed(2)}]`);
    assert.ok(out.seen.trainSeen && out.seen.trainMax > -3, 'el tren entra en la estación y llega al protagonista (x máx ' + out.seen.trainMax.toFixed(1) + ')');
    for (const c of ['hit', 'death']) assert.ok(out.seen.vClips.includes(c), 'la persona cae a las vías: falta el clip ' + c);
    for (const c of ['jog', 'jump']) assert.ok(out.seen.pClips.includes(c), 'el protagonista corre y salta a la vía: falta ' + c);
    assert.equal(out.seen.humans, 5, 'personas con rig de ARCANUM');
    assert.equal(out.seen.objectiveUI, false, 'sin objetivos ni HUD de juego');
    assert.ok(out.seen.subs.size >= 7, 'subtítulos: ' + [...out.seen.subs].join(' | '));
    assert.ok(out.final.finished && out.final.T >= 38.3, 'la cinemática termina (blanco → negro)');
    assert.equal(out.session.prologo, null, 'se llamó onDone: el juego tomó el control');
    assert.ok(out.session.intro && out.session.wake > 0, 'tras morir sigue el despertar en el Vórtice (WAKE)');
    assert.deepEqual(errs, [], 'sin errores de consola: ' + errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});

test('prólogo cinematográfico: presupuesto en calidad Baja (≤150 draw calls, ≤80k triángulos) en todos los planos', { skip: !hasChromium, timeout: 250000 }, async () => {
  const srv = await startServer({ port: 0 }); const { b, pg, errs } = await abrir(srv);
  try {
    await pg.waitForFunction(() => window.__prologo, null, { timeout: 120000 }); await pg.evaluate(() => window.__prologo.ready);
    const rows = await pg.evaluate(() => { const P = window.__prologo, out = []; for (const t of [1, 4, 9, 14, 19, 22.8, 24.2, 26.5, 31, 34.7]) { P.seek(t); P.tick(0); out.push({ t, ...P.info() }); } return out; });
    for (const r of rows) { assert.ok(r.calls > 0 && r.calls <= 150, `t=${r.t}: ${r.calls} draw calls`); assert.ok(r.triangles <= 80000, `t=${r.t}: ${r.triangles} triángulos`); }
    console.log('medidas (Baja):', JSON.stringify(rows.map((r) => [r.t, r.calls, r.triangles])));
    assert.deepEqual(errs, []);
  } finally { await b.close(); await srv.close(); }
});

test('prólogo cinematográfico: «Saltar» entrega el control y ?skipprologo=1 no lo arranca', { skip: !hasChromium, timeout: 200000 }, async () => {
  const srv = await startServer({ port: 0 }); let { b, pg, errs } = await abrir(srv);
  try {
    await pg.waitForFunction(() => window.__prologo && window.__api.session && window.__api.session.prologo, null, { timeout: 120000 });
    assert.match(await pg.textContent('#pg-skip'), /Saltar/);
    assert.equal(await pg.evaluate(() => !!document.getElementById('pg-obj')), false, 'no hay panel de objetivos');
    await pg.click('#pg-skip');
    await pg.waitForFunction(() => window.__api.session.prologo === null && !window.__prologo, null, { timeout: 10000 });
    assert.equal(await pg.evaluate(() => window.__api.session.intro), null, 'tras saltar no queda intro activa');
    assert.equal(await pg.evaluate(() => !!document.getElementById('pg-ui')), false, 'la interfaz del prólogo se limpia');
    assert.deepEqual(errs, []);
    await b.close();
    ({ b, pg, errs } = await abrir(srv, '?prologo=1&skipprologo=1&q=low&autoq=0&nolock=1'));
    await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.intro, null, { timeout: 120000 });
    assert.equal(await pg.evaluate(() => !!window.__prologo), false, '?skipprologo=1 no crea el prólogo');
    assert.deepEqual(errs, []);
  } finally { await b.close(); await srv.close(); }
});
