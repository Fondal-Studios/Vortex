import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [, , w = '844', h = '390', q = 'low', out = 'shots/editor/ui', accion = ''] = process.argv;
fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }), br = await launch(), errs = [], EXTRA = process.env.URLX || '';
const touch = +w < 900;
const pg = await (await br.newContext({ viewport: { width: +w, height: +h }, hasTouch: touch, isMobile: touch })).newPage();
pg.on('pageerror', (e) => errs.push('pageerror ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || /DBG/.test(m.text())) errs.push(m.text().slice(0, 250)); });
await pg.goto(`http://localhost:${srv.port}/?q=${q}&lq=${q}&autoq=0${EXTRA}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); await pg.waitForTimeout(500);
await pg.evaluate(() => window.__api.ui.confirmTitle()); if (process.env.TODO !== '0') await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'), H = await import('/src/shared/host-build.js'); P.perfil().lab.piezas = [...H.ORDEN_PARTES]; P.perfil().evo.laboratorio = 4; });
await pg.evaluate(() => window.__api.ui.show('laboratorio'));
await pg.waitForFunction(() => window.__lab && window.__lab.visor && window.__lab.visor.listo, null, { timeout: 180000 }).catch((e) => errs.push('visor no listo ' + e.message));
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${out}/lab-${w}x${h}-${q}-cuerpo.png` });
if (accion) { const fn = new Function('pg', 'return (async()=>{' + fs.readFileSync(accion, 'utf8') + '})()'); await fn(pg); }
console.log('errores:', errs.filter((x) => !/toNonIndexed/.test(x)).slice(0, 30));
await br.close(); await srv.close();
