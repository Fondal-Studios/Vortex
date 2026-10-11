// ART GATE de la armería EN ESCENA REAL (1ª persona dentro del juego). Uso:
//   node tools/gate-armeria.mjs <carpeta> <calidad low|medium|high> <ids "0,1,2"|all> [mapa m1|m2] [hud 0|1]
// Por arma: reposo (con criaturas delante), disparando (cuadro justo tras el disparo) y estadísticas gl.info del cuadro de reposo.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const [, , out = 'shots/gate/armas', quality = 'low', idsArg = 'all', map = 'm1', hud = '0'] = process.argv;
const NAMES = ['haz', 'prisma', 'rafaga', 'nova', 'aguja', 'pulso', 'gemelas', 'solar', 'fractal', 'enjambre', 'cometa', 'vortice', 'lanza', 'cetro', 'eclipse'];
const ids = idsArg === 'all' ? [...Array(15).keys()] : idsArg.split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?cap=1&auto=${map}&god=1&seed=3&q=${quality}&autoq=0&wave=1`);
await pg.waitForFunction(() => window.__session && window.__session.game, null, { timeout: 300000, polling: 500 });
if (hud !== '1') await pg.evaluate(() => { const st = document.createElement('style'); st.textContent = '#hud,#banner,#sub,#guide{display:none!important}'; document.head.appendChild(st); });
const stats = [];
for (const w of ids) {
  const info = await pg.evaluate(async (w) => {
    const g = window.__session.game, me = g.players[0], S = (ms) => window.__step(ms), vm = window.__renderer.vm;
    g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; S(50);
    me.weapon = w; me.ammo[w] = 30; if (me.slots && !me.slots.includes(w)) me.slots[1] = w;
    for (const [k, d, a] of [['astilla', 15, -2], ['geoda', 24, 5], ['astilla', 12, 4], ['lente', 19, 0]]) { const f = me.heading, u = me.up, r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
      g.spawnMonster(k, { x: me.pos.x + f.x * d + r.x * a, y: me.pos.y + f.y * d + r.y * a, z: me.pos.z + f.z * d + r.z * a }); }
    for (let i = 0; i < 24; i++) S(50);
    const gl = window.__renderer.gl; gl.info.autoReset = false; gl.info.reset(); S(16);
    return { calls: gl.info.render.calls, tris: gl.info.render.triangles };
  }, w);
  const base = `${out}/${String(w).padStart(2, '0')}-${NAMES[w]}-${quality}`;
  await pg.screenshot({ path: `${base}-escena.jpg`, type: 'jpeg', quality: 88, timeout: 180000 });
  await pg.evaluate(async () => { const vm = window.__renderer.vm; window.__step(16); vm.shoot(); window.__step(32); });
  await pg.screenshot({ path: `${base}-disparo.jpg`, type: 'jpeg', quality: 88, timeout: 180000 });
  stats.push({ w, name: NAMES[w], quality, ...info }); console.log(w, NAMES[w], JSON.stringify(info), errs.slice(0, 3).join('|'));
}
fs.writeFileSync(`${out}/stats-${quality}.json`, JSON.stringify(stats, null, 1));
await b.close(); await srv.close();
