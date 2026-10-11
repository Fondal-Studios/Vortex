// visor temporal de pulido (se borra al final)
import * as THREE from 'three';
import { skyMaterial, uTime, OUT } from './shaders.js';
import { buildMonster } from './models.js';
import { setCurrent } from './quality.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const q = new URLSearchParams(location.search);
setCurrent(q.get('q') || 'high');
const canvas = document.getElementById('c'); OUT.linear = (q.get('q') || 'high') !== 'low';
const gl = new THREE.WebGLRenderer({ canvas, antialias: false }); gl.setSize(innerWidth, innerHeight, false); gl.toneMapping = THREE.ACESFilmicToneMapping; const post = (q.get('q') || 'high') !== 'low'; gl.toneMappingExposure = post ? 1.9 : 1.05;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);
const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = post ? 0.55 : 0; if (!post) scene.environment = null;
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.1)); const sun = new THREE.DirectionalLight(0xfff1e0, 2.2); sun.position.set(0.4, 1, 0.3); scene.add(sun); const rim = new THREE.DirectionalLight(0xff66c4, 1.0); rim.position.set(-0.6, 0.2, -0.8); scene.add(rim);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), skyMaterial({ hue: 0.1 })));
const k = q.get('k'), e = buildMonster(k), big = k === 'coloso' || k === 'madre';
const a = (q.get('a') || '').split(',').map(Number);
const st = { id: 1, s: q.get('s') || 'idle', o: q.get('s') === 'open', c: false, hp: q.get('hp') != null ? +q.get('hp') : 1, sd: q.get('sd') === '1', pr: +q.get('pr') || 0, a: a.length === 3 ? new THREE.Vector3(...a).normalize() : undefined };
e.object.scale.setScalar(+q.get('sc') || (big ? 1.6 : 1.4)); scene.add(e.object);
const az = (+q.get('az') || 0) * Math.PI / 180, el = (+q.get('el') || 8) * Math.PI / 180, dist = +q.get('dist') || (big ? 18 : 5), cy = +q.get('cy') || 0;
cam.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist + 0.5, Math.cos(az) * Math.cos(el) * dist); cam.lookAt(0, cy, 0);
const steps = +q.get('steps') || 90, sp = +q.get('v') || 0; let t = 0; const dt = 1 / 30;
e.object.rotation.y = (+q.get('ry') || 0) * Math.PI / 180;
for (let i = 0; i < steps; i++) { t += dt; uTime.value = t; e.object.updateMatrixWorld(); const look = cam.position.clone(); e.object.worldToLocal(look); e.tick(dt, st, t, { look: look.normalize(), speed: sp, dist: 10 }); }
gl.info.autoReset = false; gl.render(scene, cam);
gl.info.reset(); gl.render(scene, cam);
window.__info = { tris: gl.info.render.triangles, calls: gl.info.render.calls };
if (post && !q.get('nopost')) { const c = new EffectComposer(gl); c.setPixelRatio(1); c.addPass(new RenderPass(scene, cam)); c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), q.get('q') === 'medium' ? 0.4 : 0.6, 0.7, 0.8)); c.addPass(new OutputPass()); c.setSize(innerWidth, innerHeight); c.render(); }
if (q.get('dbg')) { const rt = new THREE.WebGLRenderTarget(480, 300, { type: THREE.FloatType }); gl.setRenderTarget(rt); gl.render(scene, cam); const buf = new Float32Array(480 * 300 * 4); gl.readRenderTargetPixels(rt, 0, 0, 480, 300, buf); gl.setRenderTarget(null); let bad = 0, mx = 0, first = null; for (let i = 0; i < buf.length; i += 4) { const v = buf[i] + buf[i + 1] + buf[i + 2]; if (!Number.isFinite(v)) { bad++; if (!first) first = [((i / 4) % 480), Math.floor(i / 4 / 480)]; } else mx = Math.max(mx, v); } window.__info.bad = bad; window.__info.max = mx; window.__info.first = first; }
window.__viewerReady = true;
