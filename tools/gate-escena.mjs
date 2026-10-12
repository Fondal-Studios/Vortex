// Capturas EN ESCENA REAL (ART GATE criaturas). Uso:
//   node tools/gate-escena.mjs <carpeta> <mapa m1|m2> <script.json|inline>   donde cada toma = {name, kind, dist, h, wait, pre:"js", q}
// Cada toma: spawnea `kind` frente al jugador (jefes: en su ancla) y avanza la simulación `wait` s.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const out = process.argv[2], map = process.argv[3], shots = JSON.parse(process.argv[4].startsWith('[') ? process.argv[4] : fs.readFileSync(process.argv[4], 'utf8'));
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch();
for (const sh of shots) {
  const pg = await b.newPage({ viewport: { width: sh.w || 1000, height: sh.h2 || 600 } }); const errs = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  const url = `http://localhost:${srv.port}/?cap=1&auto=${map}&god=1&seed=${sh.seed || 3}&q=${sh.q || 'low'}&autoq=0&wave=${sh.wave || 1}`;
  for (let tr = 0; tr < 4; tr++) { await pg.goto(url); try { await pg.waitForFunction(() => window.__session && window.__session.game, null, { timeout: 120000, polling: 500 }); break; } catch (e) { if (tr === 3) throw e; } }
  const info = await pg.evaluate(async (sh) => {
    const st = document.createElement('style'); st.textContent = '#hud,#banner,#sub,#guide{display:none!important}'; document.head.appendChild(st);
    window.__session.headless = true; const g = window.__session.game, me = g.players[0], S = (ms) => window.__step(ms);
    for (let i = 0; i < 3; i++) S(50);
    g.phaseT = 1e9; g.queue = []; const olds = g.monsters.slice();
    const boss = sh.kind === 'coloso' || sh.kind === 'madre';
    let mon = null;
    const add = (v, a, k) => ({ x: v.x + a.x * k, y: v.y + a.y * k, z: v.z + a.z * k });
    const spawnAt = (kind) => {
      let pos;
      if (boss) { pos = null; } else { const f = me.heading, u = me.up; pos = { x: me.pos.x + f.x * sh.dist + u.x * (sh.up || 0), y: me.pos.y + f.y * sh.dist + u.y * (sh.up || 0), z: me.pos.z + f.z * sh.dist + u.z * (sh.up || 0) }; }
      return g.spawnMonster(kind, pos || { x: g.map.bossAnchor.x, y: g.map.bossAnchor.y, z: g.map.bossAnchor.z });
    };
    mon = spawnAt(sh.kind); for (const m of olds) m.dead = true;
    if (boss && mon) { const dx = mon.pos.x - me.pos.x, dz = mon.pos.z - me.pos.z, dy = mon.pos.y - me.pos.y, h = Math.hypot(dx, dz); me.heading.x = dx / h; me.heading.y = 0; me.heading.z = dz / h; me.pitch = Math.atan2(dy + (sh.aimdy || 0), h); }
    if (sh.pre) new Function('g', 'mon', 'me', sh.pre)(g, mon, me);
    const n = Math.round((sh.wait || 3) * 20);
    for (let i = 0; i < n; i++) { if (boss && mon) { me.vel.x = me.vel.y = me.vel.z = 0; const dx = mon.pos.x - me.pos.x, dz = mon.pos.z - me.pos.z, dy = mon.pos.y - me.pos.y, h = Math.hypot(dx, dz); me.heading.x = dx / h; me.heading.z = dz / h; me.pitch = Math.atan2(dy + (sh.aimdy || 0), h); } if (sh.keep) new Function('g', 'mon', 'me', sh.keep)(g, mon, me, i); if (mon && sh.hold && !mon.dead) { /* congela posición */ } S(50); }
    if (sh.post) new Function('g', 'mon', 'me', sh.post)(g, mon, me);
    S(50);
    return { gt: +g.time.toFixed(2), gs: g.state, tk: g.tick, intro: !!window.__session.intro, paused: !!window.__session.paused, t: mon && +mon.t.toFixed(1), alive: g.alivePlayers().length, mp: [me.pos.x, me.pos.y, me.pos.z].map((v) => +v.toFixed(0)), s: mon && mon.state, mech: mon && mon.mech, vis: mon && mon.vis, ray: mon && !!mon.ray, open: mon && mon.open, stg: mon && mon.stagger, hp: mon && Math.round(mon.hp), n: g.monsters.length, pos: mon && [mon.pos.x, mon.pos.y, mon.pos.z].map((v) => +v.toFixed(1)), calls: window.__renderer.gl.info.render.calls, tris: window.__renderer.gl.info.render.triangles };
  }, sh);
  await pg.screenshot({ path: `${out}/${sh.name}.jpg`, type: 'jpeg', quality: 85, timeout: 180000 });
  console.log(sh.name, JSON.stringify(info), errs.slice(0, 4)); await pg.close();
}
await b.close(); await srv.close();
