// Capturas del viewmodel EN JUEGO real (bot + disparo). Uso: node tools/vm-juego.mjs <carpeta> <low|high> <ancho>x<alto> <ids,coma> [bot]
// Un solo Chromium. Con "bot" usa el bot (god) en una oleada real; sin él, el campo de pruebas con blancos fijos.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [OUT = 'shots/gate/viewmodel-v2', Q = 'low', VP = '1280x720', IDS = '0,2,3,4,8,12,16,21', MODE = 'campo'] = process.argv.slice(2);
const [W, H] = VP.split('x').map(Number); fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const touch = W < 900; const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
const common = `q=${Q}&autoq=0&nolock=1&skipintro=1`;
const bot = MODE === 'bot';
await pg.goto(`${base}/?${common}&auto=m1&god=1&seed=3${bot ? '&bot=1&wave=4' : ''}`); await pg.waitForTimeout(bot ? 9000 : 5000);
for (const id of IDS.split(',').map(Number)) {
  await pg.evaluate((id) => { const g = window.__api.session.game, p = g.players[0]; p.weapon = id; p.ammo[id] = 999; if (!window.__bot) { g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; for (const [d, s] of [[14, 0], [20, 5], [20, -5]]) { const m = g.spawnMonster('prisma', { x: p.pos.x + p.heading.x * d - p.heading.z * s, y: p.pos.y + 3, z: p.pos.z + p.heading.z * d + p.heading.x * s }); m.cd = 1e9; m.hp = m.maxhp = 1e5; } } }, id);
  await pg.waitForTimeout(2500);
  const f = `${OUT}/${MODE}_${Q}_${W}_w${String(id).padStart(2, '0')}`;
  await pg.screenshot({ path: f + '_reposo.jpg', type: 'jpeg', quality: 85 });
  await pg.mouse.down(); await pg.waitForTimeout(700); await pg.screenshot({ path: f + '_fuego.jpg', type: 'jpeg', quality: 85 }); await pg.mouse.up(); await pg.waitForTimeout(200);
}
console.log(errors.length ? 'ERRORES:\n' + errors.slice(0, 10).join('\n') : 'sin errores'); await b.close(); await srv.close();
