// Mide llamadas/triángulos y captura ~40 monstruos (12 especies) en la escena real.
//   node tools/proxy-escena.mjs <prefijo-salida> [q=low] [n=40] [distMin=14] [distMax=45]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [out, q = 'low', n = '40', d0 = '14', d1 = '45'] = process.argv.slice(2);
const KINDS = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'obelisco', 'aurora', 'ariete', 'espiral'];
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&bot=1&god=1&wave=1&seed=3&q=${q}&autoq=0&skipintro=1`);
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
await pg.waitForTimeout(1500);
await pg.evaluate(({ KINDS, n, d0, d1 }) => {
  const s = window.__api.session, g = s.game; s.bot = null; g.queue = []; g.monsters.length = 0; const p = g.players[0];
  const h = p.heading, u = p.up; const r = { x: h.y * u.z - h.z * u.y, y: h.z * u.x - h.x * u.z, z: h.x * u.y - h.y * u.x };
  for (let i = 0; i < n; i++) {
    const kind = KINDS[i % KINDS.length], def = window.__api.MONSTERS[kind];
    const d = d0 + (d1 - d0) * ((i * 7) % n) / n, lat = (((i * 5) % 11) - 5) * d * 0.09, up = def.fly ? 3 : 0;
    const pos = { x: p.pos.x + h.x * d + r.x * lat + u.x * up, y: p.pos.y + h.y * d + r.y * lat + u.y * up, z: p.pos.z + h.z * d + r.z * lat + u.z * up };
    const m = g.spawnMonster(kind, pos, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6;
  }
  g.phase = 'intermission'; g.phaseT = 1e6;
}, { KINDS, n: +n, d0: +d0, d1: +d1 });
await pg.waitForTimeout(2500);
const info = await pg.evaluate(() => { const i = window.__api.renderer.gl.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, monstruos: window.__api.session.game.monsters.length }; });
await pg.screenshot({ path: `${out}.jpg`, type: 'jpeg', quality: 88 });
console.log(JSON.stringify({ q, n: +n, ...info }), errs.slice(0, 4)); await b.close(); await srv.close();
