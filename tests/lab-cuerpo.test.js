import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, browserAvailable } from '../tools/browser.js';
import { startServer } from '../server/server.js';
import { codificar, costeRender, TOPES_RENDER } from '../src/shared/host-build.js';
import { ejemplos } from '../tools/lab-medir.mjs';

// EH-03 y EH-04: el cuerpo del Híbrido Genómico (huesped-cuerpo.js, diseño `laboratorio`) con 3 diseños (mínimo, medio, PEOR CASO permitido) cabe en el presupuesto de Baja
// (≤ 45 llamadas y ≤ 20 000 triángulos, medido con renderer.info sobre una escena que sólo tiene a ese cuerpo), con y sin evolución, sin errores de consola;
// el estimado del editor (costeRender) coincide con lo medido (triángulos ±10 %), reconstruir cuesta poco, y las proporciones NO reconstruyen.
const hasChromium = browserAvailable();
let srv, browser, base, EJ;
test.before(async () => { if (!hasChromium) return; EJ = await ejemplos(); srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

async function abrir(q, build, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } }), pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push('pageerror: ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /armor|Laboratorio|Hu[eé]sped/i.test(m.text()))) errores.push(m.text().slice(0, 200)); });
  await pg.goto(`${base}/huesped-arte.html?frozen=1&w=400&h=400&q=${q}&char=laboratorio&lab=${encodeURIComponent(codificar(build))}${extra}&t=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 }); return { ctx, pg, errores };
}
const medirInfo = (pg) => pg.evaluate(() => { const gl = window.__gl, sc = window.__scene; sc.children.forEach((o) => { if (o.type === 'Mesh' && !o.isSkinnedMesh && o.geometry && (o.geometry.type === 'CircleGeometry' || o.geometry.type === 'RingGeometry')) o.visible = false; });
  let w = { calls: 0, triangles: 0 }; for (let i = 0; i < 20; i++) { window.__advance(0.1); gl.info.reset(); gl.render(sc, window.__cam); w = { calls: Math.max(w.calls, gl.info.render.calls), triangles: Math.max(w.triangles, gl.info.render.triangles) }; } const s = window.__body.stats(), cu = s.meshes.find((x) => x[0] === 'kit-cuerpo'); return { ...w, piezasTris: s.tris - (cu ? cu[1] : 0), kitCalls: s.meshes.length }; });

for (const [nombre, evo, pth] of [['sin evolución', 0, ''], ['evolución 4 (coraza,resonancia,simbiosis,apoteosis)', 4, 'coraza,resonancia,simbiosis,apoteosis'], ['evolución 4 (depredador,velocidad,artilleria,anomalia)', 4, 'depredador,velocidad,artilleria,anomalia']]) {
  test(`3 diseños (mínimo, medio, peor caso) ${nombre}: ≤ 45 llamadas y ≤ 20 000 triángulos en Baja, sin errores`, { skip: !hasChromium, timeout: 900000 }, async () => {
    const res = {};
    for (const k of ['minimo', 'medio', 'peor']) {
      const { ctx, pg, errores } = await abrir('low', EJ[k], `&evo=${evo}&pth=${pth}`), r = await medirInfo(pg); res[k] = r; await ctx.close();
      assert.deepEqual(errores, [], `${k}: consola`); assert.ok(r.calls <= 45 && r.triangles <= 20000, `${k}: ${r.calls} llamadas / ${r.triangles} triángulos`); assert.ok(r.calls > 1 && r.triangles > 3000, `${k}: no dibujó el cuerpo`);
    }
    console.log(`Laboratorio ${nombre} (renderer.info, Baja):`, JSON.stringify(res));
    assert.ok(res.peor.triangles > res.medio.triangles && res.medio.triangles >= res.minimo.triangles);
  });
}
test('estimado del editor vs medido: triángulos ±10 % y llamadas coherentes (peor caso, medio)', { skip: !hasChromium, timeout: 600000 }, async () => {
  for (const k of ['medio', 'peor']) {
    const est = costeRender(EJ[k], 'low'), { ctx, pg } = await abrir('low', EJ[k]), r = await medirInfo(pg); await ctx.close();
    const dif = Math.abs(est.tris - r.piezasTris) / est.tris; console.log(`${k}: estimado ${est.tris} tri / ${est.llamadas} llamadas · medido ${r.piezasTris} tri / ${r.kitCalls - 1} llamadas de piezas (+${est.halos} halo)`);
    assert.ok(dif <= 0.10, `${k}: estimado ${est.tris} vs medido ${r.piezasTris} (${(dif * 100).toFixed(1)} %)`);
    assert.ok(r.kitCalls - 1 + est.halos <= est.llamadas + 1e-9 && est.llamadas - (r.kitCalls - 1 + est.halos) <= est.cadenas, `${k}: llamadas estimadas ${est.llamadas} vs reales ${r.kitCalls - 1 + est.halos}`);   // la tabla cuenta +1 por cadena aunque la cadena no suma otra malla
    assert.ok(est.tris <= TOPES_RENDER.tris);
  }
});
test('peor caso en Media y Alta: sin errores y las piezas no pasan de la tabla del catálogo (el tope de 20 000 triángulos es de Baja)', { skip: !hasChromium, timeout: 600000 }, async () => {
  for (const q of ['medium', 'high']) { const est = costeRender(EJ.peor, q), { ctx, pg, errores } = await abrir(q, EJ.peor), r = await medirInfo(pg); await ctx.close(); assert.deepEqual(errores, []); console.log(`peor caso ${q}:`, JSON.stringify(r), 'tabla', est.tris);
    assert.ok(r.piezasTris <= est.tris * 1.15, `${q}: piezas ${r.piezasTris} vs tabla ${est.tris}`); assert.ok(r.calls <= 45, `${q}: ${r.calls} llamadas`); }
});
test('reconstruir (assemble) del peor caso tarda poco y las proporciones NO reconstruyen', { skip: !hasChromium, timeout: 600000 }, async () => {
  const { ctx, pg } = await abrir('low', EJ.peor);
  const r = await pg.evaluate(() => { const b = window.__body, base = window.__lab, t = [];
    for (let i = 0; i < 6; i++) { const nb = { ...base, pal: { ...base.pal, primario: '#' + (0x7a3a1c + i * 0x101).toString(16).padStart(6, '0') } }; b.setLab(nb); const t0 = performance.now(); window.__advance(0.034, 0.034); t.push(performance.now() - t0); }
    b.setLab(base); window.__advance(0.034, 0.034); const k0 = b.kit; for (let i = 0; i < 30; i++) { b.setLab({ ...base, prop: { ...base.prop, piernas: 1 + (i % 10) * 0.01, cabeza: 1 + (i % 7) * 0.02 } }); window.__advance(0.034, 0.034); } const mismo = b.kit === k0;
    return { ms: t.sort((x, y) => x - y)[3], mismo }; });
  await ctx.close(); console.log('assemble del peor caso (Baja, Chromium con WebGL por software):', r.ms.toFixed(0), 'ms (mediana)');
  assert.equal(r.mismo, true, 'cambiar proporciones no reconstruye el kit'); assert.ok(r.ms < 1500, `reconstruir tardó ${r.ms} ms`);
});
