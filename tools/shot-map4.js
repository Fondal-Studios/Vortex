// Capturas reales del Mapa 4 (Jardín de Carne) dentro del juego, con Chromium por software, y medición de draw calls / triángulos.
// Uso: node tools/shot-map4.js [carpeta=shots/map4] [calidad=low] [--solo=vista1,vista2] [--sin-criaturas]
// Teletransporta al jugador (bot congelado, invulnerable) y saca una captura por vista. Imprime renderer.info de cada una.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
const OUT = pos[0] || 'shots/map4', Q = pos[1] || 'low';
const only = (args.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);
const quiet = args.includes('--sin-criaturas'), withHud = args.includes('--hud');
fs.mkdirSync(OUT, { recursive: true });
// [x, y(pies), z, yaw° (0 = hacia -z, 90 = hacia +x), pitch°]
const VIEWS = {
  spawn: [-56, 3, 36, 40, -2],            // aparición, mirando hacia el Corazón
  spawn2: [-48, 3, 33, 120, -8],          // desde la Siembra hacia el sur
  corazon: [-14, 0, 12, 60, 6],           // el Corazón y sus columnas
  corazon2: [10, 0, -14, 235, 4],         // el Corazón desde el otro lado
  cielo: [-6, 0, 6, 20, 38],              // cielo
  rampa: [-30, 1.5, 22, 330, -3],         // rampa del Corazón hacia la Siembra, de espaldas
  cam: [34, 1, 4, 90, -5],                // entrando a la Cámara del Latido
  foso: [47, 1, -2, 30, -42],             // mirando el foso
  puente: [66, 1, -10, 25, -6],           // el hueco donde nace el puente (hacia el Umbral)
  mirador: [20, 12, -62, 200, -6],        // desde el Mirador hacia el Corazón
  vivero: [28, 5, 46, 35, -4],            // el Vivero
  borde: [-8, 0, 20, 320, -18],           // vacío y niebla desde el borde
  panorama: [-52, 5, 40, 90, -20],        // vista general desde la Siembra
  umbral: [74, 7, -38, 0, 3],             // el Umbral (si el puente está)
};
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${Q}] ${m.text().slice(0, 500)}`); });
pg.on('pageerror', (e) => errors.push(`[${Q}] PAGEERR ${e.message}`));
await pg.goto(`${base}/?auto=m4&bot=1&god=1&wave=${quiet ? 1 : 2}&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1`);
await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 60000 });
await pg.waitForTimeout(4000);
await pg.evaluate(([quiet, withHud]) => {
  const s = window.__api.session, g = s.game;
  if (!withHud) { const st = document.createElement('style'); st.textContent = '#hud, #cards, #objective, #banner, #pings{display:none !important}'; document.head.appendChild(st); }
  s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
  if (quiet) { g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; }
}, [quiet, withHud]);
const results = {};
for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  await pg.evaluate(([x, y, z, yaw, pitch]) => {
    const g = window.__api.session.game, p = g.players[0], r = Math.PI / 180;
    p.pos = { x, y: y + 0.9, z }; p.vel = { x: 0, y: 0, z: 0 }; p.up = { x: 0, y: 1, z: 0 };
    p.heading = { x: Math.sin(yaw * r), y: 0, z: -Math.cos(yaw * r) }; p.pitch = pitch * r; p.hp = 100;
  }, v);
  await pg.waitForTimeout(1300);
  const info = await pg.evaluate(() => { const i = window.__api.renderer.gl.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs ? i.programs.length : 0 }; });
  await pg.screenshot({ path: `${OUT}/m4-${Q}-${name}.jpg`, type: 'jpeg', quality: 82 });
  results[name] = info; console.log(Q, name, JSON.stringify(info));
}
const mx = (k) => Math.max(...Object.values(results).map((r) => r[k]));
console.log(`MÁXIMO entre vistas (${Q}): ${mx('calls')} draw calls, ${mx('tris')} triángulos (incluye criaturas, armas y efectos; el entorno solo se mide con tests/tools/medir-map4)`);
console.log(errors.length ? 'AVISOS/ERRORES:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'sin errores de consola');
await b.close(); srv.close && srv.close(); process.exit(0);
