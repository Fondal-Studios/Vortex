// Visor del bestiario: ?k=astilla&s=open  (para capturas y revisión visual)
import * as THREE from 'three';
import { skyMaterial, uTime } from './shaders.js';
import { buildMonster, MONSTER_KINDS } from './models.js';
import { setCurrent, LEVELS } from './quality.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
setCurrent(new URLSearchParams(location.search).get('q') || 'high');
const q = new URLSearchParams(location.search);
const kinds = q.get('k') ? q.get('k').split(',') : MONSTER_KINDS;
const canvas = document.getElementById('c');
const gl = new THREE.WebGLRenderer({ canvas, antialias: false }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7;
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x401a55, 1.3)); const sun = new THREE.DirectionalLight(0xfff0e0, 2.6); sun.position.set(3, 5, 4); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1 })));
const items = kinds.map((k, i) => {
  const e = buildMonster(k), big = k === 'coloso' || k === 'madre';
  const sc = q.get('big') || big ? 1.6 : 1.4, st = { id: i + 1, s: q.get('s') || 'idle', o: q.get('s') === 'open', c: q.get('c') === '1' };
  const cols = Math.min(kinds.length, 5), x = (i % cols - (cols - 1) / 2) * (big ? 7 : 4.2), y = -Math.floor(i / cols) * 4.2;
  e.object.position.set(x, y, 0); e.object.scale.setScalar(sc); scene.add(e.object); return { e, st };
});
const span = Math.min(kinds.length, 5);
cam.position.set(0, 0.5 + (Math.ceil(kinds.length / 5) - 1) * -2.1, 5 + span * 3.6); cam.lookAt(0, -(Math.ceil(kinds.length / 5) - 1) * 2.1, 0);
let t = 0, last = performance.now();
const renderFrame = (now) => {
  requestAnimationFrame(renderFrame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt; uTime.value = t;
  const sp = +q.get('v') || 0;
  for (const { e, st } of items) { e.object.rotation.y = q.get('turn') ? t * 0.6 : Math.PI * 0.8 + Math.sin(t * 0.5) * 0.4; e.object.updateMatrixWorld(); const look = cam.position.clone(); e.object.worldToLocal(look); e.tick(dt, st, t, { look: look.normalize(), speed: sp, dist: 10 }); }
  gl.render(scene, cam);
};
requestAnimationFrame(renderFrame);
window.__viewerReady = true;
