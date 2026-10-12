// Prueba de los efectos de combate: node tools/combatfx-test.js [low|high] [ids]
// Dispara cada arma 1,2 s sostenido y mide: partículas vivas máximas (Baja ≤ 200), cintas vivas, tiempo de CPU por disparo (ms),
// patada de cámara / FOV, y que "reducir movimiento" (localStorage cristal.reduceMotion=1) apague el FOV y la sacudida.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const q = process.argv[2] || 'low'; const HOLD = q === 'low' ? 1400 : 6000; // Alta en WebGL por software es lenta: más tiempo para que haya disparos
const IDS = (process.argv[3] || [...Array(25).keys()].join(',')).split(',').map(Number);
const srv = await startServer({ port: 0 }); const b = await launch(); const errors = []; let bad = 0, tot = 0;
const pg = await b.newPage({ viewport: { width: 844, height: 390 } }); pg.setDefaultTimeout(180000);
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&god=1&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(3500);
const setup = (id) => pg.evaluate(async (id) => {
  const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; p.weapon = id; p.ammo[id] = 9999; p.hp = 100;
  await new Promise((r) => setTimeout(r, 150));
  const f = (d, s = 0) => ({ x: p.pos.x + p.heading.x * d - p.heading.z * s, y: p.pos.y + 1, z: p.pos.z + p.heading.z * d + p.heading.x * s });
  for (const [d, s] of [[14, 0], [18, 4], [18, -4]]) { const m = g.spawnMonster('geoda', f(d, s)); m.open = true; m.cd = 1e9; m.hp = m.maxhp = 1e6; }
  const C = window.__api.renderer.fx.combat, P = Object.getPrototypeOf(C); if (!C.__w) { C.__w = true; C.__ms = 0; C.__n = 0; C.__max = { p: 0, s: 0, seg: 0, fov: 0, kick: 0 }; const o = P.shot; C.shot = function (...a) { const t = performance.now(); const r = o.apply(this, a); C.__ms += performance.now() - t; C.__n++; return r; }; const u = P.update; C.update = function (dt) { u.call(this, dt); const fx = this.fx, M = C.__max; M.p = Math.max(M.p, fx.add.live + fx.smoke.live); M.seg = Math.max(M.seg, fx.strips.n); M.fov = Math.max(M.fov, this.K.fov); M.kick = Math.max(M.kick, this.K.p); }; }
  C.__ms = 0; C.__n = 0; C.__max = { p: 0, s: 0, seg: 0, fov: 0, kick: 0 }; C.K.fov = 0; C.K.p = 0; C.K.y = 0; C.K.r = 0; C.K.sh = 0;
}, id);
console.log(`calidad ${q}`); console.log('arma'.padEnd(5), 'tiros'.padEnd(6), 'ms/tiro'.padEnd(8), 'partículas'.padEnd(11), 'cintas'.padEnd(7), 'kick(°)'.padEnd(8), 'fov(°)');
for (const id of IDS) {
  await setup(id); await pg.waitForTimeout(1200); await pg.mouse.down(); await pg.waitForTimeout(HOLD); await pg.mouse.up();
  const r = await pg.evaluate(() => { const C = window.__api.renderer.fx.combat; return { n: C.__n, ms: C.__ms / Math.max(1, C.__n), ...C.__max }; });
  const okP = q !== 'low' || r.p <= 200; tot += r.n; if (!okP) bad++; // en Alta con WebGL por software casi no hay cuadros: sin tiros no se falla
  console.log(String(id).padEnd(5), String(r.n).padEnd(6), r.ms.toFixed(2).padEnd(8), String(r.p).padEnd(11), String(r.seg).padEnd(7), (r.kick * 180 / Math.PI).toFixed(2).padEnd(8), r.fov.toFixed(2), okP ? '' : ' <-- PASA EL PRESUPUESTO');
}
if (q === 'low' && tot < 15) { console.log('Muy pocos disparos medidos:', tot); bad++; }
// reducir movimiento: sin golpe de FOV y con patada mínima
await pg.evaluate(() => { try { localStorage.setItem('cristal.reduceMotion', '1'); } catch { /* sin almacenamiento */ } window.__api.renderer.fx.combat._rmT = null; });
await setup(14); await pg.waitForTimeout(800); await pg.mouse.down(); await pg.waitForTimeout(HOLD); await pg.mouse.up();
const rm = await pg.evaluate(() => { const C = window.__api.renderer.fx.combat; return { fov: C.__max.fov, kick: C.__max.kick * 180 / Math.PI, reduced: C.reduced }; });
console.log('reducir movimiento (Eclipse):', JSON.stringify(rm), rm.reduced && rm.fov === 0 ? 'OK' : 'FALLÓ'); if (!(rm.reduced && rm.fov === 0)) bad++;
await pg.evaluate(() => { try { localStorage.removeItem('cristal.reduceMotion'); } catch { /* nada */ } });
console.log(errors.length ? 'ERRORES: ' + errors.slice(0, 4).join(' | ') : 'sin errores de consola'); if (errors.length) bad++;
await b.close(); await srv.close(); console.log(bad ? 'FALLÓ' : 'OK'); process.exit(bad ? 1 : 0);
