// Visor de ART GATE (criaturas): ?k=coloso&q=low&s=ray&hp=0.5&sd=1&hurt=1&sim=4&dist=8&cy=0&yaw=0.6&pitch=0.1&big=1
// Avanza la simulación `sim` segundos sin dibujar (paso 1/30), dibuja UN cuadro y publica const bb = new THREE.Box3().setFromObject(e.object, true); window.__info = { minY: +(bb.min.y / sc).toFixed(2), maxY: +(bb.max.y / sc).toFixed(2),calls,tris} y __ready.
import * as THREE from 'three';
import { skyMaterial, uTime } from './shaders.js';
import { buildMonster } from './models.js';
import { setCurrent, cfg } from './quality.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { setWound } from './organism.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search);
setCurrent(q.get('q') || 'low');
const canvas = document.getElementById('c');
const gl = new THREE.WebGLRenderer({ canvas, antialias: false }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = cfg().post ? 1.9 : 1.05;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
// iluminación IDÉNTICA a render.js (Baja: sin entorno ni post; Media/Alta: entorno 0.55 + bloom + exposición 1.9)
const Q = cfg();
if (Q.env && q.get('env') !== '0') { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; }
const hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.1), sun = new THREE.DirectionalLight(0xfff1e0, 2.2); sun.position.set(0.4, 1, 0.3); const rim = new THREE.DirectionalLight(0xff66c4, 1.0); rim.position.set(-0.6, 0.2, -0.8); rim.visible = Q.lights >= 3;
scene.add(hemi, sun, rim);
let composer = null; if (Q.post) { composer = new EffectComposer(gl); composer.addPass(new RenderPass(scene, cam)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), Q.bloom || 0.5, 0.7, 0.8)); composer.addPass(new OutputPass()); composer.setSize(innerWidth, innerHeight); }
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1 })));
const k = q.get('k') || 'graviton', boss = k === 'coloso' || k === 'madre';
const RAD = { graviton: 1.6, obelisco: 1.6, aurora: 1.3, ariete: 1.9, espiral: 1.5, coloso: 7.5 * 1.15, madre: 7 * 1.15 };
const e = buildMonster(k); const sc = +q.get('scale') || RAD[k] || 1.4;
e.object.scale.setScalar(sc); scene.add(e.object);
const hp = q.get('hp') == null ? 1 : +q.get('hp');
const st = { id: 3, s: q.get('s') || 'idle', o: q.get('o') === '1' || q.get('s') === 'open', c: q.get('c') === '1', hp, sd: q.get('sd') == null ? undefined : q.get('sd') === '1', st: q.get('stun') === '1', a: null, pr: q.get('pr') ? +q.get('pr') : undefined };
if (q.get('vis')) st.vis = q.get('vis'); if (q.get('a')) st.a = q.get('a').split(',').map(Number);
const dist = +q.get('dist') || (RAD[k] || 1.4) * (boss ? 6 : 5.2), yaw = +q.get('yaw') || 0, pitch = +q.get('pitch') || 0, cy = +q.get('cy') || 0;
e.object.rotation.y = yaw;
cam.position.set(0, cy + dist * Math.sin(pitch), dist * Math.cos(pitch)); cam.lookAt(0, cy, 0);
const mats = e.mats; const setHurtU = (v) => { for (const m of mats) { const uh = (m.userData && m.userData.u && m.userData.u.uHurt) || (m.uniforms && m.uniforms.uHurt); if (uh) uh.value = v; } };
let t = 0; const dt = 1 / 30;
const step = (hurt) => {
  t += dt; uTime.value = t; setWound(mats, Math.max(0, Math.min(1, 1 - hp))); setHurtU(hurt ? 0.7 : 0);
  e.object.updateMatrixWorld(); const look = cam.position.clone(); e.object.worldToLocal(look);
  e.tick(dt, st, t, { look: look.normalize(), speed: +q.get('v') || 0, dist });
};
const sim = +q.get('sim') || 3, n = Math.round(sim * 30);
// 's2' = estado posterior: la primera mitad se simula en 's' y el final en 's2' (para ver transiciones)
for (let i = 0; i < n; i++) { if (q.get('s2') && i > n - (+q.get('t2') || 20)) st.s = q.get('s2'); step(q.get('hurt') === '1' && i > n - 3); }
gl.info.autoReset = false; gl.info.reset(); if (composer) composer.render(); else gl.render(scene, cam);
const bb = new THREE.Box3().setFromObject(e.object, true); window.__info = { minY: +(bb.min.y / sc).toFixed(2), maxY: +(bb.max.y / sc).toFixed(2), calls: gl.info.render.calls, tris: gl.info.render.triangles, geo: gl.info.memory.geometries, tex: gl.info.memory.textures };
window.__ready = true;
