// Reproduce la escena del recorrido (bot, sin tocar el arma) y toma N capturas. Uso: node tools/vm-tour.mjs <carpeta> <low|high> <WxH> [n] [gap_ms] [wait_ms]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [OUT = '/tmp/vmt', Q = 'low', VP = '1280x720', N = '4', GAP = '1500', WAIT = '12000'] = process.argv.slice(2);
const [W, H] = VP.split('x').map(Number); fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const errors = [];
const touch = W < 900; const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&bot=1&god=1&wave=4&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(+WAIT);
for (let i = 0; i < +N; i++) { if (i) await pg.waitForTimeout(+GAP); await pg.screenshot({ path: `${OUT}/tour_${Q}_${W}_${i}.jpg`, type: 'jpeg', quality: 85 }); }
console.log(errors.length ? 'ERRORES:\n' + errors.slice(0, 10).join('\n') : 'sin errores'); await b.close(); await srv.close();
