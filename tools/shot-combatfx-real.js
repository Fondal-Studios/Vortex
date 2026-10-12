// Capturas EN TIEMPO REAL (sin cámara lenta) de los disparos: node tools/shot-combatfx-real.js <ids|todas> [low|high] [salida] [ancho] [alto] [esperaMs]
// Mantiene el clic apretado contra criaturas y saca la foto justo cuando hay un disparo reciente (celular horizontal = 844x390).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const arg = process.argv[2] || '0,2,8,15'; const q = process.argv[3] || 'low'; const out = process.argv[4] || 'shots/gate/combatfx'; const W = +process.argv[5] || 844, H = +process.argv[6] || 390; const wait = +process.argv[7] || 700;
const IDS = arg === 'todas' ? [...Array(25).keys()] : arg.split(',').filter((x) => /^\d+$/.test(x)).map(Number); const SC = arg.split(',').filter((x) => !/^\d+$/.test(x));
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const pg = await b.newPage({ viewport: { width: W, height: H } }); pg.setDefaultTimeout(180000);
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); if (m.text().startsWith('FXSTAT')) console.log(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`${base}/?auto=m1&god=1&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1`); await pg.waitForTimeout(3500);
const prep = (id, kinds, near) => pg.evaluate(async ({ id, kinds, near }) => {
  const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true;
  p.weapon = id; p.ammo[id] = 999; p.hp = 100;
  await new Promise((r) => setTimeout(r, 200));
  const f = (d, s = 0) => ({ x: p.pos.x + p.heading.x * d - p.heading.z * s, y: p.pos.y + 1, z: p.pos.z + p.heading.z * d + p.heading.x * s });
  const L = near ? [[9, 0], [12, 3], [12, -3], [16, 0]] : [[14, 0], [18, 4], [18, -4], [24, 0]];
  kinds.forEach((k, i) => { const [d, s] = L[i % L.length]; const m = g.spawnMonster(k, f(d, s)); m.open = true; m.cd = 1e9; m.cd2 = 1e9; m.speedMul = 0; m.hp = m.maxhp = 1e5; });
  window.__fire = true;
}, { id, kinds, near });
for (const id of IDS) {
  await prep(id, ['geoda', 'lente', 'prisma', 'cuarzo'], false);
  await pg.mouse.down(); await pg.waitForTimeout(wait);
  // espera un disparo muy reciente (<80 ms de tiempo de efectos) para que la foto muestre el momento del disparo
  await pg.evaluate(() => new Promise((res) => { const C = window.__api.renderer.fx.combat; let n = 0; const iv = setInterval(() => { n++; const s = C.shots[C.shots.length - 1]; if ((s && C.t - s.t < 0.06) || n > 400) { clearInterval(iv); res(); } }, 8); }));
  await pg.screenshot({ path: `${out}/arma-${String(id).padStart(2, '0')}-${q}.jpg`, type: 'jpeg', quality: 82 }); await pg.mouse.up(); await pg.waitForTimeout(250);
  const st = await pg.evaluate(() => { const f = window.__api.renderer.fx; return { add: f.add.live, smoke: f.smoke.live, segs: f.strips.n, fps: Math.round(1 / Math.max(1e-3, window.__api.renderer.fx.combat.dt)) }; });
  console.log('FXSTAT arma', id, JSON.stringify(st));
}
console.log(errors.length ? errors.slice(0, 5).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
