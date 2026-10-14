// Capturas + medición del salto visual (render, mundo que evoluciona, criaturas): mapas 1–4 en las oleadas 1 y 6,
// calidades Baja y Alta. Por escena guarda una captura JPG y mide draw calls, triángulos y tiempo de cuadro (rAF).
// Uso: node tools/shot-visual.mjs [carpeta=shots/visual] [calidades=low,high] [mapas=m1,m2,m3,m4] [oleadas=1,6] [extra-url]
// OJO: en este contenedor WebGL corre por SOFTWARE (SwiftShader): los ms son reales pero mucho más lentos que una GPU.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/visual'; fs.mkdirSync(OUT, { recursive: true });
const QS = (process.argv[3] || 'low,high').split(','), MAPS = (process.argv[4] || 'm1,m2,m3,m4').split(','), WAVES = (process.argv[5] || '1,6').split(',').map(Number), EXTRA = process.argv[6] || '';
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const rows = [], errors = [];
for (const q of QS) for (const m of MAPS) for (const w of WAVES) {
  const name = `${m}-w${w}-${q}`;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const pg = await ctx.newPage();
  pg.on('console', (x) => { if (x.type() === 'error' && !/404/.test(x.text())) errors.push(`${name}: ${x.text()}`); }); pg.on('pageerror', (e) => errors.push(`${name}: PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=${m}&god=1&wave=${w}&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1&cam=third${EXTRA ? '&' + EXTRA : ''}`);
  await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(9000);
  // criaturas de prueba delante del jugador (pasivas) para juzgar siluetas y legibilidad
  await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0], h = p.heading || { x: 0, z: -1 };
    const put = (k, d, s) => { try { const mm = g.spawnMonster(k, { x: p.pos.x + h.x * d - h.z * s, y: p.pos.y + 0.5, z: p.pos.z + h.z * d + h.x * s }); mm.passive = true; mm.cd = 1e9; } catch { /* sin criatura */ } };
    put('astilla', 9, -3); put('geoda', 14, 4); put('prisma', 18, -6); }).catch((e) => errors.push(`${name}: ${e.message}`));
  await pg.waitForTimeout(2500);
  const perf = await pg.evaluate(() => new Promise((res) => { const R = window.__api.renderer, ts = []; const f = (t) => { ts.push(t); if (ts.length < 31) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); const i = R.gl.info.render; res({ ms: +d[d.length >> 1].toFixed(1), calls: i.calls, tris: i.triangles, wave: window.__api.session.game.wave, infect: window.__infect != null ? window.__infect : null, pr: R.gl.getPixelRatio() }); } }; requestAnimationFrame(f); }));
  await pg.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
  rows.push({ name, ...perf }); console.log(name, JSON.stringify(perf));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/medidas.json`, JSON.stringify(rows, null, 1));
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].slice(0, 15).join('\n') : 'sin errores de consola');
await b.close(); await srv.close();
