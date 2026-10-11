import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 800, height: 500 } });
pg.on('pageerror', e => console.log('PE', e.message));
await pg.goto(`http://localhost:${srv.port}/public/_obe.html?${process.argv[2]}`); await pg.waitForTimeout(3000);
console.log(JSON.stringify(await pg.evaluate(process.argv[3]))); await b.close(); await srv.close();
