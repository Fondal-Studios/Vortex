// Visor de Argos y del Ojo orbital: ?s=idle|gaze|stagger  &sd=0|1  &hp=0..1  &q=low|medium|high  &ojo=1 (muestra ojos orbitales)  &cap=1 (cuadros a mano)
import * as THREE from 'three';
import { skyMaterial, uTime } from './shaders.js';
import { kit } from './organism.js';
import { setCurrent } from './quality.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search);
setCurrent(q.get('q') || 'high');
const { default: buildArgos } = await import('./creatures/argos.js');
const { buildOjo } = await import('./creatures/ojo.js');
const canvas = document.getElementById('c');
const gl = new THREE.WebGLRenderer({ canvas, antialias: false }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7;
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x401a55, 1.3)); const sun = new THREE.DirectionalLight(0xfff0e0, 2.6); sun.position.set(3, 5, 4); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.8 })));
const ojoMode = q.get('ojo') === '1';
const s = q.get('s') || 'idle', hp = q.get('hp') != null ? +q.get('hp') : 1;
let ent, ojos = [];
if (!ojoMode) {
  const b = buildArgos(kit, 0xff4fa8); const piv = new THREE.Group(); piv.add(b.root); piv.scale.setScalar(6.5); scene.add(piv); ent = { b, piv };
  cam.position.set(0, 1.5, q.get('dist') ? +q.get('dist') : 32); cam.lookAt(0, 0, 0);
} else {
  for (let i = 0; i < 4; i++) { const o = buildOjo(kit, { color: [0xffb020, 0x66ffd0, 0xff66c4, 0x8fb0ff][i] }); o.root.position.set((i - 1.5) * 4.2, 0, 0); o.root.scale.setScalar(1.7); scene.add(o.root); ojos.push({ o, hp: [1, 0.7, 0.4, 0.15][i] }); }
  cam.position.set(0, 0.5, q.get('dist') ? +q.get('dist') : 11); cam.lookAt(0, -0.3, 0);
}
let t = 0, last = performance.now(), gtime = 0;
const renderFrame = (now, draw = true) => {
  if (!q.get('cap')) requestAnimationFrame(renderFrame);
  const dt = Math.max(0.001, Math.min(0.1, (now - last) / 1000)); last = now; t += dt; uTime.value = t;
  if (ent) {
    ent.piv.rotation.y = Math.sin(t * 0.5) * 0.25; ent.piv.updateMatrixWorld(); const look = cam.position.clone(); ent.piv.worldToLocal(look);
    ent.b.tick(dt, { id: 1, s: s === 'idle' ? null : s, hp, sd: q.get('sd') != null ? q.get('sd') === '1' : s !== 'stagger', st: s === 'stagger' }, t, { look: look.normalize(), speed: 0, dist: 20 });
  }
  for (const { o, hp: h } of ojos) { const l = cam.position.clone().sub(o.root.position); o.tick(dt, { hp: h * 240, maxhp: 240, look: l.normalize(), t }); }
  if (draw) gl.render(scene, cam);
};
if (q.get('cap')) { window.__vframe = (ms, draw = true) => renderFrame(last + ms, draw); last = 0; window.__info = () => ({ calls: gl.info.render.calls, tris: gl.info.render.triangles }); } else requestAnimationFrame(renderFrame);
window.__viewerReady = true;
