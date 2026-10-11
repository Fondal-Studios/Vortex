// KIT ORGÁNICO — bloques para construir criaturas VIVAS (no formas geométricas): carne que respira, venas,
// bioluminiscencia, ojos húmedos que miran, tentáculos que ondulan, mandíbulas, patas con cinemática inversa
// y cristales que brotan de la piel (biocristal). Todo procedural, pensado para móvil (calidad baja) y PC (alta).
import * as THREE from 'three';
import { uTime, crystalMaterial } from './shaders.js';
import { cfg } from './quality.js';

export { crystalMaterial };
export const TAU = Math.PI * 2;
const V3 = THREE.Vector3;

/* ───────────────────────── materiales ───────────────────────── */
const NOISE_GLSL = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }`;

/**
 * Piel/carne viva. Opciones: color (base), vein (color de venas), spot (color de lunares bioluminiscentes),
 * glow (emisión base), wobble (amplitud de pulso de la superficie), breath (respiración), rough, sheen, iri (iridiscencia),
 * alpha (membranas translúcidas). Uniformes vivos en mat.userData.u: uHurt, uGlow, uPulse, uSquash(x,y,z).
 */
export function fleshMaterial({ color = 0xff8a7a, vein = 0x7a0f3a, spot = 0x66ffee, glow = 0.0, wobble = 0.03, breath = 0.03, rough = 0.42, sheen = 0.8, iri = 0.0, alpha = 1, veins = 0.5, spots = 0.0, scale = 2.2, flat = false } = {}) {
  const q = cfg();
  const hi = q.humans !== 'low';
  const Cls = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Cls({ color, roughness: rough, metalness: 0.0, transparent: alpha < 1, opacity: alpha, side: alpha < 1 ? THREE.DoubleSide : THREE.FrontSide, flatShading: flat });
  if (hi) { mat.sheen = sheen; mat.sheenColor = new THREE.Color(spot).lerp(new THREE.Color(0xffffff), 0.5); mat.sheenRoughness = 0.5; mat.clearcoat = 0.45; mat.clearcoatRoughness = 0.28; if (iri > 0) { mat.iridescence = iri; mat.iridescenceIOR = 1.6; mat.iridescenceThicknessRange = [200, 700]; } }
  const u = { uTime, uHurt: { value: 0 }, uGlow: { value: glow }, uPulse: { value: 0 }, uSquash: { value: new V3(1, 1, 1) }, uWob: { value: wobble }, uBreath: { value: breath }, uVein: { value: new THREE.Color(vein) }, uSpot: { value: new THREE.Color(spot) }, uVeins: { value: veins }, uSpots: { value: spots }, uScale: { value: scale }, uPhase: { value: Math.random() * 6.28 } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime,uWob,uBreath,uPulse,uPhase; uniform vec3 uSquash; varying vec3 vObj; ${NOISE_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vObj = position;
        float nz = vn(position * 2.3 + vec3(0.0, uTime * 0.9 + uPhase, 0.0)) - 0.5;
        float br = sin(uTime * 2.2 + uPhase) * uBreath + uPulse * 0.08 * sin(uTime * 22.0);
        transformed += normal * (nz * uWob + br);
        transformed *= uSquash;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime,uHurt,uGlow,uVeins,uSpots,uScale; uniform vec3 uVein,uSpot; varying vec3 vObj; ${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float vn1 = vn(vObj * uScale * 2.0), vn2 = vn(vObj * uScale * 5.0 + 7.0);
        float vein = smoothstep(0.46, 0.5, abs(vn1 - 0.5)) ; vein = 1.0 - vein;           // red-vein network
        diffuseColor.rgb = mix(diffuseColor.rgb, uVein, vein * uVeins * (0.5 + 0.5 * vn2));
        float spotK = smoothstep(0.72, 0.8, vn(vObj * uScale * 3.2 + 11.0)) * uSpots;       // bioluminescent spots
        diffuseColor.rgb = mix(diffuseColor.rgb, uSpot, spotK);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float pulse = 0.65 + 0.35 * sin(uTime * 3.0 + vObj.y * 4.0);
        totalEmissiveRadiance += uSpot * (spotK * (1.6 + pulse) + uGlow * pulse) + vec3(1.0, 0.85, 0.7) * uHurt * 0.9;`);
  };
  return mat;
}

/** Hueso/quitina/placa dura (caparazón, dientes, garras): lisa y satinada. */
export function boneMaterial(color = 0xf2e6cf, { rough = 0.35, glow = 0 } = {}) {
  const hi = cfg().humans !== 'low'; const Cls = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Cls({ color, roughness: rough, metalness: 0.05 });
  if (hi) { m.clearcoat = 0.7; m.clearcoatRoughness = 0.2; m.sheen = 0.3; }
  m.emissive = new THREE.Color(color).multiplyScalar(glow);
  m.userData.u = { uHurt: { value: 0 }, uGlow: { value: glow } };
  return m;
}

/** Cristal que brota de la carne (biocristal): translúcido, iridiscente, emisivo. */
export function bioCrystalMaterial(color = 0x66ffee, { glow = 0.7 } = {}) {
  const hi = cfg().humans !== 'low';
  const Cls = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Cls({ color, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88, flatShading: true, emissive: new THREE.Color(color), emissiveIntensity: glow });
  if (hi) { m.iridescence = 1; m.iridescenceIOR = 1.8; m.iridescenceThicknessRange = [250, 800]; m.clearcoat = 1; }
  m.userData.u = { uHurt: { value: 0 }, uGlow: { value: glow } };
  return m;
}

/* ───────────────────────── geometrías ───────────────────────── */
const geoCache = new Map();
const cache = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const SEG = () => (cfg().humans === 'low' ? [14, 10] : cfg().humans === 'medium' ? [20, 14] : [28, 20]);

/** Cuerpo blando: esfera lisa estirable (sx,sy,sz). */
export function blob(mat, r = 1, sx = 1, sy = 1, sz = 1) {
  const [w, h] = SEG(); const m = new THREE.Mesh(cache(`sph${w}`, () => new THREE.SphereGeometry(1, w, h)), mat); m.scale.set(r * sx, r * sy, r * sz); return m;
}
/** Cápsula orgánica (torso, cola, segmentos). */
export function capsule(mat, r = 0.5, len = 1) {
  const [w] = SEG(); const m = new THREE.Mesh(cache(`cap${w}`, () => new THREE.CapsuleGeometry(1, 1, 6, w)), mat); m.scale.set(r, len, r); return m;
}
/** Cono liso (espina, cuerno, diente, garra) con la base en y=0 y la punta en y=h. */
export function horn(mat, r = 0.1, h = 0.6, sides = 7) {
  const g = cache(`horn${sides}`, () => { const c = new THREE.ConeGeometry(1, 1, sides, 1); c.translate(0, 0.5, 0); return c; });
  const m = new THREE.Mesh(g, mat); m.scale.set(r, h, r); return m;
}
/** Prisma de cristal con punta (biocristal). */
export function crystalSpike(mat, r = 0.1, h = 0.6) {
  const g = cache('cspike', () => { const c = new THREE.CylinderGeometry(0.0, 1, 1, 6, 1); const body = new THREE.CylinderGeometry(1, 1, 1.0, 6, 1); body.translate(0, 0.5, 0); c.translate(0, 1.5, 0); const geo = body; return geo; });
  const tip = cache('ctip', () => { const c = new THREE.ConeGeometry(1, 0.7, 6); c.translate(0, 0.35, 0); return c; });
  const grp = new THREE.Group(); const a = new THREE.Mesh(g, mat), b = new THREE.Mesh(tip, mat); b.position.y = 1.0; grp.add(a, b); grp.scale.set(r, h, r); return grp;
}

/** Distribuye `n` objetos sobre la superficie de un elipsoide (puntos de Fibonacci). `make(i, normal)` devuelve un Object3D. */
export function scatterOnSurface(parent, n, radii, make, { from = 0, to = 1, seed = 1 } = {}) {
  const out = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (from + (to - from) * (i + 0.5) / n), rr = Math.sqrt(Math.max(0, 1 - y * y)), th = i * ga + seed;
    const nrm = new V3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    const o = make(i, nrm); if (!o) continue;
    o.position.set(nrm.x * radii[0], nrm.y * radii[1], nrm.z * radii[2]);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(nrm.x / radii[0], nrm.y / radii[1], nrm.z / radii[2]).normalize());
    parent.add(o); out.push(o);
  }
  return out;
}

/* ───────────────────────── tentáculos ───────────────────────── */
/**
 * Tentáculo que ondula por shader (barato: 1 draw call). Base en y=0, punta en y=-len (cuelga) si `hang`, o +len.
 * Controles vivos: t.userData.u.uAmp (agitación), uSpeed, uPhase.
 */
export function tentacle(baseMat, { len = 2, r0 = 0.12, r1 = 0.02, hang = true, amp = 0.25, speed = 2.2, freq = 3.0, phase = Math.random() * 6.28 } = {}) {
  const segs = cfg().humans === 'low' ? 8 : 16, rad = cfg().humans === 'low' ? 5 : 8;
  const g = new THREE.CylinderGeometry(r1, r0, len, rad, segs, false); g.translate(0, len / 2, 0); if (hang) g.rotateX(Math.PI);
  const mat = baseMat.clone(); mat.userData.u = { ...(baseMat.userData.u || {}) };
  const uni = { uAmp: { value: amp }, uSpeed: { value: speed }, uFreq: { value: freq }, uTPhase: { value: phase }, uLen: { value: len }, uDir: { value: hang ? -1 : 1 } };
  const prev = baseMat.onBeforeCompile; const baseU = baseMat.userData.u;
  mat.onBeforeCompile = (sh, rd) => {
    if (prev) prev(sh, rd); Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uAmp,uSpeed,uFreq,uTPhase,uLen,uDir;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float k = clamp(abs(position.y) / uLen, 0.0, 1.0); float w = k * k;
          transformed.x += sin(uTime * uSpeed + k * uFreq + uTPhase) * uAmp * w;
          transformed.z += cos(uTime * uSpeed * 0.8 + k * uFreq * 1.3 + uTPhase) * uAmp * 0.7 * w; }`);
  };
  mat.userData.u = { ...baseU, ...uni }; // los uniformes de la piel base se comparten por referencia
  const m = new THREE.Mesh(g, mat); m.userData.u = uni; m.userData.mat = mat; return m;
}

/* ───────────────────────── ojos ───────────────────────── */
const eyeGeo = () => cache('eye', () => new THREE.SphereGeometry(1, 16, 12));
/** Ojo húmedo con iris y pupila que SIGUEN al objetivo. update(dt, lookLocal:Vector3, {blink, dilate}) */
export function eye({ r = 0.2, iris = 0xffc23a, pupil = 'round', glow = 0.5 } = {}) {
  const g = new THREE.Group();
  const sclera = new THREE.MeshPhysicalMaterial({ color: 0xf6efe4, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(0x221510), emissiveIntensity: 0.4 });
  const irisM = new THREE.MeshStandardMaterial({ color: iris, roughness: 0.3, emissive: new THREE.Color(iris), emissiveIntensity: glow });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050205 });
  const ball = new THREE.Mesh(eyeGeo(), sclera); ball.scale.setScalar(r);
  const look = new THREE.Group(); // rota hacia el objetivo
  const irisMesh = new THREE.Mesh(cache('iris', () => new THREE.CircleGeometry(1, 20)), irisM); irisMesh.scale.setScalar(r * 0.62); irisMesh.position.z = r * 1.02;
  const pup = new THREE.Mesh(cache('pupil', () => new THREE.CircleGeometry(1, 16)), dark); pup.position.z = r * 1.035;
  pup.scale.set(pupil === 'slit' ? r * 0.12 : r * 0.3, r * 0.3 * (pupil === 'slit' ? 2.6 : 1), 1);
  look.add(irisMesh, pup); g.add(ball, look);
  const lid = new THREE.Mesh(cache('lid', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2)), new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.6 })); lid.scale.setScalar(r * 1.04); lid.rotation.x = -Math.PI / 2 + 0.3; g.add(lid);
  let blinkT = 1 + Math.random() * 3, blink = 0; const tmp = new V3();
  return {
    object: g, mats: [sclera, irisM],
    update(dt, lookLocal, { dilate = 0, glowMul = 1 } = {}) {
      if (lookLocal) { tmp.copy(lookLocal).normalize(); const ax = Math.atan2(tmp.x, tmp.z), ay = Math.asin(THREE.MathUtils.clamp(tmp.y, -1, 1)); look.rotation.set(-THREE.MathUtils.clamp(ay, -0.7, 0.7) * 0.55, THREE.MathUtils.clamp(ax, -0.9, 0.9) * 0.55, 0); }
      blinkT -= dt; if (blinkT <= 0) { blink = 1; blinkT = 2 + Math.random() * 4; } blink = Math.max(0, blink - dt * 7);
      lid.rotation.x = -Math.PI / 2 + 0.3 + (1 - Math.abs(blink * 2 - 1)) * 1.1;
      pup.scale.x = (pupil === 'slit' ? r * 0.12 : r * 0.3) * (1 + dilate); if (pupil !== 'slit') pup.scale.y = r * 0.3 * (1 + dilate); irisM.emissiveIntensity = glow * glowMul;
    },
  };
}

/* ───────────────────────── mandíbula ───────────────────────── */
/** Boca con dientes: dos mitades que se abren. open ∈ [0,1]. */
export function jaw(skin, boneMat, { w = 0.5, len = 0.5, teeth = 6 } = {}) {
  const g = new THREE.Group(), up = new THREE.Group(), lo = new THREE.Group();
  const half = (flip) => { const grp = flip ? lo : up; const m = new THREE.Mesh(cache('jawhalf', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2)), skin); m.scale.set(w, len * 0.5, len); m.rotation.x = Math.PI / 2 * 0; grp.add(m);
    for (let i = 0; i < teeth; i++) { const t = horn(boneMat, w * 0.09, len * 0.28); const a = (i / (teeth - 1) - 0.5) * 2; t.position.set(a * w * 0.85, 0, len * (0.85 - Math.abs(a) * 0.4)); t.rotation.x = flip ? 0.2 : Math.PI - 0.2; grp.add(t); } if (flip) grp.scale.y = -1; return grp; };
  g.add(half(false), half(true));
  return { object: g, set(open) { up.rotation.x = -open * 0.7; lo.rotation.x = open * 0.7; } };
}

/* ───────────────────────── patas con cinemática inversa ───────────────────────── */
/** Pata de 2 huesos. root en la cadera; setFoot(Vector3 local) coloca el pie y dobla la rodilla hacia `bend`. */
export function leg(mat, { upper = 0.7, lower = 0.8, r = 0.07, claw = null } = {}) {
  const root = new THREE.Group(), A = new THREE.Group(), B = new THREE.Group();
  const seg = (len, r0, r1) => { const m = new THREE.Mesh(cache(`seg${r0 > r1 ? 1 : 0}`, () => { const c = new THREE.CylinderGeometry(1, 0.55, 1, 8, 1); c.translate(0, -0.5, 0); return c; }), mat); m.scale.set(r0, len, r0); return m; };
  A.add(seg(upper, r, r * 0.8)); const knee = blob(mat, r * 1.25); knee.position.y = -upper; A.add(knee);
  B.position.y = -upper; B.add(seg(lower, r * 0.8, r * 0.5)); const foot = blob(mat, r * 0.7); foot.position.y = -lower; B.add(foot);
  if (claw) { const c = horn(claw, r * 0.6, r * 4); c.rotation.x = Math.PI; c.position.y = -lower; B.add(c); }
  A.add(B); root.add(A);
  const bend = new V3(0, 1, 0), tgt = new V3(), DOWN = new V3(0, -1, 0);
  function solve(foot) {
    tgt.copy(foot); let d = tgt.length(); const max = upper + lower - 1e-3; if (d > max) { tgt.multiplyScalar(max / d); d = max; } d = Math.max(d, Math.abs(upper - lower) + 1e-3);
    const ang = Math.acos(THREE.MathUtils.clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
    const dir = tgt.clone().normalize(); let axis = new V3().crossVectors(dir, bend); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    const kneeDir = dir.clone().applyAxisAngle(axis, -ang);               // hacia donde apunta el hueso superior
    A.quaternion.setFromUnitVectors(DOWN, kneeDir);
    const kneePos = kneeDir.clone().multiplyScalar(upper), lowDir = tgt.clone().sub(kneePos).normalize();
    const world2 = new THREE.Quaternion().setFromUnitVectors(DOWN, lowDir);
    B.quaternion.copy(A.quaternion.clone().invert().multiply(world2));
  }
  solve(new V3(0, -(upper + lower) * 0.9, 0));
  return { object: root, setFoot: solve, setBend(v) { bend.copy(v).normalize(); } };
}

/* ───────────────────────── utilidades de vida ───────────────────────── */
/** Resorte crítico-amortiguado para movimiento secundario (colas, antenas, cabezas). */
export class Spring { constructor(x = 0, k = 60, d = 8) { this.x = x; this.v = 0; this.k = k; this.d = d; } step(dt, target) { const a = this.k * (target - this.x) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; } }
/** Aplica destello de daño a todos los materiales. */
export function setHurt(mats, v) { for (const m of mats) { const u = m.userData && m.userData.u; if (u && u.uHurt) u.uHurt.value = v; else if (m.emissive && !m.userData._e) { m.userData._e = m.emissive.clone(); } } }
export const kit = { fleshMaterial, boneMaterial, bioCrystalMaterial, blob, capsule, horn, crystalSpike, scatterOnSurface, tentacle, eye, jaw, leg, Spring, setHurt, THREE, TAU, uTime };
