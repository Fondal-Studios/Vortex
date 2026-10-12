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
const embed = q.get('embed') === '1';
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: embed }); if (embed) { gl.setClearColor(0x000000, 0); document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent'; } gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
const pm = new THREE.PMREMGenerator(gl); if (q.get('q') !== 'low') { scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; } // igual que el juego: Baja no usa mapa de entorno (si no, los materiales se ven lavados)
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x401a55, 1.3)); const sun = new THREE.DirectionalLight(0xfff0e0, 2.6); sun.position.set(3, 5, 4); scene.add(sun);
if (!embed) scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1 })));
const items = kinds.map((k, i) => {
  const e = buildMonster(k), big = k === 'coloso' || k === 'madre';
  const sc = q.get('big') || big ? 1.6 : 1.4, st = { id: i + 1, s: q.get('s') || 'idle', o: q.get('s') === 'open', c: q.get('c') === '1' };
  const cols = Math.min(kinds.length, 5), x = (i % cols - (cols - 1) / 2) * (big ? 7 : 4.2), y = -Math.floor(i / cols) * 4.2;
  e.object.position.set(x, y, 0); e.object.scale.setScalar(sc); scene.add(e.object); return { e, st };
});
const span = Math.min(kinds.length, 5);
const bossK = kinds.some((k) => k === 'coloso' || k === 'madre');
cam.position.set(0, 0.5 + (Math.ceil(kinds.length / 5) - 1) * -2.1, q.get('dist') ? +q.get('dist') : embed && kinds.length === 1 ? (bossK ? 10 : 5.2) : 5 + span * 3.6); cam.lookAt(0, -(Math.ceil(kinds.length / 5) - 1) * 2.1 + (+q.get('cy') || 0), 0);
let t = 0, last = performance.now();
const renderFrame = (now) => {
  if (!q.get('cap')) requestAnimationFrame(renderFrame);
  const dt = Math.max(0.001, Math.min(0.1, (now - last) / 1000)); last = now; t += dt; uTime.value = t;
  const sp = +q.get('v') || 0;
  for (const { e, st } of items) { e.object.rotation.y = q.get('turn') ? t * 0.6 : Math.PI * 0.8 + Math.sin(t * 0.5) * 0.4; e.object.updateMatrixWorld(); const look = cam.position.clone(); e.object.worldToLocal(look); e.tick(dt, st, t, { look: look.normalize(), speed: sp, dist: 10, viewer: true }); }
  gl.render(scene, cam);
};
if (q.get('cap')) { window.__vframe = (dtMs) => renderFrame(last + dtMs); last = 0; } else requestAnimationFrame(renderFrame);
window.__viewerReady = true;
