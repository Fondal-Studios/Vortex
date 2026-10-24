import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { MAPS, MAP_IDS } from '../src/sim/maps.js';
import { layoutArena, centroOrgano } from '../src/sim/arenas-vivas.js';

// Presupuesto de render de las ARENAS VIVAS en Baja (renderer.info): lo que agregan los órganos y los avisos (= escena con ellos
// menos escena sin ellos, mismo cuadro y misma cámara) y que no haya errores de consola. Para ver las imágenes: node tools/shot-arenas.js todas
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const PRESUPUESTO = { calls: 16, tris: 6000 };   // por arena, en el peor cuadro (todos los órganos a la vista + 3 avisos de ataque)

let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('presupuesto de render por arena (Baja): órganos y avisos ≤ 16 llamadas y ≤ 6 000 triángulos agregados', { skip: !hasChromium, timeout: 1200000 }, async () => {
  const errores = [], filas = [];
  for (const mapId of MAP_IDS) {
    const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
    pg.on('pageerror', (e) => errores.push(`[${mapId}] ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error') errores.push(`[${mapId}] ${m.text().slice(0, 200)}`); });
    await pg.goto(`${base}/?auto=${mapId}&bot=1&god=1&wave=2&seed=3&q=low&autoq=0&nolock=1&skipintro=1`);
    await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 90000 });
    await pg.waitForTimeout(3000);
    await pg.evaluate(() => {
      const s = window.__api.session, g = s.game, r = window.__api.renderer;
      s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
      g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true;
      g.wave = 5; g.phase = 'wave'; const A = g.ar; A.wave = 5; A.t0 = g.time - 60; A.sed = false; A.tl = [];
      const orig = r.updateCamera.bind(r); r.updateCamera = (me, dt, look) => { orig(me, dt, look); const c = window.__shotCam; if (c) { r.camera.position.set(c.x, c.y, c.z); r.camera.rotation.order = 'YXZ'; r.camera.rotation.set(c.pitch, -c.yaw, 0); r.eye = r.camera.position.clone(); } };
    });
    const L = layoutArena(MAPS[mapId]), puntos = L.org.map((o) => centroOrgano(o)), cen = puntos.reduce((a, c) => ({ x: a.x + c.x / puntos.length, y: a.y + c.y / puntos.length, z: a.z + c.z / puntos.length }), { x: 0, y: 0, z: 0 });
    // cámara: 30 m del centro de los órganos mirando hacia ellos (en m2 el «arriba» es hacia el centro de la esfera)
    const up = L.org[0].u, from = { x: cen.x + up.x * 6 + 30, y: cen.y + up.y * 6 + (up.y > 0.9 ? 8 : 0), z: cen.z + up.z * 6 };
    const dx = cen.x - from.x, dy = cen.y - from.y, dz = cen.z - from.z, yaw = Math.atan2(dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    await pg.evaluate(([from, yaw, pitch]) => { const p = window.__api.session.game.players[0]; p.pos = { ...from }; p.vel = { x: 0, y: 0, z: 0 }; window.__shotCam = { ...from, yaw, pitch }; }, [from, yaw, pitch]);
    await pg.evaluate(() => { const g = window.__api.session.game; for (const S of g.ar.org) { S.cd = 0.05; S.roto = false; } });
    let peor = { calls: 0, tris: 0, avisos: 0 };
    for (let k = 0; k < 8; k++) {
      await pg.waitForTimeout(700);
      const m = await pg.evaluate(() => new Promise((res) => {
        const r = window.__api.renderer, hidden = [];
        for (const c of r.scene.children) if (!c.isLight && !c.isCamera && c.visible) { c.visible = false; hidden.push(c); }
        for (const c of r.camera.children) if (c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
        const medir = (cb) => { const t0 = r.t, iv = setInterval(() => { if (r.t - t0 > 0.12) { clearInterval(iv); const i = r.gl.info; cb({ calls: i.render.calls, tris: i.render.triangles }); } }, 25); };
        const upd = r.avfx.update; r.avfx.update = () => {};   // sin: nada de las arenas vivas (su update vuelve a encender la raíz cada cuadro, por eso se anula)
        medir((sin) => { r.avfx.update = upd; r.avfx.root.visible = true; medir((con) => { hidden.forEach((h) => { h.visible = true; }); res({ sin, con, avisos: window.__api.session.game.ar.tl.length, visibles: r.avfx.root.children.filter((c) => c.visible).length }); }); });
      }));
      peor = { calls: Math.max(peor.calls, m.con.calls - m.sin.calls), tris: Math.max(peor.tris, m.con.tris - m.sin.tris), avisos: Math.max(peor.avisos, m.avisos), visibles: m.visibles };
    }
    filas.push({ mapId, ...peor }); await pg.close();
  }
  console.log('presupuesto de las arenas vivas (renderer.info, Baja):', JSON.stringify(filas));
  assert.deepEqual(errores, [], 'sin errores de consola');
  for (const f of filas) { assert.ok(f.calls <= PRESUPUESTO.calls, `${f.mapId}: ${f.calls} llamadas`); assert.ok(f.tris <= PRESUPUESTO.tris, `${f.mapId}: ${f.tris} triángulos`); }
});
