// Demo de personas humanas (Pasajero/a, jugadores, roles, armas, animaciones por capas).
// Parámetros (todos opcionales):
//   q=low|medium|high          calidad          · set=team|roles|chars|solo|clips|weapons   qué mostrar (chars = los 6 personajes; solo + char=egida..umbra)
//   p=pasajero|jugador1..4     (solo)           · role=vanguardia|soporte|ingeniero|explorador
//   weapon=0..5 | none         arma en la mano  · anim=<clip> fuerza un clip           · speed=<m/s> · move=x,z (dirección relativa)
//   cam=full|close|face|back|side|hands          · yaw=<grados> gira a la persona        · pitch=<rad> apunta arriba/abajo
//   frozen=1 sin bucle de animación (la captura avanza con __advance(s) y dibuja con __render())   · t=<segundos a avanzar>
//   w=ancho&h=alto             tamaño del lienzo (captura)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadHumanKit, createHuman, PLAYER_COLORS, ROLES, CHAR_IDS } from './humans.js';

const qs = new URLSearchParams(location.search), quality = qs.get('q') || 'medium', forced = qs.get('anim'), set = qs.get('set') || 'team';
const frozen = qs.get('frozen') === '1', camMode = qs.get('cam') || 'full';
const canvas = document.getElementById('c'), hud = document.getElementById('hud'), names = document.getElementById('nombres');
const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.25;
if (quality === 'high') { gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120a2a); scene.fog = new THREE.Fog(0x120a2a, 12, 30);
const cam = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
// mismas luces que render.js (hemisférica + sol + contraluz magenta + mapa de entorno)
scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x2a0f3a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1e0, 2.2); sun.position.set(2, 5, 3.5); scene.add(sun, sun.target);
if (quality === 'high') { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 4; sc.bottom = -3; sc.near = 1; sc.far = 20; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; }
const rim = new THREE.DirectionalLight(0xff66c4, 1.6); rim.position.set(-3, 2, -4); scene.add(rim);
if (quality !== 'low') { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; pm.dispose(); }
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x1c1038, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const W = Number(qs.get('w')) || innerWidth, H = Number(qs.get('h')) || innerHeight;
function resize() { gl.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix(); }
resize(); if (!qs.get('w')) addEventListener('resize', () => { gl.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

const t0 = performance.now();
const kit = await loadHumanKit({ quality });
const wp = qs.get('weapon'), weapon = wp === 'none' ? null : wp != null ? Number(wp) : undefined;
let specs;
if (set === 'chars') specs = CHAR_IDS.map((c) => ({ char: c, name: c, weapon }));
else if (set === 'roles') specs = ROLES.map((r, i) => ({ preset: 'jugador' + (i + 1), role: r, color: PLAYER_COLORS[i], name: r, weapon }));
else if (set === 'solo') specs = [{ char: qs.get('char') || undefined, hands: qs.get('hands') === '0' ? false : undefined, preset: qs.get('char') ? undefined : qs.get('p') || 'pasajero', role: qs.get('role') || undefined, color: qs.get('color') ? Number('0x' + qs.get('color')) : (qs.get('p') ? PLAYER_COLORS[(Number((qs.get('p') || '').slice(7)) || 1) - 1] : undefined), name: qs.get('p') || 'pasajero', weapon }];
else if (set === 'weapons') specs = [0, 1, 2, 3, 4, 5].map((i) => ({ preset: 'jugador' + ((i % 4) + 1), role: ROLES[i % 4], color: PLAYER_COLORS[i % 4], name: 'arma ' + i, weapon: i }));
else specs = [
  { preset: 'pasajero', name: 'Pasajero/a', weapon }, { preset: 'jugador1', role: 'vanguardia', color: PLAYER_COLORS[0], name: 'Jugador 1', weapon },
  { preset: 'jugador2', role: 'soporte', color: PLAYER_COLORS[1], name: 'Jugador 2', weapon }, { preset: 'jugador3', role: 'ingeniero', color: PLAYER_COLORS[2], name: 'Jugador 3', weapon },
  { preset: 'jugador4', role: 'explorador', color: PLAYER_COLORS[3], name: 'Jugador 4', weapon }];
const ov = Object.fromEntries((qs.get('ov') || '').split(',').filter(Boolean).map((kv) => kv.split(':')));
for (const sp of specs) if (Object.keys(ov).length) sp.overrides = ov;
const SCRIPTS = [
  [['idle', 3], ['walk', 4], ['interact', 2.2]], [['aimIdle', 3], ['shoot', 1.2], ['aimIdle', 2]], [['jog', 5]],
  [['aim', 2], ['shoot', 1.2], ['cast', 2.2]], [['fall', 2.4], ['death', 3], ['idle', 2]],
];
const sp = set === 'solo' ? 0 : set === 'weapons' ? 1.5 : 1.55, startX = -(specs.length - 1) / 2 * sp;
const humans = specs.map((s, i) => {
  const h = createHuman(kit, s); h.object.position.set(startX + i * sp, 0, 0); h.object.rotation.y = THREE.MathUtils.degToRad(Number(qs.get('yaw')) || 0); scene.add(h.object);
  return { h, script: SCRIPTS[i % SCRIPTS.length], step: 0, t: 0 };
});
await Promise.all(humans.map((x) => x.h.ready));
const speed = qs.get('speed') != null ? Number(qs.get('speed')) : undefined, mv = (qs.get('move') || '').split(',').map(Number), moveDir = mv.length === 2 && mv.every(Number.isFinite) ? { x: mv[0], z: mv[1] } : undefined;
const pitch = Number(qs.get('pitch')) || 0;
for (const x of humans) { const [c] = x.script[0]; x.h.play(forced || (set === 'solo' || set === 'weapons' ? 'idle' : c)); }
names.innerHTML = specs.map((s) => `<span>${s.name}<i></i></span>`).join('');
const labels = [...names.querySelectorAll('i')];
if (set === 'solo' || set === 'weapons') names.style.display = 'none';

const _hp = new THREE.Vector3();
function frame() { // cámara según el modo
  if (camMode === 'handL' || camMode === 'handR') { // primer plano de una mano (sigue al hueso): handL = mano +x (a la derecha de la imagen)
    const L = camMode === 'handL', h = humans[0].h, b = h.bones[L ? 'wrist_L_h' : 'wrist_R_h']; if (b) {
      h.object.updateMatrixWorld(true); b.getWorldPosition(_hp); const k = Number(qs.get('zoom')) || 1;
      cam.position.set(_hp.x + (L ? 0.28 : -0.28) * k, _hp.y + 0.22 * k, _hp.z + 0.62 * k); cam.lookAt(_hp.x, _hp.y + 0.02, _hp.z + 0.06); cam.fov = 32; cam.updateProjectionMatrix(); return; } }
  const f = { full: [0, 1.2, 6.3, 0, 0.9, 0, 38], close: [0, 1.35, 2.7, 0, 1.18, 0, 38], face: [0.15, 1.55, 1.15, 0, 1.52, 0, 34], back: [0.4, 1.3, -3.0, 0, 1.15, 0, 38], side: [3.0, 1.2, 0.2, 0, 1.1, 0, 38], hands: [0.55, 1.28, 1.6, 0.05, 1.2, 0.3, 34], handL: [0.62, 1.12, 0.9, 0.38, 1.1, 0.12, 30], handR: [-0.62, 1.12, 0.9, -0.38, 1.1, 0.12, 30] }[camMode] || [0, 1.2, 6.3, 0, 0.9, 0, 38];
  const k = set === 'solo' ? 1 : set === 'weapons' ? 1.9 : 1; if (camMode === 'full' && set !== 'solo') { cam.position.set(0, 1.25, 6.3 * (specs.length > 4 ? 1 : 0.8) * (set === 'weapons' ? 1.1 : 1)); cam.lookAt(0, 0.9, 0); }
  else { cam.position.set(f[0], f[1], f[2]); cam.lookAt(f[3], f[4], f[5]); }
  cam.fov = (W / H < 1.4 && camMode === 'full' ? 56 : f[6]) * (set === 'solo' && camMode === 'full' ? 0.75 : 1); cam.updateProjectionMatrix(); void k;
}
frame();

function tick(dt, auto) {
  for (const [i, x] of humans.entries()) {
    x.t += dt; const [clip, dur] = x.script[x.step];
    if (auto && !forced && set !== 'solo' && set !== 'weapons' && x.t > dur) { x.t = 0; x.step = (x.step + 1) % x.script.length; const [c] = x.script[x.step]; x.h.play(c, { restart: true }); }
    const clipSpeed = x.h.clip === 'walk' ? 1.04 : x.h.clip === 'jog' ? 4.2 : undefined;
    x.h.update(dt, { speed: speed ?? clipSpeed, moveDir, pitch, camera: cam });
    labels[i] && (labels[i].textContent = x.h.clip);
  }
}
const clock = new THREE.Timer(); let frames = 0, acc = 0, fps = 0;
function stats() {
  let dc = 0, tr = 0; for (const x of humans) { const s = x.h.stats(); dc += s.drawCalls; tr += s.triangles; }
  const res = performance.getEntriesByType('resource').filter((r) => r.name.includes('/assets/arcanum/'));
  const bytes = res.reduce((a, r) => a + (r.encodedBodySize || r.transferSize || 0), 0);
  return { quality, humans: humans.length, drawCallsHumans: dc, trianglesHumans: tr, perHuman: humans.map((x) => x.h.stats()), sceneCalls: gl.info.render.calls, sceneTriangles: gl.info.render.triangles,
    assetMB: +(bytes / 1048576).toFixed(2), assetFiles: res.length, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries, loadMs: Math.round(performance.now() - t0), fps };
}
window.__advance = (s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) tick(dt, false); };
window.__render = () => { frame(); gl.render(scene, cam); };
window.__play = (clip, opts) => humans.forEach((x) => x.h.play(clip, opts));
if (frozen) { window.__advance(Number(qs.get('t')) || 1.5); frame(); gl.render(scene, cam); hud.textContent = `calidad ${quality}`; }
else gl.setAnimationLoop(() => {
  clock.update(); const dt = Math.min(clock.getDelta(), 0.1); tick(dt, true); if (camMode.startsWith('hand') && camMode.length === 5) frame();
  gl.render(scene, cam);
  frames++; acc += dt; if (acc >= 1) { fps = frames / acc; frames = 0; acc = 0;
    const s = stats(); hud.innerHTML = `<b>Personas 3D</b> · calidad <b>${quality}</b> · ${s.drawCallsHumans} draw calls y ${(s.trianglesHumans / 1000).toFixed(1)} k triángulos (${humans.length} personas) · ${s.assetMB} MB · ${fps.toFixed(0)} fps`; window.__humansStats = s; }
});
window.__humansReady = true; window.__humansStats = stats(); window.__kit = kit; window.__scene = scene; window.__humans = humans.map((x) => x.h); window.__cam = cam;
