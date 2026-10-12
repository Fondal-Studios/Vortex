// Vista 3D de un héroe para la pantalla Equipo (se incrusta en un iframe). Fondo transparente: el color y los glifos los pone la página que la contiene.
// Parámetros: ?char=egida|lumen|forja|vigia|nova|umbra  &q=low|medium|high  &anim=<clip>  &yaw=<grados>  &frozen=1 (captura: no gira solo)
// Mensajes (postMessage desde la página madre): { hv: 1, char } cambia de héroe · { hv: 1, play: 'cast' } reproduce un gesto · { hv: 1, pause: true|false }
// Se arrastra con el dedo/ratón para girar al héroe.
import * as THREE from 'three';
import { loadHumanKit, createHuman, CHAR_INFO } from './humans.js';

const qs = new URLSearchParams(location.search), quality = qs.get('q') || 'low', frozen = qs.get('frozen') === '1';
const canvas = document.getElementById('c');
const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
gl.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.25)); gl.setClearColor(0x000000, 0);
gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.25;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
const hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.15), key = new THREE.DirectionalLight(0xfff1e0, 2.3), rim = new THREE.DirectionalLight(0xffffff, 2.6), kick = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(2.2, 3.4, 4); rim.position.set(-3, 2.4, -3.5); kick.position.set(3, 0.4, -2); scene.add(hemi, key, rim, kick);

// pedestal: disco de luz + dos anillos que giran + chispas que suben (todo aditivo, propio)
const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const pad = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffffff, ...add, opacity: 0.8 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.01; scene.add(pad);
const rings = [1.05, 1.3].map((r, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.025, r, 64, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.8 - i * 0.3 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02 + i * 0.01; scene.add(m); return m; });
const ticks = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.94, 6, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.7 })); ticks.rotation.x = -Math.PI / 2; ticks.position.y = 0.03; scene.add(ticks);
const NSP = 26, spPos = new Float32Array(NSP * 3), spSeed = Array.from({ length: NSP }, () => ({ a: Math.random() * 6.28, r: 0.5 + Math.random() * 0.9, v: 0.15 + Math.random() * 0.35, y: Math.random() * 2 }));
const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
const spMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, map: glowTex, ...add, opacity: 0.9, sizeAttenuation: true }); scene.add(new THREE.Points(spGeo, spMat));
const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 3.4, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.1 })); beamMesh.position.y = 1.7; scene.add(beamMesh);

let kit = null, human = null, curChar = null, yaw = (Number(qs.get('yaw')) || -18) * Math.PI / 180, userYaw = 0, drag = null, paused = false, t = 0, spin = !frozen;
function tint(hex) { const c = new THREE.Color(hex); rim.color.copy(c); kick.color.copy(c).lerp(new THREE.Color(0xffffff), 0.2); pad.material.color.copy(c); rings.forEach((r) => r.material.color.copy(c)); ticks.material.color.copy(c); spMat.color.copy(c).lerp(new THREE.Color(0xffffff), 0.3); beamMesh.material.color.copy(c); }
async function setHero(id) {
  if (!CHAR_INFO[id] || id === curChar) return; curChar = id; tint(CHAR_INFO[id].color);
  if (!kit) return; // se aplica cuando cargue el kit
  const old = human; human = createHuman(kit, { char: id, name: id, weapon: null });
  human.object.visible = false; scene.add(human.object); const mine = human;
  try { await human.ready; } catch { /* sigue */ }
  if (human !== mine) { mine.object.removeFromParent(); mine.dispose(); return; }
  if (old) { old.object.removeFromParent(); old.dispose(); }
  human.play(qs.get('anim') || 'idle'); human.object.visible = true; popT = 0;
  if (frozen) { human.update(0.4, { camera: cam }); }
  parent !== window && parent.postMessage({ hv: 1, ready: id }, '*');
}
let popT = 1;
function resize() {
  const w = innerWidth, h = innerHeight; gl.setSize(w, h, false); cam.aspect = w / h;
  const a = cam.aspect, H = 2.05, fov = THREE.MathUtils.degToRad(cam.fov), distH = (H / 2) / Math.tan(fov / 2), distW = (1.9 / 2) / (Math.tan(fov / 2) * a); // cabe a lo alto y a lo ancho
  const d = Math.max(distH, distW) * 1.04; cam.position.set(0, 1.18 + 0.1, d); cam.lookAt(0, 0.98, 0); cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, u: userYaw }; canvas.setPointerCapture(e.pointerId); spin = false; });
canvas.addEventListener('pointermove', (e) => { if (drag) userYaw = drag.u + (e.clientX - drag.x) * 0.012; });
canvas.addEventListener('pointerup', () => { drag = null; });
addEventListener('message', (e) => { const d = e.data; if (!d || !d.hv) return; if (d.char) setHero(d.char); if (d.play && human) { human.play(d.play, { restart: true, fade: 0.12 }); setTimeout(() => human && human.play('idle', { fade: 0.3 }), 1800); } if (d.pause !== undefined) paused = !!d.pause; if (d.spin) spin = true; });
function tick(dt) {
  t += dt; popT = Math.min(1, popT + dt * 3.2);
  if (spin && !drag) yaw += dt * 0.0; // el héroe respira; se gira con el dedo (el giro automático marea en la lista)
  const sw = frozen ? 0 : Math.sin(t * 0.45) * 0.32;
  if (human) { human.object.rotation.y = yaw + userYaw + sw; human.object.position.y = 0; const k = 1 - Math.pow(1 - popT, 3); human.object.scale.setScalar(0.94 + 0.06 * k); human.update(dt, { camera: cam }); }
  rings[0].rotation.z += dt * 0.5; rings[1].rotation.z -= dt * 0.3; ticks.rotation.z += dt * 0.15;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2); pad.material.opacity = 0.65 + pulse * 0.2; beamMesh.material.opacity = 0.07 + pulse * 0.04;
  for (let i = 0; i < NSP; i++) { const s = spSeed[i]; s.y += s.v * dt; if (s.y > 2.3) s.y = 0; s.a += dt * 0.6; spPos[i * 3] = Math.cos(s.a) * s.r; spPos[i * 3 + 1] = s.y; spPos[i * 3 + 2] = Math.sin(s.a) * s.r; }
  spGeo.attributes.position.needsUpdate = true;
}
let last = performance.now();
gl.setAnimationLoop((now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; if (paused || document.hidden) return; tick(dt); gl.render(scene, cam); });
window.__hero = { setHero, tick: (dt = 0.05, n = 1) => { for (let i = 0; i < n; i++) tick(dt); gl.render(scene, cam); }, get human() { return human; } };
(async () => {
  try { kit = await loadHumanKit({ quality, movil: matchMedia('(pointer: coarse)').matches }); } catch (err) { console.warn('hero-view: sin kit', err.message); parent !== window && parent.postMessage({ hv: 1, failed: true }, '*'); return; }
  const id = curChar; curChar = null; await setHero(id || qs.get('char') || 'egida'); window.__heroReady = true;
})();
tint(CHAR_INFO[qs.get('char')] ? CHAR_INFO[qs.get('char')].color : 0x66ffee); curChar = CHAR_INFO[qs.get('char')] ? qs.get('char') : 'egida';
