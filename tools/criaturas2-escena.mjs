// Captura EN ESCENA REAL (cámara libre) para criaturas-2. Uso:
//   node tools/criaturas2-escena.mjs <kind> <prefijo> <estados> [D=12] [H=2] [S=0] [Ly=1.2] [q=low] [map=m1]
// Normales: criatura pasiva a 14 m delante del jugador; estado forzado (s:hp:c). Cámara a D m de la criatura (desde el jugador), H alto, S lateral.
// Jefes (coloso|madre): IA real (wave=7, god); estados = coloso: idle,ray,stagger  madre: fire,vent,gestate,open ; se fuerzan por la mecánica.
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [kind, out, states = 'idle', D = '12', H = '2', S = '0', Ly = '1.2', q = 'low', map0 = ''] = process.argv.slice(2);
const boss = kind === 'coloso' || kind === 'madre'; const map = map0 || (kind === 'madre' ? 'm2' : 'm1');
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.HH || 720) } });
const errs = []; pg.on('console', (m) => { if (['error'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=${map}&bot=1&god=1&wave=${boss ? 7 : 1}&seed=3&q=${q}&autoq=0&skipintro=1`);
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
await pg.waitForTimeout(1500);
await pg.evaluate(({ kind, boss, D, H, S, Ly }) => {
  const s = window.__api.session, g = s.game, r = window.__api.renderer; s.bot = null; const p = g.players[0];
  if (!boss) {
    g.queue = []; g.monsters.length = 0;
    const def = window.__api.MONSTERS[kind], h = p.heading, u = p.up, dist = 14;
    const pos = { x: p.pos.x + h.x * dist + (def.fly ? u.x * 3 : 0), y: p.pos.y + h.y * dist + (def.fly ? u.y * 3 : 0), z: p.pos.z + h.z * dist + (def.fly ? u.z * 3 : 0) };
    const m = g.spawnMonster(kind, pos, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; window.__m = m; g.phase = 'intermission'; g.phaseT = 1e6;
  } else { g.phase = 'wave'; }
  window.__cam = { D, H, S, Ly };
  r.updateCamera = function () { // cámara propia
    const m = window.__m || g.boss; if (!m) return; const c = window.__cam; const THREE_V = r.camera.position.constructor;
    const mp = new THREE_V(m.pos.x, m.pos.y, m.pos.z), pp = new THREE_V(p.pos.x, p.pos.y, p.pos.z);
    const dir = mp.clone().sub(pp); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize(); const right = new THREE_V(-dir.z, 0, dir.x);
    this.camera.position.copy(mp).addScaledVector(dir, -c.D).addScaledVector(right, c.S); this.camera.position.y = mp.y - (m.def.fly ? 0 : 0.9 * m.r) + c.H;
    this.camera.up.set(0, 1, 0); this.camera.lookAt(mp.x, mp.y - (m.def.fly ? 0 : 0.9 * m.r) + c.Ly, mp.z); this.camera.updateMatrixWorld(); this.eye = this.camera.position.clone(); this.aim = dir;
  };
  r.vm.root.visible = false;
}, { kind, boss, D: +D, H: +H, S: +S, Ly: +Ly });
await pg.addStyleTag({ content: '#hud,.hud,#crosshair,#reticle,#vm,#toast,#wave,#banner{display:none!important}' });
if (boss) await pg.waitForFunction(() => window.__api.session.game.boss, null, { timeout: 300000 });
if (boss) await pg.evaluate(() => { const g = window.__api.session.game; window.__m = g.boss; const b = g.boss; b.hp = b.maxhp; g.players[0].hp = 1e9; });
const res = {};
for (const sdef of states.split(',')) {
  const [s, hp, c] = sdef.split(':');
  await pg.evaluate(({ s, hp, c, boss, kind }) => {
    const m = window.__m, g = window.__api.session.game; const hpf = hp ? +hp : 1; m.hp = m.maxhp * hpf;
    if (!boss) { m.state = s; m.open = s === 'open'; m.cloak = c === '1'; m.hurt = 0; return; }
    for (const q of g.monsters) if (q !== m && !q.dead && !q.def.boss) q.dead = true; g.monsters = g.monsters.filter((q) => !q.dead || q === m);
    if (kind === 'coloso') { m.stagger = 0; m.ray = null; m.rayCd = 99; if (s === 'ray') { m.rayCd = 0; } if (s === 'stagger') { m.stagger = 60; m.shield = false; } if (s !== 'stagger') m.shield = true; if (s === 'wind') { m.cd = 0; } }
    else { m.open = s === 'open'; m.openT = 60; if (s === 'vent') { m.ventT = 1.5; for (const v of m.valves) { v.hold = 99; v.on = true; v.cool = 0; } } if (s === 'gestate') { m.gest = 0; } if (s === 'fire') { m.pressure = +(c || 0.3); m.open = false; } if (s === 'open') m.pressure = 0; }
  }, { s, hp, c, boss, kind });
  await pg.waitForTimeout(+process.env.CS_WAIT || (boss ? 1800 : 2500));
  if (boss && kind === 'madre' && s === 'vent') await pg.evaluate(() => { const m = window.__m; m.ventT = 1.5; });
  const info = await pg.evaluate(() => { const r = window.__api.renderer, i = r.gl.info; const m = window.__m, e = r.ents.mon.get(m.id); let lo = 1e9, hi = -1e9; if (e) { const T = r.camera.position.constructor; e.object.updateMatrixWorld(true); const v = new T(); e.object.traverse((o) => { if (o.isMesh && o.geometry && o.visible && o.geometry.attributes.position) { const a = o.geometry.attributes.position; for (let k = 0; k < a.count; k += 3) { v.fromBufferAttribute(a, k).applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } } }); } return { calls: i.render.calls, tris: i.render.triangles, floorGap: +(lo - (m.pos.y - 0.9 * m.r)).toFixed(2), top: +(hi - (m.pos.y - 0.9 * m.r)).toFixed(2), r: m.r }; }).catch((e) => String(e));
  await pg.screenshot({ path: `${out}_${sdef.replace(/:/g, '_')}.jpg`, type: 'jpeg', quality: 88 }); res[sdef] = info;
}
console.log(kind, q, JSON.stringify(res), errs.slice(0, 4)); await b.close(); await srv.close();
