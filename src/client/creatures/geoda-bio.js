// BIO-KIT de Fondal para las criaturas pulidas (astilla, geoda, prisma, lente, cuarzo, espejo, racimo).
// Todo procedural, sin assets: geometría (tubos con radio variable, placas de quitina, cristales facetados, elipsoides con
// ruido), un ESQUELETO real (THREE.Bone/SkinnedMesh: todo el cuerpo en 1 draw call por material y las articulaciones se
// doblan suaves), materiales PBR con textura procedural triplanar (placas, escamas, piel, venas) + normal/bump, ojos con
// iris/pupila dibujados por shader + párpados que cubren de verdad la esfera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from '../quality.js';
import { uTime } from '../shaders.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, Y = new V3(0, 1, 0);
export { THREE, TAU };
export const lod = () => { const h = cfg().humans; return { low: h === 'low', med: h === 'medium', hi: h === 'high', k: h === 'low' ? 0 : h === 'medium' ? 1 : 2 }; };
export const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v), L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const v3 = (p) => (p && p.isVector3 ? p : new V3(p[0], p[1], p[2]));

/* ═════════════════════════ TEXTURAS PROCEDURALES (DataTexture, triplanar) ═════════════════════════
 * Canal R = altura (celdas con centro alto y junturas hundidas), G = tono por celda, B = juntura, A = red de venas. */
const texCache = new Map(), gradCache = new Map();
function voronoi(c, jit, x, y, seed) {   // devuelve [F1, F2, idCelda] en un toro (teselable)
  const px = x * c, py = y * c, ix = Math.floor(px), iy = Math.floor(py); let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = ((cx % c) + c) % c, wy = ((cy % c) + c) % c;
    const hx = hash3(wx, wy, seed), hy = hash3(wx, wy, seed + 17);
    const dx = cx + 0.5 + (hx - 0.5) * jit - px, dy = cy + 0.5 + (hy - 0.5) * jit - py, d = Math.sqrt(dx * dx + dy * dy);
    if (d < f1) { f2 = f1; f1 = d; id = hash3(wx, wy, seed + 5); } else if (d < f2) f2 = d;
  }
  return [f1, f2, id];
}
export const procGrad = (kind) => { procTex(kind); return gradCache.get(kind + (lod().hi ? 'H' : '')); };
export function procTex(kind = 'plates') {
  const ck = kind + (lod().hi ? 'H' : ''); if (texCache.has(ck)) return texCache.get(ck);
  const P = { plates: { c: 4, jit: 0.9, seam: 0.05, vc: 4, nz: 0.5 }, scales: { c: 13, jit: 0.45, seam: 0.16, vc: 7, nz: 0.3 }, skin: { c: 5, jit: 1, seam: 0.5, vc: 4, nz: 0.9 }, fine: { c: 10, jit: 1, seam: 0.05, vc: 6, nz: 1.0 }, shell: { c: 4, jit: 0.8, seam: 0.07, vc: 3, nz: 0.4 }, flesh: { c: 3, jit: 1, seam: 0.0, vc: 3, nz: 1 } }[kind] || {};
  const N = lod().hi ? 512 : 256, data = new Uint8Array(N * N * 4), tn = (x, y, f, s) => { // ruido teselable
    const xs = x * f, ys = y * f, xi = Math.floor(xs), yi = Math.floor(ys), fx = xs - xi, fy = ys - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), m = Math.round(f);
    const h = (a, b) => hash3(((a % m) + m) % m, ((b % m) + m) % m, s);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, [f1, f2, id] = voronoi(P.c, P.jit, u, v, 3), d = f2 - f1;
    const seam = 1 - smooth(0, P.seam, d), fn = tn(u, v, 8, 9) * 0.5 + tn(u, v, 16, 11) * 0.3 + tn(u, v, 32, 13) * 0.2;
    let h = (1 - seam) * (0.55 + 0.45 * (1 - clamp(f1 * 1.5, 0, 1)));
    if (kind === 'scales') h = (1 - seam) * (0.35 + 0.65 * clamp((v * P.c - Math.floor(v * P.c)) * 1.0 + (hash3(Math.floor(u * P.c), 0, 3) - 0.5) * 0.2, 0, 1));
    h = clamp(h * (1 - P.nz * 0.25) + fn * P.nz * 0.35, 0, 1);
    let seamV = seam, idV = id;
    if (kind === 'flesh') { const n1 = tn(u, v, 4, 41), n2 = tn(u, v, 8, 43), n3 = tn(u, v, 16, 47), r = 1 - Math.abs(2 * tn(u, v, 6, 51) - 1), r2 = 1 - Math.abs(2 * tn(u, v, 12, 53) - 1); h = clamp(n1 * 0.45 + n2 * 0.3 + n3 * 0.25, 0, 1); seamV = clamp(smooth(0.8, 0.97, r) * 0.9 + smooth(0.86, 0.98, r2) * 0.5, 0, 1); idV = n2 * 0.6 + n3 * 0.4; }
    const [g1, g2] = voronoi(P.vc, 1, u + 0.31, v + 0.17, 21), vd = g2 - g1, wob = (tn(u, v, 12, 31) - 0.5) * 0.18;
    const vein = 1 - smooth(0.0, kind === 'flesh' ? 0.035 : 0.055, Math.abs(vd + wob));
    const o = (y * N + x) * 4; data[o] = h * 255; data[o + 1] = (kind === 'flesh' ? idV : 0.55 * idV + 0.45 * fn) * 255; data[o + 2] = seamV * 255; data[o + 3] = vein * 255;
  }
  { const gd = new Uint8Array(N * N * 4), H = (x, y) => data[((((y % N) + N) % N) * N + (((x % N) + N) % N)) * 4];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const du = (H(x + 1, y) - H(x - 1, y)) / 255 * 0.5 * N, dv = (H(x, y + 1) - H(x, y - 1)) / 255 * 0.5 * N, o = (y * N + x) * 4; gd[o] = clamp(0.5 + du / 24, 0, 1) * 255; gd[o + 1] = clamp(0.5 + dv / 24, 0, 1) * 255; gd[o + 2] = 0; gd[o + 3] = 255; }
    const gt = new THREE.DataTexture(gd, N, N, THREE.RGBAFormat); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.magFilter = THREE.LinearFilter; gt.minFilter = THREE.LinearMipmapLinearFilter; gt.generateMipmaps = true; gt.anisotropy = 4; gt.needsUpdate = true; gradCache.set(ck, gt); }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  texCache.set(ck, t); return t;
}

/* ═════════════════════════ MATERIALES ═════════════════════════ */
const NOISE_GLSL = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }`;
const BUMP_GLSL = `
  vec3 perturbN(vec3 sp, vec3 sn, vec2 dh, float fd){ vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 r1 = cross(sy, sn), r2 = cross(sn, sx); float det = dot(sx, r1) * fd;
    vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * sn - g); }
  vec4 triTex(sampler2D t, vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(5.0)); w /= (w.x + w.y + w.z + 1e-4);
    return texture2D(t, p.yz) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z; }`;

/**
 * Material bio (quitina, hueso, carne, cristal opaco...). Se usa con geometría con atributo `color` (tinte por vértice).
 * Opciones: color, rough, metal, clear (clearcoat), sheen, tex ('plates'|'scales'|'skin'|'fine'|'shell'), tile, bump, grain,
 * seam (color de la juntura) seamK, vein (color de venas) veinK veinGlow, sss (translucidez de borde) sssColor, glow/glowColor,
 * alpha, iri, bend (agita cilios por shader: atributos aK/aPh), lid (párpado: recorte por uniformes uUp/uLo/uSl).
 * Uniformes vivos en mat.userData.u: uHurt, uGlow, uSss, uVeinGlow, uUp, uLo, uSl.
 */
export function bio(o = {}) {
  const L = lod(), Cls = L.low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const { color = 0xffffff, rough = 0.5, metal = 0, clear = 0, clearRough = 0.25, sheen = 0, tex = 'plates', tile = 1.6, bump = 1, grain = 0.4, seam = 0x000000, seamK = 0.5, vein = 0x000000, veinK = 0, veinGlow = 0, seamGlow = 0, sss = 0, sssColor = 0xff6a5a, glow = 0, glowColor = 0xffffff, alpha = 1, iri = 0, bend = false, lid = false, vcol = true, texOff = 0, side = null, rv = 0.5, env = 1 } = o;
  const m = new Cls({ color, roughness: rough, metalness: metal, vertexColors: vcol, transparent: alpha < 1, opacity: alpha, side: side != null ? side : alpha < 1 ? THREE.DoubleSide : THREE.FrontSide });
  if (alpha < 1) m.depthWrite = false; m.envMapIntensity = env;
  if (!L.low) { if (clear) { m.clearcoat = clear; m.clearcoatRoughness = clearRough; } if (sheen) { m.sheen = sheen; m.sheenColor = new THREE.Color(sssColor).lerp(new THREE.Color(1, 1, 1), 0.5); m.sheenRoughness = 0.5; } if (iri) { m.iridescence = iri; m.iridescenceIOR = 1.5; m.iridescenceThicknessRange = [180, 620]; } }
  const u = { uHurt: { value: 0 }, uGlow: { value: glow }, uSss: { value: sss }, uVeinGlow: { value: veinGlow }, uSeamGlow: { value: seamGlow }, uUp: { value: 0.6 }, uLo: { value: 0.4 }, uSl: { value: 0 }, uTime, uAmp: { value: 0.05 }, uSpd: { value: 2.0 } };
  const un = { uTex: { value: procTex(tex) }, uGrad: { value: procGrad(tex) }, uTile: { value: tile }, uBump: { value: bump * (L.low ? 0.5 : 1) }, uGrain: { value: grain }, uSeam: { value: new THREE.Color(seam) }, uSeamK: { value: seamK }, uVeinC: { value: new THREE.Color(vein) }, uVeinK: { value: veinK }, uSssC: { value: new THREE.Color(sssColor) }, uGlowC: { value: new THREE.Color(glowColor) }, uRV: { value: rv }, uTexOff: { value: texOff } };
  m.userData.u = u; Object.assign(m.userData, { un });
  m.customProgramCacheKey = () => `bio${bend ? 'b' : ''}${lid ? 'l' : ''}${L.low ? 'L' : ''}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, un);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vP; varying vec3 vN; varying vec3 vAx; varying vec3 vAy; varying vec3 vAz; ${bend ? 'attribute float aK; attribute float aPh; uniform float uTime,uAmp,uSpd;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvP = position; vN = normal;\n#ifdef USE_SKINNING\n mat3 skm = mat3(skinMatrix);\n#else\n mat3 skm = mat3(1.0);\n#endif\n mat3 vmm = normalMatrix * skm; vAx = vmm[0]; vAy = vmm[1]; vAz = vmm[2];${bend ? '\n float bw = aK * aK; transformed.x += sin(uTime * uSpd + aK * 3.0 + aPh) * uAmp * bw; transformed.z += cos(uTime * uSpd * 0.8 + aK * 3.7 + aPh) * uAmp * 0.7 * bw;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vP; varying vec3 vN; varying vec3 vAx; varying vec3 vAy; varying vec3 vAz; uniform sampler2D uTex; uniform sampler2D uGrad; uniform float uTime,uTile,uBump,uGrain,uSeamK,uVeinK,uHurt,uGlow,uSss,uVeinGlow,uSeamGlow,uRV,uTexOff,uUp,uLo,uSl; uniform vec3 uSeam,uVeinC,uSssC,uGlowC; ${NOISE_GLSL} ${BUMP_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float lidE = 1.0;
        ${lid ? `{ vec3 dd = normalize(vP); if (dd.z > -0.15) { float cx = dd.x * dd.x; float up = uUp - 0.55 * cx + uSl * dd.x; float lo = uLo - 0.4 * cx - uSl * 0.5 * dd.x; lidE = min(up - dd.y, dd.y + lo); if (lidE > 0.0) discard; lidE = -lidE; } }` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 nO = normalize(vN); vec3 pp = vP * uTile + uTexOff; vec4 tx = triTex(uTex, pp, nO);
        diffuseColor.rgb *= mix(1.0, 0.62 + 0.76 * tx.g, uGrain);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSeam, tx.b * uSeamK);
        diffuseColor.rgb = mix(diffuseColor.rgb, uVeinC, tx.a * uVeinK);
        ${lid ? 'diffuseColor.rgb *= 0.55 + 0.45 * smoothstep(0.0, 0.05, lidE);' : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.55 + 0.9 * tx.g, uRV) * (1.0 - 0.45 * tx.b * uSeamK) + (0.5 * uSeamK * tx.b), 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 wts = pow(abs(nO), vec3(5.0)); wts /= (wts.x + wts.y + wts.z + 1e-4);
          vec2 gx = (texture2D(uGrad, pp.yz).rg * 2.0 - 1.0) * 12.0, gy = (texture2D(uGrad, pp.xz).rg * 2.0 - 1.0) * 12.0, gz = (texture2D(uGrad, pp.xy).rg * 2.0 - 1.0) * 12.0;
          vec3 g = vec3(0.0, gx) * wts.x + vec3(gy.x, 0.0, gy.y) * wts.y + vec3(gz.x, gz.y, 0.0) * wts.z; g *= uBump * uTile * 0.045; g -= nO * dot(g, nO);
          normal = normalize(normal - (g.x * vAx + g.y * vAy + g.z * vAz)); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); float rim = pow(1.0 - nv, 2.4);
          float pl = 0.6 + 0.4 * sin(uTime * 3.0 + vP.y * 5.0 + vP.x * 3.0);
          totalEmissiveRadiance += uSssC * uSss * rim + uGlowC * uGlow * (0.4 + 0.6 * pl) + uVeinC * uVeinGlow * tx.a * uVeinK * pl * 2.0 + uSeam * uSeamGlow * tx.b * (0.55 + 0.45 * pl) + vec3(1.0, 0.85, 0.7) * uHurt * 0.9; }`);
  };
  return m;
}

/** Cristal translúcido emisivo (biocristal): se pinta con vértice-color para variar el tono. */
export function crystalMat(color = 0x66ffee, { glow = 0.8, alpha = 0.9, clear = 1 } = {}) {
  const L = lod(), Cls = L.low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const m = new Cls({ color, roughness: 0.1, metalness: 0.1, transparent: true, opacity: alpha, vertexColors: true, flatShading: true, emissive: new THREE.Color(color), emissiveIntensity: glow });
  if (!L.low) { m.iridescence = 1; m.iridescenceIOR = 1.7; m.iridescenceThicknessRange = [250, 800]; m.clearcoat = clear; m.clearcoatRoughness = 0.05; }
  m.depthWrite = alpha >= 0.98;
  const u = { uHurt: { value: 0 }, uGlow: { value: glow } }; m.userData.u = u;
  m.customProgramCacheKey = () => 'crys' + (L.low ? 'L' : '');
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHurt;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0,0.85,0.7) * uHurt * 0.8;'); };
  return m;
}
export const glowSet = (m, v) => { if (m.emissiveIntensity !== undefined && m.emissive && m.userData.u && m.userData.u.uGlow) m.emissiveIntensity = v; else if (m.userData.u && m.userData.u.uGlow) m.userData.u.uGlow.value = v; };

/* ═════════════════════════ GEOMETRÍA ═════════════════════════ */
function finish(g) { if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
/** Aplica posición/orientación/escala a una geometría (clona). dir: hacia dónde apunta +Y. */
export function place(geo, { pos = [0, 0, 0], dir = null, spin = 0, scale = 1, quat = null } = {}) {
  const g = geo.clone(), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  if (quat) q.copy(quat); else if (dir) { q.setFromUnitVectors(Y, v3(dir).clone().normalize()); if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin)); } else if (spin) q.setFromAxisAngle(Y, spin);
  const s = typeof scale === 'number' ? new V3(scale, scale, scale) : v3(scale);
  m.compose(v3(pos), q, s); g.applyMatrix4(m); return g;
}
/** Cuaternión que lleva Y→up y Z→fwd (proyectado). */
export function orient(up, fwd) { const y = v3(up).clone().normalize(), z = v3(fwd).clone(); z.addScaledVector(y, -z.dot(y)); if (z.lengthSq() < 1e-6) z.set(0, 0, 1).addScaledVector(y, -y.z); z.normalize(); const x = new V3().crossVectors(y, z); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); }
/** Muestreador de curva. */
export function path(pts) { const c = new THREE.CatmullRomCurve3(pts.map(v3), false, 'centripetal'); return { at: (t) => c.getPointAt(t), tan: (t) => c.getTangentAt(t), curve: c }; }
/** Espeja en X (para pares simétricos) corrigiendo el giro de las caras. */
export function mirrorX(geo) {
  const g = geo.clone(); g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  if (g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; }
  else for (const k of Object.keys(g.attributes)) { const a = g.attributes[k], n = a.itemSize, arr = a.array; for (let i = 0; i < a.count; i += 3) for (let c = 0; c < n; c++) { const t = arr[(i + 1) * n + c]; arr[(i + 1) * n + c] = arr[(i + 2) * n + c]; arr[(i + 2) * n + c] = t; } }
  return g;
}
/** Elipsoide con ruido de superficie (músculo, bulto) y normales analíticas. r=[rx,ry,rz]. y0/y1 recortan (0..1) para cúpulas. */
export function ellipsoid(r = [1, 1, 1], { w = 14, h = 10, noise = 0, freq = 2, seed = 1, theta = null, pos = null, dir = null, spin = 0, flat = 0 } = {}) {
  const L = lod(); const sg = theta ? new THREE.SphereGeometry(1, w, h, 0, TAU, theta[0], theta[1]) : new THREE.SphereGeometry(1, w, h);
  const P = sg.attributes.position, Nn = sg.attributes.normal, p = new V3(), n = new V3(); const sx = seed * 7.3;
  const f = (x, y, z) => noise3(x * freq + sx, y * freq + 3.1, z * freq + 7.7) - 0.5;
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i); n.fromBufferAttribute(Nn, i);
    let k = 0; if (noise) { k = f(p.x, p.y, p.z) * noise; const e = 0.05, gx = (f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z)) / (2 * e), gy = (f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z)) / (2 * e), gz = (f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e)) / (2 * e); const gd = gx * n.x + gy * n.y + gz * n.z; n.x -= (gx - gd * n.x) * noise * 0.9; n.y -= (gy - gd * n.y) * noise * 0.9; n.z -= (gz - gd * n.z) * noise * 0.9; }
    const s = 1 + k; P.setXYZ(i, p.x * s * r[0], p.y * s * r[1], p.z * s * r[2]);
    n.set(n.x / r[0], n.y / r[1], n.z / r[2]).normalize(); Nn.setXYZ(i, n.x, n.y, n.z);
  }
  finish(sg); sg.computeBoundingSphere();
  return (pos || dir || spin) ? place(sg, { pos: pos || [0, 0, 0], dir, spin }) : sg;
}
/**
 * Tubo con radio variable a lo largo de una curva Catmull-Rom (columna, cuello, cola, patas, cuernos curvos, tentáculos).
 * rad: número | [r0,r1] | fn(t). ex=[ancho,alto] elipticidad; bulge(t,a) multiplica el radio (vértebras, músculo, costillas).
 */
export function tube(pts, { rad = 0.1, seg = 12, sides = 8, ex = [1, 1], bulge = null, caps = true, up = [0, 1, 0], tension = 'centripetal', flat = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(v3), false, tension), rf = typeof rad === 'function' ? rad : Array.isArray(rad) ? (t) => lerp(rad[0], rad[1], t) : () => rad;
  const pos = [], idx = [], n0 = new V3(), T = new V3(), N = new V3(), B = new V3(), P = new V3(); const upv = v3(up).clone().normalize();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; curve.getPointAt(t, P); curve.getTangentAt(t, T);
    if (i === 0) { N.copy(upv).addScaledVector(T, -upv.dot(T)); if (N.lengthSq() < 1e-4) N.set(1, 0, 0).addScaledVector(T, -T.x); N.normalize(); } else { N.addScaledVector(T, -N.dot(T)).normalize(); }
    B.crossVectors(T, N); const r = rf(t);
    for (let j = 0; j < sides; j++) { const a = (j / sides) * TAU, m = bulge ? bulge(t, a) : 1, c = Math.cos(a) * r * ex[0] * m, s = Math.sin(a) * r * ex[1] * m; pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides, c = (i + 1) * sides + j, d = (i + 1) * sides + (j + 1) % sides; idx.push(a, b, c, b, d, c); }
  if (caps) for (const end of [0, 1]) { const t = end, r = rf(t); if (r < 1e-3) continue; curve.getPointAt(t, P); const ci = pos.length / 3; pos.push(P.x, P.y, P.z); const base = end ? seg * sides : 0; for (let j = 0; j < sides; j++) { const a = base + j, b = base + (j + 1) % sides; if (end) idx.push(ci, b, a); else idx.push(ci, a, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); if (flat) { const f = g.toNonIndexed(); f.computeVertexNormals(); return f; } return g;
}
/** Cuerno/espina curva: tubo que se afina a la punta. bend en la dirección `bendDir` (local, Y es el eje). */
export function spike(r = 0.1, h = 0.6, { sides = 5, seg = 4, bend = 0, bendDir = [1, 0, 0], pos = [0, 0, 0], dir = [0, 1, 0], spin = 0, pow = 1, base = 1 } = {}) {
  const bd = v3(bendDir), pts = []; for (let i = 0; i <= 3; i++) { const t = i / 3; pts.push(new V3(bd.x * bend * t * t * h, t * h, bd.z * bend * t * t * h)); }
  const g = tube(pts, { rad: (t) => r * Math.pow(1 - t, pow) * (t < 0.05 ? 0.6 + t * 8 : 1) * (base), seg, sides, caps: false });
  return place(g, { pos, dir, spin });
}
/** Placa/escudo de quitina: cúpula con borde recto (falda), forma de escudo. w=ancho, l=largo, h=alto; curve dobla el largo. */
export function plate({ w = 0.3, l = 0.4, h = 0.08, nr = 3, ns = 9, pow = 1.6, pt = 0.25, curve = 0, keel = 0, skirt = 0.02, wrap = 0, quat = null, pos = [0, 0, 0], dir = [0, 1, 0], spin = 0, col = 0xffffff, col2 = null, rimK = 0.6 } = {}) {
  const P = [], I = [];
  P.push(0, h, 0);
  const prof = (a) => 1 + pt * Math.max(0, Math.cos(a)) ** 2 - 0.12 * Math.max(0, -Math.cos(a)) ** 2;   // punta delantera (escudo)
  for (let k = 1; k <= nr; k++) for (let j = 0; j < ns; j++) {
    const a = (j / ns) * TAU, rr = (k / nr) * prof(a), x = Math.sin(a) * rr * w, z = Math.cos(a) * rr * l;
    const y = h * (1 - Math.pow(k / nr, pow)) + keel * h * Math.exp(-(x * x) / (w * w * 0.08)) * (1 - k / nr) + curve * z * z - wrap * x * x;
    P.push(x, y, z);
  }
  const rim = nr * ns + 1 - ns;   // índice del primer vértice del anillo exterior
  for (let j = 0; j < ns; j++) { const o = (nr - 1) * ns + 1 + j; P.push(P[o * 3], P[o * 3 + 1] - h * 0 - skirt - h * 0.35, P[o * 3 + 2]); }
  const sk = 1 + nr * ns;
  for (let j = 0; j < ns; j++) I.push(0, 1 + (j + 1) % ns, 1 + j);
  for (let k = 0; k < nr - 1; k++) for (let j = 0; j < ns; j++) { const a = 1 + k * ns + j, b = 1 + k * ns + (j + 1) % ns, c = 1 + (k + 1) * ns + j, d = 1 + (k + 1) * ns + (j + 1) % ns; I.push(a, b, c, b, d, c); }
  for (let j = 0; j < ns; j++) { const a = rim + j, b = rim + (j + 1) % ns, c = sk + j, d = sk + (j + 1) % ns; I.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  { const c0 = new THREE.Color(col), c2 = new THREE.Color(col2 != null ? col2 : col), c = new THREE.Color(), cc = new Float32Array((P.length / 3) * 3); for (let i = 0; i < P.length / 3; i++) { const e = i === 0 ? 0 : i <= nr * ns ? Math.pow(Math.ceil(i / ns) / nr, 2.5) : 1, k = i <= nr * ns ? 1 : rimK; c.copy(c0).lerp(c2, e); cc[i * 3] = c.r * k; cc[i * 3 + 1] = c.g * k; cc[i * 3 + 2] = c.b * k; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  return place(g, { pos, dir, spin, quat });
}
/** Biocristal facetado (prisma hexagonal con punta); lean inclina la punta; jitter lo hace irregular. */
export function crystal(r = 0.05, h = 0.3, { sides = 6, taper = 0.8, tip = 0.3, lean = 0, jitter = 0.18, seed = 1, pos = [0, 0, 0], dir = [0, 1, 0], spin = 0, c0 = 0x1a6a70, c1 = 0xd8ffff } = {}) {
  const R = rng(seed * 91 + 5), P = [], I = [], sd = Math.max(3, sides);
  for (let j = 0; j < sd; j++) { const a = (j / sd) * TAU, k = 1 + (R() - 0.5) * jitter * 2; P.push(Math.cos(a) * r * k, 0, Math.sin(a) * r * k); }
  for (let j = 0; j < sd; j++) { const a = (j / sd) * TAU, k = 1 + (R() - 0.5) * jitter * 2; P.push(Math.cos(a) * r * taper * k + lean * h * 0.3, h * (1 - tip), Math.sin(a) * r * taper * k); }
  P.push(lean * h, h, 0);
  for (let j = 0; j < sd; j++) { const a = j, b = (j + 1) % sd; I.push(a, b, sd + a, b, sd + b, sd + a, sd + a, sd + b, 2 * sd, ); }
  for (let j = 1; j < sd - 1; j++) I.push(0, j + 1, j);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); const ng = g.toNonIndexed(); ng.computeVertexNormals(); { const A = new THREE.Color(c0), B = new THREE.Color(c1), t = new THREE.Color(), PP = ng.attributes.position, cc = new Float32Array(PP.count * 3); for (let i = 0; i < PP.count; i++) { t.copy(A).lerp(B, Math.pow(clamp(PP.getY(i) / h, 0, 1), 1.3)); cc[i * 3] = t.r; cc[i * 3 + 1] = t.g; cc[i * 3 + 2] = t.b; } ng.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  return place(ng, { pos, dir, spin });
}
/** Racimo de cristales brotando de un punto (con lógica: uno grande al centro y más chicos inclinados hacia afuera). */
export function crystalCluster(n, r, h, { pos = [0, 0, 0], dir = [0, 1, 0], seed = 1, spread = 0.5, sides = 6, c0, c1 } = {}) {
  const R = rng(seed), out = [], d = v3(dir).clone().normalize(), q = new THREE.Quaternion().setFromUnitVectors(Y, d);
  for (let i = 0; i < n; i++) {
    const big = i === 0, k = big ? 1 : 0.35 + R() * 0.5, a = R() * TAU, tilt = big ? 0.05 : spread * (0.5 + R() * 0.7);
    const local = new V3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)).applyQuaternion(q);
    const off = big ? new V3() : new V3(Math.cos(a) * r * 1.4, 0, Math.sin(a) * r * 1.4).applyQuaternion(q);
    out.push(crystal(r * k, h * k * (0.8 + R() * 0.4), { sides, lean: (R() - 0.5) * 0.25, seed: seed * 13 + i, c0, c1, pos: new V3().copy(v3(pos)).add(off).addScaledVector(d, -0.03 * h), dir: local, spin: R() * 3 }));
  }
  return out;
}
/** Color de vértice: valor fijo o función (p,n)→Color/hex. Opción ao(p,n)→0..1 multiplica. */
export function paint(geo, col, ao = null) {
  const P = geo.attributes.position, N = geo.attributes.normal, c = new Float32Array(P.count * 3), p = new V3(), n = new V3(), t = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i); if (N) n.fromBufferAttribute(N, i);
    const v = typeof col === 'function' ? col(p, n, i) : col; t.set(v); const k = ao ? ao(p, n, i) : 1;
    c[i * 3] = t.r * k; c[i * 3 + 1] = t.g * k; c[i * 3 + 2] = t.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
export const gradient = (c0, c1, axis, a0, a1) => { const A = new THREE.Color(c0), B = new THREE.Color(c1), t = new THREE.Color(); return (p) => t.copy(A).lerp(B, smooth(a0, a1, p[axis])); };

/* ═════════════════════════ ESQUELETO ═════════════════════════ */
const _c = new THREE.Color();
/** Pesos rígidos: todo el vértice al hueso. */
export function skinRigid(geo, bone) {
  const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = bone.userData.idx; sw[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); return geo;
}
/** Pesos a lo largo de una cadena de huesos (columna, pata, cola, tallo): cada hueso manda entre su articulación y la siguiente, con mezcla suave de ±blend. */
export function skinChain(geo, bones, blend = 0.12, { tail = true } = {}) {
  const n = geo.attributes.position.count, P = geo.attributes.position, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), J = bones.map((b) => b.userData.rest), p = new V3();
  const cum = [0]; for (let i = 1; i < J.length; i++) cum.push(cum[i - 1] + J[i].distanceTo(J[i - 1]));
  const segDir = []; for (let i = 0; i < J.length; i++) { const a = J[i], b = i < J.length - 1 ? J[i + 1] : null; segDir.push(b ? b.clone().sub(a).normalize() : segDir[i - 1].clone()); }
  for (let v = 0; v < n; v++) {
    p.fromBufferAttribute(P, v);
    // proyección sobre la polilínea: busca el segmento más cercano
    let best = 1e9, c = 0; for (let i = 0; i < J.length - 1; i++) { const a = J[i], d = segDir[i], len = cum[i + 1] - cum[i], s = clamp(p.clone().sub(a).dot(d), 0, len), dd = a.clone().addScaledVector(d, s).distanceToSquared(p); if (dd < best) { best = dd; c = cum[i] + s; } }
    if (tail && J.length > 1) { const i = J.length - 1, s = p.clone().sub(J[i]).dot(segDir[i]); if (s > 0) { const dd = J[i].clone().addScaledVector(segDir[i], s).distanceToSquared(p); if (dd < best) { best = dd; c = cum[i] + s; } } }
    const t = [1]; for (let j = 1; j < J.length; j++) t.push(smooth(cum[j] - blend, cum[j] + blend, c)); t.push(0);
    const w = []; for (let j = 0; j < J.length; j++) w.push(t[j] * (1 - t[j + 1]));
    const ord = w.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, 4); const sum = ord.reduce((s, o) => s + o[0], 0) || 1;
    for (let k = 0; k < 4; k++) { const o = ord[k] || [0, 0]; si[v * 4 + k] = bones[o[1]].userData.idx; sw[v * 4 + k] = o[0] / sum; }
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); return geo;
}
/** Pesos por función: fn(p) → [[hueso, peso], ...]. */
export function skinFn(geo, fn) {
  const n = geo.attributes.position.count, P = geo.attributes.position, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = new V3();
  for (let v = 0; v < n; v++) { p.fromBufferAttribute(P, v); const l = fn(p).filter((x) => x[1] > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4), s = l.reduce((a, b) => a + b[1], 0) || 1; l.forEach((o, k) => { si[v * 4 + k] = o[0].userData.idx; sw[v * 4 + k] = o[1] / s; }); }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); return geo;
}

/** Unifica atributos (position, normal, color, skinIndex, skinWeight, aK, aPh) y funde. */
export function join(geos) {
  const out = geos.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); const n = g.attributes.position.count;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight', 'aK', 'aPh'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (!g.attributes.aK) g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n), 1));
    if (!g.attributes.aPh) g.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  });
  const g = mergeGeometries(out, false); g.computeBoundingSphere(); return g;
}
/** Añade atributos de agitación (aK = 0 base .. 1 punta a lo largo de Y local→ usa fn) a una geometría. */
export function bendAttr(geo, fn, phase = 0) {
  const n = geo.attributes.position.count, k = new Float32Array(n), ph = new Float32Array(n), p = new V3(); for (let i = 0; i < n; i++) { p.fromBufferAttribute(geo.attributes.position, i); k[i] = fn(p); ph[i] = phase; }
  geo.setAttribute('aK', new THREE.BufferAttribute(k, 1)); geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); return geo;
}

/** Esqueleto + mallas skinned por material. */
export class Rig {
  constructor() { this.bones = []; this.root = null; this.layers = new Map(); this.group = new THREE.Group(); }
  bone(parent, pos, name = '') {
    const b = new THREE.Bone(); b.name = name; b.userData.rest = v3(pos).clone(); b.userData.idx = this.bones.length;
    if (parent) { parent.add(b); b.position.copy(b.userData.rest).sub(parent.userData.rest); } else { b.position.copy(b.userData.rest); this.root = b; this.group.add(b); }
    this.bones.push(b); return b;
  }
  /** Añade geometría ya "skinneada" a la capa del material. */
  add(mat, geo) { if (!this.layers.has(mat)) this.layers.set(mat, []); this.layers.get(mat).push(geo); }
  build() {
    this.group.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(this.bones); this.meshes = [];
    for (const [mat, geos] of this.layers) { const m = new THREE.SkinnedMesh(join(geos), mat); m.frustumCulled = false; this.group.add(m); m.bind(skel, new THREE.Matrix4()); m.castShadow = true; this.meshes.push(m); }
    this.skeleton = skel; return this.group;
  }
  /** Cuelga un objeto de un hueso, colocándolo en `pos` (coordenadas de reposo del modelo). */
  attach(bone, obj, pos) { obj.position.copy(v3(pos)).sub(bone.userData.rest); bone.add(obj); return obj; }
}
/** Dirección (en espacio de la raíz) desde un punto del cuerpo hacia la cámara: look*dist - pos. */
export function gazeDir(look, dist, pos, out = new V3()) { return out.copy(look).multiplyScalar(dist || 8).sub(pos).normalize(); }
/** Rotación de un hueso relativa a la raíz (para orientar ojos hacia el jugador). */
const _q = new THREE.Quaternion();
export function boneQuat(bone, rootBone, out = new THREE.Quaternion()) { out.identity(); let b = bone; const chain = []; while (b && b !== rootBone.parent) { chain.push(b); b = b.parent; } for (let i = chain.length - 1; i >= 0; i--) out.multiply(chain[i].quaternion); return out; }

/** Matriz de un hueso respecto a la raíz (producto de las matrices locales). */
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
export function boneMatrix(bone, rootBone, out = new THREE.Matrix4()) { out.identity(); const chain = []; let b = bone; while (b) { chain.push(b); if (b === rootBone) break; b = b.parent; } for (let i = chain.length - 1; i >= 0; i--) { chain[i].updateMatrix(); out.multiply(chain[i].matrix); } return out; }
/** Punto en espacio de la raíz → coordenadas locales del hueso (usar el padre de la cadera). */
export function toLocal(bone, rootBone, p, out = new V3(), cache = null) { const m = cache || boneMatrix(bone, rootBone, _m1); _m2.copy(m).invert(); return out.copy(p).applyMatrix4(_m2); }
/** IK de 2 huesos: hip→knee→foot(reposo en userData.rest). `target` en coordenadas locales del PADRE de hip. bend = hacia dónde sale la rodilla. */
export function legIK(hip, knee, foot, target, bend = new V3(0, 1, 0)) {
  const A = hip.userData.rest, B = knee.userData.rest, C = foot.userData.rest, L1 = A.distanceTo(B), L2 = B.distanceTo(C);
  const tgt = v3(target).clone().sub(hip.position); let d = tgt.length(); const max = L1 + L2 - 1e-3; if (d > max) { tgt.multiplyScalar(max / d); d = max; } d = Math.max(d, Math.abs(L1 - L2) + 1e-3);
  const ang = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), dir = tgt.clone().normalize();
  const hint = bend.clone().addScaledVector(dir, -bend.dot(dir)); if (hint.lengthSq() < 1e-6) hint.set(0, 1, 0).addScaledVector(dir, -dir.y); hint.normalize();
  const kdir = dir.clone().multiplyScalar(Math.cos(ang)).addScaledVector(hint, Math.sin(ang)), kneePos = kdir.clone().multiplyScalar(L1), ldir = tgt.clone().sub(kneePos).normalize();
  const q1 = new THREE.Quaternion().setFromUnitVectors(B.clone().sub(A).normalize(), kdir), q2w = new THREE.Quaternion().setFromUnitVectors(C.clone().sub(B).normalize(), ldir);
  hip.quaternion.copy(q1); knee.quaternion.copy(q1.clone().invert().multiply(q2w));
}
/** Marcha: devuelve [avance(-1..1), elevación(0..1)] para una fase ph∈R (stance 60%, swing 40%). */
export function gait(ph, swing = 0.4) { const f = ((ph / TAU) % 1 + 1) % 1; if (f < swing) { const k = f / swing, e = k * k * (3 - 2 * k); return [-1 + 2 * e, Math.sin(k * Math.PI)]; } return [1 - 2 * (f - swing) / (1 - swing), 0]; }


/* ═════════════════════════ PATAS REUTILIZABLES ═════════════════════════ */
/** Construye una pata de 2 huesos (cadera→rodilla→pie) con tubo afinado, nudillo, espinas y garra, ya skinneada. */
export function buildLeg(rig, mat, parent, H, K, F, { r0 = 0.08, rk = 0.06, r1 = 0.012, knuckle = 0.022, seg = 14, sides = 7, paintFn = null, spines = 3, spineLen = 0.12, spineCol = 0x6a8a90, claw = 0, clawCol = 0xe8dcc0, bow = 0.06, side = 1, name = '' } = {}) {
  const hb = rig.bone(parent, H, 'hip' + name), kb = rig.bone(hb, K, 'knee' + name), fb = rig.bone(kb, F, 'foot' + name);
  const L1 = H.distanceTo(K), L2 = K.distanceTo(F), f1 = L1 / (L1 + L2);
  const m1 = H.clone().lerp(K, 0.5).add(new V3(side * bow, bow, 0)), m2 = K.clone().lerp(F, 0.5).add(new V3(side * bow * 1.2, 0.02, 0));
  const g = tube([H, m1, K, m2, F], { rad: (t) => (t < f1 ? lerp(r0, rk, t / f1) + knuckle * Math.exp(-Math.pow((t - f1) / 0.035, 2)) : lerp(rk * 0.8, r1, Math.pow((t - f1) / (1 - f1), 0.8))), seg, sides, caps: false });
  if (paintFn) paint(g, paintFn); skinChain(g, [hb, kb, fb], 0.09); rig.add(mat, g);
  const R = rng(name.length * 13 + 5);
  for (let i = 0; i < spines; i++) { const t = 0.3 + i * (0.5 / Math.max(1, spines)), c = K.clone().lerp(F, t), sg = spike(0.014, spineLen * (0.7 + R() * 0.6), { sides: 3, seg: 1, pos: [c.x + side * 0.03, c.y, c.z], dir: [side * 0.6, 0.4, 0.5 + (i % 2) * 0.3] }); paint(sg, spineCol); skinRigid(sg, kb); rig.add(mat, sg); }
  if (claw) { const cg = spike(r1 * 1.6, claw, { sides: 4, seg: 2, bend: 0.4, bendDir: [0, 0, 1], pos: [F.x, F.y + 0.02, F.z], dir: [0, -1, 0.3] }); paint(cg, clawCol); skinRigid(cg, kb); rig.add(mat, cg); }
  return { hb, kb, fb, par: parent, side, L1, L2 };
}
const _pm = new THREE.Matrix4(), _lp = new V3();
/** Lleva el pie de la pata a `target` (espacio de la raíz). cache: Map(par→Matrix4) por tick. */
export function footTo(Lg, rootBone, target, bend, cache) {
  let m = cache && cache.get(Lg.par); if (!m) { m = boneMatrix(Lg.par, rootBone, new THREE.Matrix4()); if (cache) cache.set(Lg.par, m); }
  toLocal(Lg.par, rootBone, target, _lp, m); legIK(Lg.hb, Lg.kb, Lg.fb, _lp, bend);
}

/* ═════════════════════════ OJOS REALISTAS ═════════════════════════ */
let eyeGeoCache = null;
const eyeSphere = () => (eyeGeoCache || (eyeGeoCache = [new THREE.SphereGeometry(1, 20, 14), new THREE.SphereGeometry(1, 12, 8)]))[lod().low ? 1 : 0];
/** Globo ocular: esclerótica con venas, iris con fibras/anillo límbico y pupila dibujados por shader. Mira hacia +Z local. */
export function eyeBallMat({ iris = 0xffb030, iris2 = null, sclera = 0xe8dccb, vein = 0x9a2a2a, pupil = 'round', irisR = 0.62, glow = 0.35, veinK = 0.7 } = {}) {
  const L = lod(), Cls = L.low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const m = new Cls({ color: 0xffffff, roughness: 0.22 }); if (!L.low) { m.clearcoat = 1; m.clearcoatRoughness = 0.03; }
  const pw = pupil === 'slit' ? [0.1, 0.86] : pupil === 'hslit' ? [0.82, 0.2] : pupil === 'round' ? [0.36, 0.36] : [0.5, 0.5];
  const u = { uHurt: { value: 0 }, uGlow: { value: glow }, uPup: { value: new THREE.Vector2(pw[0], pw[1]) }, uIrisA: { value: new THREE.Color(iris) }, uIrisB: { value: new THREE.Color(iris2 != null ? iris2 : new THREE.Color(iris).multiplyScalar(0.35)) }, uScl: { value: new THREE.Color(sclera) }, uVein: { value: new THREE.Color(vein) }, uIrisR: { value: irisR }, uVeinK: { value: veinK } };
  m.userData.u = u; m.customProgramCacheKey = () => 'eyeball' + (L.low ? 'L' : '');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vP; uniform float uHurt,uGlow,uIrisR,uVeinK; uniform vec2 uPup; uniform vec3 uIrisA,uIrisB,uScl,uVein; ${NOISE_GLSL}\n`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 ed = normalize(vP); float th = acos(clamp(ed.z, -1.0, 1.0)); float eang = atan(ed.y, ed.x); float rr = th / uIrisR;
        vec3 ecol = uScl; float vz = 1.0 - abs(vn(ed * 10.0) - 0.5) * 2.0; float vein = smoothstep(0.8, 0.97, vz) * smoothstep(0.9, 1.7, rr) * uVeinK + smoothstep(0.86, 0.97, 1.0 - abs(vn(ed * 24.0 + 3.0) - 0.5) * 2.0) * smoothstep(1.1, 2.0, rr) * uVeinK * 0.6;
        ecol = mix(ecol, uVein, vein * 0.75); ecol *= 1.0 - 0.45 * smoothstep(1.3, 3.0, rr); ecol = mix(ecol, ecol * vec3(1.0, 0.92, 0.82), 0.5);
        float inIris = 1.0 - smoothstep(0.97, 1.0, rr);
        vec3 rad = vec3(cos(eang), sin(eang), 0.0);
        float fib = vn(rad * 7.0 + vec3(0.0, 0.0, rr * 6.0)) * 0.6 + vn(rad * 16.0 + vec3(3.0, 1.0, rr * 12.0)) * 0.4;
        vec3 ic = mix(uIrisA * 1.3, uIrisB, smoothstep(0.15, 0.95, rr)); ic *= 0.45 + 1.1 * fib;
        ic += uIrisA * 0.9 * exp(-pow((rr - 0.42) * 7.0, 2.0)); ic *= 1.0 - 0.85 * smoothstep(0.8, 1.0, rr);
        vec2 pq = ed.xy / max(sin(uIrisR), 1e-3); float pm = length(vec2(pq.x / uPup.x, pq.y / uPup.y)); float pupil = 1.0 - smoothstep(0.9, 1.06, pm);
        ic = mix(ic, vec3(0.004), pupil); float irisLit = inIris * (1.0 - pupil);
        diffuseColor.rgb = mix(ecol, ic, inIris);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(0.28, 0.12, inIris);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += ic * uGlow * irisLit * (0.5 + 0.5 * smoothstep(0.0, 1.0, rr)) + vec3(1.0, 0.85, 0.7) * uHurt * 0.6;');
  };
  return m;
}
/**
 * Ojo completo: globo (gira para mirar), párpados (carcasa de carne con recorte), rodeado por el cuerpo.
 * { r, lidMat, ...eyeBallMat opts, lids:true, slant }. update(dt, dirLocal, { open, dilate, glowMul, squint }).
 * El globo mira hacia +Z del objeto. dirLocal debe estar en el espacio del objeto padre (ver boneQuat).
 */
export function eye(o = {}) {
  const { r = 0.2, lidMat = null, lids = true, slant = 0, maxYaw = 0.75, maxPitch = 0.5, follow = 1 } = o, L = lod();
  const g = new THREE.Group(), mat = eyeBallMat(o), geo = eyeSphere();
  const ball = new THREE.Mesh(geo, mat); ball.scale.setScalar(r); g.add(ball);
  let lid = null, lm = null;
  if (lids && lidMat) { lm = lidMat; lid = new THREE.Mesh(geo, lm); lid.scale.setScalar(r * 1.07); g.add(lid); }
  let blinkT = 1.5 + Math.random() * 3, blink = 0, yaw = 0, pit = 0, vy = 0, vp = 0, openS = 1, openV = 0, qt = 0; const tmp = new V3(), pup0 = mat.userData.u.uPup.value.clone();
  return {
    object: g, ball, lid, mat, r,
    update(dt, dir, { open = 1, dilate = 0, glowMul = 1, squint = 0, quiver = 0 } = {}) {
      if (dir) {
        tmp.copy(dir).normalize(); const ty = clamp(Math.atan2(tmp.x, tmp.z), -maxYaw, maxYaw) * follow, tp = clamp(-Math.asin(clamp(tmp.y, -1, 1)), -maxPitch, maxPitch) * follow;
        // resorte con sacudida (sacadas) para que no sea un seguimiento mecánico
        vy += ((ty - yaw) * 180 - vy * 16) * dt; vp += ((tp - pit) * 180 - vp * 16) * dt; yaw += vy * dt; pit += vp * dt;
      }
      qt += dt; ball.rotation.set(pit + quiver * Math.sin(qt * 47) * 0.03, yaw + quiver * Math.cos(qt * 39) * 0.03, 0);
      blinkT -= dt; if (blinkT <= 0) { blink = 1; blinkT = 2 + Math.random() * 4.5; } blink = Math.max(0, blink - dt * 6);
      const bl = Math.sin(Math.min(1, blink) * Math.PI), tgt = open * (1 - bl);
      openV += ((tgt - openS) * 260 - openV * 24) * dt; openS = clamp(openS + openV * dt, 0, 1.1);
      if (lm) { const u = lm.userData.u, s = clamp(openS, 0, 1.05); u.uUp.value = -0.1 + 0.98 * s; u.uLo.value = -0.1 + 0.8 * s * (1 - squint * 0.5); u.uSl.value = slant; }
      const k = Math.max(0.12, 1 + dilate); mat.userData.u.uPup.value.copy(pup0).multiplyScalar(k); mat.userData.u.uGlow.value = (o.glow != null ? o.glow : 0.35) * glowMul;
    },
  };
}
/** Material de párpado/piel: carne húmeda con venas (versión con recorte). */
export const lidMaterial = (o = {}) => bio({ color: 0x7a3a46, rough: 0.4, clear: 0.4, sheen: 0, tex: 'flesh', tile: 1.2, bump: 0.8, seam: 0x2a0810, seamK: 0.5, vein: 0x4a0a18, veinK: 0.35, sss: 0.15, sssColor: 0xff5040, lid: true, vcol: false, side: THREE.DoubleSide, ...o });

/* ═════════════════════════ EXTRAS ═════════════════════════ */
let haloTex = null;
export function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (haloTex = new THREE.CanvasTexture(c));
}
export function glowSprite(color, size = 1, opacity = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity })); s.scale.setScalar(size); return s;
}
export function shieldAura(color, r = 1.5) {
  const a = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  a.scale.setScalar(r); a.visible = false; a.userData.r = r; return a;
}
export function tickAura(a, st, t) { a.visible = !!st.sd; if (st.sd) { a.material.opacity = 0.16 + 0.07 * Math.sin(t * 6); a.scale.setScalar(a.userData.r * (1 + 0.025 * Math.sin(t * 5))); } }
export class Spring { constructor(x = 0, k = 60, d = 8) { this.x = x; this.v = 0; this.k = k; this.d = d; } step(dt, target) { dt = Math.min(dt, 1 / 30); const a = this.k * (target - this.x) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; } }
export function dampTo(cur, tgt, rate, dt) { return cur + (tgt - cur) * (1 - Math.exp(-rate * dt)); }
