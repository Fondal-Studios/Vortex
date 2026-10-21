// Capturas de las telegrafías y la barra de los jefes: node tools/shot-jefes.mjs [mapa] [ataque,ataque,…] [carpeta]
// Ej.: node tools/shot-jefes.mjs m5 campanadas,nova,impacto shots/jefes
// Fuerza cada ataque con mecForzar (src/sim/jefe-mec.js), avanza la simulación ~1,2 s y fotografía.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const mapa = process.argv[2] || 'm1', ataques = (process.argv[3] || 'zonas,nova,barrido,carga,descenso').split(','), out = process.argv[4] || 'shots/jefes';
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }), browser = await launch();
const pg = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await pg.goto(`http://localhost:${srv.port}/?auto=${mapa}&wave=7&god=1&seed=3&q=low&autoq=0&nolock=1&skipintro=1`, { timeout: 180000 });
await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game && window.__api.session.game.boss', null, { timeout: 120000 });
await pg.evaluate(() => { document.querySelectorAll('button').forEach((b) => { if (/Entendido/.test(b.textContent)) b.click(); }); });
for (const ataque of ataques) {
  await pg.evaluate(async (a) => {
    const g = window.__api.session.game, b = g.boss, M = await import('/src/sim/jefe-mec.js'), p = g.players[0];
    b.mec.act = null; b.mec.bajo = 0; b.mec.refl = 0; b.mec.spin = 0; b.mec.t = 30; b.mec.cd = 999;
    window.__api.renderer.jfx.cine = null; document.getElementById('jfcine').classList.remove('on');
    // mirar hacia el centro de la arena (el suelo bajo el jefe) para ver las marcas
    const to = { x: g.map.bossAnchor.x - p.pos.x, z: g.map.bossAnchor.z - p.pos.z }, l = Math.hypot(to.x, to.z) || 1; p.heading = { x: to.x / l, y: 0, z: to.z / l }; p.pitch = -0.35;
    if (a === 'descenso') { M.mecForzar(g, b, 'descenso'); for (let i = 0; i < 150; i++) g.step(1 / 60); } else { M.mecForzar(g, b, a); for (let i = 0; i < 75; i++) g.step(1 / 60); }
    window.__step(16); window.__step(16);
  }, ataque);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${out}/${mapa}-${ataque}.png` });
  console.log('captura', `${out}/${mapa}-${ataque}.png`);
}
if (errs.length) console.log('errores de consola:', errs.slice(0, 6));
await browser.close(); await srv.close();
