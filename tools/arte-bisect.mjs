// Busca por bisección qué malla produce el brillo de una región de pantalla. node tools/arte-bisect.mjs "<query>" x0 y0 x1 y1 [calidad]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [qs, x0, y0, x1, y1, Q = 'low'] = process.argv.slice(2);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await pg.goto(`http://localhost:${srv.port}/?${qs}&q=${Q}&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(6000); if (process.env.POSE) await pg.evaluate(process.env.POSE); await pg.waitForTimeout(800);
const res = await pg.evaluate(([x0, y0, x1, y1]) => {
  const r = window.__api.renderer, out = [];
  const cv = document.createElement('canvas'); const g = cv.getContext('2d', { willReadFrequently: true });
  const read = () => { const s = r.canvas; cv.width = s.width; cv.height = s.height; r.gl.render(r.scene, r.camera); g.drawImage(s, 0, 0); const k = s.width / 1280; if (x1 > 1) { const d = g.getImageData(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; return t / (d.length / 4); } const d = g.getImageData(0, 0, s.width, s.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) t++; return t * 100 / (d.length / 4); };
  let leaves = []; r.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible) leaves.push(o); });
  const base = read(); out.push('hojas ' + leaves.length + ' base ' + base.toFixed(1));
  const hide = (a, v) => a.forEach((o) => { o.visible = v; });
  for (let step = 0; step < 14 && leaves.length > 1; step++) {
    const h = leaves.slice(0, leaves.length >> 1), rest = leaves.slice(leaves.length >> 1);
    hide(h, false); const v = read(); hide(h, true);
    leaves = (base - v > base * 0.3) ? h : rest;
  }
  for (const o of leaves) { let p = o, path = []; while (p) { path.push(p.type + (p.name ? ':' + p.name : '')); p = p.parent; } const m = o.material; out.push(path.join('<') + ' ' + (o.geometry ? o.geometry.type + JSON.stringify(o.geometry.parameters || {}).slice(0, 90) : '') + ' ' + m.type + ' c=' + (m.color ? m.color.getHexString() : '') + ' op=' + m.opacity + ' pos=' + o.position.toArray().map((v) => v.toFixed(1)) + ' wscale=' + o.getWorldScale(o.position.clone()).toArray().map((v) => v.toFixed(1))); }
  return out;
}, [x0, y0, x1, y1]);
console.log(res.join('\n')); await b.close(); await srv.close();
