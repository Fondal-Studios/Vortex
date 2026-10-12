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
const SCENES = arg === 'todas' || arg === 'escenas' ? ['boom', 'muerte', 'estados', 'daño', 'pozo', 'elite', 'recibido', 'vidabaja', 'racha', 'otros', 'habilidades'] : arg.split(',').filter((x) => !/^\d+$/.test(x));
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const pg = await b.newPage({ viewport: { width: 1000, height: 560 } }); pg.setDefaultTimeout(180000);
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); if (m.type() === 'log' && m.text().startsWith('FXSTAT')) console.log(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
await pg.goto(`${base}/?auto=m1&god=1&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1&fxdebug=1`); await pg.waitForTimeout(3500);
// HUD de combate: se engancha desde afuera (el dueño lo integra en main.js; ver docs/gate/combatfx.md)
await pg.evaluate(async () => {
  const { createCombatHud } = await import('/src/client/hud-combat.js'); const r = window.__api.renderer, hud = createCombatHud(document.getElementById('hud')); window.__hud = hud;
  const orig = r.render.bind(r); r.render = (state, dt, id, look) => { const me = state.players.find((p) => p.id === id) || state.players[0]; for (const e of state.events) hud.onEvent(e, me, r.camera); orig(state, dt, id, look); hud.update(dt, state, me); };
});
// Congela los efectos (no el juego) a los N segundos de un evento (shot | kill | boom) para que la foto muestre el instante buscado.
await pg.evaluate(() => {
  const fx = window.__api.renderer.fx, C = fx.combat; fx.__orig = fx.update.bind(fx); fx.update = (dt) => { if (!fx.__frozen) fx.__orig(dt * 0.2); }; // cámara lenta x5: los trazadores rápidos se dejan ver
  const P = Object.getPrototypeOf(C); for (const n of ['shot', 'kill', 'boom']) { const o = P[n]; P[n] = function (...a) { this.__ev = this.__ev || {}; this.__ev[n] = this.t; return o.apply(this, a); }; }
  window.__arm = (sec, key = 'shot') => new Promise((res) => { C.__ev = {}; fx.__frozen = false; delete C.frame; delete C.event; delete C.shot; const iv = setInterval(() => { const t0 = C.__ev[key]; if (t0 != null && C.t - t0 >= sec) { fx.__frozen = true; C.frame = () => {}; C.event = () => {}; C.shot = () => {}; clearInterval(iv); res(); } }, 4); setTimeout(() => { clearInterval(iv); fx.__frozen = true; res(); }, 12000); });
  window.__thaw = () => { fx.__frozen = false; delete C.frame; delete C.event; delete C.shot; };
});
const snap = async (name, secs, key = 'shot') => { await pg.evaluate(([s, k]) => window.__arm(s, k), [secs, key]); await pg.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 84 }); await pg.evaluate(() => window.__thaw()); };
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
  if (sc === 'boom') { await prep(3, ['astilla', 'prisma', 'lente', 'geoda']); await pg.mouse.down(); await snap('escena-boom-a', 0.1, 'boom'); await snap('escena-boom-b', 0.5, 'boom'); await pg.mouse.up(); }
  if (sc === 'muerte') {
    for (const [nm, ks, w] of [['astilla', ['astilla', 'astilla'], 0], ['cristal', ['prisma', 'lente'], 0], ['hielo', ['astilla', 'cuarzo'], 16], ['fuego', ['astilla', 'lente'], 18], ['rayo', ['astilla', 'prisma'], 15]]) {
      await prep(w, ks); await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; let i = 0; for (const m of g.monsters) { m.hp = m.maxhp = 30; const d = 8 + i * 2.5, s = i ? 3 : -1; m.pos.x = p.pos.x + p.heading.x * d - p.heading.z * s; m.pos.z = p.pos.z + p.heading.z * d + p.heading.x * s; m.pos.y = p.pos.y + 0.5; i++; } });
      await pg.mouse.down(); await snap(`muerte-${nm}-a`, 0.12, 'kill'); await snap(`muerte-${nm}-b`, 0.55, 'kill'); await pg.mouse.up();
    }
  }
  if (sc === 'estados') {
    for (const [id, nm] of [[18, 'fuego'], [17, 'veneno'], [16, 'hielo']]) { await prep(id, ['geoda', 'lente', 'astilla', 'cuarzo']); await pg.evaluate(() => { for (const m of window.__api.session.game.monsters) m.open = true; }); await pg.mouse.down(); await pg.waitForTimeout(900); await pg.mouse.up(); await pg.waitForTimeout(500); await shot(`estado-${nm}`); }
  }
  if (sc === 'daño') { await prep(2, ['geoda', 'lente', 'cuarzo']); await pg.mouse.down(); await pg.waitForTimeout(800); await shot('escena-numeros'); await pg.mouse.up(); }
  if (sc === 'pozo') { await prep(11, ['astilla', 'prisma', 'lente', 'geoda', 'cuarzo']); await pg.mouse.down(); await pg.waitForTimeout(1300); await pg.mouse.up(); await pg.waitForTimeout(400); await shot('escena-pozo-a'); await pg.waitForTimeout(900); await shot('escena-pozo-b'); }
  if (sc === 'otros') { // disparos de OTROS jugadores (fogonazo de mundo): se fabrican eventos con pid ajeno desde 15 m a la izquierda
    for (const w of [15, 18, 4, 3]) {
      await prep(w, ['lente']); await pg.evaluate(async (w) => { window.__thaw && window.__thaw(); const r = window.__api.renderer, C = r.fx.combat, g = window.__api.session.game, p = g.players[0], m = g.monsters[0];
        const o = [p.pos.x + p.heading.x * 14 - p.heading.z * 14, p.pos.y + 1.2, p.pos.z + p.heading.z * 14 + p.heading.x * 14];
        const tip = [m.pos.x, m.pos.y, m.pos.z]; const e = { t: 'shot', pid: 77, w, o, to: [tip, tip, tip] }; const st = { players: [{ id: p.id }], monsters: [], projectiles: [], events: [e], objs: [], fx: {}, map: 'm1' };
        C.frame(r, Object.assign(window.__api.session.lastState || st, { events: [e] }), { id: p.id, pos: [p.pos.x, p.pos.y, p.pos.z] }); C.event = C.event; C.shot(e, null); await new Promise((r2) => setTimeout(r2, 60)); }, w);
      await pg.evaluate(() => { const fx = window.__api.renderer.fx; fx.__frozen = true; }); await pg.waitForTimeout(200); await shot(`otros-${w}`); await pg.evaluate(() => window.__thaw());
    }
  }
  if (sc === 'habilidades') {
    for (const [id, ch] of [['embestida', 'egida'], ['onda', 'egida'], ['paso', 'lumen'], ['propulsor', 'forja'], ['deslizamiento', 'vigia'], ['salto', 'nova'], ['fase', 'umbra'], ['rayo', 'lumen']]) {
      await prep(0, []); await pg.evaluate(async ([id, ch]) => { window.__thaw && window.__thaw(); const r = window.__api.renderer, C = r.fx.combat, g = window.__api.session.game, p = g.players[0]; p.char = ch; await new Promise((q) => setTimeout(q, 100));
        const pos = [p.pos.x, p.pos.y, p.pos.z]; const pl = { id: p.id, pos, h: [p.heading.x, p.heading.y, p.heading.z], char: ch }; C.state = { players: [pl], objs: [], monsters: [] };
        if (id === 'rayo') C.beamFx({ o: [p.pos.x + p.heading.x, p.pos.y + 1, p.pos.z + p.heading.z], to: [p.pos.x + p.heading.x * 28, p.pos.y + 1, p.pos.z + p.heading.z * 28], c: 'heal' }); else C.skill({ id, pid: p.id, p: [p.pos.x + p.heading.x * 3, p.pos.y, p.pos.z + p.heading.z * 3] }); await new Promise((q) => setTimeout(q, 120)); }, [id, ch]);
      await pg.evaluate(() => { window.__api.renderer.fx.__frozen = true; }); await pg.waitForTimeout(200); await shot(`habilidad-${id}`);
    }
  }
  if (sc === 'recibido') {
    await prep(0, ['astilla']); await pg.evaluate(async () => { window.__thaw && window.__thaw(); const g = window.__api.session.game, p = g.players[0]; p.godmode = false; p.hp = 100; p.shield = 0; const m = g.monsters[0]; const d = { x: p.pos.x - p.heading.x * 8 + p.heading.z * 9, y: p.pos.y + 1, z: p.pos.z - p.heading.z * 8 - p.heading.x * 9 }; m.pos.x = d.x; m.pos.y = d.y; m.pos.z = d.z; m.cd = 1e9; m.speedMul = 0;
      await new Promise((r) => setTimeout(r, 150)); g.hurtPlayer(p, 22); await new Promise((r) => setTimeout(r, 90)); g.hurtPlayer(p, 14); });
    await pg.waitForTimeout(350); await shot('escena-recibido'); await pg.evaluate(() => { window.__api.session.game.players[0].godmode = true; });
  }
  if (sc === 'vidabaja') {
    await prep(0, []); await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; p.godmode = false; p.hp = 16; p.shield = 0; }); await pg.waitForTimeout(900); await shot('escena-vidabaja-a'); await pg.waitForTimeout(500); await shot('escena-vidabaja-b'); await pg.evaluate(() => { window.__api.session.game.players[0].godmode = true; });
  }
  if (sc === 'racha') {
    await prep(2, ['astilla', 'astilla', 'astilla', 'prisma', 'lente']); await pg.evaluate(() => { for (const m of window.__api.session.game.monsters) m.hp = m.maxhp = 24; }); await pg.mouse.down(); await pg.waitForTimeout(2200); await shot('escena-racha'); await pg.mouse.up();
  }
  if (sc === 'elite') { await prep(3, ['astilla']); await pg.evaluate(() => { const g = window.__api.session.game; for (const m of g.monsters) { m.elite = true; m.hp = m.maxhp = 90; } }); await pg.mouse.down(); await snap('escena-elite-a', 0.1, 'kill'); await snap('escena-elite-b', 0.5, 'kill'); await pg.mouse.up(); }
}
console.log(errors.length ? errors.slice(0, 6).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
