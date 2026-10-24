import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Presupuesto de render de los EFECTOS DE JEFE (src/client/jefes-fx.js) en Baja, con renderer.info: lo que agregan = escena con ellos menos escena sin ellos
// (mismo cuadro, misma cámara), en el PEOR caso: 16 marcas de telegrafía a la vez (aros, líneas, haces), escudo y núcleo visibles.
// Presupuesto: Baja ≤ 16 llamadas de dibujo y ≤ 6 000 triángulos agregados. También: la barra del jefe con sus fases y su postura, sin errores de consola.
// Para ver las imágenes: node tools/shot-jefes.mjs
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const PRESUPUESTO = { calls: 16, tris: 6000 };

let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('presupuesto de render de los jefes (Baja, 16 marcas): ≤ 16 llamadas y ≤ 6 000 triángulos agregados; barra con fases y postura; sin errores', { skip: !hasChromium, timeout: 1500000 }, async () => {
  const errores = [], filas = [];
  for (const mapId of MAP_IDS) {
    const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
    pg.on('pageerror', (e) => errores.push(`[${mapId}] ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errores.push(`[${mapId}] ${m.text().slice(0, 200)}`); });
    await pg.goto(`${base}/?auto=${mapId}&wave=7&god=1&seed=3&q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 180000 });
    await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game && window.__api.session.game.boss', null, { timeout: 120000 });
    await pg.waitForTimeout(1500);
    await pg.evaluate(async () => {   // el peor caso: marcas de todos los tipos a la vez, el escudo y el núcleo
      const M = await import('/src/sim/jefe-mec.js'), s = window.__api.session, g = s.game, b = g.boss;
      s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
      for (const m of g.monsters) if (!m.def.boss) m.dead = true; g.queue = []; b.mec.t = 30; b.mec.cd = 999; b.mec.dCd = 999; b.mec.act = null;
      const p = g.players[0], mk = (k, x, z, r, T, c, ex = {}) => b.mec.tg.push({ k, x, y: p.pos.y - 0.8, z, r, t: T, T, c, ...ex });
      for (let i = 0; i < 9; i++) mk('c', p.pos.x + 4 + i * 2.5, p.pos.z + (i % 3) * 4, 4.4, 5, i % 11);
      for (let i = 0; i < 3; i++) mk('l', p.pos.x + 8, p.pos.z + i * 5, 4, 5, 3, { x2: p.pos.x + 30, y2: p.pos.y - 0.8, z2: p.pos.z + i * 5 });
      mk('b', p.pos.x, p.pos.z, 40, 5, 2, { a: 0.5, n: 3, w: 0.5 }); mk('o', b.pos.x, b.pos.z, 10, 5, 4);
      b.mec.refl = 9; b.mec.nu = 9; b.mec.bajo = 9; b.mec.vuln = 1.35; M.mecMov = M.mecMov;
      window.__JB = b;
    });
    await pg.waitForTimeout(1500);
    const calls = [], tris = []; let marcas = 0;
    for (let k = 0; k < 4; k++) {
      await pg.waitForTimeout(400);
      const m = await pg.evaluate(() => new Promise((res) => {
        const r = window.__api.renderer, f = r.jfx, b = window.__JB, medir = (cb) => { const t0 = r.t, iv = setInterval(() => { if (r.t - t0 > 0.12) { clearInterval(iv); const i = r.gl.info; cb({ calls: i.render.calls, tris: i.render.triangles }); } }, 25); };
        for (const k2 of b.mec.tg) k2.t = 5;   // las marcas no vencen durante la medida
        const upd = f.update.bind(f); f.update = () => {};
        f.root.visible = false;
        medir((sin) => { f.root.visible = true; medir((con) => { f.update = upd; res({ sin, con, marcas: f.ring.count + f.disc.count + f.bar.count }); }); });
      }));
      calls.push(m.con.calls - m.sin.calls); tris.push(m.con.tris - m.sin.tris); marcas = Math.max(marcas, m.marcas);
    }
    const hud = await pg.evaluate(() => { const q = (s) => document.querySelector(s); return { fases: q('#jfph') && q('#jfph').textContent, postura: q('#jfpos .tx') && q('#jfpos .tx').textContent, ticks: document.querySelectorAll('#bossbar .jftk').length, nombre: q('#bossname') && q('#bossname').textContent }; });
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    filas.push({ mapId, calls: med(calls), tris: med(tris), cuadros: tris.join('/'), marcas, hud }); await pg.close();
  }
  console.log('presupuesto de los efectos de jefe (renderer.info, Baja):', JSON.stringify(filas));
  assert.deepEqual(errores, [], 'sin errores de consola');
  for (const f of filas) {
    assert.ok(f.marcas >= 8, `${f.mapId}: peor caso real (${f.marcas} instancias)`); assert.ok(f.calls <= PRESUPUESTO.calls, `${f.mapId}: ${f.calls} llamadas`); assert.ok(f.tris <= PRESUPUESTO.tris, `${f.mapId}: ${f.tris} triángulos`);
    assert.match(f.hud.fases || '', /^FASE \d\/4 · /, `${f.mapId}: la barra muestra la fase`); assert.ok(f.hud.postura, `${f.mapId}: la barra muestra la postura`); assert.equal(f.hud.ticks, 3, `${f.mapId}: 3 muescas de fase`); assert.ok(f.hud.nombre && f.hud.nombre !== 'undefined');
  }
});
