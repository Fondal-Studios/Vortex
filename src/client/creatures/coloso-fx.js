// Efectos propios de los jefes (coloso / madre): burbuja de resonancia con grietas, esquirlas orbitando, rayo de carga, humo/brasas y vapor.
import * as THREE from 'three';
import { uTime } from '../shaders.js';
import { cfg } from '../quality.js';
import { bioMaterial } from './obelisco-mat.js';
import { crystalGeo, merge, V3 } from './obelisco-geo.js';
import { softDot, clamp, lerp } from './obelisco-lib.js';

/** Burbuja facetada (icosfera) con aristas luminosas, hexágonos que giran y GRIETAS. set({ amt, crack, flash, color }) */
export function shieldBubble(color = 0xffc65c, radius = 1.8, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, cfg().humans === "low" ? 1 : detail); const n = g.attributes.position.count, B = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { B.set([1, 0, 0, 0, 1, 0, 0, 0, 1], i * 3); } g.setAttribute('bary', new THREE.BufferAttribute(B, 3));
  const u = { uTime, uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 }, uCrack: { value: 0 }, uFlash: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute vec3 bary; varying vec3 vB, vN, vV, vP; void main(){ vB = bary; vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uAmt, uCrack, uFlash; varying vec3 vB, vN, vV, vP;
      float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y), mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
      void main(){
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float e = min(min(vB.x, vB.y), vB.z), edge = 1.0 - smoothstep(0.0, 0.05, e);
        float facet = 0.35 + 0.65 * vn(vP * 3.0 + floor(uTime * 0.8));
        float cr = 1.0 - smoothstep(0.0, 0.035, abs(vn(vP * 5.5 + 3.0) - 0.5)); cr *= uCrack * (0.4 + 0.6 * vn(vP * 9.0));
        float sweep = 0.5 + 0.5 * sin(vP.y * 5.0 + vP.x * 3.0 - uTime * 2.0);
        vec3 c = uColor * (0.06 + fr * 0.5 + edge * (0.7 + 0.5 * sweep) + cr * 1.6) * facet + vec3(1.0) * uFlash * (0.4 + edge);
        float a = (0.05 + fr * 0.4 + edge * 0.6 + cr * 0.9) * uAmt + uFlash * 0.4; gl_FragColor = vec4(c * uAmt + vec3(uFlash) * 0.3, clamp(a, 0.0, 1.0));
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.scale.setScalar(radius); m.frustumCulled = false; m.visible = false; m.renderOrder = 6;
  return { object: m, set({ amt = 0, crack = 0, flash = 0, scale = 1 } = {}) { u.uAmt.value = amt; u.uCrack.value = crack; u.uFlash.value = flash; m.visible = amt > 0.01 || flash > 0.01; m.scale.setScalar(radius * scale); }, uniforms: u };
}

/** Esquirlas de cristal que orbitan (InstancedMesh). set(t, { ring, spin, burst, alpha }) */
export function orbitShards(parent, n = 18, { radius = 1.9, color = 0xffc65c } = {}) {
  const hi = cfg().humans !== 'low';
  const bio = bioMaterial({ glow: color, scale: 1, breath: 0 }); bio.userData.u.uCry.value = 1.4;
  const geo = crystalGeo(new V3(0, 0, 0), new V3(0, 1, 0), 0.07, 0.34, color, { sides: 5, glow: 1 });
  const im = new THREE.InstancedMesh(geo, bio, n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.visible = false; parent.add(im);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), d = [];
  for (let i = 0; i < n; i++) d.push({ a: (i / n) * Math.PI * 2, el: (Math.random() - 0.5) * 1.6, ph: Math.random() * 6.28, s: 0.7 + Math.random() * 0.8, v: new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).normalize() });
  return { object: im, mat: bio, burstT: 9, burst() { this.burstT = 0; },
    update(dt, t, { amt = 0, spin = 1, rad = radius } = {}) {
      this.burstT += dt; const b = this.burstT < 1.0 ? this.burstT : 9, vis = amt > 0.02 || b < 1.0; im.visible = vis; if (!vis) return;
      for (let i = 0; i < n; i++) { const o = d[i], a = o.a + t * 0.4 * spin * o.s, r = rad * (1 + b * 1.6), sc = Math.max(0.001, (b < 1 ? (1 - b) : amt) * o.s);
        P.set(Math.cos(a) * Math.cos(o.el) * r, Math.sin(o.el) * r + Math.sin(t * 1.5 + o.ph) * 0.05, Math.sin(a) * Math.cos(o.el) * r); if (b < 1) P.addScaledVector(o.v, b * 2.5);
        E.set(a + 1.2, o.ph + t * 0.6, o.el + 0.5); Q.setFromEuler(E); S.set(sc, sc, sc); M.compose(P, Q, S); im.setMatrixAt(i, M); }
      im.instanceMatrix.needsUpdate = true; } };
}

/** Rayo: cilindro aditivo en +z (de z=0 a z=1 escalado). Devuelve { object, set({ len, w, a, color }) } */
export function chargeBeam() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5);
  const mk = (c) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const outer = mk(0x40c8ff), core = mk(0xffffff), mid = mk(0x88e0ff); const grp = new THREE.Group(); grp.add(outer, mid, core); grp.visible = false;
  for (const m of [outer, mid, core]) m.frustumCulled = false;
  const cA = new THREE.Color(0x30b0ff), cB = new THREE.Color(0xe0f8ff);
  return { object: grp, set({ len = 10, w = 0.05, a = 0, k = 0 } = {}) {
    grp.visible = a > 0.01; if (!grp.visible) return;
    outer.scale.set(w * 2.6, w * 2.6, len); mid.scale.set(w * 1.4, w * 1.4, len); core.scale.set(w * 0.6, w * 0.6, len);
    outer.material.color.copy(cA).lerp(cB, k * 0.5); outer.material.opacity = 0.2 * a; mid.material.opacity = 0.4 * a; core.material.opacity = (0.35 + 0.65 * k) * a; } };
}

/** Partículas (Points) con color por vértice: humo, brasas, vapor. emit(pos, vel, life, size?) ; update(dt). */
export function particleBank(parent, n = 40, { size = 0.4, additive = true, color = 0xffffff, opacity = 1 } = {}) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = new Float32Array(n * 3), age = new Float32Array(n).fill(99), life = new Float32Array(n).fill(1), tint = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; parent.add(pts); let head = 0; const c = new THREE.Color();
  return { object: pts, material: m,
    emit(p, v, lifeS = 1, rgb = color, drag = 0) { const k = head; head = (head + 1) % n; pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; vel[k * 3] = v.x; vel[k * 3 + 1] = v.y; vel[k * 3 + 2] = v.z; age[k] = 0; life[k] = lifeS; c.set(rgb); tint[k * 3] = c.r; tint[k * 3 + 1] = c.g; tint[k * 3 + 2] = c.b; },
    update(dt, { gravity = 0, grow = 0, drag = 0 } = {}) {
      for (let i = 0; i < n; i++) { if (age[i] > life[i]) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; } age[i] += dt; const a = age[i] / life[i], f = Math.sin(Math.min(1, a) * Math.PI);
        vel[i * 3 + 1] += gravity * dt; const dr = 1 - drag * dt; vel[i * 3] *= dr; vel[i * 3 + 1] *= dr; vel[i * 3 + 2] *= dr; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        col[i * 3] = tint[i * 3] * f; col[i * 3 + 1] = tint[i * 3 + 1] * f; col[i * 3 + 2] = tint[i * 3 + 2] * f; }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; if (grow) m.size += grow * dt; } };
}
