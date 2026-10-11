// Demo de personas humanas: La persona protagonista (pasajero/a) y los 4 jugadores en fila, cada uno con su animación.
// Parámetros: ?q=low|medium|high  ?w=ancho&h=alto (captura)  ?anim=walk (todos igual)
import * as THREE from 'three';
import { loadHumanKit, createHuman, PLAYER_COLORS } from './humans.js';

const qs = new URLSearchParams(location.search), quality = qs.get('q') || 'medium', forced = qs.get('anim');
const canvas = document.getElementById('c'), hud = document.getElementById('hud'), names = document.getElementById('nombres');
const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120a2a); scene.fog = new THREE.Fog(0x120a2a, 12, 30);
const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100); cam.position.set(0, 1.25, 6.3); cam.lookAt(0, 0.9, 0);
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a1d5c, 1.5));
const sun = new THREE.DirectionalLight(0xfff0dd, 2.4); sun.position.set(3, 6, 5); scene.add(sun);
const rim = new THREE.DirectionalLight(0xff66c4, 1.2); rim.position.set(-4, 3, -4); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ color: 0x1c1038, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
function resize() { const w = innerWidth, h = innerHeight; gl.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 1.4 ? 56 : 38; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const t0 = performance.now();
const kit = await loadHumanKit({ quality });
const specs = [
  { preset: 'pasajero', name: 'Pasajero/a' },
  { preset: 'jugador1', color: PLAYER_COLORS[0], name: 'Jugador 1' },
  { preset: 'jugador2', color: PLAYER_COLORS[1], name: 'Jugador 2' },
  { preset: 'jugador3', color: PLAYER_COLORS[2], name: 'Jugador 3' },
  { preset: 'jugador4', color: PLAYER_COLORS[3], name: 'Jugador 4' },
];
// guion de animación de cada uno [clip, segundos]
const SCRIPTS = [
  [['idle', 3], ['walk', 4], ['interact', 2.2]], [['aimIdle', 3], ['shoot', 1.2], ['aimIdle', 2]], [['jog', 5]],
  [['aim', 2], ['shoot', 1.2], ['cast', 2.2]], [['fall', 2.4], ['death', 3], ['idle', 2]],
];
const humans = specs.map((s, i) => {
  const h = createHuman(kit, s); h.object.position.set((i - 2) * 1.55, 0, 0); scene.add(h.object);
  return { h, script: SCRIPTS[i], step: 0, t: 0 };
});
await Promise.all(humans.map((x) => x.h.ready));
for (const x of humans) { const [c] = x.script[0]; x.h.play(forced || c); }
names.innerHTML = specs.map((s) => `<span>${s.name}<i></i></span>`).join('');
const labels = [...names.querySelectorAll('i')];

const clock = new THREE.Timer(); let frames = 0, acc = 0, fps = 0;
function stats() {
  let dc = 0, tr = 0; for (const x of humans) { const s = x.h.stats(); dc += s.drawCalls; tr += s.triangles; }
  const res = performance.getEntriesByType('resource').filter((r) => r.name.includes('/assets/arcanum/'));
  const bytes = res.reduce((a, r) => a + (r.encodedBodySize || r.transferSize || 0), 0);
  return { quality, humans: humans.length, drawCallsHumans: dc, trianglesHumans: tr, sceneCalls: gl.info.render.calls, sceneTriangles: gl.info.render.triangles,
    assetMB: +(bytes / 1048576).toFixed(2), assetFiles: res.length, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries, loadMs: Math.round(performance.now() - t0), fps };
}
gl.setAnimationLoop(() => {
  clock.update(); const dt = Math.min(clock.getDelta(), 0.1);
  for (const [i, x] of humans.entries()) {
    x.t += dt; const [clip, dur] = x.script[x.step];
    if (!forced && x.t > dur) { x.t = 0; x.step = (x.step + 1) % x.script.length; const [c] = x.script[x.step]; x.h.play(c, { restart: true }); }
    x.h.update(dt, { speed: x.h.clip === 'walk' ? 1.04 : x.h.clip === 'jog' ? 4.2 : undefined, camera: cam });
    labels[i].textContent = x.h.clip;
  }
  // los que corren/caminan en el sitio: un pequeño paseo de ida y vuelta para ver el paso
  gl.render(scene, cam);
  frames++; acc += dt; if (acc >= 1) { fps = frames / acc; frames = 0; acc = 0;
    const s = stats(); hud.innerHTML = `<b>Personas 3D</b> · calidad <b>${quality}</b> · ${s.drawCallsHumans} draw calls y ${(s.trianglesHumans / 1000).toFixed(0)} k triángulos (5 personas) · ${s.assetMB} MB · ${fps.toFixed(0)} fps`; window.__humansStats = s; }
});
window.__humansReady = true; window.__humansStats = stats(); window.__kit = kit; window.__scene = scene; window.__humans = humans.map((x) => x.h);
