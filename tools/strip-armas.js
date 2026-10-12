// Tira de disparo de un arma: cuadros a 1,3,6,10,18 y 40 pasos (de 1/60 s) después del disparo. Uso: node tools/strip-armas.js <id> <low|high> <salida.jpg> [consulta extra]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import { execSync } from 'node:child_process';
const [, , id = '0', q = 'low', out = '/tmp/strip.jpg', extra = ''] = process.argv;
const srv = await startServer({ port: 0 }); const b = await launch(); const files = [];
const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
for (const after of [1, 3, 6, 10, 18, 40]) {
  await pg.goto(`http://localhost:${srv.port}/public/weapons.html?cap=1&w=${id}&q=${q}&view=fp${extra ? '&' + extra : ''}`);
  await pg.waitForFunction(() => window.__weaponsReady && window.__step, null, { timeout: 120000 });
  await pg.evaluate(([a]) => { window.__step(40, 0.016, []); window.__step(a, 0.016, [0]); }, [after]);
  await pg.waitForTimeout(80); const f = `${out}.${after}.jpg`; await pg.screenshot({ path: f, type: 'jpeg', quality: 85 }); files.push(f);
}
execSync(`montage ${files.join(' ')} -tile 3x2 -geometry 560x259+2+2 ${out}`); execSync(`rm ${files.join(' ')}`);
await b.close(); await srv.close();
