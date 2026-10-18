// Efectos de las HABILIDADES y los ESTADOS de los 5 Huéspedes (axioma, vesper, micelio, umbra, seraf) + su melee (hostfx-melee.js).
// Contrato de eventos y campos: docs/HUESPEDES.md → {t:'skill',pid,k,id,p} · {t:'melee',pid,kind,p,d,hit} · {t:'ultend',pid,id} · snapshot.players[].bf (máscara de estados) y .sy (simbionte).
// Todo sale de POOLS FIJOS (nada se crea por evento ni por cuadro): mallas aditivas con shader propio (cáscara fresnel, discos de suelo, muro vivo, alas,
// viñeta de pantalla), una InstancedMesh de espinas/pétalos (1 draw call) y las partículas / chispas / cintas de `renderer.fx` (Effects).
// Regla de legibilidad: lo grande es BORDE (fresnel, líneas, viñeta); el centro de la pantalla y las criaturas nunca se tapan con relleno.
// API:
//   const hfx = createHostFx(renderer);           (render.js lo crea y lo guarda en renderer.hostfx)
//   hfx.onEvent(e, me, state) → true si el evento quedó resuelto acá (render.js omite el dibujo viejo)
//   hfx.update(dt, state, me)  → UNA vez por cuadro, después de handleEvents
//   hfx.setSound(sound) · hfx.clear() · hfx.dispose() · hfx.stats() · hfx.melee (viewmodel melee) · hfx.meleeKey(down|up) (predicción local, tecla V)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHARACTERS, HOST_IDS } from '../sim/data.js';
import { SHAPE, GAM, INT } from './effects.js';
import { createHostMelee } from './hostfx-melee.js';

const TAU = Math.PI * 2, Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const rnd = (a = 1) => Math.random() * a, srnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const eo = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
const orientCone = (q, dir) => q.setFromUnitVectors(Y, dir); // el eje +Y de la geometría de casquete apunta a `dir`
const colCache = new Map();
const C = (hex) => { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; };
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
const orient = (q, fwd, up) => q.setFromRotationMatrix(_m.makeBasis(new THREE.Vector3().crossVectors(up, fwd).normalize(), up, fwd)); // +Z = frente, +Y = arriba
const basisQ = (x, y, z, q) => q.setFromRotationMatrix(_m.makeBasis(x, y, z));
// OJO: en el snapshot la clave `up` aparece dos veces (vector y mejoras de arma) y gana la última; si no es un vector de 3 números se usa un respaldo
const upOf = (p, mapId) => { const a = p && p.up; if (Array.isArray(a) && a.length === 3 && typeof a[0] === 'number') return new THREE.Vector3(a[0], a[1], a[2]); if (mapId === 'm2' && p && p.pos) return new THREE.Vector3(-p.pos[0], -p.pos[1], -p.pos[2]).normalize(); return new THREE.Vector3(0, 1, 0); };

/** Paleta por Huésped: color canon (CHARACTERS[*].color) + acento + oscuro. */
export const HOST_PAL = {
  axioma: { c: 0x3aa8ff, a: 0xffa24a, d: 0x0a1830 }, vesper: { c: 0xb04bff, a: 0xff3a8a, d: 0x1a0830 }, micelio: { c: 0x7be03a, a: 0xe8ff6a, d: 0x10260a },
  umbra: { c: 0xb98cff, a: 0x5cf0ff, d: 0x0a0414 }, seraf: { c: 0xffd45a, a: 0xff6ec4, d: 0x2a0a18 },
};
HOST_PAL.colmena = { c: 0xf02848, a: 0xffb83a, d: 0x1a0308 };   // Colmena: jalea roja y miel
HOST_PAL.danzante = { c: 0xff3fa0, a: 0x2fe6d0, d: 0x2a0a3a };   // Danzante: fucsia de carnaval, turquesa y ciruela
const palOf = (char) => HOST_PAL[char] || { c: CHARACTERS[char] ? CHARACTERS[char].color : 0x66ffee, a: 0xffffff, d: 0x10101c };
export const BF = { CAPARAZON: 1, CAMUFLAJE: 2, SOBRECARGA: 4, FRENESI: 8, FLORACION: 16, METAMORFOSIS: 32, DESFASE: 64, PLANEO: 128, BARRERA: 256 };

/* ───────────────────────── shaders ───────────────────────── */
const HEX = `float hexd(vec2 p){ p = abs(p); return max(dot(p, vec2(0.8660254, 0.5)), p.y); }
float hexLines(vec2 q){ vec2 s = vec2(1.0, 1.7320508); vec2 h = s * 0.5; vec2 a = mod(q, s) - h; vec2 b = mod(q - h, s) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b; return smoothstep(0.38, 0.49, hexd(g)); }`;
const SHELL_VS = `uniform float uGl; uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vO;
void main(){ vec3 p = position; vO = position;
  if (uGl > 0.0) { float sl = floor(p.y * 9.0 + uT * 14.0); float h = fract(sin(sl * 91.3 + floor(uT * 9.0) * 7.1) * 437.5); p.x += (h - 0.5) * uGl * step(0.66, h) * 0.9; }
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const SHELL_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uT; uniform float uPow; uniform float uBase; uniform float uSt; uniform float uHex; uniform float uGam; uniform float uInt; varying vec3 vN; varying vec3 vV; varying vec3 vO; ${HEX}
void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
  float st = uSt > 0.0 ? 0.55 + 0.45 * sin(vO.y * uSt - uT * 7.0) : 1.0;
  float hx = 0.0; if (uHex > 0.0) { vec3 d = normalize(vO); hx = hexLines(vec2(atan(d.x, d.z) * 1.9, d.y * 3.0) * uHex) * (0.35 + 0.65 * (0.5 + 0.5 * sin(d.y * 5.0 - uT * 3.0))); }
  vec3 c = mix(uC, uC2, clamp(f + hx * 0.6, 0.0, 1.0));
  gl_FragColor = vec4(pow(c, vec3(uGam)), (f + uBase + hx * 0.55 * (0.4 + f)) * uO * uInt * st); }`;
const DISC_VS = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uT; uniform float uMode; uniform float uK; uniform float uGam; uniform float uInt; varying vec2 vP; ${HEX}
void main(){
  float r = length(vP); if (r > 1.0) discard; float ang = atan(vP.x, vP.y); float a = 0.0; vec3 c = uC;
  if (uMode < 0.5) { a = smoothstep(1.0 - uK * 1.6, 1.0 - uK * 0.45, r) * (1.0 - smoothstep(1.0 - uK * 0.45, 1.0, r)); }                       // 0 anillo fino
  else if (uMode < 1.5) { vec2 q = vP * 6.0; float line = hexLines(q); float wave = 0.5 + 0.5 * sin(r * 8.0 - uT * 3.2); float rim = smoothstep(0.9, 0.985, r); // 1 piso hexagonal
    a = (0.05 + 0.5 * line * (0.3 + 0.7 * wave) + 0.7 * rim) * (1.0 - 0.35 * r); c = mix(uC, uC2, rim); }
  else if (uMode < 2.5) { float rr = clamp((r - 0.2) / 0.8, 0.0, 1.0); float hole = smoothstep(0.17, 0.27, r);                                  // 2 acreción
    float arms = pow(0.5 + 0.5 * sin((ang + (1.0 - rr) * uK) * 3.0 - uT * 2.6), 1.5); float dop = 0.55 + 0.45 * sin(ang + 1.0);
    a = hole * (pow(1.0 - rr, 1.6) * (0.45 + 1.0 * arms) * dop + 0.05 * (1.0 - rr)) * smoothstep(1.0, 0.8, r); c = mix(uC, uC2, pow(1.0 - rr, 2.2)); }
  else if (uMode < 3.5) { float s1 = 0.5 + 0.5 * sin(ang * 3.0 + r * 9.0 - uT * 1.6); float s2 = 0.5 + 0.5 * sin(ang * 5.0 - r * 13.0 + uT * 1.1);   // 3 esporas (remolino suave)
    a = (0.08 + 0.2 * s1 * s2) * smoothstep(1.0, 0.5, r) + smoothstep(0.92, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r)) * 0.4; c = mix(uC, uC2, s2); }
  else if (uMode < 4.5) { float pet = pow(abs(cos(ang * 4.0 + uT * 0.4)), 3.0); float er = 0.38 + 0.58 * pet;                                    // 4 floración (pétalos)
    float shape = smoothstep(er, er - 0.06, r); float line = smoothstep(0.035, 0.0, abs(r - er)); float core = smoothstep(0.22, 0.0, r);
    a = shape * 0.13 + line * 0.75 + core * 0.45 + smoothstep(0.93, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r)) * 0.25; c = mix(uC, uC2, pet); }
  else if (uMode < 5.5) { float rim = smoothstep(0.9, 0.93, r) * (1.0 - smoothstep(0.97, 1.0, r)); float tk = step(0.5, fract(ang * 12.0 / 6.2832)) * step(0.8, r) * step(r, 0.9); // 5 reloj
    float hand = smoothstep(0.03, 0.0, abs(mod(ang - uK + 3.1416, 6.2832) - 3.1416)) * step(r, 0.88) * step(0.1, r);
    a = rim + tk * 0.7 + hand * 0.9 + 0.06 * smoothstep(0.0, 1.0, r); c = mix(uC, uC2, hand + tk); }
  else if (uMode < 6.5) { float arcs = smoothstep(0.78, 0.8, r) * (1.0 - smoothstep(0.86, 0.88, r)) * step(0.0, sin(ang * 4.0 + uT * 1.5)); // 6 retícula de marca
    float inner = smoothstep(0.016, 0.0, abs(r - 0.58)) * 0.6; float tri = step(0.9, r) * step(abs(sin(ang * 2.0)), 0.16) * 0.9; a = arcs + inner + tri; c = mix(uC, uC2, tri + inner); }
  else { float v = pow(abs(sin(ang * 7.0 + sin(r * 9.0 - uT * 4.0) * 1.3)), 14.0);                                                           // 7 venas que viajan hacia afuera
    a = v * smoothstep(0.0, 0.2, r) * (1.0 - smoothstep(uK - 0.12, uK, r)) * 0.9 + smoothstep(0.03, 0.0, abs(r - uK)) * 0.9; c = mix(uC, uC2, v); }
  gl_FragColor = vec4(pow(c, vec3(uGam)), clamp(a, 0.0, 1.0) * uO * uInt); }`;
const WALL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WALL_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uT; uniform float uG; uniform float uGam; uniform float uInt; varying vec2 vUv;
void main(){ float cols = 22.0; float id = floor(vUv.x * cols); float hh = 0.62 + 0.38 * fract(sin(id * 12.9898) * 43758.5); float top = uG * hh;
  if (vUv.y > top) discard; float cx = abs(fract(vUv.x * cols) - 0.5); float t = vUv.y / max(top, 0.001); float halfw = 0.5 * (1.0 - pow(t, 1.3)) + 0.03;
  float body = smoothstep(halfw, halfw - 0.06, cx); if (body < 0.01) discard;
  float vein = pow(0.5 + 0.5 * sin(vUv.y * 26.0 - uT * 4.5 + id * 1.7), 6.0); float edge = smoothstep(halfw - 0.14, halfw, cx);
  float a = (0.2 + 0.4 * vein + 0.5 * edge + 0.35 * (1.0 - t) * (1.0 - t)) * body; vec3 c = mix(uC, uC2, clamp(vein + edge * 0.6, 0.0, 1.0));
  gl_FragColor = vec4(pow(c, vec3(uGam)), clamp(a, 0.0, 1.0) * uO * uInt); }`;
const WING_VS = `uniform float uFlap; varying float vS; varying float vF; attribute float aS; attribute float aF;
void main(){ vS = aS; vF = aF; vec3 p = position; float ang = uFlap * aS * aS; float c = cos(ang), s = sin(ang); p = vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const WING_FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uO; uniform float uGam; uniform float uInt; varying float vS; varying float vF;
void main(){ float fr = fract(vF * 4.0); float bone = smoothstep(0.07, 0.0, min(fr, 1.0 - fr)); float edge = smoothstep(0.86, 1.0, vS); float web = 0.5 + 0.5 * sin(vS * 30.0 - vF * 9.0);
  float a = (0.3 + 0.14 * web + 0.9 * bone * (1.0 - vS * 0.4) + 0.7 * edge) * (1.0 - smoothstep(0.96, 1.0, vS) * 0.3); vec3 c = mix(uC, uC2, clamp(bone + edge, 0.0, 1.0));
  gl_FragColor = vec4(pow(c, vec3(uGam)), clamp(a, 0.0, 1.0) * uO * uInt); }`;
const VIG_VS = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const VIG_FS = `uniform float uW[8]; uniform float uT; uniform float uAsp; uniform float uGam; uniform float uInt; varying vec2 vP; ${HEX}
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 q = vec2(vP.x * uAsp, vP.y); float rr = length(vP * vec2(0.82, 1.0)); float edge = smoothstep(0.5, 1.3, rr); float ang = atan(q.y, q.x); vec3 acc = vec3(0.0);
  if (uW[1] > 0.01) { float hx = hexLines(q * 4.5); acc += uW[1] * vec3(0.3, 0.65, 1.0) * (hx * 0.9 + 0.25) * edge * edge * (0.7 + 0.3 * sin(rr * 5.0 - uT * 2.0)); }
  if (uW[2] > 0.01) { float wv = pow(0.5 + 0.5 * sin(vP.y * 38.0 + sin(vP.x * 7.0 + uT) * 3.0 - uT * 3.0), 6.0); acc += uW[2] * (vec3(0.6, 0.35, 1.0) * wv * 0.8 + vec3(0.2, 0.9, 1.0) * 0.25) * edge * edge; }
  if (uW[3] > 0.01) { float fl = 0.5 + 0.5 * sin(ang * 9.0 + uT * 12.0) * sin(ang * 5.0 - uT * 7.0); acc += uW[3] * vec3(1.0, 0.45, 0.12) * (edge * edge * (0.35 + 0.65 * fl)); }
  if (uW[4] > 0.01) { float sc = pow(max(0.0, sin((vP.x * uAsp + vP.y * 0.55) * 9.0)), 30.0) * smoothstep(0.35, 1.0, abs(vP.x)); acc += uW[4] * (vec3(1.0, 0.12, 0.3) * sc * 0.9 + vec3(0.9, 0.05, 0.25) * edge * edge * edge * 0.5); }
  if (uW[5] > 0.01) { vec2 g = q * 7.0 + vec2(0.0, -uT * 0.6); vec2 id = floor(g); vec2 f = fract(g) - 0.5; float on = step(0.62, h21(id)); float d = length(f - (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.5); acc += uW[5] * vec3(0.6, 1.0, 0.3) * (smoothstep(0.17, 0.0, d) * on * 0.9 + 0.18 * edge * edge); }
  if (uW[6] > 0.01) { float vn = pow(abs(sin(atan(abs(vP.y) + 0.2, abs(vP.x) + 0.1) * 7.0)), 14.0); acc += uW[6] * vec3(1.0, 0.78, 0.3) * (vn * 0.7 + 0.4 * edge * edge) * edge; }
  if (uW[7] > 0.01) { float r2 = length(vP); acc += uW[7] * (vec3(0.2, 0.95, 1.0) * smoothstep(0.03, 0.0, abs(r2 - 0.95 + 0.02 * sin(uT * 3.0))) + vec3(0.8, 0.2, 1.0) * smoothstep(0.03, 0.0, abs(r2 - 1.03)) + vec3(0.45, 0.2, 0.9) * edge * edge * 0.45); }
  gl_FragColor = vec4(pow(acc, vec3(uGam)) * uInt, 1.0); }`;

/** Geometría del ala membranosa: hombro en el origen, 4 dedos, membrana con borde festoneado. x afuera, y arriba, z atrás. */
function wingGeometry() {
  const S = 9, F = 17, tips = [[2.3, 1.7, -0.5], [2.9, 0.8, -0.9], [2.6, -0.2, -1.1], [1.9, -1.0, -1.0], [0.7, -1.1, -0.6]], pos = [], aS = [], aF = [], idx = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < F; j++) {
    const s = i / (S - 1), f = j / (F - 1), seg = Math.min(3, Math.floor(f * 4)), fr = f * 4 - seg, t0 = tips[seg], t1 = tips[seg + 1];
    const tx = t0[0] + (t1[0] - t0[0]) * fr, ty = t0[1] + (t1[1] - t0[1]) * fr, tz = t0[2] + (t1[2] - t0[2]) * fr, sc = 1 - 0.16 * Math.sin(Math.PI * fr) * s;
    pos.push(tx * s * sc, ty * s * sc, tz * s * sc); aS.push(s); aF.push(f);
  }
  for (let i = 0; i < S - 1; i++) for (let j = 0; j < F - 1; j++) { const a = i * F + j; idx.push(a, a + 1, a + F, a + 1, a + F + 1, a + F); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setAttribute('aF', new THREE.Float32BufferAttribute(aF, 1)); g.setIndex(idx); return g;
}

/* ───────────────────────── fábrica ───────────────────────── */
export function createHostFx(renderer, opts = {}) {
  const fx = renderer.fx, scene = renderer.scene, cam = renderer.camera;
  const root = new THREE.Group(); root.name = 'hostfx'; scene.add(root);
  const Q = () => [0.5, 0.8, 1][fx.tier == null ? 2 : fx.tier];
  const N = (n) => Math.max(1, Math.round(n * Q()));
  const hi = () => (fx.tier == null ? 2 : fx.tier) >= 1;
  const reduced = () => !!(fx.combat && fx.combat.reduced);
  const spray = (p, c, n, sp, life, size, o = {}) => fx.spray(p, c, N(n), sp, life, size, { raw: true, ...o });
  const sparks = (p, c, n, sp, life, o) => fx.sparks(p, c, N(n), sp, life, o);
  const disposables = [], loops = [], delays = [], known = new Map(), states = new Map();
  let T = 0, lastState = null, meId = 0, sound = null;
  const addLoop = (dur, fn) => loops.push({ t: 0, dur, fn });
  const later = (s, fn) => delays.push({ t: s, fn });
  const mkPool = (n, make) => { const items = []; for (let i = 0; i < n; i++) { const it = make(); it.held = false; items.push(it); } let i = 0; return { items, take() { for (let k = 0; k < items.length; k++) { const it = items[i]; i = (i + 1) % items.length; if (!it.held) return it; } const it = items[i]; i = (i + 1) % items.length; return it; } }; };
  const setU = (m, o) => { const u = m.material.uniforms; for (const k in o) { if (k === 'uC' || k === 'uC2') u[k].value.set(o[k]); else u[k].value = o[k]; } };

  /* ── geometrías y pools ── */
  const gSphere = new THREE.SphereGeometry(1, 24, 16), gAura = new THREE.CapsuleGeometry(0.62, 1.1, 6, 14).translate(0, 0.9, 0), gDisc = new THREE.CircleGeometry(1, 64), gPlane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), gWing = wingGeometry();
  const gGhost = (() => { // silueta humana (pies en y=0), +Z = frente
    const part = (g, x, y, z, rx = 0) => { g.rotateX(rx); g.translate(x, y, z); return g; };
    return mergeGeometries([part(new THREE.CapsuleGeometry(0.3, 0.55, 3, 10), 0, 1.22, 0), part(new THREE.SphereGeometry(0.19, 12, 9), 0, 1.74, 0.02), part(new THREE.CapsuleGeometry(0.13, 0.55, 3, 8), -0.16, 0.42, 0), part(new THREE.CapsuleGeometry(0.13, 0.55, 3, 8), 0.16, 0.42, 0),
      part(new THREE.CapsuleGeometry(0.09, 0.5, 3, 8), -0.36, 1.3, 0.28, Math.PI / 2.2), part(new THREE.CapsuleGeometry(0.09, 0.5, 3, 8), 0.34, 1.34, 0.32, Math.PI / 2.4)]);
  })();
  const gCoreSphere = new THREE.SphereGeometry(1, 20, 14), gCap = new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 3);
  disposables.push({ dispose() { [gSphere, gAura, gDisc, gPlane, gWing, gGhost, gCoreSphere, gCap].forEach((g) => g.dispose()); } });
  const shellMat = () => new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uT: { value: 0 }, uPow: { value: 2.2 }, uBase: { value: 0.05 }, uGl: { value: 0 }, uSt: { value: 0 }, uHex: { value: 0 }, uGam: GAM, uInt: INT }, vertexShader: SHELL_VS, fragmentShader: SHELL_FS });
  const mkShell = (geo, order = 3) => () => { const m = new THREE.Mesh(geo, shellMat()); m.visible = false; m.renderOrder = order; m.frustumCulled = false; root.add(m); return m; };
  const capP = mkPool(2, mkShell(gCap)), sphereP = mkPool(6, mkShell(gSphere)), auraP = mkPool(3, mkShell(gAura)), ghostP = mkPool(6, mkShell(gGhost));
  const mkDisc = () => { const m = new THREE.Mesh(gDisc, new THREE.ShaderMaterial({ ...ADD, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uT: { value: 0 }, uMode: { value: 0 }, uK: { value: 0.1 }, uGam: GAM, uInt: INT }, vertexShader: DISC_VS, fragmentShader: DISC_FS })); m.visible = false; m.renderOrder = 2; m.frustumCulled = false; root.add(m); return m; };
  const discP = mkPool(12, mkDisc), markP = mkPool(4, () => { const m = mkDisc(); m.material.depthTest = false; m.renderOrder = 8; return m; }); // las marcas se ven a través de la criatura (visión del cazador)
  const mkWall = () => { const m = new THREE.Mesh(gPlane, new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uT: { value: 0 }, uG: { value: 0 }, uGam: GAM, uInt: INT }, vertexShader: WALL_VS, fragmentShader: WALL_FS })); m.visible = false; m.renderOrder = 3; m.frustumCulled = false; root.add(m); return m; };
  const wallP = mkPool(3, mkWall);
  const mkWing = () => { const m = new THREE.Mesh(gWing, new THREE.ShaderMaterial({ ...ADD, uniforms: { uC: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uO: { value: 1 }, uFlap: { value: 0 }, uGam: GAM, uInt: INT }, vertexShader: WING_VS, fragmentShader: WING_FS })); m.visible = false; m.renderOrder = 3; m.frustumCulled = false; root.add(m); return m; };
  const wingP = mkPool(8, mkWing);
  const coreP = mkPool(2, () => { const m = new THREE.Mesh(gCoreSphere, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.95, depthWrite: false })); m.visible = false; m.renderOrder = 2; m.frustumCulled = false; root.add(m); return m; });
  // viñeta de pantalla (1 draw call, sólo bordes): pesos por modo 1..7
  const vigMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide, uniforms: { uW: { value: new Float32Array(8) }, uT: { value: 0 }, uAsp: { value: 1.6 }, uGam: GAM, uInt: INT }, vertexShader: VIG_VS, fragmentShader: VIG_FS });
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vigMat); vig.frustumCulled = false; vig.renderOrder = 40; vig.visible = false; root.add(vig); disposables.push({ dispose() { vig.geometry.dispose(); vigMat.dispose(); } });
  const vigW = new Float32Array(8), vigKick = new Float32Array(8), vigWant = new Float32Array(8);
  const kickVig = (mode, k) => { vigKick[mode] = Math.max(vigKick[mode], reduced() ? k * 0.5 : k); };
  // espinas / pétalos: UNA InstancedMesh (1 draw call), 48 instancias
  const NT = 48, thGeo = new THREE.ConeGeometry(0.16, 1, 5).translate(0, 0.5, 0), thMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x3a4a66, transparent: true, opacity: 0.97 });
  const thorns = new THREE.InstancedMesh(thGeo, thMat, NT); thorns.instanceMatrix.setUsage(THREE.DynamicDrawUsage); thorns.frustumCulled = false; thorns.visible = false; thorns.renderOrder = 2; root.add(thorns);
  for (let i = 0; i < NT; i++) thorns.setColorAt(i, C(0xffffff)); thorns.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const th = []; for (let i = 0; i < NT; i++) th.push({ on: false, p: new THREE.Vector3(), q: new THREE.Quaternion(), vel: new THREE.Vector3(), fly: false, fade: 0.3, len: 1, w: 1, age: 0, life: 1, grow: 0.18, sway: 0, held: false });
  let thRR = 0; disposables.push({ dispose() { thGeo.dispose(); thMat.dispose(); thorns.dispose(); } });
  const thorn = (pos, dir, len, w, color, life, o = {}) => {
    let t = th.find((x) => !x.on); if (!t) { t = th[thRR]; thRR = (thRR + 1) % NT; }
    t.on = true; t.p.copy(pos); t.q.setFromUnitVectors(Y, _e.copy(dir).normalize()); t.len = len; t.w = w; t.age = 0; t.life = life; t.grow = o.grow || 0.18; t.sway = o.sway || 0; t.held = !!o.held; t.color = color; t.fly = !!o.vel; t.fade = o.fade || 0.3; if (o.vel) t.vel.copy(o.vel);
    thorns.setColorAt(th.indexOf(t), C(color)); thorns.instanceColor.needsUpdate = true; thorns.visible = true; return t;
  };
  const thornsUpdate = (dt) => {
    let any = false;
    for (let i = 0; i < NT; i++) {
      const t = th[i];
      if (!t.on) { _m.makeScale(0, 0, 0); thorns.setMatrixAt(i, _m); continue; }
      t.age += dt; if (t.fly) t.p.addScaledVector(t.vel, dt); if (!t.held && t.age >= t.life) { t.on = false; _m.makeScale(0, 0, 0); thorns.setMatrixAt(i, _m); continue; } any = true;
      const gu = clamp(t.age / t.grow, 0, 1), sk = t.held ? 1 : clamp((t.life - t.age) / t.fade, 0, 1), s = eo(gu) * sk;
      _q.copy(t.q); if (t.sway) { _s.set(Math.sin(T * 2 + i) * t.sway, 0, Math.cos(T * 1.7 + i * 2) * t.sway); _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(_s.x, 0, _s.z))); }
      _m.compose(t.p, _q, _s.set(t.w * s, t.len * s, t.w * s)); thorns.setMatrixAt(i, _m);
    }
    thorns.instanceMatrix.needsUpdate = true; thorns.visible = any;
  };

  /* ── utilidades de animación ── */
  function shell(pool, pos, quat, r0, r1, dur, color, o = {}) {
    const m = pool.take(); m.visible = true; m.position.copy(pos); if (quat) m.quaternion.copy(quat); else m.quaternion.identity();
    setU(m, { uC: color, uC2: o.c2 == null ? color : o.c2, uO: 0, uPow: o.pow == null ? 2.2 : o.pow, uBase: o.base == null ? 0.05 : o.base, uGl: o.gl || 0, uSt: o.st || 0, uHex: o.hex || 0, uT: 0 });
    const op = o.op == null ? 0.7 : o.op, fade = o.fade == null ? 1.2 : o.fade, sy = o.sy == null ? 1 : o.sy;
    addLoop(dur, (dt, u, t) => { const r = r0 + (r1 - r0) * (o.lin ? u : eo(u)); m.scale.set(o.sx == null ? r : r * o.sx, r * sy, o.sx == null ? r : r * o.sx); if (o.follow && o.follow(_e)) m.position.copy(_e); setU(m, { uO: op * Math.pow(1 - u, fade) * (u < 0.08 ? u / 0.08 : 1), uT: t }); if (u >= 1) m.visible = false; });
    return m;
  }
  /** Disco plano: `up` = normal (suelo) o null (mira a la cámara). */
  function disc(pool, pos, up, r0, r1, dur, mode, color, color2, o = {}) {
    const m = pool.take(); m.visible = true; m.position.copy(pos);
    if (up) { const hh = o.h || (Math.abs(up.y) < 0.9 ? _a.set(0, 1, 0).cross(up).normalize() : _a.set(1, 0, 0)); basisQ(_b.copy(hh).cross(up).normalize(), _c.copy(hh), _d.copy(up), m.quaternion); }
    setU(m, { uC: color, uC2: color2 == null ? color : color2, uMode: mode, uK: o.k == null ? 0.1 : o.k, uO: 0, uT: 0 });
    const op = o.op == null ? 0.85 : o.op, fade = o.fade == null ? 1 : o.fade;
    addLoop(dur, (dt, u, t) => { const r = r0 + (r1 - r0) * (o.lin ? u : eo(u)); m.scale.setScalar(r); if (!up) m.quaternion.copy(cam.quaternion); if (o.spin) m.rotateZ(o.spin * dt); if (o.follow && o.follow(_e)) m.position.copy(_e);
      setU(m, { uT: t, uO: op * Math.pow(1 - u, fade) * (u < 0.07 ? u / 0.07 : 1), uK: o.kfn ? o.kfn(u, t) : (o.k == null ? 0.1 : o.k) }); if (u >= 1) m.visible = false; });
    return m;
  }
  const ring = (pos, up, r0, r1, dur, color, o = {}) => disc(discP, pos, up, r0, r1, dur, 0, color, color, { op: 0.9, k: o.th || 0.1, ...o });
  /** Estela: segmentos cortos tras la posición de un jugador (strips compartidas). */
  function trail(pid, dur, c1, c2, w, lift = 0, life = 0.32) {
    let last = null; addLoop(dur, () => { const k = known.get(pid); if (!k) return false; _a.copy(k.pos).addScaledVector(k.upV, lift); if (last && last.distanceToSquared(_a) > 0.04) fx.line(last, _a, c1, w, life, { a0: 0.9, a1: 0, shrink: 0.7, c2 }); (last || (last = new THREE.Vector3())).copy(_a); });
  }
  /** Imagen residual: silueta del jugador que se apaga. */
  function afterimage(pos, h, up, color, c2, delay, op, life, o = {}) {
    const p = pos.clone().addScaledVector(up, -0.86), hh = h.clone(), uu = up.clone();
    later(delay, () => { const q = orient(new THREE.Quaternion(), hh, uu); const m = shell(ghostP, p, q, 1, o.r1 || 1.04, life, color, { c2, op, pow: 1.3, base: 0.1, gl: o.gl == null ? 0.35 : o.gl, fade: 1.4, sx: o.sx }); void m; });
  }
  /** Columna de luz vertical. */
  const column = (base, up, h, color, life = 0.4, w = 0.9) => fx.line(base, _a.copy(base).addScaledVector(up, h), color, w, life, { a0: 0.7, a1: 0, shrink: 0.7 });
  const bolt = (a, b, color, w = 0.12, life = 0.1, jit = 0.5, segs = 4) => { _c.copy(a); for (let i = 1; i <= segs; i++) { _d.copy(a).lerp(b, i / segs); if (i < segs) _d.add(_e.set(srnd(jit), srnd(jit), srnd(jit))); fx.line(_c, _d, color, w, life, { a0: 1, a1: 0.6, shrink: 0.5 }); _c.copy(_d); } };

  /* ── datos de jugadores ── */
  function info(pid, e, me) {
    const pl = lastState ? lastState.players.find((q) => q.id === pid) : null, k = known.get(pid), src = pl || k;
    const up = pl ? upOf(pl, renderer.mapId) : (k ? k.upV.clone() : new THREE.Vector3(0, 1, 0)), h = src ? (pl ? V(pl.h) : k.h.clone()) : new THREE.Vector3(0, 0, -1), pitch = pl ? pl.pitch : (k ? k.pitch : 0);
    const pos = e && e.p ? V(e.p) : (pl ? V(pl.pos) : (k ? k.pos.clone() : new THREE.Vector3()));
    const aim = h.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize(), right = new THREE.Vector3().crossVectors(h, up).normalize();
    const char = pl ? pl.char : (k ? k.char : null), pal = palOf(char), self = (!!me && pid === me.id || pid === meId) && !renderer.third;
    return { pid, pos, prev: k ? k.pos.clone() : pos.clone(), up, h, aim, right, pitch, char, col: pal.c, acc: pal.a, dark: pal.d, self, eye: pos.clone().addScaledVector(up, 0.6), ground: pos.clone().addScaledVector(up, -0.85), speed: k ? k.speed : 0 };
  }
  const shake = (I, k) => { if (I.self && fx.combat) fx.combat.addShake(k); };
  const streaks = (dir, color, n, len = 7) => { for (let i = 0; i < n; i++) { _a.copy(cam.position); _b.set(0, 0, -1).applyQuaternion(cam.quaternion); _c.set(1, 0, 0).applyQuaternion(cam.quaternion); _d.set(0, 1, 0).applyQuaternion(cam.quaternion); _a.addScaledVector(_b, 3 + rnd(9)).addScaledVector(_c, srnd(6.5)).addScaledVector(_d, srnd(4)); if (Math.hypot(_c.dot(_e.copy(_a).sub(cam.position)), _d.dot(_e)) < 1.6) continue; _e.copy(_a).addScaledVector(dir, -len * (0.6 + rnd(0.8))); fx.line(_e, _a, color, 0.05 + rnd(0.04), 0.2 + rnd(0.1), { a0: 0, a1: 0.8, shrink: 0.4 }); } };
  const monsters = () => (lastState && lastState.monsters) || [];
  const nearestAimed = (I, maxD = 70, minDot = 0.9) => { let best = null, bd = 0; for (const m of monsters()) { _a.set(m.p[0], m.p[1], m.p[2]).sub(I.eye); const l = _a.length(); if (l > maxD) continue; const d = _a.normalize().dot(I.aim); if (d > minDot && d > bd) { bd = d; best = m; } } return best; };
  const aimPoint = (I, e, dist, floating) => { if (e && e.to) return V(e.to); const m = nearestAimed(I, dist + 12, 0.96); if (m && floating) return V(m.p).addScaledVector(I.up, (m.r || 1) * 1.2 + 2.5); return (floating ? I.eye.clone().addScaledVector(I.aim, dist) : I.ground.clone().addScaledVector(I.h, dist)); };

  /* ═══════════════════════ HABILIDADES ═══════════════════════ */
  const SK = {};
  /* ── AXIOMA: azul / ámbar. Músculo, hueso, espinas. ── */
  SK.impulso = (I) => { // embestida: estallido en el suelo + posimágenes + estela de músculo
    const { pid, col, acc, h, up } = I;
    ring(I.ground, up, 0.4, 4.5, 0.45, col, { th: 0.13 }); fx.flash(I.ground.clone().addScaledVector(up, 0.8), 0xdff4ff, 3.4, 0.16, { burst: true });
    spray(I.ground, 0x7a8a9a, 6, 4, 0.8, 1.1, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.4, c2: 0x1c1c26, spin: 2 });
    spray(I.ground, col, 10, 13, 0.45, 0.8, { dir: _a.copy(h).negate().clone(), cone: 0.7, c2: 0xffffff });
    for (let i = 0; i < 3; i++) afterimage(I.pos, h, up, col, 0xffffff, 0.06 * (i + 1), 0.5 - 0.12 * i, 0.4);
    trail(pid, 0.5, col, acc, 1.6, 0.1, 0.4); trail(pid, 0.4, 0xffffff, col, 0.6, 0.4, 0.28);
    if (I.self) { addLoop(0.45, () => streaks(h, col, 3, 8)); shake(I, 0.3); }
  };
  SK.espinas = (I) => { // salva de espinas óseas: abanico de hueso que sale de los antebrazos + espinas clavadas en el suelo
    const { col, acc, aim, up, h, right } = I, o = I.eye.clone().addScaledVector(aim, 1.1).addScaledVector(up, -0.15);
    fx.flash(o, 0xe8f6ff, 3.4, 0.14, { burst: true }); sparks(o, 0xffffff, 8, 18, 0.3, { dir: aim, cone: 0.5, c2: col });
    orientCone(_q, aim); shell(capP, o, _q.clone(), 1, 17, 0.26, col, { c2: 0xffffff, op: 0.7, pow: 1.4, base: 0.05, st: 7, fade: 1.1 }); // el abanico
    for (let i = 0; i < 9; i++) { // 9 espinas voladoras (sólidas: se ven de frente y de costado)
      _a.copy(aim).addScaledVector(right, (i - 4) * 0.045).addScaledVector(up, srnd(0.02)).normalize(); const sp = 70 + rnd(25);
      thorn(o, _a, 2.4, 1.0, i % 2 ? 0xffffff : col, 28 / sp, { vel: _b.copy(_a).multiplyScalar(sp), grow: 0.02, fade: 0.05 });
      _c.copy(o).addScaledVector(_a, 28); fx.dart(o, _c.clone(), 0xffffff, 0.09, sp, 3, { c2: acc });
      later(28 / sp, () => { const e = o.clone().addScaledVector(_a.copy(aim).addScaledVector(right, (i - 4) * 0.045).normalize(), 28); fx.flash(e, col, 1.8, 0.14); sparks(e, 0xffffff, 3, 8, 0.3, { c2: col }); });
    }
    for (let i = 0; i < 10; i++) later(0.03 * i, () => { const d = 4 + i * 1.9; _c.copy(I.ground).addScaledVector(h, d).addScaledVector(right, srnd(1.8)); thorn(_c, _d.copy(up).addScaledVector(h, 0.25 + rnd(0.2)).addScaledVector(right, srnd(0.25)), 2.6 + rnd(1.6), 1.5 + rnd(0.5), i % 3 ? 0xe9eef2 : col, 1.3); });
    ring(I.ground.clone().addScaledVector(h, 1.5), up, 0.3, 3, 0.35, col, { th: 0.12 }); shake(I, 0.25);
  };
  SK.caparazon = (I) => { // la coraza hexagonal brota alrededor del cuerpo
    const { col, up } = I; forceState(I.pid, BF.CAPARAZON, 4);
    shell(sphereP, I.pos, null, 0.6, 1.9, 0.45, col, { c2: 0xffffff, op: 0.9, pow: 1.5, base: 0.06, hex: 1, fade: 1.0 });
    ring(I.ground, up, 0.4, 3.4, 0.45, col, { th: 0.12 }); fx.flash(I.pos, 0xdff4ff, 3, 0.2, { burst: true });
    spray(I.pos, col, 10, 7, 0.5, 0.7, { shape: SHAPE.shard, c2: 0xffffff, grow: -0.4, spin: 6 });
    if (I.self) kickVig(1, 0.9); shake(I, 0.2);
  };
  SK.sobrecarga = (I) => { // ULT: el organismo revienta de energía
    const { col, acc, up } = I; forceState(I.pid, BF.SOBRECARGA, 10);
    ring(I.ground, up, 0.5, 9, 0.6, col, { th: 0.1 }); ring(I.ground, up, 0.3, 6, 0.5, acc, { th: 0.12 });
    fx.flash(I.pos, 0xffffff, 6, 0.25, { burst: true }); column(I.ground, up, 9, acc, 0.5, 1.2); column(I.ground, up, 7, col, 0.6, 0.7);
    for (let i = 0; i < 6; i++) { _a.set(srnd(), rnd(0.8), srnd()).normalize(); bolt(I.pos, _b.copy(I.pos).addScaledVector(_a, 5 + rnd(3)), i % 2 ? acc : 0xffffff, 0.14, 0.18, 0.7, 4); }
    spray(I.pos, acc, 14, 12, 0.7, 0.8, { c2: col, grow: -0.5 }); kickVig(3, 1.0); shake(I, 0.6);
  };
  /* ── VESPER: violeta / magenta. Corte, desaparición. ── */
  SK.paso = (I) => { // desplazamiento: un tajo en el aire cose origen y destino
    const { col, acc, up, h, prev, pos } = I, far = prev.distanceToSquared(pos) > 4;
    const slit = (at, life) => { fx.line(_a.copy(at).addScaledVector(up, -1), _b.copy(at).addScaledVector(up, 2.1), 0xffffff, 0.22, life, { a0: 1, a1: 0, shrink: 0.9 }); fx.line(_a, _b, col, 0.7, life, { a0: 0.6, a1: 0, shrink: 0.9 }); };
    slit(prev, 0.3); slit(pos, 0.38);
    afterimage(prev, h, up, col, acc, 0, 0.7, 0.55, { gl: 0.8, r1: 1.0, sx: 0.4 });
    ring(I.ground, up, 0.3, 3.6, 0.4, acc, { th: 0.12 });
    spray(prev, col, 8, 7, 0.6, 0.7, { shape: SHAPE.shard, c2: acc, grow: -0.4, spin: 8 });
    for (let i = 0; i < 3; i++) { _a.copy(pos).addScaledVector(up, 0.4 + 0.25 * i).addScaledVector(I.right, -0.9); _b.copy(pos).addScaledVector(up, -0.2 + 0.25 * i).addScaledVector(I.right, 0.9); fx.line(_a, _b, i === 1 ? 0xffffff : acc, 0.12, 0.28, { a0: 1, a1: 0, shrink: 0.6 }); }
    if (far) { bolt(prev.clone().addScaledVector(up, 0.2), pos.clone().addScaledVector(up, 0.2), acc, 0.12, 0.35, 0.8, 7); fx.dart(prev, pos, 0xffffff, 0.14, 260, 9, { c2: col }); }
    sparks(pos, 0xffffff, 8, 14, 0.4, { c2: acc }); if (I.self) { streaks(h, col, 6, 12); shake(I, 0.12); kickVig(7, 0.5); }
  };
  SK.camuflaje = (I) => { // la piel se vuelve refracción
    const { col, up, pid } = I; forceState(pid, BF.CAMUFLAJE, 5);
    ring(I.ground, up, 0.4, 5, 0.5, col, { th: 0.1 }); disc(discP, I.pos, null, 0.5, 4.5, 0.5, 0, 0xffffff, col, { op: 0.5, k: 0.07 });
    afterimage(I.pos, I.h, up, col, 0x5cf0ff, 0, 0.8, 0.6, { gl: 0.9, r1: 1.18 });
    spray(I.pos, col, 10, 5, 0.7, 0.6, { c2: 0x5cf0ff, grow: -0.5 }); if (I.self) kickVig(2, 1.0); void pid;
  };
  SK.marca = (I) => { // el ojo del depredador fija a la presa
    const { col, acc } = I, m = nearestAimed(I, 80, 0.93);
    fx.flash(I.eye.clone().addScaledVector(I.aim, 1), acc, 2.2, 0.15, { burst: true });
    if (m) { _a.set(m.p[0], m.p[1], m.p[2]); fx.dart(I.eye, _a, 0xffffff, 0.09, 300, 10, { c2: acc }); later(0.12, () => { fx.flash(_a, acc, 4, 0.25, { burst: true }); ring(_a, null, 0.3, 3, 0.4, acc, { th: 0.1 }); sparks(_a, col, 8, 10, 0.4, { c2: 0xffffff }); }); }
    else ring(I.eye.clone().addScaledVector(I.aim, 6), I.aim, 0.2, 2, 0.35, acc);
    if (I.self) kickVig(7, 0.3);
  };
  SK.frenesi = (I) => { // ULT: furia depredadora
    const { col, acc, up } = I; forceState(I.pid, BF.FRENESI, 8);
    ring(I.ground, up, 0.5, 10, 0.6, acc, { th: 0.1 }); ring(I.ground, up, 0.3, 6, 0.45, col, { th: 0.12 }); fx.flash(I.pos, acc, 6, 0.28, { burst: true }); column(I.ground, up, 8, acc, 0.5, 1.1);
    for (let i = 0; i < 5; i++) { _a.copy(I.pos).addScaledVector(I.right, srnd(1.5)).addScaledVector(up, rnd(1.5)); _b.copy(_a).addScaledVector(I.right, srnd(2.5)).addScaledVector(up, -1.2 - rnd(1)); fx.line(_a, _b, i % 2 ? 0xffffff : acc, 0.1, 0.4, { a0: 1, a1: 0, shrink: 0.6 }); }
    spray(I.pos, acc, 14, 11, 0.7, 0.8, { c2: col, grow: -0.5 }); kickVig(4, 1.0); shake(I, 0.5);
  };
  /* ── MICELIO: verde / amarillo espora. Raíz, esporas. ── */
  SK.barrera = (I, e) => { startWall(I, e); };
  SK.esporas = (I, e) => { // la nube verde se asienta y envenena
    const { col, acc, up } = I, c = e && e.to ? V(e.to) : I.ground.clone().addScaledVector(I.h, 6), R = 5.5, life = 6;
    disc(discP, c, up, 1.5, R, life, 3, col, acc, { op: 1, fade: 1.3, k: 0.1 }); ring(c, up, 0.5, R, 0.5, acc, { th: 0.1 });
    fx.flash(c.clone().addScaledVector(up, 1), acc, 3.4, 0.25, { burst: true }); spray(c, col, 10, 9, 0.7, 0.9, { c2: acc, up: 2, grow: 0.3 });
    addLoop(life, (dt, u) => { if (Math.random() < dt * 9 * Q()) { _a.copy(c).addScaledVector(_b.set(srnd(), 0, srnd()).normalize(), rnd(R * 0.8)).addScaledVector(up, 0.3 + rnd(1.2)); fx.add.spawn(_a.x, _a.y, _a.z, srnd(0.3), 0.3, srnd(0.3), C(0x6ad02a), C(0x1c4a0c), 2.4 + rnd(1.0), 1.8, 0, 1, 0.8, SHAPE.soft, srnd(1), 0.5 * (1 - u)); }
      if (Math.random() < dt * 6) { _a.copy(c).addScaledVector(_b.set(srnd(), 0, srnd()).normalize(), rnd(R * 0.9)).addScaledVector(up, 0.2); fx.add.spawn(_a.x, _a.y, _a.z, srnd(0.3), 1 + rnd(1), srnd(0.3), C(acc), C(col), 0.9 + rnd(0.5), 1.6, 0, 0.5, -0.3, SHAPE.bubble, srnd(2), 1 - u); } });
  };
  SK.biomasa = (I) => { // tentáculos de savia traen la vida de las criaturas cercanas
    const { col, acc, up } = I; let n = 0;
    const near = monsters().filter((m) => V(m.p).distanceTo(I.pos) < 18).sort((a, b) => V(a.p).distanceTo(I.pos) - V(b.p).distanceTo(I.pos)).slice(0, N(6));
    for (const m of near) { const from = V(m.p); n++; addLoop(0.55, (dt, u) => { const k = known.get(I.pid); const to = k ? _d.copy(k.pos) : I.pos; _a.copy(from); for (let s = 1; s <= 5; s++) { _b.copy(from).lerp(to, s / 5 * eo(Math.min(1, u * 2.2))); _b.addScaledVector(up, Math.sin(s / 5 * Math.PI) * 1.2 + Math.sin(T * 14 + s * 2) * 0.25); fx.line(_a, _b, s % 2 ? acc : col, 0.3, 0.08, { a0: 1, a1: 0.8 }); _a.copy(_b); } if (u > 0.4 && Math.random() < 0.6) fx.add.spawn(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u, from.z + (to.z - from.z) * u, 0, 0, 0, C(0xffffff), C(col), 0.5, 0.25, 0, 0, -0.5, SHAPE.ember, 0, 1); }); }
    later(0.5, () => { ring(I.ground, up, 0.4, 3.6, 0.5, acc, { th: 0.1 }); shell(sphereP, I.pos, null, 0.8, 2.2, 0.5, acc, { c2: 0xffffff, op: 0.6, pow: 2.2 }); spray(I.pos, 0xffffff, 8 + n, 4, 0.8, 0.6, { shape: SHAPE.star, up: 3, c2: acc, spin: 3 }); if (I.self) kickVig(5, 0.8); });
    fx.flash(I.pos, col, 2.5, 0.2);
  };
  SK.floracion = (I) => { // ULT: el terreno florece
    const { col, acc, up } = I; forceState(I.pid, BF.FLORACION, 12);
    ring(I.ground, up, 0.5, 11, 0.6, acc, { th: 0.1 }); fx.flash(I.pos, acc, 6, 0.3, { burst: true }); column(I.ground, up, 9, col, 0.6, 1.2);
    for (let i = 0; i < 12; i++) later(i * 0.02, () => { const a = i / 12 * TAU; _c.copy(I.ground).addScaledVector(I.right, Math.cos(a) * 6.5).addScaledVector(I.h, Math.sin(a) * 6.5); thorn(_c, _d.copy(up).addScaledVector(_e.copy(_c).sub(I.ground).normalize(), -0.2), 1.5 + rnd(1), 0.9, i % 2 ? col : acc, 1.3, { grow: 0.35 }); });
    spray(I.pos, acc, 16, 10, 1.0, 0.8, { c2: col, up: 3, grow: 0.2 }); kickVig(5, 1.0); shake(I, 0.5);
  };
  /* ── UMBRA: violeta pálido / cian. Vacío, tiempo. ── */
  SK.fase = (I) => { // salto atrás: el cuerpo se pliega y deja un eco
    const { col, acc, up, h, prev, pos } = I; forceState(I.pid, BF.DESFASE, 2);
    afterimage(prev, h, up, acc, col, 0, 0.85, 0.5, { gl: 0.6, r1: 0.35, sx: 0.5 });
    for (let i = 1; i <= 3; i++) afterimage(prev.clone().lerp(pos, i / 4), h, up, i % 2 ? col : acc, 0xffffff, 0.04 * i, 0.5 - 0.1 * i, 0.4, { gl: 0.5 });
    ring(prev.clone().addScaledVector(up, -0.85), up, 3.6, 0.3, 0.45, acc, { th: 0.1 }); ring(I.ground, up, 0.3, 3.4, 0.4, col, { th: 0.12 });
    fx.flash(prev, 0xe8f0ff, 3.4, 0.2, { burst: true }); spray(prev, col, 10, 6, 0.9, 1.6, { smoke: true, shape: SHAPE.smoke, grow: 1.3, c2: 0x0a0414, spin: 2 });
    sparks(pos, acc, 8, 12, 0.4, { dir: _a.copy(h).negate().clone(), cone: 0.8, c2: col }); trail(I.pid, 0.35, acc, col, 0.9, 0.1);
    if (I.self) { streaks(h.clone().negate(), acc, 6, 12); shake(I, 0.2); kickVig(7, 1.0); }
  };
  const holeAt = (I, c, R, life, o = {}) => { // agujero negro: núcleo oscuro + disco de acreción + polvo que cae
    const { col, acc } = I, core = coreP.take(); core.visible = true; core.held = true; core.position.copy(c);
    const tilt = _b.copy(I.up).addScaledVector(I.h, -0.55).normalize().clone(); const dsc = discP.take(); dsc.visible = true; dsc.held = true; basisQ(_c.copy(I.right).cross(tilt).normalize(), _d.copy(I.right), _e.copy(tilt), dsc.quaternion); dsc.position.copy(c);
    setU(dsc, { uC: col, uC2: acc, uMode: 2, uK: 2.2, uO: 0 }); const lens = discP.take(); lens.visible = true; lens.held = true; setU(lens, { uC: 0xffffff, uC2: acc, uMode: 0, uK: 0.06, uO: 0 }); lens.position.copy(c);
    fx.flash(c, 0xffffff, 4, 0.25, { burst: true });
    addLoop(life, (dt, u, t) => {
      const grow = Math.min(1, t / 0.35), end = u > 0.94 ? (1 - u) / 0.06 : 1, s = grow * end;
      core.scale.setScalar(R * 0.22 * s); dsc.scale.setScalar(R * s); dsc.rotateZ(dt * 0.8); setU(dsc, { uT: t, uO: 0.9 * clamp(s, 0, 1) });
      lens.quaternion.copy(cam.quaternion); lens.scale.setScalar(R * (1.15 + 0.07 * Math.sin(t * 8)) * s); setU(lens, { uO: 0.5 * s, uT: t });
      if (Math.random() < dt * 28 * Q()) { _a.set(srnd(), srnd(0.6), srnd()).normalize().multiplyScalar(R * (0.8 + rnd(0.5))); fx.add.spawn(c.x + _a.x, c.y + _a.y, c.z + _a.z, -_a.x * 2.2, -_a.y * 2.2, -_a.z * 2.2, C(0xffffff), C(col), 0.5, 0.45, 0, 0, -0.7, SHAPE.ember, 0, 1); }
      if (o.pulse && t - (o.last = o.last || 0) > o.pulse) { o.last = t; ring(c, null, R * 1.4, R * 0.4, 0.5, acc, { th: 0.07, op: 0.6 }); }
      if (u >= 1) { core.visible = dsc.visible = lens.visible = false; core.held = dsc.held = lens.held = false; o.end && o.end(); }
    });
  };
  SK.singularidad = (I, e) => {
    const c = aimPoint(I, e, 13, true);
    holeAt(I, c, 4.2, 4.0, { end: () => { ring(c, null, 0.5, 12, 0.5, I.acc, { th: 0.1 }); fx.flash(c, 0xffffff, 8, 0.3, { burst: true }); sparks(c, I.col, 16, 26, 0.6, { c2: 0xffffff }); spray(c, I.acc, 12, 12, 0.7, 0.9, { c2: I.col, grow: -0.5 }); shell(sphereP, c, null, 1, 10, 0.4, I.col, { c2: 0xffffff, op: 0.7, pow: 2 }); if (sound) sound.boom(c.toArray()); } });
    if (I.self) kickVig(7, 0.3);
  };
  SK.tiempo = (I, e) => { // burbuja donde el tiempo se arrastra
    const { col, acc, up } = I, c = e && e.to ? V(e.to) : I.ground.clone().addScaledVector(I.h, 8), R = 7, life = 5;
    shell(sphereP, c.clone().addScaledVector(up, 0.2), null, 0.5, R, life, col, { c2: acc, op: 0.9, pow: 1.7, base: 0.03, st: 14, fade: 0.3, lin: false });
    disc(discP, c, up, R * 0.75, R, life, 5, col, acc, { op: 1, fade: 0.4, kfn: (u, t) => -t * 0.35 });
    ring(c, up, 0.4, R, 0.5, acc, { th: 0.08 }); fx.flash(c.clone().addScaledVector(up, 1), 0xe8f0ff, 3.5, 0.3, { burst: true });
    addLoop(life, (dt, u) => { if (Math.random() < dt * 8 * Q()) { _a.copy(c).addScaledVector(_b.set(srnd(), srnd(0.4), srnd()).normalize(), rnd(R * 0.85)).addScaledVector(up, 1 + rnd(2)); fx.add.spawn(_a.x, _a.y, _a.z, srnd(0.2), srnd(0.2), srnd(0.2), C(0xffffff), C(col), 0.45 + rnd(0.3), 2.2, 0, 0.5, -0.3, SHAPE.star, srnd(1), 1 - u); } });
    if (I.self) kickVig(7, 0.4);
  };
  SK.colapso = (I, e) => { // ULT: el Umbral se abre
    const c = aimPoint(I, e, 16, true), { col, acc } = I;
    holeAt(I, c, 9, 6.0, { pulse: 0.9, end: () => { ring(c, null, 1, 22, 0.7, acc, { th: 0.08 }); fx.flash(c, 0xffffff, 12, 0.4, { burst: true }); sparks(c, col, 22, 34, 0.7, { c2: 0xffffff }); shell(sphereP, c, null, 1, 16, 0.5, col, { c2: 0xffffff, op: 0.7, pow: 2 }); if (sound) sound.boom(c.toArray()); if (fx.combat) fx.combat.addShake(0.5); } });
    ring(I.ground, I.up, 0.5, 8, 0.6, col, { th: 0.1 }); column(I.ground, I.up, 9, acc, 0.6, 0.9); if (I.self) kickVig(7, 1.0); shake(I, 0.4);
  };
  /* ── SERAF: dorado / rosa. Alas, vida, simbiosis. ── */
  SK.planeo = (I, e) => { // impulso alado
    const { col, acc, up, h } = I; forceState(I.pid, BF.PLANEO, 2.2);
    ring(I.ground, up, 0.4, 4, 0.45, col, { th: 0.12 }); fx.flash(I.pos, 0xfff4c0, 3, 0.18, { burst: true });
    spray(I.pos, col, 12, 9, 0.9, 0.7, { shape: SHAPE.shard, c2: acc, spin: 5, up: 3, grow: -0.3 }); trail(I.pid, 1.2, col, acc, 0.9, 0.3, 0.5);
    if (I.self) { streaks(h, col, 6, 10); shake(I, 0.15); kickVig(6, 0.8); } void e;
  };
  SK.pulso = (I) => { // latido de vida: onda hacia afuera, retorno hacia dentro
    const { col, acc, up } = I, R = 11;
    shell(sphereP, I.pos, null, 0.8, R, 0.55, col, { c2: acc, op: 0.5, pow: 2.4, base: 0.02, st: 6, fade: 1.0 });
    disc(discP, I.ground, up, 1, R, 0.6, 7, col, acc, { op: 0.9, fade: 0.8, kfn: (u) => 0.1 + 0.9 * eo(u) }); ring(I.ground, up, 0.5, R, 0.5, acc, { th: 0.07 });
    later(0.18, () => ring(I.ground, up, 0.5, R * 0.7, 0.4, col, { th: 0.08, op: 0.6 }));
    fx.flash(I.pos, 0xfff0d0, 5, 0.25, { burst: true }); sparks(I.pos, col, 14, 22, 0.5, { c2: acc });
    later(0.45, () => { for (let i = 0; i < N(14); i++) { _a.set(srnd(), srnd(0.5), srnd()).normalize(); fx.add.spawn(I.pos.x + _a.x * 6, I.pos.y + _a.y * 6, I.pos.z + _a.z * 6, -_a.x * 12, -_a.y * 12, -_a.z * 12, C(0xffffff), C(col), 0.6, 0.5, 0, 0, -0.6, SHAPE.star, srnd(4), 1); } ring(I.ground, up, 3, 0.5, 0.4, 0xffffff, { th: 0.1, op: 0.7 }); });
    if (I.self) kickVig(6, 0.6); shake(I, 0.3);
  };
  SK.simbionte = (I, e) => { // nace el organismo aliado
    const { col, acc, up } = I, c = e && e.to ? V(e.to) : I.ground.clone().addScaledVector(I.h, 3.5);
    disc(discP, c, up, 0.5, 2.8, 0.8, 3, acc, col, { op: 0.9, fade: 1.2 }); ring(c, up, 0.3, 3.2, 0.5, col, { th: 0.1 }); fx.flash(c.clone().addScaledVector(up, 1), acc, 3.5, 0.3, { burst: true });
    column(c, up, 4, col, 0.5, 0.8); shell(sphereP, c.clone().addScaledVector(up, 0.9), null, 0.2, 1.4, 0.5, acc, { c2: col, op: 0.7, pow: 1.8, st: 9 });
    for (let i = 0; i < 6; i++) { _a.copy(c); _b.copy(c).addScaledVector(up, 1.2).addScaledVector(_d.set(srnd(), 0, srnd()), 2); bolt(_a, _b, i % 2 ? col : acc, 0.12, 0.35, 0.5, 4); }
    spray(c, acc, 12, 7, 0.9, 0.7, { c2: col, up: 3, shape: SHAPE.bubble, grow: 0.3 }); if (I.self) kickVig(6, 0.4);
  };
  SK.metamorfosis = (I) => { // ULT: crisálida de luz
    const { col, acc, up } = I; forceState(I.pid, BF.METAMORFOSIS, 12);
    shell(sphereP, I.pos, null, 0.5, 3.4, 0.55, col, { c2: acc, op: 0.8, pow: 1.8, st: 7, fade: 1.0 }); ring(I.ground, up, 0.5, 10, 0.6, col, { th: 0.1 }); ring(I.ground, up, 0.3, 6, 0.5, acc, { th: 0.12 });
    fx.flash(I.pos, 0xffffff, 6, 0.3, { burst: true }); column(I.ground, up, 10, col, 0.7, 1.2); column(I.ground, up, 8, acc, 0.6, 0.6);
    for (let i = 0; i < 14; i++) later(i * 0.03, () => { const a = i * 0.9; fx.add.spawn(I.pos.x + Math.cos(a) * 1.2 * I.right.x, I.pos.y - 0.8, I.pos.z + Math.sin(a) * 1.2, 0, 4 + rnd(2), 0, C(0xffffff), C(i % 2 ? col : acc), 0.8, 1.0, 0, 0.5, -0.4, SHAPE.shard, srnd(5), 1); });
    kickVig(6, 1.0); shake(I, 0.5);
  };

  /* ═══════════════════════ ESTADOS PERSISTENTES (campo bf) ═══════════════════════ */
  const forced = new Map(); // pid → { bit: hasta } (cuando el snapshot aún no trae `bf`)
  function forceState(pid, bit, secs) { let f = forced.get(pid); if (!f) forced.set(pid, f = {}); f[bit] = T + secs; }
  const bfOf = (p) => { let b = p.bf === undefined ? null : p.bf | 0; if (b === null) { b = 0; const f = forced.get(p.id); if (f) for (const k in f) if (f[k] > T) b |= +k; } return b; };
  const walls = new Map(); // pid → muro vivo de Micelio
  function startWall(I, e) {
    const old = walls.get(I.pid); if (old) endWall(I.pid, true);
    const m = wallP.take(); m.visible = true; m.held = true; const c = (e && e.to ? V(e.to) : I.ground.clone().addScaledVector(I.h, 3.4)); m.position.copy(c); basisQ(I.right.clone(), I.up.clone(), I.h.clone().negate(), m.quaternion);
    m.scale.set(8, 3.4, 1); setU(m, { uC: I.col, uC2: I.acc, uG: 0, uO: 0.85 });
    const w = { m, t: 0, c, I: { col: I.col, acc: I.acc, up: I.up.clone(), right: I.right.clone() }, dead: false, patch: null };
    const pt = discP.take(); pt.visible = true; pt.held = true; w.patch = pt; pt.position.copy(c).addScaledVector(I.up, 0.04); basisQ(I.right.clone().cross(I.up).normalize(), I.right.clone(), I.up.clone(), pt.quaternion); pt.scale.setScalar(5); setU(pt, { uC: I.col, uC2: I.acc, uMode: 3, uO: 0.6, uK: 0.1 });
    walls.set(I.pid, w);
    ring(c, I.up, 0.5, 6, 0.5, I.acc, { th: 0.1 }); fx.flash(c.clone().addScaledVector(I.up, 1), I.acc, 3, 0.2, { burst: true });
    for (let i = 0; i < 8; i++) later(0.03 * i, () => { _c.copy(c).addScaledVector(I.right, (i - 3.5) * 1.0); thorn(_c, _d.copy(I.up).addScaledVector(I.h, 0.45), 1.1 + rnd(0.5), 0.55, i % 2 ? I.col : 0x8a9a4a, 1.4, { grow: 0.3 }); });
    spray(c, 0x4a3a1a, 6, 5, 1.0, 1.4, { smoke: true, shape: SHAPE.smoke, flat: I.up, grow: 1.4, c2: 0x141008, spin: 2 }); shake(I, 0.35);
  }
  function endWall(pid, quiet) {
    const w = walls.get(pid); if (!w) return; walls.delete(pid); w.m.visible = false; w.m.held = false; w.patch.visible = false; w.patch.held = false;
    if (!quiet) { for (let i = 0; i < 6; i++) { _a.copy(w.c).addScaledVector(w.I.right, (i - 2.5) * 1.3).addScaledVector(w.I.up, 0.8 + rnd(1.5)); spray(_a, w.I.col, 4, 5, 0.8, 0.6, { shape: SHAPE.shard, grav: 6, c2: w.I.acc, spin: 6 }); } spray(w.c, 0x4a3a1a, 6, 4, 1.0, 1.3, { smoke: true, shape: SHAPE.smoke, grow: 1.4, c2: 0x141008 }); }
  }
  const stOf = (pid) => { let s = states.get(pid); if (!s) states.set(pid, s = { bits: 0, m: {}, last: new THREE.Vector3(), tEmit: 0, pulse: 0, sym: null }); return s; };
  const takeHeld = (pool) => { const m = pool.take(); m.held = true; m.visible = true; return m; };
  const freeHeld = (m) => { if (m) { m.held = false; m.visible = false; } };

  function statesUpdate(dt, state, me) {
    const rm = reduced(); vigWant.fill(0); const seen = new Set();
    for (const p of state.players) {
      seen.add(p.id); const k = known.get(p.id); if (!k) continue; const S = stOf(p.id), bf = p.dead ? 0 : bfOf(p), pal = palOf(p.char), col = pal.c, acc = pal.a;
      const self = (me && p.id === me.id) && !renderer.third, up = k.upV, pos = k.pos, h = k.h, feet = _f.copy(pos).addScaledVector(up, -0.85), on = (b) => (bf & b) !== 0, was = (b) => (S.bits & b) !== 0;
      const hurtK = S.pulse = Math.max(0, S.pulse - dt * 3);
      // caparazón
      if (on(BF.CAPARAZON)) {
        if (!S.m.cap) S.m.cap = takeHeld(sphereP); const m = S.m.cap; m.visible = !self; m.position.copy(pos); m.scale.setScalar(1.55 + 0.04 * Math.sin(T * 3));
        setU(m, { uC: col, uC2: 0xffffff, uPow: 1.7, uBase: 0.03, uHex: 1, uO: 0.45 + 0.4 * hurtK + (rm ? 0 : 0.06 * Math.sin(T * 4)), uT: T });
        if (self) vigWant[1] = 0.55 + 0.4 * hurtK;
      } else if (was(BF.CAPARAZON)) { freeHeld(S.m.cap); S.m.cap = null; spray(pos, col, 10, 8, 0.7, 0.7, { shape: SHAPE.shard, c2: 0xffffff, spin: 8, grav: 6 }); ring(feet, up, 1.5, 3.5, 0.35, col, { th: 0.1, op: 0.6 }); }
      // camuflaje
      if (on(BF.CAMUFLAJE)) {
        if (!S.m.cam) S.m.cam = takeHeld(ghostP); const m = S.m.cam; m.visible = !self; m.position.copy(feet); orient(m.quaternion, h, up); m.scale.setScalar(1.06);
        const fl = rm ? 1 : 0.65 + 0.35 * Math.sin(T * 17) * Math.sin(T * 5.3); setU(m, { uC: 0x5cf0ff, uC2: col, uPow: 1.0, uBase: 0.1, uGl: rm ? 0.3 : 0.9, uSt: 26, uO: 0.62 * fl, uT: T });
        if (self) vigWant[2] = 0.5;
      } else if (was(BF.CAMUFLAJE)) { freeHeld(S.m.cam); S.m.cam = null; ring(feet, up, 0.5, 4.5, 0.4, col, { th: 0.1 }); disc(discP, pos, null, 0.5, 3.5, 0.35, 0, 0xffffff, acc, { op: 0.5, k: 0.07 }); sparks(pos, acc, 8, 12, 0.4, { c2: 0xffffff }); if (self) kickVig(2, 0.7); }
      // sobrecarga (aura + rayos + brasas)
      if (on(BF.SOBRECARGA)) {
        if (!S.m.aura) S.m.aura = takeHeld(auraP); const m = S.m.aura; m.visible = !self; m.position.copy(feet); orient(m.quaternion, h, up); m.scale.setScalar(1.3 + 0.05 * Math.sin(T * 9));
        setU(m, { uC: acc, uC2: 0xfff0c0, uPow: 0.9, uBase: 0.16, uSt: 14, uGl: 0.25, uO: 0.8 + (rm ? 0 : 0.2 * Math.sin(T * 13)), uT: T });
        S.tEmit -= dt; if (S.tEmit <= 0) { S.tEmit = rm ? 0.5 : 0.2; _a.set(srnd(), rnd(0.8) + 0.2, srnd()).normalize(); bolt(_b.copy(pos).addScaledVector(up, 0.2), _c.copy(pos).addScaledVector(_a, 1.5 + rnd(0.8)), acc, 0.07, 0.1, 0.35, 3); fx.add.spawn(pos.x + srnd(0.4), pos.y - 0.4, pos.z + srnd(0.4), 0, 2.5, 0, C(0xffd7a0), C(col), 0.5, 0.7, 0, 0.5, -0.5, SHAPE.ember, 0, 1); }
        if (self) vigWant[3] = 0.55;
      } else if (was(BF.SOBRECARGA)) { freeHeld(S.m.aura); S.m.aura = null; ring(feet, up, 3, 0.5, 0.45, acc, { th: 0.1, op: 0.7 }); spray(pos, acc, 8, 8, 0.6, 0.7, { c2: col, grow: -0.5 }); }
      // frenesí (anillo rojo en el suelo + estela + brasas)
      if (on(BF.FRENESI)) {
        if (!S.m.fre) S.m.fre = takeHeld(discP); const m = S.m.fre; m.position.copy(feet).addScaledVector(up, 0.05); basisQ(_a.copy(k.right).cross(up).normalize(), k.right, up, m.quaternion); m.scale.setScalar(2.3 + (rm ? 0 : 0.25 * Math.sin(T * 8)));
        setU(m, { uC: acc, uC2: col, uMode: 0, uK: 0.14, uO: 1, uT: T }); S.tEmit -= dt;
        if (S.tEmit <= 0) { S.tEmit = 0.09; if (k.speed > 2 && S.last.distanceToSquared(pos) > 0.04) fx.line(S.last, pos, acc, 0.5, 0.35, { a0: 0.9, a1: 0, shrink: 0.7, c2: col }); S.last.copy(pos); fx.add.spawn(pos.x + srnd(0.5), pos.y - 0.5, pos.z + srnd(0.5), 0, 2, 0, C(acc), C(col), 0.45, 0.6, 0, 0.5, -0.5, SHAPE.ember, 0, 1); }
        if (self) vigWant[4] = 0.55;
      } else if (was(BF.FRENESI)) { freeHeld(S.m.fre); S.m.fre = null; ring(feet, up, 2.5, 0.5, 0.35, acc, { th: 0.1, op: 0.6 }); }
      // floración (zona en el suelo + pétalos + esporas)
      if (on(BF.FLORACION)) {
        if (!S.m.flo) { S.m.flo = takeHeld(discP); S.floAge = 0; S.petals = []; for (let i = 0; i < 10; i++) S.petals.push(thorn(pos, up, 1.4, 0.7, i % 2 ? col : acc, 99, { held: true, grow: 0.5, sway: 0.18 })); } const m = S.m.flo; S.floAge += dt; const g = Math.min(1, S.floAge / 0.6);
        m.position.copy(feet).addScaledVector(up, 0.04); basisQ(_a.copy(k.right).cross(up).normalize(), k.right, up, m.quaternion); m.scale.setScalar(9 * eo(g)); setU(m, { uC: col, uC2: acc, uMode: 4, uO: 0.8, uT: T });
        for (let i = 0; i < S.petals.length; i++) { const t = S.petals[i], a = i / 10 * TAU + T * 0.15; t.p.copy(feet).addScaledVector(k.right, Math.cos(a) * 7.2).addScaledVector(h, Math.sin(a) * 7.2); t.q.setFromUnitVectors(Y, _b.copy(up).addScaledVector(_c.copy(t.p).sub(feet).normalize(), -0.25).normalize()); }
        S.tEmit -= dt; if (S.tEmit <= 0) { S.tEmit = 0.14; _a.set(srnd(), 0, srnd()).normalize().multiplyScalar(rnd(8)); fx.add.spawn(feet.x + _a.x, feet.y + 0.3, feet.z + _a.z, 0, 1.4 + rnd(1.2), 0, C(acc), C(col), 0.55, 1.6, 0, 0.4, -0.3, SHAPE.bubble, srnd(2), 1); }
        if (self) vigWant[5] = 0.5;
      } else if (was(BF.FLORACION)) { freeHeld(S.m.flo); S.m.flo = null; for (const t of S.petals || []) { t.held = false; t.age = Math.max(t.age, t.life - 0.3); t.life = t.age + 0.3; } S.petals = null; spray(feet, 0x3a2a14, 8, 5, 1.0, 1.2, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.3, c2: 0x141008 }); }
      // alas: planeo (medianas) / metamorfosis (grandes, con halo)
      const wingBits = bf & (BF.PLANEO | BF.METAMORFOSIS), wasWing = S.bits & (BF.PLANEO | BF.METAMORFOSIS);
      if (wingBits) {
        const big = (bf & BF.METAMORFOSIS) !== 0, sc = big ? 2.0 : 1.5; if (!S.m.wl) { S.m.wl = takeHeld(wingP); S.m.wr = takeHeld(wingP); S.wAge = 0; } S.wAge += dt;
        const open = eo(Math.min(1, S.wAge / 0.3)), flap = (big ? 0.35 : 0.12) * Math.sin(T * (big ? 5 : 3.2)) + (big ? 0.15 : 0.35), gl = bf & BF.PLANEO && !big ? 0.1 : 0;
        for (const [m, sd] of [[S.m.wl, -1], [S.m.wr, 1]]) {
          m.visible = true; m.position.copy(pos).addScaledVector(up, 0.25).addScaledVector(h, -0.18);
          m.quaternion.setFromRotationMatrix(_m.makeBasis(_a.copy(k.right), _b.copy(up), _c.copy(h).negate())); m.scale.set(sc * open * sd, sc * open, sc * open); // x = afuera (la izquierda se espeja con escala negativa)
          setU(m, { uC: big ? acc : col, uC2: big ? col : 0xfff4c0, uO: (big ? 0.95 : 0.8) * open, uFlap: rm ? 0.25 : flap + gl });
        }
        if (big) { if (!S.m.halo) S.m.halo = takeHeld(discP); const m = S.m.halo; m.position.copy(pos).addScaledVector(up, 1.45); basisQ(_a.copy(k.right).cross(up).normalize(), k.right, up, m.quaternion); m.scale.setScalar(0.55); setU(m, { uC: col, uC2: acc, uMode: 0, uK: 0.1, uO: 0.8, uT: T }); }
        S.tEmit -= dt; if (S.tEmit <= 0) { S.tEmit = big ? 0.1 : 0.2; fx.add.spawn(pos.x + srnd(1.2), pos.y + rnd(1), pos.z + srnd(1.2), srnd(0.3), -0.8, srnd(0.3), C(col), C(acc), 0.5, 1.2, 0, 0.4, -0.3, SHAPE.shard, srnd(5), 1); }
        if (self) vigWant[6] = big ? 0.5 : 0.3;
      } else if (wasWing) { freeHeld(S.m.wl); freeHeld(S.m.wr); freeHeld(S.m.halo); S.m.wl = S.m.wr = S.m.halo = null; spray(pos, col, 8, 7, 0.7, 0.6, { shape: SHAPE.shard, c2: acc, spin: 5, grav: 3 }); }
      // desfase: eco tenue
      if (on(BF.DESFASE)) {
        if (!S.m.des) S.m.des = takeHeld(ghostP); const m = S.m.des; m.visible = !self; m.position.copy(feet).addScaledVector(k.right, 0.28 * Math.sin(T * 6)).addScaledVector(h, -0.12); orient(m.quaternion, h, up); m.scale.setScalar(1.03);
        setU(m, { uC: col, uC2: acc, uPow: 1.3, uBase: 0.05, uGl: 0.7, uSt: 0, uO: 0.3, uT: T }); if (self) vigWant[7] = 0.35;
      } else if (was(BF.DESFASE)) { freeHeld(S.m.des); S.m.des = null; }
      // barrera: si el estado aparece sin muro (aliado que no vimos lanzar) se levanta; si se apaga, cae
      if (on(BF.BARRERA)) { if (!walls.has(p.id)) startWall({ pid: p.id, col, acc, up: up.clone(), right: k.right.clone(), h: h.clone(), ground: feet.clone() }, null); }
      else if (was(BF.BARRERA) && p.bf !== undefined) endWall(p.id);
      // simbionte: orbe vivo con tentáculo hasta su dueño
      const sy = p.sy;
      if (sy && !p.dead) {
        if (!S.sym) { S.sym = { shell: takeHeld(sphereP), ring: takeHeld(discP), p: V([sy.x, sy.y, sy.z]) }; spray(S.sym.p, acc, 10, 7, 0.7, 0.7, { c2: col, shape: SHAPE.bubble, up: 2 }); ring(S.sym.p, up, 0.3, 2.5, 0.4, col, { th: 0.1 }); }
        const y = S.sym; y.p.lerp(_a.set(sy.x, sy.y, sy.z), Math.min(1, dt * 10)); y.shell.position.copy(y.p).addScaledVector(up, 0.4); y.shell.scale.setScalar(0.95 + 0.12 * Math.sin(T * 7)); setU(y.shell, { uC: acc, uC2: col, uPow: 1.1, uBase: 0.3, uSt: 9, uO: 0.95, uT: T });
        y.ring.position.copy(y.p).addScaledVector(up, -0.8); basisQ(_a.copy(k.right).cross(up).normalize(), k.right, up, y.ring.quaternion); y.ring.scale.setScalar(1.5); setU(y.ring, { uC: col, uC2: acc, uMode: 0, uK: 0.1, uO: 0.6, uT: T });
        if (Math.random() < dt * 16) { _a.copy(pos); _b.copy(y.p).addScaledVector(up, 0.4); _c.copy(_a); for (let s = 1; s <= 5; s++) { _d.copy(_a).lerp(_b, s / 5).addScaledVector(up, Math.sin(s / 5 * Math.PI) * 0.6 + Math.sin(T * 9 + s) * 0.2); fx.line(_c, _d, s % 2 ? acc : col, 0.14, 0.12, { a0: 1, a1: 0.8 }); _c.copy(_d); } }
      } else if (S.sym) { const y = S.sym; spray(y.p, acc, 8, 6, 0.6, 0.6, { c2: col, shape: SHAPE.bubble }); ring(y.p, up, 0.3, 2.2, 0.35, col, { th: 0.1 }); freeHeld(y.shell); freeHeld(y.ring); S.sym = null; }
      S.bits = bf;
      if (!self) { /* nada más */ }
    }
    for (const [pid, S] of states) if (!seen.has(pid)) { for (const key in S.m) freeHeld(S.m[key]); if (S.sym) { freeHeld(S.sym.shell); freeHeld(S.sym.ring); } if (S.petals) for (const t of S.petals) t.held = false; states.delete(pid); endWall(pid, true); }
    // muros vivos
    for (const [pid, w] of walls) {
      w.t += dt; const p = state.players.find((q) => q.id === pid), g = Math.min(1, w.t / 0.35), over = w.t > 12 || (p && p.bf !== undefined && !(p.bf & BF.BARRERA) && w.t > 0.5);
      if (over) { endWall(pid); continue; }
      const gg = 1 - Math.pow(1 - g, 3) * Math.cos(g * 3) * 0.0; setU(w.m, { uG: gg, uT: T, uO: 0.85 * (w.t > 11 ? 12 - w.t : 1) }); setU(w.patch, { uT: T, uO: 0.6 * (w.t > 11 ? 12 - w.t : 1) });
    }
    // viñeta
    const own = !renderer.third && me; let any = 0;
    for (let i = 1; i < 8; i++) { vigKick[i] *= Math.exp(-dt * 2.6); const want = own ? vigWant[i] + vigKick[i] : 0; vigW[i] += (want - vigW[i]) * Math.min(1, dt * 7); any += vigW[i]; vigMat.uniforms.uW.value[i] = vigW[i] * (reduced() ? 0.6 : 1); }
    vig.visible = any > 0.01; vigMat.uniforms.uT.value = T; vigMat.uniforms.uAsp.value = (renderer.camera.aspect || 1.6);
  }

  /* ═══════════════════════ eventos, cuadro, limpieza ═══════════════════════ */
  const melee = createHostMelee(renderer, { fx, hostPal: palOf, getSound: () => sound, known: (pid) => known.get(pid), info, shake, spray, sparks, ring, reduced, nearestAimed, sphereP, setU, kickVig, thorn, getState: () => lastState, getMe: () => meId, bolt });
  disposables.push(melee);
  function onEvent(e, me, state) {
    if (me) meId = me.id; if (state) lastState = state;
    if (e.t === 'hurt') { const S = states.get(e.pid); if (S) S.pulse = 1; return false; }
    if (e.t === 'melee') { melee.onEvent(e, me, state); return true; }
    if (e.t === 'ultend') { const I = info(e.pid, e, me); endUlt(I, e.id); return false; }
    if (e.t !== 'skill' || !SK[e.id]) return false;
    const I = info(e.pid, e, me); SK[e.id](I, e, state);
    if (sound) sound.host(e.id, I.self ? null : (e.p || null));
    return true;
  }
  function endUlt(I, id) {
    const pal = palOf(I.char); ring(I.ground, I.up, 4, 0.5, 0.45, pal.a, { th: 0.1, op: 0.7 }); spray(I.pos, pal.c, 8, 8, 0.6, 0.7, { c2: pal.a, grow: -0.5 });
    if (id === 'metamorfosis') { const f = forced.get(I.pid); if (f) f[BF.METAMORFOSIS] = 0; }
    if (sound) sound.hostEnd(id, I.self ? null : I.pos.toArray());
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
  const markers = new Map();
  function marksUpdate(dt, state) { // retículas sobre las criaturas marcadas (campo mk de la criatura)
    const want = new Set(); let n = 0;
    for (const m of state.monsters) { if (!m.mk) continue; if (++n > markP.items.length) break; want.add(m.id); let mk = markers.get(m.id); if (!mk) { mk = takeHeld(markP); markers.set(m.id, mk); const pal = HOST_PAL.vesper; setU(mk, { uC: pal.a, uC2: 0xffffff, uMode: 6, uK: 0.1 }); fx.flash(V(m.p), pal.a, 3, 0.2, { burst: true }); }
      mk.position.set(m.p[0], m.p[1], m.p[2]); _a.copy(cam.position).sub(mk.position).normalize(); mk.position.addScaledVector(_a, (m.r || 1) * 0.9); mk.quaternion.copy(cam.quaternion); mk.scale.setScalar(clamp((m.r || 1) * 1.5 + 0.8, 1.2, 4.5) * (1 + (reduced() ? 0 : 0.05 * Math.sin(T * 6)))); mk.rotateZ(T * (reduced() ? 0.2 : 0.8)); setU(mk, { uT: T, uO: 0.75 }); }
    for (const [id, mk] of markers) if (!want.has(id)) { freeHeld(mk); markers.delete(id); }
  }
  function update(dt, state, me) {
    dt = Math.min(dt, 0.1); T += dt; if (state) lastState = state; if (me) meId = me.id;
    for (let i = delays.length - 1; i >= 0; i--) { delays[i].t -= dt; if (delays[i].t <= 0) { const f = delays.splice(i, 1)[0].fn; f(); } }
    for (let i = loops.length - 1; i >= 0; i--) { const l = loops[i]; l.t += dt; const u = Math.min(1, l.t / l.dur); const r = l.fn(dt, u, l.t); if (r === false || l.t >= l.dur) loops.splice(i, 1); }
    if (state) { marksUpdate(dt, state); statesUpdate(dt, state, me || (state.players.find((p) => p.id === meId))); }
    thornsUpdate(dt); melee.update(dt, state, me);
    trackPlayers(dt, state); // al final: durante los eventos del cuadro `known` conserva la posición ANTERIOR (origen del Desplazamiento, la Fase…)
  }
  function clear() {
    loops.length = delays.length = 0; forced.clear();
    for (const p of [capP, sphereP, auraP, ghostP, discP, markP, wallP, wingP, coreP]) for (const m of p.items) { m.visible = false; m.held = false; }
    for (const t of th) { t.on = false; t.held = false; } thornsUpdate(0); states.clear(); walls.clear(); markers.clear(); vigW.fill(0); vigKick.fill(0); vig.visible = false; melee.clear();
  }
  function dispose() {
    clear(); scene.remove(root);
    for (const p of [capP, sphereP, auraP, ghostP, discP, markP, wallP, wingP, coreP]) for (const m of p.items) m.material.dispose();
    for (const d of disposables) d.dispose();
  }
  function stats() {
    let vis = 0; root.traverse((o) => { if (o.isMesh && o.visible) vis++; });
    return { meshesVisibles: vis + melee.stats().meshes, loops: loops.length, espinas: th.filter((t) => t.on).length, estados: states.size };
  }
  /** Tecla V (predicción local del melee): meleeKey(true) al apretar, meleeKey(false) al soltar. */
  function meleeKey(down) { melee.key(down, lastState); }
  if (typeof window !== 'undefined' && !opts.noKeys) {
    const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyV' && !ev.repeat && !typing(ev.target) && !renderer.third) meleeKey(true); });
    window.addEventListener('keyup', (ev) => { if (ev.code === 'KeyV' && !typing(ev.target)) meleeKey(false); });
  }
  return { onEvent, update, clear, dispose, stats, melee, meleeKey, setSound(s) { sound = s; }, handles: (e) => (e.t === 'skill' && !!SK[e.id]) || e.t === 'melee', skills: Object.keys(SK), HOST_IDS, forceState };
}
