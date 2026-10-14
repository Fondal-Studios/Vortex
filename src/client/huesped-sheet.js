// HOJA DE CONTACTO de los Huéspedes (herramienta de arte, no es parte del juego): los 5 en fila con el cielo HDRI, con la evolución/camino/órganos/mapa que
// se pida por URL. ?hosts=axioma,vesper&evo=4&pth=coraza,resonancia,simbiosis,apoteosis&cg=ojo_extra&map=m2&q=low|high&w=1500&h=520&view=front|back|side&pose=idle|melee|skill
// Deja en window.__sheet las cifras de renderer.info (llamadas y triángulos) por Huésped.
import * as THREE from 'three';
import { buildHostEvo } from './huespedes-evo.js';
import { loadEnvHDRI } from './ph.js';
import { uBeat, uTime } from './shaders.js';
const P = new URLSearchParams(location.search), q = P.get('q') || 'low', hosts = (P.get('hosts') || 'axioma,vesper,micelio,umbra,seraf').split(','), evo = +(P.get('evo') || 0);
const pth = (P.get('pth') || '').split(',').filter(Boolean), cg = (P.get('cg') || '').split(',').filter(Boolean), map = P.get('map') || 'm1', view = P.get('view') || 'front', pose = P.get('pose') || 'idle';
const W = +(P.get('w') || 1500), H = +(P.get('h') || 560), canvas = document.getElementById('c');
const gl = new THREE.WebGLRenderer({ canvas, antialias: true }); gl.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; gl.setPixelRatio(1);
gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15; gl.setClearColor(0x120a24, 1); gl.autoClear = false; gl.info.autoReset = false;
const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 0.9)); const sun = new THREE.DirectionalLight(0xfff1e0, 2.2); sun.position.set(2, 4, 3); scene.add(sun); const rim = new THREE.DirectionalLight(0xff66c4, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x1a1230, roughness: 0.6, metalness: 0.2 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
loadEnvHDRI(gl, 'small_cathedral_02').then((t) => { scene.environment = t; scene.environmentIntensity = 0.7; }).catch(() => {});
const list = hosts.map((id, i) => { const h = buildHostEvo(THREE, id, { evo, path: pth, organs: cg, quality: q, map, melee: '' }); h.group.position.x = (i - (hosts.length - 1) / 2) * 2.6; scene.add(h.group); h.pose(pose); return h; });
window.__sheet = { hosts: list.map((h) => ({ id: h.id, ...h.info })), t: 0 };
const cam = new THREE.PerspectiveCamera(30, (W / hosts.length) / H, 0.1, 100);
let t = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; uTime.value = t;
  const ph = (t / 1.55) % 1; uBeat.value = Math.exp(-((ph * 10) ** 2)) + 0.65 * Math.exp(-(((ph - 0.27) * 10) ** 2));
  for (const h of list) h.update(dt, t);
  gl.clear(); gl.info.reset();
  list.forEach((h, i) => { const w = W / hosts.length; gl.setViewport(i * w, 0, w, H); gl.setScissor(i * w, 0, w, H); gl.setScissorTest(true);
    const x = h.group.position.x, yaw = view === 'back' ? Math.PI : view === 'side' ? Math.PI / 2 : 0.35; h.group.rotation.y = yaw; cam.position.set(x, 1.5, 6.4); cam.lookAt(x, 1.15, 0); cam.aspect = w / H; cam.updateProjectionMatrix(); gl.render(scene, cam); });
  window.__sheet.t = t; window.__sheet.calls = gl.info.render.calls; window.__sheet.tris = gl.info.render.triangles; requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
