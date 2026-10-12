// Depuración de arte: oculta cada hijo del mapa y mide cuánto baja el brillo de una región (para hallar qué malla "quema" la imagen).
// Uso: node tools/arte-debug.mjs "auto=m1&bot=1&god=1&wave=4&seed=3" x0 y0 x1 y1 [calidad=low]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [qs, x0, y0, x1, y1, Q = 'low'] = process.argv.slice(2);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto(`http://localhost:${srv.port}/?${qs}&q=${Q}&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(13000);
const lum = async () => { const buf = await pg.screenshot({ type: 'png', clip: { x: +x0, y: +y0, width: x1 - x0, height: y1 - y0 } }); return buf; };
const res = await pg.evaluate(async ([x0, y0, x1, y1]) => {
  const r = window.__api.renderer, out = [];
  const cv = document.createElement('canvas'); const g = cv.getContext('2d', { willReadFrequently: true });
  const read = () => { const s = r.canvas; cv.width = s.width; cv.height = s.height; r.gl.render(r.scene, r.camera); g.drawImage(s, 0, 0); const k = s.width / 1280; const d = g.getImageData(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; return t / (d.length / 4); };
  const base = read(); out.push('base ' + base.toFixed(1));
  [...r.scene.children, ...r.mapRoot.children].forEach((c, i) => { c.visible = false; const v = read(); c.visible = true; const m = c.material || (c.children[0] && c.children[0].material); out.push(`${i} ${c.type} ${c.name || ''} ${m ? (m.type + ' ' + (m.blending === 2 ? 'ADD' : '')) : ''} ${c.geometry ? c.geometry.type : ''} d=${(base - v).toFixed(1)}`); });
  return out;
}, [x0, y0, x1, y1]);
console.log(res.join('\n')); await b.close(); await srv.close();
