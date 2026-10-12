// Recorrido para los críticos del ART GATE: genera una hoja de capturas reales de TODO el juego (menús, mapas, jefes, armas, héroes, HUD móvil).
// Uso: node tools/gate-tour.js [carpeta=shots/gate/tour] [calidad=low]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/gate/tour', Q = process.argv[3] || 'low'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
async function scene(name, url, { wait = 12000, vp = { width: 1280, height: 720 }, touch = false, js = null, shots = 1, gap = 1500 } = {}) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`${name}: ${m.text()}`); }); pg.on('pageerror', (e) => errors.push(`${name}: PAGEERR ${e.message}`));
  await pg.goto(`${base}/${url}`); await pg.waitForTimeout(wait);
  if (js) await pg.evaluate(js).catch((e) => errors.push(`${name}: ${e.message}`));
  for (let i = 0; i < shots; i++) { if (i) await pg.waitForTimeout(gap); await pg.screenshot({ path: `${OUT}/${name}${shots > 1 ? '-' + (i + 1) : ''}.jpg`, type: 'jpeg', quality: 80 }); }
  await ctx.close();
}
const common = `q=${Q}&autoq=0&nolock=1&skipintro=1`;
await scene('01-menu-principal', `?${common}`, { wait: 3000, js: 'window.__api.ui.confirmTitle()' });
await scene('02-menu-equipo', `?${common}`, { wait: 3000, js: "window.__api.ui.confirmTitle(); window.__api.ui.show('loadout')" });
await scene('03-m1-oleada', `?auto=m1&bot=1&god=1&wave=4&seed=3&${common}`, { shots: 3 });
await scene('04-m1-jefe-coloso', `?auto=m1&bot=1&god=1&wave=7&seed=3&${common}`, { shots: 2 });
await scene('05-m2-oleada', `?auto=m2&bot=1&god=1&wave=4&seed=3&${common}`, { shots: 2 });
await scene('06-m2-jefe-madre', `?auto=m2&bot=1&god=1&wave=7&seed=3&${common}`, { shots: 2 });
await scene('07-m3-oleada', `?auto=m3&bot=1&god=1&wave=4&seed=3&${common}`, { shots: 3 });
await scene('08-m3-jefe-argos', `?auto=m3&bot=1&god=1&wave=7&seed=3&${common}`, { shots: 2 });
await scene('09-movil-m1', `?auto=m1&bot=1&god=1&wave=4&seed=3&${common}`, { vp: { width: 844, height: 390 }, touch: true, shots: 2 });
await scene('10-campo-pruebas-armas', `?${common}`, { wait: 3500, shots: 1, js: "window.__api.ui.confirmTitle()" });
// armas en primera persona (campo de pruebas): una captura por arma
const pg0 = await b.newPage({ viewport: { width: 1100, height: 620 } });
pg0.on('pageerror', (e) => errors.push('armas PAGEERR ' + e.message)); pg0.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('armas: ' + m.text()); });
await pg0.goto(`${base}/?${common}&auto=m1&god=1&seed=3`); await pg0.waitForTimeout(4000);
for (const id of [0, 3, 4, 7, 8, 11, 12, 15, 16, 18, 20, 21, 23, 24]) {
  await pg0.evaluate((id) => { const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; p.weapon = id; p.ammo[id] = 999; for (const [d, s] of [[14, 0], [20, 5], [20, -5]]) { const m = g.spawnMonster('prisma', { x: p.pos.x + p.heading.x * d - p.heading.z * s, y: p.pos.y + 3, z: p.pos.z + p.heading.z * d + p.heading.x * s }); m.cd = 1e9; m.hp = m.maxhp = 1e5; } }, id);
  await pg0.mouse.down(); await pg0.waitForTimeout(1200); await pg0.screenshot({ path: `${OUT}/armas-${String(id).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 }); await pg0.mouse.up(); await pg0.waitForTimeout(300);
}
console.log(errors.length ? 'ERRORES:\n' + errors.slice(0, 10).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
