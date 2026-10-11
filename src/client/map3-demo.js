// Página de prueba del Mapa 3 (Laberinto Celestial) y de los ojos cósmicos, sin pasar por el juego.
// Parámetros: ?q=low|medium|high  &x=&y=&z=  &yaw=(grados, 0 = mirar hacia -z)  &pitch=(grados)  &t=(segundos de animación)
//             &eyes=0 (sin ojos)  &map=m3|m1sky|m2shell (para probar los ojos en otros cielos)  &free=1 (cámara libre con teclado)
import * as THREE from 'three';
import { Renderer } from './render.js';
import { MAPS } from '../sim/maps.js';
import { uTime } from './shaders.js';
import { buildMap3 } from './env/map3.js';
import { addCosmicEyes } from './env/eyes.js';
import { skyMaterial } from './shaders.js';

const P = new URLSearchParams(location.search);
const level = P.get('q') || 'low';
const num = (k, d) => (P.has(k) ? +P.get(k) : d);
const r = new Renderer(document.getElementById('c'), { level, pixelRatio: num('pr', 1) });
const map = P.get('map') || 'm3';
r.mapId = map; r.dyn = []; r.sunDir = null;
if (map === 'm3') buildMap3(r, MAPS.m3, { eyes: P.get('eyes') !== '0' });
else if (map === 'm1sky') { // sólo para probar los ojos sobre un cielo de m1
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMaterial({ hue: 0, speed: 0.04, iters: 4, sun: [0.4, 0.3, -0.8] })); sky.renderOrder = -10; sky.frustumCulled = false; r.mapRoot.add(sky);
  addCosmicEyes(r, r.mapRoot, { mode: 'sky', count: level === 'low' ? 12 : level === 'high' ? 60 : 36, radius: 1000, minR: 450, size: 3.2, y0: -150, y1: 700 });
} else if (map === 'm2shell') {
  const R = MAPS.m2.R; r.hemi.intensity = 0.8;
  const sh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshBasicMaterial({ color: 0x4a1e44, side: THREE.BackSide })); r.mapRoot.add(sh);
  addCosmicEyes(r, r.mapRoot, { mode: 'shell', shellR: R, count: level === 'low' ? 12 : level === 'high' ? 60 : 46 });
}
const cam = r.camera;
cam.position.set(num('x', -68), num('y', 1.5), num('z', 64));
const setDir = () => { const yaw = THREE.MathUtils.degToRad(num('yaw', 0)), pit = THREE.MathUtils.degToRad(num('pitch', 0)); cam.lookAt(cam.position.x + Math.sin(yaw) * Math.cos(pit), cam.position.y + Math.sin(pit), cam.position.z - Math.cos(yaw) * Math.cos(pit)); };
setDir();
r.resize();
let t = num('t', 10);
const sunV = new THREE.Vector3(0.55, 0.62, -0.45).normalize();
function frame(dt) {
  t += dt; uTime.value = t; r.gl.info.reset();
  for (const f of r.dyn) f(dt, t);
  if (r.sun.castShadow) { r.sun.target.position.set(cam.position.x, 0, cam.position.z); r.sun.position.copy(r.sun.target.position).addScaledVector(sunV, 90); r.sun.target.updateMatrixWorld(); }
  if (r.composer) r.composer.render(); else r.gl.render(r.scene, cam);
}
window.__frame = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) frame(dt); const i = r.gl.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0 }; };
window.__set = (x, y, z, yaw, pitch) => { cam.position.set(x, y, z); P.set('yaw', yaw); P.set('pitch', pitch); setDir(); };
window.__r = r;
if (P.get('free') === '1') {
  const keys = new Set(); let yaw = num('yaw', 0), pit = num('pitch', 0);
  addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('mousemove', (e) => { if (e.buttons) { yaw += e.movementX * 0.2; pit = Math.max(-89, Math.min(89, pit - e.movementY * 0.2)); P.set('yaw', yaw); P.set('pitch', pit); setDir(); } });
  let last = performance.now();
  const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; const f = new THREE.Vector3(); cam.getWorldDirection(f); const rt = new THREE.Vector3().crossVectors(f, cam.up);
    const s = (keys.has('ShiftLeft') ? 40 : 10) * dt; if (keys.has('KeyW')) cam.position.addScaledVector(f, s); if (keys.has('KeyS')) cam.position.addScaledVector(f, -s); if (keys.has('KeyD')) cam.position.addScaledVector(rt, s); if (keys.has('KeyA')) cam.position.addScaledVector(rt, -s);
    frame(dt); document.getElementById('i').textContent = `calls ${r.gl.info.render.calls}  tris ${r.gl.info.render.triangles}\n${cam.position.toArray().map((v) => v.toFixed(1))}`; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
window.__ready = true;
