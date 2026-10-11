// Utilidades compartidas por prisma / espejo / graviton / aurora / espiral:
// campana de medusa (shader), cintas ondulantes, anillos expansivos, aura de escudo, halos y tubos afilados.
import * as THREE from 'three';
import { uTime } from '../shaders.js';
import { cfg } from '../quality.js';

export const isLow = () => cfg().humans === 'low';
export const isHigh = () => cfg().humans === 'high';
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const TAU = Math.PI * 2;

export const NOISE = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
  vec3 pal(float t){ return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }`;

/* ───────── halo suave (sprite aditivo) ───────── */
let _halo = null;
function haloTex() {
  if (_halo) return _halo;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_halo = new THREE.CanvasTexture(c));
}
export function glowSprite(color, size = 2, opacity = 0.5) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size); return s;
}

/* ───────── anillos expansivos / convergentes ───────── */
/** n anillos aditivos. plane 'xz' (horizontal) o 'xy' (miran a +Z). set(i, radio, opacidad). */
export function ringPool(parent, n, color, { plane = 'xz', thick = 0.88 } = {}) {
  const g = new THREE.RingGeometry(thick, 1, isLow() ? 32 : 56), rings = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    if (plane === 'xz') m.rotation.x = -Math.PI / 2; m.visible = false; parent.add(m); rings.push(m);
  }
  return { rings, set(i, radius, op) { const m = rings[i]; m.visible = op > 0.01; m.scale.setScalar(Math.max(0.001, radius)); m.material.opacity = Math.min(1, op); }, setColor(c) { rings.forEach((r) => r.material.color.set(c)); } };
}

/* ───────── aura de escudo ───────── */
export function auraShell(color, r = 1.4) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 }, uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: 'varying vec3 vN, vV, vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAmt, uTime; varying vec3 vN, vV, vP; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float hex = 0.6 + 0.4 * sin(vP.y * 14.0 + uTime * 2.0) * sin(atan(vP.z, vP.x) * 9.0 - uTime); gl_FragColor = vec4(uColor * (0.6 + f * 1.4) * hex, f * uAmt * 0.9);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, isLow() ? 14 : 24, isLow() ? 10 : 16), mat); m.scale.setScalar(r); m.visible = false; m.renderOrder = 5;
  m.userData.set = (a) => { mat.uniforms.uAmt.value = a; m.visible = a > 0.02; }; return m;
}

/* ───────── campana de medusa translúcida ───────── */
/** Hemisferio con base en y=0 y ápice en y=1. Controles: u.uContract (−1..1), u.uPulse, u.uGlow. */
export function jellyMaterial({ top = 0x88ffee, bottom = 0xff66cc, alpha = 0.55, rim = 1.2, glow = 0.4, bands = 6 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0, transparent: true, opacity: alpha, side: THREE.DoubleSide, depthWrite: false });
  const u = { uTime, uHurt: { value: 0 }, uContract: { value: 0 }, uPulse: { value: 0 }, uGlow: { value: glow }, uTop: { value: new THREE.Color(top) }, uBot: { value: new THREE.Color(bottom) }, uRim: { value: rim }, uBands: { value: bands }, uAlpha: { value: alpha } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime,uContract,uPulse; varying vec3 vP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vP = position; float hh = clamp(position.y, 0.0, 1.0), rimK = 1.0 - hh; float ang = atan(position.z, position.x);
        transformed.xz *= 1.0 - uContract * 0.34 * (0.35 + rimK);
        transformed.y *= 1.0 + uContract * 0.24;
        transformed.y -= rimK * rimK * (0.10 + 0.07 * uPulse) * (0.5 + 0.5 * sin(ang * 8.0 + uTime * 2.2));
        transformed += normal * 0.014 * sin(uTime * 3.0 + position.y * 9.0 + ang * 3.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime,uHurt,uGlow,uRim,uBands,uAlpha; uniform vec3 uTop,uBot; varying vec3 vP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float hy = clamp(vP.y, 0.0, 1.0); vec3 gcol = mix(uBot, uTop, smoothstep(0.0, 1.0, hy));
        float rad = sin(atan(vP.z, vP.x) * uBands + hy * 3.0 + uTime * 0.6); float jv = smoothstep(0.78, 1.0, rad) * (1.0 - hy * 0.55);
        diffuseColor.rgb = gcol;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
        diffuseColor.a = clamp(uAlpha * (0.5 + 0.5 * (1.0 - hy)) + fres * 0.45 + jv * 0.25, 0.0, 1.0);
        totalEmissiveRadiance += gcol * (uGlow * (0.6 + 0.4 * sin(uTime * 1.7 + hy * 5.0)) + fres * uRim + jv * 0.9) + vec3(1.0, 0.85, 0.7) * uHurt * 0.9;`);
  };
  return m;
}
export function bellMesh(mat, rx = 1, ry = 1, rz = rx) {
  const w = isLow() ? 18 : 32, h = isLow() ? 8 : 14;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, w, h, 0, TAU, 0, Math.PI / 2), mat); m.scale.set(rx, ry, rz); return m;
}

/* ───────── cinta ondulante (seda / membrana colgante) ───────── */
export function ribbon({ len = 3, w = 0.3, color = 0xff99ee, color2 = 0x66ffee, amp = 0.4, speed = 1.5, freq = 3, alpha = 0.7, phase = Math.random() * 6.28, hang = true } = {}) {
  const segs = isLow() ? 8 : 16;
  const g = new THREE.PlaneGeometry(w, len, 2, segs); g.translate(0, -len / 2, 0);
  const uni = { uTime, uHurt: { value: 0 }, uAmp: { value: amp }, uSpeed: { value: speed }, uFreq: { value: freq }, uPh: { value: phase }, uLen: { value: len }, uA: { value: alpha }, uC1: { value: new THREE.Color(color) }, uC2: { value: new THREE.Color(color2) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime,uAmp,uSpeed,uFreq,uPh,uLen; varying float vK; varying float vX;
      void main(){ vec3 p = position; float k = clamp(-p.y / uLen, 0.0, 1.0); vK = k; vX = position.x;
        p.x *= mix(1.0, 0.25, k);
        p.x += sin(uTime * uSpeed + k * uFreq + uPh) * uAmp * k * k;
        p.z += cos(uTime * uSpeed * 0.8 + k * uFreq * 1.3 + uPh) * uAmp * 0.8 * k * k;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime,uA,uHurt,uLen; uniform vec3 uC1,uC2; varying float vK; varying float vX;
      void main(){ float edge = 1.0 - smoothstep(0.25, 0.5, abs(vX) / max(0.001, 0.5 * 1.0) * 0.5);
        float flow = pow(sin(vK * 9.0 - uTime * 2.4) * 0.5 + 0.5, 3.0);
        vec3 c = mix(uC1, uC2, vK) * (0.7 + flow * 1.1) + vec3(1.0, 0.85, 0.7) * uHurt;
        float a = uA * (1.0 - pow(vK, 1.4)) * (0.45 + 0.55 * edge) * (0.55 + 0.45 * flow);
        gl_FragColor = vec4(c, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }`,
  });
  mat.userData.u = uni;
  const m = new THREE.Mesh(g, mat); if (!hang) m.rotation.x = Math.PI; m.userData.u = uni; m.frustumCulled = false; return m;
}

/* ───────── tubo afilado a lo largo de una curva ───────── */
export function taperTube(curve, r0, r1, radial = 7, segs = 20, ridge = 0) {
  const pts = curve.getSpacedPoints(segs), fr = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const k = i / segs, r = lerp(r0, r1, Math.pow(k, 0.8)) * (1 + ridge * Math.sin(k * 40));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU, n = fr.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      pos.push(pts[i].x + n.x * r, pts[i].y + n.y * r, pts[i].z + n.z * r); nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}

/** Restablece el destello de daño de todos los uniformes compartidos (por si un material no lo expone). */
export function hurtAll(mats, v) { for (const m of mats) { const u = m.userData && m.userData.u; if (u && u.uHurt) u.uHurt.value = v; } }

/* ───────── geometría ligera (para presupuesto móvil) ───────── */
const _gc = new Map(); const gcache = (k, f) => { let g = _gc.get(k); if (!g) { g = f(); _gc.set(k, g); } return g; };
const SEG2 = () => (cfg().humans === 'low' ? [12, 8] : cfg().humans === 'medium' ? [16, 11] : [22, 15]);
/** Masa blanda (esfera estirable) con menos polígonos que kit.blob. */
export function soft(mat, r = 1, sx = 1, sy = 1, sz = 1) {
  const [w, h] = SEG2(); const m = new THREE.Mesh(gcache(`sf${w}`, () => new THREE.SphereGeometry(1, w, h)), mat); m.scale.set(r * sx, r * sy, r * sz); return m;
}
/** Cuenta/punta diminuta (96 triángulos). */
export function bead(mat, r = 0.05) {
  const m = new THREE.Mesh(gcache('bead', () => new THREE.SphereGeometry(1, 8, 6)), mat); m.scale.setScalar(r); return m;
}
/** Pata de 2 huesos con IK (igual que kit.leg pero con rodillas/pies ligeros). */
export function leg2(mat, { upper = 0.7, lower = 0.8, r = 0.07, claw = null } = {}) {
  const root = new THREE.Group(), A = new THREE.Group(), B = new THREE.Group(), V3 = THREE.Vector3;
  const seg = (len, r0) => { const m = new THREE.Mesh(gcache('lseg', () => { const c = new THREE.CylinderGeometry(1, 0.55, 1, 7, 1); c.translate(0, -0.5, 0); return c; }), mat); m.scale.set(r0, len, r0); return m; };
  A.add(seg(upper, r)); const knee = bead(mat, r * 1.3); knee.position.y = -upper; A.add(knee);
  B.position.y = -upper; B.add(seg(lower, r * 0.8)); const foot = bead(mat, r * 0.8); foot.position.y = -lower; B.add(foot);
  if (claw) { const c = new THREE.Mesh(gcache('lclaw', () => { const g = new THREE.ConeGeometry(1, 1, 5); g.translate(0, 0.5, 0); return g; }), claw); c.scale.set(r * 0.6, r * 4, r * 0.6); c.rotation.x = Math.PI; c.position.y = -lower; B.add(c); }
  A.add(B); root.add(A);
  const bend = new V3(0, 1, 0), tgt = new V3(), DOWN = new V3(0, -1, 0);
  function solve(f) {
    tgt.copy(f); let d = tgt.length(); const max = upper + lower - 1e-3; if (d > max) { tgt.multiplyScalar(max / d); d = max; } d = Math.max(d, Math.abs(upper - lower) + 1e-3);
    const ang = Math.acos(clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
    const dir = tgt.clone().normalize(); const axis = new V3().crossVectors(dir, bend); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    const kneeDir = dir.clone().applyAxisAngle(axis, -ang); A.quaternion.setFromUnitVectors(DOWN, kneeDir);
    const kneePos = kneeDir.clone().multiplyScalar(upper), lowDir = tgt.clone().sub(kneePos).normalize();
    const world2 = new THREE.Quaternion().setFromUnitVectors(DOWN, lowDir); B.quaternion.copy(A.quaternion.clone().invert().multiply(world2));
  }
  solve(new V3(0, -(upper + lower) * 0.9, 0));
  return { object: root, setFoot: solve, setBend(v) { bend.copy(v).normalize(); } };
}
