// Rendimiento real en navegador con la horda máxima: FPS, memoria JS y carga de render.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 });
const b = await launch();
const out = [];
for (const [map, pr, q] of [['m1', 1, 'high'], ['m1', 0.6, 'low'], ['m2', 1, 'high'], ['m2', 0.6, 'low']]) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`http://localhost:${srv.port}/?auto=${map}&bot=1&god=1&horde=1&seed=4&pr=${pr}&q=${q}&autoq=0`);
  await pg.waitForTimeout(6000); // calentamiento
  const m0 = await pg.evaluate(() => performance.memory && performance.memory.usedJSHeapSize);
  const g0 = await pg.evaluate(() => window.__api.renderer.gl.info.memory.geometries);
  const samples = []; for (let i = 0; i < 8; i++) { samples.push(await pg.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }))); }
  const info = await pg.evaluate(() => { const i = window.__api.renderer.gl.info; const g = window.__api.session.game; return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures, mons: g.monsters.length, proj: g.projectiles.length }; });
  const m1 = await pg.evaluate(() => performance.memory && performance.memory.usedJSHeapSize);
  const avg = samples.reduce((a, c) => a + c, 0) / samples.length;
  out.push({ map, q, pixelRatio: pr, fps: +avg.toFixed(1), fpsMin: +Math.min(...samples).toFixed(1), ...info, heapMB: m1 ? +(m1 / 1048576).toFixed(1) : null, heapGrowthMB: m1 ? +((m1 - m0) / 1048576).toFixed(1) : null, geomGrowth: info.geoms - g0, errs });
  await pg.close();
}
await b.close(); await srv.close();
console.table(out);
