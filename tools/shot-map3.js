// Capturas del Mapa 3 (Laberinto Celestial) y de los ojos cósmicos, con Chromium por software.
// Uso: node tools/shot-map3.js [low|high|medium ...] [--solo=vista1,vista2]   → shots/map3-<calidad>-<vista>.jpg
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';

const args = process.argv.slice(2), only = (args.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);
const levels = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : ['low', 'high'];
const OUT = 'shots'; fs.mkdirSync(OUT, { recursive: true });
const VIEWS = {
  spawn: [-68, 1.5, 64, 0, 0],          // aparición, mirando al norte (-z)
  spawn2: [-68, 1.5, 64, 90, 8],        // aparición, mirando al este
  plaza: [-30, 1.6, 0, 90, 4],          // entrando a la plaza desde el oeste
  plaza2: [0, 1.6, 28, 180, 12],        // desde el sur de la plaza hacia el centro
  arriba: [0, 1.5, 12, 10, 62],         // mirando al cielo (ojos)
  arriba2: [-30, 1.5, -20, 200, 40],    // cielo, otro rumbo
  portal: [-58, 1.5, -55.8, -30, 3],    // frente a un portal (el de la esquina magenta)
  borde: [0, -4, 125, 0, 14],           // desde afuera, a la altura de la panza de la losa
  planta: [0, 175, 0, 0, -89],          // vista cenital (comprueba que los muros calzan con la simulación)
  mirada: [0, 40, 150, 0, -8],         // desde afuera, para ver la losa y la panza
};
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`;
const errors = [];
for (const lv of levels) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${lv}] ${m.text().slice(0, 600)}`); });
  pg.on('pageerror', (e) => errors.push(`[${lv}] PAGEERR ${e.message}`));
  await pg.goto(`${base}/public/map3-demo.html?q=${lv}`); await pg.waitForFunction('window.__ready', null, { timeout: 180000 });
  for (const [name, v] of Object.entries(VIEWS)) {
    if (only.length && !only.includes(name)) continue;
    await pg.evaluate((a) => window.__set(...a), v);
    const info = await pg.evaluate(() => window.__frame(6));
    await pg.screenshot({ path: `${OUT}/map3-${lv}-${name}.jpg`, type: 'jpeg', quality: 80 });
    console.log(lv, name, JSON.stringify(info));
  }
  await pg.close();
}
await b.close(); srv.close && srv.close();
if (errors.length) console.log('--- avisos/errores ---\n' + [...new Set(errors)].join('\n'));
process.exit(0);
