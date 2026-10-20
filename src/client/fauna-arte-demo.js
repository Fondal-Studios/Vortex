// Visor de arte de la FAUNA (public/fauna-arte.html): las 20 especies en una rejilla, con el MISMO dibujo que el juego (fauna-fx.js).
// Parámetros: st=0..5 (estado: 0 duerme, 1 pasta, 2 alerta, 3 huye, 4 acecha) · t=<s> · w,h=<px> · q=low|… · cam=<m de distancia> · sp=<id de especie> (una sola, en grande)
import * as THREE from 'three';
import { FaunaFx } from './fauna-fx.js';
import { ESPECIE_IDS } from '../sim/fauna-data.js';
const qs = new URLSearchParams(location.search), W = Number(qs.get('w')) || innerWidth, H = Number(qs.get('h')) || innerHeight, st = Number(qs.get('st') || 1), solo = qs.get('sp');
const gl = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true }); gl.setPixelRatio(1); gl.setSize(W, H, false);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1236); const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2250 })); scene.add(floor);
const fx = new FaunaFx({ scene, camera }); const ids = solo ? [solo] : ESPECIE_IDS, cols = solo ? 1 : 5, rows = Math.ceil(ids.length / cols), sep = solo ? 1 : 1.6;
const rows_ = ids.map((id, i) => { const x = (i % cols - (cols - 1) / 2) * sep * 1.3, z = (Math.floor(i / cols) - (rows - 1) / 2) * sep * 1.3; return [i + 1, ESPECIE_IDS.indexOf(id), x, ESPECIES_Y(id), z, 0, 1, 0, 1, 0, 0, st]; });
function ESPECIES_Y() { return 0.5; }
const dist = Number(qs.get('cam')) || (solo ? 3.2 : 8.2); camera.position.set(0, dist * 0.8, dist * 0.7); camera.lookAt(0, 0.3, 0);
let t = 0; const state = { fa: { l: rows_, z: [] }, players: [], events: [] };
function tick(dt) { t += dt; fx.update(dt, state, null); }
window.__advance = (s, dt = 1 / 30) => { for (let k = 0; k < s; k += dt) tick(dt); }; window.__render = () => gl.render(scene, camera);
window.__info = () => ({ calls: gl.info.render.calls, tris: gl.info.render.triangles });
window.__advance(Number(qs.get('t')) || 2); window.__render(); window.__ready = true;
