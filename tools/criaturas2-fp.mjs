// Fotograma de COMBATE en primera persona (la vista real del jugador): varias criaturas de criaturas-2 delante, a 14–34 m, pasivas con estado forzado.
// node tools/criaturas2-fp.mjs <salida.jpg> [q=low] [map=m1] [kinds "ariete:20:-6:idle,obelisco:34:8:charge,..."]   (kind:dist:lateral:estado[:hp])
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [out, q = 'low', map = 'm1', list = 'ariete:16:-5:wind,obelisco:30:7:charge,aurora:22:2:cast,espiral:26:-12:pull,graviton:34:14:charge'] = process.argv.slice(2);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.HH || 720) } });
const errs = []; pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=${map}&bot=1&god=1&wave=1&seed=3&q=${q}&autoq=0&skipintro=1`, { timeout: 400000, waitUntil: 'commit' });
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
await pg.waitForTimeout(1500);
await pg.evaluate((list) => {
  const s = window.__api.session, g = s.game; s.bot = null; g.queue = []; g.monsters.length = 0; g.phase = 'intermission'; g.phaseT = 1e6; const p = g.players[0];
  const h = p.heading, u = p.up, right = { x: h.y * u.z - h.z * u.y, y: h.z * u.x - h.x * u.z, z: h.x * u.y - h.y * u.x }; window.__ms = [];
  for (const it of list.split(',')) { const [k, d, lat, st, hp] = it.split(':'); const def = window.__api.MONSTERS[k];
    const pos = { x: p.pos.x + h.x * +d + right.x * +lat + (def.fly ? u.x * 4 : 0), y: p.pos.y + h.y * +d + right.y * +lat + (def.fly ? u.y * 4 : 0), z: p.pos.z + h.z * +d + right.z * +lat + (def.fly ? u.z * 4 : 0) };
    const m = g.spawnMonster(k, pos, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.state = st; m.open = st === 'open'; if (hp) m.hp = m.maxhp * +hp; window.__ms.push(m); }
}, list);
const t0 = await pg.evaluate(() => window.__api.renderer.t); await pg.waitForFunction((t0) => window.__api.renderer.t - t0 >= 2.0, t0, { timeout: 400000, polling: 200 });
await pg.screenshot({ path: out, type: 'jpeg', quality: 88, timeout: 600000 });
console.log('ok', errs.slice(0, 3)); await b.close(); await srv.close();
