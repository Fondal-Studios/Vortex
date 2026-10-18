// Capturas del menú en 4 puertas y de la Tienda en 4 tamaños (móvil vertical, móvil horizontal, tablet, escritorio) + comprobación de desbordes y solapes.
// Uso: node tools/shot-menu4.js [carpeta]   (sale con error si algo se sale de la pantalla o se pisa)
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/menu4'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [], problems = [];
const VPS = [['movilV', 390, 844, true], ['movilH', 844, 390, true], ['tablet', 820, 1180, true], ['pc', 1280, 720, false]];
const SHOTS = [['main'], ['hub-jugar'], ['hub-huesped'], ['hub-mundo'], ['hub-ajustes'], ['tienda', 'hue'], ['tienda', 'pla'], ['tienda', 'obj'], ['tienda', 'ser'], ['huesped']];
for (const [vn, w, h, touch] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('response', (r) => { if (r.status() >= 400) errors.push(`${vn} HTTP ${r.status()} ${r.url().replace(base, '')}`); });
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|favicon|Failed to load resource/i.test(m.text())) errors.push(`${vn} console: ${m.text()}`); });
  await pg.addInitScript(() => { try { if (!localStorage.getItem('cristal.perfil.v1')) localStorage.setItem('cristal.perfil.v1', JSON.stringify({ cores: 640, mae: { axioma: { xp: 300, partidas: 3, kills: 30, oleada: 4 } }, materiales: { hueso: [4, 2, 0, 0], cristal: [0, 1, 1, 0] } })); } catch { /* ok */ } });
  await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.addStyleTag({ content: '#menu *, #menu { transition: none !important; animation: none !important; }' });   // capturas deterministas: sin transiciones (la máquina va lenta)
  await pg.evaluate(() => window.__api.ui.confirmTitle());
  for (const [s, tab] of SHOTS) {
    await pg.evaluate(([s, tab]) => { window.__api.ui.show(s); if (tab) window.__api.ui.tn.setTab(tab); }, [s, tab]); await pg.waitForTimeout(s === 'tienda' || s === 'huesped' ? 1800 : 700);
    const info = await pg.evaluate(() => {
      const sc = document.querySelector('.screen.on'), vw = innerWidth, vh = innerHeight, out = { sc: sc && sc.id, bad: [] };
      const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
      for (const e of sc.querySelectorAll('button, .door, .hubcard, h3, h2, .tn-bubble, .tn-saldo')) {
        if (!vis(e) || e.closest('.tn-rail')) continue; const r = e.getBoundingClientRect(); if (!r.width) continue;
        if (r.right > vw + 1 || r.left < -1) out.bad.push(`fuera X: ${e.className || e.tagName} ${e.textContent.trim().slice(0, 20)}`);
      }
      const ov = sc.scrollWidth - sc.clientWidth; if (ov > 1) out.bad.push('scrollX ' + ov);
      // el contenido de la puerta no se corta y los botones tienen 44 px mínimos
      for (const e of sc.querySelectorAll('.door, .hubcard, .continuar, .tn-btn, .tn-tab')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.width && r.height < 43) out.bad.push(`táctil chico ${e.className} ${Math.round(r.height)}px`); }
      out.crumbs = (document.querySelector('#crumbs') || {}).textContent; out.scrollY = sc.scrollHeight - sc.clientHeight;
      const cr = document.querySelector('#crumbs:not([hidden])'), bk = document.querySelector('.screen.on .backbtn'), sl = document.querySelector('#saldo:not([hidden])');
      const R = (e) => e && e.getBoundingClientRect(), hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      if (hit(R(cr), R(bk))) out.bad.push('migas pisan Volver'); if (hit(R(cr), R(sl))) out.bad.push('migas pisan saldo');
      return out;
    });
    console.log(vn, s, tab || '', JSON.stringify(info)); if (info.bad.length) problems.push(`${vn} ${s} ${tab || ''}: ${info.bad.join('; ')}`);
    await pg.screenshot({ path: `${OUT}/${vn}-${s}${tab ? '-' + tab : ''}.jpg`, type: 'jpeg', quality: 72 });
  }
  await ctx.close();
}
console.log(errors.length ? 'ERRORES JS:\n' + errors.join('\n') : 'sin errores JS'); console.log(problems.length ? 'PROBLEMAS:\n' + problems.join('\n') : 'sin desbordes ni solapes');
await b.close(); await srv.close(); process.exit(errors.length || problems.length ? 1 : 0);
