// Capturas de la intro de la historia (tren → despertar → Heraldo): node tools/shot-intro.js
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?q=medium&autoq=0`); await pg.waitForTimeout(1500);
await pg.click('#campaign');
const shot = async (name, ms) => { await pg.waitForTimeout(ms); await pg.screenshot({ path: `shots/${name}.jpg`, type: 'jpeg', quality: 80 }); };
await shot('historia-1-tren', 7000);
await pg.waitForFunction(() => !document.getElementById('cine') || document.getElementById('cine').classList.contains('hidden'), null, { timeout: 40000 });
await shot('historia-2-despertar', 2500); await shot('historia-3-heraldo', 6000);
console.log(await pg.evaluate(() => document.getElementById('sub').textContent), errs.slice(0, 5)); await b.close(); await srv.close();
