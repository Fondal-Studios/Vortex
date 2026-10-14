// KIT DE ALMAS — piezas compartidas por el bestiario del limbo (docs/BESTIARIO_LIMBO.md, estética «realismo espiritual»).
// Se apoya en el bio-kit (geoda-bio.js: esqueleto real con SkinnedMesh, tubos, elipsoides, IK) y agrega lo espiritual:
//   · velo(color)      → tela/sudario TRANSLÚCIDO con borde fresnel que brilla, ondea por shader (atributo aK: 0 cosido → 1 borde
//                        suelto) y se deshace en luz en el borde. Con alpha 1 es tela opaca (luto, poncho, sombrero) con el mismo vuelo.
//                        Si existe la textura CC0 de lino (public/assets/ph/rough_linen) se le pone como relieve del tejido.
//   · hueso(), carne(), pelo(), metal() → materiales PBR (bio-kit) con vértice-color.
//   · fuego(c0,c1)     → llama aditiva animada (cuello de la Almamula, Fuego Fatuo, Mandinga).
//   · nucleo(color)    → NÚCLEO DE LUZ = punto débil (centro blanco + cáscara fresnel + halo). set(k) lo enciende (telegrafía).
//   · motas(n,{modo})  → partículas en 1 draw call (suben, estela, órbita, succión, estallido).
//   · aro(color)       → aro de aviso en el piso/frente (pulsos que salen o entran).
//   · humanoide(rig,o) → esqueleto + cuerpo flaco (torso, brazos con IK, manos huesudas, piernas opcionales).
//   · calavera(), cara(), cadena(), sudario() → geometrías.
// Convención (igual que el resto de criaturas): frente +Z, arriba +Y, el render escala por el radio m.r; el centro de la criatura de
// suelo está a 0.9 r del piso => sus pies van en y = -0.9 (se logra con rootObj.position.y).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uTime } from '../shaders.js';
import { PH_BASE } from '../ph.js';
import {
  TAU, lod, clamp, lerp, smooth, rng, noise3, bio, tube, ellipsoid, spike, paint, place, orient, path, mirrorX,
  skinRigid, skinChain, skinFn, Rig as BaseRig, legIK, gait, boneMatrix, toLocal, boneQuat, gazeDir, haloTexture, glowSprite,
  shieldAura, tickAura, Spring, dampTo, footTo, glowSet,
} from './geoda-bio.js';

export { THREE, TAU, lod, clamp, lerp, smooth, rng, noise3, bio, tube, ellipsoid, spike, paint, place, orient, path, mirrorX, skinRigid, skinChain, skinFn, legIK, gait, boneMatrix, toLocal, boneQuat, gazeDir, haloTexture, glowSprite, shieldAura, tickAura, Spring, dampTo, footTo, glowSet, uTime };
const V3 = THREE.Vector3;

/* ═════════════ Unión de geometrías que CONSERVA uv (el lino necesita coordenadas) ═════════════ */
const KEEP = ['position', 'normal', 'color', 'skinIndex', 'skinWeight', 'aK', 'aPh', 'uv'];
export function joinUV(geos) {
  const out = geos.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); const n = g.attributes.position.count;
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (!g.attributes.aK) g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n), 1));
    if (!g.attributes.aPh) g.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(n), 1));
    if (!g.attributes.uv) { const uv = new Float32Array(n * 2), p = g.attributes.position; for (let i = 0; i < n; i++) { uv[i * 2] = p.getX(i) * 1.5 + p.getZ(i) * 1.5; uv[i * 2 + 1] = p.getY(i) * 1.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    if (!g.attributes.skinIndex) { g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4), 4)); const w = new Float32Array(n * 4); for (let i = 0; i < n; i++) w[i * 4] = 1; g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4)); }
    return g;
  });
  const g = mergeGeometries(out, false); g.computeBoundingSphere(); return g;
}
/** Esqueleto con mallas por material (una SkinnedMesh por material = pocos draw calls). */
export class Rig extends BaseRig {
  build() {
    this.group.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(this.bones); this.meshes = [];
    for (const [mat, geos] of this.layers) { const m = new THREE.SkinnedMesh(joinUV(geos), mat); m.frustumCulled = false; this.group.add(m); m.bind(skel, new THREE.Matrix4()); m.castShadow = true; m.renderOrder = mat.transparent ? 2 : 0; this.meshes.push(m); }
    this.skeleton = skel; return this.group;
  }
}
/** Pseudo-material para `mats`: libera geometrías, esqueleto y extras al morir la criatura. */
export function disposer(rig, extras = []) { return { userData: {}, dispose() { (rig.meshes || []).forEach((m) => m.geometry && m.geometry.dispose()); if (rig.skeleton) rig.skeleton.dispose(); extras.forEach((x) => x && x.dispose && x.dispose()); } }; }

/* ═════════════ Textura CC0 de lino (Poly Haven) — se aplica cuando termina de cargar ═════════════ */
let linen = null; const linenWait = new Set(); let linenPromise = null;
function linenTex() {
  if (linen) return linen;
  const TL = new THREE.TextureLoader(), base = `${PH_BASE}rough_linen/rough_linen_`;
  linen = { n: null, d: null, ok: false };
  linenPromise = new Promise((res) => {
    let k = 0; const done = () => { if (++k < 2) return; linen.ok = !!(linen.n.image && linen.d.image); for (const m of linenWait) applyLinen(m); linenWait.clear(); res(linen.ok); };
    linen.n = TL.load(base + 'nor_gl_1k.jpg', done, undefined, done); linen.d = TL.load(base + 'diff_1k.jpg', done, undefined, done);
    for (const t of [linen.n, linen.d]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 4; }
    linen.d.colorSpace = THREE.SRGBColorSpace;
  });
  return linen;
}
function applyLinen(m) { if (!linen || !linen.ok) return; m.normalMap = linen.n; m.normalScale = new THREE.Vector2(m.userData.weave, m.userData.weave); if (m.userData.weaveMap) m.map = linen.d; m.needsUpdate = true; }
/** Promesa que se resuelve cuando la textura de lino terminó (o falló): la usan las hojas de contacto antes de capturar. */
export function texturasListas() { linenTex(); return linenPromise; }

/* ═════════════ VELO / TELA ═════════════ */
/**
 * Tela espiritual. Uniformes vivos en mat.userData.u: uHurt, uGlow, uRim (fuerza del borde fresnel), uFlut (amplitud del vuelo),
 * uSpd, uWind (vec3: empuje del viento en el borde suelto), uVis (0..1 visibilidad, camuflaje), uHem (dónde empieza a deshacerse).
 */
export function velo(color = 0xe8f4ff, o = {}) {
  const L = lod(), { alpha = 0.55, rim = 1.0, rimColor = 0x9fe8ff, rimPow = 2.2, glow = 0, glowColor = null, flutter = 0.06, speed = 2.2, hem = 0.72, hemGlow = 0.5, rough = 0.8, weave = 0.7, weaveMap = true, sheen = 0.6, emissiveLift = 0.12, side = THREE.DoubleSide, depthWrite = null, fresAlpha = true } = o;
  const opaque = alpha >= 1, Cls = L.low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const m = new Cls({ color, roughness: rough, metalness: 0, vertexColors: true, transparent: !opaque, opacity: alpha, side, depthWrite: depthWrite != null ? depthWrite : opaque });
  if (!L.low && sheen) { m.sheen = sheen; m.sheenColor = new THREE.Color(rimColor).lerp(new THREE.Color(1, 1, 1), 0.4); m.sheenRoughness = 0.6; }
  m.userData.weave = weave; m.userData.weaveMap = weaveMap;
  const u = { uTime, uHurt: { value: 0 }, uWound: { value: 0 }, uGlow: { value: glow }, uRim: { value: rim }, uRimP: { value: rimPow }, uFlut: { value: flutter }, uSpd: { value: speed }, uWind: { value: new V3() }, uVis: { value: 1 }, uHem: { value: hem }, uHemG: { value: hemGlow }, uLift: { value: emissiveLift * (L.low ? 1.5 : 1) },
    uRimC: { value: new THREE.Color(rimColor) }, uGlowC: { value: new THREE.Color(glowColor != null ? glowColor : rimColor) } };
  m.userData.u = u;
  m.customProgramCacheKey = () => 'velo' + (opaque ? 'O' : fresAlpha ? 'T' : 'F') + (L.low ? 'L' : '');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aK; attribute float aPh; varying float vK; uniform float uTime, uFlut, uSpd; uniform vec3 uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vK = aK; float fw = aK * aK; float fph = aPh + position.y * 2.3 + position.x * 1.7;
        transformed.x += sin(uTime * uSpd + fph) * uFlut * fw;
        transformed.z += cos(uTime * uSpd * 0.83 + fph * 1.3) * uFlut * fw;
        transformed.y += sin(uTime * uSpd * 1.21 + fph * 0.7) * uFlut * 0.35 * fw;
        transformed += uWind * fw * (0.8 + 0.2 * sin(uTime * 7.0 + fph));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vK; uniform float uTime, uHurt, uWound, uGlow, uRim, uRimP, uVis, uHem, uHemG, uLift; uniform vec3 uRimC, uGlowC;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float vNV = abs(dot(normalize(normal), normalize(vViewPosition))); float vFr = pow(1.0 - vNV, uRimP);
        float vHm = uHem >= 0.999 ? 0.0 : smoothstep(uHem, 1.0, vK);
        totalEmissiveRadiance += diffuseColor.rgb * uLift + uRimC * uRim * vFr + uGlowC * uGlow + uRimC * uHemG * vHm * (0.6 + 0.4 * sin(uTime * 3.0 + vK * 9.0)) + vec3(1.0, 0.85, 0.7) * uHurt * 0.8 + vec3(1.0, 0.3, 0.2) * uWound * 0.15 * vFr;`)
      .replace('#include <opaque_fragment>', `${opaque ? '' : fresAlpha ? 'diffuseColor.a *= (0.35 + 0.95 * vFr) * (1.0 - vHm * 0.92);' : 'diffuseColor.a *= (1.0 - vHm * 0.92);'} diffuseColor.a *= uVis;
        #include <opaque_fragment>`);
  };
  if (weave > 0) { linenTex(); if (linen.ok) applyLinen(m); else linenWait.add(m); }
  return m;
}
/** Hueso / marfil envejecido (vértice-color manda el tono). */
export const hueso = (o = {}) => bio({ color: 0xffffff, rough: 0.55, clear: 0.15, tex: 'fine', tile: 3.2, bump: 0.9, grain: 0.55, seam: 0x2a1c10, seamK: 0.35, vein: 0x3a2a1a, veinK: 0.15, sss: 0.15, sssColor: 0xffe6c0, lift: 0.1, rim: 0.25, rimColor: 0xbfe8ff, ...o });
/** Carne espectral (piel tirante, grisácea, con venas que brillan del color del alma). */
export const carne = (o = {}) => bio({ color: 0xffffff, rough: 0.5, clear: 0.3, tex: 'flesh', tile: 2.0, bump: 0.6, grain: 0.45, seam: 0x10141c, seamK: 0.25, vein: o.vein ?? 0x60e0ff, veinK: 0.4, veinGlow: 0.6, sss: 0.45, sssColor: o.sssColor ?? 0x9fe8ff, lift: 0.1, rim: 0.4, rimColor: o.rimColor ?? 0x9fe8ff, ...o });
/** Pelo / cuero (pelaje apelmazado). */
export const pelo = (o = {}) => bio({ color: 0xffffff, rough: 0.85, tex: 'scales', tile: 5, bump: 1.1, grain: 0.7, seam: 0x050505, seamK: 0.45, sss: 0.1, sssColor: 0x806040, lift: 0.08, rim: 0.35, rimColor: o.rimColor ?? 0xffc080, ...o });
/** Metal (cadenas, monedas, plata criolla). */
export function metal(color = 0x8a8a90, { rough = 0.42, metalness = 0.9, glow = 0, glowColor = 0xff6a20 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness, vertexColors: true, emissive: new THREE.Color(glowColor), emissiveIntensity: glow });
  const u = { uHurt: { value: 0 } }; m.userData.u = u;
  m.customProgramCacheKey = () => 'almametal';
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHurt;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0,0.85,0.7) * uHurt * 0.6;'); };
  return m;
}
/** Material emisivo plano (ojos, brasas, runas): color × intensidad; ignora la luz. */
export function brillo(color, k = 1.6) { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false }); m.userData.u = { uHurt: { value: 0 } }; m.userData.base = new THREE.Color(color); return m; }
export const setBrillo = (m, k) => m.color.copy(m.userData.base).multiplyScalar(k);

/* ═════════════ FUEGO ═════════════ */
const FIRE_V = `uniform float uTime, uSpd, uWob; varying float vH; varying vec3 vN; varying vec3 vV; attribute float aH;
  float h3(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y), mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }
  void main(){ vH = aH; vec3 p = position; float t = uTime * uSpd;
    float nz = n3(p * 3.0 - vec3(0.0, t * 2.2, 0.0)) - 0.5; p += normal * nz * uWob * (0.3 + aH);
    p.x += sin(t * 2.7 + aH * 4.0) * 0.06 * aH * aH * uWob * 4.0; p.z += cos(t * 2.1 + aH * 3.0) * 0.05 * aH * aH * uWob * 4.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FIRE_F = `uniform float uTime, uK, uSpd, uHurt; uniform vec3 uC0, uC1; varying float vH; varying vec3 vN; varying vec3 vV;
  float h3(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  void main(){ float f = abs(dot(normalize(vN), vV)); float core = pow(f, 1.6);
    float fl = 0.75 + 0.25 * sin(uTime * 17.0 * uSpd + vH * 9.0) * sin(uTime * 11.0 + vH * 5.0);
    vec3 c = mix(uC0, uC1, clamp(core * (1.0 - vH * 0.8) * 1.3, 0.0, 1.0));
    float a = core * pow(1.0 - vH, 1.2) * fl * uK;
    gl_FragColor = vec4(c * (1.0 + uHurt) * a * 1.6, a); }`;
let fireGeoCache = null;
/** Geometría de llama (lágrima abierta hacia arriba) con atributo aH = altura 0..1. Base en el origen, punta en +Y (1). */
export function fireGeo() {
  if (fireGeoCache) return fireGeoCache;
  const L = lod(), pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.32 * (1 - t * 0.55) + 0.001, t)); }
  const g = new THREE.LatheGeometry(pts, L.low ? 8 : 12); const h = new Float32Array(g.attributes.position.count); for (let i = 0; i < h.length; i++) h[i] = g.attributes.position.getY(i);
  g.setAttribute('aH', new THREE.BufferAttribute(h, 1)); return (fireGeoCache = g);
}
export function fuego(c0 = 0xff4a10, c1 = 0xfff0a0, { k = 1, speed = 1, wob = 0.18 } = {}) {
  const u = { uTime, uK: { value: k }, uSpd: { value: speed }, uWob: { value: wob }, uHurt: { value: 0 }, uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.userData.u = u; return m;
}
/** Llama lista para colgar: Mesh con la geometría de llama escalada (ancho w, alto h). */
export function llama(mat, w = 0.3, h = 0.8) { const f = new THREE.Mesh(fireGeo(), mat); f.scale.set(w / 0.32, h, w / 0.32); f.frustumCulled = false; f.renderOrder = 3; return f; }

/* ═════════════ NÚCLEO DE LUZ (punto débil) ═════════════ */
const SHELL_F = `uniform vec3 uC; uniform float uK, uTime; varying vec3 vN; varying vec3 vV;
  void main(){ float f = 1.0 - abs(dot(normalize(vN), vV)); float a = (0.15 + pow(f, 1.6) * 0.9) * uK; gl_FragColor = vec4(uC * a * (1.2 + 0.3 * sin(uTime * 9.0)), a); }`;
const SHELL_V = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
let sphLo = null, sphHi = null; const sph = () => (lod().low ? (sphLo || (sphLo = new THREE.SphereGeometry(1, 10, 8))) : (sphHi || (sphHi = new THREE.SphereGeometry(1, 16, 12))));
/**
 * Núcleo: centro blanco caliente + cáscara del color del alma + halo aditivo. set(k, t): k=0 apagado..1 normal..2.5 avisando (ataque).
 * Devuelve { object, mats, set }. Siempre se ve (también en Baja, sin bloom) gracias al halo.
 */
export function nucleo(color, r = 0.12, { halo = 8, white = 0xfff8ee } = {}) {
  const g = new THREE.Group(), cc = new THREE.Color(color);
  const inner = new THREE.Mesh(sph(), brillo(white, 2.2)); inner.scale.setScalar(r * 0.55); g.add(inner);
  const su = { uC: { value: cc.clone() }, uK: { value: 1 }, uTime, uHurt: { value: 0 } };
  const shell = new THREE.Mesh(sph(), new THREE.ShaderMaterial({ uniforms: su, vertexShader: SHELL_V, fragmentShader: SHELL_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); shell.material.userData.u = su; shell.scale.setScalar(r); g.add(shell);
  const sp = glowSprite(color, r * halo, 0.6); g.add(sp); sp.renderOrder = 4; inner.renderOrder = 3; shell.renderOrder = 3;
  let kS = 1;
  return { object: g, mats: [inner.material, shell.material, sp.material], inner, shell, sprite: sp, set(k, t = 0, dt = 1 / 30) {
    kS += (k - kS) * Math.min(1, dt * 12); const beat = 1 + 0.08 * Math.sin(t * 6.3) + 0.05 * Math.sin(t * 13.1);
    inner.scale.setScalar(r * (0.42 + 0.16 * kS) * beat); shell.scale.setScalar(r * (0.9 + 0.12 * kS) * beat); su.uK.value = 0.4 + 0.5 * kS;
    setBrillo(inner.material, 1.2 + kS * 1.1); sp.material.opacity = clamp(0.25 + 0.3 * kS, 0, 1); sp.scale.setScalar(r * halo * (0.6 + 0.45 * kS) * beat);
    g.visible = kS > 0.02;
  } };
}

/* ═════════════ MOTAS (partículas en 1 draw call) ═════════════ */
const MOTE_V = (mode) => `uniform float uTime, uSpd, uSize, uK; uniform vec3 uBox, uC0; attribute vec4 aS; varying float vA;
  void main(){ float t = fract(uTime * uSpd * (0.6 + 0.8 * aS.w) + aS.x * 7.13); vec3 p; float a = 1.0;
  ${{
    rise: 'p = (aS.xyz - 0.5) * uBox; p.y = (t - 0.2) * uBox.y; p.x += sin(t * 6.0 + aS.y * 9.0) * 0.08 * uBox.x; a = sin(t * 3.1416);',
    trail: 'p = (aS.xyz - 0.5) * uBox * vec3(1.0, 1.0, 0.0); p.xy *= (0.4 + t * 1.2); p.z = -t * uBox.z; a = (1.0 - t);',
    orbit: 'float an = uTime * uSpd * 2.0 * (0.5 + aS.w) + aS.x * 6.2832; float rr = uBox.x * (0.6 + 0.4 * aS.y); p = vec3(cos(an) * rr, (aS.z - 0.5) * uBox.y + sin(an * 2.0 + aS.w * 6.0) * 0.1 * uBox.y, sin(an) * rr); a = 0.6 + 0.4 * sin(an * 3.0);',
    suck: 'vec3 d = normalize(aS.xyz - 0.5 + 1e-3); p = d * uBox * (1.0 - t) + uC0; a = t * (1.0 - t) * 4.0;',
    burst: 'vec3 d = normalize(aS.xyz - 0.5 + 1e-3); p = d * uBox * t + uC0; a = (1.0 - t);',
  }[mode]}
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = a * uK; float sc = length(modelMatrix[0].xyz);
  gl_PointSize = uSize * (0.5 + aS.w) * sc * 420.0 / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const MOTE_F = 'uniform vec3 uC; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; float a = exp(-d * 3.5) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uC * a, a); }';
export function motas(n, { color = 0x9fe8ff, size = 0.05, modo = 'rise', box = [1, 1, 1], speed = 0.5, k = 1, center = [0, 0, 0], seed = 3 } = {}) {
  const L = lod(); n = Math.max(4, Math.round(n * (L.low ? 0.6 : L.hi ? 1.4 : 1)));
  const g = new THREE.BufferGeometry(), R = rng(seed), s = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) s[i] = R();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 4));
  const u = { uTime, uSpd: { value: speed }, uSize: { value: size }, uK: { value: k }, uBox: { value: new V3(...box) }, uC0: { value: new V3(...center) }, uC: { value: new THREE.Color(color) }, uHurt: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: MOTE_V(modo), fragmentShader: MOTE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.userData.u = u; const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 5; p.userData.geo = g; return p;
}

/* ═════════════ ARO DE AVISO ═════════════ */
const RING_F = `uniform float uTime, uK, uDir, uN, uSpd; uniform vec3 uC; varying vec2 vUv;
  void main(){ vec2 q = vUv * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard; float an = atan(q.y, q.x);
    float ph = fract(r * uN - uTime * uSpd * uDir); float band = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.18, 0.5, ph));
    float edge = smoothstep(0.86, 0.95, r) * (1.0 - smoothstep(0.97, 1.0, r));
    float runes = step(0.6, fract(an * 3.8197 + uTime * 0.3)) * smoothstep(0.78, 0.82, r) * (1.0 - smoothstep(0.86, 0.9, r));
    float a = (band * 0.55 * smoothstep(0.05, 0.3, r) + edge * 0.9 + runes * 0.7) * uK * (1.0 - smoothstep(0.98, 1.0, r));
    gl_FragColor = vec4(uC * a * 1.5, a); }`;
const RING_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
let planeG = null;
/** Disco de aviso (plano XZ). uK = intensidad (0 oculto); uDir 1 = pulsos hacia afuera, -1 hacia adentro. */
export function aro(color, { n = 4, dir = 1, speed = 1.2, vertical = false } = {}) {
  const u = { uTime, uK: { value: 0 }, uDir: { value: dir }, uN: { value: n }, uSpd: { value: speed }, uC: { value: new THREE.Color(color) }, uHurt: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: RING_V, fragmentShader: RING_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.userData.u = u; const me = new THREE.Mesh(planeG || (planeG = new THREE.PlaneGeometry(2, 2)), m); if (!vertical) me.rotation.x = -Math.PI / 2; me.visible = false; me.renderOrder = 4; me.frustumCulled = false;
  me.userData.setK = (k) => { u.uK.value = k; me.visible = k > 0.01; };
  return me;
}

/* ═════════════ GEOMETRÍAS ═════════════ */
/**
 * Sudario / tela: superficie que cuelga a lo largo de una curva central `pts` (de lo cosido al borde suelto) con radio rad(t).
 * arc=[a0,a1] (radianes, 0 = +Z frente) para telas abiertas (capa, velo). tatter: largo irregular por tira (borde deshilachado).
 * Atributos: uv, aK (0 cosido → 1 borde), aPh (fase por tira). Opcional skin: fn(t) → [[hueso, peso], …].
 */
export function sudario(pts, { rad = 0.3, rows = 14, cols = 22, arc = null, tatter = 0.25, seed = 1, ex = [1, 1], fold = 0.06, folds = 7, up = [0, 0, 1], color = 0xffffff, colorEnd = null, kStart = 0 } = {}) {
  const L = lod(); rows = Math.max(4, Math.round(rows * (L.low ? 0.7 : L.hi ? 1.25 : 1))); cols = Math.max(6, Math.round(cols * (L.low ? 0.7 : L.hi ? 1.25 : 1)));
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal'), R = rng(seed), rf = typeof rad === 'function' ? rad : Array.isArray(rad) ? (t) => lerp(rad[0], rad[1], t) : () => rad;
  const closed = !arc, a0 = arc ? arc[0] : 0, a1 = arc ? arc[1] : TAU, nc = closed ? cols : cols + 1;
  const lenK = []; for (let j = 0; j < nc; j++) { const tj = R(); lenK.push(1 - tatter * (tj * tj) - (j % 3 === 0 ? tatter * 0.35 * R() : 0)); }
  const pos = [], uv = [], ak = [], ph = [], col = [], idx = [], T = new V3(), N = new V3(), B = new V3(), P = new V3(), upv = new V3(...up).normalize(), cA = new THREE.Color(color), cB = new THREE.Color(colorEnd != null ? colorEnd : color), c = new THREE.Color();
  const frames = []; for (let i = 0; i <= 40; i++) { const t = i / 40; curve.getTangentAt(t, T); if (i === 0) { N.copy(upv).addScaledVector(T, -upv.dot(T)); if (N.lengthSq() < 1e-4) N.set(1, 0, 0).addScaledVector(T, -T.x); N.normalize(); } else N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N); frames.push([N.clone(), B.clone()]); }
  const frameAt = (t) => frames[Math.min(40, Math.round(t * 40))];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j < nc; j++) {
      const v = i / rows, t = v * lenK[j], a = a0 + (a1 - a0) * (j / cols); curve.getPointAt(Math.min(1, t), P); const [n, b] = frameAt(t);
      const r = rf(t) * (1 + fold * Math.sin(a * folds + R() * 0.0) * smooth(0.1, 0.6, t)), ca = Math.cos(a) * r * ex[0], sa = Math.sin(a) * r * ex[1];
      // frente (+Z) = dirección N (up) por convención: a=0 apunta a `up`
      pos.push(P.x + n.x * ca + b.x * sa, P.y + n.y * ca + b.y * sa, P.z + n.z * ca + b.z * sa);
      uv.push((j / cols) * 2.0, t * 2.5); ak.push(kStart + (1 - kStart) * t); ph.push(j * 0.7 + R() * 0.5);
      c.copy(cA).lerp(cB, smooth(0.2, 1, t)); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < (closed ? nc : nc - 1); j++) { const jn = (j + 1) % nc, a = i * nc + j, b2 = i * nc + jn, c2 = (i + 1) * nc + j, d = (i + 1) * nc + jn; idx.push(a, c2, b2, b2, c2, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(ak, 1)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.curve = curve; return g;
}
/** aK constante (tela cosida, sin vuelo) o por función de la posición. */
export function setK(geo, fn) { const n = geo.attributes.position.count, k = new Float32Array(n), p = new V3(); for (let i = 0; i < n; i++) { p.fromBufferAttribute(geo.attributes.position, i); k[i] = typeof fn === 'function' ? fn(p) : fn; } geo.setAttribute('aK', new THREE.BufferAttribute(k, 1)); return geo; }

/** Cadena de eslabones a lo largo de una curva. link = largo del eslabón. Devuelve geometría pintada (hierro). */
export function cadena(pts, { link = 0.09, thick = 0.016, color = 0x4a4844, rust = 0x6a3a1c, seed = 2 } = {}) {
  const L = lod(), curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal'), len = curve.getLength(), n = Math.max(2, Math.floor(len / (link * 0.78)));
  const base = new THREE.TorusGeometry(link * 0.5, thick, L.low ? 3 : 4, L.low ? 6 : 8); base.scale(1, 0.62, 1);
  const R = rng(seed), parts = [], P = new V3(), T = new V3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m = new THREE.Matrix4(), X = new V3(1, 0, 0);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; curve.getPointAt(t, P); curve.getTangentAt(t, T); q.setFromUnitVectors(X, T); q2.setFromAxisAngle(X, (i % 2) * Math.PI / 2 + (R() - 0.5) * 0.3); q.multiply(q2); m.compose(P, q, new V3(1, 1, 1)); const g = base.clone().applyMatrix4(m); paint(g, new THREE.Color(color).lerp(new THREE.Color(rust), R() * 0.6)); parts.push(g.toNonIndexed()); }
  const g = mergeGeometries(parts, false); g.userData.curve = curve; return g;
}
/** Calavera: cráneo con cuencas, pómulos, nariz y dientes pintados (+Z = cara). Devuelve { cranium, jaw } (jaw articulable). */
export function calavera(s = 0.12, { long = 1, seed = 4, bone = 0xd9ccb0, dark = 0x120c08, horns = false } = {}) {
  const L = lod(), w = L.low ? 14 : 22, h = L.low ? 10 : 16;
  const cr = ellipsoid([s * 0.86, s * 0.95, s * 1.05 * long], { w, h, noise: 0.05, seed });
  const P = cr.attributes.position, p = new V3(), sockets = [[-0.36, 0.05, 0.86], [0.36, 0.05, 0.86]].map((v) => new V3(v[0] * s, v[1] * s, v[2] * s * long));
  for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i);
    // mandíbula superior se angosta abajo-adelante; sienes hundidas; cuencas profundas; nariz
    if (p.y < -0.1 * s) { const k = smooth(-0.1 * s, -0.9 * s, p.y); p.x *= 1 - 0.32 * k; if (p.z > 0) p.z *= 1 - 0.12 * k; }
    p.x *= 1 - 0.1 * Math.exp(-Math.pow((p.y - 0.1 * s) / (0.25 * s), 2)) * smooth(0, 0.6 * s, Math.abs(p.z) < 0.5 * s ? s : 0);
    for (const sc of sockets) { const d = p.distanceTo(sc); if (d < 0.36 * s) p.z -= (0.36 * s - d) * 0.9; }
    { const nd = Math.hypot(p.x, p.y + 0.25 * s); if (p.z > 0.6 * s && nd < 0.14 * s) p.z -= (0.14 * s - nd) * 1.2; }
    P.setXYZ(i, p.x, p.y, p.z); }
  cr.computeVertexNormals();
  paint(cr, (q) => { let k = 0; for (const sc of sockets) k = Math.max(k, 1 - smooth(0.16 * s, 0.34 * s, q.distanceTo(sc))); const nose = q.z > 0.5 * s && Math.hypot(q.x, q.y + 0.25 * s) < 0.13 * s ? 1 : 0;
    const teeth = q.z > 0.55 * s && q.y < -0.62 * s && q.y > -0.88 * s ? (Math.sin(q.x / s * 38) > 0.35 ? 0.25 : 0) : 0;
    return new THREE.Color(bone).lerp(new THREE.Color(0x8a7a60), smooth(0.3 * s, -0.9 * s, q.y) * 0.4).lerp(new THREE.Color(dark), Math.max(k, nose, teeth)); });
  const jaw = ellipsoid([s * 0.62, s * 0.22, s * 0.62 * long], { w: L.low ? 10 : 14, h: L.low ? 6 : 8, seed: seed + 3, pos: [0, -0.92 * s, 0.32 * s * long] });
  paint(jaw, (q) => new THREE.Color(bone).multiplyScalar(0.85).lerp(new THREE.Color(dark), q.z > 0.75 * s && q.y > -0.95 * s ? (Math.sin(q.x / s * 38) > 0.2 ? 0.8 : 0.1) : 0));
  return { cranium: cr, jaw, sockets };
}
/** Cara humana pálida y serena (porcelana / difunta): +Z = cara. Cuencas suaves, nariz, labios. */
export function cara(s = 0.11, { skin = 0xe8e0d8, socket = 0x2a2030, lips = 0x8a5060, seed = 6, gaunt = 0.3 } = {}) {
  const L = lod(), g = ellipsoid([s * 0.78, s * 1.0, s * 0.9], { w: L.low ? 14 : 22, h: L.low ? 12 : 18, noise: 0.02, seed });
  const P = g.attributes.position, p = new V3(), so = [[-0.34, 0.12, 0.8], [0.34, 0.12, 0.8]].map((v) => new V3(v[0] * s, v[1] * s, v[2] * s));
  for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i);
    if (p.y < 0) { const k = smooth(0, -s, p.y); p.x *= 1 - 0.28 * k; p.z += k * 0.08 * s * (p.z > 0 ? 1 : 0); }
    for (const sc of so) { const d = p.distanceTo(sc); if (d < 0.3 * s) p.z -= (0.3 * s - d) * 0.5; }
    if (p.z > 0.6 * s && Math.abs(p.x) < 0.09 * s && p.y < 0.15 * s && p.y > -0.3 * s) p.z += (0.09 * s - Math.abs(p.x)) * 0.9 * smooth(0.15 * s, -0.3 * s, p.y) * 1.6;   // nariz
    if (Math.abs(p.x) > 0.4 * s && p.y < 0 && p.y > -0.6 * s) { p.x *= 1 - gaunt * 0.12; }   // mejillas hundidas
    P.setXYZ(i, p.x, p.y, p.z); }
  g.computeVertexNormals();
  paint(g, (q) => { let k = 0; for (const sc of so) k = Math.max(k, 1 - smooth(0.1 * s, 0.26 * s, q.distanceTo(sc))); const lip = q.z > 0.55 * s && Math.abs(q.x) < 0.22 * s && q.y < -0.44 * s && q.y > -0.6 * s ? 1 : 0;
    return new THREE.Color(skin).lerp(new THREE.Color(lips), lip * 0.8).lerp(new THREE.Color(socket), k); });
  return g;
}
/** Mano huesuda (dedos largos). Geometría en el marco de la muñeca: dedos hacia -Y; palma mira +Z. claw = garra en la punta. */
export function mano(len = 0.16, { fingers = 4, spread = 0.5, curl = 0.25, r = 0.012, claw = 0, color = 0xd9ccb0, clawColor = 0x2a2018, thumb = true } = {}) {
  const L = lod(), parts = [], pw = len * 0.42;
  const palm = ellipsoid([pw * 0.55, len * 0.26, pw * 0.2], { w: L.low ? 8 : 10, h: 6, pos: [0, -len * 0.22, 0] }); paint(palm, color); parts.push(palm);
  for (let i = 0; i < fingers; i++) { const x = (i / Math.max(1, fingers - 1) - 0.5) * pw, l = len * (0.62 + 0.18 * Math.sin((i / (fingers - 1 || 1)) * Math.PI)), dx = x * spread * 1.4;
    const f = tube([[x, -len * 0.42, 0], [x + dx * 0.4, -len * 0.42 - l * 0.45, curl * l * 0.3], [x + dx, -len * 0.42 - l * 0.85, curl * l * 0.9], [x + dx * 1.1, -len * 0.42 - l, curl * l * 1.5]], { rad: (t) => r * (1 - t * 0.55) * (1 + 0.25 * Math.exp(-Math.pow((t - 0.45) / 0.07, 2))), seg: L.low ? 4 : 7, sides: L.low ? 4 : 5 });
    paint(f, color); parts.push(f);
    if (claw) { const c = spike(r * 0.9, claw, { sides: 4, seg: 2, bend: 0.5, bendDir: [0, 0, 1], pos: [x + dx * 1.1, -len * 0.42 - l, curl * l * 1.5], dir: [dx * 0.3, -1, curl * 1.4] }); paint(c, clawColor); parts.push(c); } }
  if (thumb) { const t = tube([[pw * 0.5, -len * 0.15, 0.01], [pw * 0.85, -len * 0.35, 0.05], [pw * 0.95, -len * 0.55, 0.09]], { rad: [r * 1.1, r * 0.6], seg: 4, sides: 4 }); paint(t, color); parts.push(t); }
  return joinUV(parts.map((g) => { const c = g.index ? g.toNonIndexed() : g; return c; }));
}

/* ═════════════ HUMANOIDE ═════════════ */
/**
 * Esqueleto y cuerpo humanoide flaco. Coordenadas de reposo en «metros del modelo» (pies en y=0). Devuelve huesos y brazos/piernas
 * listos para IK con footTo(). Opciones principales:
 *  H (alto de la coronilla), shoulder (medio ancho de hombros), hip, torso: fn(t) radio (t 0 pelvis → 1 cuello), torsoEx [ancho, fondo],
 *  arm [brazo, antebrazo], armR [r hombro, r muñeca], hand (largo), claw, fingers, legs (bool), leg [muslo, pierna], legR,
 *  matSkin (cuerpo), matHand (manos; por defecto matSkin), ribs (costillas marcadas: pinta), color fn(p) para pintar el cuerpo.
 */
export function humanoide(rig, o = {}) {
  const L = lod(), { H = 1.8, shoulder = 0.2, hip = 0.11, arm = [0.3, 0.28], armR = [0.045, 0.026], hand = 0.17, claw = 0, fingers = 4, legs = true, leg = [0.42, 0.42], legR = [0.06, 0.03], matSkin, matHand = null, torsoEx = [1, 0.72], hunch = 0, armPaint = null, legPaint = null, torsoPaint = null, neckLen = 0.1, curl = 0.25, root = null } = o;
  const pelY = legs ? leg[0] + leg[1] + 0.06 : (o.pelY ?? H * 0.5), neckY = H - 0.24 - neckLen * 0.5, chestY = lerp(pelY, neckY, 0.68), spineY = lerp(pelY, neckY, 0.34);
  const hz = hunch; // joroba: el pecho y la cabeza van hacia adelante
  const rootB = root || rig.bone(null, [0, 0, 0], 'root');
  const pelvis = rig.bone(rootB, [0, pelY, 0], 'pelvis'), spine = rig.bone(pelvis, [0, spineY, -0.02 + hz * 0.1], 'spine'), chest = rig.bone(spine, [0, chestY, hz * 0.3], 'chest');
  const neck = rig.bone(chest, [0, neckY, hz * 0.55 + 0.01], 'neck'), head = rig.bone(neck, [0, neckY + neckLen, hz * 0.65 + 0.03], 'head');
  const torso = o.torso || ((t) => lerp(0.1, 0.13, smooth(0, 0.3, t)) * (1 - 0.25 * Math.exp(-Math.pow((t - 0.45) / 0.12, 2))) + 0.04 * smooth(0.55, 0.8, t) - 0.08 * smooth(0.85, 1.0, t));
  const SP = [[0, pelY - 0.05, -0.01], pelvis.userData.rest.toArray(), spine.userData.rest.toArray(), chest.userData.rest.toArray(), neck.userData.rest.toArray(), [0, neckY + neckLen * 0.6, hz * 0.6 + 0.02]];
  const tg = tube(SP, { rad: torso, seg: L.low ? 14 : 22, sides: L.low ? 8 : 12, ex: torsoEx, bulge: o.torsoBulge || ((t, a) => 1 + 0.06 * Math.max(0, Math.cos(a)) * smooth(0.5, 0.8, t)) });
  if (torsoPaint) paint(tg, torsoPaint); else paint(tg, 0xbfc4c8);
  rig.add(matSkin, skinChain(tg, [pelvis, spine, chest, neck], 0.08));
  const mkArm = (s) => {
    const sh = new V3(s * shoulder, neckY - 0.05, hz * 0.45), cl = rig.bone(chest, [s * 0.05, neckY - 0.06, hz * 0.4], 'clav');
    const up = rig.bone(cl, sh.toArray(), 'up'), el = sh.clone().add(new V3(s * 0.05, -arm[0], 0.02)), fo = rig.bone(up, el.toArray(), 'fo');
    const wr = el.clone().add(new V3(s * 0.02, -arm[1], 0.06)), hd = rig.bone(fo, wr.toArray(), 'hand'), tip = wr.clone().add(new V3(0, -hand, 0.02)), fg = rig.bone(hd, wr.clone().lerp(tip, 0.45).toArray(), 'fing');
    const ag = tube([[s * 0.06, neckY - 0.05, hz * 0.42], sh.toArray(), sh.clone().lerp(el, 0.5).add(new V3(s * 0.01, 0, -0.005)).toArray(), el.toArray(), el.clone().lerp(wr, 0.5).toArray(), wr.toArray()], { rad: (t) => { const k = t < 0.2 ? lerp(armR[0] * 0.9, armR[0], t / 0.2) : t < 0.6 ? lerp(armR[0], armR[0] * 0.7, (t - 0.2) / 0.4) + armR[0] * 0.25 * Math.exp(-Math.pow((t - 0.6) / 0.05, 2)) : lerp(armR[0] * 0.7, armR[1], (t - 0.6) / 0.4); return k; }, seg: L.low ? 10 : 16, sides: L.low ? 6 : 8 });
    if (armPaint) paint(ag, armPaint); else paint(ag, 0xbfc4c8);
    rig.add(matSkin, skinChain(ag, [cl, up, fo, hd], 0.05));
    const hg = mano(hand, { claw, fingers, curl, r: armR[1] * 0.42, color: o.handColor ?? 0xcfc6b8, clawColor: o.clawColor ?? 0x201814 });
    const fwd = wr.clone().sub(el).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), fwd); const hp = hg.clone(); hp.applyMatrix4(new THREE.Matrix4().compose(wr, q, new V3(1, 1, 1)));
    rig.add(matHand || matSkin, skinFn(hp, (p) => { const d = p.distanceTo(wr); return [[hd, 1 - smooth(hand * 0.35, hand * 0.6, d)], [fg, smooth(hand * 0.35, hand * 0.6, d)]]; }));
    return { cl, up, fo, hand: hd, fing: fg, hb: up, kb: fo, fb: hd, par: cl, side: s, rest: { sh, el, wr } };
  };
  const armL = mkArm(1), armR2 = mkArm(-1);
  let legL = null, legR2 = null;
  if (legs) {
    const mkLeg = (s) => {
      const hp = new V3(s * hip, pelY - 0.04, 0), kn = new V3(s * hip * 1.05, pelY - 0.04 - leg[0], 0.04), an = new V3(s * hip * 1.05, 0.07, 0), toe = new V3(s * hip * 1.1, 0.02, 0.16);
      const th = rig.bone(pelvis, hp.toArray(), 'th'), sh = rig.bone(th, kn.toArray(), 'sh'), ft = rig.bone(sh, an.toArray(), 'ft');
      const lg = tube([hp.toArray(), hp.clone().lerp(kn, 0.5).add(new V3(0, 0, 0.012)).toArray(), kn.toArray(), kn.clone().lerp(an, 0.5).add(new V3(0, 0, -0.01)).toArray(), an.toArray()], { rad: (t) => t < 0.5 ? lerp(legR[0], legR[0] * 0.62, t / 0.5) + legR[0] * 0.2 * Math.exp(-Math.pow((t - 0.5) / 0.05, 2)) : lerp(legR[0] * 0.6, legR[1], (t - 0.5) / 0.5), seg: L.low ? 10 : 14, sides: L.low ? 6 : 8 });
      if (legPaint) paint(lg, legPaint); else paint(lg, 0xbfc4c8);
      rig.add(matSkin, skinChain(lg, [th, sh, ft], 0.06));
      const fg = tube([an.toArray(), an.clone().lerp(toe, 0.5).add(new V3(0, -0.02, 0)).toArray(), toe.toArray()], { rad: [legR[1] * 1.1, legR[1] * 0.5], seg: 4, sides: 5 }); paint(fg, o.footColor ?? 0xb0a898);
      rig.add(matSkin, skinRigid(fg, ft));
      return { hb: th, kb: sh, fb: ft, par: pelvis, side: s, rest: { hp, kn, an } };
    };
    legL = mkLeg(1); legR2 = mkLeg(-1);
  }
  return { root: rootB, pelvis, spine, chest, neck, head, armL, armR: armR2, legL, legR: legR2, Y: { pelY, chestY, neckY, spineY, H } };
}
/** Lleva la mano del brazo `A` a `target` (espacio del modelo) con IK; bend = hacia dónde sale el codo. */
export function alcanzar(A, rootBone, target, bend, cache) { footTo(A, rootBone, target, bend, cache); }

/** Busca un hijo del pivote del render por nombre (beacon/beaconDark/elite) para ocultarlo en camuflaje. */
export function hermanos(obj, names) { const p = obj.parent; return p ? p.children.filter((c) => names.includes(c.name)) : []; }

/* ═════════════ CUADRÚPEDO ═════════════ */
/**
 * Esqueleto + cuerpo de cuadrúpedo (mula, perro, lobo). Pies en y=0, frente +Z. Opciones:
 *  len (largo del lomo), hipY, chestY, lx (medio ancho entre patas), barrel fn(t) radio del tronco (t 0 grupa → 1 cruz), ex [ancho, alto],
 *  neck: [[dy,dz],[dy,dz]] (cuello relativo al pecho), head (bool), tail {n, len, rise}, front [brazo, antebrazo], rear [muslo, pierna],
 *  legR [r0, r1], foot (largo pezuña/pata), matBody, matLeg, bodyPaint, legPaint, footColor.
 * Devuelve huesos y patas (FL, FR, RL, RR) con `base` (apoyo en reposo) listas para andar().
 */
export function cuadrupedo(rig, o = {}) {
  const L = lod(), { len = 1.2, hipY = 0.8, chestY = 0.85, lx = 0.16, ex = [0.85, 1.05], neck = [[0.12, 0.12], [0.32, 0.32]], tail = { n: 4, len: 0.6, rise: 0.1 }, front = [0.38, 0.38], rear = [0.4, 0.42], legR = [0.07, 0.03], foot = 0.08, matBody, matLeg = null, bodyPaint = null, legPaint = null, footColor = 0x1a1410, frontBend = -1, rearBend = 1, flex = 0.12 } = o;
  const barrel = o.barrel || ((t) => 0.2 + 0.05 * Math.sin(t * Math.PI));
  const root = rig.bone(null, [0, 0, 0], 'root');
  const pelvis = rig.bone(root, [0, hipY, -len / 2], 'pelvis'), spine = rig.bone(pelvis, [0, (hipY + chestY) / 2 + 0.03, 0], 'spine'), chest = rig.bone(spine, [0, chestY, len / 2], 'chest');
  const n0p = [0, chestY + neck[0][0], len / 2 + neck[0][1]], n1p = [0, chestY + neck[1][0], len / 2 + neck[1][1]];
  const neck0 = rig.bone(chest, n0p, 'neck0'), neck1 = rig.bone(neck0, n1p, 'neck1');
  const head = o.head === false ? null : rig.bone(neck1, [0, n1p[1] + 0.02, n1p[2] + 0.06], 'head');
  // tronco: grupa → lomo → cruz → cuello (afinándose)
  const SP = [[0, hipY + 0.02, -len / 2 - 0.12], pelvis.userData.rest.toArray(), spine.userData.rest.toArray(), chest.userData.rest.toArray(), n0p, n1p];
  const rf = (t) => (t < 0.8 ? barrel(t / 0.8) : lerp(barrel(1), o.neckR ?? 0.08, smooth(0.8, 1, t)));
  const bg = tube(SP, { rad: rf, seg: L.low ? 16 : 26, sides: L.low ? 9 : 13, ex, bulge: o.bulge || null });
  if (bodyPaint) paint(bg, bodyPaint); else paint(bg, 0x2a2420);
  rig.add(matBody, skinChain(bg, [pelvis, spine, chest, neck0, neck1], 0.1));
  // cola
  const tb = []; if (tail && tail.n) { let par = pelvis; for (let i = 0; i < tail.n; i++) { const k = (i + 1) / tail.n; const b = rig.bone(par, [0, hipY + 0.06 + tail.rise * Math.sin(k * 1.4) - 0.1 * k * k, -len / 2 - 0.1 - tail.len * k], 'tail' + i); tb.push(b); par = b; } }
  // patas
  const mkLeg = (s, isFront) => {
    const z0 = isFront ? len / 2 - 0.02 : -len / 2, y0 = isFront ? chestY - 0.06 : hipY - 0.03, seg = isFront ? front : rear;
    const S = new V3(s * lx, y0, z0), E = new V3(s * lx * 1.02, y0 - seg[0], z0 + (isFront ? -0.08 : 0.14) * (isFront ? -frontBend : rearBend)), A = new V3(s * lx, Math.max(foot * 0.9, y0 - seg[0] - seg[1]), z0 + (isFront ? 0.02 : -0.06)), F = new V3(s * lx, 0.0, A.z + foot * 0.6);
    const hb = rig.bone(isFront ? chest : pelvis, S.toArray(), 'L1'), kb = rig.bone(hb, E.toArray(), 'L2'), fb = rig.bone(kb, A.toArray(), 'L3');
    const g = tube([S.clone().add(new V3(0, 0.1, isFront ? 0.02 : -0.04)).toArray(), S.toArray(), S.clone().lerp(E, 0.5).add(new V3(s * 0.01, 0, isFront ? 0.02 : 0.03)).toArray(), E.toArray(), E.clone().lerp(A, 0.5).toArray(), A.toArray()], { rad: (t) => (t < 0.45 ? lerp(legR[0] * 1.3, legR[0], t / 0.45) : lerp(legR[0] * 0.75, legR[1], (t - 0.45) / 0.55)) * (1 + 0.18 * Math.exp(-Math.pow((t - 0.47) / 0.05, 2))), seg: L.low ? 10 : 15, sides: L.low ? 6 : 8 });
    if (legPaint) paint(g, legPaint); else paint(g, 0x2a2420);
    rig.add(matLeg || matBody, skinChain(g, [hb, kb, fb], 0.07));
    const fg = o.footGeo ? o.footGeo(A, F, s, isFront) : (() => { const q = tube([A.toArray(), A.clone().lerp(F, 0.5).add(new V3(0, -0.01, 0)).toArray(), F.toArray()], { rad: [legR[1] * 1.25, legR[1] * 1.1], seg: 3, sides: 6 }); paint(q, footColor); return q; })();
    rig.add(matLeg || matBody, skinRigid(fg, fb));
    return { hb, kb, fb, par: isFront ? chest : pelvis, side: s, front: isFront, base: new V3(A.x, A.y, A.z), rest: { S, E, A } };
  };
  const legs = [mkLeg(1, true), mkLeg(-1, true), mkLeg(1, false), mkLeg(-1, false)];
  return { root, pelvis, spine, chest, neck0, neck1, head, tail: tb, legs, Y: { hipY, chestY, len } };
}
const _tg = new V3();
/**
 * Marcha de cuadrúpedo por IK. ph = fase, k = 0..1 cuánto camina, stride, lift, order = desfases por pata [FL,FR,RL,RR] en vueltas
 * (trote: [0,.5,.5,0]; galope: [0,.12,.55,.67]). override(i, tgt) permite retocar cada objetivo (posturas). bendF/bendR = rodillas.
 */
export function andar(Q, ph, k, { stride = 0.3, lift = 0.16, order = [0, 0.5, 0.5, 0], duty = 0.55, override = null, cache = null, bendF = new V3(0, 0, -1), bendR = new V3(0, 0.2, 1) } = {}) {
  Q.legs.forEach((Lg, i) => {
    const [adv, up] = gait(ph + order[i] * TAU, 1 - duty);
    _tg.copy(Lg.base); _tg.z += adv * stride * k; _tg.y += up * lift * k;
    if (override) override(i, _tg, Lg);
    footTo(Lg, Q.root, _tg, Lg.front ? bendF : bendR, cache);
  });
}
/** Cabeza canina (perro/lobo): cráneo + hocico + orejas, con mandíbula aparte. Origen = articulación del cuello; +Z = hocico. */
export function cabezaCanina(s = 0.2, { snout = 1.0, ears = 1.0, color = 0x141010, nose = 0x050404, gum = 0x501018, teethC = 0xe8dcc0, seed = 3, lupino = 0 } = {}) {
  const L = lod(), parts = [];
  const sk = ellipsoid([s * 0.62, s * 0.55, s * 0.62], { w: L.low ? 12 : 18, h: L.low ? 9 : 13, noise: 0.06, seed, pos: [0, s * 0.18, s * 0.1] }); paint(sk, color); parts.push(sk);
  const sn = tube([[0, s * 0.12, s * 0.35], [0, s * 0.06, s * 0.7 * snout], [0, s * 0.0, s * 1.05 * snout]], { rad: [s * 0.33, s * 0.17], seg: L.low ? 5 : 8, sides: L.low ? 8 : 10, ex: [1, 0.85] }); paint(sn, (p) => new THREE.Color(color).lerp(new THREE.Color(0x2a2220), 0.3)); parts.push(sn);
  const ns = ellipsoid([s * 0.11, s * 0.08, s * 0.08], { w: 8, h: 6, pos: [0, s * 0.05, s * 1.07 * snout] }); paint(ns, nose); parts.push(ns);
  for (const sd of [-1, 1]) { const e = spike(s * 0.16, s * 0.55 * ears, { sides: 4, seg: 3, bend: 0.2, bendDir: [0, 0, -1], pos: [sd * s * 0.3, s * 0.55, s * 0.0], dir: [sd * 0.35, 1, -0.25 - lupino * 0.2] }); paint(e, color); e.scale(1, 1, 0.5); parts.push(e);
    const brow = ellipsoid([s * 0.16, s * 0.07, s * 0.14], { w: 8, h: 5, pos: [sd * s * 0.22, s * 0.36, s * 0.4] }); paint(brow, color); parts.push(brow); }
  // dientes superiores (colmillos)
  for (let i = 0; i < (L.low ? 4 : 8); i++) { const sd = i % 2 ? 1 : -1, z = s * (0.95 - Math.floor(i / 2) * 0.13) * snout, big = Math.floor(i / 2) === 0; const tth = spike(s * (big ? 0.035 : 0.022), s * (big ? 0.22 : 0.1), { sides: 4, seg: 1, pos: [sd * s * 0.12 * (1 + Math.floor(i / 2) * 0.12), -s * 0.06, z], dir: [0, -1, 0.08] }); paint(tth, teethC); parts.push(tth); }
  const jaw = []; { const j = tube([[0, -s * 0.05, s * 0.25], [0, -s * 0.12, s * 0.6 * snout], [0, -s * 0.1, s * 0.98 * snout]], { rad: [s * 0.2, s * 0.1], seg: L.low ? 4 : 6, sides: L.low ? 7 : 9, ex: [1, 0.55] }); paint(j, (p) => new THREE.Color(color).lerp(new THREE.Color(gum), p.y > -s * 0.08 ? 0.7 : 0)); jaw.push(j);
    for (let i = 0; i < (L.low ? 2 : 6); i++) { const sd = i % 2 ? 1 : -1, z = s * (0.9 - Math.floor(i / 2) * 0.15) * snout; const tth = spike(s * 0.025, s * 0.12, { sides: 4, seg: 1, pos: [sd * s * 0.09, -s * 0.07, z], dir: [0, 1, -0.05] }); paint(tth, teethC); jaw.push(tth); } }
  return { skull: joinUV(parts), jaw: joinUV(jaw), eyePos: [[-s * 0.24, s * 0.3, s * 0.48], [s * 0.24, s * 0.3, s * 0.48]] };
}
/** Varias llamas en UNA malla (1 draw call): items = [{ pos:[x,y,z], dir:[x,y,z], w, h }]. */
export function llamas(mat, items) {
  const base = fireGeo(), parts = items.map((it) => { const g = base.clone(); g.scale((it.w || 0.3) / 0.32, it.h || 0.8, (it.w || 0.3) / 0.32); return place(g, { pos: it.pos || [0, 0, 0], dir: it.dir || [0, 1, 0], spin: it.spin || 0 }); });
  const m = new THREE.Mesh(mergeGeometries(parts, false), mat); m.frustumCulled = false; m.renderOrder = 3; return m;
}
