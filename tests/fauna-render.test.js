import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { MAP_IDS } from '../src/sim/maps.js';

// Presupuesto de render de la FAUNA (src/client/fauna-fx.js) en Baja, con renderer.info: lo que agrega = escena con la fauna menos escena sin ella (mismo cuadro, misma cámara), en el PEOR caso:
// el máximo de bichos (12) vivos y a la vista, los rastros del suelo al tope y chispas en el aire.
// Presupuesto del pedido: ≤ 12 llamadas de dibujo y ≤ 3 000 triángulos (bichos + halos + rastros + chispas).
// Las formas del Huésped (sólo materiales) se miden en tests/huesped-cuerpo.test.js. Para ver las imágenes: node tools/shot-fauna.mjs
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const PRESUPUESTO = { calls: 12, tris: 3000 };

let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('presupuesto de render de la fauna (Baja, 12 bichos + rastros + chispas): ≤ 12 llamadas y ≤ 3 000 triángulos agregados, sin errores de consola', { skip: !hasChromium, timeout: 1500000 }, async () => {
  const errores = [], filas = [];
  for (const mapId of MAP_IDS) {
    const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
    pg.on('pageerror', (e) => errores.push(`[${mapId}] ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errores.push(`[${mapId}] ${m.text().slice(0, 240)}`); });
    await pg.goto(`${base}/?auto=${mapId}&bot=1&god=1&wave=2&seed=3&q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 180000 });
    await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 120000 });
    await pg.waitForTimeout(3000);
    const puesto = await pg.evaluate(async () => {
      const F = await import('/src/sim/fauna.js'), D = await import('/src/sim/fauna-data.js'), s = window.__api.session, g = s.game, p = g.players[0];
      s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
      g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; g.phase = 'intermission'; g.wave = 1;
      g.fa.cd = 1e9; g.fa.list = [];
      const ids = D.especiesDe(g.mapId).concat(D.RARAS), right = { x: p.heading.z * p.up.y - p.heading.y * p.up.z, y: p.heading.x * p.up.z - p.heading.z * p.up.x, z: p.heading.y * p.up.x - p.heading.x * p.up.y };
      for (let i = 0; i < 12; i++) {   // un abanico delante de la cámara, 6-14 m
        const d = 6 + (i % 4) * 2.4, lat = ((i % 6) - 2.5) * 2.2;
        F.faunaSpawn(g, ids[i % ids.length], { x: p.pos.x + p.heading.x * d + right.x * lat, y: p.pos.y + p.heading.y * d + right.y * lat, z: p.pos.z + p.heading.z * d + right.z * lat }, 'dormida');
      }
      for (let i = 0; i < D.FAUNA.zonasMax; i++) { const a = i * 0.8, d = 3 + i * 0.7; g.fa.zonas.push({ k: i % 4, pos: { x: p.pos.x + p.heading.x * d, y: p.pos.y - 0.8 + p.up.y * 0, z: p.pos.z + p.heading.z * d + (i - 4) * 1.5 }, u: { ...p.up }, r: 2.4, life: 1e9, born: g.time, dps: 0, slow: 0, pid: p.id }); void a; }
      return g.fa.list.length;
    });
    await pg.waitForTimeout(2500);
    const calls = [], tris = []; let bichos = 0, halos = 0;
    for (let k = 0; k < 4; k++) {
      await pg.waitForTimeout(400);
      const m = await pg.evaluate(() => new Promise((res) => {
        const r = window.__api.renderer, f = r.ffx, medir = (cb) => { const t0 = r.t, iv = setInterval(() => { if (r.t - t0 > 0.12) { clearInterval(iv); const i = r.gl.info; cb({ calls: i.render.calls, tris: i.render.triangles }); } }, 25); };
        const upd = f.update.bind(f); f.soltar([0, 0, 0], [0, 1, 0], ['#ffffff'], 60); f.update = () => {};   // congelado: el contenido del cuadro no cambia entre las dos medidas
        f.root.visible = false;
        medir((sin) => { f.root.visible = true; medir((con) => { f.update = upd; res({ sin, con, bichos: f.mesh.count, halos: f.halo.geometry.instanceCount, zonas: f.zonas.count }); }); });
      }));
      calls.push(m.con.calls - m.sin.calls); tris.push(m.con.tris - m.sin.tris); bichos = Math.max(bichos, m.bichos); halos = Math.max(halos, m.halos);
    }
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    filas.push({ mapId, creados: puesto, calls: med(calls), tris: med(tris), cuadros: tris.join('/'), bichosVisibles: bichos, halos }); await pg.close();
  }
  console.log('presupuesto de la fauna (renderer.info, Baja):', JSON.stringify(filas));
  assert.deepEqual(errores, [], 'sin errores de consola');
  for (const f of filas) { assert.ok(f.creados >= 9, `${f.mapId}: peor caso real (${f.creados} bichos)`); assert.ok(f.bichosVisibles >= 6, `${f.mapId}: se dibujan (${f.bichosVisibles})`); assert.ok(f.calls <= PRESUPUESTO.calls, `${f.mapId}: ${f.calls} llamadas`); assert.ok(f.tris <= PRESUPUESTO.tris, `${f.mapId}: ${f.tris} triángulos`); }
});
