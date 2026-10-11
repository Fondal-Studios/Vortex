// Manos y antebrazos en primera persona: guantes técnicos con placas iridiscentes y cristal.
// Coordenadas del arma: x derecha, y arriba, z negativo hacia la boca. El pasajero usa siempre el mismo equipo.
import * as THREE from 'three';
import { tint } from './kit.js';

export const GLOVE = 0x241a3d, GLOVE2 = 0x171028;
const V = (...a) => new THREE.Vector3(...a);

/** Antebrazo: manga de tela oscura, muñequera pulida, placas dorsales de armadura, hilo de cristal y gema. dir: hacia el codo. */
export function forearm(k, wrist, dir, len, r0, r1, hex) {
  const w = V(...wrist), d = V(...dir).normalize(), at = (t) => w.clone().addScaledVector(d, t).toArray();
  const up = V(0, 1, 0).sub(d.clone().multiplyScalar(d.y)).normalize(), side = V().crossVectors(up, d).normalize(); // dorso y costado
  const rr = (t) => r0 + (r1 - r0) * (t / len), qBasis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side.clone().negate(), up, d.clone().negate()));
  const off = (t, h) => at(t).map((x, i) => x + up.getComponent(i) * (rr(t) + h));
  k.limb('g', wrist, at(len), r0, r1, { c: GLOVE, seg: 9 });
  k.limb('b', at(-0.01), at(0.055), r0 * 1.14, r0 * 1.2, { c: 0xaab0d8, seg: 9 });                                 // muñequera pulida
  k.limb('g', at(0.055), at(0.09), r0 * 1.16, r0 * 1.12, { c: GLOVE2, seg: 9 });
  for (const [t0, t1, m] of [[0.1, 0.27, 1], [0.3, len * 0.6, 0.85], [len * 0.63, len * 0.97, 0.7]]) {
    if (t0 >= len) continue; const tm = (t0 + t1) / 2, l = t1 - t0;
    k.box('b', [rr(tm) * 1.55, 0.013, l], off(tm, 0.0035), { c: tint(hex, 0.55 * m), q: qBasis, rad: 0.004 });          // placa dorsal
    k.box('b', [0.006, rr(tm) * 0.8, l * 0.9], at(tm).map((x, i) => x + side.getComponent(i) * (rr(tm) + 0.002) - up.getComponent(i) * 0.002), { c: tint(hex, 0.4 * m), q: qBasis, rad: 0.002 });
    k.box('b', [0.006, rr(tm) * 0.8, l * 0.9], at(tm).map((x, i) => x - side.getComponent(i) * (rr(tm) + 0.002) - up.getComponent(i) * 0.002), { c: tint(hex, 0.4 * m), q: qBasis, rad: 0.002 });
  }
  k.box('l', [0.006, 0.005, 0.2], off(0.2, 0.0105), { k: 0, c: 0x666666, q: qBasis, rad: 0.001 });                      // hilo de cristal
  k.poly('l', 'oct', 0.012, off(0.36, 0.02), { k: 1, s: [1, 0.8, 1.6], q: qBasis });
  if (k.q.detail) k.tor('l', [rr(0.062) * 1.2, 0.0035], at(0.062), { q: new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d), c: 0x666666, k: 0, seg: 16 });
}

/**
 * Mano derecha sobre la empuñadura. g = {zc (centro en z), top (y del borde superior), d (profundidad), hw (semiancho)}.
 * El dedo índice se construye aparte (pieza `trigger`, con pivote en el nudillo) para curvarse al disparar.
 * Devuelve el pivote del índice.
 */
export function rightHand(k, g, hex, { arm = true } = {}) {
  const { zc, top, d, hw } = g, r = 0.0135, x1 = hw + 0.013, zF = zc - d / 2, zR = zc + d / 2, plate = tint(hex, 0.5);
  // palma y talón de la mano
  k.box('g', [0.036, 0.118, d + 0.05], [hw + 0.02, top - 0.052, zc + 0.004], { c: GLOVE, rad: 0.014 });
  k.box('g', [hw * 2 + 0.03, 0.07, 0.05], [0, top - 0.042, zR + 0.024], { c: GLOVE2, rad: 0.012 });
  // dedos: medio, anular y meñique envuelven la empuñadura; la punta asoma por el lado izquierdo
  for (let i = 0; i < 3; i++) {
    const y = top - 0.088 - i * 0.027, rf = r * (1 - i * 0.05);
    k.limb('g', [x1, y, zR - 0.004], [x1, y, zF - 0.008], rf, rf, { c: GLOVE, ball: true });
    k.limb('g', [x1, y, zF - 0.008], [-hw - 0.012, y, zF - 0.008], rf * 0.96, rf * 0.9, { c: GLOVE, ball: true });
    k.limb('g', [-hw - 0.012, y, zF - 0.008], [-hw - 0.012, y, zF + 0.026], rf * 0.9, rf * 0.8, { c: GLOVE, ball: true });
    k.box('l', [0.011, 0.0035, 0.013], [-hw - 0.012, y + rf * 0.7, zF + 0.016], { k: 1, c: 0xffffff, rad: 0.001 }); // uña de cristal
    k.box('b', [0.026, 0.02, 0.026], [x1 + 0.006, y + 0.002, zR - 0.016], { c: plate, rad: 0.006 });           // placa de nudillo
  }
  // pulgar a la izquierda, a lo largo del cuerpo del arma
  const th0 = [-hw - 0.006, top - 0.012, zR + 0.004], th1 = [-hw - 0.026, top + 0.008, zc - d * 0.25], th2 = [-hw - 0.026, top + 0.017, zF - 0.026];
  k.limb('g', th0, th1, 0.0165, 0.0145, { c: GLOVE, ball: true }); k.limb('g', th1, th2, 0.0145, 0.0125, { c: GLOVE, ball: true });
  k.box('l', [0.012, 0.004, 0.014], [th2[0], th2[1] + 0.011, th2[2] - 0.004], { k: 1, c: 0xffffff, rad: 0.001 });
  k.box('b', [0.028, 0.008, 0.04], [-hw - 0.024, top + 0.004, zc - d * 0.05], { c: plate, r: [0, 0, 0.2], rad: 0.003 });  // placa del pulgar
  // dorso de la mano: placa iridiscente + gema
  k.box('b', [0.02, 0.07, d + 0.03], [hw + 0.04, top - 0.052, zc - 0.002], { c: plate, rad: 0.008 });
  if (k.q.detail) k.poly('l', 'oct', 0.009, [hw + 0.052, top - 0.052, zc - 0.002], { k: 1, s: [0.7, 1.2, 1.2] });
  if (arm) forearm(k, [hw + 0.03, top - 0.06, zR + 0.06], [0.32, -0.3, 1], 0.5, 0.03, 0.04, hex);
  return [x1, top - 0.027, zR - 0.006];
}

/** Dedo índice: pieza con pivote en el nudillo. Llamar tras k.part('trigger', pivot). */
export function triggerFinger(k, g, pivot, reach) {
  const { hw, top } = g, x1 = hw + 0.013, p = pivot, f = [x1, p[1] + 0.001, g.zc - g.d / 2 - (reach ?? 0.02)];
  k.limb('g', p, f, 0.0125, 0.0115, { c: GLOVE, ball: true });
  k.limb('g', f, [x1 - 0.003, f[1] - 0.034, f[2] + 0.012], 0.0115, 0.0102, { c: GLOVE, ball: true });
  k.box('l', [0.009, 0.003, 0.011], [x1 - 0.003, f[1] - 0.04, f[2] + 0.014], { k: 1, c: 0xffffff, rad: 0.001 });
  return top;
}

/**
 * Mano izquierda de apoyo: agarre en "C" alrededor de un tubo.
 * c = [x,y,z] centro del tubo, R = radio del tubo, axis = 'z' (guardamanos) o 'y' (empuñadura vertical).
 * Los dedos pasan por debajo y suben por la derecha; el pulgar queda encima, a la izquierda.
 */
export function supportHand(k, c, R, hex, { axis = 'z', arm = true, spread = 1, flip = 1 } = {}) {
  const rot = axis === 'y' ? new THREE.Euler(Math.PI / 2, 0, 0) : new THREE.Euler(0, 0, 0), plate = tint(hex, 0.5), Rf = R + 0.012, r = 0.0125;
  const a0 = THREE.MathUtils.degToRad(-128), a1 = THREE.MathUtils.degToRad(35);
  k.at(c, [rot.x, rot.y, rot.z], () => {
    for (let i = 0; i < 4; i++) {
      const z = (-0.034 + i * 0.0225) * spread, ri = r * (1 - Math.abs(i - 1) * 0.04), end = a1 - (i === 3 ? 0.35 : 0);
      const pts = k.arc('g', 0, 0, Rf, a0, end, z, ri, 5, { c: GLOVE });
      const t = pts[pts.length - 1]; k.box('l', [0.011, 0.012, 0.0035], [t[0] + 0.0, t[1] + 0.001, z], { k: 1, c: 0xffffff, rad: 0.001, r: [0, 0, end + 0.3] });
      const kn = pts[1]; k.box('b', [0.02, 0.012, 0.022], [kn[0] - 0.006, kn[1] - 0.008, z], { c: plate, r: [0, 0, a0 + Math.PI / 2], rad: 0.005 });
    }
    // palma bajo el tubo y talón de la mano
    const pa = THREE.MathUtils.degToRad(-150);
    k.box('g', [0.058, 0.034, 0.1], [Math.cos(pa) * (Rf + 0.012), Math.sin(pa) * (Rf + 0.012), 0.002], { c: GLOVE, r: [0, 0, pa + Math.PI / 2], rad: 0.014 });
    k.box('b', [0.05, 0.012, 0.085], [Math.cos(pa - 0.12) * (Rf + 0.034), Math.sin(pa - 0.12) * (Rf + 0.034), 0.002], { c: plate, r: [0, 0, pa + Math.PI / 2 - 0.12], rad: 0.006 });
    // pulgar por encima, hacia adelante
    const t0 = [-Rf * 0.62, Rf * 0.9, 0.05], t1 = [-Rf * 0.3, Rf * 1.12, -0.012], t2 = [-Rf * 0.08, Rf * 1.1, -0.07];
    k.limb('g', t0, t1, 0.0165, 0.0145, { c: GLOVE, ball: true }); k.limb('g', t1, t2, 0.0145, 0.0125, { c: GLOVE, ball: true });
    k.box('l', [0.013, 0.004, 0.013], [t2[0], t2[1] + 0.009, t2[2] - 0.004], { k: 1, c: 0xffffff, rad: 0.001 });
    if (arm) { // antebrazo hacia atrás-abajo-izquierda (en el marco local; se corrige por eje)
      forearm(k, [Math.cos(pa) * (Rf + 0.025), Math.sin(pa) * (Rf + 0.025), 0.06], [-0.34 * flip, -0.2, 1], 0.5, 0.031, 0.04, hex);
    }
  });
}
