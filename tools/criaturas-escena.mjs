// Captura de criaturas EN LA ESCENA REAL del juego. Uso:
//   node tools/criaturas-escena.mjs <kind> <prefijo-salida> [estados "roll,open"] [dist=12] [q=low] [mapa=m1] [extra "hp=0.3&c=1"]
// El monstruo es "pasivo" (no corre su IA): se le fuerzan state/open/cloak para ver cada pose en el motor real.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [kind, out, states = 'idle', dist = '12', q = 'low', map = 'm1', extra = ''] = process.argv.slice(2);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; pg.on('console', (m) => { if (['error'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=${map}&bot=1&god=1&wave=1&seed=3&q=${q}&autoq=0&skipintro=1`);
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
await pg.waitForTimeout(1500);
await pg.evaluate(({ kind, dist }) => {
  const s = window.__api.session, g = s.game; s.bot = null; g.queue = []; g.monsters.length = 0; const p = g.players[0];
  const def = window.__api.MONSTERS[kind], h = p.heading, u = p.up;
  const pos = { x: p.pos.x + h.x * dist + (def.fly ? u.x * 3 : 0), y: p.pos.y + h.y * dist + (def.fly ? u.y * 3 : 0), z: p.pos.z + h.z * dist + (def.fly ? u.z * 3 : 0) };
  const m = g.spawnMonster(kind, pos, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; window.__m = m; g.phase = 'intermission'; g.phaseT = 1e6;
}, { kind, dist: +dist });
const res = {};
for (const sdef of states.split(',')) {
  const [s, hp, c] = sdef.split(':');
  await pg.evaluate(({ s, hp, c }) => { const m = window.__m; m.state = s; m.open = s === 'open'; m.cloak = c === '1'; m.hp = m.maxhp * (hp ? +hp : 1); m.hurt = 0; }, { s, hp, c });
  await pg.waitForTimeout(+process.env.CS_WAIT || 2500);
  const info = await pg.evaluate(() => { const r = window.__api.renderer, i = r.gl.info; return { calls: i.render.calls, tris: i.render.triangles }; }).catch(() => null);
  await pg.screenshot({ path: `${out}_${sdef.replace(/:/g, '_')}.jpg`, type: 'jpeg', quality: 85 }); res[sdef] = info;
}
console.log(kind, q, JSON.stringify(res), errs.slice(0, 4)); await b.close(); await srv.close();
