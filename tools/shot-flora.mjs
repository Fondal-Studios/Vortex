// Capturas de la FLORA INTERACTIVA y la vegetación psicodélica dentro del juego real (Chromium por software, como tools/shot-nieblas.mjs).
// Uso: node tools/shot-flora.mjs [m1|…|m6|todas] [carpeta=shots/flora] [calidad=low|medium|high] [modo=jardin|aviso|nubes|cerca]
//   jardin → vista general desde atrás del Huésped hacia un grupo de plantas de la arena
//   aviso  → una planta ofensiva armando (anillo rojo/magenta llenándose) con el Huésped delante
//   nubes  → nube de esporas (veneno y sueño) sobre el Huésped
//   cerca  → el Huésped entre plantas curativas (flores abiertas, pasto aplastado)
// Imprime también las llamadas de dibujo y triángulos que agrega la flora (renderer.info con y sin su raíz).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const args = process.argv.slice(2), WHICH = args[0] || 'todas', OUT = args[1] || 'shots/flora', Q = args[2] || 'low', MODO = args[3] || 'jardin';
const maps = WHICH === 'todas' ? ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] : [WHICH];
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
for (const MAP of maps) {
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`[${MAP}] ${m.text().slice(0, 200)}`); });
  pg.on('pageerror', (e) => errors.push(`[${MAP}] PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=${MAP}&bot=1&god=1&wave=2&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1&cam=third${process.env.LIMPIO ? '&limpio=1' : ''}`, { timeout: 240000 });
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 180000 });
  await pg.waitForTimeout(3000);
  await pg.evaluate(async (modo) => {
    const s = window.__api.session, g = s.game, p = g.players[0], r = window.__api.renderer;
    s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
    g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true; g.wave = 3; g.phase = 'wave';
    const F = g.fl, qs = F.p.filter((q) => q.st !== 4);
    const pick = modo === 'aviso' ? qs.find((q) => q.sp.fn === 'ofensiva' && q.sp.p.tel) : modo === 'nubes' ? qs.find((q) => q.sp.tipo === 'hongo' || q.sp.tipo === 'narcotica') || qs.find((q) => q.sp.fn === 'ofensiva') : modo === 'cerca' ? qs.find((q) => q.sp.fn === 'cura') : qs.find((q) => q.sp.fn === 'ofensiva');
    const dens = (q) => qs.filter((o) => Math.hypot(o.pos.x - q.pos.x, o.pos.y - q.pos.y, o.pos.z - q.pos.z) < 8).length;
    const t = (modo === 'jardin' ? qs.slice().sort((x, y) => dens(y) - dens(x))[0] : pick) || qs[0], u = t.u, t1 = (() => { const a = Math.abs(u.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }; const c = { x: u.y * a.z - u.z * a.y, y: u.z * a.x - u.x * a.z, z: u.x * a.y - u.y * a.x }; const l = Math.hypot(c.x, c.y, c.z); return { x: c.x / l, y: c.y / l, z: c.z / l }; })();
    const D = modo === 'cerca' ? 2.4 : modo === 'aviso' ? 2.2 : 4, at = (f, h) => ({ x: t.pos.x - t1.x * f + u.x * h, y: t.pos.y - t1.y * f + u.y * h, z: t.pos.z - t1.z * f + u.z * h });
    p.pos = at(D, 0.9); p.vel = { x: 0, y: 0, z: 0 }; p.heading = { ...t1 }; p.up = { ...u }; p.hp = 1e6; p.shield = 100;
    for (const q of F.p) { if (q.st !== 4 && q.sp.fn === 'ofensiva' && q !== t) { q.cd = g.time + 1e6; } }
    const { blocked } = await import('/src/sim/physics.js'), look = at(-1.5, 0.6), rot = (a, k) => ({ x: a.x * Math.cos(k) + (u.y * a.z - u.z * a.y) * Math.sin(k), y: a.y * Math.cos(k) + (u.z * a.x - u.x * a.z) * Math.sin(k), z: a.z * Math.cos(k) + (u.x * a.y - u.y * a.x) * Math.sin(k) });
    let cam = at(D + 3.5, 3.4);   // se prueba desde varios lados y alturas hasta encontrar una vista despejada (sin muros, techos ni cajas en el medio)
    outer: for (const h of [3.4, 5.2, 7.5]) for (const k of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 3.1]) {
      const d = rot(t1, k), c = { x: t.pos.x - d.x * (D + 3.5) + u.x * h, y: t.pos.y - d.y * (D + 3.5) + u.y * h, z: t.pos.z - d.z * (D + 3.5) + u.z * h };
      let ok = !blocked(g.map, c); for (let s = 0.05; ok && s < 1; s += 0.05) if (blocked(g.map, { x: c.x + (look.x - c.x) * s, y: c.y + (look.y - c.y) * s, z: c.z + (look.z - c.z) * s })) ok = false;
      if (ok) { cam = c; break outer; }
    }
    const orig = r.updateCamera.bind(r);
    r.updateCamera = (me, dt, lk) => { orig(me, dt, lk); r.camera.position.set(cam.x, cam.y, cam.z); r.camera.up.set(u.x, u.y, u.z); r.camera.lookAt(look.x, look.y, look.z); r.eye = r.camera.position.clone(); };
    window.__avanza = (seg) => { for (let i = 0; i < seg * 60; i++) { p.pos = i % 30 === 0 ? p.pos : p.pos; g.step(1 / 60); } };
    window.__t = t; window.__F = F;
    if (new URLSearchParams(location.search).get('limpio') !== null || window.__LIMPIO) for (const id of ['hud', 'banner']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
    if (modo === 'aviso') { t.cd = 0; t.st = 1; }
    window.__avanza(2);
  }, MODO);
  if (MODO === 'aviso') { await pg.evaluate(() => { const t = window.__t; window.__avanza(0.1 + 0.6); }); }
  if (MODO === 'nubes') await pg.evaluate(() => { const g = window.__api.session.game, t = window.__t; g.fl.nubes.push({ id: 90, tipo: 'veneno', pos: { x: t.pos.x + t.u.x * 0.7, y: t.pos.y + t.u.y * 0.7, z: t.pos.z + t.u.z * 0.7 }, u: t.u, r: 4.6, t0: g.time, vida: 60, by: 0, S: t.sp }); window.__avanza(0.5); });
  await pg.waitForTimeout(3500);
  const info = await pg.evaluate(() => new Promise((res) => {
    const r = window.__api.renderer, hidden = [], root = r.flfx && r.flfx.root; if (!root) return res({ error: 'sin flfx' });
    for (const c of r.scene.children) if (c !== root && !c.isLight && !c.isCamera && c.visible) { c.visible = false; hidden.push(c); }
    for (const c of r.camera.children) if (c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
    const upd = r.flfx.update, medir = (cb) => { const t0 = r.t, iv = setInterval(() => { if (r.t - t0 > 0.12) { clearInterval(iv); const i = r.gl.info; cb({ calls: i.render.calls, tris: i.render.triangles }); } }, 25); };
    r.flfx.update = function () { this.root.visible = false; };   // sin: nada de la flora
    medir((sin) => { r.flfx.update = upd; root.visible = true; medir((con) => { hidden.forEach((h) => { h.visible = true; }); const m = r.flfx, n = (x) => (x ? x.geometry.attributes.position.count / 3 : 0); res({ objetivo: (() => { const t = window.__t, f = r.flfx, pos = f.mesh.geometry.attributes.position; let best = 1e9; for (let i = 0; i < pos.count; i++) best = Math.min(best, Math.hypot(pos.array[i * 3] - t.pos.x, pos.array[i * 3 + 1] - t.pos.y, pos.array[i * 3 + 2] - t.pos.z)); return { id: t.id, st: t.st, cam: Math.hypot(r.camera.position.x - t.pos.x, r.camera.position.y - t.pos.y, r.camera.position.z - t.pos.z), vert: best, uS: f.U.uS.value[t.i].toArray() }; })(), sin, con, calls: con.calls - sin.calls, tris: con.tris - sin.tris, desglose: { plantas: n(m.mesh), marcas: n(m.marks), pasto: n(m.grass), nubes: n(m.clouds), motas: m.motes ? m.motes.geometry.attributes.position.count : 0 } }); }); });
  }));
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${OUT}/${MAP}-${MODO}-${Q}.png`, timeout: 240000 });
  console.log(`${MAP} ${MODO} ${Q}:`, JSON.stringify(info));
  await pg.close();
}
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].slice(0, 10).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
