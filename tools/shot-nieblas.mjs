// Capturas de las NIEBLAS DE COLORES y de la LUZ DE LAS ARENAS dentro del juego real (Chromium por software, como tools/shot-arenas.js).
// Uso: node tools/shot-nieblas.mjs [m1|…|m6|todas] [carpeta=shots/nieblas] [calidad=low] [ciclo=dia|ocaso|eclipse] [modo=zona|dentro|luz]
//   zona   → las dos nieblas de la arena + una de cada color alrededor del jugador, vistas desde fuera (3ª persona)
//   dentro → el jugador adentro de cada color (viñeta + cartel de función)
//   luz    → sólo la luz de la arena (sin nieblas) en el ciclo pedido; sirve para comparar día / ocaso / eclipse
// Imprime también las llamadas de dibujo y triángulos que agregan las nieblas (renderer.info).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const args = process.argv.slice(2), WHICH = args[0] || 'todas', OUT = args[1] || 'shots/nieblas', Q = args[2] || 'low', CICLO = args[3] || 'dia', MODO = args[4] || 'zona';
const maps = WHICH === 'todas' ? ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] : [WHICH];
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
for (const MAP of maps) {
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`[${MAP}] ${m.text().slice(0, 200)}`); });
  pg.on('pageerror', (e) => errors.push(`[${MAP}] PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=${MAP}&bot=1&god=1&wave=2&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1&cam=third&ciclo=${CICLO}`, { timeout: 240000 });
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 180000 });
  await pg.waitForTimeout(3500);
  await pg.evaluate(async (modo) => {
    const N = await import('/src/sim/nieblas.js'), s = window.__api.session, g = s.game, p = g.players[0];
    s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
    g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; g.wave = 5; g.phase = 'wave'; if (g.ar) { g.ar.wave = 5; g.ar.t0 = g.time - 60; }
    const ti = Object.keys(N.NIEBLAS), h = p.heading, rt = { x: h.y * p.up.z - h.z * p.up.y, y: h.z * p.up.x - h.x * p.up.z, z: h.x * p.up.y - h.y * p.up.x };
    const X = (f, side) => ({ x: p.pos.x + h.x * f + rt.x * side + p.up.x * 1.2, y: p.pos.y + h.y * f + rt.y * side + p.up.y * 1.2, z: p.pos.z + h.z * f + rt.z * side + p.up.z * 1.2 });   // delante del jugador (f) y a su derecha (side)
    if (modo === 'luz') g.ng.zonas = [];
    else if (modo === 'zona') for (let i = 0; i < 6; i++) N.nieblaTemporal(g, ti[i], X(14 + (i % 2) * 7, (i - 2.5) * 7.5), 7, 600);
    else { N.nieblaTemporal(g, 'acida', { x: p.pos.x, y: p.pos.y + p.up.y * 1.2, z: p.pos.z }, 9, 600); }
    window.__NG = N;
  }, MODO);
  const tipos = MODO === 'dentro' ? ['acida', 'cian', 'magenta', 'ambar', 'blanca', 'negra'] : [null];
  for (const t of tipos) {
    if (t) await pg.evaluate(async (t) => { const N = window.__NG, g = window.__api.session.game, p = g.players[0]; g.ng.zonas = g.ng.zonas.filter((z) => z.src === 'arena'); N.nieblaTemporal(g, t, { x: p.pos.x, y: p.pos.y + p.up.y * 1.2, z: p.pos.z }, 9, 600); }, t);
    await pg.waitForTimeout(5500);
    const info = await pg.evaluate(() => { const r = window.__api.renderer, i = r.gl.info.render; return { calls: i.calls, tris: i.triangles, nube: r.nfx ? r.nfx.cloud.geometry.instanceCount : 0 }; });
    await pg.screenshot({ path: `${OUT}/${MAP}-${MODO}-${CICLO}${t ? '-' + t : ''}.png` });
    console.log(`${MAP} ${MODO} ${CICLO}${t ? ' ' + t : ''}: llamadas ${info.calls} triángulos ${info.tris} nubes ${info.nube}`);
  }
  await pg.close();
}
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].slice(0, 10).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
