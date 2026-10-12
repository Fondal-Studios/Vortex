// Capturas de la CINEMÁTICA del prólogo «La Estación» (planos clave) y medición de draw calls / triángulos.
//   node tools/shot-prologo.js [carpeta=shots/prologo] [calidad=low|medium|high] [w=1280] [h=720]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const out = process.argv[2] || 'shots/prologo', q = process.argv[3] || 'low', W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720); fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?prologo=1&prologo_manual=1&q=${q}&autoq=0&nolock=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await pg.waitForFunction(() => window.__prologo, null, { timeout: 240000 });
await pg.evaluate(() => window.__prologo.ready);
const TIMES = (process.env.TIMES || '2,5,9,11,14.5,19,21,22.6,23.6,24.4,25.6,26.5,27.8,29,31,33.5,34.9,35.6,37.2').split(',').map(Number);
const info = [];
for (const t of TIMES) {
  const r = await pg.evaluate((t) => { const p = window.__prologo; p.seek(t); p.tick(0); return { ...p.info(), ...p.state() }; }, t);
  const name = `t${String(t).replace('.', '_').padStart(5, '0')}`;
  await pg.screenshot({ path: `${out}/${name}.png` }); info.push({ t, calls: r.calls, triangles: r.triangles, shot: r.shot, sub: r.sub });
  console.log(t, `calls=${r.calls} tris=${r.triangles} plano=${r.shot} free=${r.freeLook}`, '|', r.sub);
}
fs.writeFileSync(`${out}/medidas-${q}.json`, JSON.stringify(info, null, 1));
console.log('errores:', errs.length ? errs.slice(0, 8) : 'ninguno');
await b.close(); await srv.close();
