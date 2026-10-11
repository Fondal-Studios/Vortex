// Utilidades compartidas por obelisco / ariete / coloso / madre: ojo grande y húmedo con párpados, iris fibroso,
// córnea brillante, pupila dinámica; materiales aditivos de brillo; texturas procedurales.
import * as THREE from 'three';
import { fleshMaterial } from '../organism.js';
import { bioMaterial, eyeMaterial } from './obelisco-mat.js';
import { paint } from './obelisco-geo.js';

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
 * Ojo grande y vivo (esfera pintada por shader: esclerótica con venas, iris fibroso, pupila; párpados de carne gruesos y aro del párpado).
 * Devuelve { object, ball, mats, update(dt, dirLocal, opts) }. `dirLocal` = hacia dónde mira, EN EL ESPACIO DEL PADRE del ojo.
 * opts: open 0–1, pupil 0.1–1.6, glow, hurt, shake, blinkRate, track.
 */
export function bigEye({ r = 0.5, iris = 0xffb020, slit = false, pupil = null, lids = true, lidSkin = null, lidColor = 0x7a3a44, scleraColor = 0xcdbfae, irisR = 0.5, quality = 'high', brow = 0 } = {}) {
  const object = new THREE.Group(), ball = new THREE.Group(); object.add(ball);
  const lo = quality === 'low';
  const em = eyeMaterial({ iris, sclera: scleraColor, pupil: pupil || (slit ? 'slit' : 'round'), irisR, lids: true, lid: lidColor });
  const sph = G(lo ? 'eb0' : 'eb1', () => new THREE.SphereGeometry(1, lo ? 16 : 36, lo ? 12 : 26));
  const bm = new THREE.Mesh(sph, em); bm.scale.setScalar(r); ball.add(bm);
  const mats = [em];
  let blinkT = 1 + rnd() * 3, blink = 0, sacT = 0.5, sacX = 0, sacY = 0, cur = 0.9; const gq = new THREE.Quaternion(), tq = new THREE.Quaternion(), d = new THREE.Vector3(), M4 = new THREE.Matrix4();
  const u = em.userData.u;
  return {
    object, ball, mats, iris: em, lidMat: null, sclera: em,
    update(dt, dirLocal, { open = 1, pupil = 0.55, glow = 0.6, hurt = 0, shake = 0, blinkRate = 1, track = 14, brow: br = brow } = {}) {
      if (dirLocal) {
        sacT -= dt; if (sacT <= 0) { sacT = 0.4 + rnd() * 1.6; sacX = (rnd() - 0.5) * 0.14; sacY = (rnd() - 0.5) * 0.1; } // microsacadas
        d.copy(dirLocal).normalize(); d.x += sacX + (shake ? (rnd() - 0.5) * shake : 0); d.y += sacY + (shake ? (rnd() - 0.5) * shake : 0); d.normalize();
        // la mirada gira el iris (los párpados quedan fijos); límite ~35° para que el iris no se salga del ojo
        const ang = Math.acos(clamp(d.z, -1, 1)), lim = 0.6; if (ang > lim) { const k = Math.sin(lim) / Math.max(Math.sin(ang), 1e-4); d.set(d.x * k, d.y * k, Math.cos(lim)); }
        tq.setFromUnitVectors(Z, d); gq.slerp(tq, 1 - Math.exp(-track * dt));
        M4.makeRotationFromQuaternion(gq); u.uGazeM.value.setFromMatrix4(M4).transpose();
      }
      blinkT -= dt * blinkRate; if (blinkT <= 0) { blink = 1; blinkT = 2 + rnd() * 4.5; } blink = Math.max(0, blink - dt * 6.5);
      const bl = Math.sin(Math.min(1, blink) * Math.PI);
      cur = damp(cur, open, 9, dt);
      const o = clamp(cur * (1 - bl), 0, 1);
      u.uOpen.value.set(lerp(0.02, 0.8, o), lerp(0.02, 0.62, o), br); window.__o = [u.uOpen.value.x, u.uOpen.value.y, o];
      u.uPup.value = pupil; u.uGlow.value = glow; u.uHurt.value = hurt;
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

/* ───────────────────────── enjambre de ojos (1–2 draw calls para decenas de ojos) ───────────────────────── */
/**
 * Muchos ojos pintados por shader en InstancedMesh (redondos y de rendija por separado). add({p, n, r, tint, slit}); update(dt, look, opts).
 * `look` está en el espacio local del padre; cada ojo limita su giro respecto a su normal `n`.
 */
export function eyeCluster({ max = 24, quality = 'high', iris = 0xffffff, sclera = 0xbfb2a2 } = {}) {
  const lo = quality === 'low';
  const sph = new THREE.SphereGeometry(1, lo ? 9 : 16, lo ? 7 : 12);
  const mR = eyeMaterial({ iris, sclera, pupil: 'round', instanced: true, irisR: 0.5 }), mS = eyeMaterial({ iris, sclera, pupil: 'slit', instanced: true, irisR: 0.5 });
  const IM = (m) => { const o = new THREE.InstancedMesh(sph, m, max); o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); o.count = 0; o.setColorAt(0, new THREE.Color(1, 1, 1)); return o; };
  const A = IM(mR), B = IM(mS); const eyes = [];
  const M = new THREE.Matrix4(), Qq = new THREE.Quaternion(), S = new THREE.Vector3(), D = new THREE.Vector3(), T = new THREE.Vector3(), P = new THREE.Vector3();
  const object = new THREE.Group(); object.add(A, B);
  return {
    object, mats: [mR, mS], sclera: mR, count: () => eyes.length,
    add({ p, n, r = 0.1, tint = 0xffffff, slit = false, lag = 8 + rnd() * 8 }) {
      const i = eyes.length; if (i >= max) return -1; const nn = n.clone().normalize(), mesh = slit ? B : A, slot = mesh.count++;
      eyes.push({ p: p.clone(), n: nn, r, cur: nn.clone(), blinkT: 1 + rnd() * 5, blink: 0, sacT: rnd(), sx: 0, sy: 0, slit, lag, scale: 1, mesh, slot });
      mesh.setColorAt(slot, new THREE.Color(tint)); mesh.instanceColor.needsUpdate = true; return i;
    },
    setScale(i, s) { if (eyes[i]) eyes[i].scale = s; },
    update(dt, look, { open = 1, dilate = 1, glow = 0.6, maxAng = 1.15, jitter = 1, blinkRate = 1, track = 1 } = {}) {
      mR.userData.u.uPup.value = mS.userData.u.uPup.value = 0.55 * dilate; mR.userData.u.uGlow.value = mS.userData.u.uGlow.value = glow;
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
        S.set(r, r * (0.2 + 0.8 * op), r); M.compose(e.p, Qq, S); e.mesh.setMatrixAt(e.slot, M);
      }
      A.instanceMatrix.needsUpdate = B.instanceMatrix.needsUpdate = true;
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

/* ───────────────────────── piezas baratas ───────────────────────── */
const _sg = {};
/** Esfera blanda de baja resolución (w×h segmentos). */
export function soft(mat, r = 1, sx = 1, sy = 1, sz = 1, w = 16, h = 12) {
  const k = `${w}x${h}`; const g = _sg[k] || (_sg[k] = new THREE.SphereGeometry(1, w, h)); const m = new THREE.Mesh(g, mat); m.scale.set(r * sx, r * sy, r * sz); return m;
}
export function softGeo(w = 12, h = 8) { const k = `${w}x${h}`; return _sg[k] || (_sg[k] = new THREE.SphereGeometry(1, w, h)); }

/** Pata IK de 2 huesos con solo 2 mallas (cápsulas): barata. setFoot(Vector3 local a la cadera). */
export function legLite(mat, { upper = 0.7, lower = 0.8, r = 0.1 } = {}) {
  const root = new THREE.Group(), A = new THREE.Group(), B = new THREE.Group();
  const cap = _sg.cap || (_sg.cap = new THREE.CapsuleGeometry(1, 1, 3, 8));
  const seg = (len, r0) => { const m = new THREE.Mesh(cap, mat); m.scale.set(r0, (len + r0) / 3, r0); m.position.y = -len / 2; return m; };
  A.add(seg(upper, r)); B.position.y = -upper; B.add(seg(lower, r * 0.72)); A.add(B); root.add(A);
  const bend = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3(), axis = new THREE.Vector3(), kd = new THREE.Vector3(), kp = new THREE.Vector3(), ld = new THREE.Vector3(), w2 = new THREE.Quaternion();
  function solve(foot) {
    tgt.copy(foot); let d = tgt.length(); const max = upper + lower - 1e-3; if (d > max) { tgt.multiplyScalar(max / d); d = max; } d = Math.max(d, Math.abs(upper - lower) + 1e-3);
    const ang = Math.acos(clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
    dir.copy(tgt).normalize(); axis.crossVectors(dir, bend); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    kd.copy(dir).applyAxisAngle(axis, -ang); A.quaternion.setFromUnitVectors(DOWN, kd);
    kp.copy(kd).multiplyScalar(upper); ld.copy(tgt).sub(kp).normalize(); w2.setFromUnitVectors(DOWN, ld); B.quaternion.copy(A.quaternion).invert().multiply(w2);
  }
  solve(new THREE.Vector3(0, -(upper + lower) * 0.9, 0));
  return { object: root, setFoot: solve, setBend(v) { bend.copy(v).normalize(); } };
}
