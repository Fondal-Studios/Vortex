// Resuelve la composición en pantalla de cada arma: coloca la boca en (tx,ty) NDC con escala/giro dados, ajustando pos.x/pos.y.
// Uso: node tools/compose-armas.js [ids] > /tmp/views.json   (lee tools/compose-spec.json: { id: {s, zs, yaw, pitch, z, tx, ty} })
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const spec = JSON.parse(fs.readFileSync(new URL('./compose-spec.json', import.meta.url)));
const ids = (process.argv[2] || Object.keys(spec).join(',')).split(',').map(Number);
const srv = await startServer({ port: 0 }); const b = await launch(); const out = {};
for (const w of ids) {
  const sp = spec[w], pg = await b.newPage({ viewport: { width: 1000, height: 480 } });
  await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&w=${w}&q=low&view=fp&fov=${sp.fov || 80}`);
  await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
  await pg.evaluate(() => window.__step(40, 0.016, []));
  let px = 0.3, py = -0.25;
  const meas = async (x, y) => pg.evaluate(([s, zs, yaw, pitch, z, x, y]) => { window.__view({ pos: [x, y, z], scale: s, zs, rot: [pitch, yaw, -0.03] }); window.__step(2, 0.016, []); return window.__measure(); }, [sp.s, sp.zs, sp.yaw, sp.pitch ?? -0.03, sp.z ?? -0.6, x, y]);
  let m;
  for (let i = 0; i < 8; i++) {
    m = await meas(px, py); const ex = sp.tx - m.muzzle[0], ey = sp.ty - m.muzzle[1];
    if (Math.abs(ex) < 0.004 && Math.abs(ey) < 0.004) break;
    const h = 0.02, mx = await meas(px + h, py), my = await meas(px, py + h);
    const a = (mx.muzzle[0] - m.muzzle[0]) / h, c = (my.muzzle[1] - m.muzzle[1]) / h, bb = (mx.muzzle[1] - m.muzzle[1]) / h, d = (my.muzzle[0] - m.muzzle[0]) / h;
    const det = a * c - bb * d; px += (ex * c - ey * d) / det; py += (ey * a - ex * bb) / det;
  }
  m = await meas(px, py);
  out[w] = { pos: [+px.toFixed(3), +py.toFixed(3), sp.z ?? -0.6], scale: sp.s, zs: sp.zs, rot: [sp.pitch ?? -0.03, sp.yaw, -0.03], muzzle: m.muzzle.map((v) => +v.toFixed(2)), box: Object.fromEntries(Object.entries(m.box).map(([k, v]) => [k, +v.toFixed(2)])) };
  console.error(w, JSON.stringify(out[w]));
  await pg.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close(); await srv.close();
