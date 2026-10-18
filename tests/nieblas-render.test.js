import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Presupuesto de render de las NIEBLAS DE COLORES (src/client/nieblas-fx.js) y de la LUZ DE LAS ARENAS (luz-arenas.js) en Baja, con renderer.info:
// lo que agregan = escena con ellas menos escena sin ellas (mismo cuadro, misma cámara), en el PEOR caso: el máximo de zonas (9) activas a la vez, todas a la vista.
// Presupuesto propio de las nieblas: ≤ 6 llamadas de dibujo y ≤ 3 000 triángulos (1 de nubes + aro + disco + ecos; el de las arenas vivas es ≤ 16 / ≤ 6 000 aparte).
// Para ver las imágenes: node tools/shot-nieblas.mjs
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const PRESUPUESTO = { calls: 6, tris: 3000 };

let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('presupuesto de render de las nieblas (Baja, 9 zonas activas): ≤ 6 llamadas y ≤ 3 000 triángulos agregados, sin errores de consola', { skip: !hasChromium, timeout: 1500000 }, async () => {
  const errores = [], filas = [];
  for (const mapId of MAP_IDS) {
    const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
    pg.on('pageerror', (e) => errores.push(`[${mapId}] ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errores.push(`[${mapId}] ${m.text().slice(0, 200)}`); });
    await pg.goto(`${base}/?auto=${mapId}&bot=1&god=1&wave=2&seed=3&q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 180000 });
    await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 120000 });
    await pg.waitForTimeout(3000);
    await pg.evaluate(async () => {
      const N = await import('/src/sim/nieblas.js'), s = window.__api.session, g = s.game, p = g.players[0];
      s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
      g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; g.wave = 5; g.phase = 'wave'; if (g.ar) { g.ar.wave = 5; g.ar.t0 = g.time - 60; }
      const ti = Object.keys(N.NIEBLAS);
      for (let i = 0; g.ng.zonas.length < N.NIEBLA.maxZonas; i++) {   // hasta el tope, repartidas alrededor del jugador y a la vista
        const a = i * 0.7, d = 4 + (i % 3) * 3.5;
        N.nieblaTemporal(g, ti[i % ti.length], { x: p.pos.x + Math.cos(a) * d, y: p.pos.y + p.up.y * 1.2, z: p.pos.z + Math.sin(a) * d }, 8 + (i % 3), 600);
      }
      window.__NG = N;
    });
    await pg.waitForTimeout(5000);   // todas pasan a «activa»
    let peor = { calls: 0, tris: 0 }, nube = 0, zonas = 0;
    for (let k = 0; k < 4; k++) {
      await pg.waitForTimeout(500);
      const m = await pg.evaluate(() => new Promise((res) => {
        const r = window.__api.renderer, f = r.nfx, medir = (cb) => { const t0 = r.t, iv = setInterval(() => { if (r.t - t0 > 0.12) { clearInterval(iv); const i = r.gl.info; cb({ calls: i.render.calls, tris: i.render.triangles }); } }, 25); };
        const upd = f.update.bind(f); f.update = () => {};   // congelado: el contenido del cuadro no cambia entre las dos medidas
        f.root.visible = false;
        medir((sin) => { f.root.visible = true; medir((con) => { f.update = upd; res({ sin, con, nube: f.cloud.geometry.instanceCount, zonas: window.__api.session.game.ng.zonas.length }); }); });
      }));
      peor = { calls: Math.max(peor.calls, m.con.calls - m.sin.calls), tris: Math.max(peor.tris, m.con.tris - m.sin.tris) }; nube = Math.max(nube, m.nube); zonas = m.zonas;
    }
    filas.push({ mapId, ...peor, instanciasDeNube: nube, zonas }); await pg.close();
  }
  console.log('presupuesto de las nieblas (renderer.info, Baja):', JSON.stringify(filas));
  assert.deepEqual(errores, [], 'sin errores de consola');
  for (const f of filas) { assert.ok(f.zonas >= 9, `${f.mapId}: peor caso real (9 zonas)`); assert.ok(f.calls <= PRESUPUESTO.calls, `${f.mapId}: ${f.calls} llamadas`); assert.ok(f.tris <= PRESUPUESTO.tris, `${f.mapId}: ${f.tris} triángulos`); }
});
