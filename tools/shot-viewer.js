import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 });
const b = await launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/public/viewer.html?${process.argv[2] || ''}`);
await pg.waitForTimeout(+process.argv[4] || 2500);
await pg.screenshot({ path: process.argv[3] || '/tmp/v.png' });
console.log(errs.slice(0, 6)); await b.close(); await srv.close();
