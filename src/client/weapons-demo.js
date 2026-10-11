// Banco de pruebas de las armas: ?w=0..4 &q=low|medium|high &view=fp|close &fire=1 &speed=6 &cap=1
//  close: &a=azimut(grados) &e=elevación &d=distancia &h=0 (sin manos) &turn=1 (gira)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { skyMaterial, uTime, OUT } from './shaders.js';
import { setCurrent, LEVELS, cfg } from './quality.js';
import { Viewmodels, createWeaponModel } from './weapons-vm.js';
import { TUNE } from './weapons/kit.js';

const P = new URLSearchParams(location.search), Q = LEVELS[P.get('q')] ? P.get('q') : 'high', W = +(P.get('w') ?? 0), view = P.get('view') || 'fp';
if (P.get('tune')) Object.assign(TUNE, JSON.parse(P.get('tune')));
setCurrent(Q); OUT.linear = !!cfg().post;
const canvas = document.getElementById('c'), gl = new THREE.WebGLRenderer({ canvas, antialias: false }); gl.info.autoReset = false;
gl.setPixelRatio(P.get('pr') ? +P.get('pr') : (Q === 'low' ? 0.7 : 1)); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = cfg().post ? 1.9 : 1.05;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(view === 'fp' ? 82 : 40, innerWidth / innerHeight, 0.05, 3000); scene.add(cam);
const hemi = new THREE.HemisphereLight(0xaab8ff, 0x1a0f3a, 1.1), sun = new THREE.DirectionalLight(0xe8f0ff, 2.2), rim = new THREE.DirectionalLight(0xff66c4, 1.0);
sun.position.set(0.4, 1, 0.3); rim.position.set(-0.6, 0.2, -0.8); scene.add(hemi, sun, rim); rim.visible = cfg().lights >= 3;
if (cfg().env) { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; }
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1, iters: cfg().skyIters })));
const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
let composer = null;
if (cfg().post) { composer = new EffectComposer(gl); composer.setPixelRatio(gl.getPixelRatio()); composer.addPass(new RenderPass(scene, cam)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), cfg().bloom || 0.5, 0.7, 0.8)); composer.addPass(new OutputPass()); }
const resize = () => { gl.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); if (composer) { composer.setPixelRatio(gl.getPixelRatio()); composer.setSize(innerWidth, innerHeight); } };
resize(); addEventListener('resize', resize);

let vm = null, model = null; const speed = +(P.get('speed') || 0), holdFire = P.get('fire') === '1';
if (view === 'fp') { vm = new Viewmodels(cam, halo); vm.setWeapon(W); vm.setAmmo(W === 0 ? Infinity : [0, 20, 150, 10, 10][W], [0, 48, 360, 32, 28][W]); }
else {
  model = createWeaponModel(W, { quality: Q, hands: P.get('h') !== '0' }); scene.add(model);
  const d = +(P.get('d') || [1.0, 1.6, 1.5, 1.4, 2.3][W]), a = THREE.MathUtils.degToRad(+(P.get('a') ?? -50)), e = THREE.MathUtils.degToRad(+(P.get('e') ?? 18));
  const cx = [0.0, -0.1, -0.1, -0.08, -0.4][W]; cam.position.set(Math.sin(a) * Math.cos(e) * d, 0.05 + Math.sin(e) * d, cx + Math.cos(a) * Math.cos(e) * d); cam.lookAt(0, 0.02, cx);
}
let t = 0, last = performance.now(), shotT = 0;
function step(dt, doShoot = false, render = true) {
  t += dt; uTime.value = t;
  if (vm) {
    if (doShoot) vm.shoot();
    vm.update(dt, { firing: holdFire, hidden: false, look: [0, 0], speed });
  } else if (model) { if (P.get('turn') === '1') model.rotation.y = t * 0.5; if (doShoot) model.userData.shoot(); model.userData.tick(dt, t, holdFire); }
  if (render) gl.info.reset(); if (render) (composer || { render: () => gl.render(scene, cam) }).render();
}
const RATE = [0.26, 0.8, 0.085, 1.0, 1.4];
function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; shotT -= dt; let s = false; if (holdFire && shotT <= 0) { s = true; shotT = RATE[W]; } step(dt, s); }
if (P.get('cap') === '1') {
  // modo captura: window.__step(n, dt, [cuadros en que se dispara]) avanza el reloj a mano y dibuja el último cuadro
  window.__step = (n, dt = 1 / 60, shots = []) => { for (let i = 0; i < n; i++) step(dt, shots.includes(i), i === n - 1); return n; };
} else requestAnimationFrame(loop);
window.__stats = () => ({ calls: gl.info.render.calls, tris: gl.info.render.triangles });
window.__weaponsReady = true;
