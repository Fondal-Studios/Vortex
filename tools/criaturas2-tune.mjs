// Prueba rápida de calibración de materiales EN ESCENA (Media/Alta): una sola sesión, varios juegos de uniformes.
// node tools/criaturas2-tune.mjs <kind> <prefijo> <q=medium> '<json de variantes>' [D H S Ly]
// variantes: [{"n":"base"},{"n":"a","alb":0.35,"lift":1.1,"env":0.1,"rim":0.5,"self":0.02,"spec":0.3,"coat":0.2}]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [kind, out, q = 'medium', vars = '[{"n":"base"}]', D = '9', H = '1.2', S = '3', Ly = '1.2', A = '0'] = process.argv.slice(2);
const V = JSON.parse(vars);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&bot=1&god=1&wave=1&seed=3&q=${q}&autoq=0&skipintro=1`, { timeout: 400000, waitUntil: 'commit' });
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
await pg.waitForTimeout(1500);
await pg.evaluate(({ kind, D, H, S, Ly, A }) => {
  const s = window.__api.session, g = s.game, r = window.__api.renderer; s.bot = null; const p = g.players[0];
  g.queue = []; g.monsters.length = 0; const def = window.__api.MONSTERS[kind], h = p.heading, u = p.up, dist = 14;
  const pos = { x: p.pos.x + h.x * dist + (def.fly ? u.x * 3 : 0), y: p.pos.y + h.y * dist + (def.fly ? u.y * 3 : 0), z: p.pos.z + h.z * dist + (def.fly ? u.z * 3 : 0) };
  const m = g.spawnMonster(kind, pos, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; window.__m = m; g.phase = 'intermission'; g.phaseT = 1e6;
  r.vm.root.visible = false;
  r.updateCamera = function () { const m = window.__m; const V = r.camera.position.constructor; const mp = new V(m.pos.x, m.pos.y, m.pos.z), pp = new V(p.pos.x, p.pos.y, p.pos.z), up = new V(p.up.x, p.up.y, p.up.z).normalize();
    const dir = mp.clone().sub(pp); dir.addScaledVector(up, -dir.dot(up)); dir.normalize(); const right = new V().crossVectors(dir, up).normalize(); const base = mp.clone().addScaledVector(up, m.def.fly ? 0 : -0.9 * m.r);
    const off = dir.clone().multiplyScalar(-D).addScaledVector(right, S).applyAxisAngle(up, A * Math.PI / 180); this.camera.position.copy(base).add(off).addScaledVector(up, H); this.camera.up.copy(up); this.camera.lookAt(base.clone().addScaledVector(up, Ly)); this.camera.updateMatrixWorld(); this.eye = this.camera.position.clone(); this.aim = dir; };
}, { kind, D: +D, H: +H, S: +S, Ly: +Ly, A: +A });
await pg.addStyleTag({ content: '#hud,.hud,#crosshair,#reticle,#vm,#toast,#wave,#banner{display:none!important}' });
for (const v of V) {
  await pg.evaluate((v) => {
    const r = window.__api.renderer, e = r.ents.mon.get(window.__m.id); if (!e) return;
    for (const m of e.mats) { if (!m.userData || !m.userData.u) continue; const u = m.userData.u; if (!u.uAlb) continue; // solo bioMaterial
      if (v.alb != null) u.uAlb.value = v.alb; if (v.vein != null) u.uVeinGlow.value = v.vein; if (v.crack != null) u.uCrackGlow.value = v.crack; if (v.cry != null) u.uCry.value = v.cry; if (v.lift != null) u.uLift.value = v.lift; if (v.rim != null) u.uRimK.value = v.rim; if (v.self != null) u.uSelf.value = v.self;
      if (v.env != null) m.envMapIntensity = v.env; if (v.spec != null && m.specularIntensity != null) m.specularIntensity = v.spec; if (v.coat != null && m.clearcoat != null) m.clearcoat = v.coat; if (v.sheen != null && m.sheen != null) m.sheen = v.sheen; if (v.metal != null) u.uMetal.value = v.metal; m.needsUpdate = false; }
  }, v);
  const t0 = await pg.evaluate(() => window.__api.renderer.t); await pg.waitForFunction((t0) => window.__api.renderer.t - t0 >= 0.3, t0, { timeout: 240000, polling: 200 });
  await pg.screenshot({ path: `${out}_${v.n}.jpg`, type: 'jpeg', quality: 88, timeout: 600000 });
}
console.log('ok', errs.slice(0, 3)); await b.close(); await srv.close();
