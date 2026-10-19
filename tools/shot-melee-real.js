// Juega de verdad en Melé (toques reales sobre ATAQUE 1 / HAB) y captura el HUD a 844x390. Uso: node tools/shot-melee-real.js [carpeta] [huésped]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/melee-real', CH = process.argv[3] || 'axioma'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await ctx.addInitScript(() => { try { localStorage.setItem('cristal.tut.v2', '1'); } catch { /* ok */ } });
await pg.goto(`http://localhost:${srv.port}/?guia=0&auto=m1&bot=0&input=touch&god=1&wave=2&seed=3&q=low&autoq=0`); await pg.waitForTimeout(6000);
await pg.evaluate(async (ch) => { const { Equipo } = await import('/src/client/equipo.js'); Equipo.char = ch; const s = window.__api.session; s.game.setLoadout(s.pid, ch, null); window.__api.setGameMode('combo'); }, CH);
await pg.waitForFunction(() => window.__api.session.game.players[0].mode === 'combo', null, { timeout: 60000 });
// enemigos quietos delante
await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; for (let i = 0; i < 4; i++) { const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * (3 + i * 0.6), y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * (3 + i * 0.6) + (i - 1.5) }, { noElite: true }); if (m) { m.passive = true; m.hp = m.maxhp = 4000; } } });
const cdp = await ctx.newCDPSession(pg); const T = (t, p) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: p });
const bx = await pg.locator('.tc-fire').boundingBox(); const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
for (let i = 0; i < 5; i++) { await T('touchStart', [{ x, y, id: 1 }]); await pg.waitForTimeout(90); await T('touchEnd', []); await pg.waitForTimeout(260); }
await T('touchStart', [{ x, y, id: 1 }]); await pg.waitForTimeout(500);
await pg.screenshot({ path: `${OUT}/${CH}-mele-combo.jpg`, type: 'jpeg', quality: 80 });
console.log(await pg.evaluate(() => JSON.stringify({ mode: window.__api.session.game.players[0].mode, snap: (({ md, cn, cw, cnm, rk, rp, mk }) => ({ md, cn, cw, cnm, rk, rp, mk }))(window.__api.session.game.snapshot().players[0]), combohud: document.querySelector('#combohud').className, txt: document.querySelector('#combohud').innerText })));
await T('touchEnd', []); await b.close(); await srv.close(); console.log(errs.join('\n') || 'sin errores JS');
