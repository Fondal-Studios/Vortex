// Congela el cambio de arma en distintos valores de vm.low y captura (para cazar defectos de la animación de cambio). Uso: node tools/vm-low.mjs <carpeta> <low|high> <WxH> <id> <valores,coma>
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [OUT = '/tmp/vml', Q = 'low', VP = '1280x720', ID = '2', VALS = '0,0.4,0.7,0.9,1'] = process.argv.slice(2);
const [W, H] = VP.split('x').map(Number); fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const errors = [];
const touch = W < 900; const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&god=1&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(5000);
await pg.evaluate((id) => { const g = window.__api.session.game, p = g.players[0]; p.weapon = +id; p.ammo[id] = 999; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; }, ID);
await pg.waitForTimeout(2500);
for (const v of VALS.split(',').map(Number)) {
  await pg.evaluate((v) => { const vm = window.__api.renderer.vm; if (!vm.__o) { vm.__o = vm.update.bind(vm); } vm.update = function (dt, o) { vm.__o(dt, o); this.low = window.__LOW; }; window.__LOW = v; }, v);
  await pg.waitForTimeout(800); await pg.screenshot({ path: `${OUT}/low_${Q}_${W}_w${ID}_${v}.jpg`, type: 'jpeg', quality: 85 });
}
console.log(errors.length ? 'ERRORES:\n' + errors.slice(0, 10).join('\n') : 'sin errores'); await b.close(); await srv.close();
