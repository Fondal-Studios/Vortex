// Capturas del Art Gate de efectos de combate: node tools/shot-combatfx.js <ids|todas> [calidad=low] [salida=shots/gate/combatfx]
// Dispara cada arma contra criaturas y saca 2 fotos (a los ~0,15 s y ~0,5 s), más escenas de explosión, muerte, estados y daño.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const arg = process.argv[2] || '15,16';
const q = process.argv[3] || 'low';
const out = process.argv[4] || 'shots/gate/combatfx';
fs.mkdirSync(out, { recursive: true });
const IDS = arg === 'todas' ? [...Array(25).keys()] : arg === 'escenas' ? [] : arg.split(',').filter((x) => /^\d+$/.test(x)).map(Number);
const SCENES = arg === 'todas' || arg === 'escenas' ? ['boom', 'muerte', 'estados', 'daño', 'pozo', 'elite'] : arg.split(',').filter((x) => !/^\d+$/.test(x));
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const pg = await b.newPage({ viewport: { width: 1000, height: 560 } }); pg.setDefaultTimeout(180000);
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); if (m.type() === 'log' && m.text().startsWith('FXSTAT')) console.log(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`${base}/?auto=m1&god=1&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1&fxdebug=1`); await pg.waitForTimeout(3500);
// HUD de combate: se engancha desde afuera (el dueño lo integra en main.js; ver docs/gate/combatfx.md)
await pg.evaluate(async () => {
  const { createCombatHud } = await import('/src/client/hud-combat.js'); const r = window.__api.renderer, hud = createCombatHud(document.getElementById('hud')); window.__hud = hud;
  const orig = r.render.bind(r); r.render = (state, dt, id, look) => { const me = state.players.find((p) => p.id === id) || state.players[0]; for (const e of state.events) hud.onEvent(e, me, r.camera); orig(state, dt, id, look); hud.update(dt, state, me); };
});
// Congela los efectos (no el juego) a los N segundos del primer disparo para que la foto muestre el instante buscado.
await pg.evaluate(() => {
  const fx = window.__api.renderer.fx, C = fx.combat; fx.__orig = fx.update.bind(fx); fx.update = (dt) => { if (!fx.__frozen) fx.__orig(dt * 0.2); }; // cámara lenta x5: los trazadores rápidos se dejan ver
  window.__arm = (sec) => new Promise((res) => { C.__t0 = null; fx.__frozen = false; delete C.frame; delete C.event; delete C.shot; const iv = setInterval(() => { if (C.__t0 == null && C.shots.length) C.__t0 = C.t; if (C.__t0 != null && C.t - C.__t0 >= sec) { fx.__frozen = true; C.frame = () => {}; C.event = () => {}; C.shot = () => {}; clearInterval(iv); res(); } }, 4); setTimeout(() => { clearInterval(iv); fx.__frozen = true; res(); }, 4000); });
  window.__thaw = () => { fx.__frozen = false; delete C.frame; delete C.event; delete C.shot; };
});
const snap = async (name, secs) => { await pg.evaluate((s) => window.__arm(s), secs); await pg.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 84 }); await pg.evaluate(() => window.__thaw()); };
const prep = (id, kinds) => pg.evaluate(async ({ id, kinds }) => {
  window.__thaw && window.__thaw(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true;
  p.weapon = id; p.ammo[id] = 999; p.hp = 100;
  { const fx = window.__api.renderer.fx, C = fx.combat; C.shots.length = 0; C.nums.items.length = 0; fx.add.clear(); fx.smoke.clear(); fx.strips.clear(); for (const m of [...fx.rings, ...fx.flashes, ...fx.decals, ...fx.chunks, ...fx.blasts]) { m.visible = false; m.life = 0; } }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const f = (d, s = 0) => ({ x: p.pos.x + p.heading.x * d - p.heading.z * s, y: p.pos.y + 1, z: p.pos.z + p.heading.z * d + p.heading.x * s });
  const L = [[12, 0], [16, 4], [16, -4], [22, 0], [20, 7], [20, -7]];
  kinds.forEach((k, i) => { const [d, s] = L[i % L.length]; const m = g.spawnMonster(k, f(d, s)); m.open = true; m.cd = 1e9; m.cd2 = 1e9; m.speedMul = 0; m.hp = m.maxhp = 1e5; });
}, { id, kinds });
for (const id of IDS) {
  await prep(id, ['lente', 'prisma', 'geoda', 'cuarzo', 'astilla', 'obelisco']);
  await pg.mouse.down(); const nn = String(id).padStart(2, '0'); await snap(`arma-${nn}-a`, 0.05); await snap(`arma-${nn}-b`, 0.22); await pg.mouse.up();
  await pg.waitForTimeout(300);
}
const shot = (n) => pg.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 84 });
for (const sc of SCENES) {
  if (sc === 'boom') { await prep(3, ['astilla', 'prisma', 'lente', 'geoda']); await pg.mouse.down(); await pg.waitForTimeout(950); await shot('escena-boom-a'); await pg.waitForTimeout(250); await shot('escena-boom-b'); await pg.mouse.up(); }
  if (sc === 'muerte') { await prep(0, ['astilla', 'astilla', 'prisma', 'lente']); await pg.evaluate(() => { for (const m of window.__api.session.game.monsters) m.hp = m.maxhp = 40; }); await pg.mouse.down(); await pg.waitForTimeout(700); await shot('escena-muerte-a'); await pg.waitForTimeout(250); await shot('escena-muerte-b'); await pg.mouse.up(); }
  if (sc === 'estados') {
    for (const [id, nm] of [[18, 'fuego'], [17, 'veneno'], [16, 'hielo']]) { await prep(id, ['geoda', 'lente', 'astilla', 'cuarzo']); await pg.evaluate(() => { for (const m of window.__api.session.game.monsters) m.open = true; }); await pg.mouse.down(); await pg.waitForTimeout(900); await pg.mouse.up(); await pg.waitForTimeout(500); await shot(`estado-${nm}`); }
  }
  if (sc === 'daño') { await prep(2, ['geoda', 'lente', 'cuarzo']); await pg.mouse.down(); await pg.waitForTimeout(800); await shot('escena-numeros'); await pg.mouse.up(); }
  if (sc === 'pozo') { await prep(11, ['astilla', 'prisma', 'lente', 'geoda', 'cuarzo']); await pg.mouse.down(); await pg.waitForTimeout(1300); await pg.mouse.up(); await pg.waitForTimeout(400); await shot('escena-pozo-a'); await pg.waitForTimeout(900); await shot('escena-pozo-b'); }
  if (sc === 'elite') { await prep(3, ['astilla']); await pg.evaluate(() => { const g = window.__api.session.game; for (const m of g.monsters) { m.elite = true; m.hp = m.maxhp = 90; } }); await pg.mouse.down(); await pg.waitForTimeout(900); await shot('escena-elite'); await pg.mouse.up(); }
}
console.log(errors.length ? errors.slice(0, 6).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
