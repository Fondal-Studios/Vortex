import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 800, height: 450 } });
pg.on('console', m => console.log('C', m.type(), m.text().slice(0,400))); pg.on('pageerror', e => console.log('PE', e.message));
await pg.goto(`http://localhost:${srv.port}/public/viewer.html?${process.argv[2]}`); await pg.waitForTimeout(2500); await b.close(); await srv.close();
