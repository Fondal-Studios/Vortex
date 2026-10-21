// Humo del cliente tras el cambio de colisión/rezagados: abre m3 y m6 con bot, cuenta errores de consola y saca una captura.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), errors = [];
for (const [map, wave] of [['m3', 3], ['m6', 4]]) {
  const pg = await b.newPage({ viewport: { width: 1100, height: 620 } });
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${map}: ${m.text()}`); });
  pg.on('pageerror', (e) => errors.push(`${map}: PAGEERR ${e.message}`));
  await pg.goto(`http://localhost:${srv.port}/?auto=${map}&bot=1&god=1&wave=${wave}&seed=3`); await pg.waitForTimeout(16000);
  await pg.screenshot({ path: `${OUT}/colision-${map}.jpg`, type: 'jpeg', quality: 70 }); await pg.close();
}
await b.close(); srv.close && srv.close();
console.log('errores de consola:', errors.length ? errors.join('\n') : 'ninguno');
process.exit(0);
