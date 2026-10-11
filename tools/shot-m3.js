// Capturas del Laberinto Celestial en juego: oleada normal y jefe Argos.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
fs.mkdirSync('shots', { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const SC = [['m3-oleada3', '&wave=3'], ['m3-argos', '&wave=7&look=boss']];
for (const [name, q] of SC) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); }); pg.on('pageerror', (e) => errors.push(`${name}: PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=m3&bot=1&god=1&seed=3&q=${process.argv[2] || 'low'}&autoq=0${q}`); await pg.waitForTimeout(14000);
  await pg.screenshot({ path: `shots/${name}.jpg`, type: 'jpeg', quality: 80 }); await pg.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
