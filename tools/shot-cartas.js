// Revisa las tarjetas de mejora y los demás carteles (tutorial, pausa, final, caído) en 5 tamaños: 844×390, 667×375, 390×844, 1280×720 y 1920×1080.
// Falla (código 1) si algún elemento visible de las tarjetas queda fuera de la pantalla o si hay que desplazarse. Guarda capturas en la carpeta indicada (por defecto shots/cartas).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/cartas'; fs.mkdirSync(OUT, { recursive: true });
export const SIZES = [['movil-844x390', 844, 390, true], ['movil-667x375', 667, 375, true], ['vertical-390x844', 390, 844, true], ['pc-1280x720', 1280, 720, false], ['pc-1920x1080', 1920, 1080, false]];
// Las capturas son sólo para mirar: si el equipo va lento y una tarda demasiado, no se cae toda la prueba.
const snap = async (pg, o) => { try { await pg.screenshot({ timeout: 40000, ...o }); } catch (e) { console.log('(captura omitida: ' + e.message.split('\n')[0] + ')'); } };
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = []; let bad = 0;

// Revisa que todo elemento visible dentro de `rootSel` esté dentro del viewport. Devuelve la lista de problemas.
const CHECK = ([rootSel, mustFit]) => {
  const root = document.querySelector(rootSel), out = []; if (!root) return ['no existe ' + rootSel];
  const W = innerWidth, H = innerHeight, vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01; };
  const els = [root, ...root.querySelectorAll('*')].filter(vis);
  for (const el of els) { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.push(`FUERA ${el.tagName.toLowerCase()}.${el.className || el.id} (${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}) en ${W}×${H}`); }
  if (mustFit && root.scrollHeight > root.clientHeight + 1) out.push(`${rootSel}: hay que desplazarse (${root.scrollHeight} > ${root.clientHeight})`);
  if (root.scrollWidth > root.clientWidth + 1) out.push(`${rootSel}: desborde horizontal (${root.scrollWidth} > ${root.clientWidth})`);
  // ningún texto cortado dentro de una tarjeta
  for (const el of root.querySelectorAll('.ucard *')) if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.push(`texto cortado en ${el.className}`);
  return out;
};

// La caja entera dentro de la pantalla; si el contenido es más alto, tiene que poder desplazarse por dentro.
const BOX = (sel) => { const e = document.querySelector(sel), r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight, o = []; if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) o.push(`FUERA ${sel} (${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)})`); const sc = e.scrollHeight > e.clientHeight + 1, ov = getComputedStyle(e).overflowY; if (sc && !/auto|scroll/.test(ov)) o.push(`${sel}: contenido cortado sin desplazamiento`); return { o, sc }; };

for (const [vn, w, h, touch] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }); const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`));
  await pg.goto(`${base}/?auto=m1&nolock=1&god=1&seed=3&q=low&autoq=0${touch ? '&input=touch' : ''}`); await pg.waitForTimeout(4000);
  if (touch) await pg.evaluate(() => { const s = window.__api.session; s.touch = true; window.__api.touch.show(true); });
  // 0) tutorial real (aparece solo la primera vez): debe entrar entero; se cierra para seguir
  { await pg.waitForFunction(() => !document.querySelector('#tutorial').classList.contains('hidden'), null, { timeout: 15000 }).catch(() => {});
    const r = await pg.evaluate(BOX, '#tutorial'); console.log(vn, 'tutorial', r.o.length ? '\n  ' + r.o.join('\n  ') : 'ok', r.sc ? '(se desplaza por dentro)' : ''); bad += r.o.length;
    await snap(pg, { path: `${OUT}/${vn}-tutorial.jpg`, type: 'jpeg', quality: 70 }); await pg.evaluate(() => { const t = document.querySelector('#tutok'); if (t) t.click(); document.querySelector('#tutorial').classList.add('hidden'); }); }
  // 1) tarjetas con datos reales: dos mejoras normales y una especial (la descripción más larga)
  await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; g.wave = 2; g.phase = 'intermission'; g.phaseT = 1e9; p.cards = [{ w: p.slots[0], k: 'dmg' }, { w: p.slots[1], k: 'rate' }, { w: p.slots[2], k: 'mod', mod: 'cadena' }]; });
  await pg.waitForTimeout(900);
  let res = await pg.evaluate(CHECK, ['#cards', true]); // (la función se pasa tal cual)
  console.log(vn, 'tarjetas', res.length ? '\n  ' + res.join('\n  ') : 'ok'); bad += res.length;
  await snap(pg, { path: `${OUT}/${vn}-tarjetas.jpg`, type: 'jpeg', quality: 78 });
  // tarjetas con la mejor «peor caso»: textos largos
  await pg.evaluate(() => { document.querySelectorAll('.ucard .ud').forEach((d) => { d.textContent += ' Texto de prueba más largo para comprobar que la tarjeta crece sin salirse de la pantalla en ningún tamaño.'; }); });
  res = await pg.evaluate(CHECK, ['#cards', false]); // aquí se permite desplazarse, pero nunca desbordar a los lados
  const lateral = res.filter((x) => /desborde horizontal|texto cortado/.test(x)); console.log(vn, 'tarjetas (texto largo)', lateral.length ? '\n  ' + lateral.join('\n  ') : 'ok', '| desplazable:', await pg.evaluate(() => { const c = document.querySelector('#cards'); return c.scrollHeight > c.clientHeight + 1 ? 'sí' : 'no'; })); bad += lateral.length;
  await snap(pg, { path: `${OUT}/${vn}-tarjetas-largas.jpg`, type: 'jpeg', quality: 70 });
  // tocar/clicar la 3.ª tarjeta debe elegirla (antes los botones táctiles la tapaban)
  { const bx = await pg.locator('.ucard').nth(2).boundingBox(); const px = bx.x + bx.width / 2, py = bx.y + bx.height / 2;
    const top = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest && e.closest('.ucard')); }, [px, py]);
    if (touch) await pg.touchscreen.tap(px, py); else await pg.mouse.click(px, py);
    await pg.waitForFunction(() => window.__api.session.game.players[0].cards.length === 0, null, { timeout: 15000 }).catch(() => {});
    const left = await pg.evaluate(() => window.__api.session.game.players[0].cards.length);
    const vertical = h > w; // en vertical el juego pide girar el teléfono (cartel #rotate) y no se juega
    if (vertical) console.log(vn, 'elegir tarjeta: no aplica en vertical (se pide girar el teléfono)'); else { console.log(vn, 'elegir la 3.ª tarjeta con', touch ? 'un toque' : 'un clic', top && left === 0 ? 'ok' : `FALLA (encima: ${top}, cartas restantes: ${left})`); if (!(top && left === 0)) bad++; } }
  await pg.evaluate(() => { const g = window.__api.session.game; g.players[0].cards = []; g.phaseT = 3; g.wave = 2; });
  await pg.waitForTimeout(500);
  // 2) tutorial, pausa, final y caído
  for (const [id, label, fn] of [
    ['pause', 'pausa', () => { document.querySelector('#pause').classList.remove('hidden'); }],
    ['end', 'final', () => { document.querySelector('#pause').classList.add('hidden'); document.querySelector('#endtitle').textContent = 'ATRAPADO EN EL VÓRTICE'; document.querySelector('#endstats').textContent = 'Oleada 3/7\nTiempo 120 s\nTú 1: 40 bajas · 1200 pts\nOtro 2: 35 bajas · 900 pts\nOtro 3: 12 bajas · 400 pts'; document.querySelector('#end').classList.remove('hidden'); }],
    ['downed', 'caído', () => { document.querySelector('#end').classList.add('hidden'); const d = document.querySelector('#downed'); d.classList.remove('hidden'); d.textContent = 'CAÍDO · te desangrás 24 s · ¡pedí ayuda con T!'; }],
  ]) {
    await pg.evaluate(fn); await pg.waitForTimeout(250);
    const sel = id === 'pause' ? '#pause .pbox' : id === 'end' ? '#end .pbox' : '#' + id;
    // los carteles de pausa/final pueden desplazarse por dentro, pero la caja debe estar entera en la pantalla
    const r = await pg.evaluate(BOX, sel);
    console.log(vn, label, r.o.length ? '\n  ' + r.o.join('\n  ') : 'ok', r.sc ? '(se desplaza por dentro)' : ''); bad += r.o.length;
    await snap(pg, { path: `${OUT}/${vn}-${id}.jpg`, type: 'jpeg', quality: 70 });
  }
  await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'sin errores JS', '| problemas de tarjetas/carteles:', bad); await b.close(); await srv.close(); process.exit(bad ? 1 : 0);
