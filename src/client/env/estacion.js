// «LA ESTACIÓN» — escenario 3D del prólogo (andén subterráneo real que luego se «infecta») y las piezas biológicas
// (tejido vivo, entidad, capullo-blanco, umbral, pedestal y el organismo simbiótico de la mano).
// Todo se arma con pocas mallas fusionadas / instanciadas para entrar en el presupuesto de la calidad Baja.
//
// Coordenadas: el andén A va de z=0 a z=7 (jugador), la vía en z≈-2.6 (hueco de 1,25 m), el andén B de z=-5.2 a z=-12.4.
// La estación mide x∈[-24, 24]. El tren viene del túnel de x=-24 y va hacia +x.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, BUMP } from './glsl.js';
import { HEART } from './flesh.js';
import { rng, vnoise3 } from './noise.js';

export const ST = {
  X0: -24, X1: 24, ZA1: 7, ZB0: -12.4, ZB1: -5.2, YBED: -1.25, YTOP: 5.4, TRACK_Z: -2.6, RAIL_Z: [-1.88, -3.32],
  COLS_X: [-20, -12, -4, 4, 12, 20], COL_ZA: 4.2, COL_ZB: -8.8, EYE: 1.6,
};

/* ───────── GLSL compartido: la geometría «se dobla» con uWarp ───────── */
const WARP_GLSL = `vec3 warpOff(vec3 p, float w, float t){ return w * 0.35 * vec3(sin(p.y * 1.7 + p.z * 0.9 + t * 1.3), 0.4 * sin(p.x * 0.8 + t), sin(p.y * 1.3 + p.x * 0.7 + t * 1.1)) * (0.5 + 0.5 * sin(p.x * 0.3 + t * 0.5)); }`;
const TWIST_COL = `float cx_ = floor((transformed.x + 24.0) / 8.0) * 8.0 - 20.0; float cz_ = transformed.z > -2.0 ? 4.2 : -8.8;
  float ang_ = uWarp * (0.5 * sin(transformed.y * 0.7 + 1.0) + 0.15 * transformed.y); vec2 dd_ = transformed.xz - vec2(cx_, cz_); float cs_ = cos(ang_), sn_ = sin(ang_);
  transformed.xz = vec2(cx_, cz_) + vec2(cs_ * dd_.x - sn_ * dd_.y, sn_ * dd_.x + cs_ * dd_.y);`;

function withWarp(mat, U, twist = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWarp = U.uWarp; sh.uniforms.uT = U.uT;
    sh.vertexShader = 'uniform float uWarp; uniform float uT;\n' + WARP_GLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${twist ? TWIST_COL : ''}\ntransformed += warpOff(transformed, uWarp, uT);`);
  };
  mat.customProgramCacheKey = () => 'estacion-warp' + (twist ? 1 : 0);
  return mat;
}

/* ───────── texturas de canvas ───────── */
function canvasTex(T, w, h, draw, rep = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function tileTexture(T) {
  return canvasTex(T, 256, 256, (g, w, h) => {
    const r = rng(11); g.fillStyle = '#c9d2cc'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const s = 196 + (r() * 26) | 0; g.fillStyle = `rgb(${s - 6},${s},${s - 4})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
    g.fillStyle = 'rgba(70,80,75,.55)'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 3, h); g.fillRect(0, i * 64 - 1, w, 3); }
    for (let i = 0; i < 14; i++) { const gr = g.createRadialGradient(r() * w, r() * h, 2, r() * w, r() * h, 60); gr.addColorStop(0, 'rgba(40,36,30,.18)'); gr.addColorStop(1, 'rgba(40,36,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  });
}
function floorTexture(T) {
  return canvasTex(T, 256, 256, (g, w, h) => {
    const r = rng(23); g.fillStyle = '#8f918c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const s = 128 + (r() * 22) | 0; g.fillStyle = `rgb(${s},${s + 2},${s - 3})`; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.12)'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = 'rgba(30,28,24,.5)'; g.fillRect(0, 126, w, 4); g.fillRect(126, 0, 4, h);
  });
}
function concreteTexture(T) {
  return canvasTex(T, 128, 128, (g, w, h) => {
    const r = rng(5); g.fillStyle = '#86898a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const s = 90 + (r() * 90) | 0; g.fillStyle = `rgba(${s},${s},${s},.25)`; g.fillRect(r() * w, r() * h, 3, 3); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(30,30,30,.12)'; g.fillRect(0, i * 32, w, 1); }
  });
}
function haloTex(T) {
  return canvasTex(T, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
}
function eyeTexture(T, iris = '#2fe6d2') {
  return canvasTex(T, 128, 128, (g, w, h) => {
    g.fillStyle = '#efe3d2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(190,40,60,.55)'; g.lineWidth = 1.5; const r = rng(3);
    for (let i = 0; i < 22; i++) { g.beginPath(); const a = r() * 6.28, x0 = 64 + Math.cos(a) * 62, y0 = 64 + Math.sin(a) * 62; g.moveTo(x0, y0); g.lineTo(64 + Math.cos(a + r() * 0.4) * 28, 64 + Math.sin(a + r() * 0.4) * 28); g.stroke(); }
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 30); gr.addColorStop(0, '#07131a'); gr.addColorStop(0.35, '#07131a'); gr.addColorStop(0.4, iris); gr.addColorStop(1, '#0c5a66'); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 30, 0, 6.29); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(52, 52, 5, 0, 6.29); g.fill();
  }, false);
}

/* ───────── helpers de geometría ───────── */
/** UV planar por posición del mundo (la textura se repite cada `scale` metros, sin importar el tamaño de la caja). */
function bakeUV(g, scale) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v; if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new (g.attributes.uv.constructor)(uv, 2)); return g;
}
function colorize(T, g, col) {
  const c = new T.Color(col), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(a, 3)); return g;
}
const prep = (T, g, col = 0xffffff, scale = 1.2) => colorize(T, bakeUV(g, scale), col);

/* ───────── personas de baja complejidad (siluetas legibles) ───────── */
/** Partes de una persona con el pivote ya puesto (cadera / hombro): sirven para fusionar (público) o animar (la que cae). */
export function personParts(T, o = {}) {
  const skin = o.skin ?? 0xd8a487, shirt = o.shirt ?? 0x6a7fa8, pants = o.pants ?? 0x2a2f3a, hair = o.hair ?? 0x2a211c;
  const cyl = (rt, rb, h, seg, ty, sz = 1) => { const g = new T.CylinderGeometry(rt, rb, h, seg); g.translate(0, ty, 0); g.scale(1, 1, sz); return g; };
  const P = [
    { n: 'legL', g: cyl(0.085, 0.065, 0.9, 6, -0.45), p: [-0.1, 0.92, 0], c: pants },
    { n: 'legR', g: cyl(0.085, 0.065, 0.9, 6, -0.45), p: [0.1, 0.92, 0], c: pants },
    { n: 'torso', g: cyl(0.2, 0.17, 0.66, 8, 0, 0.62), p: [0, 1.24, 0], c: shirt },
    { n: 'head', g: new T.SphereGeometry(0.115, 8, 6), p: [0, 1.67, 0], c: skin },
    { n: 'hair', g: (() => { const g = new T.SphereGeometry(0.122, 8, 5, 0, 6.29, 0, 1.9); g.translate(0, 0.01, -0.012); return g; })(), p: [0, 1.67, 0], c: hair },
    { n: 'armL', g: cyl(0.058, 0.046, 0.62, 6, -0.31), p: [-0.27, 1.52, 0], c: shirt },
    { n: 'armR', g: cyl(0.058, 0.046, 0.62, 6, -0.31), p: [0.27, 1.52, 0], c: shirt },
  ];
  if (o.bag) P.push({ n: 'bag', g: new T.BoxGeometry(0.3, 0.4, 0.16), p: [0, 1.28, -0.17], c: o.bag });
  return P;
}
const mat4 = (T, p, ry, s = 1) => new T.Matrix4().compose(new T.Vector3(...p), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(s, s, s));

/** Persona armada con articulaciones (grupo + partes por nombre) para animarla. */
export function buildPerson(T, o = {}) {
  const g = new T.Group(), parts = {}, mats = [];
  for (const q of personParts(T, o)) {
    const m = new T.MeshStandardMaterial({ color: q.c, roughness: 0.85, metalness: 0, emissive: o.glow ? new T.Color(o.glow) : 0x000000, emissiveIntensity: o.glow ? 0.5 : 0 });
    const pv = new T.Group(); pv.position.set(...q.p); pv.add(new T.Mesh(q.g, m)); g.add(pv); parts[q.n] = pv; mats.push(m);
  }
  return { group: g, parts, mats };
}

/* ───────── material de carne (tejido vivo) ───────── */
export function fleshMaterial(T, U, grow, { tint = [1, 1, 1], vein = [0.2, 0.95, 0.85] } = {}) {
  return new T.ShaderMaterial({
    defines: { FBM_OCT: 3 },
    uniforms: { uT: U.uT, uWarp: U.uWarp, uGrow: grow, uTint: { value: new T.Vector3(...tint) }, uVein: { value: new T.Vector3(...vein) }, uPulse: U.uPulse },
    vertexShader: `attribute vec3 aC; attribute float aSeed; attribute float aKind; uniform float uT, uWarp, uGrow; varying vec3 vWP; varying vec3 vN; varying vec3 vC; varying float vK;
      ${WARP_GLSL}
      void main(){
        float g = clamp(uGrow * 1.5 - aSeed * 0.5, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
        vec3 p = aC + (position - aC) * (g * (1.0 + 0.03 * sin(uT * 3.0 + aSeed * 20.0)));
        if (aKind < 0.5) { float ang = uWarp * (0.5 * sin(p.y * 0.7 + 1.0) + 0.15 * p.y); vec2 d = p.xz - aC.xz; float c = cos(ang), s = sin(ang); p.xz = aC.xz + vec2(c * d.x - s * d.y, s * d.x + c * d.y); }
        if (aKind < 3.5) p += warpOff(p, uWarp, uT);
        if (aKind > 4.5) p += normal * 0.006 * sin(uT * 9.0 + position.y * 40.0 + position.z * 25.0);
        vK = aKind; vC = aC; vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(p, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform float uT, uPulse; uniform vec3 uTint, uVein; varying vec3 vWP; varying vec3 vN; varying vec3 vC; varying float vK; ${NOISE} ${BUMP} ${HEART}
      void main(){
        vec3 N = normalize(vN), V = cameraPosition - vWP; float dist = length(V); V /= dist;
        vec3 q = (vWP - vC) * 0.6; float beat = heart(uT * 1.0 + vC.x);
        float body = fbm(q * 1.8), lump = smoothstep(0.45, 0.8, fbm(q * 3.5)), pore = smoothstep(0.72, 0.86, vnoise(q * 8.0));
        float v1 = 1.0 - abs(2.0 * vnoise(q * 3.2 + 2.0) - 1.0), vein = smoothstep(0.90, 0.99, v1);
        float h = body + lump * 0.5 - pore * 0.4;
        vec3 alb = mix(vec3(0.30, 0.05, 0.14), vec3(0.82, 0.30, 0.38), body) * uTint; alb = mix(alb, vec3(0.10, 0.02, 0.06), pore);
        N = bumpN(N, vWP, h, 1.4);
        vec3 L = normalize(vec3(0.3, 0.9, 0.4)); float dif = max(dot(N, L), 0.0) * 0.8 + max(dot(N, normalize(vec3(-0.5, 0.2, -0.6))), 0.0) * 0.25;
        vec3 H = normalize(L + V); float spec = pow(max(dot(N, H), 0.0), 60.0) * 0.8;
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 emi = uVein * vein * (0.35 + 0.9 * beat + uPulse * 0.5) + vec3(1.0, 0.3, 0.3) * pore * (0.1 + 0.4 * beat);
        vec3 c = alb * (0.22 + dif) + vec3(1.0, 0.85, 0.8) * spec + emi + vec3(0.9, 0.35, 0.6) * fr * 0.18;
        c = mix(c, vec3(0.03, 0.05, 0.06), 1.0 - exp(-dist * 0.012));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/* ───────── la estación ───────── */
export function buildStation(T, { level = 'low' } = {}) {
  const hi = level !== 'low';
  const U = { uT: { value: 0 }, uWarp: { value: 0 }, uGrow: { value: 0 }, uPulse: { value: 0 } };
  const group = new T.Group(); group.name = 'estacion';
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const colliders = []; // círculos {x,z,r}

  /* — materiales — */
  const tileMap = track(tileTexture(T)), floorMap = track(floorTexture(T)), concMap = track(concreteTexture(T)), halo = track(haloTex(T));
  const wallMat = track(withWarp(new T.MeshStandardMaterial({ map: tileMap, roughness: 0.55, metalness: 0.05, vertexColors: true }), U));
  const floorMat = track(withWarp(new T.MeshStandardMaterial({ map: floorMap, roughness: 0.7, metalness: 0.02, vertexColors: true }), U));
  const colMat = track(withWarp(new T.MeshStandardMaterial({ map: concMap, roughness: 0.85, color: 0xb8bcbc }), U, true));
  const propMat = track(new T.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2, vertexColors: true }));
  const railMat = track(new T.MeshStandardMaterial({ color: 0xa8aeb6, roughness: 0.35, metalness: 0.7, emissive: 0x15181c }));
  const sleeperMat = track(new T.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 }));
  const tunnelMat = track(new T.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.95, side: T.BackSide }));

  /* — suelo y andenes (un solo mesh) — */
  const fl = [];
  const seg = hi ? 1 : 2; // low: menos subdivisión
  const slab = (w, h, d, x, y, z, col, sx, sz) => { const g = new T.BoxGeometry(w, h, d, sx, 1, sz); g.translate(x, y, z); return prep(T, g, col, 1.2); };
  fl.push(slab(48, 1.3, 7, 0, -0.65, 3.5, 0xffffff, 24 / seg, 4 / seg));         // andén A (tope en y=0)
  fl.push(slab(48, 1.3, 7.2, 0, -0.65, -8.8, 0xdddddd, 24 / seg, 4 / seg));      // andén B
  fl.push(slab(48, 0.3, 5.2, 0, -1.4, -2.6, 0x4a4540, 12, 2));                 // lecho de la vía
  const floorMesh = track(new T.Mesh(mergeGeometries(fl), floorMat)); group.add(floorMesh);

  /* — paredes y techo (segmentados para poder doblarse) — */
  const wl = [];
  const plane = (w, h, sw, sh, pos, rx, ry, col) => { const g = new T.PlaneGeometry(w, h, sw, sh); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(...pos); return prep(T, g, col, 1.2); };
  wl.push(plane(48, 6.65, 24, 8, [0, 2.075, 7], 0, Math.PI, 0xffffff));         // pared del fondo del andén A
  wl.push(plane(48, 6.65, 24, 8, [0, 2.075, -12.4], 0, 0, 0xe8e0d8));           // pared del fondo del andén B
  wl.push(plane(48, 19.4, 24, 10, [0, 5.4, -2.7], Math.PI / 2, 0, 0x9a9d9c));  // techo
  const endWall = (x, ry) => { // pared de cabecera con el hueco del túnel (z∈[-4.6,-0.6], y hasta 3.6)
    wl.push(plane(7.8, 6.65, 2, 3, [x, 2.075, -8.5], 0, ry, 0xb8bcb8));
    wl.push(plane(7.6, 6.65, 2, 3, [x, 2.075, 3.2], 0, ry, 0xb8bcb8));
    wl.push(plane(4.0, 1.8, 1, 1, [x, 4.5, -2.6], 0, ry, 0x9a9d9c));
  };
  endWall(-24, Math.PI / 2); endWall(24, -Math.PI / 2);
  const wallMesh = track(new T.Mesh(mergeGeometries(wl), wallMat)); group.add(wallMesh);

  /* — columnas (pueden retorcerse) — */
  const cl = [];
  for (const x of ST.COLS_X) for (const z of [ST.COL_ZA, ST.COL_ZB]) {
    const g = new T.CylinderGeometry(0.42, 0.46, 6.65, hi ? 20 : 14, hi ? 24 : 14); g.translate(x, 2.075, z); cl.push(g); colliders.push({ x, z: z === ST.COL_ZA ? z : 99, r: 0.55 });
  }
  const colMesh = track(new T.Mesh(mergeGeometries(cl), colMat)); group.add(colMesh);

  /* — utilería (bancos, líneas amarillas, carteles, vigas, bases) con color por vértice — */
  const pr = [], pb = (w, h, d, x, y, z, col) => pr.push(prep(T, new T.BoxGeometry(w, h, d).translate(x, y, z), col, 1));
  pb(48, 0.025, 0.5, 0, 0.0125, 0.32, 0xe6bd1c); pb(48, 0.025, 0.5, 0, 0.0125, -5.45, 0xe6bd1c);                 // franja amarilla de borde
  for (let x = -23; x < 23; x += 1) { pb(0.1, 0.03, 0.5, x, 0.026, 0.32, 0xb89414); pb(0.1, 0.03, 0.5, x, 0.026, -5.45, 0xb89414); } // táctil
  for (const [x, z, rot] of [[-8, 6.45, 0], [6, 6.45, 0], [14.5, 6.45, 0], [-14, -11.9, 1], [3, -11.9, 1]]) {
    const s = rot ? -1 : 1; pb(2.1, 0.07, 0.5, x, 0.5, z, 0x2f6f73); pb(2.1, 0.5, 0.06, x, 0.82, z + 0.22 * s, 0x2f6f73); pb(0.07, 0.5, 0.45, x - 0.95, 0.25, z, 0x222428); pb(0.07, 0.5, 0.45, x + 0.95, 0.25, z, 0x222428);
  }
  for (const x of ST.COLS_X) for (const z of [ST.COL_ZA, ST.COL_ZB]) pb(1.0, 0.35, 1.0, x, 0.175, z, 0x3a3d40);       // bases de columna
  for (let x = -20; x <= 20; x += 8) pb(0.5, 0.4, 19.4, x, 5.18, -2.7, 0x55595b);                                     // vigas del techo
  const rr = rng(77), posterCols = [0xd23a5a, 0x3a7ad2, 0xe0b23a, 0x2fa38a, 0x8a3ad2, 0xd2683a];
  for (let i = 0; i < 9; i++) { const x = -20 + i * 5 + rr() * 1.5; if (Math.abs(x) < 3.2) continue; pb(1.2, 1.7, 0.04, x, 2.2, 6.96, posterCols[i % 6]); pb(1.2, 1.7, 0.04, x + 0.5, 2.2, -12.36, posterCols[(i + 2) % 6]); }
  pb(3.5, 1.9, 0.06, 0, 2.6, 6.93, 0x15181c);                                                                           // marco de la pantalla de horarios
  for (const [x, z] of [[-3, 5.9], [10, 5.9]]) pr.push(prep(T, new T.CylinderGeometry(0.28, 0.25, 0.9, 10).translate(x, 0.45, z), 0x3a4a3a, 1)); // papeleras
  const propMesh = track(new T.Mesh(mergeGeometries(pr), propMat)); group.add(propMesh);

  /* — vías: rieles fusionados + durmientes instanciados — */
  const rl = [];
  for (const z of ST.RAIL_Z) { rl.push(new T.BoxGeometry(168, 0.07, 0.07).translate(0, -0.88, z)); rl.push(new T.BoxGeometry(168, 0.15, 0.035).translate(0, -0.97, z)); rl.push(new T.BoxGeometry(168, 0.03, 0.16).translate(0, -1.04, z)); }
  rl.forEach((g) => { g.deleteAttribute('uv'); }); const railMesh = track(new T.Mesh(mergeGeometries(rl.map((g) => { g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })), railMat)); group.add(railMesh);
  const nSl = hi ? 210 : 140, sleepers = track(new T.InstancedMesh(new T.BoxGeometry(0.22, 0.14, 2.5), sleeperMat, nSl)), dm = new T.Object3D();
  for (let i = 0; i < nSl; i++) { dm.position.set(-84 + i * (168 / nSl), -1.1, ST.TRACK_Z); dm.updateMatrix(); sleepers.setMatrixAt(i, dm.matrix); }
  sleepers.frustumCulled = false; group.add(sleepers);

  /* — túneles (cáscara oscura + lámparas que se encienden al paso del tren) — */
  const shellGeo = new T.BoxGeometry(62, 4.85, 4.0);
  for (const sx of [-1, 1]) { const m = track(new T.Mesh(shellGeo, tunnelMat)); m.position.set(sx * 55, 1.175, ST.TRACK_Z); group.add(m); }
  const tl = hi ? 12 : 9, lampMat = track(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), lamps = track(new T.InstancedMesh(new T.BoxGeometry(0.5, 0.12, 0.18), lampMat, tl * 2)), lampX = [];
  for (let i = 0; i < tl; i++) for (const sx of [-1, 1]) { const x = sx * (28 + i * (hi ? 5 : 6.5)); lampX.push(x); dm.position.set(x, 3.45, ST.TRACK_Z - 1.4); dm.scale.set(1, 1, 1); dm.updateMatrix(); lamps.setMatrixAt(lampX.length - 1, dm.matrix); lamps.setColorAt(lampX.length - 1, new T.Color(0x000000)); }
  lamps.frustumCulled = false; group.add(lamps);

  /* — fluorescentes (instanciados): 30 tubos con parpadeo — */
  const fixRows = [[2.2, 12], [-8.8, 12], [-2.6, 6]], fix = [];
  for (const [z, n] of fixRows) for (let i = 0; i < n; i++) fix.push({ x: n === 6 ? -20 + i * 8 : -22 + i * 4, z, flick: 1, stretch: 0 });
  const fixMat = track(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), fixMesh = track(new T.InstancedMesh(new T.BoxGeometry(1.4, 0.07, 0.22), fixMat, fix.length));
  fixMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); fix.forEach((f, i) => fixMesh.setColorAt(i, new T.Color(1, 1, 1))); fixMesh.frustumCulled = false; group.add(fixMesh);

  /* — pantalla de horarios + carteles (texturas de canvas) — */
  const scrC = document.createElement('canvas'); scrC.width = 512; scrC.height = 256;
  const scrTex = track(new T.CanvasTexture(scrC)); scrTex.colorSpace = T.SRGBColorSpace;
  const screen = track(new T.Mesh(new T.PlaneGeometry(3.2, 1.6), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false }))); screen.position.set(0, 2.6, 6.88); screen.rotation.y = Math.PI; group.add(screen);
  let scrMode = '', scrStamp = -1;
  function drawScreen(mode, t = 0) {
    const g = scrC.getContext('2d'), w = 512, h = 256; g.fillStyle = mode === 'carne' ? '#2a0610' : '#07131a'; g.fillRect(0, 0, w, h);
    g.fillStyle = mode === 'alerta' ? '#ff4040' : '#35e0c8'; g.font = 'bold 34px sans-serif'; g.textBaseline = 'top'; g.fillText('ANDÉN 3', 18, 12);
    g.font = 'bold 30px monospace'; g.textAlign = 'right'; const mm = 42 + Math.floor(t / 60); g.fillText(`18:${String(mm % 60).padStart(2, '0')}`, w - 18, 14); g.textAlign = 'left';
    g.fillStyle = '#183440'; g.fillRect(14, 58, w - 28, 2);
    const rows = mode === 'normal' ? [['18:38', 'CENTRO SUR', 'EN HORA'], ['18:42', 'EXPRESO SIN PARADA', '!'], ['18:47', 'CENTRO SUR', 'EN HORA'], ['18:55', 'CENTRO SUR', 'EN HORA']]
      : mode === 'alerta' ? [['18:42', 'TREN SIN PARADA', '¡CUIDADO!'], ['', 'NO CRUCE LA LÍNEA', ''], ['', 'AMARILLA', ''], ['18:42', '¡¡ ATENCIÓN !!', '']]
        : [['18:42', 'HAY ALGO EN LA VÍA', '??'], ['18:42', 'V 1 V E S', '18:42'], ['18:42', 'NO MIRES A LOS OJOS', ''], ['--:--', 'TODOS SIGUEN AQUÍ', '--']];
    g.font = '24px monospace';
    rows.forEach((r, i) => { const y = 72 + i * 44; const blink = mode !== 'normal' && Math.floor(t * 3) % 2 === 0; g.fillStyle = (mode === 'alerta' && blink) ? '#ffffff' : (mode === 'carne' ? (blink ? '#ff9ac8' : '#c8ffe8') : (i === 1 ? '#ffcf40' : '#a8d8e0')); g.fillText(r[0], 18, y); g.fillText(r[1], 108, y); g.textAlign = 'right'; g.fillText(r[2], w - 18, y); g.textAlign = 'left'; });
    if (mode === 'carne') { for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(${(i * 70) % 255},40,${(i * 30) % 255},.35)`; g.fillRect(((t * 90 + i * 83) % w), (i * 37 + t * 20) % h, 60, 5); } }
    scrTex.needsUpdate = true;
  }
  function setScreen(mode, t = 0) {
    const stamp = mode === 'normal' ? 0 : Math.floor(t * (mode === 'carne' ? 8 : 3));
    if (mode === scrMode && stamp === scrStamp) return; scrMode = mode; scrStamp = stamp; drawScreen(mode, t);
  }
  setScreen('normal', 0);
  // carteles colgantes (un atlas): ANDÉN 3 · SALIDA · CUIDADO
  const signTex = track(canvasTex(T, 512, 256, (g) => {
    g.fillStyle = '#101418'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#ffffff'; g.font = 'bold 64px sans-serif'; g.textBaseline = 'middle'; g.fillText('ANDÉN', 20, 66);
    g.fillStyle = '#e6bd1c'; g.beginPath(); g.arc(400, 64, 50, 0, 6.29); g.fill(); g.fillStyle = '#101418'; g.font = 'bold 74px sans-serif'; g.fillText('3', 380, 68);
    g.fillStyle = '#12703a'; g.fillRect(0, 128, 256, 128); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.fillText('SALIDA ↑', 14, 194);
    g.fillStyle = '#e6bd1c'; g.fillRect(256, 128, 256, 128); g.fillStyle = '#101418'; g.font = 'bold 30px sans-serif'; g.fillText('CUIDADO', 290, 170); g.fillText('BORDE DEL ANDÉN', 270, 214);
  }, false));
  const sg = [], sign = (w, h, x, y, z, u0, v0, u1, v1, ry) => { const g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); if (ry) g.rotateY(ry); g.translate(x, y, z); sg.push(g); };
  for (const x of [-16, -6, 8, 18]) { sign(2.6, 1.3, x, 4.3, 1.03, 0, 0.5, 1, 1, 0); sign(2.6, 1.3, x, 4.3, 0.97, 0, 0.5, 1, 1, Math.PI); pb(0.05, 0.5, 0.05, x - 1.0, 5.15, 1.0, 0x222428); pb(0.05, 0.5, 0.05, x + 1.0, 5.15, 1.0, 0x222428); }
  sign(2.4, 1.2, 22.8, 2.2, 5.4, 0, 0, 0.5, 0.5, -Math.PI / 2); sign(2.4, 1.2, -22.8, 2.2, 5.4, 0, 0, 0.5, 0.5, Math.PI / 2);
  sign(2.4, 1.2, -9, 3.0, 6.94, 0.5, 0, 1, 0.5, Math.PI);
  const signMesh = track(new T.Mesh(mergeGeometries(sg), new T.MeshBasicMaterial({ map: signTex, toneMapped: false, color: 0xe0e0e0 }))); group.add(signMesh);

  /* — público: siluetas fusionadas en un solo mesh — */
  const crowdSpec = [[-6.2, 1.05, 3.1, 0x7a3a8a], [-4.9, 1.25, 3.4, 0xc0b060], [-14, 1.2, 3.0, 0x3a6a8a], [-17, 5.8, 3.2, 0xa04040], [-9.5, 5.6, 0.2, 0x4a8a5a],
    [8, 1.0, 3.4, 0x90a0b0], [6.5, 1.3, 3.3, 0xb08060], [16, 1.1, 0.0, 0x6a5aa0], [-2, 5.6, 0, 0x808890], [-19, 6.0, 3.0, 0xc08a30],
    [-8, -6.2, 0, 0x6aa0a0], [-5.5, -6.1, 0, 0xa06a8a], [2, -6.3, 0, 0x7a8a40], [9, -6.2, 0, 0x4a5a90], [14, -9.5, 0, 0x904a4a], [-16, -6.4, 0, 0x5a7a5a]];
  const nCrowd = hi ? crowdSpec.length : 11, cg = [], rc = rng(31), skins = [0xd8a487, 0xb98060, 0x8a5a3c, 0xf0c8a8];
  for (let i = 0; i < nCrowd; i++) {
    const [x, z, ry, shirt] = crowdSpec[i], sc = 0.94 + rc() * 0.14;
    const parts = personParts(T, { shirt, pants: [0x23262e, 0x3a3328, 0x2a3040][i % 3], skin: skins[i % 4], bag: i % 3 === 0 ? 0x3a3a46 : null, hair: [0x2a211c, 0x6a4a2a, 0x151515, 0x8a8a8a][i % 4] });
    const M = mat4(T, [x, 0, z], ry + (z < -5 ? 0 : (rc() - 0.5)), sc);
    for (const q of parts) { const g = q.g; g.applyMatrix4(new T.Matrix4().makeTranslation(...q.p)); g.applyMatrix4(M); g.deleteAttribute('uv'); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); colorize(T, g, q.c); cg.push(g); }
    colliders.push({ x, z, r: 0.35 });
  }
  const crowdMat = track(new T.MeshStandardMaterial({ roughness: 0.85, vertexColors: true, emissive: 0x000000 })), crowdMesh = track(new T.Mesh(mergeGeometries(cg), crowdMat)); group.add(crowdMesh);

  /* — tejido vivo que «infecta» columnas, paredes, techo y piso — */
  const tg = [], tr = rng(101);
  const addT = (geo, aC, seed, kind) => {
    const n = geo.attributes.position.count, ac = new Float32Array(n * 3), as = new Float32Array(n).fill(seed), ak = new Float32Array(n).fill(kind);
    for (let i = 0; i < n; i++) { ac[i * 3] = aC[0]; ac[i * 3 + 1] = aC[1]; ac[i * 3 + 2] = aC[2]; }
    geo.setAttribute('aC', new T.BufferAttribute(ac, 3)); geo.setAttribute('aSeed', new T.BufferAttribute(as, 1)); geo.setAttribute('aKind', new T.BufferAttribute(ak, 1));
    if (geo.index == null) geo = geo; tg.push(geo);
  };
  for (const x of ST.COLS_X) for (const z of [ST.COL_ZA, ST.COL_ZB]) { // mangas de carne alrededor de cada columna
    const g = new T.CylinderGeometry(0.5, 0.55, 5.4, hi ? 22 : 14, hi ? 26 : 14, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), a = Math.atan2(pz, px), f = 1 + 0.38 * (vnoise3(Math.cos(a) * 1.6 + x, py * 1.1, Math.sin(a) * 1.6 + z) - 0.35) + 0.45 * Math.exp(-(py + 2.7) * 0.9); p.setXYZ(i, px * f, py, pz * f); }
    g.computeVertexNormals(); g.translate(x, 2.7 - 0.0, z); g.deleteAttribute('uv'); addT(g, [x, -0.1, z], tr() * 0.6, 0);
  }
  const nPod = hi ? 40 : 22, nDrip = hi ? 22 : 12, nRidge = hi ? 18 : 10;
  const compose = (p, s, rot = [0, 0, 0]) => new T.Matrix4().compose(new T.Vector3(...p), new T.Quaternion().setFromEuler(new T.Euler(...rot)), new T.Vector3(...s));
  for (let i = 0; i < nPod; i++) { // quistes pegados a las paredes del fondo
    const onA = i % 2 === 0, x = -22 + tr() * 44, y = -0.2 + tr() * 5, r = 0.35 + tr() * 1.1, z = onA ? 6.95 : -12.35;
    const g = new T.SphereGeometry(1, 12, 9); g.applyMatrix4(compose([x, y, z], [r, r * (0.7 + tr() * 0.6), r * 0.55])); g.deleteAttribute('uv'); addT(g, [x, y, z], tr(), 1);
  }
  for (let i = 0; i < nDrip; i++) { // goteras de carne colgando del techo
    const x = -22 + tr() * 44, z = -11 + tr() * 17, len = 0.8 + tr() * 1.8, g = new T.SphereGeometry(1, 10, 8);
    g.applyMatrix4(compose([x, 5.4 - len * 0.5, z], [0.18 + tr() * 0.18, len * 0.5, 0.18 + tr() * 0.18])); g.deleteAttribute('uv'); addT(g, [x, 5.4, z], tr(), 2);
  }
  for (let i = 0; i < nRidge; i++) { // nervaduras en el piso que salen del borde del andén
    const x = -22 + tr() * 44, z = 0.8 + tr() * 4.5, ry = tr() * 3.14, g = new T.SphereGeometry(1, 12, 8);
    g.applyMatrix4(compose([x, 0.05, z], [0.9 + tr() * 1.5, 0.1, 0.16 + tr() * 0.14], [0, ry, 0])); g.deleteAttribute('uv'); addT(g, [x, 0.0, z], tr(), 3);
  }
  const tissueMat = track(fleshMaterial(T, U, U.uGrow)), tissueMesh = track(new T.Mesh(mergeGeometries(tg), tissueMat)); tissueMesh.frustumCulled = false; group.add(tissueMesh);

  /* — luces reales (pocas) — */
  const lights = [];
  const hemi = new T.HemisphereLight(0xc8e0d8, 0x30343a, 0.95); group.add(hemi);
  for (const x of [12, 2, -9, -18]) { const L = new T.PointLight(0xe8fff4, 60, 20, 1.6); L.position.set(x, 4.6, 2.4); group.add(L); lights.push(L); }

  /* — tren (carrocerías fusionadas por material) — */
  const train = buildTrain(T, halo, track);
  train.group.position.set(-80, 0, ST.TRACK_Z); group.add(train.group);

  /* — actualización por cuadro — */
  const col = new T.Color(), tmpM = new T.Object3D();
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  /** ctl: {t, flick 0..1, stretch 0..1, hue 0..1, dark 0..1, trainX} */
  function update(ctl) {
    const t = ctl.t; U.uT.value = t;
    const flick = ctl.flick ?? 0.4, stretch = ctl.stretch ?? 0, hue = ctl.hue ?? 0, dark = ctl.dark ?? 0;
    for (let i = 0; i < fix.length; i++) {
      const f = fix[i]; let v = 1;
      const slot = Math.floor(t * (i === 5 ? 18 : 7)); if (hash(slot + i * 17) > 1 - 0.07 * flick * (i === 5 ? 6 : 1)) v = 0.12 + 0.3 * hash(slot * 3 + i);
      if (i === 17) v *= 0.55 + 0.45 * Math.sin(t * 40);
      v *= 1 - dark * 0.6; f.flick = v;
      const sx = 1 + stretch * (2.5 + 4 * hash(i * 3.1)), sz = 1 + stretch * 0.8;
      tmpM.position.set(f.x, 5.2, f.z); tmpM.scale.set(sx, 1 + stretch * 3, sz); tmpM.rotation.set(0, 0, stretch * 0.4 * Math.sin(i)); tmpM.updateMatrix(); fixMesh.setMatrixAt(i, tmpM.matrix);
      col.setRGB(1.6, 1.7, 1.55).lerp(new T.Color(2.2, 0.35, 1.6), hue).multiplyScalar(v); fixMesh.setColorAt(i, col);
    }
    fixMesh.instanceMatrix.needsUpdate = true; fixMesh.instanceColor.needsUpdate = true;
    lights.forEach((L, i) => { const v = fix[Math.min(fix.length - 1, 1 + i * 3)].flick; L.intensity = (60 + 20 * (1 - dark)) * (0.5 + 0.5 * v) * (1 - dark * 0.6) * (1 - 0.45 * hue); L.color.setHSL(0.45 + 0.4 * hue, 0.5 * (1 - hue) + 0.8 * hue, 0.85 - 0.35 * hue); });
    hemi.intensity = (0.95 - 0.4 * dark) * (1 - 0.4 * hue); hemi.color.setHSL(0.45 + 0.4 * hue, 0.25 + 0.5 * hue, 0.75 - 0.2 * hue);
    // lámparas del túnel: se prenden cuando el tren las ilumina
    const tx = ctl.trainX ?? -999;
    for (let i = 0; i < lampX.length; i++) { const d = Math.abs(lampX[i] - tx), on = Math.max(0, 1 - d / 26); col.setRGB(1.5, 1.35, 1.0).multiplyScalar(0.06 + on * 1.4 * (0.75 + 0.25 * hash(Math.floor(t * 15) + i))); lamps.setColorAt(i, col); }
    lamps.instanceColor.needsUpdate = true;
    crowdMat.emissive.setRGB(0.25 * hue, 0.02, 0.1 * hue);
  }
  function dispose() {
    group.traverse((o) => { if (o.geometry && !(o.geometry.userData || {}).shared) o.geometry.dispose(); });
    for (const d of disposables) d.dispose && d.dispose();
    train.dispose();
  }
  return { group, U, update, setScreen, train, colliders, fixtures: fix, lights, crowdMesh, tissueMesh, floorMesh, halo, dispose, person: (o) => buildPerson(T, o) };
}

/* ───────── el tren ───────── */
function buildTrain(T, halo, track) {
  const group = new T.Group(); group.name = 'tren';
  const L = 12.4, N = 3, paintG = [], darkG = [], winG = [], stripeG = [];
  const B = (arr, w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); g.deleteAttribute('uv'); arr.push(g); return g; };
  for (let i = 0; i < N; i++) {
    const cx = -(i * L + L / 2);
    B(paintG, L - 0.4, 2.8, 2.9, cx, 0.85, 0); B(paintG, L - 1.2, 0.25, 2.4, cx, 2.35, 0);
    B(darkG, L - 1.2, 0.45, 2.4, cx, -0.75, 0); B(darkG, 2.4, 0.5, 2.6, cx - 3.6, -0.78, 0); B(darkG, 2.4, 0.5, 2.6, cx + 3.6, -0.78, 0);
    if (i < N - 1) B(darkG, 0.5, 2.3, 2.3, cx - L / 2, 0.6, 0);
    B(stripeG, L - 0.38, 0.2, 2.93, cx, 0.1, 0);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) B(winG, 1.5, 0.85, 0.03, cx - 4.6 + k * 2.3, 1.25, s * 1.46);
  }
  B(paintG, 1.2, 2.3, 2.7, 0.45, 0.8, 0); // morro
  const wsg = new T.PlaneGeometry(2.3, 1.0); wsg.rotateY(Math.PI / 2); wsg.translate(1.07, 1.35, 0); wsg.deleteAttribute('uv'); winG.push(wsg);
  const mk = (arr, mat) => { const m = new T.Mesh(mergeGeometries(arr.map((g) => { if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })), mat); group.add(m); return m; };
  const paint = track(new T.MeshStandardMaterial({ color: 0xaab4c4, roughness: 0.35, metalness: 0.6, emissive: 0x000000 }));
  const dark = track(new T.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8, metalness: 0.4 }));
  const win = track(new T.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false })), stripe = track(new T.MeshBasicMaterial({ color: 0xff3d9a, toneMapped: false }));
  mk(paintG, paint); mk(darkG, dark); mk(winG, win); mk(stripeG, stripe);
  // faros: dos focos blancos + destellos + cono de luz volumétrico + un SpotLight real
  const hlG = []; for (const z of [-0.95, 0.95]) { const g = new T.SphereGeometry(0.17, 8, 6); g.translate(1.07, 0.1, z); hlG.push(g); }
  const hm = track(new T.MeshBasicMaterial({ color: new T.Color(3, 3, 2.6), toneMapped: false })); group.add(new T.Mesh(mergeGeometries(hlG.map((g) => { g.deleteAttribute('uv'); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })), hm));
  const glare = [];
  for (const z of [-0.95, 0.95]) { const s = new T.Sprite(track(new T.SpriteMaterial({ map: halo, color: 0xfff2d0, blending: T.AdditiveBlending, depthWrite: false, transparent: true }))); s.position.set(1.25, 0.1, z); s.scale.setScalar(2); group.add(s); glare.push(s); }
  const beamMat = track(new T.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
  const beam = new T.Mesh(new T.CylinderGeometry(0.2, 3.4, 42, 16, 1, true), beamMat); beam.rotation.z = -Math.PI / 2; beam.position.set(1.2 + 21, 0.1, 0); group.add(beam);
  const spot = new T.SpotLight(0xfff2d0, 900, 70, 0.55, 0.6, 1.4); spot.position.set(1.3, 0.2, 0); spot.target.position.set(30, -0.8, 0); group.add(spot, spot.target);
  return { group, paint, glare, beam, beamMat, spot, win, stripe, length: L * N, dispose() { } };
}

/* ───────── piezas biológicas: entidad, capullo, umbral, pedestal, organismo de la mano ───────── */
export function buildBio(T, U, halo) {
  const disposables = []; const tr = (o) => { disposables.push(o); return o; };
  const grows = { entity: { value: 0 }, target: { value: 0 }, umbral: { value: 0 }, pedestal: { value: 0 }, hand: { value: 0 } };
  const attr = (geo, aC, seed, kind) => {
    const n = geo.attributes.position.count, ac = new Float32Array(n * 3), as = new Float32Array(n).fill(seed), ak = new Float32Array(n).fill(kind);
    for (let i = 0; i < n; i++) { ac[i * 3] = aC[0]; ac[i * 3 + 1] = aC[1]; ac[i * 3 + 2] = aC[2]; }
    geo.deleteAttribute('uv'); geo.setAttribute('aC', new T.BufferAttribute(ac, 3)); geo.setAttribute('aSeed', new T.BufferAttribute(as, 1)); geo.setAttribute('aKind', new T.BufferAttribute(ak, 1)); return geo;
  };
  const compose = (p, s, rot = [0, 0, 0]) => new T.Matrix4().compose(new T.Vector3(...p), new T.Quaternion().setFromEuler(new T.Euler(...rot)), new T.Vector3(...s));
  const eyeTex = tr(eyeTexture(T)), eyeTex2 = tr(eyeTexture(T, '#ff4fd8'));
  const mkEye = (r, tex) => { const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), tr(new T.MeshBasicMaterial({ map: tex, toneMapped: false }))); m.rotation.y = -Math.PI / 2; const w = new T.Group(); w.add(m); return w; };

  /* entidad: tallo + corola de pétalos + tentáculos + un ojo enorme (local: base en y=-1.25) */
  const eg = [];
  { const st = new T.CylinderGeometry(0.34, 0.7, 4.8, 12, 14), p = st.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = (y + 2.4) / 4.8, f = 1 + 0.18 * Math.sin(k * 14); p.setXYZ(i, p.getX(i) * f, y, p.getZ(i) * f + 0.5 * k * k); }
    st.computeVertexNormals(); st.translate(0, -1.25 + 2.4, 0); eg.push(attr(st, [0, -1.25, 0], 0, 4)); }
  for (let i = 0; i < 8; i++) { // corola: pétalos en abanico alrededor del ojo, mirando hacia +z (el andén)
    const a = (i / 8) * 6.283, g = new T.SphereGeometry(1, 10, 8);
    g.applyMatrix4(compose([Math.cos(a) * 0.95, 3.4 + Math.sin(a) * 0.95, 0.45], [0.3, 0.9, 0.3], [0, 0, a - Math.PI / 2])); eg.push(attr(g, [0, -1.25, 0], 0.1 + i * 0.04, 4)); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.3, g = new T.CylinderGeometry(0.03, 0.12, 2.8, 6, 8), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 1.4; p.setX(k, p.getX(k) + Math.sin(y * 1.6 + i) * 0.25 * y); } g.computeVertexNormals(); g.applyMatrix4(compose([Math.cos(a) * 0.5, 2.4, Math.sin(a) * 0.5 + 0.55], [1, 1, 1], [0, -a, 0.35])); eg.push(attr(g, [0, -1.25, 0], 0.3 + i * 0.05, 4)); }
  const entity = new T.Group(); const entMesh = new T.Mesh(mergeGeometries(eg), tr(fleshMaterial(T, U, grows.entity))); entMesh.frustumCulled = false; entity.add(entMesh);
  const entEye = mkEye(0.62, eyeTex); entEye.position.set(0, 3.4, 0.7); entity.add(entEye);

  /* capullo-blanco: vaina colgante con núcleo brillante y púas de cristal */
  const target = new T.Group(), tg = [];
  { const s = new T.SphereGeometry(0.62, 16, 12); tg.push(attr(s, [0, 0, 0], 0, 4)); const c = new T.CylinderGeometry(0.05, 0.09, 4.2, 6, 1); c.translate(0, 2.2, 0); tg.push(attr(c, [0, 0, 0], 0, 4)); }
  const tMesh = new T.Mesh(mergeGeometries(tg), tr(fleshMaterial(T, U, grows.target, { tint: [1.1, 0.8, 1.2] }))); tMesh.frustumCulled = false; target.add(tMesh);
  const core = new T.Mesh(new T.IcosahedronGeometry(0.3, 1), tr(new T.MeshBasicMaterial({ color: new T.Color(2.4, 0.5, 1.9), toneMapped: false }))); target.add(core);
  const spG = []; for (let i = 0; i < 7; i++) { const g = new T.ConeGeometry(0.09, 0.55, 5); g.translate(0, 0.62 + 0.2, 0); const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3().setFromSphericalCoords(1, 0.5 + i * 0.37, i * 2.4)); g.applyQuaternion(q); g.deleteAttribute('uv'); spG.push(g); }
  const spikes = new T.Mesh(mergeGeometries(spG.map((g) => { g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })), tr(new T.MeshStandardMaterial({ color: 0x2fe6d2, emissive: 0x108a80, roughness: 0.2, metalness: 0.3 }))); target.add(spikes);
  const tHalo = new T.Sprite(tr(new T.SpriteMaterial({ map: halo, color: 0xff55d8, blending: T.AdditiveBlending, depthWrite: false, transparent: true }))); tHalo.scale.setScalar(2.6); target.add(tHalo);

  /* umbral: anillo vivo con una membrana que cambia cuando se abre */
  const umbral = new T.Group(), ug = [];
  { const t = new T.TorusGeometry(1.8, 0.3, 10, 28); ug.push(attr(t, [0, 0, 0], 0, 4)); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, s = new T.SphereGeometry(0.28, 8, 6); s.applyMatrix4(compose([Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0], [1, 1, 1.2])); ug.push(attr(s, [0, 0, 0], 0.05 * i, 4)); } }
  const uMesh = new T.Mesh(mergeGeometries(ug), tr(fleshMaterial(T, U, grows.umbral))); uMesh.frustumCulled = false; umbral.add(uMesh);
  const memU = { uT: U.uT, uOpen: { value: 0 } };
  const mem = new T.Mesh(new T.CircleGeometry(1.62, 40), tr(new T.ShaderMaterial({
    uniforms: memU, side: T.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uOpen; varying vec2 vP; ${NOISE}
      void main(){ float r = length(vP) / 1.62, a = atan(vP.y, vP.x); float sw = fbm(vec3(cos(a) * 1.6 + uT * 0.4, sin(a) * 1.6 - uT * 0.5, r * 3.0 - uT * (0.4 + uOpen * 2.0)));
        vec3 closed = mix(vec3(0.25, 0.02, 0.06), vec3(0.8, 0.12, 0.2), sw) * (0.5 + 0.5 * sin(uT * 2.0 + r * 6.0));
        vec3 open = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.3, 0.9), sw + r * 0.3) * (1.1 + 1.2 * (1.0 - r));
        vec3 c = mix(closed, open, uOpen); gl_FragColor = vec4(c, mix(0.55, 0.92, uOpen) * (1.0 - smoothstep(0.92, 1.0, r))); }`,
  })));
  umbral.add(mem);

  /* pedestal: tronco de carne con un orbe de cristal («el mecanismo») */
  const pedestal = new T.Group(), pg = [];
  { const c = new T.CylinderGeometry(0.4, 0.62, 1.1, 12, 4); c.translate(0, 0.55, 0); pg.push(attr(c, [0, 0, 0], 0, 4)); for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283, g = new T.SphereGeometry(1, 8, 6); g.applyMatrix4(compose([Math.cos(a) * 0.7, 0.18, Math.sin(a) * 0.7], [0.45, 0.2, 0.2], [0, -a, 0])); pg.push(attr(g, [0, 0, 0], 0.1 * i, 4)); } }
  const pMesh = new T.Mesh(mergeGeometries(pg), tr(fleshMaterial(T, U, grows.pedestal))); pMesh.frustumCulled = false; pedestal.add(pMesh);
  const orbMat = tr(new T.MeshStandardMaterial({ color: 0x55ffee, emissive: 0xff2060, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2 }));
  const orb = new T.Mesh(new T.OctahedronGeometry(0.28, 1), orbMat); orb.position.y = 1.55; pedestal.add(orb);
  const pHalo = new T.Sprite(tr(new T.SpriteMaterial({ map: halo, color: 0xff3070, blending: T.AdditiveBlending, depthWrite: false, transparent: true }))); pHalo.position.y = 1.55; pHalo.scale.setScalar(1.8); pedestal.add(pHalo);

  /* organismo simbiótico en la mano (colgado de la cámara) */
  const hand = new T.Group(), hg = [];
  { const f = new T.CylinderGeometry(0.05, 0.075, 0.62, 10, 3); f.rotateX(Math.PI / 2); f.translate(0, 0, 0.1); hg.push(attr(f, [0, 0, -0.1], 0, 5)); // antebrazo
    const b = new T.SphereGeometry(1, 14, 10); b.applyMatrix4(compose([0, 0.055, -0.12], [0.085, 0.07, 0.17])); hg.push(attr(b, [0, 0, -0.1], 0.0, 5)); // cuerpo
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283, c = new T.CylinderGeometry(0.012, 0.028, 0.3, 6, 3), p = c.attributes.position; for (let k = 0; k < p.count; k++) p.setX(k, p.getX(k) + Math.sin((p.getY(k) + 0.15) * 14 + i) * 0.012); c.rotateX(Math.PI / 2); c.applyMatrix4(compose([Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.04 + (i % 2) * 0.1], [1, 1, 1], [0, 0, a])); hg.push(attr(c, [0, 0, -0.1], 0.1 + i * 0.03, 5)); } }
  const hMesh = new T.Mesh(mergeGeometries(hg), tr(fleshMaterial(T, U, grows.hand, { tint: [1.2, 0.9, 0.9] }))); hMesh.frustumCulled = false; hand.add(hMesh);
  const barrelG = new T.ConeGeometry(0.03, 0.34, 6); barrelG.rotateX(-Math.PI / 2); barrelG.translate(0, 0.06, -0.38);
  const barrel = new T.Mesh(barrelG, tr(new T.MeshStandardMaterial({ color: 0x2fe6d2, emissive: 0x20c0b0, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.3 }))); hand.add(barrel);
  const hEye = mkEye(0.028, eyeTex2); hEye.position.set(0, 0.115, -0.1); hEye.rotation.x = -1.0; hand.add(hEye);
  const muzzle = new T.Object3D(); muzzle.position.set(0, 0.06, -0.55); hand.add(muzzle);
  const hSprite = new T.Sprite(tr(new T.SpriteMaterial({ map: halo, color: 0x66fff0, blending: T.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false }))); hSprite.position.copy(muzzle.position); hSprite.scale.setScalar(0.0); hand.add(hSprite);
  hand.position.set(0.3, -0.27, -0.42); hand.rotation.set(0.03, 0.12, 0); hand.scale.setScalar(0.75);
  return { grows, entity, entEye, target, targetCore: core, targetHalo: tHalo, umbral, umbralMem: memU, pedestal, orb, orbMat, pHalo, hand, handBarrel: barrel, handEye: hEye, muzzle, handFlash: hSprite, dispose() { for (const d of disposables) d.dispose && d.dispose(); [entity, target, umbral, pedestal, hand].forEach((g) => g.traverse((o) => o.geometry && o.geometry.dispose())); } };
}
