// Costo (gl.info) de las armas 0..14 con manos: reposo y disparando, Baja y Alta. Uso: node tools/costo-armas.js > costos.json
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch(); const out = {};
for (const q of ['low', 'high']) {
  const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
  await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&w=0&q=${q}&view=fp`);
  await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
  for (let w = 0; w < 15; w++) {
    const r = await pg.evaluate((w) => { const vm = window.__vm; vm.setWeapon(w); window.__step(60, 0.016, []); const a = window.__stats(); window.__step(40, 0.016, [39]); const f = window.__stats(); return { idle: a, fire: f }; }, w);
    out[`${q}_${w}`] = r;
  }
  await pg.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close(); await srv.close();
