// Revisa el HUD en juego en varios tamaños (PC, celulares y tableta horizontales), en los DOS modos (Disparo y Melé) y con varios Huéspedes:
// detecta botones/elementos que se superponen, que salen de la pantalla, que miden menos de 44 px o que tapan el centro. Guarda capturas en shots/hud.
//   node tools/shot-hud.js [carpeta]            → todos los tamaños (lento: render por software)
//   HUD_SOLO=iphone13 node tools/shot-hud.js    → un solo tamaño   ·   HUD_HOSTS=axioma,vesper node tools/shot-hud.js → sólo esos Huéspedes
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/hud'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const VPS = [['pc', 1280, 720, false], ['iphoneSE', 667, 375, true], ['iphone13', 844, 390, true], ['iphone15pm', 932, 430, true], ['tablet', 1024, 768, true]].filter((v) => !process.env.HUD_SOLO || process.env.HUD_SOLO.split(',').includes(v[0]));
const ALL_HOSTS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'colmena', 'danzante', 'singular'];
const HOSTS_BY = (vn) => (process.env.HUD_HOSTS ? process.env.HUD_HOSTS.split(',') : vn === 'iphone13' ? ALL_HOSTS : vn === 'tablet' || vn === 'iphoneSE' || vn === 'iphone15pm' ? ['vesper', 'danzante', 'singular'] : ['vesper', 'danzante', 'singular']);
let overlaps = 0;
for (const [vn, w, h, touch] of VPS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`));
  await ctx.addInitScript(() => { try { localStorage.setItem('cristal.tut.v2', '1'); } catch { /* ok */ } });   // sin el cartel de «Cómo se juega» tapando las capturas
  await pg.goto(`${base}/?guia=0&auto=m1&${touch ? 'bot=0&input=touch' : 'bot=1'}&god=1&wave=2&seed=3&q=low&autoq=0`);   // táctil: sesión real (la entrada pasa por touch.read → sim); PC: bot (el ratón no está capturado)
  await pg.addStyleTag({ content: '.tc-btn,#touch.tc-swap .tc-btn{animation:none!important;transition:none!important}' });   // se mide la geometría, no la animación await pg.waitForTimeout(8000);
  if (touch) await pg.evaluate(() => { const s = window.__api.session; s.touch = true; window.__api.touch.show(true); });
  await pg.waitForFunction((t) => { const q = document.querySelector('#hud .hq'); return q && q.classList.contains('touch') === t; }, touch, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(800);
  // ── revisión de un cuadro: solapes, fuera de pantalla, toques ≥ 44 px, centro libre ──
  const CHK = (centro) => {
    const sel = ['.trophy', '#cards', '#downed', '#top', '#goal .g-main', '#mision', '#bossbar', '#objective', '#bars', '#weapons', '#skills', '#hud .hq', '#evohud', '#ability', '#coop', '#practice', '#banner', '.tc-fire', '.tc-fireL', '.tc-ads', '.tc-crouch', '.tc-jump', '.tc-mov', '.tc-esp', '.tc-s3', '.tc-ult', '.tc-melee', '.tc-reload', '.tc-evo', '.tc-mode', '.hq-ammo', '#combohud', '#estilohud', '#keyhint', '#botin-prompt', '#botin-toasts', '.tc-ability', '.tc-use', '.tc-ping', '.tc-pause', '#camquick', '#gravmsg', '.tc-edit'];
    const items = []; for (const s of sel) for (const el of document.querySelectorAll(s)) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || el.offsetParent === null && cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; items.push({ s, x: r.x, y: r.y, w: r.width, h: r.height, touchBtn: s.startsWith('.tc-') && s !== '.tc-edit' }); }
    const out = []; const W = innerWidth, H = innerHeight;
    for (let i = 0; i < items.length; i++) {
      const a = items[i]; if (a.x < -1 || a.y < -1 || a.x + a.w > W + 1 || a.y + a.h > H + 1) out.push(`FUERA DE PANTALLA ${a.s}`);
      if (a.touchBtn && Math.min(a.w, a.h) < 43.5) out.push(`TOQUE CHICO ${a.s} (${Math.round(a.w)}×${Math.round(a.h)})`);
      if (centro && (a.touchBtn || a.s === '#combohud' || a.s === '#estilohud' || a.s === '.hq-ammo' || a.s === '#hud .hq' || a.s === '#evohud') && !['.tc-ads', '.tc-crouch', '.tc-ability', '.tc-pause', '.tc-edit'].includes(a.s)) { const ox = Math.min(a.x + a.w, W * 0.62) - Math.max(a.x, W * 0.38), oy = Math.min(a.y + a.h, H * 0.8) - Math.max(a.y, H * 0.2); if (ox > 2 && oy > 2) out.push(`TAPA EL CENTRO ${a.s} (${Math.round(ox)}×${Math.round(oy)})`); }
      for (let j = i + 1; j < items.length; j++) { const c = items[j]; const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y); const ign = new Set(['#banner', '#cards', '#downed', '.trophy', '#top', '#botin-toasts']); const edOnly = (a.s === '.tc-edit' && !c.touchBtn) || (c.s === '.tc-edit' && !a.touchBtn); const circ = a.touchBtn && c.touchBtn && a.s !== '.tc-pause' && c.s !== '.tc-pause' && a.s !== '.tc-ping' && c.s !== '.tc-ping', dist = Math.hypot(a.x + a.w / 2 - c.x - c.w / 2, a.y + a.h / 2 - c.y - c.h / 2), choca = circ ? dist < (a.w + c.w) / 2 - 3 : ox > 4 && oy > 4; if (ox > 0 && oy > 0 && choca && !(ign.has(a.s) || ign.has(c.s) || edOnly)) out.push(`SOLAPE ${a.s} × ${c.s} (${Math.round(ox)}×${Math.round(oy)})`); }
    }
    return { out, n: items.length, btn: items.filter((i) => i.touchBtn).length };
  };
  // mete datos de ejemplo en los carteles que no siempre están (combo, rango, misión, botín) para medir el peor caso
  const PEOR = () => {
    const q = (s) => document.querySelector(s), on = (el) => { if (el) { el.classList.add('on'); el.style.transition = 'none'; el.style.opacity = '1'; } };
    const c = q('#combohud'); if (c && document.body.classList.contains('modo-combo')) { c.querySelector('b').innerHTML = '×12<i>COMBO</i>'; c.querySelector('small').textContent = 'Golpe de armadura · COMPÁS ♪♪♪'; on(c); } else if (c) { c.classList.remove('on'); c.style.opacity = '0'; }
    const e = q('#estilohud'); if (e && document.body.classList.contains('modo-combo')) { e.querySelector('b').textContent = 'S'; e.querySelector('small').textContent = '5 BAJAS'; on(e); } else if (e) { e.classList.remove('on'); e.style.opacity = '0'; }
    const m = q('#mision'); if (m) { m.className = ''; m.textContent = 'Misión: derrotá 8 criaturas sin recibir daño (3/8)'; }
    const g = q('#goal .g-main'); if (g) g.textContent = 'Sobreviví a la oleada 2/6 · quedan 14 criaturas · seguí al marcador';
    let bt = q('#botin-toasts'); if (!bt) { bt = document.createElement('div'); bt.id = 'botin-toasts'; document.body.appendChild(bt); }
    bt.innerHTML = '<div class="bt" style="--c:#ffd23f"><i></i><b>Hoja de escarcha</b><small>Legendaria · +1</small></div><div class="bt" style="--c:#9dff5a"><i></i><b>Esencia viva</b><small>Común · +3</small></div>';
    let pr = q('#botin-prompt'); if (!pr) { pr = document.createElement('div'); pr.id = 'botin-prompt'; (q('#hud') || document.body).appendChild(pr); } pr.hidden = false; pr.textContent = `${document.body.classList.contains('touch-ui') ? 'USAR' : 'E'} · recoger Hoja de escarcha`;
  };
  const LIMPIA = () => pg.evaluate(() => { for (const s of ['#botin-toasts']) { const e = document.querySelector(s); if (e) e.innerHTML = ''; } const pr = document.querySelector('#botin-prompt'); if (pr) pr.hidden = true; });
  const CTX = async (on) => { await pg.evaluate((on) => { window.__api.touch.ctxForce = on; window.__api.touch.applyLayout(); }, on); await pg.waitForTimeout(500); };   // espera a que termine la animación de los contextuales
  const setModo = async (m) => { await pg.evaluate((m) => { const s = window.__api.session; window.__api.setGameMode(m); s.game.setInput(s.pid, { mode: m }); }, m); await pg.waitForFunction((m) => document.body.classList.contains('modo-combo') === (m === 'combo'), m, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(600); };
  const setHost = async (ch) => { await pg.evaluate(async (ch) => { const { Equipo } = await import('/src/client/equipo.js'); Equipo.char = ch; const s = window.__api.session; s.game.setLoadout(s.pid, ch, null); }, ch); await pg.waitForFunction((ch) => { const b = document.querySelector('#hud .hq b'); return b && b.textContent.toLowerCase() === ch.toLowerCase(); }, ch, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(500); };
  const log = (vn, txt, r, extra = '') => { console.log(vn, ' ', txt, r.btn != null ? r.btn : '', r.btn != null ? 'botones' : '', extra, r.out.length ? '\n    ' + r.out.join('\n    ') : 'sin solapes'); overlaps += r.out.length; };

  await setModo('shooter');
  const res = await pg.evaluate(CHK, false);
  console.log(vn, `${w}x${h}`, res.n, 'elementos', res.out.length ? '\n  ' + res.out.join('\n  ') : 'sin solapes'); overlaps += res.out.length;
  if (touch) await CTX(true); // enseña también los contextuales (ULTI, USAR, EVOLUC.)
  if (touch) { // los 3 preajustes de dedos (2/3/4) y el editor de botones: sin solapes ni salidas de pantalla; los botones nuevos presentes
    for (const n of [2, 3, 4]) {
      await pg.evaluate((n) => window.__api.touch.setFingers(n), n); await pg.waitForTimeout(150);
      await pg.evaluate(PEOR); const r = await pg.evaluate(CHK, true); const need = await pg.evaluate(() => ['fire', 'reload', 'melee', 'jump', 'mov', 'esp', 's3', 'mode', 'ult', 'use', 'evo'].filter((k) => { const e = document.querySelector('.tc-' + k); return !e || e.offsetParent === null; }));
      console.log(vn, `  ${n} dedos`, r.btn, 'botones', need.length ? 'FALTAN ' + need.join(',') : '', r.out.length ? '\n    ' + r.out.join('\n    ') : 'sin solapes'); overlaps += r.out.length + need.length;
      if (n === 3) await pg.screenshot({ path: `${OUT}/${vn}-disparo-3dedos.jpg`, type: 'jpeg', quality: 70 });
    }
    await pg.evaluate(() => window.__api.touch.setFingers(2));
    // modo avanzado: APUNTAR, AGACHAR, EQUIPO, SEÑALAR además de los básicos (las 3 habilidades ya están siempre); sin solapes; y en básico NO se ven
    { const basicHidden = await pg.evaluate(() => ['ads', 'crouch', 'ability', 'ping'].filter((k) => { const e = document.querySelector('.tc-' + k); return e && e.offsetParent !== null; }));
      console.log(vn, '  modo básico oculta lo avanzado:', basicHidden.length ? 'FALLA ven ' + basicHidden.join(',') : 'ok'); overlaps += basicHidden.length;
      const tres = await pg.evaluate(() => ['mov', 'esp', 's3'].filter((k) => { const e = document.querySelector('.tc-' + k); return !e || e.offsetParent === null; }));
      console.log(vn, '  HAB.1/2/3 siempre visibles en Disparo:', tres.length ? 'FALTAN ' + tres.join(',') : 'ok'); overlaps += tres.length;
      await CTX(false); await LIMPIA();
      await pg.screenshot({ path: `${OUT}/${vn}-disparo-basico.jpg`, type: 'jpeg', quality: 70 });
      await CTX(true); await pg.evaluate(() => { document.querySelector('#tadv').value = '1'; document.querySelector('#tadv').dispatchEvent(new Event('input')); }); await pg.waitForTimeout(600);
      await pg.evaluate(PEOR); const r2 = await pg.evaluate(CHK, false); const need2 = await pg.evaluate(() => ['s3', 'ads', 'crouch'].filter((k) => { const e = document.querySelector('.tc-' + k); return !e || e.offsetParent === null; }));
      console.log(vn, '  modo avanzado', r2.btn, 'botones', need2.length ? 'FALTAN ' + need2.join(',') : '', r2.out.length ? '\n    ' + r2.out.join('\n    ') : 'sin solapes'); overlaps += r2.out.length + need2.length;
      await pg.screenshot({ path: `${OUT}/${vn}-disparo-avanzado.jpg`, type: 'jpeg', quality: 70 });
      await pg.evaluate(() => { document.querySelector('#tadv').value = '0'; document.querySelector('#tadv').dispatchEvent(new Event('input')); }); await pg.waitForTimeout(100); await LIMPIA(); }

    // ── MELÉ: sólo SUS botones (ataque 1, ataque 2, salto, 3 habilidades, modo + contextuales) ──
    await setModo('combo'); await CTX(true); await pg.evaluate(PEOR);
    { const r = await pg.evaluate(CHK, true);
      const lab = await pg.evaluate(() => ({ fire: document.querySelector('.tc-fire small').textContent, reload: document.querySelector('.tc-reload small').textContent, melee: document.querySelector('.tc-melee').offsetParent !== null, ads: ['ads', 'crouch', 'ability', 'ping'].filter((k) => { const e = document.querySelector('.tc-' + k); return e && e.offsetParent !== null; }), tres: ['mov', 'esp', 's3', 'jump', 'mode'].filter((k) => { const e = document.querySelector('.tc-' + k); return !e || e.offsetParent === null; }) }));
      log(vn, '  Melé', r);
      const okLab = lab.fire === 'ATAQUE 1' && lab.reload === 'ATAQUE 2' && !lab.melee && !lab.ads.length && !lab.tres.length;
      console.log(vn, '  modo Melé muestra sólo lo suyo:', okLab ? 'ok' : `FALLA ${JSON.stringify(lab)}`); if (!okLab) overlaps++;
      await pg.screenshot({ path: `${OUT}/${vn}-mele.jpg`, type: 'jpeg', quality: 70 });
      await pg.evaluate(() => { window.__api.touch.setFingers(3); }); await pg.waitForTimeout(150); const r3 = await pg.evaluate(CHK, true); log(vn, '  Melé 3 dedos', r3); await pg.evaluate(() => { window.__api.touch.setFingers(2); }); }
    await CTX(false); await LIMPIA();

    // ── el botón MODO con toques reales: alterna al instante, tiene espera (~0,6 s) y cambia botones y HUD ──
    await setModo('shooter'); await pg.waitForTimeout(700);
    { const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
      const modo = () => pg.evaluate(() => ({ ui: document.querySelector('#touch').classList.contains('combo-mode') ? 'melee' : 'disparo', sim: window.__api.session.game.players[0].mode, body: document.body.classList.contains('modo-combo') }));
      const bx = await pg.locator('.tc-mode').boundingBox(); await T('touchStart', [{ x: bx.x + bx.width / 2, y: bx.y + bx.height / 2, id: 7 }]); await T('touchEnd', []);   // toque REAL sobre el botón
      await pg.waitForFunction(() => window.__api.session.game.players[0].mode === 'combo', null, { timeout: 30000 }).catch(() => {}); const a = await modo();
      const anillo = await pg.evaluate(() => (document.querySelector('.tc-mode').dataset.ring === '1' ? 0 : 1));   // el anillo de espera existe (su valor corre con el reloj real)
      // espera de ~0,6 s: dos pedidos seguidos en el mismo instante sólo cuentan una vez
      const dos = await pg.evaluate(async () => { await new Promise((r) => setTimeout(r, 800)); const t = window.__api.touch; t.onMode(); const x = window.__api.gameMode(); t.onMode(); return [x, window.__api.gameMode()]; });
      await pg.waitForFunction(() => window.__api.session.game.players[0].mode === 'shooter', null, { timeout: 30000 }).catch(() => {}); const c = await modo();
      const ok = a.ui === 'melee' && a.sim === 'combo' && a.body && dos[0] === 'shooter' && dos[1] === 'shooter' && c.ui === 'disparo' && c.sim === 'shooter' && !c.body && anillo < 1;
      console.log(vn, '  botón MODO alterna Disparo ↔ Melé:', ok ? 'ok' : `FALLA ${JSON.stringify({ a, dos, c, anillo })}`); if (!ok) overlaps++; }

    // ── Huéspedes: cada uno en Disparo y en Melé ──
    for (const ch of HOSTS_BY(vn)) {
      await setHost(ch);
      for (const m of ['shooter', 'combo']) {
        await setModo(m); await CTX(true); await pg.evaluate(PEOR);
        const r = await pg.evaluate(CHK, true); const nm = await pg.evaluate(() => ['mov', 'esp', 's3'].map((k) => (document.querySelector('.tc-' + k).getAttribute('aria-label') || '')));
        log(vn, `  huésped ${ch} ${m === 'combo' ? 'Melé' : 'Disparo'}`, r, `[${nm.join(' | ')}]`);
        if (['axioma', 'vesper', 'danzante', 'singular'].includes(ch)) await pg.screenshot({ path: `${OUT}/${vn}-${ch}-${m === 'combo' ? 'mele' : 'disparo'}.jpg`, type: 'jpeg', quality: 66 });
        await CTX(false); await LIMPIA();
      }
    }
    await setHost('axioma'); await setModo('shooter');
    // editor: arrastrar el botón de melee cambia su posición guardada, y el editor no tapa botones
    await pg.evaluate(() => { window.__api.session.paused = true; window.__api.touch.edit(true); }); await pg.waitForTimeout(200);
    const r = await pg.evaluate(CHK, false); console.log(vn, '  editor', r.out.length ? '\n    ' + r.out.join('\n    ') : 'sin solapes'); overlaps += r.out.length;
    const box = await pg.locator('.tc-melee').boundingBox(); const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2; await T('touchStart', [{ x: cx, y: cy, id: 1 }]); for (let i = 1; i <= 5; i++) await T('touchMove', [{ x: cx - i * 6, y: cy + i * 4, id: 1 }]); await T('touchEnd', []); await pg.waitForTimeout(150);
    const moved = await pg.evaluate(() => { const e = document.querySelector('.tc-melee'); return [e.style.getPropertyValue('--dx'), e.style.getPropertyValue('--dy')]; });
    const okMove = moved[0] === '-30px' && moved[1] === '20px'; console.log(vn, '  editor mueve MELEE:', moved.join(' '), okMove ? 'ok' : 'FALLA'); if (!okMove) overlaps++;
    await pg.screenshot({ path: `${OUT}/${vn}-editor.jpg`, type: 'jpeg', quality: 70 });
    await pg.evaluate(() => { window.__api.touch.edit(false); window.__api.session.paused = false; });
  } else { // PC: panel del Huésped en los dos modos + pista de teclas
    await pg.evaluate(() => { window.__api.settings().showKeys = true; });
    for (const ch of HOSTS_BY(vn)) {
      await setHost(ch);
      for (const m of ['shooter', 'combo']) {
        await setModo(m); await pg.evaluate(PEOR); await pg.evaluate(() => { const k = document.getElementById('keyhint'); if (k) k.classList.add('on'); });
        const r = await pg.evaluate(CHK, false); const filas = await pg.evaluate(() => [...document.querySelectorAll('#huesped .hs')].map((e) => e.dataset.k).join(','));
        const ok3 = filas === 'mov,esp,s3,ult'; log(vn, `  huésped ${ch} ${m === 'combo' ? 'Melé' : 'Disparo'}`, { out: r.out, btn: null }, `[filas ${filas}${ok3 ? '' : ' FALLA'}]`); if (!ok3) overlaps++;
        if (ch === HOSTS_BY(vn)[0]) await pg.screenshot({ path: `${OUT}/${vn}-${ch}-${m === 'combo' ? 'mele' : 'disparo'}.jpg`, type: 'jpeg', quality: 70 });
        await LIMPIA();
      }
    }
  }
  await setModo('shooter'); await pg.waitForTimeout(300); await LIMPIA(); await pg.screenshot({ path: `${OUT}/${vn}.jpg`, type: 'jpeg', quality: 78 }); await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores JS', '| problemas de HUD:', overlaps); await b.close(); await srv.close(); process.exit(overlaps ? 1 : 0);
