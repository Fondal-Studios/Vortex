// Visor del bestiario: ?k=astilla&s=open  (para capturas y revisión visual)
import * as THREE from 'three';
import { skyMaterial, uTime } from './shaders.js';
import { buildMonster, MONSTER_KINDS } from './models.js';
const q = new URLSearchParams(location.search);
const kinds = q.get('k') ? q.get('k').split(',') : MONSTER_KINDS;
const canvas = document.getElementById('c');
const gl = new THREE.WebGLRenderer({ canvas, antialias: false }); gl.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
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
  for (const { e, st } of items) { e.tick(dt, st, t); e.object.rotation.y = Math.PI * 0.8 + Math.sin(t * 0.5) * 0.4; }
  gl.render(scene, cam);
};
requestAnimationFrame(renderFrame);
window.__viewerReady = true;
