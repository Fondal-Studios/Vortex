// Hoja de capturas del HUÉSPED en 3ª persona (cuerpo humano intervenido, host-human.js): por mapa (aspecto regional), Huésped,
// nivel/camino de evolución (pth) y órganos (cg). Cámara de exhibición a ~2,6 m (frente 3/4 y espalda) + la vista real de juego.
// Uso: node tools/shot-huesped3p.mjs [carpeta=shots/huesped3p] [calidad=high] [mapas=m1,m2,m3,m4] [casos=all|rapido]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/huesped3p', Q = process.argv[3] || 'high', MAPS = (process.argv[4] || 'm1,m2,m3,m4').split(','), MODE = process.argv[5] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const CASES = MODE === 'rapido' ? [['axioma', 0, [], []], ['seraf', 4, ['coraza', 'resonancia', 'simbiosis', 'apoteosis'], []]] : [
  ['axioma', 0, [], []], ['axioma', 2, ['depredador', 'velocidad'], []], ['vesper', 3, ['coraza', 'resonancia', 'artilleria'], []],
  ['micelio', 4, ['depredador', 'velocidad', 'simbiosis', 'anomalia'], []], ['seraf', 4, ['coraza', 'resonancia', 'simbiosis', 'apoteosis'], ['corazon_cristal', 'ojo_extra']], ['umbra', 1, ['coraza'], []]];
const srv = await startServer({ port: 0 }); const b = await launch(); const errors = [], rows = [];
for (const map of MAPS) {
  const pg = await (await b.newContext({ viewport: { width: 960, height: 720 } })).newPage();
  pg.on('pageerror', (e) => errors.push(`${map}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`${map}: ${m.text()}`); });
  await pg.goto(`http://localhost:${srv.port}/?auto=${map}&god=1&seed=3&q=${Q}&autoq=0&nolock=1&skipintro=1&cam=third`, { timeout: 180000 });
  await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 90000 });
  await pg.evaluate(() => { const R = window.__api.renderer, orig = R.updateCamera.bind(R); const g = window.__api.session.game; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true;
    R.updateCamera = (me, dt, look) => { orig(me, dt, look); const v = window.__show; if (!v) return; const T = R.camera.position.constructor, up = new T(...me.up), h = new T(...me.h), rt = new T().crossVectors(h, up).normalize();
      const c = new T(...me.pos).addScaledVector(up, 0.35), eye = c.clone().addScaledVector(h, v === 'back' ? -1.9 : 1.7).addScaledVector(rt, v === 'back' ? 0.5 : -0.6).addScaledVector(up, 0.2);
      R.camera.position.copy(eye); R.camera.up.copy(up); R.camera.lookAt(c); }; });
  for (const [char, evo, pth, cg] of CASES) {
    const name = `${map}-${char}-e${evo}-${Q}`;
    await pg.evaluate(([char, evo, pth, cg]) => { const g = window.__api.session.game, p = g.players[0], R = window.__api.renderer; p.char = char; p.evo = evo; p.path = pth; p.corg = cg; window.__show = null;
      for (const [id, e] of R.ents.ply) { R.entRoot.remove(e.object); e.body && e.body.dispose(); R.ents.ply.delete(id); } }, [char, evo, pth, cg]);
    const ok = await pg.waitForFunction(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; return e && e.body && e.body.human && e.body.parts > 0; }, null, { timeout: 150000, polling: 1000 }).then(() => true).catch(() => false);
    await pg.waitForTimeout(2500);
    const info = await pg.evaluate(() => { const R = window.__api.renderer, i = R.gl.info.render, e = [...R.ents.ply.values()][0]; return { calls: i.calls, tris: i.triangles, parts: e && e.body && e.body.parts }; });
    await pg.screenshot({ path: `${OUT}/${name}-juego.jpg`, type: 'jpeg', quality: 85, timeout: 180000 });
    for (const v of ['front', 'back']) { await pg.evaluate((v) => { window.__show = v; }, v); await pg.waitForTimeout(2500); await pg.screenshot({ path: `${OUT}/${name}-${v}.jpg`, type: 'jpeg', quality: 85, timeout: 180000 }); }
    rows.push({ name, ok, ...info }); console.log(name, ok ? '' : 'SIN CUERPO HUMANO', JSON.stringify(info));
  }
  await pg.context().close();
}
fs.writeFileSync(`${OUT}/medidas.json`, JSON.stringify(rows, null, 1));
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
