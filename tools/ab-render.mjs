// Medición A/B del costo del post-proceso y del Huésped humano en la MISMA máquina y momento (alternando configuraciones,
// para que la carga de la máquina afecte a todas por igual). Uso: node tools/ab-render.mjs [mapa=m1] [calidades=low,high] [rondas=2]
// A = render directo + Huésped de bloques (como antes) · B = post-proceso nuevo + bloques · C = post-proceso + Huésped humano (actual)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const MAP = process.argv[2] || 'm1', QS = (process.argv[3] || 'low,high').split(','), N = +(process.argv[4] || 2);
const CFG = { A: 'post=0&cuerpo=bloques', B: 'cuerpo=bloques', C: '' };
const srv = await startServer({ port: 0 }); const b = await launch(); const res = {};
for (const q of QS) for (let r = 0; r < N; r++) for (const [k, extra] of Object.entries(CFG)) {
  const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await pg.goto(`http://localhost:${srv.port}/?auto=${MAP}&god=1&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1&cam=third&${extra}`, { timeout: 180000 });
  await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 180000 });
  if (k === 'C') await pg.waitForFunction(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; return e && e.body && e.body.human && e.body.parts > 0; }, null, { timeout: 240000, polling: 1000 }).catch(() => {});
  await pg.waitForTimeout(6000);
  const m = await pg.evaluate(() => new Promise((res) => { const R = window.__api.renderer, ts = []; const f = (t) => { ts.push(t); if (ts.length < 21) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, c) => a - c), i = R.gl.info.render; res({ ms: d[d.length >> 1], calls: i.calls, tris: i.triangles }); } }; requestAnimationFrame(f); }));
  (res[`${q}-${k}`] = res[`${q}-${k}`] || []).push(m); console.log(q, k, r, JSON.stringify(m));
  await pg.context().close();
}
for (const [k, v] of Object.entries(res)) { const ms = v.map((x) => x.ms).sort((a, c) => a - c); console.log(k, 'ms mediana', ms[ms.length >> 1].toFixed(0), 'llamadas', v[0].calls, 'tris', v[0].tris); }
await b.close(); await srv.close();
