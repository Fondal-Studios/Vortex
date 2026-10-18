import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Cuerpo UNIFICADO de los Huéspedes (src/client/huesped-cuerpo.js + huesped-armor.js): los cinco se arman sin errores, en todos los niveles y caminos, y caben en el
// presupuesto de Baja (≤ 45 llamadas de dibujo y ≤ 20 000 triángulos por Huésped, medido con renderer.info sobre una escena que sólo tiene a ese Huésped).
const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const HOSTS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'singular'];
const CASES = [['', 0], ['coraza,resonancia,simbiosis,apoteosis', 4], ['depredador,velocidad,artilleria,anomalia', 4]];
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('los cinco Huéspedes: sin errores y dentro del presupuesto de Baja (todos los niveles y caminos)', { skip: !hasChromium, timeout: 900000 }, async () => {
  const res = {}, errors = [];
  for (const id of HOSTS) for (const [pth, evo] of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } }), pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(`${id}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Huésped|armor/i.test(m.text()))) errors.push(`${id}: ${m.text()}`); });
    await pg.goto(`${base}/huesped-arte.html?frozen=1&w=400&h=400&q=low&char=${id}&evo=${evo}&pth=${pth}&t=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    const r = await pg.evaluate(() => { const gl = window.__gl, sc = window.__scene; sc.children.forEach((o) => { if (o.type === 'Mesh' && !o.isSkinnedMesh && o.geometry && o.geometry.type === 'CircleGeometry') o.visible = false; if (o.geometry && o.geometry.type === 'RingGeometry') o.visible = false; });
      let worst = { calls: 0, triangles: 0 }; for (let i = 0; i < 20; i++) { window.__advance(0.1); gl.info.reset(); gl.render(sc, window.__cam); worst = { calls: Math.max(worst.calls, gl.info.render.calls), triangles: Math.max(worst.triangles, gl.info.render.triangles) }; } return worst; });
    res[`${id}|${evo}|${pth}`] = r; await ctx.close();
  }
  console.log('presupuesto del cuerpo unificado (renderer.info, Baja):', JSON.stringify(res));
  for (const [k, r] of Object.entries(res)) { assert.ok(r.calls <= 45, `${k}: ${r.calls} llamadas de dibujo`); assert.ok(r.triangles <= 20000, `${k}: ${r.triangles} triángulos`); assert.ok(r.calls > 5 && r.triangles > 3000, `${k}: no dibujó nada`); }
  assert.deepEqual(errors, []);
});
