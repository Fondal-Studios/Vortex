// HOJA DE CONTACTO del bestiario del limbo (ART GATE): todas las criaturas en una sola imagen, cada una en reposo y en su aviso de ataque,
// con medición REAL (gl.info) de draw calls y triángulos de la criatura sola (sin cielo ni piso).
// Uso: node tools/almas-sheet.mjs <salida.jpg> [q=low|medium|high] [modo=estados|silueta|fila] [kinds=astilla,geoda,…] [tile=300]
//   estados : 1 fila por criatura con sus estados (reposo / aviso / ataque…)
//   silueta : negro sobre blanco, sin brillos (¿se reconoce cada tipo sólo por la forma?)
//   fila    : las 12 criaturas lado a lado a escala de juego, de lejos y sobre fondo oscuro del limbo (legibilidad a distancia)
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const [out = '/tmp/almas.jpg', q = 'low', modo = 'estados', kindsArg = '', tileArg = '300'] = process.argv.slice(2);
const ALL = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'obelisco', 'aurora', 'ariete', 'espiral', 'coloso', 'madre', 'argos'];
const kinds = kindsArg ? kindsArg.split(',') : modo === 'fila' ? ALL.slice(0, 12) : ALL;
const STATES = {
  astilla: ['run:v=1', 'leap', 'run:v=1:yaw=1.57', 'idle:yaw=2.6'], geoda: ['roll:v=1', 'open', 'roll:yaw=1.57', 'open:yaw=0.2'], prisma: ['orbit', 'wind', 'dive', 'orbit:yaw=0.1'], lente: ['idle', 'aim', 'aim:yaw=1.4', 'idle:yaw=0.1'], cuarzo: ['idle', 'cast'],
  espejo: ['idle', 'blink', 'idle:c=1'], racimo: ['idle:v=1:dist=20', 'idle:v=1:dist=3'], graviton: ['idle', 'charge'], obelisco: ['idle', 'charge'], aurora: ['idle', 'cast'],
  ariete: ['idle:v=0.6', 'wind', 'charge:v=1.5', 'stun'], espiral: ['idle', 'charge', 'pull'], coloso: ['idle', 'wind', 'ray', 'stagger'], madre: ['fire', 'vent', 'open'], argos: ['idle', 'gaze', 'stagger'],
};
const RAD = { astilla: 1.0, geoda: 2.3, prisma: 1.2, lente: 1.4, cuarzo: 1.5, espejo: 1.2, racimo: 1.1, graviton: 1.6, obelisco: 1.6, aurora: 1.3, ariete: 1.9, espiral: 1.5, coloso: 7.5 * 1.4, madre: 7 * 1.4, argos: 6.5 * 1.4 };
const FLY = { prisma: 1, graviton: 1, aurora: 1, espiral: 1, coloso: 1, madre: 1, argos: 1 };
const NAMES = { astilla: 'Ánima', geoda: 'Almamula', prisma: 'Luz Mala', lente: 'La Llorona', cuarzo: 'Salamanquera', espejo: 'Pombero', racimo: 'Fuego Fatuo', graviton: 'El Familiar', obelisco: 'La Viuda', aurora: 'Difunta', ariete: 'Lobizón', espiral: 'El Silbón', coloso: 'El Mandinga', madre: 'Madre de las Ánimas', argos: 'El Basilisco' };
const tile = +tileArg;
const srv = await startServer({ port: 0 }); const b = await launch();
const cols = modo === 'fila' ? 1 : Math.max(...kinds.map((k) => STATES[k].length));
const W = modo === 'fila' ? 1600 : cols * tile, Hh = modo === 'fila' ? 520 : kinds.length * tile;
const pg = await b.newPage({ viewport: { width: modo === 'fila' ? 1600 : tile, height: modo === 'fila' ? 520 : tile } });
const errs = []; pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
const html = `<!doctype html><html><head><meta charset=utf-8><script type="importmap">{ "imports": { "three": "/vendor/three/three.module.js", "three/addons/": "/vendor/three-addons/" } }</script><style>html,body{margin:0;background:#07030f}canvas{display:block}</style></head><body><canvas id=c></canvas><script type=module>
import * as THREE from 'three'; import { skyMaterial, uTime } from '/src/client/shaders.js'; import { buildMonster } from '/src/client/models.js'; import { setCurrent, cfg } from '/src/client/quality.js'; import { kit } from '/src/client/organism.js';
import { texturasListas } from '/src/client/creatures/alma-kit.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; import { GradePass, sceneTarget } from '/src/client/post.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'; import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'; import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'; import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const P = new URLSearchParams(location.search); setCurrent(P.get('q')); const MODO = P.get('modo');
const gl = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; const Q = cfg(); gl.toneMappingExposure = 1.05;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 5000);
if (Q.env) { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; }
const hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.1), sun = new THREE.DirectionalLight(0xfff1e0, 2.2); sun.position.set(0.4, 1, 0.3); const rim = new THREE.DirectionalLight(0x9fe8ff, 1.0); rim.position.set(-0.6, 0.3, -0.8);
scene.add(hemi, sun, rim);
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 12), skyMaterial({ hue: 0.1 })); scene.add(sky);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
// misma cadena que render.js: escena HDR → bloom (Media/Alta) → GradePass (exposición 1.9 + ACES + curvas) en TODAS las calidades
let composer = null, grade = null; { composer = new EffectComposer(gl, sceneTarget(4)); composer.addPass(new RenderPass(scene, cam)); if (Q.post) composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), Q.bloom || 0.5, 0.55, 0.85)); grade = new GradePass(P.get('q')); grade.preset(P.get('mapa') || 'm1'); composer.addPass(grade); composer.setSize(innerWidth, innerHeight); }
const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
await Promise.race([texturasListas(), new Promise((r) => setTimeout(r, 4000))]);
const built = {}; let t = 0;
function get(k, sc) { if (built[k]) return built[k]; const e = buildMonster(k); e.object.scale.setScalar(sc); built[k] = e; return e; }
function sim(e, st, frames, camPos) { for (let i = 0; i < frames; i++) { t += 1 / 30; uTime.value = t; e.object.updateMatrixWorld(true); const look = camPos.clone(); e.object.worldToLocal(look); const d = look.length();
  e.tick(1 / 30, st, t, { look: look.normalize(), speed: st.v || 0, dist: st.dist ?? d }); } }
function measure() { sky.visible = false; floor.visible = false; gl.info.autoReset = false; gl.info.reset(); gl.render(scene, cam); const r = { calls: gl.info.render.calls, tris: gl.info.render.triangles }; sky.visible = true; return r; }
function draw() { if (composer && MODO !== 'silueta') { grade.frame(cam, t); composer.render(); } else gl.render(scene, cam); }
window.__ready = true;
window.__one = (o) => { // { k, s, sc, fly, yaw }
  for (const k in built) built[k].object.visible = false;
  const e = get(o.k, o.sc); scene.add(e.object); e.object.visible = true; e.object.position.set(0, 0, 0);
  const st = { id: 3, s: o.s, o: o.s === 'open', c: !!o.c, hp: o.hp ?? 1, sd: !!o.sd, st: o.s === 'stagger' || o.s === 'stun', v: o.v || 0, dist: o.dist, a: o.s === 'charge' || o.s === 'ray' ? [0, -0.15, 1] : null };
  const yaw = o.yaw ?? 0.85; let camPos = new THREE.Vector3(Math.sin(yaw), 0.18, Math.cos(yaw)).multiplyScalar(o.sc * 6);
  sim(e, st, o.frames || 45, camPos);
  e.object.updateMatrixWorld(true); const bb = new THREE.Box3(); e.object.traverse((c) => { if ((c.isMesh || c.isSkinnedMesh) && c.visible && !c.isSprite && c.geometry && !c.userData.noBox && c.material && (c.material.blending !== THREE.AdditiveBlending || c.geometry.attributes.aH)) { if (c.isSkinnedMesh) { c.computeBoundingBox && c.computeBoundingBox(); } const b2 = new THREE.Box3().setFromObject(c, true); if (isFinite(b2.min.x)) bb.union(b2); } });
  const ctr = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), R = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.01;
  const dist = R / Math.tan((cam.fov * Math.PI) / 360) * 1.05; camPos = new THREE.Vector3(Math.sin(yaw) * Math.cos(0.12), Math.sin(0.12), Math.cos(yaw) * Math.cos(0.12)).multiplyScalar(dist).add(ctr);
  cam.position.copy(camPos); cam.lookAt(ctr); cam.updateMatrixWorld();
  floor.position.y = o.fly ? -1e4 : -0.9 * o.sc * (o.k === 'ariete' || o.k === 'geoda' ? 1 : 1); floor.scale.setScalar(o.sc * 4);
  sim(e, st, 2, camPos);
  const info = measure();
  if (MODO === 'silueta') { scene.overrideMaterial = black; scene.background = new THREE.Color(0xf4f0e8); sky.visible = false; floor.visible = false; const hid = []; e.object.traverse((c) => { if ((c.isSprite || c.isPoints) && c.visible) { c.visible = false; hid.push(c); } }); gl.toneMapping = THREE.NoToneMapping; gl.render(scene, cam); hid.forEach((c) => (c.visible = true)); scene.overrideMaterial = null; scene.background = null; gl.toneMapping = THREE.ACESFilmicToneMapping; }
  else { floor.visible = !o.fly; draw(); }
  e.object.visible = false; return info;
};
window.__fila = (list) => { // las criaturas a escala real, en fila, cámara a ~30 m
  for (const k in built) built[k].object.visible = false; let x = 0; const res = {};
  const xs = []; for (const it of list) { const e = get(it.k, it.sc); scene.add(e.object); e.object.visible = true; xs.push([e, it]); }
  const span = list.reduce((a, it) => a + it.sc * 2.6, 0); let cx = -span / 2;
  for (const [e, it] of xs) { cx += it.sc * 1.3; e.object.position.set(cx, it.fly ? 1.5 : 0, 0); cx += it.sc * 1.3; }
  const camPos = new THREE.Vector3(0, 3, 34); cam.position.copy(camPos); cam.lookAt(0, 1.2, 0); cam.updateMatrixWorld(); floor.position.y = -0.9 * 1.4; floor.scale.setScalar(60); floor.visible = true;
  for (const [e, it] of xs) { const st = { id: 3, s: it.s, o: it.s === 'open', c: false, hp: 1, sd: false, st: false, v: it.v || 0 }; sim(e, st, 30, camPos); }
  draw(); return res;
};
</script></body></html>`;
await pg.route('**/__almas.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
await pg.goto(`http://localhost:${srv.port}/__almas.html?q=${q}&modo=${modo}`);
await pg.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(() => { console.log('NO CARGÓ:', errs.join(' | ')); process.exit(1); });
const { createCanvas } = await import('node:module').then(() => ({ createCanvas: null }));
const shots = []; const res = {};
if (modo === 'fila') {
  await pg.evaluate((l) => window.__fila(l), kinds.map((k) => ({ k, sc: RAD[k], fly: !!FLY[k], s: STATES[k][0].split(':')[0], v: 0.6 })));
  await pg.screenshot({ path: out, type: 'jpeg', quality: 88 });
} else {
  for (const k of kinds) for (const sdef of STATES[k]) {
    const [s, ...rest] = sdef.split(':'); const o = { k, s, sc: RAD[k], fly: !!FLY[k] }; for (const kv of rest) { const [a, v] = kv.split('='); o[a] = +v; }
    const info = await pg.evaluate((o) => window.__one(o), o);
    const buf = await pg.screenshot({ type: 'png' }); shots.push({ k, sdef, buf, info }); res[k + ' ' + sdef] = info;
  }
  // componer con una página aparte (canvas 2D) para no depender de librerías de imagen
  const cp = await b.newPage({ viewport: { width: W, height: Hh } });
  await cp.setContent(`<canvas id=s width=${W} height=${Hh}></canvas>`);
  const rows = {}; kinds.forEach((k, i) => (rows[k] = i));
  const col = {}; for (const sh of shots) { col[sh.k] = (col[sh.k] ?? -1) + 1; sh.c = col[sh.k]; }
  await cp.evaluate(async ({ items, tile, names }) => {
    const c = document.getElementById('s'), g = c.getContext('2d'); g.fillStyle = '#05030a'; g.fillRect(0, 0, c.width, c.height);
    for (const it of items) { const img = new Image(); img.src = 'data:image/png;base64,' + it.b64; await img.decode(); g.drawImage(img, it.c * tile, it.r * tile, tile, tile);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(it.c * tile, it.r * tile, tile, 20); g.fillStyle = '#fff'; g.font = '13px sans-serif';
      g.fillText(`${names[it.k]} · ${it.sdef} · ${it.info.calls} dc · ${(it.info.tris / 1000).toFixed(1)}k`, it.c * tile + 5, it.r * tile + 14); }
  }, { items: shots.map((s) => ({ k: s.k, sdef: s.sdef, c: s.c, r: rows[s.k], info: s.info, b64: s.buf.toString('base64') })), tile, names: NAMES });
  await cp.locator('#s').screenshot({ path: out, type: 'jpeg', quality: 86 });
}
console.log(JSON.stringify(res)); if (errs.length) console.log('ERRORES:', [...new Set(errs)].slice(0, 8).join('\n'));
await b.close(); await srv.close();
