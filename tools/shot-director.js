// Capturas de los sistemas del director: objetivo, ancla, pilares del Coloso, válvulas de la Madre, caído.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
fs.mkdirSync('shots', { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`;
const errors = [];
const SCENES = {
  'director-ancla': ['m1', 2, `window.__api.session.game.phaseT = 0.1;`, 5500, ''],
  'director-sintonia': ['m2', 2, `window.__api.session.game.phaseT = 0.1;`, 5500, ''],
  'director-coloso': ['m1', 7, `const g = window.__api.session.game; const m = g.monsters.find(x => x.kind === 'coloso'); if (m) { m.rayCd = 0.1; }`, 6500, '&look=boss'],
  'director-madre': ['m2', 7, ``, 5000, '&look=boss'],
};
for (const [name, [map, wave, js, wait, extra]] of Object.entries(SCENES)) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); }); pg.on('pageerror', (e) => errors.push(`${name}: PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=${map}&bot=1&god=1&wave=${wave}&seed=3&q=low&autoq=0${extra}`); await pg.waitForTimeout(2500);
  if (js) await pg.evaluate(js).catch((e) => errors.push(name + ' ' + e.message));
  await pg.waitForTimeout(wait);
  await pg.screenshot({ path: `shots/${name}.jpg`, type: 'jpeg', quality: 80 }); await pg.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
