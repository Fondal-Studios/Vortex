// Visor de arte de los Huéspedes (public/huesped-arte.html): el MISMO cuerpo unificado (huesped-cuerpo.js) con luces parecidas a las del juego.
// Parámetros: char=axioma|vesper|micelio|umbra|seraf · evo=0..4 · pth=coraza,resonancia,… · q=low|medium|high · map=m1..m6 · mw=<arma melee> · clip=idle|punch|cast|death
//   cam=full|close|head|torso|back|side|q34|legs|hands · yaw=<grados> · t=<s a avanzar> · w,h=<px> · bloom=1 · speed=<m/s> · hdri=<id> · frozen=1 (captura: __advance, __render)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadHumanKit } from './humans.js';
import { loadEnvHDRI } from './ph.js';
import { tickMenuBeat } from './shaders.js';
import { createHostBody } from './huesped-cuerpo.js';

const qs = new URLSearchParams(location.search), quality = qs.get('q') || 'low', char = qs.get('char') || 'axioma', camMode = qs.get('cam') || 'full';
const W = Number(qs.get('w')) || innerWidth, H = Number(qs.get('h')) || innerHeight, frozen = qs.get('frozen') === '1';
const canvas = document.getElementById('c'), hud = document.getElementById('hud');
const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
gl.setPixelRatio(1); gl.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = Number(qs.get('exp')) || 1.15;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 80);
scene.background = new THREE.Color(0x241a44);
const hemi = new THREE.HemisphereLight(0xd4daff, 0x4a2a70, 2.1), key = new THREE.DirectionalLight(0xfff1e0, 3.4), rim = new THREE.DirectionalLight(0xa8ccff, 4.5), kick = new THREE.DirectionalLight(0xff8a50, 2.6), fill = new THREE.DirectionalLight(0xc8a8ff, 1.4); fill.position.set(-3, 1.2, 3); scene.add(fill);
key.position.set(2.2, 3.4, 4); rim.position.set(-3, 2.4, -3.5); kick.position.set(3.5, 0.6, -2); scene.add(hemi, key, rim, kick);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshStandardMaterial({ color: 0x1a1230, roughness: 0.8, metalness: 0.2 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 64), new THREE.MeshBasicMaterial({ color: 0x4ab4ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
let composer = null;
if (qs.get('bloom') === '1' || quality !== 'low') {
  composer = new EffectComposer(gl); composer.setSize(W, H); composer.addPass(new RenderPass(scene, cam)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), Number(qs.get('bl')) || 0.5, 0.55, 0.9)); composer.addPass(new OutputPass());
}
const hdri = qs.get('hdri') || 'small_cathedral_02';
const env = loadEnvHDRI(gl, hdri).then((t) => { scene.environment = t; scene.environmentIntensity = Number(qs.get('envi')) || 1.3; }).catch(() => {});
const kit = await loadHumanKit({ quality });
const pl = { char, name: char, evo: Number(qs.get('evo')) || 0, pth: (qs.get('pth') || '').split(',').filter(Boolean), cg: (qs.get('cg') || '').split(',').filter(Boolean), mw: qs.get('mw') || '', dead: false };
const body = createHostBody(THREE, kit, pl, { quality, camera: cam, map: qs.get('map') || null });
scene.add(body.object); await body.ready; await env;
body.object.rotation.y = THREE.MathUtils.degToRad(Number(qs.get('yaw')) || 0);
const CAMS = { // [x, y, z, mirax, miray, miraz, fov] relativos a la escala
  full: [0, 1.1, 5.4, 0, 0.9, 0, 30], q34: [2.6, 1.45, 3.9, 0, 0.9, 0, 30], close: [0, 1.25, 3.3, 0, 1.05, 0, 30], head: [0.5, 1.65, 1.55, 0, 1.58, 0, 30], torso: [0.6, 1.3, 2.3, 0, 1.2, 0, 30],
  back: [0.9, 1.3, -4.4, 0, 1.0, 0, 30], side: [4.4, 1.2, 0.3, 0, 1.0, 0, 30], legs: [1.5, 0.5, 2.4, 0, 0.5, 0, 30], hands: [1.3, 1.2, 1.7, 0.4, 1.1, 0.1, 30], backq: [-2.6, 1.5, -4.0, 0, 1.0, 0, 30],
};
function frame() { const c = CAMS[camMode] || CAMS.full, s = body.object.scale.x * (CHARS_SCALE[char] || 1); cam.position.set(c[0] * s, c[1], c[2] * s); cam.lookAt(c[3], c[4] * s ** 0.5, c[5]); cam.fov = c[6]; cam.updateProjectionMatrix(); }
const CHARS_SCALE = { micelio: 1.25 };
frame();
let time = 0; const ctxm = { speed: Number(qs.get('speed')) || 0, moveDir: { x: 0, z: 1 }, pitch: 0 };
if (qs.get('clip')) body.event({ t: qs.get('clip') === 'punch' ? 'melee' : 'skill' });
function tick(dt) { time += dt; tickMenuBeat(time); body.update(dt, pl, ctxm); ring.rotation.z += dt * 0.3; }
window.__advance = (s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) tick(dt); };
window.__render = () => { frame(); composer ? composer.render() : gl.render(scene, cam); };
window.__THREE = THREE; window.__body = body; window.__gl = gl; window.__scene = scene; window.__pl = pl; window.__cam = cam;
window.__info = () => ({ ...body.stats(), calls: gl.info.render.calls, tris: gl.info.render.triangles, geometries: gl.info.memory.geometries });
if (frozen) { window.__advance(Number(qs.get('t')) || 2); window.__render(); hud.textContent = ''; }
else { let last = performance.now(); (function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; body.object.rotation.y += qs.get('spin') ? dt * 0.5 : 0; tick(dt); window.__render(); })(last); hud.textContent = `${char} · evo ${pl.evo} · ${quality}`; }
window.__ready = true;
