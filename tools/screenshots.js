// Capturas reales con Chromium (WebGL por software): cada mapa, cada criatura, menú y escenas de física.
// Uso: node tools/screenshots.js [filtro]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';

const OUT = 'shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 });
const b = await launch();
const base = `http://localhost:${srv.port}`;
const errors = [], fpsLog = {};

async function page(url, wait, file, { w = 1280, h = 720 } = {}) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${file}: ${m.text()}`); });
  pg.on('pageerror', (e) => errors.push(`${file}: PAGEERR ${e.message}`));
  await pg.goto(base + url); await pg.waitForTimeout(wait);
  await pg.screenshot({ path: `${OUT}/${file}.jpg`, type: "jpeg", quality: 72 });
  fpsLog[file] = await pg.evaluate(() => window.__fps).catch(() => null);
  await pg.close();
}

const jobs = [];
const add = (file, url, wait) => jobs.push({ file, run: () => page(url, wait, file) });
for (const k of ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'coloso', 'madre']) add(`monstruo-${k}`, `/public/viewer.html?k=${k}`, 1800);
add('monstruo-geoda-abierta', '/public/viewer.html?k=geoda&s=open', 1800);
add('monstruo-espejo-camuflado', '/public/viewer.html?k=espejo&c=1', 1800);
add('bestiario-completo', '/public/viewer.html', 2000);
add('menu', '/', 3000);
for (const map of ['m1', 'm2']) for (const w of [1, 4, 7]) add(`mapa-${map}-oleada-${w}`, `/?auto=${map}&bot=1&god=1&wave=${w}&seed=3${w === 7 ? '&look=boss' : ''}`, w === 7 ? 14000 : 11000);

// Escenas de física rota: se coloca al jugador con la API de depuración de la página.
const SCENES = {
  'fisica-m1-ascensor': ['m1', `const z = g.map.zones.find(q => q.kind === 'flip'); p.pos = {x: z.c.x, y: z.y0 + 2, z: z.c.z}; p.vel = {x:0,y:0,z:0};`, 4200],
  'fisica-m1-planetoide': ['m1', `const s = g.map.solids.find(q => q.type === 'sph'); p.pos = {x: s.c.x + s.r + 0.9, y: s.c.y, z: s.c.z}; p.vel = {x:0,y:0,z:0};`, 3000],
  'fisica-m1-cero-g': ['m1', `const z = g.map.zones.find(q => q.kind === 'zero'); p.pos = {x: z.c.x, y: z.c.y, z: z.c.z}; p.vel = {x:0,y:0,z:0};`, 2500],
  'fisica-m2-marea': ['m2', `g.time = g.map.tide.zeroAt + 0.5; p.pos = {x: 0, y: -45, z: 0};`, 2500],
  'fisica-m2-caminar-techo': ['m2', `p.pos = {x: 0, y: g.map.R - 0.9, z: 0};`, 2500],
};
for (const [name, [map, js, wait]] of Object.entries(SCENES)) jobs.push({ file: name, run: async () => {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await pg.goto(`${base}/?auto=${map}&nolock=1&seed=5`);
  await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
  await pg.evaluate(`(() => { const g = window.__api.session.game, p = g.players[0]; p.godmode = true; g.phaseT = 2; ${js}
    const near = (d) => ({ x: p.pos.x + p.heading.x * d, y: p.pos.y + p.heading.y * d, z: p.pos.z + p.heading.z * d });
    for (const [k, d] of [['astilla', 14], ['astilla', 17], ['geoda', 24], ['racimo', 12]]) g.spawnMonster(k, near(d)); })()`);
  await pg.waitForTimeout(wait);
  await pg.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 72 });
  await pg.close();
} });

const only = process.argv[2];
for (const j of jobs) if (!only || j.file.includes(only)) await j.run();
await b.close(); await srv.close();
console.log('FPS (Chromium + SwiftShader, sin GPU):', JSON.stringify(Object.fromEntries(Object.entries(fpsLog).filter(([k, v]) => v).map(([k, v]) => [k, +v.toFixed(1)]))));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'sin errores de consola');
