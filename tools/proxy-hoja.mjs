// Hoja comparativa: las 12 especies en fila, con modelo real (real) y con proxy (proxy), a la misma distancia.
//   node tools/proxy-hoja.mjs <prefijo-salida> [dist=14]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [out, dist = '14'] = process.argv.slice(2);
const KINDS = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'obelisco', 'aurora', 'ariete', 'espiral'];
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 700 } });
const errs = []; pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&bot=1&god=1&wave=1&seed=3&q=low&autoq=0&skipintro=1`);
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
await pg.waitForTimeout(1500);
await pg.evaluate(({ KINDS, dist }) => {
  const s = window.__api.session, g = s.game; s.bot = null; g.queue = []; g.monsters.length = 0; const p = g.players[0];
  const h = p.heading, u = p.up; const r = { x: h.y * u.z - h.z * u.y, y: h.z * u.x - h.x * u.z, z: h.x * u.y - h.y * u.x };
  KINDS.forEach((kind, i) => { const lat = (i - 5.5) * dist * 0.19, def = window.__api.MONSTERS[kind], up = def.fly ? 2 : 0;
    const m = g.spawnMonster(kind, { x: p.pos.x + h.x * dist + r.x * lat + u.x * up, y: p.pos.y + h.y * dist + r.y * lat + u.y * up, z: p.pos.z + h.z * dist + r.z * lat + u.z * up }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; });
  g.phase = 'intermission'; g.phaseT = 1e6;
}, { KINDS, dist: +dist });
await pg.waitForTimeout(3000);
await pg.screenshot({ path: `${out}_real.jpg`, type: 'jpeg', quality: 88 });
await pg.evaluate(async () => { const q = await import('/src/client/quality.js'); q.LEVELS.low.lod = 0.1; q.LEVELS.low.full = 0; });
await pg.waitForTimeout(1500);
const info = await pg.evaluate(() => { const i = window.__api.renderer.gl.info; return { calls: i.render.calls, tris: i.render.triangles }; });
await pg.screenshot({ path: `${out}_proxy.jpg`, type: 'jpeg', quality: 88 });
console.log(JSON.stringify(info), errs.slice(0, 4)); await b.close(); await srv.close();
