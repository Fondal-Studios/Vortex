// Colmena en el JUEGO real (3.ª persona): zánganos, nidos y la Reina dibujados por objects.js, habilidades con sus efectos (hostfx.js) y el cuerpo unificado.
// Uso: node tools/colmena-juego.mjs [carpeta] [evo=2] [camino=criador,nidos,cohabita,reina]   → <carpeta>/colmena-*.png y una línea por captura con errores de consola.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/colmena-juego', EVO = +(process.argv[3] || 2), PTH = (process.argv[4] || 'criador,nidos,cohabita,reina').split(',');
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), errors = [];
const pg = await (await b.newContext({ viewport: { width: 960, height: 720 } })).newPage();
pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?auto=m1&god=1&seed=3&q=low&autoq=0&nolock=1&skipintro=1&cam=third`, { timeout: 180000 });
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 90000 });
await pg.evaluate(([evo, pth]) => { const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; p.char = 'colmena'; p.evo = evo; p.path = pth.slice(0, evo); p.ul = 100; window.__api.setSetting('simple', false);
  const h = p.heading, u = p.up, r = { x: h.y * u.z - h.z * u.y, y: h.z * u.x - h.x * u.z, z: h.x * u.y - h.y * u.x }, at = (f, s) => ({ x: p.pos.x + h.x * f + r.x * s, y: p.pos.y + h.y * f + r.y * s, z: p.pos.z + h.z * f + r.z * s });
  window.__mons = [['astilla', 9, -2.0], ['prisma', 12, 2.2], ['ariete', 15, 0.2]].map(([k, f, s]) => { const m = g.spawnMonster(k, at(f, s), { noElite: true, passive: true }); m.hp = m.maxhp = 1e9; m.speedMul = 0; m.home = { ...m.pos }; return m; });
  setInterval(() => { for (const m of window.__mons) { m.pos = { ...m.home }; m.vel = { x: 0, y: 0, z: 0 }; } }, 8); }, [EVO, PTH]);
await pg.waitForFunction(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; return e && e.body && e.body.isReady; }, null, { timeout: 150000, polling: 1000 }).catch(() => null);
await pg.waitForTimeout(2500);
const info = async (n) => { const s = await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { units: g.objects.filter((o) => o.type === 'zangano').length, nests: g.objects.filter((o) => o.type === 'nido').length, reina: g.objects.filter((o) => o.type === 'reina').length, ult: p.ultId, calls: window.__api.renderer.renderer ? window.__api.renderer.renderer.info.render.calls : -1 }; });
  await pg.screenshot({ path: `${OUT}/colmena-${n}.png` }); console.log(n, JSON.stringify(s), errors.length ? 'ERR ' + errors.slice(0, 3).join(' | ') : ''); };
await info('0-inicio');
for (const [k, n] of [['g', '1-cria'], ['z', '2-nido'], ['f', '3-zumbido'], ['r', '4-marabunta']]) { await pg.keyboard.down(k); await pg.waitForTimeout(120); await pg.keyboard.up(k); await pg.waitForTimeout(n === '4-marabunta' ? 2500 : 1300); await info(n); }
await b.close(); await srv.close();
