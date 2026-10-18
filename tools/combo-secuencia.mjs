// Secuencias de cuadros del MODO COMBO (diagnóstico y verificación visual): ejecuta el combo completo de un Huésped en 3.ª (o 1.ª) persona contra muñecos
// pasivos y captura un cuadro cada ~80 ms de juego (reloj determinista ?cap=1 + __step). Arma una hoja de contactos por golpe (mosaico HTML → JPG).
// Uso: node tools/combo-secuencia.mjs [carpeta=/tmp/combo] [huesped=axioma] [golpes=todos|a1,a1,a2] [cam=third|first] [evo=4] [paso=80] [ancho=1]
// Salida: <carpeta>/<huesped>-<cam>-NN.jpg (cuadros) + <carpeta>/<huesped>-<cam>-hoja.jpg (contactos) + registro.json (clip, golpes, medidas de dibujo).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || '/tmp/combo', CHAR = process.argv[3] || 'axioma', SEQ = (process.argv[4] || 'todos'), CAM = process.argv[5] || 'third', EVO = +(process.argv[6] ?? 4), PASO = +(process.argv[7] || 80), COLS = 6;
fs.mkdirSync(OUT, { recursive: true });
const SECS = { todos: [['a1'], ['a1', 'a1'], ['a1', 'a1', 'a1'], ['a2'], ['a1', 'a2'], ['a1', 'a1', 'a2'], ['a1', 'a1', 'a1', 'a1'], ['a1', 'a1', 'a1', 'a2'], ['a2', 'a2'], ['a2', 'a1']] };
const seqs = SEQ === 'todos' ? SECS.todos : [SEQ.split(',')];
const srv = await startServer({ port: 0 }), b = await launch(), errors = [], reg = { char: CHAR, cam: CAM, golpes: [] };
const ctx = await b.newContext({ viewport: { width: 640, height: 400 } });
await ctx.addInitScript((c) => { try { localStorage.setItem('cristal.huesped.v1', c); } catch { /* ok */ } }, CHAR);
const pg = await ctx.newPage();
pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); if (/\[combo\]/.test(m.text())) console.log(m.text()); });
await pg.goto(`http://localhost:${srv.port}/?auto=m1&god=1&seed=3&q=low&autoq=0&nolock=1&skipintro=1&cam=${CAM}&modo=combo&cap=1&dev=1`, { timeout: 180000 });
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 90000 });
await pg.evaluate((evo) => {
  const A = window.__api, g = A.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; p.godmode = true; p.evo = evo; p.hp = 100;
  window.__btn = { a1: false, a2: false, mz: 0 }; const orig = g.setInput.bind(g);
  g.setInput = (id, inp) => orig(id, { ...inp, a1: window.__btn.a1, a2: window.__btn.a2, mz: window.__btn.mz || inp.mz || 0, mode: 'combo' });
  window.__dummies = () => { for (const m of g.monsters) m.dead = true; g.monsters.length = 0; const out = []; for (const [d, s] of [[2.6, 0], [3.2, 1.1], [3.4, -1.2]]) { const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * d + (p.heading.z) * s, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * d - (p.heading.x) * s }, { noElite: true }); if (m) { m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9; out.push(m); } } return out.length; };
}, EVO);
const step = (ms) => pg.evaluate((ms) => { for (let i = 0; i < Math.ceil(ms / 16); i++) window.__step(16); }, ms);
await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
for (let i = 0; i < 400; i++) { // carga del cuerpo (asíncrona: hay que seguir dando cuadros para que renderer.syncPlayers lo cree)
  await step(100); const ok = await pg.evaluate(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; return window.__api.renderer.third ? !!(e && e.body && e.body.isReady) : true; });
  if (ok) break; await pg.waitForTimeout(250); if (i === 399) errors.push('sin cuerpo listo');
}
await step(500);
const shots = [];
let n = 0;
for (const seq of seqs) {
  await pg.evaluate(() => { window.__btn.a1 = window.__btn.a2 = false; window.__dummies(); });
  await step(1200);
  const tag = seq.join('+'), frames = [], clips = [];
  const snap = async (lbl) => { const f = `${CHAR}-${CAM}-${String(n++).padStart(3, '0')}.jpg`; await pg.screenshot({ path: `${OUT}/${f}`, type: 'jpeg', quality: 70, timeout: 120000 }); frames.push({ f, lbl }); };
  await snap('reposo');
  for (let i = 0; i < seq.length; i++) {
    const nt = seq[i];
    await pg.evaluate((k) => { window.__btn[k] = true; }, nt); await step(50); await pg.evaluate((k) => { window.__btn[k] = false; }, nt);
    // 8 cuadros de ~PASO ms tras cada pulsación (anticipación → golpe → recuperación)
    const t = await pg.evaluate(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; return e && e.body ? 1 : 0; });
    for (let k = 0; k < (i === seq.length - 1 ? 9 : 4); k++) { await step(PASO); await snap(`${tag} #${i + 1} +${(k + 1) * PASO}ms`); clips.push(await pg.evaluate(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; const s = window.__api.session.game.players[0]; return { clip: e && e.body && e.body.person ? e.body.person.clip : '?', last: s.cb && s.cb.last, cmb: s.cmb }; })); }
    void t;
  }
  shots.push({ tag, frames });
  const m = await pg.evaluate(() => { const R = window.__api.renderer, i = R.gl.info.render; return { calls: i.calls, tris: i.triangles }; });
  reg.golpes.push({ tag, clips: clips.map((c) => `${c.clip}/${c.last}`).filter((x, i, a) => a.indexOf(x) === i), ...m });
}
fs.writeFileSync(`${OUT}/${CHAR}-${CAM}-registro.json`, JSON.stringify({ ...reg, errors: [...new Set(errors)] }, null, 1));
// hoja de contactos: una fila por secuencia
const html = `<html><body style="margin:0;background:#111;color:#fff;font:11px sans-serif">${shots.map((s) => `<div style="padding:4px"><b>${s.tag}</b><div style="display:flex;flex-wrap:wrap">${s.frames.map((f) => `<div style="width:${Math.floor(1920 / COLS)}px"><img src="file://${OUT}/${f.f}" style="width:100%"><br>${f.lbl}</div>`).join('')}</div></div>`).join('')}</body></html>`;
fs.writeFileSync(`${OUT}/${CHAR}-${CAM}-hoja.html`, html);
const hp = await (await b.newContext({ viewport: { width: 1920, height: 400 } })).newPage();
await hp.goto(`file://${OUT}/${CHAR}-${CAM}-hoja.html`); await hp.waitForTimeout(800);
await hp.screenshot({ path: `${OUT}/${CHAR}-${CAM}-hoja.jpg`, type: 'jpeg', quality: 75, fullPage: true, timeout: 120000 });
console.log(JSON.stringify(reg.golpes), errors.length ? 'ERRORES: ' + [...new Set(errors)].slice(0, 8).join(' | ') : 'sin errores');
await b.close(); await srv.close();
