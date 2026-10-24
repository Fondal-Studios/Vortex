import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// Cuerpo UNIFICADO de los Huéspedes (src/client/huesped-cuerpo.js + huesped-armor.js): los cinco se arman sin errores, en todos los niveles y caminos, y caben en el
// presupuesto de Baja (≤ 45 llamadas de dibujo y ≤ 20 000 triángulos por Huésped, medido con renderer.info sobre una escena que sólo tiene a ese Huésped).
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const HOSTS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'singular', 'danzante'];
const CASES = [['', 0], ['coraza,resonancia,simbiosis,apoteosis', 4], ['depredador,velocidad,artilleria,anomalia', 4]];
// Colmena (invocadora) tiene caminos PROPIOS (src/sim/colmena-data.js): se miden los dos extremos de cada nivel
const COLMENA_CASES = [['', 0], ['criador,nidos,cohabita,reina', 4], ['aguijon,nube,detonador,plaga', 4], ['criador,nube,detonador,plaga', 4], ['aguijon,nidos,cohabita,reina', 4]];
HOSTS.push('colmena');
let srv, browser, base;
test.before(async () => { if (!hasChromium) return; srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

test('los cinco Huéspedes: sin errores y dentro del presupuesto de Baja (todos los niveles y caminos)', { skip: !hasChromium, timeout: 900000 }, async () => {
  const res = {}, errors = [];
  for (const id of HOSTS) for (const [pth, evo] of (id === 'colmena' ? COLMENA_CASES : CASES)) {
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

// METAMORFOSIS de fauna (docs/FAUNA.md): el Huésped con una forma activa REEMPLAZA materiales (huesped-armor.js: uFC/uFK/uFV) y suma como mucho el aura de motas del color de la forma:
// el peor caso (nivel 4 con armadura completa) sigue dentro del mismo presupuesto de Baja. Se miden los 10 estilos de shader (escarcha, grietas, arcos, agua, facetas, fantasmal, burbujas, resplandor, hueso, telaraña).
const FORMAS_VIS = [['axioma', 'hielo'], ['vesper', 'brasa'], ['micelio', 'electrica'], ['umbra', 'marea'], ['seraf', 'cristal'], ['singular', 'vacio'], ['danzante', 'veneno'], ['axioma', 'luz'], ['micelio', 'hueso'], ['umbra', 'eco'], ['seraf', 'ventisca']];
test('Huésped con forma de fauna activa: sin errores de shader y dentro del presupuesto de Baja (11 formas: los 10 estilos + un híbrido)', { skip: !hasChromium, timeout: 900000 }, async () => {
  const res = {}, errors = [];
  for (const [id, forma] of FORMAS_VIS) {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } }), pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(`${id}/${forma}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Huésped|armor|shader/i.test(m.text()))) errors.push(`${id}/${forma}: ${m.text().slice(0, 300)}`); });
    await pg.goto(`${base}/huesped-arte.html?frozen=1&w=400&h=400&q=low&char=${id}&evo=4&pth=coraza,resonancia,simbiosis,apoteosis&forma=${forma}&t=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    const r = await pg.evaluate(() => { const gl = window.__gl, sc = window.__scene; sc.children.forEach((o) => { if (o.type === 'Mesh' && !o.isSkinnedMesh && o.geometry && o.geometry.type === 'CircleGeometry') o.visible = false; if (o.geometry && o.geometry.type === 'RingGeometry') o.visible = false; });
      let worst = { calls: 0, triangles: 0 }; for (let i = 0; i < 30; i++) { window.__advance(0.1); gl.info.reset(); gl.render(sc, window.__cam); worst = { calls: Math.max(worst.calls, gl.info.render.calls), triangles: Math.max(worst.triangles, gl.info.render.triangles) }; }
      const bad = []; for (const p of gl.info.programs || []) if (p.diagnostics && p.diagnostics.runnable === false) bad.push(p.name); return { ...worst, bad }; });
    res[`${id}|${forma}`] = r; await ctx.close();
  }
  console.log('presupuesto con forma de fauna (renderer.info, Baja):', JSON.stringify(res));
  for (const [k, r] of Object.entries(res)) { assert.ok(r.calls <= 45, `${k}: ${r.calls} llamadas de dibujo`); assert.ok(r.triangles <= 20000, `${k}: ${r.triangles} triángulos`); assert.ok(r.calls > 5 && r.triangles > 3000, `${k}: no dibujó nada`); assert.deepEqual(r.bad, [], `${k}: shaders que no compilan`); }
  assert.deepEqual(errors, []);
});
