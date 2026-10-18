// Capturas y medición de las ARENAS VIVAS (m1…m6) dentro del juego real, con Chromium por software (modelo: tools/shot-limbo.js).
// Uso: node tools/shot-arenas.js [m1|…|m6|todas] [carpeta=shots/arenas] [calidad=low] [--fase=dormido|despierto|furioso|ofrenda|aviso]
// Por cada vista imprime las llamadas de dibujo y triángulos de «escena» y de «sólo arenas vivas» (se oculta todo lo demás un cuadro).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import { MAPS } from '../src/sim/maps.js';
import { layoutArena, centroOrgano } from '../src/sim/arenas-vivas.js';
const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
const WHICH = pos[0] || 'todas', OUT = pos[1] || 'shots/arenas', Q = pos[2] || 'low';
const FASES = ((args.find((a) => a.startsWith('--fase=')) || '--fase=furioso').slice(7)).split(',');
const maps = WHICH === 'todas' ? ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] : [WHICH];
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [], resumen = [];
for (const MAP of maps) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${MAP}] ${m.text().slice(0, 300)}`); });
  pg.on('pageerror', (e) => errors.push(`[${MAP}] PAGEERR ${e.message}`));
  await pg.goto(`${base}/?auto=${MAP}&bot=1&god=1&wave=2&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1`);
  await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 60000 });
  await pg.waitForTimeout(4000);
  await pg.evaluate(() => {
    const s = window.__api.session, g = s.game;
    const st = document.createElement('style'); st.textContent = '#hud, #cards, #objective, #pings, #sub{display:none !important}'; document.head.appendChild(st);
    s.bot = () => ({ mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 });
    g.queue = []; g.phaseT = 1e9; for (const m of g.monsters) m.dead = true;
    const r = window.__api.renderer, orig = r.updateCamera.bind(r);
    r.updateCamera = (me, dt, look) => { orig(me, dt, look); const c = window.__shotCam; if (c) { r.camera.position.set(c.x, c.y, c.z); r.camera.rotation.order = 'YXZ'; r.camera.rotation.set(c.pitch, -c.yaw, 0); r.eye = r.camera.position.clone(); } };
    const sp = r.syncPlayers.bind(r); r.syncPlayers = (...a) => { sp(...a); for (const o of r.ents.ply.values()) (o.object || o).visible = false; for (const c of r.camera.children) if (!c.isLight) c.visible = false; };
  });
  const L = layoutArena(MAPS[MAP]);
  for (const fase of FASES) {
    await pg.evaluate((fase) => { // fuerza la fase: oleada 3 en curso con el tiempo adecuado
      const g = window.__api.session.game, A = g.ar; A.sed = false; for (const S of A.org) { S.roto = false; S.hp = S.max; S.fed = 0; S.zone = 0; S.cd = 1.0; }
      g.wave = Math.max(3, g.wave); g.phase = fase === 'ofrenda' ? 'intermission' : 'wave'; g.phaseT = 1e9; A.wave = g.wave; A.tl = [];
      A.t0 = g.time - (fase === 'despierto' ? 5 : 60); if (fase === 'dormido') A.sed = true;
    }, fase);
    for (const [vi, o] of L.org.entries()) {
      const c = centroOrgano(o), up = o.u;
      // cámara: 14 m detrás-arriba del órgano mirando hacia él (en m2 respeta la gravedad radial con la mirada)
      const from = { x: c.x + 11 * (up.y > 0.9 ? 1 : 0.6), y: c.y + 4.2, z: c.z + 11 * (up.y > 0.9 ? 0 : 0.6) };
      if (o.k === 'vena') { from.x = o.pos.x - 9; from.z = o.pos.z - 9; from.y = 4; }
      let to = o.k === 'vena' ? o.pos : c, jug = null;
      if (fase === 'aviso' && o.atk && up.y > 0.9) { // vista elevada del aviso: el jugador (que el ataque marca) está a 8 m del órgano y la cámara lo mira desde atrás y arriba
        jug = { x: o.pos.x + 4, y: 0.9, z: o.pos.z + 8 }; from.x = jug.x + 2; from.y = 9; from.z = jug.z + 11; to = { x: o.pos.x + 2, y: 0, z: o.pos.z + 2 };
      }
      const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, yaw = Math.atan2(dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await pg.evaluate(([from, yaw, pitch, jug]) => { const g = window.__api.session.game, p = g.players[0]; p.pos = jug ? { ...jug } : { x: from.x, y: from.y, z: from.z }; p.vel = { x: 0, y: 0, z: 0 }; p.hp = 100; window.__shotCam = { x: from.x, y: from.y, z: from.z, yaw, pitch }; }, [from, yaw, pitch, jug]);
      if (fase === 'aviso' && o.atk) await pg.evaluate((i) => { const g = window.__api.session.game, S = g.ar.org[i]; S.cd = 0.05; }, vi);
      await pg.evaluate(() => new Promise((res) => { const r = window.__api.renderer, t0 = r.t; const iv = setInterval(() => { if (r.t - t0 > (window.__espera || 1.4)) { clearInterval(iv); res(); } }, 100); }));
      await pg.waitForTimeout(800);
      const info = await pg.evaluate(() => {
        const r = window.__api.renderer, i = r.gl.info, esc = { calls: i.render.calls, tris: i.render.triangles };
        const hidden = [];
        return new Promise((res) => {
          for (const c of r.scene.children) if (c !== r.avfx.root && !c.isLight && !c.isCamera && c.visible) { c.visible = false; hidden.push(c); }
          for (const c of r.camera.children) if (c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
          const t0 = r.t; const iv = setInterval(() => { if (r.t - t0 > 0.15) { clearInterval(iv); const j = r.gl.info; hidden.forEach((h) => { h.visible = true; }); res({ esc, solo: { calls: j.render.calls, tris: j.render.triangles } }); } }, 30);
        });
      });
      try { await pg.screenshot({ path: `${OUT}/${MAP}-${fase}-${o.id}.jpg`, type: 'jpeg', quality: 82, timeout: 120000 }); } catch (e) { errors.push(`captura ${o.id}: ${e.message.split('\n')[0]}`); }
      resumen.push({ MAP, fase, org: o.id, ...info });
      console.log(MAP, fase, o.id, 'escena', JSON.stringify(info.esc), 'sólo arenas vivas (+post)', JSON.stringify(info.solo));
    }
  }
  await pg.close();
}
const mx = (k, w) => Math.max(...resumen.map((r) => r[w][k]));
console.log(`MÁXIMO (${Q}) — escena: ${mx('calls', 'esc')} llamadas, ${mx('tris', 'esc')} triángulos · sólo arenas vivas: ${mx('calls', 'solo')} llamadas, ${mx('tris', 'solo')} triángulos (incluye post-proceso)`);
console.log(errors.length ? 'AVISOS/ERRORES:\n' + [...new Set(errors)].slice(0, 15).join('\n') : 'sin errores de consola');
await b.close(); srv.close && srv.close(); process.exit(0);
