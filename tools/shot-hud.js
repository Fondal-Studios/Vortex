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
  const CHK = () => {
    const sel = ['.trophy', '#cards', '#downed', '#top', '#bossbar', '#objective', '#bars', '#weapons', '#skills', '#huesped', '#ability', '#coop', '#practice', '#banner', '.tc-fire', '.tc-fireL', '.tc-ads', '.tc-crouch', '.tc-jump', '.tc-mov', '.tc-esp', '.tc-s3', '.tc-ult', '.tc-melee', '.tc-reload', '.tc-evo', '.hq-ammo', '.tc-ability', '.tc-use', '.tc-ping', '.tc-pause', '#camquick', '#gravmsg', '.tc-edit'];
    const items = []; for (const s of sel) for (const el of document.querySelectorAll(s)) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null && cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; items.push({ s, x: r.x, y: r.y, w: r.width, h: r.height, touchBtn: s.startsWith('.tc-') }); }
    const out = []; const W = innerWidth, H = innerHeight;
    for (let i = 0; i < items.length; i++) {
      const a = items[i]; if (a.x < -1 || a.y < -1 || a.x + a.w > W + 1 || a.y + a.h > H + 1) out.push(`FUERA DE PANTALLA ${a.s}`);
      for (let j = i + 1; j < items.length; j++) { const c = items[j]; const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y); const ign = new Set(['#banner', '#cards', '#downed', '.trophy']); const edOnly = (a.s === '.tc-edit' && !c.touchBtn) || (c.s === '.tc-edit' && !a.touchBtn); if (ox > 4 && oy > 4 && !(ign.has(a.s) || ign.has(c.s) || edOnly)) out.push(`SOLAPE ${a.s} × ${c.s} (${Math.round(ox)}×${Math.round(oy)})`); }
    }
    return { out, n: items.length, btn: items.filter((i) => i.touchBtn).length };
  };
  const res = await pg.evaluate(CHK);
  console.log(vn, `${w}x${h}`, res.n, 'elementos', res.out.length ? '\n  ' + res.out.join('\n  ') : 'sin solapes'); overlaps += res.out.length;
  if (touch) await pg.evaluate(() => { window.__api.touch.ctxForce = true; window.__api.touch.applyLayout(); }); // enseña también los contextuales (ULTI, USAR, EVOLUC.)
  if (touch) { // los 3 preajustes de dedos (2/3/4) y el editor de botones: sin solapes ni salidas de pantalla; los 3 botones nuevos presentes
    for (const n of [2, 3, 4]) {
      await pg.evaluate((n) => window.__api.touch.setFingers(n), n); await pg.waitForTimeout(150);
      const r = await pg.evaluate(CHK); const need = await pg.evaluate(() => ['fire', 'reload', 'melee', 'jump', 'ult', 'use', 'evo'].filter((k) => { const e = document.querySelector('.tc-' + k); return !e || e.offsetParent === null; }));
      console.log(vn, `  ${n} dedos`, r.btn, 'botones', need.length ? 'FALTAN ' + need.join(',') : '', r.out.length ? '\n    ' + r.out.join('\n    ') : 'sin solapes'); overlaps += r.out.length + need.length;
      if (n === 3) await pg.screenshot({ path: `${OUT}/${vn}-3dedos.jpg`, type: 'jpeg', quality: 70 });
    }
    await pg.evaluate(() => window.__api.touch.setFingers(2));
    // modo avanzado: HAB.1/2/3, APUNTAR, AGACHAR, EQUIPO, SEÑALAR además de los básicos; sin solapes; y en básico NO se ven
    { const basicHidden = await pg.evaluate(() => ['mov', 'esp', 's3', 'ads', 'crouch', 'ability', 'ping'].filter((k) => { const e = document.querySelector('.tc-' + k); return e && e.offsetParent !== null; }));
      console.log(vn, '  modo básico oculta lo avanzado:', basicHidden.length ? 'FALLA ven ' + basicHidden.join(',') : 'ok'); overlaps += basicHidden.length;
      await pg.evaluate(() => { window.__api.touch.ctxForce = false; window.__api.touch.applyLayout(); }); await pg.waitForTimeout(100);
      await pg.screenshot({ path: `${OUT}/${vn}-basico.jpg`, type: 'jpeg', quality: 70 });
      await pg.evaluate(() => { window.__api.touch.ctxForce = true; document.querySelector('#tadv').value = '1'; document.querySelector('#tadv').dispatchEvent(new Event('input')); }); await pg.waitForTimeout(150);
      const r2 = await pg.evaluate(CHK); const need2 = await pg.evaluate(() => ['mov', 'esp', 's3', 'ads', 'crouch'].filter((k) => { const e = document.querySelector('.tc-' + k); return !e || e.offsetParent === null; }));
      console.log(vn, '  modo avanzado', r2.btn, 'botones', need2.length ? 'FALTAN ' + need2.join(',') : '', r2.out.length ? '\n    ' + r2.out.join('\n    ') : 'sin solapes'); overlaps += r2.out.length + need2.length;
      await pg.screenshot({ path: `${OUT}/${vn}-avanzado.jpg`, type: 'jpeg', quality: 70 });
      await pg.evaluate(() => { document.querySelector('#tadv').value = '0'; document.querySelector('#tadv').dispatchEvent(new Event('input')); }); await pg.waitForTimeout(100); }
    // editor: arrastrar el botón de melee cambia su posición guardada, y el editor no tapa botones
    await pg.evaluate(() => { window.__api.session.paused = true; window.__api.touch.edit(true); }); await pg.waitForTimeout(200);
    const r = await pg.evaluate(CHK); console.log(vn, '  editor', r.out.length ? '\n    ' + r.out.join('\n    ') : 'sin solapes'); overlaps += r.out.length;
    const box = await pg.locator('.tc-melee').boundingBox(); const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2; await T('touchStart', [{ x: cx, y: cy, id: 1 }]); for (let i = 1; i <= 5; i++) await T('touchMove', [{ x: cx - i * 6, y: cy + i * 4, id: 1 }]); await T('touchEnd', []); await pg.waitForTimeout(150);
    const dx = await pg.evaluate(() => { const l = JSON.parse(localStorage.getItem('cristal.ajustes.v2') || '{}'); return null; }); void dx;
    const moved = await pg.evaluate(() => { const e = document.querySelector('.tc-melee'); return [e.style.getPropertyValue('--dx'), e.style.getPropertyValue('--dy')]; });
    const okMove = moved[0] === '-30px' && moved[1] === '20px'; console.log(vn, '  editor mueve MELEE:', moved.join(' '), okMove ? 'ok' : 'FALLA'); if (!okMove) overlaps++;
    await pg.screenshot({ path: `${OUT}/${vn}-editor.jpg`, type: 'jpeg', quality: 70 });
    await pg.evaluate(() => { window.__api.touch.edit(false); });
  }
  await pg.screenshot({ path: `${OUT}/${vn}.jpg`, type: 'jpeg', quality: 78 }); await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores JS', '| problemas de HUD:', overlaps); await b.close(); await srv.close(); process.exit(overlaps ? 1 : 0);
