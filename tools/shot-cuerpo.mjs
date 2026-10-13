// Capturas del cuerpo del jugador en 3ª persona con modelo de Huésped (host-body.js). Uso: node tools/shot-cuerpo.mjs [carpeta]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const out = process.argv[2] || 'shots/cuerpo'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), errs = [];
for (const [char, mw, evo] of [['vesper', 'colmillo', 1], ['micelio', 'martillo_sismico', 3], ['umbra', 'hoja_umbral', 4], ['seraf', '', 2]]) {
  const pg = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage(); pg.setDefaultTimeout(120000);
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.addInitScript((c) => { try { localStorage.setItem('cristal.huesped.v1', c); } catch { /* ok */ } }, char);
  await pg.goto(`http://localhost:${srv.port}/?auto=m1&skipintro=1&god=1&seed=3&autoq=0&q=low&nolock=1`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
  await pg.waitForTimeout(1500); await pg.getByText('Entendido').click({ timeout: 5000 }).catch(() => {});
  await pg.evaluate(([m, e]) => { const q = window.__api.session.game.players[0]; q.melee = m; q.evo = e; }, [mw, evo]); await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${out}/${char}-quieto.png` });
  await pg.keyboard.down('KeyW'); await pg.waitForTimeout(900); await pg.screenshot({ path: `${out}/${char}-corre.png` });
  await pg.keyboard.up('KeyW'); await pg.keyboard.down('KeyV'); await pg.keyboard.up('KeyV'); await pg.waitForTimeout(200); await pg.screenshot({ path: `${out}/${char}-golpe.png` });
  const n = await pg.evaluate(() => { const R = window.__api.renderer; R.gl.info.reset(); return 0; }); void n;
  await pg.context().close();
}
console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'sin errores JS'); await b.close(); await srv.close();
