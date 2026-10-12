// Capturas EN TIEMPO REAL (sin cámara lenta) de los disparos: node tools/shot-combatfx-real.js <ids|todas> [low|high] [salida] [ancho] [alto] [esperaMs]
// Mantiene el clic apretado contra criaturas y saca la foto justo cuando hay un disparo reciente (celular horizontal = 844x390).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const arg = process.argv[2] || '0,2,8,15'; const q = process.argv[3] || 'low'; const out = process.argv[4] || 'shots/gate/combatfx'; const W = +process.argv[5] || 844, H = +process.argv[6] || 390; const wait = +process.argv[7] || 700; const AFTER = process.argv[8] != null ? +process.argv[8] : 0.07; // segundos de efectos tras el disparo en que se congela la foto
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
  await pg.waitForTimeout(1500); await pg.evaluate(() => { const v = window.__api.renderer.vm; v.low = 0; }); await pg.waitForTimeout(300); // que el arma termine de subir
  await pg.mouse.down(); await pg.waitForTimeout(wait);
  // congela los efectos (no el juego) AFTER segundos después de un disparo NUEVO: la foto muestra ese instante exacto
  await pg.evaluate((after) => new Promise((res) => { const fx = window.__api.renderer.fx, C = fx.combat, P = Object.getPrototypeOf(C); if (!fx.__orig) { fx.__orig = fx.update.bind(fx); fx.update = (dt) => { if (!fx.__frozen) fx.__orig(dt); }; }
    fx.__frozen = false; delete C.frame; delete C.event; C.__t0 = null; C.shot = function (...a) { C.__t0 = C.t; return P.shot.apply(this, a); }; let n = 0;
    const iv = setInterval(() => { n++; if ((C.__t0 != null && C.t - C.__t0 >= after) || n > 900) { fx.__frozen = true; C.frame = () => {}; C.event = () => {}; C.shot = () => {}; clearInterval(iv); res(); } }, 3); }), AFTER);
  await pg.screenshot({ path: `${out}/arma-${String(id).padStart(2, '0')}-${q}.jpg`, type: 'jpeg', quality: 82 }); await pg.mouse.up(); await pg.evaluate(() => { const fx = window.__api.renderer.fx, C = fx.combat; fx.__frozen = false; delete C.frame; delete C.event; delete C.shot; }); await pg.waitForTimeout(250);
  const st = await pg.evaluate(() => { const f = window.__api.renderer.fx; return { add: f.add.live, smoke: f.smoke.live, segs: f.strips.n, fps: Math.round(1 / Math.max(1e-3, window.__api.renderer.fx.combat.dt)) }; });
  console.log('FXSTAT arma', id, JSON.stringify(st));
}
console.log(errors.length ? errors.slice(0, 5).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
