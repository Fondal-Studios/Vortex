// Utilidades compartidas por obelisco / ariete / coloso / madre: ojo grande y húmedo con párpados, iris fibroso,
// córnea brillante, pupila dinámica; materiales aditivos de brillo; texturas procedurales.
import * as THREE from 'three';
import { fleshMaterial } from '../organism.js';

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
export const Z = new THREE.Vector3(0, 0, 1);

const texCache = new Map();
/** Textura de iris en proyección polar: v=0 centro (pupila), v=1 borde. Fibras radiales + anillo límbico oscuro. */
export function irisTexture(color) {
  const key = String(color); if (texCache.has(key)) return texCache.get(key);
  if (typeof document === 'undefined') return null;
  const W = 256, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const base = new THREE.Color(color), hex = (k, l = 0) => '#' + base.clone().multiplyScalar(k).lerp(new THREE.Color(0xffffff), l).getHexString();
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, hex(0.25)); gr.addColorStop(0.18, hex(1.2, 0.35)); gr.addColorStop(0.55, hex(0.95)); gr.addColorStop(0.85, hex(0.45)); gr.addColorStop(1, hex(0.08));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { // fibras radiales
    const x = rnd() * W, y0 = H * (0.1 + rnd() * 0.25), y1 = H * (0.6 + rnd() * 0.4);
    g.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + (0.1 + rnd() * 0.25) + ')' : 'rgba(255,255,255,' + (0.06 + rnd() * 0.2) + ')'; g.lineWidth = 0.7 + rnd() * 1.6;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (rnd() - 0.5) * 3, y1); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}

const sharedGeo = {};
const G = (k, f) => sharedGeo[k] || (sharedGeo[k] = f());

/** Material aditivo luminoso (halos, rayos, núcleos). */
export function glowMat(color, opacity = 0.5) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); }
export function glowSphere(mat, r = 1) { const m = new THREE.Mesh(G('gs', () => new THREE.SphereGeometry(1, 14, 10)), mat); m.scale.setScalar(r); m.frustumCulled = false; return m; }

/**
 * Ojo grande y vivo. Devuelve { object, ball, mats, update(dt, dirLocal, opts) }.
 * `dirLocal` = dirección hacia donde mira, EN EL ESPACIO DEL PADRE del ojo. opts: open 0–1, pupil 0.1–1.6, glow, hurt, shake, slit, blinkRate.
 */
export function bigEye({ r = 0.5, iris = 0xffb020, slit = false, lids = true, lidSkin = null, scleraColor = 0xf3dccf, quality = 'high' } = {}) {
  const object = new THREE.Group(), ball = new THREE.Group(); object.add(ball);
  const lo = quality === 'low';
  const sclera = fleshMaterial({ color: scleraColor, vein: 0xb0182e, spot: 0xff5a7a, veins: 0.95, rough: 0.2, sheen: 0.4, wobble: 0.004, breath: 0.004, scale: 3.4, glow: 0 });
  const sph = G(lo ? 'eb0' : 'eb1', () => new THREE.SphereGeometry(1, lo ? 14 : 24, lo ? 10 : 16));
  const bm = new THREE.Mesh(sph, sclera); bm.scale.setScalar(r); ball.add(bm);
  // iris: casquete esférico con textura polar
  const capA = 0.78, cap = G('cap' + lo, () => new THREE.SphereGeometry(1, lo ? 14 : 24, lo ? 4 : 8, 0, Math.PI * 2, 0, capA));
  const tex = irisTexture(iris);
  const irisM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.3, emissive: new THREE.Color(iris), emissiveMap: tex, emissiveIntensity: 0.6 });
  irisM.userData.u = { uHurt: { value: 0 } };
  const im = new THREE.Mesh(cap, irisM); im.scale.setScalar(r * 1.012); im.rotation.x = Math.PI / 2; ball.add(im);
  const pupM = new THREE.MeshBasicMaterial({ color: 0x030105 });
  const pup = new THREE.Mesh(G('pu', () => new THREE.CircleGeometry(1, 20)), pupM); pup.position.z = r * 1.0 * Math.cos(0.5) * 1.0 + 0.0; ball.add(pup);
  const pz = r * 1.02 * Math.cos(0.0); pup.position.z = pz;
  // córnea húmeda (reflejo)
  const corneaM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
  const cornea = new THREE.Mesh(sph, corneaM); cornea.scale.setScalar(r * 1.045); object.add(cornea);
  // párpados
  const lidMat = lidSkin || fleshMaterial({ color: 0x8a3a58, vein: 0x3a0820, spot: 0xff6aa0, veins: 0.8, rough: 0.5, wobble: 0.01, breath: 0.01 });
  let up = null, dn = null;
  if (lids) {
    const hemi = G('hemi' + lo, () => new THREE.SphereGeometry(1, lo ? 12 : 20, lo ? 6 : 10, 0, Math.PI * 2, 0, Math.PI / 2));
    up = new THREE.Mesh(hemi, lidMat); up.scale.setScalar(r * 1.09); dn = new THREE.Mesh(hemi, lidMat); dn.scale.setScalar(r * 1.09); dn.scale.y = -r * 1.09;
    object.add(up, dn);
  }
  const mats = [sclera, irisM, lidMat];
  let blinkT = 1 + rnd() * 3, blink = 0, sacT = 0.5, sacX = 0, sacY = 0, cur = 0.9; const q = new THREE.Quaternion(), tq = new THREE.Quaternion(), d = new THREE.Vector3();
  const base = new THREE.Color(iris);
  return {
    object, ball, mats, iris: irisM, pupil: pup, lidMat, sclera,
    update(dt, dirLocal, { open = 1, pupil = 0.55, glow = 0.6, hurt = 0, shake = 0, blinkRate = 1, track = 14 } = {}) {
      if (dirLocal) {
        sacT -= dt; if (sacT <= 0) { sacT = 0.4 + rnd() * 1.6; sacX = (rnd() - 0.5) * 0.14; sacY = (rnd() - 0.5) * 0.1; } // microsacadas
        d.copy(dirLocal).normalize(); d.x += sacX + (shake ? (rnd() - 0.5) * shake : 0); d.y += sacY + (shake ? (rnd() - 0.5) * shake : 0); d.normalize();
        tq.setFromUnitVectors(Z, d); ball.quaternion.slerp(tq, 1 - Math.exp(-track * dt));
      }
      blinkT -= dt * blinkRate; if (blinkT <= 0) { blink = 1; blinkT = 2 + rnd() * 4.5; } blink = Math.max(0, blink - dt * 6.5);
      const bl = Math.sin(Math.min(1, blink) * Math.PI); // 0→1→0
      cur = damp(cur, open, 9, dt);
      const o = clamp(cur * (1 - bl), 0, 1);
      if (up) { up.rotation.x = lerp(1.5, -1.2, o); dn.rotation.x = lerp(-1.5, 0.95, o); }
      const ps = r * (slit ? 0.2 : 0.34) * pupil; pup.scale.set(ps * (slit ? 0.35 : 1), ps * (slit ? 2.4 : 1), 1);
      irisM.emissiveIntensity = glow; irisM.emissive.copy(base).lerp(new THREE.Color(0xffffff), clamp(hurt * 0.8, 0, 1));
    },
  };
}

/** Rayo / línea delgada con brillo (de z=0 a z=1 escalada). */
export function beamMesh(mat) { const m = new THREE.Mesh(G('beam', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5); return g; }), mat); m.frustumCulled = false; return m; }

/** Textura circular suave para esporas / halos. */
export function softDot() {
  if (typeof document === 'undefined') return null; if (G.dot) return G.dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (G.dot = new THREE.CanvasTexture(c));
}

/* ───────────────────────── geometría fusionada y racimos ───────────────────────── */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Fusiona geometrías con matriz → UNA malla (1 draw call). parts: [{ g, m }] */
export function mergeParts(parts) {
  const list = parts.map(({ g, m }) => { const c = g.clone(); if (c.index === null) c.setIndex([...Array(c.attributes.position.count).keys()]); c.deleteAttribute('uv2'); c.applyMatrix4(m); return c; });
  const out = mergeGeometries(list, false); list.forEach((c) => c.dispose()); return out;
}
/** Racimo de puntas (conos/prismas): items { p:Vector3 base, d:Vector3 dirección, r, h }; base en p, punta en p + d*h. */
export function spikeGeometry(items, sides = 5) {
  const cone = new THREE.ConeGeometry(1, 1, sides, 1); cone.translate(0, 0.5, 0);
  return mergeParts(items.map((it) => { _q.setFromUnitVectors(_up, _v.copy(it.d).normalize()); _m.compose(it.p, _q, _s.set(it.r, it.h, it.r)); return { g: cone, m: _m.clone() }; }));
}
/** Costilla: tubo a lo largo de una curva. */
export function tubeGeo(points, r = 0.035, seg = 20, rad = 6) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, rad, false); }

/* ───────────────────────── enjambre de ojos (3 draw calls para decenas de ojos) ───────────────────────── */
/**
 * Muchos ojos con iris, pupila y parpadeo individual en InstancedMesh. add({p, n, r, tint, slit}); update(dt, look, opts).
 * `look` está en el espacio local del padre; cada ojo limita su giro respecto a su normal `n`.
 */
export function eyeCluster({ max = 24, quality = 'high' } = {}) {
  const lo = quality === 'low';
  const sph = new THREE.SphereGeometry(1, lo ? 10 : 16, lo ? 8 : 12);
  const cap = new THREE.SphereGeometry(1.012, lo ? 10 : 16, 3, 0, Math.PI * 2, 0, 0.82); cap.rotateX(Math.PI / 2);
  const disc = new THREE.CircleGeometry(1, 14);
  const sclM = fleshMaterial({ color: 0xf2e0d2, vein: 0xa01830, spot: 0xff6a8a, veins: 0.9, rough: 0.22, sheen: 0.3, wobble: 0.0, breath: 0.0, scale: 3 });
  const tex = irisTexture(0xffffff);
  const irisM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.25 }); const gl = { value: 0.6 };
  irisM.onBeforeCompile = (sh) => { sh.uniforms.uIG = gl; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uIG;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uIG;'); };
  irisM.userData.u = { uHurt: { value: 0 } };
  const pupM = new THREE.MeshBasicMaterial({ color: 0x020002 });
  const A = new THREE.InstancedMesh(sph, sclM, max), B = new THREE.InstancedMesh(cap, irisM, max), C = new THREE.InstancedMesh(disc, pupM, max);
  for (const o of [A, B, C]) { o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  B.setColorAt(0, new THREE.Color(1, 1, 1));
  const eyes = []; const M = new THREE.Matrix4(), P = new THREE.Vector3(), Qq = new THREE.Quaternion(), S = new THREE.Vector3(), D = new THREE.Vector3(), T = new THREE.Vector3();
  const object = new THREE.Group(); object.add(A, B, C);
  return {
    object, mats: [sclM, irisM], sclera: sclM, count: () => eyes.length,
    add({ p, n, r = 0.1, tint = 0xffffff, slit = false, lag = 8 + rnd() * 8 }) {
      const i = eyes.length; if (i >= max) return -1; const nn = n.clone().normalize();
      eyes.push({ p: p.clone(), n: nn, r, cur: nn.clone(), blinkT: 1 + rnd() * 5, blink: 0, sacT: rnd(), sx: 0, sy: 0, slit, lag, scale: 1 });
      B.setColorAt(i, new THREE.Color(tint)); B.instanceColor.needsUpdate = true; A.count = B.count = C.count = eyes.length; return i;
    },
    setScale(i, s) { if (eyes[i]) eyes[i].scale = s; },
    update(dt, look, { open = 1, dilate = 1, glow = 0.6, maxAng = 1.15, jitter = 1, blinkRate = 1, track = 1 } = {}) {
      gl.value = glow;
      for (let i = 0; i < eyes.length; i++) {
        const e = eyes[i];
        e.sacT -= dt; if (e.sacT <= 0) { e.sacT = 0.3 + rnd() * 1.5; e.sx = (rnd() - 0.5) * 0.35 * jitter; e.sy = (rnd() - 0.5) * 0.3 * jitter; }
        D.copy(look).normalize(); D.x += e.sx; D.y += e.sy; D.normalize();
        const ang = Math.acos(clamp(D.dot(e.n), -1, 1));
        if (ang > maxAng) { T.copy(D).addScaledVector(e.n, -D.dot(e.n)); if (T.lengthSq() < 1e-6) T.set(e.n.y, e.n.z, e.n.x); T.normalize(); D.copy(e.n).multiplyScalar(Math.cos(maxAng)).addScaledVector(T, Math.sin(maxAng)); }
        const k = 1 - Math.exp(-e.lag * track * dt); e.cur.lerp(D, k).normalize();
        e.blinkT -= dt * blinkRate; if (e.blinkT <= 0) { e.blink = 1; e.blinkT = 2 + rnd() * 5; } e.blink = Math.max(0, e.blink - dt * 6);
        const bl = Math.sin(Math.min(1, e.blink) * Math.PI), op = clamp(open * (1 - bl), 0.04, 1);
        Qq.setFromUnitVectors(Z, e.cur); const r = e.r * e.scale;
        S.set(r, r * (0.25 + 0.75 * op), r); M.compose(e.p, Qq, S); A.setMatrixAt(i, M); B.setMatrixAt(i, M);
        const pr = r * (e.slit ? 0.14 : 0.3) * dilate; P.copy(e.cur).multiplyScalar(r * 1.03).add(e.p); S.set(pr, pr * (e.slit ? 3.0 : 1) * (0.3 + 0.7 * op), 1); M.compose(P, Qq, S); C.setMatrixAt(i, M);
      }
      A.instanceMatrix.needsUpdate = B.instanceMatrix.needsUpdate = C.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ───────────────────────── boca grande con dientes fusionados ───────────────────────── */
/** Boca de dos mitades. set(open 0–1). Dientes fusionados: 4 draw calls + interior. */
export function maw(skin, boneMat, { w = 0.5, len = 0.5, teeth = 9, tooth = 0.14, inner = null } = {}) {
  const object = new THREE.Group(), up = new THREE.Group(), lo = new THREE.Group();
  const hemi = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const mk = (flip) => {
    const grp = flip ? lo : up, sh = new THREE.Mesh(hemi, skin); sh.scale.set(w, len * 0.55 * (flip ? -1 : 1), len); grp.add(sh);
    const items = []; for (let i = 0; i < teeth; i++) { const a = (i / (teeth - 1) - 0.5) * 2.5, big = (i % 2 ? 0.7 : 1) * (1 - Math.abs(a) * 0.25); items.push({ p: new THREE.Vector3(Math.sin(a) * w * 0.97, 0, Math.cos(a) * len * 0.97), d: new THREE.Vector3(-Math.sin(a) * 0.15, flip ? 1 : -1, -Math.cos(a) * 0.2), r: tooth * 0.45 * big, h: tooth * 2.2 * big }); }
    const t = new THREE.Mesh(spikeGeometry(items, 5), boneMat); grp.add(t); return grp;
  };
  object.add(mk(false), mk(true));
  if (inner) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), inner); m.scale.set(w * 0.85, len * 0.3, len * 0.8); object.add(m); object.userData.inner = m; }
  return { object, set(open) { up.rotation.x = -open * 0.75; lo.rotation.x = open * 0.55; if (object.userData.inner) object.userData.inner.scale.y = len * (0.1 + 0.55 * open); } };
}
