// Capturas de la interfaz de acceso (título, menú, arenas, cooperativo, bestiario, opciones): node tools/shot-ui.js [ancho] [alto]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 720;
const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: W, height: H } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?q=medium&autoq=0`); await pg.waitForTimeout(3500);
const shot = (n) => pg.screenshot({ path: `shots/ui-${n}.jpg`, type: 'jpeg', quality: 85 });
await shot('1-titulo');
await pg.keyboard.press('Enter'); await pg.waitForTimeout(1200); await shot('2-menu');
await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(900); await shot('3-menu-coop');
await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3500); await shot('4-bestiario');
await pg.keyboard.press('Escape'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(900); await shot('5-historia');
await pg.keyboard.press('Escape'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(900); await shot('6-arenas');
console.log(errs.slice(0, 6)); await b.close(); await srv.close();
