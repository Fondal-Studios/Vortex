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
// Vistas calculadas sobre el diseño real del mapa (src/sim/map4.js): { from: [x,y(pies),z], to: [x,y,z] | yaw/pitch, ...preparación }
import { PLATS, M4 } from '../src/sim/map4.js';
import { MAPS } from '../src/sim/maps.js';
const P = Object.fromEntries(PLATS.map((p) => [p.id, p])), L = MAPS.m4.layout, CH = (id) => L.conns.find((c) => c.id === id).chain;
const at = (id, dx = 0, dz = 0, dy = 0) => [P[id].x + dx, P[id].top + dy, P[id].z + dz];
const ch = (id, i) => { const c = CH(id)[i]; return [c.x, c.top, c.z]; };
const eye = (a) => [a[0], a[1] + 1.5, a[2]];
const VIEWS = {
  capullo: { from: at('gar', 8, -1), to: [P.gar.x - 5, P.gar.top + 3, P.gar.z - 6], prep: 'capullos' },
  capullo2: { from: at('viv', -3, 4), to: [P.viv.x + 5, P.viv.top + 3, P.viv.z + 6], prep: 'capullos' },
  spawn: { from: at('sie', -4, 3), to: eye(at('hub', 6, -4)) },
  suelo: { from: at('hub', -9, 10), yaw: 40, pitch: -70 },
  suelo2: { from: at('sie', -2, 4), yaw: 60, pitch: -30 },
  spawn2: { from: at('sie', 7, -3), to: eye(at('cam', 0, 0, 2)), pitch: -3 },
  corazon: { from: at('hub', -14, 12), to: eye(at('hub', 0, 0, 2)) },
  corazon2: { from: at('hub', 12, -15), to: eye(at('hub', -3, 2, 3)) },
  cielo: { from: at('hub', -6, 6), yaw: 20, pitch: 38 },
  rampa: { from: ch('hub-sie', 12), to: eye(ch('hub-sie', 0)) },
  rampa2: { from: ch('hub-tra', 3), to: eye(ch('hub-tra', 14)) },
  camara: { from: ch('hub-cam', 8), to: eye(at('cam', 0, 0)) },
  foso: { from: at('cam', -13, 2), to: at('cam', 0, 0, -3), pitch: -34 },
  puente: { from: ch('hub-cam', 10), yaw: 70, pitch: -10, to: eye(at('umb', 0, 0, 0)) },
  mirador: { from: at('mir', -2, 4), to: eye(at('hub', 0, 0)), pitch: -12 },
  vivero: { from: at('viv', -3, -2), to: eye(at('hub', 0, 0, 0)) },
  borde: { from: [Math.cos(1.92) * 21, 0, Math.sin(1.92) * 21], yaw: 200, pitch: -14 },
  panorama: { from: at('mir', 3, 5, 0), to: eye(at('cam', -6, 0)), pitch: -18 },
  umbral: { from: at('umb', -4, 6), to: eye(at('cam', 6, -6, 0)) },
  puentehecho: { from: ch('hub-cam', 10), to: eye(at('umb', 0, 0, 0)), prep: 'puente' },
};
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${Q}] ${m.text().slice(0, 500)}`); });
pg.on('pageerror', (e) => errors.push(`[${Q}] PAGEERR ${e.message}`));
await pg.goto(`${base}/?auto=m4&bot=1&god=1&wave=2&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1`);
await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 60000 });
await pg.waitForTimeout(4000);
await pg.evaluate(([quiet, withHud]) => {
  const s = window.__api.session, g = s.game;
  if (!withHud) { const st = document.createElement('style'); st.textContent = '#hud, #cards, #objective, #banner, #pings{display:none !important}'; document.head.appendChild(st); }
  s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
  if (quiet) { g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; }
}, [quiet, withHud]);
const results = {};
// La cámara del juego la gobierna el propio juego; para las capturas se le impone la pose DESPUÉS de su actualización de cada cuadro.
await pg.evaluate(() => {
  const r = window.__api.renderer, orig = r.updateCamera.bind(r);
  r.updateCamera = (me, dt, look) => { orig(me, dt, look); const c = window.__shotCam; if (c) { r.camera.position.set(c.x, c.y, c.z); r.camera.rotation.order = 'YXZ'; r.camera.rotation.set(c.pitch, -c.yaw, 0); r.eye = r.camera.position.clone(); } };
});
const prepared = new Set();
for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  const [x, y, z] = v.from; let yaw = v.yaw ?? 0, pitch = v.pitch ?? 0;
  if (v.to) { const dx = v.to[0] - x, dz = v.to[2] - z, dy = v.to[1] - (y + 1.5); yaw = Math.atan2(dx, -dz) * 180 / Math.PI; if (v.pitch === undefined) pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI; }
  if (v.prep && !prepared.has(v.prep)) { prepared.add(v.prep); await pg.evaluate((prep) => {
    const g = window.__api.session.game, p = g.players[0];
    if (prep === 'puente') { g.cult.secOn = g.cult.secOn.map(() => true); g.cult.secG = g.cult.secG.map(() => 1); g.step(1 / 60); }
    if (prep === 'capullos') { const cs = g.objects.filter((o) => o.type === 'capullo'); if (cs[0]) for (let i = 0; i < 9; i++) g.damageObject(cs[0], 50, p, cs[0].pos); if (cs[1]) for (let i = 0; i < 17; i++) g.damageObject(cs[1], 50, p, cs[1].pos); if (cs[2]) { cs[2].nut = 0.3; cs[2].v = 0.3; } }
  }, v.prep); }
  await pg.evaluate(([x, y, z, yaw, pitch]) => {
    const g = window.__api.session.game, p = g.players[0], r = Math.PI / 180;
    p.pos = { x, y: y + 0.9, z }; p.vel = { x: 0, y: 0, z: 0 }; p.up = { x: 0, y: 1, z: 0 };
    p.heading = { x: Math.sin(yaw * r), y: 0, z: -Math.cos(yaw * r) }; p.pitch = pitch * r; p.hp = 100;
    window.__shotCam = { x, y: y + 1.5, z, yaw: yaw * r, pitch: pitch * r };
  }, [x, y, z, yaw, pitch]);
  await pg.evaluate(() => new Promise((res) => { const r = window.__api.renderer, t0 = r.t; const iv = setInterval(() => { if (r.t - t0 > 0.6) { clearInterval(iv); res(); } }, 100); }));
  await pg.waitForTimeout(1800);
  const info = await pg.evaluate(() => { const i = window.__api.renderer.gl.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs ? i.programs.length : 0 }; });
  try { await pg.screenshot({ path: `${OUT}/m4-${Q}-${name}.jpg`, type: 'jpeg', quality: 82, timeout: 150000 }); } catch (e) { errors.push(`captura ${name}: ${e.message.split('\n')[0]}`); continue; }
  results[name] = info; console.log(Q, name, JSON.stringify(info));
}
const mx = (k) => Math.max(...Object.values(results).map((r) => r[k]));
console.log(`MÁXIMO entre vistas (${Q}): ${mx('calls')} draw calls, ${mx('tris')} triángulos (incluye criaturas, armas y efectos; el entorno solo se mide con tests/tools/medir-map4)`);
console.log(errors.length ? 'AVISOS/ERRORES:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'sin errores de consola');
await b.close(); srv.close && srv.close(); process.exit(0);
