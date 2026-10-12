// Captura rápida: node tools/arte-shot.mjs "<query>" salida.jpg [calidad=low] [espera=13000] [js]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [qs, out, Q = 'low', wait = '13000', js = ''] = process.argv.slice(2);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto(`http://localhost:${srv.port}/?${qs}&q=${Q}&autoq=0&nolock=1&skipintro=1`, { timeout: 240000 }); await pg.waitForTimeout(+wait);
if (js) { const r = await pg.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); await pg.waitForTimeout(600); }
await pg.screenshot({ path: out, type: 'jpeg', quality: 85 }); await b.close(); await srv.close();
