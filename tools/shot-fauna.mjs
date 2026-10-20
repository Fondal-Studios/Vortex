// Capturas de la FAUNA dentro del juego real (Chromium por software, como tools/shot-nieblas.mjs). Uso:
//   node tools/shot-fauna.mjs [m1|…|m6|todas] [carpeta=shots/fauna] [calidad=low] [modo=bichos|forma|rastro]
//   bichos → las 3 especies de la arena + una rara delante de la cámara, de cerca y a media distancia (dormidas, alertas y huyendo)
//   forma  → el Huésped en 3.ª persona con una forma activa (hielo, brasa, eléctrica…) y el chip de la forma
//   rastro → el Huésped corriendo con forma de hielo (escarcha) / brasa (fuego)
// Imprime las llamadas de dibujo y triángulos de la fauna (renderer.info).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const args = process.argv.slice(2), WHICH = args[0] || 'm1', OUT = args[1] || 'shots/fauna', Q = args[2] || 'low', MODO = args[3] || 'bichos';
const maps = WHICH === 'todas' ? ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] : [WHICH];
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
for (const MAP of maps) {
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`[${MAP}] ${m.text().slice(0, 240)}`); });
  pg.on('pageerror', (e) => errors.push(`[${MAP}] PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=${MAP}&bot=1&god=1&wave=2&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1&cam=third`, { timeout: 240000 });
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 180000 });
  await pg.waitForTimeout(3500);
  await pg.evaluate(async (modo) => {
    const F = await import('/src/sim/fauna.js'), D = await import('/src/sim/fauna-data.js'), s = window.__api.session, g = s.game, p = g.players[0];
    s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
    g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; g.phase = 'intermission'; g.wave = 1; g.fa.cd = 1e9; g.fa.list = [];
    const h = p.heading, rt = { x: h.y * p.up.z - h.z * p.up.y, y: h.z * p.up.x - h.x * p.up.z, z: h.x * p.up.y - h.y * p.up.x };
    const X = (f, side) => ({ x: p.pos.x + h.x * f + rt.x * side, y: p.pos.y + h.y * f + rt.y * side, z: p.pos.z + h.z * f + rt.z * side });
    if (modo === 'bichos') {
      const ids = D.especiesDe(g.mapId).concat([D.RARAS[0]]);
      ids.forEach((id, i) => F.faunaSpawn(g, id, X(4.5 + (i % 2) * 2, (i - 1.5) * 2.4), i === 3 ? 'pastando' : 'dormida'));
    } else if (modo === 'forma') { const f = D.especiesDe(g.mapId)[0]; F.darForma(g, p, f); }
    else { F.darForma(g, p, 'lagartija_hielo'); p.input.mz = 1; }
    const r = window.__api.renderer, orig = r.updateCamera.bind(r), c = { x: p.pos.x - h.x * (modo === 'bichos' ? -2.2 : 5) + p.up.x * (modo === 'bichos' ? 1.5 : 3), y: p.pos.y - h.y * (modo === 'bichos' ? -2.2 : 5) + p.up.y * (modo === 'bichos' ? 1.5 : 3), z: p.pos.z - h.z * (modo === 'bichos' ? -2.2 : 5) + p.up.z * (modo === 'bichos' ? 1.5 : 3), yaw: Math.atan2(h.x, -h.z), pitch: modo === 'bichos' ? -0.12 : -0.14 };
    r.updateCamera = (me, dt, look) => { orig(me, dt, look); r.camera.position.set(c.x, c.y, c.z); r.camera.rotation.order = 'YXZ'; r.camera.rotation.set(c.pitch, -c.yaw, 0); r.eye = r.camera.position.clone(); };
    window.__avanza = (seg) => { for (let i = 0; i < seg * 60; i++) g.step(1 / 60); };
    window.__F = F; window.__D = D; window.__avanza(1);
  }, MODO);
  const pasos = MODO === 'bichos' ? [['quietos', 0], ['alerta', 1]] : MODO === 'forma' ? [['forma', 2]] : [['rastro', 3]];
  for (const [nombre, paso] of pasos) {
    if (nombre === 'alerta') await pg.evaluate(() => { const g = window.__api.session.game; for (const f of g.fa.list) { f.st = f.sp.peligrosa ? 'acechando' : f.st === 'dormida' ? 'alerta' : 'huyendo'; f.stT = 0; } window.__avanza(0.4); });
    if (paso === 2) await pg.evaluate(() => window.__avanza(2));
    if (paso === 3) await pg.evaluate(() => { const g = window.__api.session.game; window.__api.session.bot = () => ({ mx: 0, mz: 1, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 }); g.players[0].input.mz = 1; window.__avanza(3); });
    await pg.waitForTimeout(3500);
    const info = await pg.evaluate(() => { const r = window.__api.renderer, i = r.gl.info.render, f = r.ffx; return { calls: i.calls, tris: i.triangles, bichos: f ? f.mesh.count : 0 }; });
    await pg.screenshot({ path: `${OUT}/${MAP}-${MODO}-${nombre}.png`, timeout: 240000 });
    console.log(`${MAP} ${MODO} ${nombre}: llamadas ${info.calls} triángulos ${info.tris} bichos dibujados ${info.bichos}`);
  }
  await pg.close();
}
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].slice(0, 10).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
