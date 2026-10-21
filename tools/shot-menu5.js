// Capturas de TODAS las pantallas del menú (docs/MENU.md) en 4 tamaños (auditoría y verificación del rediseño). Uso: node tools/shot-menu5.js <carpeta> [pantallas separadas por coma] [tamaños separados por coma]
// Cada captura se abre a mano (Read); además se avisa de textos cortados, botones < 44 px y cosas fuera de pantalla.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/menu5'; fs.mkdirSync(OUT, { recursive: true });
const ALL = ['main', 'story', 'arenas', 'coop', 'huesped', 'evolucion', 'inventario', 'loadout', 'territorios', 'bestiary', 'tienda', 'options', 'graficos'];
const SCR = (process.argv[3] ? process.argv[3].split(',') : ALL);
const VPS0 = [['movilV', 390, 844, true], ['movilH', 844, 390, true], ['tablet', 820, 1180, true], ['pc', 1280, 720, false]];
const VPS = process.argv[4] ? VPS0.filter((v) => process.argv[4].split(',').includes(v[0])) : VPS0;
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [], problems = [];
for (const [vn, w, h, touch] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|favicon|Failed to load resource/i.test(m.text())) errors.push(`${vn} console: ${m.text()}`); });
  await pg.addInitScript(() => { try { if (!localStorage.getItem('cristal.perfil.v1')) localStorage.setItem('cristal.perfil.v1', JSON.stringify({ cores: 640, mae: { axioma: { xp: 300, partidas: 3, kills: 30, oleada: 4 } }, materiales: { hueso: [4, 2, 0, 0], cristal: [0, 1, 1, 0] } })); localStorage.setItem('vortex.bienvenida.v1', '1'); } catch { /* ok */ } });
  await pg.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 });
  await pg.addStyleTag({ content: '#menu *, #menu { transition: none !important; animation: none !important; }' });
  await pg.evaluate(() => window.__api.ui.confirmTitle());
  for (const s of SCR) {
    const [name, tab] = s.split(':');
    await pg.evaluate(([s, tab]) => { const u = window.__api.ui; u.show(s); if (tab && u.tn && s === 'tienda') u.tn.setTab(tab); }, [name, tab]); await pg.waitForTimeout(['tienda', 'huesped', 'inventario', 'evolucion', 'bestiary', 'loadout', 'colecc'].includes(name) ? 1800 : 600);
    const info = await pg.evaluate(() => {
      const sc = document.querySelector('.screen.on'), vw = innerWidth, out = { sc: sc && sc.id, bad: [] };
      const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
      for (const e of sc.querySelectorAll('button, .door, .hubcard, h3, h2')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (!r.width) continue; if (r.right > vw + 1 || r.left < -1) out.bad.push(`fuera X: ${e.className || e.tagName} ${e.textContent.trim().slice(0, 20)}`); }
      for (const e of sc.querySelectorAll('button')) { if (!vis(e) || e.closest('.tn-rail,#bgrid,.hs-chips,#ivslots,.iv-grid,#evlist,#evslots,#chlist,#wlist,#slotbar')) continue; const r = e.getBoundingClientRect(); if (r.width && r.height < 43 && !e.closest('.mb-pills')) out.bad.push(`chico ${e.className || e.id} ${Math.round(r.height)}px «${e.textContent.trim().slice(0, 16)}»`); }
      for (const e of sc.querySelectorAll('b, small, span, h2, h3, button')) { if (!vis(e) || e.children.length || e.classList.contains('stitle')) continue; if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'hidden' && getComputedStyle(e).textOverflow !== 'ellipsis') out.bad.push(`cortado «${e.textContent.trim().slice(0, 24)}»`); }
      if (sc.id !== 'main' && ![...document.querySelectorAll('.backbtn')].some((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden')) out.bad.push('falta el botón Volver');
      return out;
    });
    console.log(vn, s, JSON.stringify(info)); if (info.bad.length) problems.push(`${vn} ${s}: ${info.bad.slice(0, 6).join('; ')}`);
    await pg.screenshot({ path: `${OUT}/${vn}-${s.replace(':', '-')}.jpg`, type: 'jpeg', quality: 72 });
  }
  await ctx.close();
}
console.log(errors.length ? 'ERRORES JS:\n' + errors.join('\n') : 'sin errores JS'); console.log(problems.length ? 'PROBLEMAS:\n' + problems.join('\n') : 'sin problemas');
await b.close(); await srv.close(); process.exit(errors.length ? 1 : 0);
