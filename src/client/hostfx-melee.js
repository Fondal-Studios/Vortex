// Melee en primera persona de los 5 Huéspedes (lo usa hostfx.js). Evento {t:'melee', pid, kind:'light'|'heavy'|'air'|'exec', p, d, hit} + predicción local con la tecla V
// (mantener = pesado, soltar rápido = ligero; la simulación confirma). Todo cuelga de la cámara (como el viewmodel de armas):
//   · dos antebrazos propios por Huésped: cuchillas retráctiles (Axioma), garras dobles (Vesper), puños (Micelio), hoja dimensional (Umbra), látigo orgánico (Seraf);
//   · poses por teclas clave (alterna izq/der; el 3.er golpe del combo es el remate), pesado con carga, aéreo/descendente;
//   · estela (superficie barrida por la hoja), destello de impacto, marcador de impacto / ejecución, sacudida corta (addShake: respeta «reducir movimiento»)
//     y hit-stop VISUAL mínimo (sólo congela la animación del viewmodel 40–90 ms; la simulación no se toca).
// Presupuesto: ≤ 11 draw calls mientras está activo (2 cuerpos + 2 armas [+2 brillos de Umbra] + estela + látigo + 2 sprites); oculto = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHARACTERS } from '../sim/data.js';
import { SHAPE, GAM, INT } from './effects.js';
import { attachToViewmodel } from './melee-models.js';

const TAU = Math.PI * 2, Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), WHITE = new THREE.Color(0xffffff), WB = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, sm = (x) => x * x * (3 - 2 * x);
const rnd = (a = 1) => Math.random() * a, srnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

/* ───────────────────────── geometría de brazos (bakeada con color por vértice) ───────────────────────── */
const col = (g, hex) => { const c = new THREE.Color(hex).multiplyScalar(g.userData.k || 1), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const fin = (g, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return col(g, hex); };
/** Cilindro a lo largo de -Z (de z0 a z1). */
const cyl = (r0, r1, z0, z1, hex, x = 0, y = 0, sx = 1, sy = 1) => { const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), 10, 1); g.rotateX(Math.PI / 2); return fin(g, hex, x, y, (z0 + z1) / 2, sx, sy, 1); };
const box = (w, h, d, x, y, z, hex) => fin(new THREE.BoxGeometry(w, h, d), hex, x, y, z);
const sph = (r, x, y, z, hex, sx = 1, sy = 1, sz = 1, det = 1) => fin(new THREE.IcosahedronGeometry(r, det), hex, x, y, z, sx, sy, sz);
/** Cono con la punta hacia -Z y la base en z (largo `len`). */
const cone = (r, len, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, rotX = 0, rotY = 0) => { const g = new THREE.ConeGeometry(r, len, 4, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, -len / 2); return fin(g, hex, x, y, z, sx, sy, 1, rotX, rotY); };
const merge = (parts) => mergeGeometries(parts, false);

/** Por Huésped: { body, weapon, tipZ (fin del arma con ext=1), baseZ, dur (ligero), restExt, ... } */
const STYLE = {
  axioma: {
    dur: { light: 0.4, heavy: 0.75, air: 0.7 }, restExt: 0, wz: -0.14, len: 0.78, wpn: 'bone',
    body: () => merge([cyl(0.04, 0.03, 0.0, -0.34, 0x2a3340), cyl(0.045, 0.045, -0.1, -0.2, 0x4a5a70), box(0.085, 0.045, 0.1, 0, 0, -0.4, 0x3a4658), box(0.07, 0.012, 0.09, 0, 0.026, -0.4, 0x3aa8ff), box(0.012, 0.012, 0.25, 0.03, 0.036, -0.17, 0x3aa8ff), sph(0.026, 0, 0.01, -0.47, 0x3a4658, 1.5, 0.8, 0.9)]),
    weapon: () => merge([cone(0.05, 1, 0xdfe8f0, 0.04, 0.045, 0, 1.0, 0.3), cone(0.05, 1, 0xdfe8f0, -0.04, 0.045, 0, 1.0, 0.3)]), // 2 cuchillas planas
  },
  vesper: {
    dur: { light: 0.3, heavy: 0.6, air: 0.6 }, restExt: 0.45, wz: -0.5, len: 0.28, wpn: 'bone',
    body: () => merge([cyl(0.03, 0.022, 0.0, -0.36, 0x1d1226), box(0.012, 0.012, 0.28, 0, 0.03, -0.17, 0xff3a8a), box(0.07, 0.03, 0.085, 0, 0, -0.4, 0x2a1838), box(0.014, 0.014, 0.075, -0.026, 0, -0.485, 0x2a1838), box(0.014, 0.014, 0.085, 0, 0, -0.49, 0x2a1838), box(0.014, 0.014, 0.075, 0.026, 0, -0.485, 0x2a1838)]),
    weapon: () => merge([cone(0.014, 1, 0xf4e0ff, -0.026, -0.004, 0, 1, 1, 0.07, 0.06), cone(0.014, 1, 0xf4e0ff, 0, -0.004, -0.012, 1, 1, 0.07, 0), cone(0.014, 1, 0xf4e0ff, 0.026, -0.004, 0, 1, 1, 0.07, -0.06)]),
  },
  micelio: {
    dur: { light: 0.55, heavy: 0.95, air: 0.85 }, restExt: 0.2, wz: -0.54, len: 0.14, span: 0.07, wpn: 'bone',
    body: () => merge([cyl(0.065, 0.05, 0.0, -0.34, 0x23301a), cone(0.025, 0.12, 0xb8d84a, 0.045, 0.05, -0.12), sph(0.095, 0, 0, -0.43, 0x2f3f20, 1, 0.9, 1.1, 1), sph(0.034, -0.05, 0.02, -0.51, 0x3a4c28), sph(0.034, 0.02, 0.03, -0.53, 0x3a4c28), sph(0.034, 0.075, 0.015, -0.5, 0x3a4c28), sph(0.03, -0.01, -0.04, -0.52, 0x3a4c28), box(0.1, 0.012, 0.2, 0, 0.055, -0.18, 0x7be03a)]),
    weapon: () => merge([cone(0.028, 1, 0xe8ff6a, -0.05, 0.03, 0), cone(0.028, 1, 0xe8ff6a, 0.02, 0.045, -0.02), cone(0.028, 1, 0xe8ff6a, 0.075, 0.03, 0.01)]),
  },
  umbra: {
    dur: { light: 0.42, heavy: 0.8, air: 0.7 }, restExt: 0.25, wz: -0.46, len: 0.95, wpn: 'glow',
    body: () => merge([cyl(0.032, 0.024, 0.0, -0.36, 0x120a1c), box(0.012, 0.012, 0.3, 0, 0.032, -0.17, 0x5cf0ff), box(0.012, 0.012, 0.2, 0.03, 0, -0.2, 0xb98cff), box(0.065, 0.03, 0.085, 0, 0, -0.4, 0x1a1028), sph(0.022, 0, 0, -0.45, 0x1a1028, 1.6, 0.8, 1)]),
    weapon: () => { const g = new THREE.OctahedronGeometry(1, 0); return merge([fin(g, 0xe8d8ff, 0, 0, -0.5, 0.014, 0.08, 0.5)]); },
    glow: () => { const g = new THREE.OctahedronGeometry(1, 0); return fin(g, 0xffffff, 0, 0, -0.5, 0.03, 0.12, 0.5); },
  },
  seraf: {
    dur: { light: 0.45, heavy: 0.85, air: 0.75 }, restExt: 0.3, wz: 0, len: 1, wpn: 'bone', whip: true,
    body: () => merge([cyl(0.03, 0.024, 0.0, -0.36, 0x3a2a1c), cyl(0.036, 0.036, -0.1, -0.15, 0xffd45a), cyl(0.034, 0.034, -0.22, -0.26, 0xffd45a), box(0.012, 0.012, 0.28, 0, 0.03, -0.17, 0xff6ec4), box(0.065, 0.03, 0.085, 0, 0, -0.4, 0x4a3828), sph(0.022, 0, -0.02, -0.46, 0xffd45a)]),
    weapon: () => merge([sph(0.032, 0, 0.02, -0.5, 0xfff0c0, 1, 1, 1, 1)]),
  },
};
const styleOf = (char) => STYLE[char] || STYLE.axioma;

/* ───────────────────────── poses (relativas al reposo): [u, dx,dy,dz, rx,ry,rz, ext] ───────────────────────── */
const kf = (u, dx, dy, dz, rx, ry, rz, e) => [u, dx, dy, dz, rx, ry, rz, e];
const REST = (e = 0) => kf(0, 0, 0, 0, 0, 0, 0, e);
const mirror = (k) => k.map((r) => [r[0], -r[1], r[2], r[3], r[4], -r[5], -r[6], r[7]]);
const scaleK = (k, s) => k.map((r) => [r[0], r[1] * s, r[2] * s, r[3] * s, r[4] * s, r[5] * s, r[6] * s, r[7]]);
const SLASH = [REST(0), kf(0.3, 0.1, 0.1, 0.04, 0.45, -0.35, -0.9, 1), kf(0.46, -0.14, -0.04, -0.2, -0.05, 0.45, 0.2, 1), kf(0.6, -0.28, -0.14, -0.26, -0.45, 0.95, 0.9, 1), kf(1, 0, 0, 0, 0, 0, 0, 0)];
const THRUST = [REST(0), kf(0.3, 0.06, -0.02, 0.1, 0.05, -0.1, 0, 1), kf(0.46, 0, 0.02, -0.4, -0.02, 0.05, 0, 1.25), kf(0.62, 0, 0.02, -0.46, -0.04, 0.08, 0, 1.25), kf(1, 0, 0, 0, 0, 0, 0, 0)];
const RAKE = [REST(0), kf(0.3, 0.02, 0.2, 0.06, 0.85, 0, 0, 1), kf(0.46, 0, -0.02, -0.22, -0.1, 0, 0, 1), kf(0.6, 0, -0.18, -0.3, -0.55, 0, 0, 1), kf(1, 0, 0, 0, 0, 0, 0, 0)];
const SLAM = [REST(0), kf(0.34, 0.02, 0.26, 0.08, 1.05, 0, 0, 1), kf(0.48, 0, -0.06, -0.24, -0.2, 0, 0, 1), kf(0.62, 0, -0.26, -0.3, -0.75, 0, 0, 1), kf(1, 0, 0, 0, 0, 0, 0, 0)];
const HOOK = [REST(0), kf(0.34, 0.16, 0.02, 0.1, 0.1, -0.55, -0.4, 1), kf(0.48, -0.1, 0, -0.26, -0.05, 0.6, 0.1, 1), kf(0.62, -0.24, -0.05, -0.3, -0.1, 1.0, 0.3, 1), kf(1, 0, 0, 0, 0, 0, 0, 0)];
const CRACK = [REST(0), kf(0.34, 0.08, 0.24, 0.12, 0.9, -0.1, -0.3, 1), kf(0.48, -0.02, 0.0, -0.26, 0.0, 0.1, 0.1, 1), kf(0.62, -0.06, -0.12, -0.34, -0.5, 0.2, 0.2, 1), kf(1, 0, 0, 0, 0, 0, 0, 0)];
const SWEEP = [REST(0), kf(0.34, 0.22, 0.04, 0.06, 0.05, -0.8, -0.5, 1), kf(0.48, -0.1, 0.0, -0.22, 0, 0.5, 0.2, 1), kf(0.62, -0.34, -0.04, -0.26, -0.1, 1.2, 0.4, 1), kf(1, 0, 0, 0, 0, 0, 0, 0)];
// por Huésped: combo ligero (R, L, remate) → { R:[kfs], L:[kfs] } ; pesado ; aéreo. null = el brazo sigue en reposo.
const COMBO = {
  axioma: { l: [{ R: SLASH }, { L: mirror(SLASH) }, { R: scaleK(SLASH, 1.25), L: scaleK(mirror(SLASH), 1.25) }], h: { R: scaleK(SLASH, 1.5), L: scaleK(mirror(SLASH), 1.5) } },
  vesper: { l: [{ R: scaleK(SLASH, 0.9) }, { L: scaleK(mirror(SLASH), 0.9) }, { R: RAKE, L: RAKE }], h: { R: scaleK(RAKE, 1.3), L: scaleK(RAKE, 1.3) } },
  micelio: { l: [{ R: HOOK }, { L: mirror(HOOK) }, { R: SLAM, L: SLAM }], h: { R: scaleK(SLAM, 1.3), L: scaleK(SLAM, 1.3) } },
  umbra: { l: [{ R: SLASH }, { R: mirror(SLASH) }, { R: THRUST }], h: { R: scaleK(SWEEP, 1.3) } },
  seraf: { l: [{ R: SWEEP }, { R: mirror(SWEEP) }, { R: CRACK }], h: { R: scaleK(CRACK, 1.4), L: scaleK(mirror(SWEEP), 0.6) } },
};
const AIR = { R: scaleK(SLAM, 1.2), L: scaleK(SLAM, 1.2) };
const WINDUP = 0.3; // fracción de la animación en la que el brazo termina de cargar el golpe
const sample = (k, u) => { // interpolación suavizada entre teclas
  if (!k) return null; let i = 0; while (i < k.length - 2 && u > k[i + 1][0]) i++;
  const a = k[i], b = k[i + 1], t = sm(clamp((u - a[0]) / Math.max(1e-4, b[0] - a[0]), 0, 1)); return [0, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t), lerp(a[5], b[5], t), lerp(a[6], b[6], t), lerp(a[7], b[7], t)];
};
const HIT_AT = 0.46;
const REST_POS = { R: [0.21, -0.25, -0.16], L: [-0.21, -0.25, -0.16] }, REST_ROT = { R: [0.04, 0.16, 0.0], L: [0.04, -0.16, 0.0] };

/* ───────────────────────── fábrica ───────────────────────── */
export function createHostMelee(renderer, D) {
  const cam = renderer.camera, fx = D.fx;
  const rig = new THREE.Group(); rig.name = 'hostmelee'; rig.visible = false; cam.add(rig);
  const disposables = [];
  let gunHidden = false, worldSide = 1, host = null, built = null, engage = 0, idleT = 9, swing = null, charge = null, freeze = 0, comboIdx = 0, comboT = 9, T = 0, lastPredict = null, vmOff = 0, cdUntil = 0, impactKick = 0;
  const limbs = {}; // R / L: { g, body, wpn, glow, trail:[] }
  // Arma del catálogo FUSIONADA (me.mw + me.evo del snapshot): modelo de melee-models.js colgado de la mano derecha; reemplaza el arma innata mientras esté equipada.
  let wm = null, wmKey = '';
  function syncWeapon(me, dt) {
    const l = limbs.R; if (!l || !built) return; const id = (me && me.mw) || '', tier = (me && me.evo) | 0, key = `${host}|${id}|${tier}`;
    if (key !== wmKey) { wmKey = key; if (wm) { wm.dispose(); wm = null; } l.catalog = !!id; if (id) wm = attachToViewmodel(THREE, l.g, id, { tier, quality: 'low', color: D.hostPal(host).c, offset: [0, 0.02, -0.4], size: 0.5, aura: false }); }
    if (wm) wm.update(dt, T);
  }
  // sprites: destello de impacto y marcador (X de impacto / ejecución)
  const canvasTex = (draw, s = 128) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; disposables.push(t); return t; };
  const hitTex = canvasTex((g, s) => { g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = s * 0.07; for (let i = 0; i < 4; i++) { g.save(); g.rotate(Math.PI / 4 + i * Math.PI / 2); g.beginPath(); g.moveTo(s * 0.12, 0); g.lineTo(s * 0.4, 0); g.stroke(); g.restore(); } });
  const execTex = canvasTex((g, s) => { g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = s * 0.05; g.beginPath(); g.arc(0, 0, s * 0.33, 0, TAU); g.stroke(); g.lineWidth = s * 0.075; for (let i = 0; i < 4; i++) { g.save(); g.rotate(Math.PI / 4 + i * Math.PI / 2); g.beginPath(); g.moveTo(s * 0.06, 0); g.lineTo(s * 0.47, 0); g.stroke(); g.restore(); } g.lineWidth = s * 0.03; for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(s * 0.36, 0); g.lineTo(s * 0.49, 0); g.stroke(); g.restore(); } });
  const mkSpr = (map, ro) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.renderOrder = ro; s.visible = false; rig.add(s); return s; };
  const flashSpr = mkSpr(fx.tex.burst, 31), markSpr = mkSpr(hitTex, 32); disposables.push({ dispose() { flashSpr.material.dispose(); markSpr.material.dispose(); } });
  const fl = { t: 0, max: 0.2, size: 0.5, wash: 0 }, mk = { t: 0, max: 0.3, size: 0.1, tex: hitTex };

  /* ── estela: superficie barrida (2 miembros × 10 puntos × [base, punta]) ── */
  const TP = 10, trailPos = new Float32Array(2 * TP * 2 * 3), trailA = new Float32Array(2 * TP * 2);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage)); trailGeo.setAttribute('aA', new THREE.BufferAttribute(trailA, 1).setUsage(THREE.DynamicDrawUsage));
  { const idx = []; for (let l = 0; l < 2; l++) for (let i = 0; i < TP - 1; i++) { const v = (l * TP + i) * 2; idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); } trailGeo.setIndex(idx); }
  const trailMat = new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color(0xffffff) }, uGam: GAM, uInt: INT }, vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform vec3 uC; uniform float uGam; uniform float uInt; varying float vA; void main(){ gl_FragColor = vec4(pow(uC, vec3(uGam)), vA * uInt * 0.85); }' });
  const trailMesh = new THREE.Mesh(trailGeo, trailMat); trailMesh.frustumCulled = false; trailMesh.renderOrder = 30; trailMesh.visible = false; rig.add(trailMesh); disposables.push({ dispose() { trailGeo.dispose(); trailMat.dispose(); } });
  const hist = { R: [], L: [] };

  /* ── látigo (Seraf): cuerda con sigue-al-líder y tubo dinámico ── */
  const WM = 16, WR = 5; let whip = null;
  function buildWhip(hex, emi) {
    const pts = []; for (let i = 0; i < WM; i++) pts.push(new THREE.Vector3(0.2, -0.25, -0.6 - i * 0.05)); const prev = pts.map((p) => p.clone());
    const pos = new Float32Array(WM * WR * 3), nor = new Float32Array(WM * WR * 3), idx = [];
    for (let i = 0; i < WM - 1; i++) for (let j = 0; j < WR; j++) { const a = i * WR + j, b = i * WR + (j + 1) % WR; idx.push(a, b, a + WR, b, b + WR, a + WR); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: emi, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.2 }); const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; rig.add(mesh);
    return { pts, prev, g, m, mesh, pos, nor, len: 0.5 };
  }
  function whipStep(w, base, ext, dt, push) {
    const L = lerp(0.35, 1.7, clamp(ext, 0, 1)), seg = L / (WM - 1), n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let s = 0; s < n; s++) {
      w.pts[0].copy(base);
      for (let i = 1; i < WM; i++) {
        const p = w.pts[i], pr = w.prev[i], vx = (p.x - pr.x) * 0.955, vy = (p.y - pr.y) * 0.955, vz = (p.z - pr.z) * 0.955; pr.copy(p);
        p.x += vx; p.y += vy - 0.9 * h * h; p.z += vz - push * (i / WM) * h * h * 60;
      }
      for (let i = 1; i < WM; i++) { _a.copy(w.pts[i]).sub(w.pts[i - 1]); const l = _a.length() || 1e-4; w.pts[i].copy(w.pts[i - 1]).addScaledVector(_a, seg / l); }
    }
    for (let i = 0; i < WM; i++) { // tubo
      const p = w.pts[i], a = w.pts[Math.max(0, i - 1)], b = w.pts[Math.min(WM - 1, i + 1)]; _a.copy(b).sub(a).normalize(); _b.copy(Math.abs(_a.y) > 0.9 ? _c.set(1, 0, 0) : _c.set(0, 1, 0)).cross(_a).normalize(); _c.copy(_a).cross(_b);
      const r = lerp(0.013, 0.0035, i / (WM - 1)) * (i === 0 ? 0.9 : 1);
      for (let j = 0; j < WR; j++) { const an = j / WR * TAU, cx = Math.cos(an), sy = Math.sin(an), o = (i * WR + j) * 3; w.nor[o] = _b.x * cx + _c.x * sy; w.nor[o + 1] = _b.y * cx + _c.y * sy; w.nor[o + 2] = _b.z * cx + _c.z * sy; w.pos[o] = p.x + w.nor[o] * r; w.pos[o + 1] = p.y + w.nor[o + 1] * r; w.pos[o + 2] = p.z + w.nor[o + 2] * r; }
    }
    w.g.attributes.position.needsUpdate = w.g.attributes.normal.needsUpdate = true;
  }

  /* ── construcción por Huésped ── */
  function dispose1() { if (wm) { wm.dispose(); wm = null; wmKey = ''; } if (!built) return; for (const k of ['R', 'L']) { const l = limbs[k]; if (!l) continue; rig.remove(l.g); l.body.geometry.dispose(); l.body.material.dispose(); if (l.wpn) { l.wpn.geometry.dispose(); l.wpn.material.dispose(); } if (l.glow) { l.glow.geometry.dispose(); l.glow.material.dispose(); } } if (whip) { rig.remove(whip.mesh); whip.g.dispose(); whip.m.dispose(); whip = null; } built = null; limbs.R = limbs.L = null; }
  function build(char) {
    dispose1(); const S = styleOf(char), pal = D.hostPal(char); host = char; built = S;
    const skinMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8c8c8c, roughness: 0.5, metalness: 0.2, emissive: pal.c, emissiveIntensity: 0.07 });
    const wpnMat = () => S.wpn === 'glow' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.3, emissive: pal.c, emissiveIntensity: 0.9 }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.75, emissive: pal.c, emissiveIntensity: 0.55 });
    const glowMat = () => new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color(pal.a) }, uO: { value: 0.7 }, uGam: GAM, uInt: INT }, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }', fragmentShader: 'uniform vec3 uC; uniform float uO; uniform float uGam; uniform float uInt; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.4); gl_FragColor = vec4(pow(uC, vec3(uGam)), f * uO * uInt); }' });
    const bodyGeo = S.body(), wpnGeo = S.weapon();
    for (const k of ['R', 'L']) {
      const g = new THREE.Group(); g.rotation.order = 'YXZ'; if (k === 'L') g.scale.x = -1; // el izquierdo es el espejo del derecho (three corrige el sentido de las caras)
      const body = new THREE.Mesh(k === 'L' ? S.body() : bodyGeo, skinMat()); const wpn = new THREE.Mesh(k === 'L' ? S.weapon() : wpnGeo, wpnMat()); body.frustumCulled = wpn.frustumCulled = false; g.add(body, wpn); let glow = null;
      if (S.glow) { glow = new THREE.Mesh(S.glow(), glowMat()); glow.frustumCulled = false; glow.renderOrder = 6; g.add(glow); }
      rig.add(g); limbs[k] = { g, body, wpn, glow, ext: S.restExt };
    }
    if (S.whip) whip = buildWhip(0xffd45a, pal.a);
    trailMat.uniforms.uC.value.set(pal.c).lerp(WHITE, 0.35);
  }
  const hostOf = (me) => { const c = me && me.char; return STYLE[c] ? c : 'axioma'; };

  /* ── animación ── */
  function poseOf(limbKey, sw, ch) {
    if (sw) { const k = sw.kfs[limbKey]; const p = k ? sample(k, sw.u) : null; return p || [0, 0, 0, 0, 0, 0, 0, 0]; }
    if (ch) { // pre-golpe: sube a la pose de carga y vibra
      const kl = ch.light[limbKey] || null, kh = ch.heavy[limbKey] || null, pl = kl ? sample(kl, ch.u) : [0, 0, 0, 0, 0, 0, 0, 0], ph = kh ? sample(kh, WINDUP * Math.min(1, ch.t / 0.28)) : pl, hv = clamp((ch.t - 0.28) / 0.15, 0, 1), o = [0];
      for (let i = 1; i < 8; i++) o.push(lerp(pl[i], ph[i], hv)); const tr = hv * (0.004 + 0.006 * ch.level) * (D.reduced() ? 0 : 1); o[1] += Math.sin(T * 61) * tr; o[2] += Math.sin(T * 47 + 1) * tr; return o;
    }
    return null;
  }
  const rise = (a, b, t) => a + (b - a) * t;
  function applyLimb(k, pose, dt) {
    const l = limbs[k]; if (!l) return; const S = built, off = 1 - engage, rp = REST_POS[k], rr = REST_ROT[k], idle = !pose;
    const sway = D.reduced() ? 0 : Math.sin(T * 1.7 + (k === 'R' ? 0 : 2)) * 0.004, p = pose || [0, 0, 0, 0, 0, 0, 0, 0];
    l.g.position.set(rp[0] + p[1] + (k === 'R' ? 0.04 : -0.04) * off, rp[1] + p[2] + sway - 0.4 * off, rp[2] + p[3] + 0.18 * off);
    l.g.rotation.set(rr[0] + p[4] + 0.5 * off, rr[1] + p[5], rr[2] + p[6], 'YXZ');
    const ext = clamp(S.restExt + (1 - S.restExt) * p[7], 0, 1.4), lerpK = 1 - Math.exp(-30 * dt); l.ext += (ext - l.ext) * lerpK; l.wpn.visible = (l.ext > 0.03 || !!S.whip) && !l.catalog;
    if (!S.whip) { l.wpn.position.z = S.wz; l.wpn.scale.set(1, 1, Math.max(0.02, S.len * l.ext)); } if (l.glow) { l.glow.visible = l.ext > 0.03 && !l.catalog; l.glow.position.z = S.wz; l.glow.scale.set(1, 1, Math.max(0.02, S.len * l.ext)); l.glow.material.uniforms.uO.value = 0.55 + 0.25 * (charge ? charge.level : 0); }
    l.wpn.material.emissiveIntensity = 0.45 + 0.9 * (charge ? charge.level : 0) + (swing && swing.u > 0.3 && swing.u < 0.6 ? 0.6 : 0); void idle;
    l.g.updateMatrix(); l.g.matrixWorldNeedsUpdate = true;
  }
  const tipPts = (k) => { const l = limbs[k], S = built; // [base, punta] en el espacio del rig
    if (S.span) { _a.set(0, -S.span, -0.5).applyMatrix4(l.g.matrix); _b.set(0, S.span, -0.52).applyMatrix4(l.g.matrix); } else { _a.set(0, 0.03, S.wz).applyMatrix4(l.g.matrix); _b.set(0, 0.03, S.wz - S.len * clamp(l.ext, 0, 1.2)).applyMatrix4(l.g.matrix); }
    return [_a, _b]; };
  function updateTrail(dt, active) {
    if (!built || built.whip) { trailMesh.visible = false; return; }
    let any = false;
    for (const [li, k] of ['R', 'L'].entries()) {
      const hs = hist[k], l = limbs[k]; for (const p of hs) p.age += dt;
      while (hs.length && hs[hs.length - 1].age > 0.2) hs.pop();
      const strike = swing && swing.u > 0.2 && swing.u < 0.78 && swing.kfs[k] && l.ext > 0.2;
      if (strike && freeze <= 0) { const [a, b] = tipPts(k); hs.unshift({ a: a.clone(), b: b.clone(), age: 0 }); if (hs.length > TP) hs.pop(); }
      for (let i = 0; i < TP; i++) {
        const p = hs[Math.min(i, hs.length - 1)], v = (li * TP + i) * 2; if (!p) { for (let j = 0; j < 2; j++) { trailA[v + j] = 0; } continue; }
        const al = i < hs.length ? Math.pow(1 - p.age / 0.2, 1.4) : 0; trailPos.set([p.a.x, p.a.y, p.a.z, p.b.x, p.b.y, p.b.z], v * 3); trailA[v] = al * 0.25; trailA[v + 1] = al; if (al > 0.01) any = true;
      }
    }
    trailGeo.attributes.position.needsUpdate = trailGeo.attributes.aA.needsUpdate = true; trailMesh.visible = any; void active;
  }

  /* ── golpes ── */
  function kfsFor(kind, idx) {
    const C = COMBO[host] || COMBO.axioma;
    if (kind === 'heavy' || kind === 'exec') return C.h; if (kind === 'air') return AIR; return C.l[idx % 3];
  }
  function start(kind, o = {}) {
    if (kind === 'spin') kind = 'heavy'; if (kind === 'lunge') kind = 'light';   // giro y estocada reutilizan las animaciones de golpe pesado y ligero
    const S = built, now = T; const isHeavy = kind === 'heavy' || kind === 'exec' || kind === 'air';
    if (!isHeavy) { comboIdx = comboT < 1.0 ? (comboIdx + 1) % 3 : 0; } else comboIdx = 0; comboT = 0; if (kind === 'exec') kind = 'heavy';
    const kfs = kfsFor(kind, comboIdx), dur = S.dur[kind === 'light' ? 'light' : kind === 'air' ? 'air' : 'heavy'] * (o.fast ? 0.8 : 1);
    swing = { kind: o.kind || kind, shape: kind, idx: comboIdx, kfs, u: o.u0 || 0, dur, hit: o.hit || 0, exec: !!o.exec, impacted: false, predicted: !!o.predicted, t0: now, d: o.d || null, p: o.p || null };
    if (o.u0 && o.u0 > HIT_AT) swing.impacted = true;
    lastPredict = o.predicted ? { kind: swing.kind, t: now } : lastPredict; idleT = 0; cdUntil = now + dur * 0.62;
    const snd = D.getSound(); if (snd && !o.silent) snd.melee(host, swing.kind === 'exec' ? 'light' : swing.kind, null, 0, kind === 'heavy' || kind === 'air');
  }
  function impactPoint(sw, I) { // dónde pega: la criatura más cercana al frente (si hubo impacto) o el alcance del arma
    const C = CHARACTERS[host] && CHARACTERS[host].melee, range = C ? (C[sw.kind === 'light' ? 'light' : 'heavy'] || C.light).range : 3.6, eye = I.eye, dir = sw.d ? V(sw.d).normalize() : I.aim;
    let best = null, bd = 1e9; for (const m of (D.getState() ? D.getState().monsters : [])) { _a.set(m.p[0], m.p[1], m.p[2]).sub(eye); const l = _a.length(); if (l > range + m.r + 1) continue; const dd = _a.normalize().dot(dir); if (dd < 0.55) continue; if (l < bd) { bd = l; best = m; } }
    if (best && sw.hit > 0) return _b.set(best.p[0], best.p[1], best.p[2]).addScaledVector(dir, -best.r * 0.6).clone();
    return eye.clone().addScaledVector(dir, Math.min(range * 0.75, 3));
  }
  function impact(sw) {
    sw.impacted = true; const hit = sw.hit > 0 || sw.exec; if (!hit) return;
    const me = D.info(D.getMe(), null, { id: D.getMe() }), pal = D.hostPal(host), heavy = sw.shape !== 'light', big = sw.exec ? 1.6 : heavy ? 1.2 : 0.8, rm = D.reduced();
    const P = impactPoint(sw, me), dir = sw.d ? V(sw.d).normalize() : me.aim, n = dir.clone().negate();
    worldImpact(host, P, n, pal, heavy, sw.exec, me.up);
    freeze = rm ? 0.03 : sw.exec ? 0.11 : heavy ? 0.075 : 0.045;
    fl.t = fl.max = sw.exec ? 0.32 : 0.16; fl.size = (sw.exec ? 0.9 : heavy ? 0.6 : 0.4); flashSpr.material.color.set(sw.exec ? 0xffd2a0 : pal.a).lerp(WHITE, 0.35); flashSpr.position.set(srnd(0.08), -0.04 + srnd(0.04), -1.2); flashSpr.visible = true; flashSpr.material.rotation = rnd(6);
    mk.t = mk.max = sw.exec ? 0.55 : 0.28; mk.size = sw.exec ? 0.26 : 0.12; mk.tex = sw.exec ? execTex : hitTex; markSpr.material.map = mk.tex; markSpr.material.color.set(sw.exec ? 0xff5a3a : 0xffffff); markSpr.position.set(0, 0, -1.0); markSpr.visible = true; markSpr.material.opacity = 1;
    D.shake(me, (sw.exec ? 0.7 : heavy ? 0.45 : 0.22) * (host === 'micelio' ? 1.3 : 1)); if (fx.combat && !rm) fx.combat.K.fov = Math.min(fx.combat.K.fov + (heavy ? 1.6 : 0.6), 3.2);
    const snd = D.getSound(); if (snd) snd.melee(host, sw.exec ? 'exec' : 'hit', null, sw.hit || 1, heavy);
  }
  function worldImpact(h, P, n, pal, heavy, exec, up) { // chispas, destello y marca en el mundo (también lo ven los demás)
    const k = exec ? 1.7 : heavy ? 1.25 : 1, c = pal.c, a = pal.a;
    fx.flash(P, 0xffffff, 1.5 * k, 0.12, { burst: true }); fx.flash(P, exec ? 0xff7a3a : c, 2.4 * k, 0.2); // flashes contenidos: el impacto no debe tapar a la criatura
    switch (h) {
      case 'vesper': D.sparks(P, 0xffffff, 8 * k, 16, 0.4, { dir: n, cone: 1.6, c2: a }); for (let i = 0; i < (heavy ? 4 : 3); i++) { _a.copy(P).addScaledVector(up, 0.5 - i * 0.28).addScaledVector(_c.copy(n).cross(up).normalize(), -0.5); _b.copy(_a).addScaledVector(_c, 1.0).addScaledVector(up, -0.5); fx.line(_a, _b, i === 1 ? 0xffffff : a, 0.09, 0.22, { a0: 1, a1: 0, shrink: 0.6 }); } break;
      case 'micelio': D.ring(P.clone().addScaledVector(up, -0.4), up, 0.4, 3.2 * k, 0.4, c, { th: 0.14 }); D.spray(P, 0x6a5a2a, 6 * k, 5, 0.9, 1.2, { smoke: true, shape: SHAPE.smoke, grow: 1.4, c2: 0x241c0c }); D.spray(P, a, 8 * k, 8, 0.8, 0.6, { shape: SHAPE.bubble, up: 2, c2: c }); D.sparks(P, a, 5 * k, 9, 0.4, { dir: n, cone: 1.4 }); break;
      case 'umbra': fx.line(_a.copy(P).addScaledVector(n.clone().cross(up).normalize(), -1.4), _b.copy(P).addScaledVector(n.clone().cross(up).normalize(), 1.4), 0xffffff, 0.14, 0.25, { a0: 1, a1: 0, shrink: 0.9 }); fx.line(_a, _b, a, 0.55, 0.3, { a0: 0.6, a1: 0, shrink: 0.9 }); D.ring(P, null, 0.3, 2.6 * k, 0.4, a, { th: 0.1 }); D.sparks(P, a, 8 * k, 14, 0.4, { dir: n, cone: 1.4, c2: c }); break;
      case 'seraf': D.ring(P, n, 0.3, 3 * k, 0.35, a, { th: 0.12 }); D.sparks(P, 0xffffff, 8 * k, 18, 0.4, { dir: n, cone: 1.3, c2: c }); D.spray(P, c, 6 * k, 6, 0.6, 0.6, { shape: SHAPE.star, c2: a, spin: 4 }); break;
      default: D.sparks(P, 0xffffff, 10 * k, 18, 0.4, { dir: n, cone: 1.5, c2: c }); D.spray(P, 0xe9eef2, 4 * k, 8, 0.6, 0.7, { shape: SHAPE.shard, grav: 9, spin: 8, c2: c, grow: -0.4 });
    }
    if (exec) { fx.shatter(P, a, { size: 0.45, n: 3, speed: 9, dir: n }); D.ring(P, null, 0.4, 5, 0.5, 0xff7a3a, { th: 0.09 }); }
    if (heavy && h !== 'micelio') D.ring(P, n, 0.3, 2.6 * k, 0.4, c, { th: 0.12 });
  }
  /** Tajo en el mundo (otros jugadores y 3.ª persona): estelas cortas con la forma del arma de cada Huésped. */
  function worldSwing(I, ev, pal) {
    const heavy = ev.kind === 'heavy' || ev.kind === 'air' || ev.kind === 'exec', side = (worldSide = -worldSide), dir = ev.d ? V(ev.d).normalize() : I.aim, right = _c.copy(dir).cross(I.up).normalize().clone(), up = I.up, c = pal.c, a = pal.a, ctr = I.eye.clone().addScaledVector(dir, 1.5);
    const arc = (r, ang0, ang1, w, col2, life, off = 0, n = 7) => { let prev = null; for (let i = 0; i <= n; i++) { const t = ang0 + (ang1 - ang0) * i / n; _a.copy(ctr).addScaledVector(right, Math.cos(t) * r * side).addScaledVector(up, Math.sin(t) * r + off); if (prev) fx.line(prev, _a, col2, w, life, { a0: 0.9, a1: 0.2, shrink: 0.5 }); prev = (prev || new THREE.Vector3()).copy(_a); } };
    const k = heavy ? 1.35 : 1;
    switch (ev.char) {
      case 'vesper': for (let i = -1; i <= 1; i++) arc(1.4 * k, -0.5, 1.9, 0.07, i === 0 ? 0xffffff : a, 0.2, i * 0.14, 6); break;
      case 'micelio': D.ring(I.ground, up, 0.4, 3.4 * k, 0.4, c, { th: 0.14 }); arc(1.2 * k, 0.9, 2.2, 0.28, c, 0.22, 0, 5); break;
      case 'umbra': { _a.copy(ctr).addScaledVector(right, -2 * side).addScaledVector(up, 0.3); _b.copy(ctr).addScaledVector(right, 2 * side).addScaledVector(dir, 1.2).addScaledVector(up, -0.2); fx.line(_a, _b, 0xffffff, 0.1, 0.22, { a0: 1, a1: 0, shrink: 0.9 }); fx.line(_a, _b, c, 0.4, 0.3, { a0: 0.6, a1: 0, shrink: 0.9 }); break; }
      case 'seraf': { _a.copy(I.eye).addScaledVector(right, 0.3).addScaledVector(up, -0.3); let prev = _a.clone(); for (let i = 1; i <= 8; i++) { _b.copy(_a).addScaledVector(dir, i * 0.9 * k).addScaledVector(right, Math.sin(i / 8 * Math.PI) * 1.2 * side).addScaledVector(up, Math.cos(i * 1.3) * 0.15); fx.line(prev, _b, i % 2 ? c : a, 0.09 * (1 - i / 10), 0.16, { a0: 1, a1: 0.5 }); prev.copy(_b); } break; }
      default: for (let i = 0; i < 2; i++) arc(1.5 * k, -0.6, 1.9, 0.07, i ? 0xffffff : c, 0.2, i * 0.18, 6);
    }
    void pal;
  }
  /* ── API ── */
  function onEvent(e, me, state) {
    void state; const char = (state && state.players.find((p) => p.id === e.pid) || {}).char, hostId = STYLE[char] ? char : 'axioma', I = D.info(e.pid, e, me), pal = D.hostPal(hostId);
    const mine = me && e.pid === me.id, snd = D.getSound();
    if (mine && !renderer.third) {
      if (!built || host !== hostId) build(hostId);
      const sw = swing, conf = sw && sw.predicted && !sw.confirmed && lastPredict && T - lastPredict.t < 0.7 && (lastPredict.kind === e.kind || (e.kind !== 'light' && lastPredict.kind !== 'light') || e.kind === 'exec');
      if (conf) { sw.confirmed = true; sw.hit = e.hit || 0; sw.exec = e.kind === 'exec'; sw.d = e.d || null; sw.kind = e.kind; if (sw.u >= HIT_AT && !sw.impacted) impact(sw); if (snd) { /* el sonido de barrido ya sonó al predecir */ } }
      else start(e.kind, { hit: e.hit, exec: e.kind === 'exec', d: e.d, p: e.p, u0: e.kind === 'light' ? 0.2 : 0.22, fast: true });
    } else { // otro jugador (o 3.ª persona): tajo en el mundo
      if (snd) snd.melee(hostId, e.kind === 'exec' ? 'light' : e.kind, e.p || null, 0, e.kind !== 'light');
      host = host || hostId; worldSwing(I, { ...e, char: hostId }, pal);
      if (e.hit > 0 || e.kind === 'exec') { const dir = e.d ? V(e.d).normalize() : I.aim, range = (CHARACTERS[hostId].melee.light.range || 3.6) * 0.7; const P = I.eye.clone().addScaledVector(dir, range); later(0.12, () => { worldImpact(hostId, P, dir.clone().negate(), pal, e.kind !== 'light', e.kind === 'exec', I.up); if (snd) snd.melee(hostId, e.kind === 'exec' ? 'exec' : 'hit', P.toArray(), e.hit || 1, e.kind !== 'light'); }); }
    }
  }
  const pend = []; const later = (s, fn) => pend.push({ t: s, fn });
  /** Tecla V: predicción local. */
  function key(down, state) {
    const me = state && state.players.find((p) => p.id === D.getMe()); if (!me || me.dead || renderer.third) return;
    const hostId = hostOf(me); if (!built || host !== hostId) build(hostId);
    if (down) { if (charge || T < cdUntil) return; const C = COMBO[host]; charge = { t: 0, u: 0, level: 0, light: C.l[(comboT < 1.0 ? comboIdx + 1 : 0) % 3], heavy: C.h }; idleT = 0; return; }
    if (!charge) return;
    const ch = charge; charge = null; const k = D.known(D.getMe()), air = k && Math.abs(k.vel.dot(k.upV)) > 3.2, kind = air ? 'air' : ch.t >= 0.28 ? 'heavy' : 'light';
    start(kind, { predicted: true, u0: kind === 'light' ? Math.min(WINDUP, ch.u) : WINDUP, fast: false });
  }
  function update(dt, state, me) {
    dt = Math.min(dt, 0.1); T += dt; comboT += dt; const fp = !renderer.third, mineChar = me && me.char; void state;
    for (let i = pend.length - 1; i >= 0; i--) { pend[i].t -= dt; if (pend[i].t <= 0) pend.splice(i, 1)[0].fn(); }
    if (me && fp && (!built || (host !== hostOf(me) && !swing && !charge))) build(hostOf(me));
    if (!built) return; void mineChar; syncWeapon(me, dt);
    const active = !!(swing || charge); idleT = active ? 0 : idleT + dt; const want = fp && me && !me.dead && (active || idleT < 0.35) ? 1 : 0; engage += (want - engage) * Math.min(1, dt * (want ? 18 : 8)); if (Math.abs(engage - want) < 0.01) engage = want;
    // el arma del viewmodel baja mientras dura el melee
    const vm = renderer.vm; if (vm && vm.root) { const off = -0.95 * sm(engage); vm.root.position.y += off - vmOff; vmOff = off; const hide = engage > 0.6; if (hide !== gunHidden) { gunHidden = hide; vm.root.visible = hide ? false : !renderer.third; } } // con los brazos arriba el arma ni se dibuja (ahorra sus draw calls)
    rig.visible = engage > 0.02; if (!rig.visible) { trailMesh.visible = false; if (whip) whip.mesh.visible = false; limbs.R && (limbs.R.g.visible = limbs.L.g.visible = false); return; } limbs.R.g.visible = limbs.L.g.visible = true;
    rig.scale.copy(vm && vm.root ? vm.root.scale : _a.set(1, 1, 1)); rig.scale.z = 1;
    // hit-stop visual: sólo congela la animación
    const adt = freeze > 0 ? 0 : dt; freeze = Math.max(0, freeze - dt);
    let ch = null; if (charge) { charge.t += dt; charge.u = Math.min(WINDUP, charge.t / 0.28 * WINDUP); charge.level = clamp((charge.t - 0.28) / 0.7, 0, 1); ch = charge; }
    if (swing) { swing.u += adt / swing.dur; if (!swing.impacted && swing.u >= HIT_AT && (swing.hit > 0 || swing.exec)) impact(swing); else if (!swing.impacted && swing.u >= HIT_AT && (!swing.predicted || swing.confirmed)) swing.impacted = true; if (swing.u >= 1) swing = null; }
    for (const k of ['R', 'L']) applyLimb(k, poseOf(k, swing, ch), dt);
    updateTrail(dt);
    if (whip) { const l = limbs.R, wsw = swing && swing.kfs.R && swing.u > 0.25 && swing.u < 0.62; WB.set(0, 0.0, -0.47).applyMatrix4(l.g.matrix); whip.mesh.visible = !limbs.R.catalog; whipStep(whip, WB, l.ext, dt, wsw ? 1.2 : 0); }
    // destello y marcador
    if (fl.t > 0) { fl.t -= dt; const u = 1 - Math.max(0, fl.t) / fl.max; flashSpr.visible = fl.t > 0; flashSpr.material.opacity = (1 - u) * (1 - u) * 0.7; flashSpr.scale.setScalar(fl.size * (0.6 + 0.8 * u)); } else flashSpr.visible = false;
    if (mk.t > 0) { mk.t -= dt; const u = 1 - Math.max(0, mk.t) / mk.max; markSpr.visible = mk.t > 0; markSpr.material.opacity = 1 - u * u; markSpr.scale.setScalar(mk.size * (u < 0.2 ? 0.6 + 2 * u : 1 + 0.3 * (u - 0.2))); } else markSpr.visible = false;
    if (impactKick > 0) impactKick = 0;
  }
  function clear() { swing = null; charge = null; engage = 0; idleT = 9; freeze = 0; fl.t = mk.t = 0; flashSpr.visible = markSpr.visible = false; rig.visible = false; trailMesh.visible = false; const vm = renderer.vm; if (vm && vm.root) { vm.root.position.y -= vmOff; vmOff = 0; if (gunHidden) vm.root.visible = !renderer.third; } gunHidden = false; pend.length = 0; hist.R.length = hist.L.length = 0; if (whip) whip.mesh.visible = false; }
  function stats() { let m = 0; if (rig.visible) rig.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible && o.parent && o.parent.visible !== false) m++; }); return { meshes: m, swing: swing ? swing.kind : null, charge: !!charge, engage: +engage.toFixed(2) }; }
  return {
    onEvent, update, key, clear, stats, dispose() { clear(); dispose1(); cam.remove(rig); for (const d of disposables) d.dispose(); },
    /** Para el banco de pruebas: dispara un golpe local sin pasar por la sim. */
    play(kind, o = {}) { const hid = o.char || host || 'axioma'; if (!built || host !== hid) build(hid); if (!o.keepCombo) comboT = o.idx != null ? 0 : 9; if (o.idx != null) comboIdx = (o.idx + 2) % 3; start(kind, { hit: o.hit || 0, exec: kind === 'exec', d: o.d, predicted: false, u0: o.u0 || 0, silent: !!o.silent }); },
    get swing() { return swing; }, get engage() { return engage; },
  };
}
