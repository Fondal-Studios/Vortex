import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`;
const errs=[];
for (const [map, lv, views] of [['m2shell','low',[[0,0,0,0,10],[0,0,0,180,60],[20,-30,10,90,20]]],['m2shell','high',[[0,0,0,0,10],[0,-40,0,0,70]]],['m1sky','high',[[0,10,0,0,25],[0,10,0,200,50]]]]) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,400)); });
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`${base}/public/map3-demo.html?q=${lv}&map=${map}`); await pg.waitForFunction('window.__ready', null, { timeout: 180000 });
  let i=0;
  for (const v of views) { await pg.evaluate((a) => window.__set(...a), v); const info = await pg.evaluate(() => window.__frame(6)); await pg.screenshot({ path: `shots/ojos-${map}-${lv}-${i++}.jpg`, type: 'jpeg', quality: 80 }); console.log(map, lv, i, JSON.stringify(info)); }
  await pg.close();
}
console.log([...new Set(errs)].join('\n')); await b.close(); process.exit(0);
