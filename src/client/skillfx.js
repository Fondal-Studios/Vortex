// Efectos de las HABILIDADES de los 6 héroes (desplazamiento + disparo especial) y de las 4 habilidades de equipo (tecla Q).
// Cada habilidad tiene identidad propia y el color de su héroe. Todo sale de POOLS FIJOS (nada se crea por evento):
//   · mallas propias, todas aditivas y sin luces: cintas/estelas (Ribbons), cáscaras fresnel (esfera, casquete, cápsula, silueta),
//     discos con shader (huella del cono, acreción, hexágonos de la cúpula, radar, anillos), haces con espiral, marcadores de blanco;
//   · las partículas, chispas, cintas cortas, destellos y anillos salen de `renderer.fx` (Effects), con su presupuesto por calidad
//     (Baja ≤ 150 partículas vivas entre las dos capas; aquí además se usan menos partículas por evento en Baja/Media).
// API (ver docs/gate/heroes.md):
//   const sfx = createSkillFx(renderer);
//   sfx.onEvent(e, me, state)  → true si el evento quedó resuelto acá (render.js debe omitir el dibujo viejo). `state` es opcional.
//   sfx.update(dt, state)      → llamar UNA vez por cuadro, DESPUÉS de handleEvents (si falta `state`, sólo animan los efectos sueltos).
//   sfx.clear() / sfx.dispose() / sfx.stats()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHARACTERS } from '../sim/data.js';
import { SHAPE, GAM, INT } from './effects.js';

const Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const rnd = (a = 1) => Math.random() * a, srnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const eo = (u) => 1 - (1 - u) * (1 - u) * (1 - u); // ease-out cúbico
// OJO: en el snapshot actual la clave `up` aparece dos veces (vector 'arriba' y mejoras de arma) y gana la última; si no es un vector de 3 números se usa un respaldo
const upOf = (p, mapId) => { const a = p && p.up; if (Array.isArray(a) && a.length === 3 && typeof a[0] === 'number') return new THREE.Vector3(a[0], a[1], a[2]); if (mapId === 'm2' && p && p.pos) return new THREE.Vector3(-p.pos[0], -p.pos[1], -p.pos[2]).normalize(); return new THREE.Vector3(0, 1, 0); };
const colCache = new Map();
const C = (hex) => { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; };
const basis = (x, y, z, q) => q.setFromRotationMatrix(_m.makeBasis(x, y, z));
const orient = (q, fwd, up) => q.setFromRotationMatrix(_m.makeBasis(new THREE.Vector3().crossVectors(up, fwd).normalize(), up, fwd)); // +Z = frente, +Y = arriba
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

/* ───────────────────────── shaders ───────────────────────── */
const SHELL_VS = `uniform float uGl; uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY;
void main(){ vec3 p = position;
  if (uGl > 0.0) { float sl = floor(p.y * 9.0 + uT * 14.0); float h = fract(sin(sl * 91.3 + floor(uT * 9.0) * 7.1) * 437.5); p.x += (h - 0.5) * uGl * step(0.66, h) * 0.9; }
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = p.y; gl_Position = projectionMatrix * mv; }`;
const SHELL_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uT; uniform float uPow; uniform float uBase; uniform float uSt; uniform float uGam; uniform float uInt; varying vec3 vN; varying vec3 vV; varying float vY;
void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
  float st = uSt > 0.0 ? 0.55 + 0.45 * sin(vY * uSt - uT * 7.0) : 1.0;
  vec3 c = mix(uC, uC2, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(pow(c, vec3(uGam)), (f + uBase) * uO * uInt * st); }`;

const DISC_VS = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uT; uniform float uMode; uniform float uHalf; uniform float uK; uniform float uGam; uniform float uInt; varying vec2 vP;
float hexd(vec2 p){ p = abs(p); return max(dot(p, vec2(0.8660254, 0.5)), p.y); }
void main(){
  float r = length(vP); if (r > 1.0) discard; float ang = atan(vP.x, vP.y); float a = 0.0; vec3 c = uC;
  if (uMode < 0.5) { // huella de sector (cono de la onda de choque)
    float inS = 1.0 - smoothstep(uHalf - 0.03, uHalf, abs(ang)); float edge = smoothstep(0.88, 1.0, r); float side = smoothstep(uHalf - 0.12, uHalf, abs(ang)) * inS;
    float bands = 0.5 + 0.5 * sin(r * 44.0 - uT * 20.0);
    a = inS * (0.07 + 0.55 * edge + 0.5 * side + 0.16 * bands * (1.0 - r) * (1.0 - r)); c = mix(uC, uC2, clamp(edge + side, 0.0, 1.0));
  } else if (uMode < 1.5) { // disco de acreción (agujero negro)
    float rr = clamp((r - 0.2) / 0.8, 0.0, 1.0); float hole = smoothstep(0.17, 0.27, r);
    float arms = pow(0.5 + 0.5 * sin((ang + (1.0 - rr) * uK) * 3.0 - uT * 2.6), 1.5); float dop = 0.55 + 0.45 * sin(ang + 1.0);
    float rad = pow(1.0 - rr, 1.6); a = hole * (rad * (0.45 + 1.0 * arms) * dop + 0.05 * (1.0 - rr)) * smoothstep(1.0, 0.8, r);
    c = mix(uC, uC2, pow(1.0 - rr, 2.2));
  } else if (uMode < 2.5) { // piso hexagonal de la cúpula
    vec2 q = vP * 6.0; vec2 s = vec2(1.0, 1.7320508); vec2 h = s * 0.5; vec2 a1 = mod(q, s) - h; vec2 b1 = mod(q - h, s) - h; vec2 g = dot(a1, a1) < dot(b1, b1) ? a1 : b1;
    float line = smoothstep(0.38, 0.49, hexd(g)); float wave = 0.5 + 0.5 * sin(r * 8.0 - uT * 3.2); float rim = smoothstep(0.9, 0.985, r);
    a = (0.06 + 0.6 * line * (0.3 + 0.7 * wave) + 0.75 * rim) * (1.0 - 0.35 * r); c = mix(uC, uC2, rim);
  } else if (uMode < 3.5) { // anillo de atracción: rayitas que caen hacia el centro
    float ring = smoothstep(0.9, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r)); float mv = fract(r * 2.2 + uT * 0.9);
    float dash = step(0.0, sin(ang * 34.0)) * smoothstep(0.0, 0.25, mv) * (1.0 - smoothstep(0.25, 0.5, mv)) * smoothstep(0.15, 0.9, r);
    a = ring * 0.7 + dash * 0.5 + 0.05 * r; c = mix(uC, uC2, dash);
  } else if (uMode < 4.5) { // aviso de estallido (radio) con marcas
    float ring = smoothstep(0.92, 0.975, r) * (1.0 - smoothstep(0.985, 1.0, r)); float tick = step(0.5, fract(ang * 24.0 / 6.2832)) * smoothstep(0.84, 0.9, r) * (1.0 - smoothstep(0.92, 0.95, r));
    a = ring + 0.6 * tick + 0.12 * r * r * (0.5 + 0.5 * sin(uT * uK)); c = mix(uC, uC2, ring);
  } else if (uMode < 5.5) { // radar de la Marca
    float d = mod(uK - ang, 6.2832); float trail = smoothstep(1.7, 0.0, d) * smoothstep(0.0, 0.12, r);
    float rg = smoothstep(0.97, 1.0, r) + 0.5 * (smoothstep(0.012, 0.0, abs(r - 0.33)) + smoothstep(0.012, 0.0, abs(r - 0.66))) + smoothstep(0.02, 0.0, abs(d) / 6.0) * 1.2;
    a = trail * 0.55 * r + rg * 0.6 + 0.04; c = mix(uC, uC2, smoothstep(0.0, 0.5, trail));
  } else if (uMode < 6.5) { // anillo fino (lente, onda)
    a = smoothstep(1.0 - uK * 1.6, 1.0 - uK * 0.45, r) * (1.0 - smoothstep(1.0 - uK * 0.45, 1.0, r)); c = uC;
  } else { // plano de obra (torreta): cuadrícula + barrido
    vec2 g = abs(fract(vP * 5.0) - 0.5); float grid = smoothstep(0.46, 0.5, max(g.x, g.y)); float rim = smoothstep(0.93, 1.0, r);
    float sc = smoothstep(0.06, 0.0, abs(vP.y - (fract(uK) * 2.0 - 1.0))) * 1.2;
    float br = step(0.82, max(abs(vP.x), abs(vP.y))) * step(max(abs(vP.x), abs(vP.y)), 0.98) * step(min(abs(vP.x), abs(vP.y)), 0.28);
    a = grid * 0.35 + rim * 0.8 + sc + br * 0.8 + 0.05; c = mix(uC, uC2, sc + br);
  }
  gl_FragColor = vec4(pow(c, vec3(uGam)), clamp(a, 0.0, 1.0) * uO * uInt); }`;

const BEAM_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const BEAM_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uT; uniform float uLen; uniform float uMode; uniform float uK; uniform float uGam; uniform float uInt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ float ce = pow(abs(dot(normalize(vN), normalize(vV))), 1.3); float ang = vUv.x * 6.2832; float x = vUv.y * uLen; float a = ce; vec3 c = uC;
  if (uMode > 0.5 && uMode < 1.5) { float s1 = pow(max(0.0, cos(ang + x * uK - uT * 9.0)), 10.0); float s2 = pow(max(0.0, cos(ang + x * uK - uT * 9.0 + 3.1416)), 10.0); a = ce * 0.35 + (s1 + s2) * (0.4 + 0.6 * ce); c = mix(uC, uC2, s2 / max(s1 + s2, 0.001)); }
  else if (uMode > 1.5) { float rg = pow(max(0.0, sin(x * uK - uT * 26.0)), 8.0); a = ce * 0.35 + rg * 0.9; c = mix(uC, uC2, rg); }
  a *= smoothstep(0.0, 1.4, x) * smoothstep(0.0, 3.0, uLen - x * 0.0);
  gl_FragColor = vec4(pow(c, vec3(uGam)), a * uO * uInt); }`;

const RIB_VS = `attribute vec3 aDir; attribute float aSide; attribute float aW; attribute float aA; attribute vec3 aC; varying vec3 vC; varying float vA; varying float vSd;
void main(){ vC = aC; vA = aA; vSd = aSide; vec4 p0 = modelViewMatrix * vec4(position, 1.0); vec3 d = (modelViewMatrix * vec4(aDir, 0.0)).xyz; vec3 n = cross(d, p0.xyz); float l = length(n); n = l < 1e-6 ? vec3(1.0, 0.0, 0.0) : n / l; p0.xyz += n * aSide * aW; gl_Position = projectionMatrix * p0; }`;
const RIB_FS = `uniform float uGam; uniform float uInt; varying vec3 vC; varying float vA; varying float vSd;
void main(){ float s = abs(vSd); float core = exp(-s * s * 7.0); float glow = pow(1.0 - s, 1.5); vec3 c = mix(vC, vec3(1.0), core * 0.65); gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(uGam)), vA * uInt * (glow * 0.5 + core * 0.75)); }`;

/* ───────────────────────── cintas / estelas ───────────────────────── */
class Ribbons {
  constructor(parent, R = 8, P = 28) {
    this.R = R; this.P = P; this.items = []; this.rr = 0;
    const nv = R * P * 2;
    this.pos = new Float32Array(nv * 3); this.dir = new Float32Array(nv * 3); this.side = new Float32Array(nv); this.w = new Float32Array(nv); this.a = new Float32Array(nv); this.c = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) this.side[i] = i & 1 ? 1 : -1;
    const idx = new Uint16Array(R * (P - 1) * 6); let k = 0;
    for (let r = 0; r < R; r++) for (let i = 0; i < P - 1; i++) { const v = (r * P + i) * 2; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], k); k += 6; }
    const g = new THREE.BufferGeometry();
    const at = (n, arr, s) => { const b = new THREE.BufferAttribute(arr, s); b.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, b); };
    at('position', this.pos, 3); at('aDir', this.dir, 3); at('aSide', this.side, 1); at('aW', this.w, 1); at('aA', this.a, 1); at('aC', this.c, 3); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ ...ADD, uniforms: { uGam: GAM, uInt: INT }, vertexShader: RIB_VS, fragmentShader: RIB_FS });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.visible = false; parent.add(this.mesh);
    for (let i = 0; i < R; i++) this.items.push({ on: false, pts: [], life: 1, w: 1, c1: 0, c2: 0, alpha: 1, taper: 1, gap2: 0.04, follow: null, ended: false });
  }
  /** o: { c1, c2, w, life, alpha, taper, gap, follow:(out)=>bool, pts:[Vector3] } */
  start(o) {
    let it = this.items.find((x) => !x.on); if (!it) { it = this.items[this.rr]; this.rr = (this.rr + 1) % this.R; }
    Object.assign(it, { on: true, pts: [], life: o.life || 0.5, w: o.w || 1, c1: o.c1, c2: o.c2 == null ? o.c1 : o.c2, alpha: o.alpha == null ? 1 : o.alpha, taper: o.taper == null ? 1 : o.taper, gap2: (o.gap || 0.25) ** 2, follow: o.follow || null, ended: !o.follow });
    if (o.pts) for (const p of o.pts) it.pts.push({ x: p.x, y: p.y, z: p.z, age: 0 });
    this.mesh.visible = true; return it;
  }
  update(dt) {
    let any = false; const P = this.P;
    for (let ri = 0; ri < this.R; ri++) {
      const it = this.items[ri]; if (!it.on) continue; any = true;
      if (it.follow && !it.ended) {
        if (!it.follow(_a)) it.ended = true;
        else { const h = it.pts[0]; if (!h || (h.x - _a.x) ** 2 + (h.y - _a.y) ** 2 + (h.z - _a.z) ** 2 > it.gap2) { it.pts.unshift({ x: _a.x, y: _a.y, z: _a.z, age: 0 }); if (it.pts.length > P) it.pts.pop(); } else { h.x = _a.x; h.y = _a.y; h.z = _a.z; } }
      }
      for (const p of it.pts) p.age += dt;
      while (it.pts.length && it.pts[it.pts.length - 1].age >= it.life) it.pts.pop();
      if (!it.pts.length && it.ended) { it.on = false; }
      const n = it.pts.length;
      for (let k = 0; k < P; k++) {
        const vi = (ri * P + k) * 2;
        for (let s = 0; s < 2; s++) {
          const j = vi + s, j3 = j * 3;
          if (k < n && n > 1) {
            const p = it.pts[k], pr = it.pts[k - 1] || p, nx = it.pts[k + 1] || p, u = clamp(p.age / it.life, 0, 1);
            this.pos[j3] = p.x; this.pos[j3 + 1] = p.y; this.pos[j3 + 2] = p.z;
            this.dir[j3] = pr.x - nx.x; this.dir[j3 + 1] = pr.y - nx.y; this.dir[j3 + 2] = pr.z - nx.z;
            const head = k === 0 ? 0.55 : 1; // la punta nace fina
            this.w[j] = it.w * Math.pow(1 - u, it.taper) * head; this.a[j] = it.alpha * Math.pow(1 - u, 1.25);
            const c1 = C(it.c1), c2 = C(it.c2); this.c[j3] = c1.r + (c2.r - c1.r) * u; this.c[j3 + 1] = c1.g + (c2.g - c1.g) * u; this.c[j3 + 2] = c1.b + (c2.b - c1.b) * u;
          } else { this.a[j] = 0; this.w[j] = 0; }
        }
      }
    }
    if (any) { const A = this.geo.attributes; A.position.needsUpdate = A.aDir.needsUpdate = A.aW.needsUpdate = A.aA.needsUpdate = A.aC.needsUpdate = true; } else this.mesh.visible = false;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.mesh.parent && this.mesh.parent.remove(this.mesh); }
  clear() { for (const it of this.items) { it.on = false; it.pts.length = 0; } this.a.fill(0); this.w.fill(0); this.geo.attributes.aA.needsUpdate = this.geo.attributes.aW.needsUpdate = true; this.mesh.visible = false; }
}

/* ───────────────────────── fábrica principal ───────────────────────── */
export function createSkillFx(renderer) {
  const fx = renderer.fx, scene = renderer.scene, cam = renderer.camera;
  const root = new THREE.Group(); root.name = 'skillfx'; scene.add(root);
  const Q = () => [0.5, 0.8, 1][fx.tier == null ? 2 : fx.tier];
  const N = (n) => Math.max(1, Math.round(n * Q()));
  const hi = () => (fx.tier == null ? 2 : fx.tier) >= 1; // Media/Alta: más capas
  const spray = (p, c, n, sp, life, size, o = {}) => fx.spray(p, c, N(n), sp, life, size, { raw: true, ...o });
  const sparks = (p, c, n, sp, life, o) => fx.sparks(p, c, N(n), sp, life, o);
  const disposables = [];
  const loops = [], delays = [];
  const known = new Map(); // pid → { pos, h, up, vel, char, col, ... } del cuadro anterior
  let T = 0, lastState = null, meId = 0;
  const addLoop = (dur, fn) => loops.push({ t: 0, dur, fn });
  const later = (s, fn) => delays.push({ t: s, fn });
  const ribbons = new Ribbons(root, 8, 28); disposables.push(ribbons);

  /* ── pools de mallas ── */
  const mkPool = (n, make) => { const items = []; for (let i = 0; i < n; i++) { const it = make(); it.held = false; items.push(it); } let i = 0; return { items, take() { for (let k = 0; k < items.length; k++) { const it = items[i]; i = (i + 1) % items.length; if (!it.held) return it; } return items[0]; } }; };
  const shellMat = () => new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uT: { value: 0 }, uPow: { value: 2.2 }, uBase: { value: 0.05 }, uGl: { value: 0 }, uSt: { value: 0 }, uGam: GAM, uInt: INT }, vertexShader: SHELL_VS, fragmentShader: SHELL_FS });
  const mkShell = (geo, order = 3) => () => { const m = new THREE.Mesh(geo, shellMat()); m.visible = false; m.renderOrder = order; m.frustumCulled = false; root.add(m); return m; };
  const gSphere = new THREE.SphereGeometry(1, 22, 14), gCap = new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 3), gAura = new THREE.CapsuleGeometry(0.62, 1.1, 6, 14).translate(0, 0.9, 0);
  const gGhost = (() => { // silueta humana simple (pies en y=0): torso, cabeza, piernas, brazos al frente
    const part = (g, x, y, z, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g; };
    return mergeGeometries([part(new THREE.CapsuleGeometry(0.3, 0.55, 3, 10), 0, 1.22, 0), part(new THREE.SphereGeometry(0.19, 12, 9), 0, 1.74, 0.02), part(new THREE.CapsuleGeometry(0.13, 0.55, 3, 8), -0.16, 0.42, 0), part(new THREE.CapsuleGeometry(0.13, 0.55, 3, 8), 0.16, 0.42, 0),
      part(new THREE.CapsuleGeometry(0.09, 0.5, 3, 8), -0.36, 1.3, 0.28, Math.PI / 2.2), part(new THREE.CapsuleGeometry(0.09, 0.5, 3, 8), 0.34, 1.34, 0.32, Math.PI / 2.4)]);
  })();
  const gCyl = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), gDisc = new THREE.CircleGeometry(1, 72);
  disposables.push({ dispose() { [gSphere, gCap, gAura, gGhost, gCyl, gDisc].forEach((g) => g.dispose()); } });
  const sphereP = mkPool(5, mkShell(gSphere)), capP = mkPool(2, mkShell(gCap)), auraP = mkPool(2, mkShell(gAura)), ghostP = mkPool(3, mkShell(gGhost));
  const mkDisc = () => { const m = new THREE.Mesh(gDisc, new THREE.ShaderMaterial({ ...ADD, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uT: { value: 0 }, uMode: { value: 0 }, uHalf: { value: 1 }, uK: { value: 0.1 }, uGam: GAM, uInt: INT }, vertexShader: DISC_VS, fragmentShader: DISC_FS })); m.visible = false; m.renderOrder = 2; m.frustumCulled = false; root.add(m); return m; };
  const discT = mkPool(14, mkDisc), discP = mkPool(14, mkDisc);
  const mkBeam = () => { const m = new THREE.Mesh(gCyl, new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uT: { value: 0 }, uLen: { value: 1 }, uMode: { value: 0 }, uK: { value: 1 }, uGam: GAM, uInt: INT }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS })); m.visible = false; m.renderOrder = 4; m.frustumCulled = false; root.add(m); return m; };
  const beamP = mkPool(8, mkBeam);
  // marcadores de blanco (anillo giratorio + ▼)
  const canvasTex = (draw, s = 256) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; disposables.push(t); return t; };
  const ringTex = canvasTex((g, s) => {
    g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.lineCap = 'round';
    g.lineWidth = s * 0.028; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, s * 0.42, i * Math.PI / 2 + 0.22, i * Math.PI / 2 + Math.PI / 2 - 0.22); g.stroke(); }
    g.lineWidth = s * 0.012; g.beginPath(); g.arc(0, 0, s * 0.34, 0, TAU); g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
    for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(s * 0.48, 0); g.lineTo(s * 0.37, -s * 0.045); g.lineTo(s * 0.37, s * 0.045); g.fill(); g.restore(); }
  });
  const triTex = canvasTex((g, s) => { g.translate(s / 2, s / 2); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, s * 0.34); g.lineTo(-s * 0.26, -s * 0.2); g.lineTo(s * 0.26, -s * 0.2); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, s * 0.16); g.lineTo(-s * 0.12, -s * 0.1); g.lineTo(s * 0.12, -s * 0.1); g.closePath(); g.fill(); });
  const gPlane = new THREE.PlaneGeometry(2, 2); disposables.push(gPlane);
  const markers = new Map(); // id de criatura → { ring, tri, born, tint }
  const markerFree = []; let markerMade = 0;
  const makeMarker = () => {
    if (markerFree.length) return markerFree.pop(); if (markerMade >= 10) return null; markerMade++;
    const ring = new THREE.Mesh(gPlane, new THREE.MeshBasicMaterial({ map: ringTex, ...ADD, color: 0xffffff })); ring.renderOrder = 6; ring.frustumCulled = false; root.add(ring);
    const tri = new THREE.Sprite(new THREE.SpriteMaterial({ map: triTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })); tri.renderOrder = 12; root.add(tri);
    return { ring, tri };
  };
  const rel = (mk) => { mk.ring.visible = mk.tri.visible = false; markerFree.push(mk); };

  /* ── utilidades de animación de mallas ── */
  const setU = (m, o) => { const u = m.material.uniforms; for (const k in o) { if (k === 'uC' || k === 'uC2') u[k].value.set(o[k]); else u[k].value = o[k]; } };
  /** Cáscara que crece de r0 a r1 y se apaga. quat opcional. o: {op, pow, base, gl, st, c2, fade, follow, sy} */
  function shell(pool, pos, quat, r0, r1, dur, color, o = {}) {
    const m = pool.take(); m.visible = true; m.position.copy(pos); if (quat) m.quaternion.copy(quat); else m.quaternion.identity();
    setU(m, { uC: color, uC2: o.c2 == null ? color : o.c2, uO: 0, uPow: o.pow == null ? 2.2 : o.pow, uBase: o.base == null ? 0.05 : o.base, uGl: o.gl || 0, uSt: o.st || 0, uT: 0 });
    const op = o.op == null ? 0.8 : o.op, fade = o.fade == null ? 1.2 : o.fade, sy = o.sy == null ? 1 : o.sy;
    addLoop(dur, (dt, u, t) => { const r = r0 + (r1 - r0) * (o.lin ? u : eo(u)); m.scale.set(r, r * sy, r); if (o.follow && o.follow(_e)) m.position.copy(_e); setU(m, { uO: op * Math.pow(1 - u, fade) * (u < 0.08 ? u / 0.08 : 1), uT: t }); if (u >= 1) m.visible = false; });
    return m;
  }
  /** Disco plano. orient: normal `up` (+ `h` para sectores) o null = mira a la cámara. */
  function disc(pool, pos, up, h, r0, r1, dur, mode, color, color2, o = {}) {
    const m = pool.take(); m.visible = true; m.position.copy(pos);
    if (up) { const hh = h || (Math.abs(up.y) < 0.9 ? _a.set(0, 1, 0).cross(up).normalize() : _a.set(1, 0, 0)); basis(_b.copy(hh).cross(up).normalize(), _c.copy(hh), _d.copy(up), m.quaternion); }
    setU(m, { uC: color, uC2: color2 == null ? color : color2, uMode: mode, uHalf: o.half || 1, uK: o.k == null ? 0.1 : o.k, uO: 0, uT: 0 });
    const op = o.op == null ? 0.9 : o.op, fade = o.fade == null ? 1 : o.fade;
    if (dur > 0) addLoop(dur, (dt, u, t) => { const r = r0 + (r1 - r0) * (o.lin ? u : eo(u)); m.scale.setScalar(r); if (!up) m.quaternion.copy(cam.quaternion); if (o.spin) m.rotateZ(o.spin * dt); if (o.follow && o.follow(_e)) m.position.copy(_e); setU(m, { uT: t, uO: op * Math.pow(1 - u, fade) * (u < 0.06 ? u / 0.06 : 1), uK: o.kfn ? o.kfn(u, t) : (o.k == null ? 0.1 : o.k) }); if (u >= 1) m.visible = false; });
    return m;
  }
  /** Anillo fino que se expande (usa discos propios: no roba anillos al pool compartido). */
  function ring(pos, normal, r0, r1, dur, color, o = {}) {
    disc(discT, pos, normal, null, r0, r1, dur, 6, color, color, { op: o.op == null ? 0.95 : o.op, k: o.th || 0.1, fade: o.fade == null ? 1 : o.fade, lin: false });
    if (o.chroma && hi()) { disc(discT, pos, normal, null, r0 * 1.05, r1 * 1.07, dur, 6, 0xff5a5a, 0xff5a5a, { op: 0.5, k: (o.th || 0.1) * 0.8 }); disc(discT, pos, normal, null, r0 * 0.95, r1 * 0.93, dur, 6, 0x5a8aff, 0x5a8aff, { op: 0.5, k: (o.th || 0.1) * 0.8 }); }
  }
  /** Haz cilíndrico de A a B. */
  function beam(a, b, r, dur, color, color2, mode, o = {}) {
    const m = beamP.take(); m.visible = true; _a.copy(b).sub(a); const l = _a.length(); if (l < 0.01) { m.visible = false; return m; }
    m.position.copy(a).addScaledVector(_a, 0.5); m.quaternion.setFromUnitVectors(Y, _a.normalize());
    setU(m, { uC: color, uC2: color2 == null ? color : color2, uLen: l, uMode: mode, uK: o.k == null ? 1 : o.k, uO: 0 });
    const op = o.op == null ? 1 : o.op, grow = o.grow == null ? 0 : o.grow;
    addLoop(dur, (dt, u, t) => { const rr = r * (1 + grow * u) * (o.shrink ? 1 - o.shrink * u : 1) * (1 + (o.throb || 0) * Math.sin(t * 40)); m.scale.set(rr, l, rr); setU(m, { uT: t, uO: op * Math.pow(1 - u, o.fade == null ? 0.8 : o.fade) * (u < 0.05 ? u / 0.05 : 1) }); if (u >= 1) m.visible = false; });
    return m;
  }
  /** Implosión: partículas que convergen hacia un punto (sobre una esfera de radio R). */
  function implode(at, color, color2, n, R, life, size, o = {}) {
    n = N(n); for (let i = 0; i < n; i++) {
      _a.set(srnd(), srnd(), srnd()); if (o.up) { _a.addScaledVector(o.up, -_a.dot(o.up) * (o.flat == null ? 0 : o.flat)); } _a.normalize(); const rr = R * (0.6 + rnd(0.4));
      const lf = life * (0.7 + rnd(0.3)), sp = rr / lf;
      fx.add.spawn(at.x + _a.x * rr, at.y + _a.y * rr, at.z + _a.z * rr, -_a.x * sp + (o.tx || 0) * srnd(), -_a.y * sp, -_a.z * sp, C(color), C(color2 == null ? color : color2), size * (0.6 + rnd(0.7)), lf, 0, 0, o.grow == null ? -0.7 : o.grow, o.shape == null ? SHAPE.ember : o.shape, srnd(4), 1);
    }
  }
  // chispa de estela en el aire: partícula suelta con velocidad dada
  const puff = (p, vx, vy, vz, c1, c2, size, life, o = {}) => { if (o.smoke) fx.smoke.spawn(p.x, p.y, p.z, vx, vy, vz, C(c1), C(c2), size, life, 0, o.drag == null ? 1.5 : o.drag, o.grow == null ? 1.4 : o.grow, SHAPE.smoke, srnd(2), 1); else fx.add.spawn(p.x, p.y, p.z, vx, vy, vz, C(c1), C(c2), size, life, o.grav || 0, o.drag == null ? 2 : o.drag, o.grow == null ? -0.6 : o.grow, o.shape == null ? SHAPE.soft : o.shape, o.spin || 0, o.amp == null ? 1 : o.amp); };

  /* ── datos de jugadores ── */
  const heroColor = (char, fb = 0x66ffee) => (CHARACTERS[char] ? CHARACTERS[char].color : fb);
  function info(pid, e, me) {
    const pl = lastState ? lastState.players.find((q) => q.id === pid) : null, k = known.get(pid), src = pl || k;
    const up = upOf(src, renderer.mapId), h = src ? V(src.h) : new THREE.Vector3(0, 0, -1), pitch = pl ? pl.pitch : (k ? k.pitch : 0);
    const pos = e && e.p ? V(e.p) : (src ? V(src.pos) : new THREE.Vector3());
    const aim = h.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const right = new THREE.Vector3().crossVectors(h, up).normalize();
    const char = src ? src.char : null, col = heroColor(char);
    const self = !!me && pid === me.id && !renderer.third;
    const prev = k ? k.pos.clone() : pos.clone();
    return { pid, pl: src, pos, prev, up, h, aim, right, pitch, char, col, self, eye: pos.clone().addScaledVector(up, 0.6), ground: pos.clone().addScaledVector(up, -0.85) };
  }
  const follow = (pid, lift = 0, upDist = 0) => (out) => { const k = known.get(pid); if (!k) return false; out.copy(k.pos).addScaledVector(k.upV, lift - 0.0 + upDist); return true; };
  const moveDir = (I) => { const k = known.get(I.pid); if (k && k.speed > 2) return k.vel.clone().normalize(); return I.h.clone(); };
  /** Líneas de velocidad alrededor de la cámara (sólo para uno mismo en primera persona). */
  function streaks(dir, color, n, len = 7) {
    for (let i = 0; i < n; i++) {
      _a.copy(cam.position); _b.set(0, 0, -1).applyQuaternion(cam.quaternion); _c.set(1, 0, 0).applyQuaternion(cam.quaternion); _d.set(0, 1, 0).applyQuaternion(cam.quaternion);
      _a.addScaledVector(_b, 3 + rnd(9)).addScaledVector(_c, srnd(6.5)).addScaledVector(_d, srnd(4)); if (Math.hypot(_c.dot(_e.copy(_a).sub(cam.position)), _d.dot(_e)) < 1.6) continue;
      _e.copy(_a).addScaledVector(dir, -len * (0.6 + rnd(0.8)));
      fx.line(_e, _a, color, 0.06 + rnd(0.05), 0.2 + rnd(0.1), { a0: 0, a1: 0.85, shrink: 0.4 });
    }
  }
  const shake = (I, k) => { if (I.self && renderer.shake !== undefined) renderer.shake = Math.max(renderer.shake, k); };
  const muzzle = (I, e) => I.self ? cam.localToWorld(_e.set(0.3, -0.25, -1.2)).clone() : (e && e.o ? V(e.o) : I.eye.clone()).addScaledVector(I.aim, 0.9);

  /* ───────────────────────── ÉGIDA ───────────────────────── */
  function impactShock(at, dir, col, big = 1) {
    fx.flash(at, 0xffffff, 3.2 * big, 0.16, { burst: true }); fx.flash(at, col, 4.5 * big, 0.22);
    ring(at, dir, 0.4, 4.2 * big, 0.42, col, { chroma: true, th: 0.14 });
    sparks(at, 0xffffff, 8, 14, 0.45, { c2: col, dir, cone: 2.4 });
    fx.shatter(at, col, { size: 0.32 * big, n: 3, speed: 9, dir });
    spray(at, col, 6, 8, 0.6, 0.8, { shape: SHAPE.shard, grav: 9, spin: 8, c2: 0xffffff, grow: -0.4 });
  }
  function embestida(I) {
    const { pid, col, h, up } = I, g = I.ground;
    fx.flash(g, 0xe8ffff, 4.5, 0.2, { burst: true });
    ring(g, up, 0.5, 5.5, 0.5, col, { chroma: true, th: 0.13 });
    spray(g, 0x6a7a8a, 8, 5, 0.9, 1.2, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.5, c2: 0x1c1c26, spin: 2 });
    spray(g, col, 12, 14, 0.5, 0.8, { dir: _a.copy(h).negate().clone(), cone: 0.7, c2: 0xffffff });
    ribbons.start({ c1: col, c2: 0x2a6aff, w: 2.4, life: 0.65, alpha: 1, taper: 1.0, gap: 0.3, follow: follow(pid, 0.1) });
    ribbons.start({ c1: 0xffffff, c2: col, w: 0.9, life: 0.4, alpha: 1, taper: 1.4, gap: 0.3, follow: follow(pid, 0.35) });
    // escudo de choque delante
    const sh = sphereP.take(); sh.visible = true; setU(sh, { uC: col, uC2: 0xffffff, uPow: 1.6, uBase: 0.12, uO: 0.7, uGl: 0.4, uSt: 0 });
    const hit = new Set();
    const mons = lastState ? lastState.monsters : [];
    addLoop(0.5, (dt, u, t) => {
      const k = known.get(pid); if (!k) { sh.visible = false; return false; }
      sh.position.copy(k.pos).addScaledVector(h, 1.7); sh.scale.set(1.5, 1.2, 2.3 - u * 0.8); orient(sh.quaternion, h, up); setU(sh, { uO: 0.75 * (1 - u) * (1 - u), uT: t });
      const gp = _c.copy(k.pos).addScaledVector(up, -0.85);
      if (hi() || Math.random() < 0.6) { puff(_d.copy(gp).addScaledVector(up, 0.2), srnd(2), 1 + rnd(2), srnd(2), 0x7a7a8a, 0x1c1c26, 1.0 + rnd(0.5), 0.8, { smoke: true }); }
      sparks(gp, 0xffffff, 1, 8, 0.4, { dir: _e.copy(h).negate(), cone: 1.2, c2: col });
      for (const m of (lastState ? lastState.monsters : mons)) { if (hit.has(m.id)) continue; const d = _d.set(m.p[0], m.p[1], m.p[2]).distanceTo(k.pos); if (d < m.r + 2.6 && _e.copy(_d).sub(k.pos).dot(h) > -1) { hit.add(m.id); if (hit.size <= N(4)) impactShock(_d.clone(), h, col, clamp(m.r / 1.4, 0.8, 1.7)); } }
      if (u >= 1) sh.visible = false;
    });
    if (I.self) { addLoop(0.45, () => { streaks(h, col, 3, 8); }); shake(I, 0.3); }
  }
  function onda(I, e) {
    const { col, aim, up, h } = I, o = I.eye.clone();
    _q.setFromUnitVectors(Y, aim);
    shell(capP, o, _q.clone(), 2, 22, 0.32, col, { c2: 0xffffff, op: 0.85, pow: 1.5, base: 0.08, st: 5, fade: 1.1 });
    later(0.06, () => shell(capP, o, _q.clone(), 1.5, 21, 0.3, 0xffffff, { c2: col, op: 0.55, pow: 2.4, base: 0.02 }));
    // huella en el suelo (el área que golpeó) + aviso para los demás
    disc(discT, I.ground, up, h, 22, 22, 0.95, 0, col, 0xffffff, { half: 1.047, op: 0.95, fade: 1.3, lin: true });
    // distorsión: anillos con aberración cromática en el eje de disparo
    for (const [dd, r1, dl] of [[2, 6, 0], [7, 11, 0.07], [12, 15, 0.14]]) later(dl, () => { _d.copy(o).addScaledVector(aim, dd); ring(_d, aim, 0.8, r1, 0.45, dl ? col : 0xffffff, { chroma: true, th: 0.1 }); });
    fx.flash(_a.copy(o).addScaledVector(aim, 1.2), 0xffffff, 8, 0.2, { burst: true });
    sparks(_a.copy(o).addScaledVector(aim, 1.5), col, 14, 30, 0.5, { dir: aim, cone: 1.0, c2: 0xffffff });
    spray(_a, col, 14, 20, 0.5, 1.0, { dir: aim, cone: 0.8, c2: 0x2a6aff, grow: 0.6 });
    // escombro de cristal que salta del suelo en el cono
    const mk = [5, 10, 16];
    mk.forEach((d, i) => later(0.05 + i * 0.07, () => { _d.copy(I.ground).addScaledVector(h, d).addScaledVector(I.right, srnd(d * 0.5)); spray(_d, col, 8, 13, 1.0, 0.9, { shape: SHAPE.shard, dir: up, cone: 0.7, grav: 16, spin: 8, c2: 0xffffff, grow: -0.3 }); spray(_d, 0x6a7a8a, 3, 4, 1.0, 1.4, { smoke: true, shape: SHAPE.smoke, grow: 1.5, c2: 0x1c1c26 }); if (i === 1) fx.shatter(_d.clone().addScaledVector(up, 0.8), col, { size: 0.5, n: 5, speed: 11, dir: up }); }));
    // criaturas dentro del cono: golpe escalonado
    if (lastState) { let n = 0; for (const m of lastState.monsters) { _d.set(m.p[0], m.p[1], m.p[2]); const to = _e.copy(_d).sub(I.pos), l = to.length(); if (l > 20 + m.r || to.normalize().dot(aim) < 0.5) continue; if (++n > N(5)) break; const at = _d.clone(); later(l / 70, () => impactShock(at, aim, col, clamp(m.r / 1.4, 0.7, 1.6))); } }
    shake(I, 0.6);
  }

  /* ───────────────────────── LUMEN ───────────────────────── */
  function portal(at, up, col, arriving) {
    fx.flash(at.clone().addScaledVector(up, 0.9), 0xffffff, 5.5, 0.22, { burst: true }); fx.flash(at.clone().addScaledVector(up, 0.9), col, 7, 0.3);
    beam(_a.copy(at).addScaledVector(up, -0.8), _b.copy(at).addScaledVector(up, 7), 1.1, 0.5, 0xffffff, col, 0, { op: 0.9, shrink: 0.9 });
    ring(at.clone().addScaledVector(up, -0.8), up, 0.3, 4.2, 0.5, col, { chroma: true, th: 0.12 });
    if (arriving) implode(at.clone().addScaledVector(up, 0.8), 0xffd0f0, col, 18, 4.5, 0.32, 0.8, { shape: SHAPE.star }); else spray(at.clone().addScaledVector(up, 0.5), col, 16, 5, 0.9, 0.7, { shape: SHAPE.star, spin: 4, up: 4, c2: 0xffffff });
    spray(at, 0xffffff, 8, 3, 0.8, 0.5, { shape: SHAPE.shard, up: 3, c2: col, spin: 6 });
  }
  function paso(I) {
    const from = I.prev, to = I.pos, up = I.up;
    portal(from.clone(), up, I.col, false); portal(to.clone(), up, I.col, true);
    if (from.distanceToSquared(to) > 4) {
      const pts = []; for (let i = 0; i <= 6; i++) pts.push(from.clone().lerp(to, i / 6).addScaledVector(up, 0.2 + Math.sin(i / 6 * Math.PI) * 0.4));
      ribbons.start({ c1: 0xffffff, c2: I.col, w: 0.8, life: 0.45, alpha: 1, taper: 0.8, pts });
      fx.dart(from, to, 0xffffff, 0.12, 260, 9, { c2: I.col });
      const d = from.distanceTo(to), n = Math.min(N(8), Math.floor(d / 1.8)); for (let i = 1; i < n; i++) { _d.copy(from).lerp(to, i / n); puff(_d, srnd(0.5), 1 + rnd(1.5), srnd(0.5), 0xffffff, I.col, 0.7, 0.6, { shape: SHAPE.star, spin: 4, amp: 1 }); }
    }
    if (I.self) { streaks(I.h, I.col, 8, 12); shake(I, 0.15); }
  }
  function healAlly(q, col) {
    const pos = V(q.pos), up = upOf(q, renderer.mapId);
    ring(pos.clone().addScaledVector(up, -0.8), up, 0.4, 3.2, 0.55, col, { th: 0.12 }); fx.flash(pos.clone().addScaledVector(up, 0.4), 0xdfffe8, 3, 0.3);
    for (let i = 0; i < N(7); i++) { _d.copy(pos).addScaledVector(up, -0.6 + rnd(1.2)).addScaledVector(_e.set(srnd(), 0, srnd()), 0.6); puff(_d, srnd(0.4), 2 + rnd(2.5), srnd(0.4), 0xffffff, col, 0.75, 0.9 + rnd(0.4), { shape: SHAPE.star, spin: 3, grow: -0.5 }); }
  }
  function beamHeal(e, me) {
    const a = V(e.o), b = V(e.to), d = b.clone().sub(a), l = d.length(); if (l < 0.5) return; d.normalize();
    const pid = e.pid, self = me && pid === me.id && !renderer.third; if (self) a.copy(cam.localToWorld(_e.set(0.28, -0.22, -1.1)));
    const col = 0x7dff9a, pink = 0xff66c4;
    beam(a, b, 1.0, 0.9, col, pink, 1, { k: 0.8, op: 1.4, fade: 0.8, shrink: 0.35, throb: 0.05 });
    beam(a, b, 0.34, 0.65, 0xffffff, col, 0, { op: 1.3, fade: 1.0 });
    fx.flash(a, 0xffffff, 3.2, 0.18, { burst: true }); fx.flash(a, pink, 4.5, 0.28); fx.flash(b, col, 4, 0.25, { burst: true });
    ring(a, d, 0.3, 2.2, 0.4, pink, { th: 0.12 }); ring(b, _a.copy(d).negate(), 0.4, 3.4, 0.45, col, { th: 0.1 });
    const n = Math.min(N(10), Math.floor(l / 3)); for (let i = 1; i <= n; i++) { _c.copy(a).lerp(b, i / (n + 1)); puff(_c, srnd(0.6), srnd(0.6), srnd(0.6), 0xffffff, i % 2 ? col : pink, 0.6, 0.7, { shape: SHAPE.star, spin: 4 }); }
    if (lastState) for (const q of lastState.players) { if (q.dead || q.id === pid) continue; const oc = V(q.pos).sub(a), t = oc.dot(d); if (t < 0 || t > l + 2) continue; if (oc.addScaledVector(d, -t).length() < 2.6) healAlly(q, col); }
  }

  /* ───────────────────────── FORJA ───────────────────────── */
  function propulsor(I) {
    const { pid, up, h, right, col } = I, g = I.ground, down = _a.copy(up).negate().clone();
    fx.flash(g, 0xfff4c0, 6, 0.22, { burst: true }); ring(g, up, 0.5, 6, 0.5, 0xff7a1a, { chroma: true, th: 0.14 });
    fx.decal(g, up, 0x0a0608, 3.4, 5, { op: 0.8 });
    spray(g, 0x3a2a24, 10, 6, 1.4, 1.8, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.6, c2: 0x0c0808, spin: 2, up: 1 });
    spray(g, 0xfff0a0, 14, 14, 0.5, 1.2, { dir: down, cone: 0.5, c2: 0xff4a10, grow: 0.7 });
    ribbons.start({ c1: 0xffd070, c2: 0xff3a10, w: 1.0, life: 0.55, alpha: 0.95, taper: 0.8, gap: 0.3, follow: follow(pid, -0.7) });
    // llama de cohete mientras sube
    const flameCone = sphereP.take(); flameCone.visible = true; setU(flameCone, { uC: 0xff7a1a, uC2: 0xfff4c0, uPow: 1.2, uBase: 0.25, uO: 0.8, uGl: 0.25, uSt: 18 });
    addLoop(0.75, (dt, u, t) => {
      const k = known.get(pid); if (!k) { flameCone.visible = false; return false; }
      const f = _b.copy(k.pos).addScaledVector(k.upV, -0.95); const fl = 1 - u * 0.5;
      flameCone.position.copy(f).addScaledVector(k.upV, -0.9 * fl); orient(flameCone.quaternion, h, k.upV); flameCone.scale.set(0.55 * fl, 1.5 * fl, 0.55 * fl); setU(flameCone, { uO: 0.85 * (1 - u * u), uT: t });
      const nn = hi() ? 3 : 2; for (let i = 0; i < nn; i++) puff(f, srnd(1.5) + -k.upV.x * 13, -k.upV.y * 13 + srnd(1), srnd(1.5) - k.upV.z * 13, 0xfff4b0, 0xff3a10, 1.0 + rnd(0.6), 0.28 + rnd(0.15), { grow: -0.55, shape: SHAPE.ember, drag: 1.5 });
      if (Math.random() < 0.7) puff(f, srnd(2), srnd(2) - 3, srnd(2), 0x4a3c34, 0x0c0808, 1.3, 1.0, { smoke: true });
      if (Math.random() < 0.35) sparks(f, 0xffd23f, 2, 12, 0.45, { dir: _e.copy(k.upV).negate(), cone: 0.9, c2: 0xff5a1a });
      if (u >= 1) flameCone.visible = false;
    });
    if (I.self) { addLoop(0.7, () => streaks(up, 0xffd070, 3, 7)); shake(I, 0.4); }
  }
  const pending = [], tracked = new Map(); // proyectiles de habilidad (cohete, singularidad, esquirlas)
  function cohete(I, e) {
    const o = muzzle(I, e), { aim, col } = I;
    fx.flash(o, 0xfff4c0, 5, 0.2, { burst: true }); fx.flash(o, col, 7, 0.28);
    sparks(o, 0xffd23f, 12, 22, 0.45, { dir: aim, cone: 0.6, c2: 0xff5a1a });
    spray(o, 0x504860, 8, 5, 1.1, 1.4, { smoke: true, shape: SHAPE.smoke, dir: _a.copy(aim).negate().clone(), cone: 0.7, grow: 1.5, c2: 0x1a1424 });
    ring(o, aim, 0.3, 2.8, 0.35, 0xffd23f, { th: 0.12 });
    pending.push({ kind: 'cohete', pid: I.pid, pos: I.eye.clone().addScaledVector(aim, 1.5), t: T, col }); rocketCast = T; rocketCol = col;
    shake(I, 0.35);
  }
  let rocketCast = -99, rocketCol = 0xffd23f;
  function clusterBurst(at, up, col) {
    const n = N(6); for (let i = 0; i < n; i++) { _a.set(srnd(), srnd(), srnd()).normalize(); const end = at.clone().addScaledVector(_a, 11 + rnd(4)); fx.dart(at, end, i % 2 ? 0xffd23f : 0xffffff, 0.12, 40 + rnd(20), 3.5, { c2: 0xff4a10 }); later(0.28 + rnd(0.1), () => { fx.flash(end, 0xffd23f, 3, 0.15, { burst: true }); sparks(end, 0xffd23f, 4, 9, 0.35, { c2: 0xff5a1a }); }); }
    ring(at, up, 1, 12, 0.5, col, { chroma: true, th: 0.1 });
  }

  /* ───────────────────────── VIGÍA ───────────────────────── */
  function deslizamiento(I) {
    const { pid, up, col } = I, dir = moveDir(I), g = I.ground;
    spray(g, 0x7a8a6a, 8, 5, 0.9, 1.3, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.4, c2: 0x1c261a });
    sparks(g, col, 12, 16, 0.5, { dir: _a.copy(dir).negate().clone(), cone: 0.9, c2: 0xffffff }); ring(g, up, 0.3, 3.4, 0.4, col, { th: 0.12 });
    ribbons.start({ c1: 0xeaffc0, c2: col, w: 1.2, life: 0.55, alpha: 0.9, taper: 1.0, gap: 0.3, follow: follow(pid, -0.7) });
    ribbons.start({ c1: 0xffffff, c2: col, w: 0.28, life: 0.5, alpha: 0.9, taper: 1.2, gap: 0.3, follow: follow(pid, 0.25) });
    addLoop(0.5, (dt, u) => { const k = known.get(pid); if (!k) return false; _b.copy(k.pos).addScaledVector(k.upV, -0.8); puff(_b, srnd(1.5) - dir.x * 3, 1 + rnd(1.5), srnd(1.5) - dir.z * 3, 0x7a8a6a, 0x1c261a, 1.1, 0.8, { smoke: true }); if (Math.random() < 0.6) sparks(_b, col, 1, 9, 0.35, { dir: _e.copy(dir).negate(), cone: 1.1, c2: 0xffffff });
      if (hi() && Math.random() < 0.5) { _c.copy(k.pos).addScaledVector(k.upV, 0.1 + rnd(1.0)).addScaledVector(k.right || _d.set(1, 0, 0), srnd(0.7)); fx.line(_c, _d.copy(_c).addScaledVector(dir, -5.5), col, 0.1, 0.35, { a0: 0.8, a1: 0, shrink: 0.9 }); } });
    if (I.self) { addLoop(0.5, () => streaks(dir, col, 3, 9)); shake(I, 0.2); }
  }
  function beamRail(e, me, state) {
    const a = V(e.o), b = V(e.to), d = b.clone().sub(a), l = d.length(); if (l < 0.5) return; d.normalize();
    const pid = e.pid, self = me && pid === me.id && !renderer.third; if (self) a.copy(cam.localToWorld(_e.set(0.28, -0.22, -1.1)));
    const col = 0x9dff5a;
    beam(a, b, 0.9, 0.55, col, 0xffffff, 2, { k: 0.75, op: 1.3, fade: 0.9 });          // anillos de aire que viajan
    beam(a, b, 0.3, 0.38, 0xffffff, col, 0, { op: 1.4, fade: 1.2 });                        // núcleo blanco
    beam(a, b, 0.045, 1.25, col, col, 0, { op: 0.65, fade: 0.9 });                        // línea de mira que queda
    fx.flash(a, 0xffffff, 3.2, 0.16, { burst: true }); fx.flash(a, col, 4.5, 0.25); fx.flash(b, col, 4.5, 0.25, { burst: true });
    ring(a, d, 0.3, 2.6, 0.35, col, { th: 0.12 }); ring(b, _a.copy(d).negate(), 0.4, 3.6, 0.4, col, { chroma: true, th: 0.1 });
    sparks(a, col, 6, 16, 0.4, { dir: d, cone: 0.5, c2: 0xffffff }); sparks(b, 0xffffff, 6, 16, 0.4, { c2: col });
    // criaturas atravesadas: quedan marcadas en verde
    const ms = state || lastState; if (ms) for (const m of ms.monsters) { const oc = _c.set(m.p[0], m.p[1], m.p[2]).sub(a), t = oc.dot(d); if (t > 0 && t < l + 2 && oc.addScaledVector(d, -t).length() < m.r * 1.15) { tint.set(m.id, T + 9.5); fx.flash(_e.set(m.p[0], m.p[1], m.p[2]), col, m.r * 2.4, 0.22, { burst: true }); } }
    shake(me && me.id === pid ? { self: true } : { self: false }, 0.35);
  }
  const tint = new Map(); // id de criatura → hasta cuándo se pinta de verde (Vigía)

  /* ───────────────────────── NOVA ───────────────────────── */
  function salto(I) {
    const { pid, up, col, h } = I, g = I.prev.clone().addScaledVector(up, -0.85);
    fx.flash(g, 0xffe0b0, 6, 0.25, { burst: true }); fx.decal(g, up, 0x0a0608, 3, 4, { op: 0.8 });
    [0, 0.07, 0.14].forEach((dl, i) => later(dl, () => ring(_d.copy(g).addScaledVector(up, 0.05 + i * 0.7), up, 0.4, 6 - i * 1.4, 0.5, i === 1 ? 0xff5ab4 : col, { chroma: i === 0, th: 0.12 })));
    beam(_a.copy(g), _b.copy(g).addScaledVector(up, 16), 1.3, 0.5, 0xffffff, col, 0, { op: 0.9, shrink: 0.9 });
    spray(g, col, 16, 10, 0.9, 0.8, { dir: up, cone: 0.5, up: 5, c2: 0xff3a10, shape: SHAPE.ember });
    sparks(g, 0xffe0a0, 10, 20, 0.6, { dir: up, cone: 0.9, c2: col });
    ribbons.start({ c1: 0xffffff, c2: col, w: 1.1, life: 0.9, alpha: 1, taper: 0.8, gap: 0.4, follow: follow(pid, -0.4) });
    ribbons.start({ c1: 0xff5ab4, c2: 0xff9a3c, w: 0.5, life: 0.7, alpha: 0.9, taper: 1.2, gap: 0.4, follow: (out) => { const k = known.get(pid); if (!k) return false; out.copy(k.pos).addScaledVector(k.upV, -0.4).addScaledVector(k.right || _e.set(1, 0, 0), Math.sin(T * 14) * 0.8); return true; } });
    addLoop(0.8, (dt, u, t) => { const k = known.get(pid); if (!k) return false; const an = t * 16; _b.copy(k.pos).addScaledVector(k.upV, -0.2 - u).addScaledVector(k.right || _e.set(1, 0, 0), Math.cos(an) * 1.3).addScaledVector(k.h || h, Math.sin(an) * 1.3); puff(_b, 0, -1, 0, 0xffe0a0, 0xff3a10, 0.9, 0.5, { shape: SHAPE.star, spin: 6 }); });
    if (I.self) { addLoop(0.8, () => streaks(up, col, 3, 10)); shake(I, 0.4); }
  }
  function rafaga(I, e) {
    const sh = rafagaShot.get(I.pid); rafagaShot.delete(I.pid);
    const o = I.self ? muzzle(I, null) : (sh ? V(sh.o) : I.eye.clone()).addScaledVector(I.aim, 0.8), col = I.col, aim = I.aim, up = I.up, right = I.right;
    const tips = sh ? sh.to.map(V) : [], med = tips.length ? tips.map((t) => t.distanceTo(o)).sort((x, y) => x - y)[tips.length >> 1] : 50;
    const upv = _c.copy(right).cross(aim).normalize().clone();
    const rr = (() => { let s = (I.pid * 9301 + Math.round(T * 1000)) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; }; })();
    let impacts = 0;
    for (let i = 0; i < 14; i++) {
      const dir = i < tips.length ? _d.copy(tips[i]).sub(o).normalize().clone() : aim.clone().addScaledVector(right, rr() * 0.17).addScaledVector(upv, rr() * 0.12).normalize();
      const len = i < tips.length ? tips[i].distanceTo(o) : clamp(med * (0.55 + (rr() + 0.5) * 0.9), 8, 95), end = o.clone().addScaledVector(dir, len);
      fx.dart(o, end, i % 3 === 0 ? 0xffffff : i % 2 ? 0xffc070 : col, 0.1, 330 + (rr() + 0.5) * 160, 8, { c2: i % 2 ? 0xff3a10 : 0xff5ab4 });
      fx.line(o, end, col, 0.05, 0.18, { a0: 0.4, a1: 0.15, shrink: 0.6 });
      if (len < 90 && impacts < N(6)) { impacts++; later(len / 400, () => { sparks(end, 0xffe0a0, 4, 10, 0.35, { c2: col }); fx.flash(end, col, 2.2, 0.14, { burst: true }); }); }
    }
    fx.flash(o, 0xffffff, 9, 0.18, { burst: true }); fx.flash(o, col, 12, 0.3);
    sparks(o, col, 18, 36, 0.5, { dir: aim, cone: 0.8, c2: 0xffffff });
    spray(o, 0xffd0a0, 14, 14, 0.5, 1.4, { dir: aim, cone: 0.7, c2: 0xff3a10, grow: 0.7 });
    spray(o, 0x4a3c34, 7, 6, 1.1, 1.4, { smoke: true, shape: SHAPE.smoke, dir: aim, cone: 0.9, grow: 1.5, c2: 0x0c0808 });
    ring(o, aim, 0.3, 3.8, 0.38, col, { chroma: true, th: 0.12 });
    shake(I, 0.6);
  }
  const rafagaShot = new Map();

  /* ───────────────────────── UMBRA ───────────────────────── */
  function ghost(at, h, up, op, dur, col) {
    const m = ghostP.take(); m.visible = true; m.position.copy(at); orient(m.quaternion, h, up); m.scale.set(1, 1, 1);
    setU(m, { uC: col, uC2: 0xffffff, uPow: 1.8, uBase: 0.32, uGl: 1, uSt: 22, uO: 0 });
    addLoop(dur, (dt, u, t) => { m.scale.set(1 + u * 0.12, 1 + u * 0.05, 1 + u * 0.12); setU(m, { uO: op * Math.pow(1 - u, 1.3), uT: t, uGl: 0.6 + u }); if (u >= 1) m.visible = false; });
  }
  function fase(I) {
    const { pid, up, h, col } = I, from = I.prev.clone().addScaledVector(up, -0.85);
    ghost(from, h, up, 0.85, 0.75, col);
    fx.flash(I.prev, col, 5, 0.25, { burst: true }); fx.flash(I.prev, 0xffffff, 3, 0.15, { burst: true });
    ring(from, up, 0.3, 4.5, 0.5, col, { chroma: true, th: 0.12 });
    spray(from, 0x2a1050, 10, 5, 1.3, 2.0, { smoke: true, shape: SHAPE.smoke, grow: 1.5, c2: 0x0a0414, spin: 2 });
    spray(from, col, 12, 9, 0.9, 0.7, { shape: SHAPE.shard, c2: 0x3a1a8a, grow: -0.5, spin: 8 });
    ribbons.start({ c1: 0xe8d8ff, c2: 0x3a1a8a, w: 1.3, life: 0.6, alpha: 0.95, taper: 0.9, gap: 0.3, follow: follow(pid, -0.1) });
    ribbons.start({ c1: col, c2: 0x1a0a40, w: 0.6, life: 0.7, alpha: 0.9, taper: 1.2, gap: 0.3, follow: follow(pid, 0.5) });
    // posimágenes que se quedan atrás
    [0.1, 0.2, 0.3].forEach((dl, i) => later(dl, () => { const k = known.get(pid); if (k) ghost(_a.copy(k.pos).addScaledVector(k.upV, -0.85).clone(), h, up, 0.55 - i * 0.12, 0.45, col); }));
    // aura de invulnerabilidad: 1 s (se ve desde afuera)
    if (!I.self) {
      const au = auraP.take(); au.visible = true; setU(au, { uC: col, uC2: 0xffffff, uPow: 1.5, uBase: 0.12, uGl: 0.35, uSt: 10, uO: 0 });
      addLoop(1.0, (dt, u, t) => { const k = known.get(pid); if (!k) { au.visible = false; return false; } au.position.copy(k.pos).addScaledVector(k.upV, -0.85); orient(au.quaternion, k.h || h, k.upV); const fl = u > 0.8 ? (Math.sin(t * 60) > 0 ? 1 : 0.2) : 1; setU(au, { uO: (0.55 + 0.15 * Math.sin(t * 22)) * fl * Math.min(1, t * 8), uT: t }); if (u >= 1) au.visible = false; });
    }
    addLoop(0.55, () => { const k = known.get(pid); if (!k) return false; _b.copy(k.pos).addScaledVector(k.upV, srnd(0.9)).addScaledVector(k.right || _e.set(1, 0, 0), srnd(0.6)); puff(_b, srnd(1), srnd(1.5), srnd(1), 0xe8d8ff, 0x3a1a8a, 0.35 + rnd(0.3), 0.5, { shape: SHAPE.shard, spin: 10, grow: -0.3 }); if (Math.random() < 0.5) puff(_b, srnd(1), 0.5, srnd(1), 0x2a1050, 0x0a0414, 1.4, 1.0, { smoke: true }); });
    if (I.self) { addLoop(0.55, () => streaks(_a.copy(h).negate().clone(), col, 3, 8)); shake(I, 0.2); }
  }
  function singularidad(I, e) {
    const o = muzzle(I, e), { aim, col } = I; umbraCast = T;
    fx.flash(o, 0xe8d8ff, 5, 0.22, { burst: true }); ring(o, aim, 0.3, 3.4, 0.4, col, { chroma: true, th: 0.12 }); implode(o, 0xe8d8ff, col, 12, 3.2, 0.3, 0.7, { shape: SHAPE.soft });
    spray(o, col, 10, 8, 0.6, 0.7, { dir: aim, cone: 0.8, c2: 0x1a0a40 });
    pending.push({ kind: 'singularidad', pid: I.pid, pos: I.eye.clone().addScaledVector(aim, 1.5), t: T, col });
  }
  let umbraCast = -99;
  const wells = new Map(); // id del pozo → { discs, last, born }
  const isUmbraWell = (o, s) => { const p = s.players.find((q) => q.id === o.ow); return !!p && p.char === 'umbra'; };
  function wellStart(e) {
    const at = V(e.p), up = new THREE.Vector3(0, 1, 0), col = 0xb98cff;
    fx.flash(at, 0xffffff, 8, 0.25, { burst: true }); fx.flash(at, col, 12, 0.4);
    ring(at, null, 12, 1.4, 0.55, col, { chroma: true, th: 0.1, op: 0.9 }); ring(at, up, 0.5, 10, 0.5, 0x66ffee, { th: 0.1 });
    implode(at, 0xe8d8ff, col, 14, 8, 0.5, 0.8);
    shell(sphereP, at, null, 7, 1.6, 0.5, col, { c2: 0xe8d8ff, op: 0.9, pow: 1.6, base: 0.06, st: 6, fade: 0.7 });
  }
  function ensureWell(o, s) {
    let w = wells.get(o.id); if (w) return w;
    const pos = V(o.p), disc1 = discP.take(), pull = discP.take(), danger = discP.take(), l1 = discP.take(), l2 = discP.take(), l3 = discP.take();
    const ds = [disc1, pull, danger, l1, l2, l3]; for (const d of ds) { d.held = true; d.visible = true; }
    w = { ds, disc1, pull, danger, l1, l2, l3, pos, last: pos.clone(), born: T, acc: 0, up: new THREE.Vector3(0, 1, 0), life0: o.l || 4 }; wells.set(o.id, w);
    const own = s.players.find((q) => q.id === o.ow); if (own) w.up = upOf(own, renderer.mapId);
    return w;
  }
  function wellFrame(w, o, dt, t) {
    const l = o.l == null ? 1 : o.l, fin = clamp(1 - l / 0.75, 0, 1), age = T - w.born, pos = w.pos.set(o.p[0], o.p[1], o.p[2]); w.last.copy(pos);
    const up = w.up, col = 0xb98cff, k = 1 - fin * 0.62, pop = clamp(age / 0.35, 0, 1);
    // disco de acreción inclinado respecto del piso
    _a.set(1, 0, 0).addScaledVector(up, -up.x).normalize(); if (_a.lengthSq() < 0.5) _a.set(0, 0, 1); _b.copy(up).applyAxisAngle(_a, 0.42); _q.setFromUnitVectors(_c.set(0, 0, 1), _b); w.disc1.quaternion.copy(_q); w.disc1.position.copy(pos);
    w.disc1.scale.setScalar(5.8 * k * eo(pop)); setU(w.disc1, { uC: 0x7a3cff, uC2: 0xffffff, uMode: 1, uK: 5, uO: 0.95 + fin * 0.5, uT: t * (1 + fin * 2.5) });
    // radio de atracción en el suelo (rayitas que caen)
    const gr = pos.clone().addScaledVector(up, -0.85); w.pull.quaternion.setFromUnitVectors(_c.set(0, 0, 1), up); w.pull.position.copy(gr); w.pull.scale.setScalar(16 * eo(pop)); setU(w.pull, { uC: col, uC2: 0x66ffee, uMode: 3, uO: 0.45 * (1 - fin * 0.6), uT: t * (1 + fin * 2) });
    // aviso del estallido: radio 10 con marcas, parpadea más rápido al final
    w.danger.quaternion.copy(w.pull.quaternion); w.danger.position.copy(gr).addScaledVector(up, 0.03); w.danger.scale.setScalar(10); setU(w.danger, { uC: 0xff5a8a, uC2: 0xffffff, uMode: 4, uK: 8 + fin * 40, uO: 0.1 + 0.9 * fin * fin + 0.12 * Math.sin(t * 6), uT: t });
    // lente gravitacional: anillos de Einstein con aberración cromática mirando a la cámara
    const lens = [[w.l1, 0xff5a5a, 2.5], [w.l2, 0x5aff8a, 2.38], [w.l3, 0x5a8aff, 2.26]]; for (const [d, c, r] of lens) { d.position.copy(pos); d.quaternion.copy(cam.quaternion); d.scale.setScalar(r * (1 + Math.sin(t * 5) * 0.04) * k); setU(d, { uC: c, uC2: c, uMode: 6, uK: 0.1, uO: 0.55 + fin * 0.4, uT: t }); }
    // partículas que caen hacia el pozo (disco de materia) y trazos de arrastre a las criaturas
    w.acc += dt * [20, 34, 56][fx.tier == null ? 2 : fx.tier] * (1 + fin * 1.5);
    while (w.acc > 1) { w.acc -= 1; const an = rnd(TAU), R = 9 + rnd(7), tang = _a.set(1, 0, 0).applyAxisAngle(up, an + Math.PI / 2); _b.set(1, 0, 0).applyAxisAngle(up, an).multiplyScalar(R); const sp = 8 + rnd(4); fx.add.spawn(pos.x + _b.x, pos.y + _b.y + srnd(1.5), pos.z + _b.z, -_b.x / R * sp + tang.x * 6, -_b.y / R * sp + tang.y * 6, -_b.z / R * sp + tang.z * 6, C(0xe8d8ff), C(0x7a3cff), 0.6 + rnd(0.6), R / sp * 0.9, 0, -0.4, -0.5, SHAPE.ember, 0, 1); }
    w.tether = (w.tether || 0) - dt; if (w.tether <= 0 && lastState) { w.tether = 0.1; let n = 0; for (const m of lastState.monsters) { _d.set(m.p[0], m.p[1], m.p[2]); const d = _d.distanceTo(pos); if (d < 16 && d > 1 && n < N(4)) { n++; fx.line(_d, _e.copy(pos).lerp(_d, 0.55), col, 0.1, 0.16, { a0: 0.8, a1: 0, c2: 0xffffff }); } } }
  }
  function wellEnd(w) {
    const at = w.last.clone(), up = w.up, col = 0xb98cff;
    fx.flash(at, 0xffffff, 16, 0.3, { burst: true }); fx.flash(at, col, 22, 0.5);
    ring(at, null, 1, 13, 0.6, 0xffffff, { chroma: true, th: 0.1 }); ring(at.clone().addScaledVector(up, -0.8), up, 1, 14, 0.7, col, { th: 0.12 });
    shell(sphereP, at, null, 1, 10, 0.45, col, { c2: 0xffffff, op: 1, pow: 1.4, base: 0.1, st: 4, fade: 1 });
    later(0.08, () => shell(sphereP, at, null, 0.5, 8, 0.4, 0xffffff, { c2: col, op: 0.7, pow: 2.4 }));
    spray(at, 0xe8d8ff, 24, 26, 0.7, 1.1, { c2: 0x3a1a8a, grow: 0.6 }); sparks(at, 0xffffff, 18, 34, 0.7, { c2: col });
    spray(at, 0x2a1050, 10, 8, 1.4, 2.4, { smoke: true, shape: SHAPE.smoke, grow: 1.6, c2: 0x0a0414 });
    fx.shatter(at, 0x6a3ce0, { size: 0.5, n: 6, speed: 14 });
    shake({ self: true }, 0.7);
  }
  function wellsUpdate(dt, state) {
    const t = T;
    if (state) {
      const seen = new Set();
      for (const o of state.objs || []) if (o.t === 'well' && isUmbraWell(o, state)) { seen.add(o.id); const w = ensureWell(o, state); wellFrame(w, o, dt, t); }
      for (const [id, w] of wells) if (!seen.has(id)) { wellEnd(w); for (const d of w.ds) { d.held = false; d.visible = false; } wells.delete(id); }
    }
  }

  /* ───────────────────────── marcadores de blanco ───────────────────────── */
  function markersUpdate(dt, state) {
    if (!state) return;
    const want = []; const cp = cam.position;
    for (const m of state.monsters) if (m.mk && m.hp > 0) want.push(m);
    want.sort((a, b) => (a.p[0] - cp.x) ** 2 + (a.p[1] - cp.y) ** 2 + (a.p[2] - cp.z) ** 2 - ((b.p[0] - cp.x) ** 2 + (b.p[1] - cp.y) ** 2 + (b.p[2] - cp.z) ** 2));
    const cap = [3, 6, 10][fx.tier == null ? 2 : fx.tier], seen = new Set();
    for (const m of want.slice(0, cap)) {
      seen.add(m.id); let mk = markers.get(m.id);
      if (!mk) { const base = makeMarker(); if (!base) continue; mk = { ...base, born: T }; markers.set(m.id, mk); }
      const green = (tint.get(m.id) || 0) > T, color = green ? 0x9dff5a : 0xffe27a, age = T - mk.born, pop = clamp(age / 0.28, 0, 1), s = 1.6 - 0.6 * eo(pop);
      const up = m.u ? _a.set(m.u[0], m.u[1], m.u[2]) : _a.set(0, 1, 0); const pos = _b.set(m.p[0], m.p[1], m.p[2]);
      const R = Math.max(1.4, m.r * 1.55) * s; mk.ring.visible = mk.tri.visible = true; mk.ring.position.copy(pos);
      basis(_c.set(1, 0, 0).cross(up).lengthSq() > 0.01 ? _c.set(1, 0, 0).cross(up).normalize() : _c.set(0, 0, 1), _d.copy(up).cross(_c).normalize(), up, _q); mk.ring.quaternion.copy(_q).multiply(_e2.setFromAxisAngle(Z, T * 1.8)); mk.ring.scale.setScalar(R);
      mk.ring.material.color.set(color); mk.ring.material.opacity = (0.55 + 0.25 * Math.sin(T * 6)) * clamp(pop * 1.5, 0, 1) * INT.value;
      const dist = pos.distanceTo(cp), ts = clamp(dist * 0.03, 0.7, 4.2) * s;
      mk.tri.position.copy(pos).addScaledVector(up, m.r + 1.1 + Math.sin(T * 4 + m.id) * 0.18 + ts * 0.5); mk.tri.scale.setScalar(ts); mk.tri.material.color.set(color); mk.tri.material.opacity = 0.9 * pop;
    }
    for (const [id, mk] of markers) if (!seen.has(id)) { rel(mk); markers.delete(id); }
    if (tint.size > 40) for (const [k, v] of tint) if (v < T) tint.delete(k);
  }
  const Z = new THREE.Vector3(0, 0, 1), _e2 = new THREE.Quaternion();

  /* ───────────────────────── HABILIDADES DE EQUIPO (Q) ───────────────────────── */
  const domes = new Map(), turrets = new Map();
  function ability(e, state) {
    const I = info(e.pid, null, { id: meId }); const pos = I.pos, up = I.up, g = I.ground;
    switch (e.role) {
      case 'vanguardia': { // Cúpula: se levanta una cúpula hexagonal desde el piso
        const col = 0x66ffee;
        fx.flash(pos, 0xffffff, 8, 0.25, { burst: true }); ring(g, up, 0.5, 8, 0.55, col, { chroma: true, th: 0.1 }); ring(g, up, 0.5, 6.5, 0.7, 0xffffff, { th: 0.07, op: 0.8 });
        shell(sphereP, pos, null, 1.2, 6.8, 0.4, col, { c2: 0xffffff, op: 0.9, pow: 1.3, base: 0.12, st: 3, fade: 1 });
        shell(sphereP, pos, null, 3, 6.5, 0.9, col, { c2: 0xffffff, op: 0.35, pow: 3, base: 0.0, st: 14, fade: 0.8, lin: true });
        disc(discT, g.clone().addScaledVector(up, 0.04), up, null, 6.5, 6.5, 1.1, 2, col, 0xffffff, { op: 0.9, fade: 1.5, lin: true });
        sparks(g, col, 14, 14, 0.6, { dir: up, cone: 1.3, c2: 0xffffff }); spray(g, col, 10, 8, 0.7, 0.8, { shape: SHAPE.shard, flat: up, grav: 4, spin: 6, c2: 0xffffff });
        spray(g, 0x6a7a8a, 6, 5, 1.0, 1.6, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.5, c2: 0x1c1c26 });
        break;
      }
      case 'soporte': { // Pulso sanador (ver también 'pulse')
        break;
      }
      case 'ingeniero': { // Torreta: se arma sobre un plano de obra
        const col = 0x66bbff, at = pos.clone().addScaledVector(up, 0.4), gg = g.clone().addScaledVector(up, 0.05);
        disc(discT, gg, up, null, 3.2, 3.2, 1.3, 7, col, 0xffd23f, { op: 0.9, fade: 1.2, kfn: (u) => u * 1.2, lin: true });
        for (let i = 0; i < 4; i++) { _a.set(srnd(1.6), 0, srnd(1.6)); _b.copy(at).addScaledVector(up, 9 + rnd(3)).add(_a); _c.copy(at).add(_a); fx.dart(_b, _c, i % 2 ? 0xffd23f : col, 0.1, 30 + rnd(10), 3, { c2: 0xffffff }); }
        later(0.22, () => { fx.flash(at, 0xffffff, 4, 0.2, { burst: true }); ring(gg, up, 0.3, 4.2, 0.45, col, { chroma: true, th: 0.12 }); sparks(at, 0xffd23f, 12, 12, 0.6, { dir: up, cone: 1.2, c2: col }); spray(at, 0x504860, 5, 4, 1, 1.4, { smoke: true, shape: SHAPE.smoke, grow: 1.4, c2: 0x1a1424 }); });
        shell(sphereP, at.clone().addScaledVector(up, 0.4), null, 0.4, 1.6, 0.45, col, { c2: 0xffd23f, op: 0.6, pow: 1.8, base: 0.1, st: 12 });
        break;
      }
      case 'explorador': break; // lo dibuja 'mark'
      default: break;
    }
  }
  function pulse(e, state) {
    const at = V(e.p), I = info(e.pid, { p: e.p }, { id: meId }), up = I.up, col = 0x7dff9a, g = at.clone().addScaledVector(up, -0.85);
    fx.flash(at, 0xdfffe8, 8, 0.25, { burst: true });
    shell(sphereP, at, null, 1, 12, 0.5, col, { c2: 0xffffff, op: 0.8, pow: 1.5, base: 0.07, fade: 1.1 });
    ring(g, up, 0.5, 12, 0.6, col, { chroma: true, th: 0.1 }); later(0.1, () => ring(g, up, 0.5, 10.5, 0.55, 0xffffff, { th: 0.07, op: 0.8 })); later(0.2, () => ring(g, up, 0.5, 8, 0.5, 0xff66c4, { th: 0.08, op: 0.7 }));
    disc(discT, g.clone().addScaledVector(up, 0.03), up, null, 12, 12, 0.9, 2, col, 0xffffff, { op: 0.6, fade: 1.3, lin: true });
    sparks(at, col, 12, 20, 0.6, { c2: 0xffffff }); spray(g, col, 14, 12, 1.0, 0.8, { shape: SHAPE.star, spin: 3, up: 3, c2: 0xffffff });
    if (state || lastState) for (const q of (state || lastState).players) { if (V(q.pos).distanceTo(at) < 12.5 && q.id !== e.pid) healAlly(q, col); }
  }
  function mark(e, state) {
    const at = V(e.p), I = info(e.pid, { p: e.p }, { id: meId }), up = I.up, col = 0xffe27a, g = at.clone().addScaledVector(up, -0.85);
    fx.flash(at, 0xffffff, 6, 0.2, { burst: true });
    const sweep = disc(discT, g.clone().addScaledVector(up, 0.04), up, null, 32, 32, 0.9, 5, col, 0xffffff, { op: 0.95, fade: 1, lin: true, kfn: (u) => u * 9 });
    ring(g, up, 0.5, 32, 0.6, col, { chroma: true, th: 0.05, op: 0.8 }); later(0.12, () => ring(g, up, 0.5, 22, 0.55, 0xffffff, { th: 0.05, op: 0.6 }));
    spray(at, col, 10, 12, 0.6, 0.7, { c2: 0xffffff, shape: SHAPE.star, spin: 3 });
    const s = state || lastState; if (s) { let n = 0; for (const m of s.monsters) { _d.set(m.p[0], m.p[1], m.p[2]); const d = _d.distanceTo(at); if (d > 32.5 || !m.mk || n >= N(8)) continue; n++; const p = _d.clone(); later(d / 32 * 0.45, () => { ring(p, null, 0.3, clamp(m.r * 2.2, 2, 5), 0.5, col, { th: 0.1 }); fx.flash(p, col, m.r * 2.4, 0.2, { burst: true }); }); } }
    void sweep;
  }

  /* ───────────────────────── despacho de eventos ───────────────────────── */
  const SK = { embestida, onda, paso, rayo: () => {}, propulsor, cohete, deslizamiento, riel: () => {}, salto, rafaga, fase, singularidad };
  function skill(e, me) {
    const I = info(e.pid, e, me);
    if (e.id === 'rayo') { const R = rayoMuzzle(I); void R; }
    const f = SK[e.id]; if (f) f(I, e); else ring(I.ground, I.up, 0.5, 4, 0.4, I.col);
  }
  const rayoMuzzle = (I) => { if (I.self) { fx.flash(cam.localToWorld(_e.set(0.28, -0.22, -1.1)), 0xff66c4, 3, 0.2, { burst: true }); } return null; };

  function onEvent(e, me, state) {
    if (state) lastState = state; if (me) meId = me.id;
    switch (e.t) {
      case 'skill': skill(e, me); return true;
      case 'blink': return true; // el Paso de luz dibuja entrada y salida desde 'skill'
      case 'beam': if (e.c === 'heal') { beamHeal(e, me); return true; } if (e.c === 'rail') { beamRail(e, me, state); return true; } return false;
      case 'shot': { const s = state || lastState; if (s && s.events && s.events.some((x) => x.t === 'skill' && x.id === 'rafaga' && x.pid === e.pid)) { rafagaShot.set(e.pid, e); return true; } return false; }
      case 'boom': { // extras sobre la explosión que dibuja combatfx: esquirlas del cohete de racimo
        if ((e.r || 0) >= 8.5 && T - rocketCast < 6) { rocketCast = -99; clusterBurst(V(e.p), new THREE.Vector3(0, 1, 0), rocketCol); }
        return false;
      }
      case 'pulse': pulse(e, state); return true;
      case 'mark': mark(e, state); return true;
      case 'ability': ability(e, state); return false; // objects.js no hace nada con 'ability'
      case 'well': if (T - umbraCast < 6) { wellStart(e); return true; } return false;
      default: return false;
    }
  }

  /* ───────────────────────── proyectiles de habilidad ───────────────────────── */
  function projectilesUpdate(dt, state) {
    if (!state) return;
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (T - p.t > 0.5) { pending.splice(i, 1); continue; }
      const pr = state.projectiles.find((q) => q.o === 'p' && !tracked.has(q.id) && V(q.p).distanceTo(p.pos) < 9);
      if (pr) {
        pending.splice(i, 1); const tr = { kind: p.kind, pid: p.pid, col: p.col, last: V(pr.p), dir: V(pr.v).normalize(), up: new THREE.Vector3(0, 1, 0), alive: true };
        tracked.set(pr.id, tr);
        if (p.kind === 'cohete') ribbons.start({ c1: 0xfff0a0, c2: 0xff3a10, w: 0.7, life: 0.45, alpha: 0.95, taper: 0.9, gap: 0.3, follow: (out) => { if (!tr.alive) return false; out.copy(tr.last); return true; } });
        else { ribbons.start({ c1: 0xe8d8ff, c2: 0x3a1a8a, w: 0.9, life: 0.5, alpha: 0.95, taper: 0.8, gap: 0.3, follow: (out) => { if (!tr.alive) return false; out.copy(tr.last); return true; } }); const sh = sphereP.take(); sh.held = true; sh.visible = true; setU(sh, { uC: 0xb98cff, uC2: 0xffffff, uPow: 1.5, uBase: 0.2, uO: 0.8, uGl: 0.3, uSt: 0 }); tr.shell = sh; }
      }
    }
    const seen = new Set();
    for (const pr of state.projectiles) {
      const tr = tracked.get(pr.id); if (!tr) continue; seen.add(pr.id); tr.last.set(pr.p[0], pr.p[1], pr.p[2]); tr.dir.set(pr.v[0], pr.v[1], pr.v[2]).normalize();
      if (tr.kind === 'cohete') {
        puff(tr.last, srnd(1) - tr.dir.x * 6, srnd(1) - tr.dir.y * 6, srnd(1) - tr.dir.z * 6, 0xfff4b0, 0xff3a10, 0.9 + rnd(0.4), 0.28, { grow: -0.55, shape: SHAPE.ember });
        puff(_a.copy(tr.last).addScaledVector(tr.dir, -0.8), srnd(0.6), 0.6 + rnd(0.6), srnd(0.6), 0x6a625a, 0x1c1a1a, 1.0, 1.2, { smoke: true });
        if (Math.random() < 0.4) sparks(tr.last, 0xffd23f, 1, 10, 0.35, { dir: _b.copy(tr.dir).negate(), cone: 0.8, c2: 0xff5a1a });
      } else if (tr.kind === 'singularidad') {
        const R = 2.4, an = rnd(TAU); _b.copy(tr.dir).cross(Y).normalize(); if (_b.lengthSq() < 0.1) _b.set(1, 0, 0); _c.copy(_b).cross(tr.dir);
        _d.copy(tr.last).addScaledVector(_b, Math.cos(an) * R).addScaledVector(_c, Math.sin(an) * R); fx.add.spawn(_d.x, _d.y, _d.z, (tr.last.x - _d.x) * 4, (tr.last.y - _d.y) * 4, (tr.last.z - _d.z) * 4, C(0xe8d8ff), C(0x7a3cff), 0.7, 0.3, 0, 0, -0.6, SHAPE.ember, 0, 1);
        if (tr.shell) { tr.shell.position.copy(tr.last); tr.shell.scale.setScalar(1.5 + Math.sin(T * 20) * 0.15); setU(tr.shell, { uT: T }); }
      }
    }
    for (const [id, tr] of tracked) if (!seen.has(id)) {
      tr.alive = false; if (tr.shell) { tr.shell.held = false; tr.shell.visible = false; }
      tracked.delete(id);
    }
  }

  /* ───────────────────────── cuadro ───────────────────────── */
  function teamObjects(dt, state) {
    if (!state) return;
    const seenD = new Set(), seenT = new Set();
    for (const o of state.objs || []) {
      if (o.t === 'dome') {
        seenD.add(o.id); let d = domes.get(o.id);
        if (!d) { const disc1 = discP.take(); disc1.held = true; disc1.visible = true; d = { disc: disc1, pos: V(o.p), r: o.r || 6.5, up: upOf(state.players.find((q) => q.id === o.ow), renderer.mapId) }; domes.set(o.id, d); }
        d.pos.set(o.p[0], o.p[1], o.p[2]); const g = _a.copy(d.pos).addScaledVector(d.up, -0.82); d.disc.position.copy(g); d.disc.quaternion.setFromUnitVectors(_b.set(0, 0, 1), d.up); d.disc.scale.setScalar(d.r);
        const lf = clamp((o.l == null ? 6 : o.l) / 6, 0, 1); setU(d.disc, { uC: 0x66ffee, uC2: 0xffffff, uMode: 2, uO: (0.5 + 0.1 * Math.sin(T * 3)) * (lf < 0.2 ? (Math.sin(T * 30) > 0 ? 1 : 0.3) : 1), uT: T });
      } else if (o.t === 'turret') { seenT.add(o.id); let t = turrets.get(o.id); if (!t) { t = { pos: V(o.p), up: new THREE.Vector3(0, 1, 0) }; turrets.set(o.id, t); } t.pos.set(o.p[0], o.p[1], o.p[2]); }
    }
    for (const [id, d] of domes) if (!seenD.has(id)) { // la cúpula se deshace
      const g = d.pos.clone().addScaledVector(d.up, -0.85); d.disc.held = false; d.disc.visible = false; domes.delete(id);
      ring(g, d.up, 0.5, d.r * 1.15, 0.5, 0x66ffee, { th: 0.08 }); sparks(g, 0x66ffee, 10, 10, 0.7, { dir: d.up, cone: 1.4, c2: 0xffffff }); spray(g, 0x66ffee, 10, 6, 0.9, 0.9, { shape: SHAPE.shard, flat: d.up, grav: 3, spin: 5, c2: 0xffffff });
      shell(sphereP, d.pos, null, d.r, d.r * 1.05, 0.35, 0x66ffee, { c2: 0xffffff, op: 0.5, pow: 2.4, base: 0, st: 12, fade: 1 });
    }
    for (const [id, t] of turrets) if (!seenT.has(id)) { sparks(t.pos, 0x66bbff, 8, 10, 0.6, { c2: 0xffd23f }); spray(t.pos, 0x504860, 4, 3, 1.2, 1.4, { smoke: true, shape: SHAPE.smoke, grow: 1.4, c2: 0x1a1424 }); fx.flash(t.pos, 0x66bbff, 2.4, 0.2, { burst: true }); turrets.delete(id); }
  }
  function trackPlayers(dt, state) {
    if (!state) return; lastState = state;
    for (const p of state.players) {
      let k = known.get(p.id); const pos = V(p.pos);
      if (!k) { k = { pos: pos.clone(), vel: new THREE.Vector3(), speed: 0, upV: upOf(p, renderer.mapId), h: V(p.h), right: new THREE.Vector3(), pitch: p.pitch, char: p.char }; known.set(p.id, k); }
      if (dt > 0) { k.vel.copy(pos).sub(k.pos).multiplyScalar(1 / dt); k.speed = k.vel.length(); }
      k.pos.copy(pos); k.upV.copy(upOf(p, renderer.mapId)); k.h.set(p.h[0], p.h[1], p.h[2]); k.right.crossVectors(k.h, k.upV).normalize(); k.pitch = p.pitch; k.char = p.char;
    }
    for (const id of [...known.keys()]) if (!state.players.some((q) => q.id === id)) known.delete(id);
  }
  function update(dt, state) {
    dt = Math.min(dt, 0.1); T += dt;
    for (let i = delays.length - 1; i >= 0; i--) { delays[i].t -= dt; if (delays[i].t <= 0) { const f = delays.splice(i, 1)[0].fn; f(); } }
    if (state) lastState = state;
    for (let i = loops.length - 1; i >= 0; i--) { const l = loops[i]; l.t += dt; const u = Math.min(1, l.t / l.dur); const r = l.fn(dt, u, l.t); if (r === false || l.t >= l.dur) { loops.splice(i, 1); } }
    projectilesUpdate(dt, state); wellsUpdate(dt, state); markersUpdate(dt, state); teamObjects(dt, state);
    ribbons.update(dt);
    trackPlayers(dt, state); // al final: durante los eventos del cuadro `known` conserva la posición ANTERIOR (origen del Paso de luz, de la Fase…)
  }
  function clear() {
    loops.length = delays.length = pending.length = 0; tracked.clear(); ribbons.clear();
    for (const p of [sphereP, capP, auraP, ghostP, discT, discP, beamP]) for (const m of p.items) { m.visible = false; m.held = false; }
    for (const [, mk] of markers) rel(mk); markers.clear(); wells.clear(); domes.clear(); turrets.clear(); rafagaShot.clear();
  }
  function dispose() {
    clear(); scene.remove(root);
    for (const p of [sphereP, capP, auraP, ghostP, discT, discP, beamP]) for (const m of p.items) m.material.dispose();
    for (const mk of [...markerFree]) { mk.ring.material.dispose(); mk.tri.material.dispose(); }
    for (const d of disposables) d.dispose();
  }
  function stats() {
    let vis = 0; root.traverse((o) => { if (o.isMesh && o.visible) vis++; });
    return { meshesVisibles: vis, cintas: ribbons.items.filter((r) => r.on).length, loops: loops.length, particulas: (fx.add.live || 0) + (fx.smoke.live || 0), marcadores: markers.size };
  }
  return { onEvent, update, clear, dispose, stats, ribbons };
}
