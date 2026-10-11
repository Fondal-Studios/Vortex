// Visor de depuración temporal (se borra al terminar).
import * as THREE from 'three';
import { skyMaterial, uTime } from '../shaders.js';
import { buildMonster } from '../models.js';
import { setCurrent } from '../quality.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search); const P = (k, d) => (q.get(k) == null ? d : +q.get(k));
setCurrent(q.get('q') || 'high');
const gl = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7;
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x401a55, 1.3)); const sun = new THREE.DirectionalLight(0xfff0e0, 2.6); sun.position.set(3, 5, 4); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1 })));
const k = q.get('k'), e = buildMonster(k), st = { id: 3, s: q.get('s') || 'idle', o: q.get('s') === 'open', hp: P('hp', 1), st: q.get('s') === 'stun' };
if (q.get('a')) { const a = q.get('a').split(',').map(Number); st.a = a; }
const sc = P('sc', 1.4); e.object.scale.setScalar(sc); scene.add(e.object); globalThis.__e = e; globalThis.__gl = gl;
cam.position.set(P('cx', 0), P('cy', 0.5), P('cz', 9)); cam.lookAt(0, P('ty', 0), 0);
let t = 0, last = null;
const tickOnce = (dt) => {
  t += dt; uTime.value = t;
  if (sts.length) st.s = sts[Math.floor(t / (cycle || 1.8)) % sts.length], st.o = st.s === 'open', st.st = st.s === 'stun';
  e.object.rotation.y = THREE.MathUtils.degToRad(P('ry', 0)) + P('spin', 0) * t; e.object.updateMatrixWorld();
  const look = cam.position.clone(); e.object.worldToLocal(look);
  e.tick(dt, st, t, { look: look.normalize(), speed: P('v', 0), dist: 10 });
};
const sts = (q.get('seq') || '').split(',').filter(Boolean);
const cycle = P('cyc', 0); // si >0 alterna estado cada cyc s (para ver transiciones)

const T = P('T', 0); for (let x = 0; x < T * 30; x++) tickOnce(1 / 30);
const renderFrame = (now) => {
  requestAnimationFrame(renderFrame); if (last == null) last = now;
  const fr = P('freeze', 0); if (!fr) tickOnce(1 / 30);
  gl.render(scene, cam);
};
requestAnimationFrame(renderFrame);
