// ART GATE v2 de los mapas 1, 2 y 3 — capturas EN JUEGO con HUD y criaturas, con medición gl.info.
// Uso: node tools/mapas-v2.mjs <carpeta> <m1|m2|m3> <low|high> [filtro,filtro] [--movil]
//  tomas: spawn (aparición + criaturas), centro, jefe (oleada 7, apunta al jefe), oleada (muchas criaturas)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [out, map, q, filt] = args; const movil = process.argv.includes('--movil');
fs.mkdirSync(out, { recursive: true });
const MON = [['astilla', 14, 0], ['astilla', 18, 5], ['prisma', 22, -6], ['geoda', 26, 4], ['lente', 20, -9], ['racimo', 16, 7]];
const SHOTS = {
  m1: [{ name: 'spawn', mon: MON }, { name: 'centro', from: [0, 0.9, 0], yawTo: [62 * Math.cos(0.26), 0.9, 62 * Math.sin(0.26)], mon: MON }, { name: 'jefe', wave: 7, boss: true }, { name: 'plaza', from: [10, 0.9, 30], yawTo: [-30, 6, -10], mon: MON, wave: 4 }],
  m2: [{ name: 'spawn', mon: MON }, { name: 'centro', from: [60, -55, 0], yawTo: [75, -20, 20], mon: MON }, { name: 'jefe', wave: 7, boss: true }, { name: 'colina', from: 'hill0', yawTo: 'hillc0', mon: MON }],
  m3: [{ name: 'spawn', mon: MON }, { name: 'centro', from: [0, 0.9, 0], yawTo: [0, 0.9, -40], mon: MON }, { name: 'jefe', wave: 7, boss: true, from: [0, 0.9, 8] }, { name: 'pasillo', from: [-60, 0.9, 60], yawTo: [-60, 0.9, -40], mon: MON }],
}[map];
const srv = await startServer({ port: 0 }); let b = await launch();
const todo = SHOTS.filter((sh) => !filt || filt.split(',').includes(sh.name));
const vp = movil ? { width: 844, height: 390 } : { width: 1000, height: 600 };
for (const sh of todo) {
 for (let intento = 0; intento < 3; intento++) { try {
  const ctx = await b.newContext({ viewport: vp, hasTouch: movil, isMobile: movil }); const pg = await ctx.newPage(); const errs = [];
  pg.on('console', (m) => { if (['error'].includes(m.type()) && !/404/.test(m.text())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto(`http://localhost:${srv.port}/?cap=1&auto=${map}&god=1&seed=3&q=${q}&autoq=0&wave=${sh.wave || 4}&nolock=1&skipintro=1`);
  await pg.waitForFunction(() => window.__session && window.__session.game, null, { timeout: 600000, polling: 500 });
  const info = await pg.evaluate(async ({ sh }) => {
    const g = window.__session.game, me = g.players[0], S = (ms) => window.__step(ms);
    for (let i = 0; i < 3; i++) S(50);
    if (!sh.boss) { g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; S(50); }
    let from = sh.from, to = sh.yawTo;
    if (from === 'hill0') { const h = g.map.solids.filter((s) => s.type === 'sph')[0]; const n = Math.hypot(h.c.x, h.c.y, h.c.z), dir = { x: h.c.x / n, y: h.c.y / n, z: h.c.z / n }; const base = { x: dir.x * 84.1, y: dir.y * 84.1, z: dir.z * 84.1 }; const sl = Math.hypot(dir.z, dir.x) || 1; from = [base.x - dir.z / sl * 20, base.y, base.z + dir.x / sl * 20]; const f2 = Math.hypot(...from); from = from.map((v) => v / f2 * 84.1); to = [h.c.x, h.c.y, h.c.z]; }
    const pin = () => { if (from) { me.pos.x = from[0]; me.pos.y = from[1]; me.pos.z = from[2]; me.vel.x = me.vel.y = me.vel.z = 0; } };
    const aim = () => {
      let tg = to; if (sh.boss) { const bm = g.monsters.find((m) => !m.dead && m.def.boss); if (bm) tg = [bm.pos.x, bm.pos.y, bm.pos.z]; }
      if (!tg) return;
      const up = me.up || { x: 0, y: 1, z: 0 }, d = { x: tg[0] - me.pos.x, y: tg[1] - me.pos.y, z: tg[2] - me.pos.z }, dl = Math.hypot(d.x, d.y, d.z) || 1;
      const du = (d.x * up.x + d.y * up.y + d.z * up.z) / dl; const h = { x: d.x / dl - up.x * du, y: d.y / dl - up.y * du, z: d.z / dl - up.z * du }; const hl = Math.hypot(h.x, h.y, h.z);
      if (hl > 1e-3) { me.heading.x = h.x / hl; me.heading.y = h.y / hl; me.heading.z = h.z / hl; } me.pitch = Math.asin(Math.max(-1, Math.min(1, du))) * (sh.boss ? 0.8 : 1); window.__session.look = null;
    };
    pin(); for (let i = 0; i < 4; i++) { S(50); pin(); } aim();
    if (sh.mon) for (const [k, d, lat] of sh.mon) {
      const f = me.heading, u = me.up || { x: 0, y: 1, z: 0 }, r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
      const p = { x: me.pos.x + f.x * d + r.x * lat, y: me.pos.y + f.y * d + r.y * lat, z: me.pos.z + f.z * d + r.z * lat };
      if (g.map.id === 'm2') { const l = Math.hypot(p.x, p.y, p.z), R = Math.hypot(me.pos.x, me.pos.y, me.pos.z); p.x *= R / l; p.y *= R / l; p.z *= R / l; }
      const m = g.spawnMonster(k, p); if (m) m.cd = 1e9;
    }
    const n = sh.boss ? 90 : 14;
    for (let i = 0; i < n; i++) { S(50); if (sh.from) pin(); aim(); }
    S(50);
    const inf = window.__renderer.gl.info;
    return { calls: inf.render.calls, tris: inf.render.triangles, progs: inf.programs ? inf.programs.length : 0, n: g.monsters.length };
  }, { sh });
  await pg.screenshot({ path: `${out}/${map}-${q}${movil ? '-movil' : ''}-${sh.name}.jpg`, type: 'jpeg', quality: 88, timeout: 300000 });
  console.log(map, q, sh.name, JSON.stringify(info), errs.slice(0, 3)); await ctx.close(); break;
 } catch (e) { console.log('REINTENTO', sh.name, String(e.message).split('\n')[0]); try { await b.close(); } catch {} b = await launch(); } }
}
await b.close(); await srv.close();
