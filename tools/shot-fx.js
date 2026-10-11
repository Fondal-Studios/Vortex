// Capturas de los efectos de disparo de cada arma (primera persona, contra criaturas de frente).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
fs.mkdirSync('shots/fx', { recursive: true });
const IDS = (process.argv[2] || '15,16,17,18,19,20,21,22,23,24,8,7').split(',').map(Number);
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const pg = await b.newPage({ viewport: { width: 1000, height: 560 } });
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`${base}/?auto=m1&god=1&seed=3&q=low&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(3000);
for (const id of IDS) {
  await pg.evaluate((id) => {
    const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true;
    p.weapon = id; p.ammo[id] = 999;
    const f = (d, s = 0) => ({ x: p.pos.x + p.heading.x * d - p.heading.z * s, y: p.pos.y + 1, z: p.pos.z + p.heading.z * d + p.heading.x * s });
    for (const [d, s] of [[14, 0], [18, 4], [18, -4], [24, 0]]) { const m = g.spawnMonster('geoda', f(d, s)); m.open = true; m.cd = 1e9; m.hp = m.maxhp = 1e5; }
    window.__fire = true;
  }, id);
  await pg.mouse.down(); await pg.waitForTimeout(1300); await pg.screenshot({ path: `shots/fx/arma-${id}.jpg`, type: 'jpeg', quality: 78 }); await pg.mouse.up();
}
console.log(errors.length ? errors.slice(0, 4).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
