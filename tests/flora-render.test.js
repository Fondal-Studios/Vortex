import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Presupuesto de render de la FLORA en Baja (renderer.info): lo que agrega la flora (= escena sólo con su raíz menos escena vacía, mismo cuadro y misma cámara), en el
// peor caso (las 2 nubes de esporas visibles) y sin errores de consola. Para ver las imágenes: node tools/shot-flora.mjs todas
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const PRESUPUESTO = { calls: 8, tris: 4000 };   // por arena
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('presupuesto de render por arena (Baja): la flora agrega ≤ 8 llamadas y ≤ 4 000 triángulos (con 2 nubes de esporas visibles)', { skip: !hasChromium, timeout: 1200000 }, async () => {
  const errores = [], filas = [];
  for (const mapId of MAP_IDS) {
    const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
    pg.on('pageerror', (e) => errores.push(`[${mapId}] ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errores.push(`[${mapId}] ${m.text().slice(0, 200)}`); });
    await pg.goto(`${base}/?auto=${mapId}&bot=1&god=1&wave=2&seed=3&q=low&autoq=0&nolock=1&skipintro=1`);
    await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 90000 });
    await pg.waitForTimeout(3000);
    const m = await pg.evaluate(() => new Promise((res) => {
      const s = window.__api.session, g = s.game, r = window.__api.renderer, p = g.players[0];
      s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
      g.queue = []; g.phaseT = 1e9; for (const mm of g.monsters) mm.dead = true; g.wave = 3; g.phase = 'wave';
      const t = g.fl.p[0]; for (let k = 0; k < 2; k++) g.fl.nubes.push({ id: 90 + k, tipo: k ? 'sueno' : 'veneno', pos: { x: t.pos.x + k * 2, y: t.pos.y + 0.7, z: t.pos.z }, u: t.u, r: 4.6, t0: g.time, vida: 600, by: 0, S: t.sp });
      for (let i = 0; i < 120; i++) g.step(1 / 60);
      const hidden = [], root = r.flfx && r.flfx.root; if (!root) return res({ error: 'sin flfx' });
      for (const c of r.scene.children) if (c !== root && !c.isLight && !c.isCamera && c.visible) { c.visible = false; hidden.push(c); }
      for (const c of r.camera.children) if (c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
      const parados = []; for (const k of ['avfx', 'luz', 'nfx', 'ffx', 'evfx', 'hostfx', 'comboFx', 'singularfx']) if (r[k] && r[k].update) { parados.push([r[k], r[k].update]); r[k].update = () => {}; }   // lo demás no cambia de un cuadro al siguiente
      const upd = r.flfx.update, medir = () => new Promise((ok) => { const t0 = r.t, iv = setInterval(() => { if (r.t - t0 > 0.12) { clearInterval(iv); const i = r.gl.info; ok({ calls: i.render.calls, tris: i.render.triangles }); } }, 25); });
      (async () => {   // 5 pares (sin / con) y nos quedamos con la MEDIANA del agregado: alguna otra malla puede aparecer un cuadro y ensucia la resta
        const C = [], Tr = [], med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
        for (let k = 0; k < 5; k++) { r.flfx.update = function () { this.root.visible = false; }; const sin = await medir(); r.flfx.update = upd; root.visible = true; const con = await medir(); C.push(con.calls - sin.calls); Tr.push(con.tris - sin.tris); }
        const calls = med(C), tris = med(Tr);
        parados.forEach(([o, u]) => { o.update = u; }); hidden.forEach((h) => { h.visible = true; }); res({ calls, tris, nubes: r.flfx.clouds.visible, plantas: g.fl.p.filter((q) => q.st !== 4).length });
      })();
    }));
    assert.ok(!m.error, m.error); filas.push({ mapId, calls: m.calls, tris: m.tris, nubes: m.nubes, plantas: m.plantas }); await pg.close();
  }
  console.log('presupuesto de la flora (renderer.info, Baja):', JSON.stringify(filas));
  assert.deepEqual(errores, [], 'sin errores de consola');
  for (const f of filas) { assert.ok(f.nubes, `${f.mapId}: las nubes no se dibujaron`); assert.ok(f.calls <= PRESUPUESTO.calls, `${f.mapId}: ${f.calls} llamadas`); assert.ok(f.tris <= PRESUPUESTO.tris, `${f.mapId}: ${f.tris} triángulos`); }
});
