import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: +process.argv[5] || 1000, height: +process.argv[6] || 700 } });
pg.on('console', m => { if (['error','warning'].includes(m.type())) console.log('C', m.text().slice(0,300)); }); pg.on('pageerror', e => console.log('PE', e.message));
await pg.goto(`http://localhost:${srv.port}/public/_obe.html?${process.argv[2]}`); await pg.waitForTimeout(+process.argv[4] || 2500);
await pg.screenshot({ path: process.argv[3], type: 'jpeg', quality: 82 }); await b.close(); await srv.close();
