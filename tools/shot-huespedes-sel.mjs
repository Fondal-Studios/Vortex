// Capturas de la pantalla de selección con el cuerpo UNIFICADO: node tools/shot-huespedes-sel.mjs <carpeta> [ids=axioma,vesper,micelio,umbra,seraf] [w=1280] [h=720] [q=low] [evo=0] [pth=a,b,c,d]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [, , out = 'shots/huespedes-sel', ids = 'axioma,vesper,micelio,umbra,seraf', W = '1280', H = '720', Q = 'low', EVO = '0', PTH = ''] = process.argv; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), errs = [];
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: +W < 900, isMobile: +W < 900 }), pg = await ctx.newPage();
pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
if (+EVO) await pg.addInitScript(([evo, pth]) => { try { const ids = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']; const p = JSON.parse(localStorage.getItem('cristal.perfil.v1') || '{"v":1}'); p.evo = {}; p.path = {}; for (const i of ids) { p.evo[i] = +evo; p.path[i] = pth.split(',').filter(Boolean); } p.cores = 999; localStorage.setItem('cristal.perfil.v1', JSON.stringify(p)); } catch (e) {} }, [EVO, PTH]);
await pg.goto(`http://localhost:${srv.port}/?q=${Q}&autoq=0`); await pg.waitForTimeout(1500); await pg.evaluate(() => window.__api.ui.confirmTitle());
await pg.evaluate(() => window.__api.ui.show('huesped')); await pg.waitForTimeout(1500);
for (const id of ids.split(',')) {
  await pg.evaluate((id) => window.__api.ui.hs.select(id, true), id);
  await pg.waitForFunction(() => { const h = window.__api.ui.hs; return h && h.host && h.host.human; }, null, { timeout: 90000 }).catch(() => console.log('sin cuerpo', id));
  await pg.waitForTimeout(3500); await pg.screenshot({ path: `${out}/${id}.png` }); console.log(id, 'ok');
}
console.log(errs.length ? 'ERR ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'sin errores'); await b.close(); await srv.close();
