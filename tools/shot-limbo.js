// Capturas reales de los mapas del limbo (5: Plaza de los Ecos · 6: Osario sin Techo) dentro del juego, con Chromium por
// software, y medición de draw calls / triángulos con renderer.info (modelo: tools/shot-map4.js).
// Uso: node tools/shot-limbo.js [m5|m6] [carpeta=shots/limbo] [calidad=low] [--solo=vista1,vista2] [--sin-criaturas] [--hud]
// Por cada vista imprime dos medidas: «escena» (todo lo que se dibuja ese cuadro: mapa + criaturas + armas + efectos +
// post-proceso) y «mapa» (sólo el entorno: se ocultan criaturas, armas y efectos un cuadro para medir).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import { M5 } from '../src/sim/map5.js';
import { M6 } from '../src/sim/map6.js';
const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
const MAP = pos[0] || 'm5', OUT = pos[1] || 'shots/limbo', Q = pos[2] || 'low';
const only = (args.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);
const quiet = args.includes('--sin-criaturas'), withHud = args.includes('--hud');
fs.mkdirSync(OUT, { recursive: true });
const TW = M5.TORRE, F = M5.FUENTE;
const VIEWS = {
  m5: {
    calle: { from: [0, 0, 52], to: [0, 6, 0] },                         // la aparición: la calle mira a la plaza
    boca: { from: [0, 0, 31], to: [0, 4, -20] },
    fuente: { from: [-12, 0, 10], to: [F.x, 4, F.z] },
    reloj: { from: [6, 0, -4], to: [TW.x0, 8, (TW.z0 + TW.z1) / 2] },
    tyn: { from: [8, 0, 18], to: [0, 30, -60] },
    soportales: { from: [-31, 0, 20], to: [-31, 2, -20] },
    plaza: { from: [24, 0, 24], to: [-10, 3, -16] },
    ojo: { from: [3, 0, -2], yaw: 160, pitch: 28 },
    cielo: { from: [0, 0, 18], yaw: 10, pitch: 62 },
  },
  m6: {
    entrada: { from: [0, 0, 37], to: [0, 5, 0] },
    crucero: { from: [-6, 0, 14], to: [0, 6, -4] },
    arana: { from: [5, 0, 7], to: [0, 14, 0] },
    brazo: { from: [-12, 0, 0], to: [-40, 3, 0] },
    brazoeste: { from: [12, 0, -3], to: [40, 3, 2] },
    altar: { from: [0, 0, -14], to: [0, 2, -46] },
    piramide: { from: [-3, 0, 2], to: [-9.5, 2, -8.5] },
    nave: { from: [11.5, 0, 38], to: [-4, 4, -10] },
    cielo: { from: [0, 0, 20], yaw: 0, pitch: 60 },
  },
}[MAP];
void M6;
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${Q}] ${m.text().slice(0, 500)}`); });
pg.on('pageerror', (e) => errors.push(`[${Q}] PAGEERR ${e.message}`));
await pg.goto(`${base}/?auto=${MAP}&bot=1&god=1&wave=2&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1`);
await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 60000 });
await pg.waitForTimeout(5000);
await pg.evaluate(([quiet, withHud]) => {
  const s = window.__api.session, g = s.game;
  if (!withHud) { const st = document.createElement('style'); st.textContent = '#hud, #cards, #objective, #banner, #pings, #sub{display:none !important}'; document.head.appendChild(st); }
  s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
  if (quiet) { g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; }
}, [quiet, withHud]);
await pg.evaluate(() => {
  const r = window.__api.renderer, orig = r.updateCamera.bind(r);
  r.updateCamera = (me, dt, look) => { orig(me, dt, look); const c = window.__shotCam; if (c) { r.camera.position.set(c.x, c.y, c.z); r.camera.rotation.order = 'YXZ'; r.camera.rotation.set(c.pitch, -c.yaw, 0); r.eye = r.camera.position.clone(); } };
});
const results = {};
for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  const [x, y, z] = v.from; let yaw = v.yaw ?? 0, pitch = v.pitch ?? 0;
  if (v.to) { const dx = v.to[0] - x, dz = v.to[2] - z, dy = v.to[1] - (y + 1.5); yaw = Math.atan2(dx, -dz) * 180 / Math.PI; if (v.pitch === undefined) pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI; }
  await pg.evaluate(([x, y, z, yaw, pitch]) => {
    const g = window.__api.session.game, p = g.players[0], r = Math.PI / 180;
    p.pos = { x, y: y + 0.9, z }; p.vel = { x: 0, y: 0, z: 0 }; p.up = { x: 0, y: 1, z: 0 };
    p.heading = { x: Math.sin(yaw * r), y: 0, z: -Math.cos(yaw * r) }; p.pitch = pitch * r; p.hp = 100;
    window.__shotCam = { x, y: y + 1.5, z, yaw: yaw * r, pitch: pitch * r };
  }, [x, y, z, yaw, pitch]);
  await pg.evaluate(() => new Promise((res) => { const r = window.__api.renderer, t0 = r.t; const iv = setInterval(() => { if (r.t - t0 > 0.6) { clearInterval(iv); res(); } }, 100); }));
  await pg.waitForTimeout(1500);
  const info = await pg.evaluate(() => { const i = window.__api.renderer.gl.info; return { calls: i.render.calls, tris: i.render.triangles }; });
  try { await pg.screenshot({ path: `${OUT}/${MAP}-${Q}-${name}.jpg`, type: 'jpeg', quality: 84, timeout: 150000 }); } catch (e) { errors.push(`captura ${name}: ${e.message.split('\n')[0]}`); continue; }
  // sólo el mapa: ocultar todo lo que no es mapRoot durante un cuadro
  const env = await pg.evaluate(() => new Promise((res) => {
    const r = window.__api.renderer, hidden = [];
    for (const c of r.scene.children) if (c !== r.mapRoot && !c.isLight && !c.isCamera && c.visible) { c.visible = false; hidden.push(c); }
    for (const c of r.camera.children) if (c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
    const t0 = r.t; const iv = setInterval(() => { if (r.t - t0 > 0.15) { clearInterval(iv); const i = r.gl.info; const out = { calls: i.render.calls, tris: i.render.triangles }; hidden.forEach((h) => { h.visible = true; }); res(out); } }, 30);
  }));
  results[name] = { escena: info, mapa: env }; console.log(Q, name, 'escena', JSON.stringify(info), 'mapa', JSON.stringify(env));
}
const mx = (k, w) => Math.max(...Object.values(results).map((r) => r[w][k]));
console.log(`MÁXIMO ${MAP} (${Q}) — escena: ${mx('calls', 'escena')} llamadas, ${mx('tris', 'escena')} triángulos · sólo mapa: ${mx('calls', 'mapa')} llamadas, ${mx('tris', 'mapa')} triángulos (incluye post-proceso)`);
console.log(errors.length ? 'AVISOS/ERRORES:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'sin errores de consola');
await b.close(); srv.close && srv.close(); process.exit(0);
