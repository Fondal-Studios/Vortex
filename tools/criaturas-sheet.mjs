// Hoja de contacto de criaturas (visor propio con medición gl.info).
// Uso: node tools/criaturas-sheet.mjs <kind> <q:low|high> <salida-prefijo> [estados "idle,windup:..."] [ancho] [alto]
// Estado = nombre[:hp][:c][:v] p. ej.  roll  open  leap:0.3  idle:1:1  (hp 0..1, c=camuflado, v=velocidad)
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [kind, q = 'low', out = '/tmp/cs', states = 'idle', W = '900', H = '600'] = process.argv.slice(2);
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
const html = `<!doctype html><html><head><meta charset=utf-8><script type="importmap">{ "imports": { "three": "/vendor/three/three.module.js", "three/addons/": "/vendor/three-addons/" } }</script><style>html,body{margin:0;background:#07030f}canvas{display:block}</style></head><body><canvas id=c></canvas><script type=module>
import * as THREE from 'three'; import { skyMaterial, uTime } from '/src/client/shaders.js'; import { buildMonster } from '/src/client/models.js'; import { setCurrent } from '/src/client/quality.js'; import { kit } from '/src/client/organism.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const P = new URLSearchParams(location.search); setCurrent(P.get('q'));
const gl = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
if (P.get('q') !== 'low') { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7; }
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x401a55, 1.3)); const sun = new THREE.DirectionalLight(0xfff0e0, 2.6); sun.position.set(3, 5, 4); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1 })));
const e = buildMonster(P.get('k')); const sc = +P.get('sc') || 1.4; e.object.scale.setScalar(sc); scene.add(e.object);
const dist = +P.get('dist') || 7, cy = +P.get('cy') || 1.0; let t = 0;
window.__ready = true;
window.__go = (o) => { // o: {s,hp,c,v,yaw,frames,pitch,hurt,o}
  const st = { id: 3, s: o.s, o: o.s === 'open' || !!o.o, c: !!o.c, hp: o.hp ?? 1, sd: !!o.sd, st: !!o.st };
  const yaw = o.yaw ?? 0.7, ph = o.pitch ?? 0.15; cam.position.set(Math.sin(yaw) * dist * Math.cos(ph), cy + Math.sin(ph) * dist, Math.cos(yaw) * dist * Math.cos(ph)); cam.lookAt(0, cy, 0);
  kit.setWound(e.mats, Math.max(0, Math.min(1, 1 - st.hp)));
  for (const m of e.mats) { const uh = m.userData && m.userData.u && m.userData.u.uHurt; if (uh) uh.value = o.hurt || 0; }
  const n = o.frames ?? 40; let info;
  for (let i = 0; i < n; i++) { t += 1 / 30; uTime.value = t; e.object.updateMatrixWorld(); const look = cam.position.clone(); e.object.worldToLocal(look);
    e.tick(1 / 30, st, t, { look: look.normalize(), speed: o.v || 0, dist }); }
  gl.info.reset(); gl.render(scene, cam); info = { calls: gl.info.render.calls, tris: gl.info.render.triangles };
  return info;
};
</script></body></html>`;
await pg.route('**/__c.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
const extra = process.env.CS_QS || '';
await pg.goto(`http://localhost:${srv.port}/__c.html?k=${kind}&q=${q}${extra}`);
await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const res = {};
for (const sdef of states.split(',')) {
  const [s, hp, c, v, yaw, frames, hurt] = sdef.split(':'); const name = sdef.replace(/:/g, '_');
  const info = await pg.evaluate((o) => window.__go(o), { s, hp: hp ? +hp : 1, c: c === '1', v: v ? +v : 0, yaw: yaw ? +yaw : undefined, frames: frames ? +frames : 40, hurt: hurt ? +hurt : 0 });
  await pg.waitForTimeout(150); await pg.screenshot({ path: `${out}_${name}.jpg`, type: 'jpeg', quality: 85 }); res[name] = info;
}
console.log(kind, q, JSON.stringify(res), errs.slice(0, 5)); await b.close(); await srv.close();
