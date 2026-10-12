// Prueba de la percepción de caída y bordes (src/client/caida.js): borde de la isla, vacío debajo, caída rápida, caer al vacío y reaparecer, aterrizaje.
// Usa el simulador real: coloca al jugador cerca del borde, lo deja caer y revisa lo que se muestra. Capturas en shots/caida.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/caida'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = []; const fails = [];
const ok = (c, m) => { console.log(c ? 'ok   ' : 'FALLA', m); if (!c) fails.push(m); };
const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const pg = await ctx.newPage();
pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await pg.goto(`${base}/?auto=m1&nolock=1&god=1&seed=3&q=low&autoq=0&skipintro=1`); await pg.waitForTimeout(6000);
// Avanza `sec` segundos de juego a pasos fijos de 0,1 s (así la prueba no depende de la velocidad del equipo).
const sim = (sec) => pg.evaluate((n) => { for (let i = 0; i < n; i++) window.__step(100); }, Math.round(sec * 10));
const place = (x, y, z, hx = 1, hz = 0, pitch = -0.35) => pg.evaluate(([x, y, z, hx, hz, pitch]) => { const p = window.__api.session.game.players[0]; p.pos.x = x; p.pos.y = y; p.pos.z = z; p.vel.x = p.vel.y = p.vel.z = 0; p.heading.x = hx; p.heading.y = 0; p.heading.z = hz; p.pitch = pitch; }, [x, y, z, hx, hz, pitch]);
const dom = () => pg.evaluate(() => { const q = (s) => document.querySelector(s), vis = (e) => e && getComputedStyle(e).display !== 'none'; return { edge: vis(q('.cd-edge')) ? q('.cd-edge span').textContent : '', void: vis(q('.cd-void')) ? q('.cd-void span').textContent : '', vig: +q('.cd-vig').style.opacity || 0, msg: q('.cd-msg b').textContent, arrow: vis(q('.cd-arrow')) }; });
// 1) cerca del borde de la isla central (radio 26) mirando al vacío
await place(23.5, 0.9, 0); await sim(1);
let d = await dom(); console.log(JSON.stringify(d)); ok(/BORDE/.test(d.edge), 'aviso de borde cerca del límite: «' + d.edge + '»');
await pg.screenshot({ timeout: 120000, path: `${OUT}/1-borde.jpg`, type: 'jpeg', quality: 80 });
// 2) lejos del borde no hay aviso
await place(0, 0.9, 0); await sim(1); d = await dom(); ok(!d.edge && !d.void, 'sin avisos en el centro de la isla');
// 3) sobre el vacío: «vacío debajo», luego caída rápida con viñeta
await place(31, 0.9, 0, -1, 0, -0.9); await sim(0.5); d = await dom(); console.log(JSON.stringify(d)); ok(/VAC/.test(d.void), 'aviso «vacío debajo»: «' + d.void + '»');
await pg.screenshot({ timeout: 120000, path: `${OUT}/2-vacio.jpg`, type: 'jpeg', quality: 80 });
let maxVig = 0; for (let i = 0; i < 14; i++) { await sim(0.25); d = await dom(); maxVig = Math.max(maxVig, d.vig); if (d.vig > 0.4 && i > 3) await pg.screenshot({ timeout: 120000, path: `${OUT}/3-cayendo.jpg`, type: 'jpeg', quality: 80 }); if (/CAÍSTE/.test(d.msg) && d.msg) break; }
ok(maxVig > 0.3, 'viñeta de caída rápida (máx ' + maxVig.toFixed(2) + ')');
// 4) cae por debajo del mundo → mensaje y reaparición
await pg.evaluate(() => { const p = window.__api.session.game.players[0]; if (p.pos.y > -60) p.pos.y = -66; });
let msg = ''; for (let i = 0; i < 20 && !/CAÍSTE/.test(msg); i++) { await sim(0.2); msg = (await dom()).msg; }
ok(/CAÍSTE AL VACÍO/.test(msg), 'mensaje al caer fuera del mapa: «' + msg + '»'); await sim(0.5); d = await dom();
await pg.screenshot({ timeout: 120000, path: `${OUT}/4-reaparece.jpg`, type: 'jpeg', quality: 80 });
ok(d.arrow, 'flecha hacia la isla segura tras reaparecer'); ok(await pg.evaluate(() => window.__api.caida.state.falls) >= 1, 'se contó la caída al vacío');
// 5) aterrizaje fuerte (derivado de los datos: caída rápida y suelo)
await place(5, 14, 0, 1, 0, -0.3); await pg.evaluate(() => { const p = window.__api.session.game.players[0]; p.vel.y = -30; }); await sim(1.2);
const land = await pg.evaluate(() => window.__api.caida.state.lands); ok(land > 0, 'aterrizaje fuerte detectado (' + land + ')'); await pg.screenshot({ timeout: 120000, path: `${OUT}/5-aterrizaje.jpg`, type: 'jpeg', quality: 80 });
// 6) funciona con «reducir movimiento»
await pg.evaluate(() => localStorage.setItem('cristal.reduceMotion', '1')); await place(31, 0.9, 0); await sim(2.5); d = await dom(); ok(/VAC|CAÍSTE/.test(d.void + d.msg), 'con reducir movimiento los avisos siguen');
console.log(errors.length ? 'ERRORES JS:\n' + errors.join('\n') : 'sin errores JS'); await b.close(); await srv.close(); process.exit(fails.length || errors.length ? 1 : 0);
