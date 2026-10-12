// Capturas de todas las pantallas de menú en PC, celular horizontal y celular vertical (para revisar que entren y tengan botón Volver).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/menus'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const VPS = [['pc', 1280, 720, false], ['movilH', 844, 390, true], ['movilV', 390, 844, true], ['movilH-pequeno', 667, 375, true], ['pc-fhd', 1920, 1080, false]];
const SCREENS = ['main', 'story', 'arenas', 'loadout', 'coop', 'bestiary', 'options'];
for (const [vn, w, h, touch] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`));
  await pg.goto(`${base}/?q=low&autoq=0`); await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__api.ui.confirmTitle());
  for (const s of SCREENS) {
    await pg.evaluate((s) => window.__api.ui.show(s), s); await pg.waitForTimeout(s === 'loadout' || s === 'bestiary' ? 2500 : 700);
    const info = await pg.evaluate(() => {
      const sc = document.querySelector('.screen.on'); if (!sc) return {};
      const back = [...document.querySelectorAll('.backbtn')].find((x) => x.offsetParent !== null);
      return { overflowY: sc.scrollHeight - sc.clientHeight, overflowX: sc.scrollWidth - sc.clientWidth, back: !!back, backRect: back && (({ x, y, width, height }) => ({ x, y, width, height }))(back.getBoundingClientRect()) };
    });
    console.log(vn, s, JSON.stringify(info));
    await pg.screenshot({ path: `${OUT}/${vn}-${s}.jpg`, type: 'jpeg', quality: 70 });
  }
  await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores JS'); await b.close(); await srv.close();
