// Armería en escena real (1ª persona): captura reposo + disparo y mide draw calls/triángulos SÓLO de arma+manos.
// Uso: node tools/arte-armas.mjs <carpeta> <calidad> <ids "0,1,2"|all> [mapa m1|m2|m3]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const [, , out = 'shots/gate/armas2', quality = 'low', idsArg = 'all', map = 'm1'] = process.argv;
const ids = idsArg === 'all' ? [...Array(25).keys()] : idsArg.split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
pg.on('console', (m) => { if (['error'].includes(m.type()) && !/404/.test(m.text())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?cap=1&auto=${map}&god=1&seed=3&q=${quality}&autoq=0&wave=1&skipintro=1`);
await pg.waitForFunction(() => window.__session && window.__session.game, null, { timeout: 300000, polling: 500 });
await pg.evaluate(() => { const st = document.createElement('style'); st.textContent = '#hud,#banner,#sub,#guide,#tutorial,.modal{display:none!important}'; document.head.appendChild(st); [...document.querySelectorAll('button')].forEach((x) => { if (/Entendido/.test(x.textContent)) x.click(); }); });
const stats = [];
for (const w of ids) {
  const info = await pg.evaluate(async (w) => {
    const g = window.__session.game, me = g.players[0], S = (ms) => window.__step(ms), R = window.__renderer;
    g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; S(50);
    me.weapon = w; me.ammo[w] = 30; if (me.slots && !me.slots.includes(w)) me.slots[1] = w;
    for (const [k, d, a] of [['astilla', 15, -2], ['geoda', 24, 5], ['lente', 19, 0]]) { const f = me.heading, u = me.up, r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x }; g.spawnMonster(k, { x: me.pos.x + f.x * d + r.x * a, y: me.pos.y + f.y * d + r.y * a, z: me.pos.z + f.z * d + r.z * a }); }
    for (let i = 0; i < 20; i++) S(50);
    // coste sólo del arma+manos: se ocultan mundo y entidades
    const vis = R.scene.children.map((c) => [c, c.visible]); for (const [c] of vis) if (c !== R.camera) c.visible = false;
    const gl = R.gl; gl.info.autoReset = false; gl.info.reset(); R.gl.render(R.scene, R.camera); const calls = gl.info.render.calls, tris = gl.info.render.triangles;
    for (const [c, v] of vis) c.visible = v; gl.info.reset(); R.gl.render(R.scene, R.camera);
    return { calls, tris };
  }, w);
  await pg.screenshot({ path: `${out}/${String(w).padStart(2, '0')}-${quality}-idle.jpg`, type: 'jpeg', quality: 88, timeout: 180000 });
  await pg.evaluate(async () => { const vm = window.__renderer.vm; window.__step(16); vm.shoot(); window.__step(32); });
  await pg.screenshot({ path: `${out}/${String(w).padStart(2, '0')}-${quality}-fire.jpg`, type: 'jpeg', quality: 88, timeout: 180000 });
  stats.push({ w, ...info }); console.log(w, JSON.stringify(info));
}
fs.writeFileSync(`${out}/stats-${quality}.json`, JSON.stringify(stats, null, 1));
console.log('errores:', errs.slice(0, 5).join('|') || 'ninguno'); await b.close(); await srv.close();
