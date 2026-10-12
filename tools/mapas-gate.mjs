// ART GATE de los mapas 1 y 2 — capturas EN JUEGO (Chromium/WebGL por software) con medición gl.info.
// Uso: node tools/mapas-gate.mjs <carpeta> <m1|m2> <low|high> [filtro-de-nombre] [--sin-criaturas]
// Coloca al jugador con la API de depuración (sin tocar el sim), spawnea criaturas delante y avanza la simulación a pasos fijos.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const [out, map, q, filt] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const noMon = process.argv.includes('--sin-criaturas');
fs.mkdirSync(out, { recursive: true });

// Cada toma: from = posición del jugador, to = punto al que mira (o pitch/yaw), mon = criaturas [kind, distancia delante, desvío lateral], steps = pasos de 50 ms
const R1 = 62, ang = (k) => ((k * 72 + 15) * Math.PI) / 180, ringXY = (k, d = 0) => [(R1 + d) * Math.cos(ang(k)), (R1 + d) * Math.sin(ang(k))];
const [lx, lz] = ringXY(2), [zx, zz] = ringXY(4), [px, pz] = ringXY(0), [sx, sz] = ringXY(3);
const SHOTS = {
  m1: [
    { name: 'spawn', from: [0, 0.9, 4], to: [0, 6, -60], mon: [['astilla', 14, 0], ['astilla', 18, 5], ['prisma', 22, -6], ['geoda', 26, 4]] },
    { name: 'spawn-atras', from: [0, 0.9, 4], to: [-40, 8, 70], mon: [['astilla', 12, 0]] },
    { name: 'centro', from: [0, 0.9, 0], to: [px, 6, pz], mon: [['astilla', 12, 2], ['lente', 20, -5], ['racimo', 16, 6]] },
    { name: 'cielo', from: [0, 0.9, 4], to: [0, 400, 0], pitch: 0.95, mon: [] },
    { name: 'cielo-sol', from: [0, 0.9, 4], to: [-600, 380, -330], mon: [] },
    { name: 'bajo-el-vacio', from: [0, 0.9, 20], to: [0, -60, 80], pitch: -0.5, mon: [] },
    { name: 'flip-base', from: [lx + 10, 10.9, lz + 2], to: [lx, 20, lz], mon: [['astilla', 8, 0], ['prisma', 14, 3]] },
    { name: 'flip-subiendo', from: [lx, 24, lz], to: [lx, 60, lz], steps: 6, mon: [] },
    { name: 'flip-techo', from: [lx, 34.1, lz + 4], to: [lx + 10, 20, lz - 10], steps: 40, mon: [['astilla', 8, 0]] },
    { name: 'cero-g', from: [zx, 6, zz], to: [0, 6, 0], mon: [['astilla', 12, 0], ['lente', 18, 4]] },
    { name: 'cero-g-fuera', from: [zx - 14, 0.9, zz + 6], to: [zx, 6, zz], mon: [['prisma', 9, 3]] },
    { name: 'planetoide', from: [px + 6, 26 + 6.9, pz], to: [px, 26, pz], steps: 40, mon: [['astilla', 6, 2]] },
    { name: 'planetoide-lejos', from: [px - 14, 4.9, pz - 8], to: [px, 26, pz], mon: [] },
    { name: 'lento', from: [14, 3.9, 8], to: [14, 3, -10], mon: [['astilla', 10, 0], ['astilla', 14, 3]] },
    { name: 'lento2', from: [sx + 8, 2.9, sz + 8], to: [sx, 5, sz], mon: [['prisma', 8, 0]] },
    { name: 'portal', from: [0, 0.9, 6], to: [19 * Math.cos(ang(0)), 0.9, 19 * Math.sin(ang(0))], mon: [] },
    { name: 'anillo-isla', from: [ringXY(1)[0] + 5, -5.1, ringXY(1)[1] + 3], to: [0, 0, 0], mon: [['astilla', 10, 2], ['geoda', 18, -3]] },
    { name: 'borde-isla', from: [0, 0.9, 24], to: [0, -10, 62], pitch: -0.15, mon: [['astilla', 10, 0]] },
    { name: 'oleada', from: [0, 0.9, -8], to: [0, 5, 60], mon: [['astilla', 14, 0], ['astilla', 16, 4], ['astilla', 18, -5], ['prisma', 22, 7], ['lente', 26, -8], ['geoda', 20, 10], ['racimo', 15, -3], ['cuarzo', 30, 0]] },
  ],
  m2: [
    { name: 'spawn', from: [0, -84.1, 0], to: [20, -60, 30], mon: [['astilla', 14, 0], ['astilla', 18, 5], ['prisma', 22, -6], ['geoda', 26, 4]] },
    { name: 'spawn-atras', from: [0, -84.1, 0], to: [-30, -70, -40], mon: [['astilla', 12, 0]] },
    { name: 'cielo', from: [0, -84.1, 0], to: [40, -84, 10], pitch: 1.2, mon: [] },
    { name: 'cielo-diag', from: [0, -84.1, 0], to: [40, -80, 10], pitch: 0.7, mon: [] },
    { name: 'centro', from: [0, -45, 0], to: [0, 0, 0], steps: 30, mon: [] },
    { name: 'nucleo', from: [30, -70, 20], to: [0, 0, 0], mon: [['astilla', 12, 2]] },
    { name: 'colina', from: 'hill0', to: 'hillc0', mon: [['astilla', 10, 0], ['prisma', 16, 3]] },
    { name: 'colina2', from: 'hill1', to: 'hillc1', mon: [['astilla', 10, 0]] },
    { name: 'techo', from: [0, 84.1, 0], to: [0, 0, 0], steps: 40, mon: [['astilla', 8, 0]] },
    { name: 'pared', from: [60, -55, 0], to: [75, -20, 20], mon: [['lente', 18, -3], ['racimo', 12, 5]] },
    { name: 'marea-aviso', from: [0, -84.1, 0], to: [20, -60, 30], t: 48, mon: [['astilla', 14, 0], ['prisma', 22, -6]] },
    { name: 'marea', from: [0, -84.1, 0], to: [0, 0, 0], t: 51, steps: 20, mon: [['astilla', 14, 0], ['racimo', 20, -5]] },
    { name: 'marea-flotando', from: [0, -60, 0], to: [40, 30, 40], t: 56, steps: 60, mon: [['astilla', 14, 0]] },
    { name: 'oleada', from: [0, -84.1, 0], to: [30, -60, 40], mon: [['astilla', 14, 0], ['astilla', 16, 4], ['astilla', 18, -5], ['prisma', 22, 7], ['lente', 26, -8], ['geoda', 20, 10], ['racimo', 15, -3], ['cuarzo', 30, 0]] },
  ],
}[map];

const srv = await startServer({ port: 0 }); let b = await launch();
const todo = SHOTS.filter((sh) => !filt || filt.split(',').some((f) => sh.name === f || (f.endsWith('*') && sh.name.startsWith(f.slice(0, -1)))));
for (const sh of todo) {
 for (let intento = 0; intento < 3; intento++) { try {
  const pg = await b.newPage({ viewport: { width: 1000, height: 600 } }); const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/?cap=1&auto=${map}&god=1&seed=3&q=${q}&autoq=0&wave=4&nolock=1`);
  await pg.waitForFunction(() => window.__session && window.__session.game, null, { timeout: 600000, polling: 500 });
  const info = await pg.evaluate(async ({ sh, noMon }) => {
    const st = document.createElement('style'); st.textContent = '#hud,#banner,#sub,#guide{display:none!important}'; document.head.appendChild(st);
    const g = window.__session.game, me = g.players[0], S = (ms) => window.__step(ms);
    for (let i = 0; i < 3; i++) S(50);
    g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; S(50);
    if (sh.t != null) g.time = sh.t;
    let from = sh.from, to = sh.to;
    if (typeof from === 'string') { const h = g.map.solids.filter((s) => s.type === 'sph')[+from.slice(4)]; const n = Math.hypot(h.c.x, h.c.y, h.c.z), dir = { x: h.c.x / n, y: h.c.y / n, z: h.c.z / n }; const a = 0.0; // al pie de la colina, mirándola
      const base = { x: dir.x * 84.1, y: dir.y * 84.1, z: dir.z * 84.1 }; const side = { x: -dir.z, y: 0, z: dir.x }; const sl = Math.hypot(side.x, side.z) || 1;
      from = [base.x + side.x / sl * 20, base.y, base.z + side.z / sl * 20]; const f2 = Math.hypot(from[0], from[1], from[2]); from = from.map((v) => v / f2 * 84.1); to = [h.c.x, h.c.y, h.c.z]; }
    me.pos.x = from[0]; me.pos.y = from[1]; me.pos.z = from[2]; me.vel.x = me.vel.y = me.vel.z = 0;
    const aim = () => {
      const up = me.up || { x: 0, y: 1, z: 0 }, d = { x: to[0] - me.pos.x, y: to[1] - me.pos.y, z: to[2] - me.pos.z }, dl = Math.hypot(d.x, d.y, d.z) || 1;
      const du = (d.x * up.x + d.y * up.y + d.z * up.z) / dl; const h = { x: d.x / dl - up.x * du, y: d.y / dl - up.y * du, z: d.z / dl - up.z * du }; const hl = Math.hypot(h.x, h.y, h.z);
      if (hl > 1e-3) { me.heading.x = h.x / hl; me.heading.y = h.y / hl; me.heading.z = h.z / hl; } me.pitch = sh.pitch != null ? sh.pitch : Math.asin(Math.max(-1, Math.min(1, du)));
      window.__session.look = null;
    };
    for (let i = 0; i < 4; i++) { S(50); me.pos.x = from[0]; me.pos.y = from[1]; me.pos.z = from[2]; me.vel.x = me.vel.y = me.vel.z = 0; }
    aim();
    if (!noMon) for (const [k, d, lat] of sh.mon) {
      const f = me.heading, u = me.up || { x: 0, y: 1, z: 0 }, r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
      const p = { x: me.pos.x + f.x * d + r.x * lat, y: me.pos.y + f.y * d + r.y * lat, z: me.pos.z + f.z * d + r.z * lat };
      // en M2 se pega al suelo esférico; en M1 se queda al nivel del jugador
      if (g.map.id === 'm2') { const l = Math.hypot(p.x, p.y, p.z); const R = Math.hypot(me.pos.x, me.pos.y, me.pos.z); p.x *= R / l; p.y *= R / l; p.z *= R / l; }
      g.spawnMonster(k, p);
    }
    const n = sh.steps || 14;
    for (let i = 0; i < n; i++) { if (sh.steps && sh.steps > 30 && i < sh.steps - 8) { /* deja evolucionar la física */ } S(50); if (!sh.free) { if (i < n - 6 && sh.pin !== false && !sh.steps) { me.pos.x = from[0]; me.pos.y = from[1]; me.pos.z = from[2]; me.vel.x = me.vel.y = me.vel.z = 0; } aim(); } }
    S(50);
    const gl = window.__renderer.gl, inf = gl.info;
    return { calls: inf.render.calls, tris: inf.render.triangles, geos: inf.memory.geometries, progs: inf.programs ? inf.programs.length : 0, pos: [me.pos.x, me.pos.y, me.pos.z].map((v) => +v.toFixed(1)), n: g.monsters.length };
  }, { sh, noMon });
  await pg.screenshot({ path: `${out}/${map}-${q}-${sh.name}.jpg`, type: 'jpeg', quality: 85, timeout: 300000 });
  console.log(map, q, sh.name, JSON.stringify(info), errs.slice(0, 4)); await pg.close(); break;
 } catch (e) { console.log('REINTENTO', sh.name, String(e.message).split('\n')[0]); try { await b.close(); } catch {} b = await launch(); } }
}
await b.close(); await srv.close();
