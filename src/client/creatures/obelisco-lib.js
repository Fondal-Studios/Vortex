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
