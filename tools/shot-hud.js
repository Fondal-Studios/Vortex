// Revisa el HUD en juego en varios tamaños (PC, celulares horizontales) y detecta botones/elementos que se superponen.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/hud'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const VPS = [['pc', 1280, 720, false], ['iphoneSE', 667, 375, true], ['iphone13', 844, 390, true], ['iphone15pm', 932, 430, true]];
let overlaps = 0;
for (const [vn, w, h, touch] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`));
  await pg.goto(`${base}/?auto=m1&bot=1&god=1&wave=2&seed=3&q=low&autoq=0${touch ? '&input=touch' : ''}`); await pg.waitForTimeout(9000);
  if (touch) await pg.evaluate(() => { const s = window.__api.session; s.touch = true; window.__api.touch.show(true); });
  await pg.waitForTimeout(800);
  const res = await pg.evaluate(() => {
    const sel = ['#top', '#bossbar', '#objective', '#bars', '#weapons', '#skills', '#ability', '#coop', '#practice', '#banner', '.tc-fire', '.tc-jump', '.tc-dash', '.tc-mov', '.tc-esp', '.tc-ability', '.tc-use', '.tc-ping', '.tc-prev', '.tc-next', '.tc-pause'];
    const items = []; for (const s of sel) for (const el of document.querySelectorAll(s)) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null && cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; items.push({ s, x: r.x, y: r.y, w: r.width, h: r.height, touchBtn: s.startsWith('.tc-') }); }
    const out = []; const W = innerWidth, H = innerHeight;
    for (let i = 0; i < items.length; i++) {
      const a = items[i]; if (a.x < -1 || a.y < -1 || a.x + a.w > W + 1 || a.y + a.h > H + 1) out.push(`FUERA DE PANTALLA ${a.s}`);
      for (let j = i + 1; j < items.length; j++) { const c = items[j]; const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y); if (ox > 4 && oy > 4 && (a.touchBtn || c.touchBtn)) out.push(`SOLAPE ${a.s} × ${c.s} (${Math.round(ox)}×${Math.round(oy)})`); }
    }
    return { out, n: items.length };
  });
  console.log(vn, `${w}x${h}`, res.n, 'elementos', res.out.length ? '\n  ' + res.out.join('\n  ') : 'sin solapes'); overlaps += res.out.length;
  await pg.screenshot({ path: `${OUT}/${vn}.jpg`, type: 'jpeg', quality: 78 }); await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores JS', '| problemas de HUD:', overlaps); await b.close(); await srv.close(); process.exit(overlaps ? 1 : 0);
